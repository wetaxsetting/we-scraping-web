import { api } from "@/lib/axios";
import { APPROVAL_MULTIPART_CONFIG, buildApprovalForm } from "@/lib/api/approvalMultipart";
import { parseAttachmentFilename, streamReportDownload } from "@/lib/api/internalTransfer";
import { ApiCallError } from "@/lib/api/banking";
import type {
    ApiApprovalActionRequest,
    ApiCreateScheduledTransferRequest,
    ApiCreateScheduledTransferResponse,
    ApiDispatchRequest,
    ApiParseExcelResponse,
    ApiPaymentLineMatchCandidateListResponse,
    ApiPaymentLineMatchRequest,
    ApiPaymentLineMatchResultResponse,
    ApiPaymentLineUnmatchAllResponse,
    ApiRequestApprovalRequest,
    ApiRequestApprovalResponse,
    ApiResponse,
    ApiScheduledTransferDetailResponse,
    ApiScheduledTransferListResponse,
    ApiTransferResultDetailResponse,
    ApiTransferResultListResponse,
    ApiUpdateReportingAccountRequest,
    ApiWithdrawalAccountRow,
} from "@/lib/types/api";

/**
 * Payment > Expense Payment API client. Wraps Phase A of
 * `wecms-api/.../domain/payment/vendorpayment`:
 *
 *   GET /api/v1/payment/expense-payment           (Scheduled list)
 *   GET /api/v1/payment/expense-payment/results   (Payment Result list)
 *
 * Detail / create / dispatch / request-approval endpoints land in
 * Phase B following the locked Internal Transfer baseline (workspace
 * memory `project_payment_module_reference.md`).
 *
 * Wire shape mirrors Internal Transfer one-for-one — Vendor and
 * Internal Transfer share the same physical `SCDUL_PYMN_SUMR` table
 * with `SCDUL_PYMN_TYPE_CD = '01'` (Vendor) vs `'03'` (Internal). The
 * wire types from `lib/types/api.ts` are reused as-is.
 *
 * Every call goes through the shared `api` Axios instance so the
 * JWT interceptor + 401 session-expired re-auth bus apply uniformly.
 */

const BASE = "/api/v1/payment/expense-payment";

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    try {
        const res = await promise;
        const body = res.data;
        if (body.status.error) {
            throw new ApiCallError(
                body.status.code,
                body.status.message,
            );
        }
        return body.data as T;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const axiosErr = err as { response?: { data?: ApiResponse<unknown> } };
        const body = axiosErr?.response?.data;
        if (body?.status) {
            throw new ApiCallError(
                body.status.code,
                body.status.message,
            );
        }
        throw new ApiCallError("WBE_NETWORK", "Network error");
    }
}

export type ExpenseScheduledListQuery = {
    fromDate: string;        // yyyyMMdd
    toDate: string;          // yyyyMMdd
    srchWd?: string;
    /** Filter by approval-status code (legacy `APPR_TYPE_CD`). Empty / undefined = all.
     *  Honoured by the wire today; backend echoes it through and ignores
     *  the unknown param until the EXPT_RESOL_* tables join — same
     *  parity stance as Internal Transfer. */
    apprType?: string;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
    page?: number;
    size?: number;
};

/** Fetch the paged Expense Payment Scheduled list. Mirrors legacy
 *  `pymn_0003_001_r001` (Phase A read path). */
export async function fetchExpenseScheduledList(
    query: ExpenseScheduledListQuery,
): Promise<ApiScheduledTransferListResponse> {
    return unwrap<ApiScheduledTransferListResponse>(
        api.get(BASE, {
            params: {
                from_date:       query.fromDate,
                to_date:         query.toDate,
                srch_wd:         query.srchWd ?? undefined,
                appr_type:       query.apprType ?? undefined,
                sort_field:      query.sortField ?? undefined,
                sort_direction:  query.sortDirection ?? undefined,
                page:            query.page ?? 0,
                size:            query.size ?? 10,
            },
        }),
    );
}

/** Firm-banking-capable withdrawal accounts available to the current
 *  tenant for the Expense Payment upload picker. Mirrors legacy
 *  `comm_1001_001`. */
export async function fetchExpenseWithdrawalAccounts(
    ccyCd?: string,
): Promise<ApiWithdrawalAccountRow[]> {
    return unwrap<ApiWithdrawalAccountRow[]>(
        api.get(`${BASE}/withdrawal-accounts`, {
            params: ccyCd ? { ccy_cd: ccyCd } : undefined,
        }),
    );
}

