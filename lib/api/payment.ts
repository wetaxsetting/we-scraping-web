import { api } from "@/lib/axios";
import type { ApiResponse, ApiWithdrawalAccountRow } from "@/lib/types/api";

export class ApiCallError extends Error {
    code: string;
    constructor(code: string, message: string) {
        super(message);
        this.code = code;
    }
}

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
