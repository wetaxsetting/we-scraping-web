import { api } from "@/lib/axios";
import { APPROVAL_MULTIPART_CONFIG, buildApprovalForm } from "@/lib/api/approvalMultipart";
import { parseAttachmentFilename, streamBlobDownload, streamReportDownload } from "@/lib/api/internalTransfer";
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
 * Payment > Vendor Payment API client. Wraps Phase A of
 * `wecms-api/.../domain/payment/vendorpayment`:
 *
 *   GET /api/v1/payment/vendor-payment           (Scheduled list)
 *   GET /api/v1/payment/vendor-payment/results   (Payment Result list)
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

const BASE = "/api/v1/payment/vendor-payment";

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

export type VendorScheduledListQuery = {
    fromDate: string;        // yyyyMMdd
    toDate: string;          // yyyyMMdd
    srchWd?: string;
    /** Filter by approval-status code (legacy `APPR_TYPE_CD`). Empty / undefined = all.
     *  Applied server-side by `ScdulPymnSumrRepository.search` (00 Not Requested,
     *  01 Approved, 02 Rejected, 03 In Progress, 04 Pending) via the legacy
     *  `wb_get_appr_stts` function over the `EXPT_RESOL_MSTR` join. Verified 2026-06-16. */
    apprType?: string;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
    page?: number;
    size?: number;
};

/** Fetch the paged Vendor Payment Scheduled list. Mirrors legacy
 *  `pymn_0001_001_r001` (Phase A read path). */