/** Parse + per-line validate a Expense Payment Excel upload. */
export async function parseExpensePaymentExcel(
    file: File,
    bankCd: string,
): Promise<ApiParseExcelResponse> {
    const form = new FormData();
    form.append("file_data", file);
    form.append("bank_cd", bankCd);
    return unwrap<ApiParseExcelResponse>(
        api.post(`${BASE}/uploads/parse`, form, {
            headers: { "Content-Type": "multipart/form-data" },
        }),
    );
}

/** Save a draft Expense Payment batch. Two-part multipart: `file_data`
 *  (binary) + `request` (JSON). */
export async function createExpensePayment(
    file: File | null,
    request: ApiCreateScheduledTransferRequest,
): Promise<ApiCreateScheduledTransferResponse> {
    const form = new FormData();
    if (file) form.append("file_data", file);
    form.append(
        "request",
        new Blob([JSON.stringify(request)], { type: "application/json" }),
    );
    return unwrap<ApiCreateScheduledTransferResponse>(
        api.post(BASE, form, {
            headers: { "Content-Type": "multipart/form-data" },
        }),
    );
}

/** Fetch one Scheduled Expense Payment batch detail (master + lines).
 *  Mirrors legacy `pymn_0003_002_r001` (Phase B read path). */
export async function fetchExpensePaymentDetail(
    scdulPymnNo: string,
): Promise<ApiScheduledTransferDetailResponse> {
    return unwrap<ApiScheduledTransferDetailResponse>(
        api.get(`${BASE}/${encodeURIComponent(scdulPymnNo)}`),
    );
}

/**
 * Preview the next `VO_YYMMDD_NNN` document number for the Request Approval
 * popup. Read-only / non-reserving — the authoritative value is stamped at
 * submit. Mirrors `fetchNextInternalTransferDocNo`.
 */
export async function fetchNextExpenseDocNo(): Promise<string> {
    const res = await unwrap<{ doc_no: string }>(api.get(`${BASE}/next-doc-no`));
    return res.doc_no;
}

/** Fetch one Expense Payment Result detail (master + lines).
 *  Mirrors legacy `pymn_0004_002_r001` (Phase B read path). */
export async function fetchExpensePaymentResultDetail(
    scdulPymnNo: string,
): Promise<ApiTransferResultDetailResponse> {
    return unwrap<ApiTransferResultDetailResponse>(
        api.get(`${BASE}/results/${encodeURIComponent(scdulPymnNo)}`),
    );
}

export type ExpensePaymentResultListQuery = {
    fromDate: string;
    toDate: string;
    srchWd?: string;
    trnfStts?: "C" | "P";
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
    page?: number;
    size?: number;
};

/** Fetch the paged Expense Payment Result list. Mirrors legacy
 *  `pymn_0004_001_r001` (Phase A read path). */
export async function fetchExpensePaymentResultList(
    query: ExpensePaymentResultListQuery,
): Promise<ApiTransferResultListResponse> {
    return unwrap<ApiTransferResultListResponse>(
        api.get(`${BASE}/results`, {
            params: {
                from_date:       query.fromDate,
                to_date:         query.toDate,
                srch_wd:         query.srchWd ?? undefined,
                trnf_stts:       query.trnfStts ?? undefined,
                sort_field:      query.sortField ?? undefined,
                sort_direction:  query.sortDirection ?? undefined,
                page:            query.page ?? 0,
                size:            query.size ?? 10,
            },
        }),
    );
}

/* ----------------------------------------------------------------------------
 *  Phase C — write actions
 *
 *  Mirrors the Internal Transfer client surface but POSTs to the
 *  expense-payment endpoints. Wire request / response shapes are reused
 *  from `lib/types/api.ts` because the physical SCDUL_PYMN_SUMR table
 *  is shared and the backend DTOs are identical across the two modules.
 * -------------------------------------------------------------------------- */

/** Delete a draft Expense Payment batch. Rejected with `WBE2062` when
 *  the batch has been submitted for approval (`APPR_SEQ_NO` set).
 *  Mirrors legacy `pymn_0003_001_d001`. */
export async function deleteExpensePayment(scdulPymnNo: string): Promise<void> {
    await unwrap<unknown>(
        api.delete(`${BASE}/${encodeURIComponent(scdulPymnNo)}`),
    );
}

/** Update the Reporting Account on one Expense Payment line. Mirrors
 *  Internal Transfer's twin endpoint. */
