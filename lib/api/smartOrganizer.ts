import { api } from "@/lib/axios";
import type { ApiResponse } from "@/lib/types/api";

import { ApiCallError } from "@/lib/api/banking";

/**
 * Banking > Smart Organizer API client. Mirrors the controllers in
 * wecms-api/.../domain/banking/smartorganizer/controller/*.java.
 *
 * Wire shape: lowercase snake_case (global Jackson naming strategy).
 * Frontend in-memory shapes use camelCase semantic names; the
 * translation happens once at the boundary inside the helpers below.
 */

// ---- Wire types (snake_case, mirror DTOs) -----------------------------

export interface ApiOrganizerRuleRow {
    rmrk_seq_no: number;
    rcv_pay_dv: "RCV" | "PAY" | null;
    rmrk: string;
    match_type: "C" | "E";
    disp_ord: number;
    trco_key: string | null;
    use_usag_cd: string | null;
    vas_acct_seq_no: number | null;
    chart_acct_seq_no: string | null;
    chart_acct_cd: string | null;
    reg_id: string | null;
    reg_dtm: string | null;
}

export interface ApiOrganizerRuleListResponse {
    total_count: number;
    rows: ApiOrganizerRuleRow[];
}

export interface ApiOrganizerRuleSaveRequest {
    rmrk: string;
    match_type: "C" | "E";
    rcv_pay_dv: "RCV" | "PAY";
    disp_ord?: number;
    trco_key?: string;
    use_usag_cd?: string;
    vas_acct_seq_no?: number;
    chart_acct_seq_no?: string;
    chart_acct_cd?: string;
}

export interface ApiOrganizerRuleReorderRequest {
    rows: { rmrk_seq_no: number; disp_ord: number }[];
}

export interface ApiEligibleTransactionRow {
    acct_seq_no: string;
    bank_cd: string | null;
    // R07 — resolved bank name + account nickname (legacy R028 returned these).
    bank_nm: string | null;
    acct_no: string | null;
    acct_nick_nm: string | null;
    trsc_dt: string;
    trsc_tm: string | null;
    inout_dv: string | null;
    in_amt: string | null;
    out_amt: string | null;
    // R07 — running balance.
    bal: string | null;
    // R06 — account currency so the frontend formats amounts correctly (VND + FCY).
    ccy_cd: string | null;
    rmrk: string | null;
    matched_rmrk_seq_no: number | null;
    chart_acct_cd: string | null;
    chart_acct_seq_no: string | null;
    // R07 — resolved reporting-account name (+ level path placeholder).
    chart_acct_nm: string | null;
    chart_acct_level_nm: string | null;
    use_usag_cd: string | null;
    disp_usag_nm: string | null;
    vas_acct_seq_no: number | null;
    disp_vas_acct_nm: string | null;
    trco_key: string | null;
    disp_trco_nm: string | null;
}

export interface ApiEligibleTransactionListResponse {
    total_count: number;
    rows: ApiEligibleTransactionRow[];
}

export interface ApiSmartOrganizerConfirmRequest {
    /** Selected-account scope (R11) — confirm operates only on the account
     *  currently selected in Transaction History. */
    bank_cd: string;
    acct_no: string;
    rows: {
        acct_seq_no: string;
        use_usag_cd?: string;
        vas_acct_seq_no?: number;
        trco_key?: string;
        chart_acct_cd?: string;
        chart_acct_seq_no?: string;
    }[];
}

export interface ApiSmartOrganizerConfirmResponse {
    confirmed_count: number;
}

// ---- Unwrap helper ----------------------------------------------------

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    try {
        const res = await promise;
        const body = res.data;
        if (body.status.error) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        // `body.data` may be undefined / null on `void` endpoints (DELETE,
        // reorder) — that's a successful response, not an error.
        return body.data as T;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

// ---- Endpoints --------------------------------------------------------

/**
 * GET /api/v1/banking/smart-organizer/eligible
 * List rule-matched, unconfirmed transactions for the **selected account**
 * (R11 — Smart Organizer is account-scoped, never tenant-wide). `bankCd`
 * and `acctNo` are required and come from the Transaction History account
 * the user opened Smart Organizer from. Dates are wire form `YYYYMMDD`
 * (the helper accepts `YYYY-MM-DD` and normalises on the backend side).
 */
export function fetchEligibleTransactions(params: {
    bankCd: string;
    acctNo: string;
    fromDt: string;
    toDt: string;
    keyword?: string;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
    page?: number;
    size?: number;
}): Promise<ApiEligibleTransactionListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiEligibleTransactionListResponse>>(
            "/api/v1/banking/smart-organizer/eligible",
            {
                params: {
                    bank_cd: params.bankCd,
                    acct_no: params.acctNo,
                    from_dt: params.fromDt,
                    to_dt: params.toDt,
                    q: params.keyword || undefined,
                    sort_field: params.sortField || undefined,
                    sort_dir: params.sortDirection || undefined,
                    page: params.page,
                    size: params.size,
                },
            },
        ),
    );
}

/** POST /api/v1/banking/smart-organizer/confirm */
export function confirmEligibleTransactions(
    body: ApiSmartOrganizerConfirmRequest,
): Promise<ApiSmartOrganizerConfirmResponse> {
    return unwrap(
        api.post<ApiResponse<ApiSmartOrganizerConfirmResponse>>(
            "/api/v1/banking/smart-organizer/confirm",
            body,
        ),
    );
}

/** GET /api/v1/banking/smart-organizer/rules */
export function fetchOrganizerRules(): Promise<ApiOrganizerRuleListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiOrganizerRuleListResponse>>(
            "/api/v1/banking/smart-organizer/rules",
        ),
    );
}

/** POST /api/v1/banking/smart-organizer/rules */
export function createOrganizerRule(
    body: ApiOrganizerRuleSaveRequest,
): Promise<ApiOrganizerRuleRow> {
    return unwrap(
        api.post<ApiResponse<ApiOrganizerRuleRow>>(
            "/api/v1/banking/smart-organizer/rules",
            body,
        ),
    );
}

/** PUT /api/v1/banking/smart-organizer/rules/{rmrk_seq_no} */
export function updateOrganizerRule(
    rmrkSeqNo: number,
    body: ApiOrganizerRuleSaveRequest,
): Promise<ApiOrganizerRuleRow> {
    return unwrap(
        api.put<ApiResponse<ApiOrganizerRuleRow>>(
            `/api/v1/banking/smart-organizer/rules/${rmrkSeqNo}`,
            body,
        ),
    );
}

/** DELETE /api/v1/banking/smart-organizer/rules/{rmrk_seq_no} */
export function deleteOrganizerRule(rmrkSeqNo: number): Promise<void> {
    return unwrap(
        api.delete<ApiResponse<void>>(
            `/api/v1/banking/smart-organizer/rules/${rmrkSeqNo}`,
        ),
    ).then(() => undefined);
}

/** POST /api/v1/banking/smart-organizer/rules/reorder */
export function reorderOrganizerRules(
    body: ApiOrganizerRuleReorderRequest,
): Promise<void> {
    return unwrap(
        api.post<ApiResponse<void>>(
            "/api/v1/banking/smart-organizer/rules/reorder",
            body,
        ),
    ).then(() => undefined);
}