export async function fetchVendorScheduledList(
    query: VendorScheduledListQuery,
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
 *  tenant for the Vendor Payment upload picker. Mirrors legacy
 *  `comm_1001_001`. */
export async function fetchVendorWithdrawalAccounts(
    ccyCd?: string,
): Promise<ApiWithdrawalAccountRow[]> {
    return unwrap<ApiWithdrawalAccountRow[]>(
        api.get(`${BASE}/withdrawal-accounts`, {
            params: ccyCd ? { ccy_cd: ccyCd } : undefined,
        }),
    );
}

/** Parse + per-line validate a Vendor Payment Excel upload. */
export async function parseVendorPaymentExcel(
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

/** Save a draft Vendor Payment batch. Two-part multipart: `file_data`
 *  (binary) + `request` (JSON). */
export async function createVendorPayment(
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

/** Fetch one Scheduled Vendor Payment batch detail (master + lines).
 *  Mirrors legacy `pymn_0001_002_r001` (Phase B read path). */
export async function fetchVendorPaymentDetail(
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
export async function fetchNextVendorDocNo(): Promise<string> {
    const res = await unwrap<{ doc_no: string }>(api.get(`${BASE}/next-doc-no`));
    return res.doc_no;
}

/** Fetch one Vendor Payment Result detail (master + lines).
 *  Mirrors legacy `pymn_0002_002_r001` (Phase B read path). */
export async function fetchVendorPaymentResultDetail(
    scdulPymnNo: string,
): Promise<ApiTransferResultDetailResponse> {
    return unwrap<ApiTransferResultDetailResponse>(
        api.get(`${BASE}/results/${encodeURIComponent(scdulPymnNo)}`),
    );
}

export type VendorPaymentResultListQuery = {
    fromDate: string;
    toDate: string;
    srchWd?: string;
    trnfStts?: "C" | "P";
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
    page?: number;
    size?: number;
};

/** Fetch the paged Vendor Payment Result list. Mirrors legacy
 *  `pymn_0002_001_r001` (Phase A read path). */
export async function fetchVendorPaymentResultList(
    query: VendorPaymentResultListQuery,
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
 *  vendor-payment endpoints. Wire request / response shapes are reused
 *  from `lib/types/api.ts` because the physical SCDUL_PYMN_SUMR table
 *  is shared and the backend DTOs are identical across the two modules.
 * -------------------------------------------------------------------------- */

/** Delete a draft Vendor Payment batch. Rejected with `WBE2062` when
 *  the batch has been submitted for approval (`APPR_SEQ_NO` set).
 *  Mirrors legacy `pymn_0001_001_d001`. */
export async function deleteVendorPayment(scdulPymnNo: string): Promise<void> {
    await unwrap<unknown>(
        api.delete(`${BASE}/${encodeURIComponent(scdulPymnNo)}`),
    );
}

/** Update the Reporting Account (`CHART_ACCT_*`) on one Vendor Payment
 *  line. Mirrors legacy `pymn_0009_002_u002` and Internal Transfer's
 *  twin endpoint. Used by the Scheduled detail picker so the
 *  user-selected code persists across reloads. */
export async function updateVendorReportingAccount(
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

/** Candidate bank transactions for a Vendor payment line
 *  (`GET .../{scdulPymnNo}/lines/{scdulPymnDetlNo}/match/candidates`). */
export async function getVendorMatchCandidates(
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

/** Match a Vendor payment line to a bank transaction
 *  (`POST .../{scdulPymnNo}/lines/{scdulPymnDetlNo}/match`). */
export async function matchVendorPaymentLine(
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

/** Unmatch a single Vendor payment line
 *  (`DELETE .../{scdulPymnNo}/lines/{scdulPymnDetlNo}/match`). */
export async function unmatchVendorPaymentLine(
    scdulPymnNo: string,
    scdulPymnDetlNo: string,
): Promise<ApiPaymentLineMatchResultResponse> {
    return unwrap<ApiPaymentLineMatchResultResponse>(
        api.delete(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/lines/${encodeURIComponent(scdulPymnDetlNo)}/match`,
        ),
    );
}

/** Unmatch every matched line under a Vendor batch
 *  (`DELETE .../{scdulPymnNo}/matches`). */
export async function unmatchAllVendorPaymentLines(
    scdulPymnNo: string,
): Promise<ApiPaymentLineUnmatchAllResponse> {
    return unwrap<ApiPaymentLineUnmatchAllResponse>(
        api.delete(`${BASE}/${encodeURIComponent(scdulPymnNo)}/matches`),
    );
}

/** Execute the "Transfer" action on an approved Vendor batch. Phase C
 *  stamps `TRNF_YN='Y'` + writes an audit row; no TB_PAY_TARGET /
 *  TB_PAY_FILE_MST insert (deferred). */
export async function dispatchVendorPayment(
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

/** Submit one Vendor Payment batch for approval. Phase C stamps a
 *  synthesised `APPR_SEQ_NO` on the master and writes an audit row;
 *  the per-leg approval-line fan-out lands when EXPT_RESOL_* is ported. */
export function requestVendorApproval(
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

/** Approve / reject the active approval request on one Vendor Payment
 *  batch. Stamps `APPR_STTS = "C"` (Approve) / `"X"` (Reject) on the
 *  master + writes an audit row. Surfaces `WBE2080` when the batch has
 *  no `APPR_SEQ_NO`, `WBE2081` when the batch is already finalised. */
export async function actOnVendorApproval(
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
 * Withdraw an in-flight approval request on a Vendor Payment batch —
 * the kebab-menu "Delete" action on the Approval Details popup.
 * Same shape as Internal Transfer; the backend routes through the
 * shared `ApprovalBoxFanoutService` so the EXPT_RESOL_* cleanup and
 * the Pending / In-Progress guard are identical across modules.
 */
export async function withdrawVendorApproval(
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
 * Replace the approver chain on an in-flight Vendor Payment approval
 * request — the kebab-menu "Edit" action.
 */
export async function changeVendorApprovalLine(
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
 * Stream the original Excel file uploaded with a Vendor Payment
 * batch. Mirrors `downloadOriginalExcel` on the Internal Transfer side
 * — backend endpoint at `GET /api/v1/payment/vendor-payment/{id}/file`
 * returns an `octet-stream` with the user's original filename in the
 * `Content-Disposition` header (RFC 5987 UTF-8). Used by both the
 * row-trailing download icon on the list and the file-card download
 * glyph on the detail page.
 */
export async function downloadOriginalVendorExcel(scdulPymnNo: string): Promise<void> {
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
 * Excel Download — the generated 22-column report for a Vendor Payment
 * Scheduled batch (legacy `pymn_0002_002_r002`, Vendor branch / type `01`).
 * Backend endpoint:
 * `GET /api/v1/payment/vendor-payment/{id}/report?lang=<locale>`.
 * Loads the locale template (EN/KO/VI; KM/other → EN) and populates one row
 * per transfer detail — including Contact Name (`TRCO_CMENM`) at column J.
 * This is NOT the original uploaded file — that remains the import source
 * only ({@link downloadOriginalVendorExcel}).
 */
export async function downloadVendorScheduledReport(
    scdulPymnNo: string,
    lang: string,
): Promise<void> {
    await streamReportDownload(
        `${BASE}/${encodeURIComponent(scdulPymnNo)}/report`,
        lang,
        `WeCMS_Vendor_Payment_download_${lang}.xlsx`,
    );
}

/**
 * Excel Download — the generated 22-column report for a Vendor Payment
 * Result batch. Same artifact as {@link downloadVendorScheduledReport} but
 * routed through the result-scoped endpoint so `payment-vendor-result` menu
 * authorization applies. Backend endpoint:
 * `GET /api/v1/payment/vendor-payment/results/{id}/report?lang=<locale>`.
 */
export async function downloadVendorResultReport(
    scdulPymnNo: string,
    lang: string,
): Promise<void> {
    await streamReportDownload(
        `${BASE}/results/${encodeURIComponent(scdulPymnNo)}/report`,
        lang,
        `WeCMS_Vendor_Payment_download_${lang}.xlsx`,
    );
}

/**
 * Toolbar Excel — the generated 22-column report for ALL batches in the
 * current Payment Result filter (legacy `pymn_0002_002_r003` bulk-report
 * parity). Same locale template + column layout (incl. Contact Name) as the
 * per-row report; the backend appends every filtered batch into one workbook.
 * Backend endpoint:
 * `GET /api/v1/payment/vendor-payment/results/report?from_date&to_date&srch_wd?&trnf_stts?&lang`.
 * Replaces the old from-scratch 7-column `ExcelExportService` summary.
 */
export async function downloadVendorResultBulkReport(
    filters: { fromDate: string; toDate: string; srchWd?: string; trnfStts?: string },
    lang: string,
): Promise<void> {
    await streamBlobDownload(
        `${BASE}/results/report`,
        {
            from_date: filters.fromDate,
            to_date:   filters.toDate,
            srch_wd:   filters.srchWd?.trim() || undefined,
            trnf_stts: filters.trnfStts || undefined,
            lang,
        },
        `WeCMS_Vendor_Payment_download_${lang}.xlsx`,
    );
}
