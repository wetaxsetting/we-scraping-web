import { api } from "@/lib/axios";
import { parseAttachmentFilename } from "@/lib/api/internalTransfer";
import { ApiCallError } from "@/lib/api/banking";
import type {
    ApiApprovalActionRequest,
    ApiCreateScheduledTransferRequest,
    ApiCreateScheduledTransferResponse,
    ApiDispatchRequest,
    ApiParseExcelResponse,
    ApiRequestApprovalRequest,
    ApiRequestApprovalResponse,
    ApiResponse,
    ApiScheduledTransferDetailResponse,
    ApiScheduledTransferListResponse,
    ApiTransferResultDetailResponse,
    ApiTransferResultListResponse,
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
    trnfStts?: "Y" | "N";
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
): Promise<ApiRequestApprovalResponse> {
    return unwrap<ApiRequestApprovalResponse>(
        api.post(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/request-approval`,
            request,
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
