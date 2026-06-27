import { api } from "@/lib/axios";
import { APPROVAL_MULTIPART_CONFIG, buildApprovalForm } from "@/lib/api/approvalMultipart";
import { parseAttachmentFilename } from "@/lib/api/internalTransfer";
import { ApiCallError } from "@/lib/api/banking";
import type {
    ApiApprovalActionRequest,
    ApiCreateScheduledTransferRequest,
    ApiCreateScheduledTransferResponse,
    ApiDispatchRequest,
    ApiParseExcelResponse,
    ApiPayrollMatchCandidateListResponse,
    ApiPayrollMatchRequest,
    ApiPayrollMatchResultResponse,
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
 * Payment > Payroll Payment API client. Wraps
 * `wecms-api/.../domain/payment/payrollpayment`:
 *
 *   GET    /api/v1/payment/payroll-payment              (Scheduled list)
 *   GET    /api/v1/payment/payroll-payment/{id}         (Scheduled detail)
 *   GET    /api/v1/payment/payroll-payment/results      (Result list)
 *   GET    /api/v1/payment/payroll-payment/results/{id} (Result detail)
 *   POST   /api/v1/payment/payroll-payment              (Create draft)
 *   DELETE /api/v1/payment/payroll-payment/{id}         (Delete draft)
 *   POST   /api/v1/payment/payroll-payment/{id}/dispatch
 *   POST   /api/v1/payment/payroll-payment/{id}/request-approval
 *   POST   /api/v1/payment/payroll-payment/{id}/approval-action
 *   POST   /api/v1/payment/payroll-payment/uploads/parse
 *   GET    /api/v1/payment/payroll-payment/withdrawal-accounts
 *   GET    /api/v1/payment/payroll-payment/{id}/file
 *
 * Wire shape mirrors Internal Transfer / Vendor / Expense one-for-one —
 * all four share `SCDUL_PYMN_SUMR` via the `SCDUL_PYMN_TYPE_CD = '00'`
 * Payroll discriminator. Wire types from `lib/types/api.ts` are reused
 * as-is.
 */

const BASE = "/api/v1/payment/payroll-payment";

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    try {
        const res = await promise;
        const body = res.data;
        if (body.status.error) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        return body.data as T;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const axiosErr = err as { response?: { data?: ApiResponse<unknown> } };
        const body = axiosErr?.response?.data;
        if (body?.status) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        throw new ApiCallError("WBE_NETWORK", "Network error");
    }
}

export type PayrollScheduledListQuery = {
    fromDate: string;
    toDate: string;
    srchWd?: string;
    apprType?: string;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
    page?: number;
    size?: number;
};

/** Fetch the paged Payroll Scheduled list. Mirrors legacy `pymn_0005_001_r001`. */
export async function fetchPayrollScheduledList(
    query: PayrollScheduledListQuery,
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

/** Withdrawal accounts for the Payroll upload picker. */
export async function fetchPayrollWithdrawalAccounts(
    ccyCd?: string,
): Promise<ApiWithdrawalAccountRow[]> {
    return unwrap<ApiWithdrawalAccountRow[]>(
        api.get(`${BASE}/withdrawal-accounts`, {
            params: ccyCd ? { ccy_cd: ccyCd } : undefined,
        }),
    );
}

/** Parse + per-line validate a Payroll Payment Excel upload. */
export async function parsePayrollPaymentExcel(
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

/** Save a draft Payroll Payment batch. */
export async function createPayrollPayment(
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

/** Scheduled Payroll detail (master + lines). Mirrors `pymn_0005_003_r001`. */
export async function fetchPayrollPaymentDetail(
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
export async function fetchNextPayrollDocNo(): Promise<string> {
    const res = await unwrap<{ doc_no: string }>(api.get(`${BASE}/next-doc-no`));
    return res.doc_no;
}

/** Payroll Payment Result detail. Mirrors `pymn_0006_002_r001`. */
export async function fetchPayrollPaymentResultDetail(
    scdulPymnNo: string,
): Promise<ApiTransferResultDetailResponse> {
    return unwrap<ApiTransferResultDetailResponse>(
        api.get(`${BASE}/results/${encodeURIComponent(scdulPymnNo)}`),
    );
}

export type PayrollPaymentResultListQuery = {
    fromDate: string;
    toDate: string;
    srchWd?: string;
    trnfStts?: "C" | "P";
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
    page?: number;
    size?: number;
};

/** Payroll Payment Result list. Mirrors `pymn_0006_001_r001`. */
export async function fetchPayrollPaymentResultList(
    query: PayrollPaymentResultListQuery,
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
 *  Write actions
 * -------------------------------------------------------------------------- */

export async function deletePayrollPayment(scdulPymnNo: string): Promise<void> {
    await unwrap<unknown>(
        api.delete(`${BASE}/${encodeURIComponent(scdulPymnNo)}`),
    );
}

/** Update the Reporting Account on one Payroll Payment line. Mirrors
 *  Internal Transfer's twin endpoint. */
export async function updatePayrollReportingAccount(
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


export async function dispatchPayrollPayment(
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

export function requestPayrollApproval(
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

export async function actOnPayrollApproval(
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
 * Withdraw an in-flight approval request on a Payroll Payment batch —
 * the kebab-menu "Delete" action on the Approval Details popup.
 */
export async function withdrawPayrollApproval(
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
 * Replace the approver chain on an in-flight Payroll Payment approval
 * request — the kebab-menu "Edit" action.
 */
export async function changePayrollApprovalLine(
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

/* ----------------------------------------------------------------------------
 *  Banking match — Result detail (legacy pymn_0006_002 + comm_0197_* batch path)
 *  Header-level / batch-level, 1:1. No Unmatch-All.
 * -------------------------------------------------------------------------- */

/** Candidate bank transactions for a Payroll batch. Mirrors
 *  `comm_0197_001_r001` (batch path) — candidates are pinned server-side to
 *  the batch's exact pay date + total amount; only the keyword filters. */
export async function fetchPayrollMatchCandidates(
    scdulPymnNo: string,
    srchWd?: string,
): Promise<ApiPayrollMatchCandidateListResponse> {
    return unwrap<ApiPayrollMatchCandidateListResponse>(
        api.get(`${BASE}/${encodeURIComponent(scdulPymnNo)}/match/candidates`, {
            params: srchWd && srchWd.trim() ? { srch_wd: srchWd.trim() } : undefined,
        }),
    );
}

/** Match a Payroll batch to a bank transaction. Mirrors
 *  `comm_0197_001_c001` (batch path). */
export async function matchPayrollBatch(
    scdulPymnNo: string,
    request: ApiPayrollMatchRequest,
): Promise<ApiPayrollMatchResultResponse> {
    return unwrap<ApiPayrollMatchResultResponse>(
        api.post(`${BASE}/${encodeURIComponent(scdulPymnNo)}/match`, request),
    );
}

/** Unmatch a Payroll batch. Mirrors `comm_0197_002_u001` (batch path).
 *  No Unmatch-All for Payroll. */
export async function unmatchPayrollBatch(
    scdulPymnNo: string,
): Promise<ApiPayrollMatchResultResponse> {
    return unwrap<ApiPayrollMatchResultResponse>(
        api.delete(`${BASE}/${encodeURIComponent(scdulPymnNo)}/match`),
    );
}

/** Stream the original Excel file uploaded with a Payroll Payment batch. */
export async function downloadOriginalPayrollExcel(scdulPymnNo: string): Promise<void> {
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