export async function updateExpenseReportingAccount(
    scdulPymnNo: string,
    scdulPymnDetlNo: string,
    request: ApiUpdateReportingAccountRequest,
): Promise<void> {
    await unwrap<unknown>(
        api.patch(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/lines/${encodeURIComponent(scdulPymnDetlNo)}/reporting-account`,
            request,
        ),
    );
}

/* ---------------------------------------------------------------------------
 * Banking Match (Phase 3) — per-line, legacy comm_0197_* domestic path.
 * ------------------------------------------------------------------------- */

/** Candidate bank transactions for an Expense payment line
 *  (`GET .../{scdulPymnNo}/lines/{scdulPymnDetlNo}/match/candidates`). */
export async function getExpenseMatchCandidates(
    scdulPymnNo: string,
    scdulPymnDetlNo: string,
    srchWd?: string,
): Promise<ApiPaymentLineMatchCandidateListResponse> {
    return unwrap<ApiPaymentLineMatchCandidateListResponse>(
        api.get(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/lines/${encodeURIComponent(scdulPymnDetlNo)}/match/candidates`,
            { params: srchWd && srchWd.trim() ? { srch_wd: srchWd.trim() } : undefined },
        ),
    );
}

/** Match an Expense payment line to a bank transaction
 *  (`POST .../{scdulPymnNo}/lines/{scdulPymnDetlNo}/match`). */
export async function matchExpensePaymentLine(
    scdulPymnNo: string,
    scdulPymnDetlNo: string,
    request: ApiPaymentLineMatchRequest,
): Promise<ApiPaymentLineMatchResultResponse> {
    return unwrap<ApiPaymentLineMatchResultResponse>(
        api.post(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/lines/${encodeURIComponent(scdulPymnDetlNo)}/match`,
            request,
        ),
    );
}

/** Unmatch a single Expense payment line
 *  (`DELETE .../{scdulPymnNo}/lines/{scdulPymnDetlNo}/match`). */
export async function unmatchExpensePaymentLine(
    scdulPymnNo: string,
    scdulPymnDetlNo: string,
): Promise<ApiPaymentLineMatchResultResponse> {
    return unwrap<ApiPaymentLineMatchResultResponse>(
        api.delete(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/lines/${encodeURIComponent(scdulPymnDetlNo)}/match`,
        ),
    );
}

/** Unmatch every matched line under an Expense batch
 *  (`DELETE .../{scdulPymnNo}/matches`). */
export async function unmatchAllExpensePaymentLines(
    scdulPymnNo: string,
): Promise<ApiPaymentLineUnmatchAllResponse> {
    return unwrap<ApiPaymentLineUnmatchAllResponse>(
        api.delete(`${BASE}/${encodeURIComponent(scdulPymnNo)}/matches`),
    );
}

/** Execute the "Transfer" action on an approved Vendor batch. Phase C
 *  stamps `TRNF_YN='Y'` + writes an audit row; no TB_PAY_TARGET /
 *  TB_PAY_FILE_MST insert (deferred). */
export async function dispatchExpensePayment(
    scdulPymnNo: string,
    request: ApiDispatchRequest,
): Promise<void> {
    await unwrap<unknown>(
        api.post(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/dispatch`,
            request,
        ),
    );
}

/** Submit one Expense Payment batch for approval. Phase C stamps a
 *  synthesised `APPR_SEQ_NO` on the master and writes an audit row;
 *  the per-leg approval-line fan-out lands when EXPT_RESOL_* is ported. */
export function requestExpenseApproval(
    scdulPymnNo: string,
    request: ApiRequestApprovalRequest,
    attachments?: File[],
): Promise<ApiRequestApprovalResponse> {
    // M-1: multipart so attachments persist into EXPT_RESOL_FILE (legacy parity).
    return unwrap<ApiRequestApprovalResponse>(
        api.post(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/request-approval`,
            buildApprovalForm(request, attachments),
            APPROVAL_MULTIPART_CONFIG,
        ),
    );
}

/** Approve / reject the active approval request on one Expense Payment
 *  batch. Stamps `APPR_STTS = "C"` (Approve) / `"X"` (Reject) on the
 *  master + writes an audit row. Surfaces `WBE2080` when the batch has
 *  no `APPR_SEQ_NO`, `WBE2081` when the batch is already finalised. */
