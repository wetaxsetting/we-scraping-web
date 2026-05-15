import { api } from "@/lib/axios";
import { ApiCallError } from "@/lib/api/banking";
import type { ApiResponse, ApiWithdrawalAccountRow } from "@/lib/types/api";

export { ApiCallError };

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    try {
        const res = await promise;
        const body = res.data;
        if (body.status.error || !body.data) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        return body.data;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

export interface ApiOverseasScheduledRow {
    ovrs_pymn_no: string;
    ccy_cd: string;
    ovrs_pymn_type_cd: string;
    titl: string;
    appr_seq_no: string;
    total_tran_amt: number;
    tot_trns_cnt: number;
    reg_dtm: string;
    draft_user_id: string;
    draft_user_nm: string;
    appr_stts: string;
    trnf_yn: string;
    apprvr_appr_tot_cnt: number;
    apprvr_tot_cnt: number;
    appr_dv: string;
    doc_no: string;
    file_url: string;
    out_bank_cd: string;
    out_bank_nm: string;
    wdrl_act_no: string;
    bnfc_nm: string;
    ovrs_pymn_type: string;
    pay_date: string;
    file_nm: string;
    reg_id: string;
}

export interface ApiOverseasCurrencyTotal {
    ccy_cd: string;
    total_tran_amt: number;
}

export interface ApiOverseasScheduledListResponse {
    total_count: number;
    page: number;
    size: number;
    rows: ApiOverseasScheduledRow[];
    totals: ApiOverseasCurrencyTotal[];
}

// ---------------------------------------------------------------------------
// Result list
// ---------------------------------------------------------------------------

export interface ApiOverseasResultRow {
    ovrs_pymn_no: string;
    ccy_cd: string;
    file_nm: string;
    total_tran_amt: number;
    tot_trns_cnt: number;
    reg_dtm: string;
    draft_user_nm: string | null;
    reg_id: string;
    out_bank_nm: string | null;
    out_bank_cd: string | null;
    wdrl_act_no: string | null;
    trnf_yn: string;
    doc_no: string | null;
    titl: string | null;
    success_count: number;
    failed_count: number;
}

export interface ApiOverseasResultListResponse {
    total_count: number;
    page: number;
    size: number;
    rows: ApiOverseasResultRow[];
    totals: ApiOverseasCurrencyTotal[];
}

export interface OverseasScheduledListParams {
    from_dt: string;
    to_dt: string;
    appr_type_cd?: string[];
    keyword?: string;
    page?: number;
    size?: number;
}

export const fetchOverseasScheduledList = async (
    params: OverseasScheduledListParams,
): Promise<ApiOverseasScheduledListResponse> => {
    return unwrap(
        api.get<ApiResponse<ApiOverseasScheduledListResponse>>("/api/v1/payment/overseas-payment/scheduled", { params })
    );
};

/**
 * Firm-banking-capable withdrawal accounts for the Overseas Payment
 * Excel Upload dialog Step 3 — "Withdrawal Bank/Account No." picker.
 *
 * Mirrors legacy {@code comm_1001_001}; same ACCT_MSTR + TB_FIRM_CONF
 * join as internal transfer.
 *
 * Display format: `"${bank_nm} ${acct_no} (${acctTypeLabel} ${ccy_cd})"`.
 *
 * @param ccyCd optional currency filter (e.g. `"USD"`); omit for all.
 */
export const fetchOverseasWithdrawalAccounts = (
    ccyCd?: string,
): Promise<ApiWithdrawalAccountRow[]> => {
    return unwrap(
        api.get<ApiResponse<ApiWithdrawalAccountRow[]>>(
            "/api/v1/payment/overseas-payment/withdrawal-accounts",
            ccyCd ? { params: { ccy_cd: ccyCd } } : undefined,
        ),
    );
};

// ---------------------------------------------------------------------------
// Excel upload preview
// ---------------------------------------------------------------------------

export interface ApiOverseasPaymentExcelFieldError {
    field: string;
    message: string;
}

export interface ApiOverseasPaymentExcelPreviewRow {
    row_index: number;
    currency: string;
    amount: string;
    fee_payer: string;
    beneficiary_code: string;
    memo: string;
    reporting_account: string;
    valid: boolean;
    errors: ApiOverseasPaymentExcelFieldError[];
}

export interface ApiOverseasPaymentExcelPreview {
    rows: ApiOverseasPaymentExcelPreviewRow[];
    total_count: number;
    completed_count: number;
    error_count: number;
}

/** Parse and validate an overseas payment Excel file via the backend.
 *  Returns all rows (valid + invalid) with per-cell error details. */
export function previewOverseasPaymentExcel(
    file: File,
): Promise<ApiOverseasPaymentExcelPreview> {
    const form = new FormData();
    form.append("file", file);
    return unwrap(
        api.post<ApiResponse<ApiOverseasPaymentExcelPreview>>(
            "/api/v1/payment/overseas-payment/excel-preview",
            form,
            { headers: { "Content-Type": "multipart/form-data" } },
        ),
    );
}

// ---------------------------------------------------------------------------
// Excel upload submit
// ---------------------------------------------------------------------------

export interface ApiOverseasPaymentExcelDetailRow {
    trn_seq:      number;
    bnfc_code:    string;
    ccy_cd:       string;
    trnf_amt:     number;
    fee_payer_cd: string;
    memo:         string;
    rprt_acct_cd: string | null;
    bnfc_nm:      string;
    bnfc_bank_nm: string;
    bic_cd:       string;
    bnfc_acct_no: string;
    bnfc_addr:    string;
}

export interface ApiOverseasPaymentExcelUploadRequest {
    file_nm:         string;
    ccy_cd:          string;
    total_tran_amt:  number;
    tot_trns_cnt:    number;
    wdrl_bank_cd:    string;
    wdrl_bank_nm:    string;
    wdrl_acct_no:    string;
    rows:            ApiOverseasPaymentExcelDetailRow[];
}

export interface ApiOverseasPaymentExcelUploadResult {
    ovrs_pymn_no: string;
}

/**
 * Persist the overseas-payment Excel batch summary.
 * Called after the user confirms upload in Step 3 of the dialog.
 * Returns the allocated {@code OVRS_PYMN_NO}.
 */
export function submitOverseasPaymentExcel(
    body: ApiOverseasPaymentExcelUploadRequest,
): Promise<ApiOverseasPaymentExcelUploadResult> {
    return unwrap(
        api.post<ApiResponse<ApiOverseasPaymentExcelUploadResult>>(
            "/api/v1/payment/overseas-payment/excel-upload",
            body,
        ),
    );
}

// ---------------------------------------------------------------------------
// Single scheduled row
// ---------------------------------------------------------------------------

export const fetchOverseasScheduledById = (
    id: string,
): Promise<ApiOverseasScheduledRow> =>
    unwrap(
        api.get<ApiResponse<ApiOverseasScheduledRow>>(
            `/api/v1/payment/overseas-payment/scheduled/${encodeURIComponent(id)}`,
        ),
    );

// ---------------------------------------------------------------------------
// Result list + single result row
// ---------------------------------------------------------------------------

export interface OverseasResultListParams {
    from_dt: string;
    to_dt: string;
    keyword?: string;
    page?: number;
    size?: number;
}

export const fetchOverseasResultList = (
    params: OverseasResultListParams,
): Promise<ApiOverseasResultListResponse> =>
    unwrap(
        api.get<ApiResponse<ApiOverseasResultListResponse>>(
            "/api/v1/payment/overseas-payment/result",
            { params },
        ),
    );

export const fetchOverseasResultById = (
    id: string,
): Promise<ApiOverseasResultRow> =>
    unwrap(
        api.get<ApiResponse<ApiOverseasResultRow>>(
            `/api/v1/payment/overseas-payment/result/${encodeURIComponent(id)}`,
        ),
    );