export async function actOnExpenseApproval(
    scdulPymnNo: string,
    request: ApiApprovalActionRequest,
): Promise<void> {
    await unwrap<unknown>(
        api.post(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/approval-action`,
            request,
        ),
    );
}

/**
 * Withdraw an in-flight approval request on an Expense Payment batch —
 * the kebab-menu "Delete" action on the Approval Details popup.
 * Backend routes through the shared `ApprovalBoxFanoutService`.
 */
export async function withdrawExpenseApproval(
    scdulPymnNo: string,
): Promise<void> {
    if (!scdulPymnNo.trim()) {
        throw new ApiCallError("WBE_VALIDATION", "scdul_pymn_no: required");
    }
    await unwrap<void>(
        api.delete(`${BASE}/${encodeURIComponent(scdulPymnNo.trim())}/approval`),
    );
}

/**
 * Replace the approver chain on an in-flight Expense Payment approval
 * request — the kebab-menu "Edit" action.
 */
export async function changeExpenseApprovalLine(
    scdulPymnNo: string,
    apprLineNo: number,
): Promise<void> {
    if (!scdulPymnNo.trim()) {
        throw new ApiCallError("WBE_VALIDATION", "scdul_pymn_no: required");
    }
    await unwrap<void>(
        api.put(
            `${BASE}/${encodeURIComponent(scdulPymnNo.trim())}/approval-line`,
            { appr_line_no: apprLineNo },
        ),
    );
}

/**
 * Stream the original Excel file uploaded with a Expense Payment
 * batch. Mirrors `downloadOriginalExcel` on the Internal Transfer side
 * — backend endpoint at `GET /api/v1/payment/expense-payment/{id}/file`
 * returns an `octet-stream` with the user's original filename in the
 * `Content-Disposition` header (RFC 5987 UTF-8). Used by both the
 * row-trailing download icon on the list and the file-card download
 * glyph on the detail page.
 */
export async function downloadOriginalExpenseExcel(scdulPymnNo: string): Promise<void> {
    try {
        const res = await api.get(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/file`,
            { responseType: "blob" },
        );

        const disposition = (res.headers["content-disposition"] as string) ?? "";
        const filename = parseAttachmentFilename(disposition) ?? `${scdulPymnNo}.xlsx`;

        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
        // Blob-response errors arrive with the JSON envelope serialised
        // as a Blob; read the bytes back as text + JSON.parse so the
        // caller sees the same `ApiCallError` shape JSON endpoints throw.
        if (err && typeof err === "object" && "response" in err) {
            const ax = err as { response?: { data?: Blob } };
            const data = ax.response?.data;
            if (data instanceof Blob) {
                const text = await data.text();
                try {
                    const body = JSON.parse(text) as { status?: { code?: string; message?: string } };
                    if (body.status?.code && body.status?.message) {
                        throw new ApiCallError(body.status.code, body.status.message);
                    }
                } catch (parseErr) {
                    if (parseErr instanceof ApiCallError) throw parseErr;
                }
            }
        }
        if (err instanceof ApiCallError) throw err;
        const e = err as { message?: string };
        throw new ApiCallError("WBE_NETWORK", e.message ?? "Network error");
    }
}

/**
 * Excel Download — the generated 22-column report for an Expense Payment
 * Scheduled batch (legacy `pymn_0002_002_r002`, Expense branch / type `02`).
 * Backend endpoint:
 * `GET /api/v1/payment/expense-payment/{id}/report?lang=<locale>`.
 * Loads the locale template (EN/KO/VI; KM/other → EN) and populates one row
 * per transfer detail — including Contact Name (`TRCO_CMENM`) at column J.
 * This is NOT the original uploaded file — that remains the import source
 * only ({@link downloadOriginalExpenseExcel}).
 */
export async function downloadExpenseScheduledReport(
    scdulPymnNo: string,
    lang: string,
): Promise<void> {
    await streamReportDownload(
        `${BASE}/${encodeURIComponent(scdulPymnNo)}/report`,
        lang,
        `WeCMS_Expense_Payment_download_${lang}.xlsx`,
    );
}

/**
 * Excel Download — the generated 22-column report for an Expense Payment
 * Result batch. Same artifact as {@link downloadExpenseScheduledReport} but
 * routed through the result-scoped endpoint so `payment-expense-result` menu
 * authorization applies. Backend endpoint:
 * `GET /api/v1/payment/expense-payment/results/{id}/report?lang=<locale>`.
 */
export async function downloadExpenseResultReport(
    scdulPymnNo: string,
    lang: string,
): Promise<void> {
    await streamReportDownload(
        `${BASE}/results/${encodeURIComponent(scdulPymnNo)}/report`,
        lang,
        `WeCMS_Expense_Payment_download_${lang}.xlsx`,
    );
}
