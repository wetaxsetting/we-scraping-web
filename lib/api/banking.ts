import { api } from "@/lib/axios";
import { unwrap, ApiCallError } from "./common/unwrap";
import type {
    ApiAccountListResponse,
    ApiAccountLookupListResponse,
    ApiCashFlowReport,
    ApiCreateMatchRequest,
    ApiDailyCashReport,
    ApiDailyFinancialCmcReport,
    ApiDailyFinancialHsReport,
    ApiDailyFinancialTransactionsReport,
    ApiExchangeRateBankItem,
    ApiExchangeRateListResponse,
    ApiMatchCandidateListResponse,
    ApiMatchResultResponse,
    ApiOwnAccountListResponse,
    ApiOwnAccountSourceListResponse,
    ApiOwnAccountTargetListResponse,
    ApiOwnAccountTransferScrapingResultRequest,
    ApiOwnAccountTransferScrapingResultResponse,
    ApiBalanceRefreshRequest,
    ApiBalanceRefreshResponse,
    ApiEngineConnectionCheckRequest,
    ApiNapasBankInfoRow,
    ApiResponse,
    ApiTransactionConfirmRequest,
    ApiTransactionDetailResponse,
    ApiTransactionContactRequest,
    ApiTransactionPurposeRequest,
    ApiTransactionReportingAccountRequest,
    ApiTransactionVasAccountRequest,
    ApiTransactionListResponse,
    ApiTransactionSummaryResponse,
    ApiTransactionsSyncRequest,
    ApiTransactionsSyncResponse,
    ApiTransferHistoryResponse,
    ApiSyncHistoryListResponse,
} from "@/lib/types/api";
import type {
    ExchangeRateBankOption,
    ExchangeRateListResult,
} from "@/components/payment/overseas-payment/types";
import { toExchangeRateListResult } from "@/lib/api/mappers";
import { nxisasDebug } from "@/lib/nxisas/nxisas-debug";

// Re-export so existing `import { ApiCallError } from "@/lib/api/banking"`
// consumers stay valid after the H-2 extraction to `./common/unwrap`.
export { ApiCallError } from "./common/unwrap";

/**
 * Banking domain API client. Mirrors the controllers in
 * wecms-api/.../domain/banking/controller/*.java. Every fetcher
 * returns the raw UPPER_SNAKE response so callers can either pass it
 * through their own mapper or use the default mappers below.
 *
 * Errors raise `ApiCallError` carrying `status.code` so the caller
 * can decide whether to surface a dialog (auth-token expiry pattern)
 * or fall back to static demo data (Sprint 1 read-only graceful
 * degradation).
 *
 * `unwrap` + `ApiCallError` were extracted to `./common/unwrap` (H-2).
 * `ApiCallError` is re-exported here so existing
 * `import { ApiCallError } from "@/lib/api/banking"` consumers are
 * unaffected.
 */

/**
 * Optional shape for the common-sort contract every list endpoint speaks.
 * `sortField` is the View Setting `FIELD_ID` (e.g. `BANK`, `BALANCE`);
 * `sortDirection` is the wire `ASC` / `DESC`. Pages get the same shape
 * straight from `useTableSort().sortParams` — spread it into the call.
 * Omitting both keys lets the backend fall back to the legacy default
 * ORDER BY.
 */
export type ListSortParams = {
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
};

/**
 * Server-side filter + pagination params for `GET /api/v1/banking/accounts`.
 * Mirrors the JEX {@code fnsh_0001_001_r001} input set the refactor
 * supports (currency, bank, keyword, page-based pagination). Omit a
 * key to skip that filter. Pages live in `useApiData` callsites — the
 * fetcher itself is stateless.
 *
 * - `currency` accepts `VND`, `FCY`, `ALL`, or any concrete CCY code.
 * - `bankCd` is the legacy {@code BANK_CD} string the bank popover stores
 *   as the option key (NOT the display name).
 * - `keyword` is matched server-side (case-insensitive) against
 *   `ACCT_NO` / `ACCT_NICK_NM` / `ACCT_NM`.
 * - `page` is zero-based per Spring Data; `size` defaults to 15 (clamped to 100).
 */
export type FetchAccountsParams = {
    currency?: string;
    bankCd?: string;
    keyword?: string;
    sort?: ListSortParams | null;
    /** AI-01 — as-of date (`yyyyMMdd`) for legacy historical-balance display
     *  (`ACCT_MSTR_R004`). Omit / today / future → current balances. */
    asOfDate?: string;
    page?: number;
    size?: number;
};

export function fetchAccounts(
    params?: FetchAccountsParams | string,
    legacySort?: ListSortParams | null,
): Promise<ApiAccountListResponse> {
    // Backwards-compat overload: older callers passed `(currency, sort)`
    // positionally. Normalise to the object form so we have one code path.
    const normalised: FetchAccountsParams =
        typeof params === "string" || params === undefined
            ? { currency: params as string | undefined, sort: legacySort ?? null }
            : params;

    const wire: Record<string, string> = {};
    if (normalised.currency) wire.currency = normalised.currency;
    if (normalised.bankCd && normalised.bankCd.trim()) wire.bankCd = normalised.bankCd.trim();
    if (normalised.keyword && normalised.keyword.trim()) wire.keyword = normalised.keyword.trim();
    if (normalised.sort?.sortField && normalised.sort.sortDirection) {
        wire.sortField = normalised.sort.sortField;
        wire.sortDirection = normalised.sort.sortDirection;
    }
    if (normalised.asOfDate && normalised.asOfDate.trim()) {
        wire.asOfDate = normalised.asOfDate.trim();
    }
    if (typeof normalised.page === "number" && normalised.page >= 0) {
        wire.page = String(normalised.page);
    }
    if (typeof normalised.size === "number" && normalised.size > 0) {
        wire.size = String(normalised.size);
    }

    return unwrap(
        api.get<ApiResponse<ApiAccountListResponse>>("/api/v1/banking/accounts", {
            params: Object.keys(wire).length > 0 ? wire : undefined,
        }),
    );
}

/**
 * Withdrawal-account autocomplete for the firm-banking-settings
 * Create dialog. Mirrors `AccountController#lookupAccountsByBank` —
 * pass the public NAPAS code (e.g. `"970424"` Shinhan), get back
 * every `ACCT_MSTR` row for the current tenant under the resolved
 * internal `BANK_CD`.
 *
 * Loads once per bank-change; the frontend filters client-side as
 * the user types (legacy `comm_0220_002.ts` parity — no debounce,
 * no server-side keyword filter).
 *
 * Errors propagate as {@link ApiCallError}: `WBE_VALIDATION` when
 * the wire param fails the controller's `@Pattern`. Unknown NAPAS
 * codes resolve to an empty list (not an error) — mirrors JEX.
 */
export function fetchAccountsByBank(
    outBankCd: string,
): Promise<ApiAccountLookupListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiAccountLookupListResponse>>(
            "/api/v1/banking/accounts/by-bank",
            { params: { out_bank_cd: outBankCd } },
        ),
    );
}

/**
 * Server-side filter set for the Transaction History list endpoint. Mirrors
 * `AccountController#listTransactions` query params 1:1. Omit a key to skip the
 * filter; `cnfmYn` / `type` accept `"ALL"` (or any unknown value) as a no-op.
 *
 * - `from` / `to` — `yyyyMMdd` date range, matched against `TRSC_DT`.
 * - `type` — `"DEPOSIT"` / `"WITHDRAW"` / `"ALL"`.
 * - `cnfmYn` — `"Y"` / `"N"` / `"ALL"`.
 * - `keyword` — case-insensitive partial match on `RMRK` / `RMRK2` / `BANK_REF_NO`.
 */
export type FetchTransactionsParams = {
    from?: string;
    to?: string;
    type?: string;
    cnfmYn?: string;
    keyword?: string;
};

function transactionsQueryParams(params?: FetchTransactionsParams): Record<string, string> | undefined {
    if (!params) return undefined;
    const wire: Record<string, string> = {};
    if (params.from)    wire.from    = params.from;
    if (params.to)      wire.to      = params.to;
    if (params.type)    wire.type    = params.type;
    if (params.cnfmYn)  wire.cnfm_yn = params.cnfmYn;
    if (params.keyword && params.keyword.trim()) wire.keyword = params.keyword.trim();
    return Object.keys(wire).length > 0 ? wire : undefined;
}

export function fetchTransactions(
    acctSeqNo: string,
    params?: FetchTransactionsParams,
): Promise<ApiTransactionListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiTransactionListResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions`,
            { params: transactionsQueryParams(params) },
        ),
    );
}

/**
 * Aggregate summary for the current filter scope — total / confirmed /
 * unconfirmed counts + deposit / withdrawal totals. Drives the status-tab
 * counters and footer totals so they survive across the active status filter
 * (the list endpoint returns rows *after* the status filter; the summary keeps
 * the full pre-tab counts).
 *
 * Mirrors `GET /api/v1/banking/accounts/{acctSeqNo}/transactions/summary`.
 */
export function fetchTransactionsSummary(
    acctSeqNo: string,
    params?: FetchTransactionsParams,
): Promise<ApiTransactionSummaryResponse> {
    return unwrap(
        api.get<ApiResponse<ApiTransactionSummaryResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/summary`,
            { params: transactionsQueryParams(params) },
        ),
    );
}

/**
 * Bank Transaction Sync &gt; History popup. Lists past scrape attempts
 * for the current user + tenant filtered by date / currency / bank /
 * result. Mirrors legacy `fnsh_0001_003_r001`.
 *
 * `from_dt` / `to_dt` are required and must be `yyyyMMdd`. `currency`
 * accepts `"VND"`, `"FCY"`, a concrete code (`"USD"`, …), or `"ALL"` /
 * `undefined` (no currency predicate). `bank_cd` and `result` are
 * optional.
 */
export type FetchSyncHistoryParams = {
    fromDt: string;
    toDt: string;
    currency?: string;
    bankCd?: string;
    result?: "success" | "failed" | "all";
};

export function fetchSyncHistory(
    params: FetchSyncHistoryParams,
): Promise<ApiSyncHistoryListResponse> {
    const query: Record<string, string> = {
        from_dt: params.fromDt,
        to_dt:   params.toDt,
    };
    if (params.currency && params.currency.toUpperCase() !== "ALL") {
        query.currency = params.currency;
    }
    if (params.bankCd) query.bank_cd = params.bankCd;
    if (params.result && params.result !== "all") query.result = params.result;
    return unwrap(
        api.get<ApiResponse<ApiSyncHistoryListResponse>>(
            "/api/v1/banking/sync-history",
            { params: query },
        ),
    );
}

/**
 * Single-transaction detail — base list-row fields plus the matching panel
 * (purpose / VAS / contact) and confirmer metadata. `trnsSeqNo` is the
 * `ACCT_SEQ_NO` surrogate carried by every list row (see
 * `TransactionRow.trnsSeqNo`).
 *
 * Mirrors `GET /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}`.
 */
export function fetchTransactionDetail(
    acctSeqNo: string,
    trnsSeqNo: string,
): Promise<ApiTransactionDetailResponse> {
    return unwrap(
        api.get<ApiResponse<ApiTransactionDetailResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/${encodeURIComponent(trnsSeqNo)}`,
        ),
    );
}

/**
 * Confirm a transaction — writes `ACCT_TRNS_RCV_PAY_INFM` with `CNFM_YN='Y'`
 * plus optional classification fields (counterparty key/name, usage code, VAS
 * account). The backend returns the refreshed detail payload so the caller can
 * re-render the row in place without a follow-up GET.
 *
 * Mirrors `PUT /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/confirm`.
 *
 * Errors:
 * - `WBE_TRANSACTION_ALREADY_CONFIRMED` — race between two confirms.
 * - `WBE_TRANSACTION_NOT_FOUND` — surrogate doesn't belong to this account.
 */
export function confirmTransaction(
    acctSeqNo: string,
    trnsSeqNo: string,
    body?: ApiTransactionConfirmRequest,
): Promise<ApiTransactionDetailResponse> {
    return unwrap(
        api.put<ApiResponse<ApiTransactionDetailResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/${encodeURIComponent(trnsSeqNo)}/confirm`,
            body ?? {},
        ),
    );
}

/**
 * Update the Reporting Account (`CHART_ACCT_CD` + `CHART_ACCT_SEQ_NO`)
 * for one bank transaction. Mirrors legacy `fnsh_0200_001` cell's
 * write path (drop-down on the Reporting Account column commits the
 * pick into the bank-transaction row directly).
 *
 * Backend validates the picked chart-of-accounts row before commit;
 * mismatched / inactive / non-existent entries surface as
 * `WBE_TRANSACTION_CHART_ACCOUNT_NOT_FOUND` or
 * `WBE_TRANSACTION_CHART_ACCOUNT_CODE_MISMATCH`.
 *
 * Mirrors `PATCH /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/reporting-account`.
 */
export function updateTransactionReportingAccount(
    acctSeqNo: string,
    trnsSeqNo: string,
    body: ApiTransactionReportingAccountRequest,
): Promise<ApiTransactionDetailResponse> {
    return unwrap(
        api.patch<ApiResponse<ApiTransactionDetailResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/${encodeURIComponent(trnsSeqNo)}/reporting-account`,
            body,
        ),
    );
}

/**
 * Clear the Reporting Account on one bank transaction — backs the ×
 * remove button on the cell. Idempotent on the backend (clearing an
 * already-empty row is a no-op).
 *
 * Mirrors `DELETE /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/reporting-account`.
 */
export function clearTransactionReportingAccount(
    acctSeqNo: string,
    trnsSeqNo: string,
): Promise<ApiTransactionDetailResponse> {
    return unwrap(
        api.delete<ApiResponse<ApiTransactionDetailResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/${encodeURIComponent(trnsSeqNo)}/reporting-account`,
        ),
    );
}

/**
 * Assign / change the Purpose on one bank transaction — backs the
 * Purpose picker in the Transaction History table.
 *
 * Mirrors `PATCH /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/purpose`.
 */
export function updateTransactionPurpose(
    acctSeqNo: string,
    trnsSeqNo: string,
    body: ApiTransactionPurposeRequest,
): Promise<ApiTransactionDetailResponse> {
    return unwrap(
        api.patch<ApiResponse<ApiTransactionDetailResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/${encodeURIComponent(trnsSeqNo)}/purpose`,
            body,
        ),
    );
}

/**
 * Clear the Purpose on one bank transaction — backs the × remove
 * button on the Purpose cell. Idempotent (no-op when already empty).
 *
 * Mirrors `DELETE /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/purpose`.
 */
export function clearTransactionPurpose(
    acctSeqNo: string,
    trnsSeqNo: string,
): Promise<ApiTransactionDetailResponse> {
    return unwrap(
        api.delete<ApiResponse<ApiTransactionDetailResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/${encodeURIComponent(trnsSeqNo)}/purpose`,
        ),
    );
}

/**
 * Assign / change the VAS Account on one bank transaction — backs
 * the VAS Account picker in the Transaction History table.
 *
 * Mirrors `PATCH /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/vas-account`.
 */
export function updateTransactionVasAccount(
    acctSeqNo: string,
    trnsSeqNo: string,
    body: ApiTransactionVasAccountRequest,
): Promise<ApiTransactionDetailResponse> {
    return unwrap(
        api.patch<ApiResponse<ApiTransactionDetailResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/${encodeURIComponent(trnsSeqNo)}/vas-account`,
            body,
        ),
    );
}

/**
 * Clear the VAS Account on one bank transaction. Idempotent.
 *
 * Mirrors `DELETE /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/vas-account`.
 */
export function clearTransactionVasAccount(
    acctSeqNo: string,
    trnsSeqNo: string,
): Promise<ApiTransactionDetailResponse> {
    return unwrap(
        api.delete<ApiResponse<ApiTransactionDetailResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/${encodeURIComponent(trnsSeqNo)}/vas-account`,
        ),
    );
}

/**
 * Assign / change the Contact on one bank transaction — backs the
 * Contact Name picker in the Transaction History table.
 *
 * Mirrors `PATCH /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/contact`.
 */
export function updateTransactionContact(
    acctSeqNo: string,
    trnsSeqNo: string,
    body: ApiTransactionContactRequest,
): Promise<ApiTransactionDetailResponse> {
    return unwrap(
        api.patch<ApiResponse<ApiTransactionDetailResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/${encodeURIComponent(trnsSeqNo)}/contact`,
            body,
        ),
    );
}

/**
 * Clear the Contact on one bank transaction. Idempotent.
 *
 * Mirrors `DELETE /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/contact`.
 */
export function clearTransactionContact(
    acctSeqNo: string,
    trnsSeqNo: string,
): Promise<ApiTransactionDetailResponse> {
    return unwrap(
        api.delete<ApiResponse<ApiTransactionDetailResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/${encodeURIComponent(trnsSeqNo)}/contact`,
        ),
    );
}

/**
 * Undo a transaction confirmation — flips `CNFM_YN` back to `'N'` on the
 * existing `ACCT_TRNS_RCV_PAY_INFM` row. No response body.
 *
 * Mirrors `DELETE /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/confirm`.
 *
 * Errors:
 * - `WBE_TRANSACTION_NOT_CONFIRMED` — row isn't currently confirmed.
 */
export async function undoConfirmTransaction(
    acctSeqNo: string,
    trnsSeqNo: string,
): Promise<void> {
    const path =
        `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}` +
        `/transactions/${encodeURIComponent(trnsSeqNo)}/confirm`;
    try {
        const res = await api.delete<ApiResponse<void>>(path);
        const body = res.data;
        if (body.status.error) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        return;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/**
 * Smart Organizer — list payment candidates the user may match the
 * bank transaction to. Domestic scheduled payments only in the first
 * refactor slice (overseas deferred). Mirrors legacy
 * {@code comm_0196_002_r001}.
 */
export type FetchMatchCandidatesParams = {
    from?: string;     // yyyyMMdd
    to?: string;       // yyyyMMdd
    keyword?: string;
};

export function fetchMatchCandidates(
    acctSeqNo: string,
    trnsSeqNo: string,
    params?: FetchMatchCandidatesParams,
): Promise<ApiMatchCandidateListResponse> {
    const wire: Record<string, string> = {};
    if (params?.from)    wire.from    = params.from;
    if (params?.to)      wire.to      = params.to;
    if (params?.keyword && params.keyword.trim()) {
        wire.keyword = params.keyword.trim();
    }
    return unwrap(
        api.get<ApiResponse<ApiMatchCandidateListResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}` +
            `/transactions/${encodeURIComponent(trnsSeqNo)}/match-candidates`,
            { params: Object.keys(wire).length > 0 ? wire : undefined },
        ),
    );
}

/**
 * Smart Organizer — match the bank transaction to a payment line.
 * Atomically writes BUSI_MATCH_LOG + flips LINK_MATCH_YN='Y' on both
 * sides. Mirrors legacy {@code comm_0196_001_c001}.
 *
 * Errors:
 *   - `WBE_MATCH_ALREADY_MATCHED` — bank transaction is already matched.
 *   - `WBE_MATCH_PAY_ALREADY_MATCHED` — selected payment is already
 *     matched to a different bank transaction.
 *   - `WBE_MATCH_PAY_NOT_FOUND` — invalid `pay_trns_id`.
 */
export function createMatch(
    acctSeqNo: string,
    trnsSeqNo: string,
    body: ApiCreateMatchRequest,
): Promise<ApiMatchResultResponse> {
    return unwrap(
        api.post<ApiResponse<ApiMatchResultResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}` +
            `/transactions/${encodeURIComponent(trnsSeqNo)}/match`,
            body,
        ),
    );
}

/**
 * Smart Organizer — undo a match. Flips LINK_MATCH_YN='N' on both
 * sides and LOCKED_YN='N' on the audit row (preserves history).
 * Mirrors legacy {@code comm_0196_002_u001}.
 *
 * Errors:
 *   - `WBE_MATCH_NOT_MATCHED` — bank transaction is not currently matched.
 */
export function undoMatch(
    acctSeqNo: string,
    trnsSeqNo: string,
): Promise<ApiMatchResultResponse> {
    return unwrap(
        api.delete<ApiResponse<ApiMatchResultResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}` +
            `/transactions/${encodeURIComponent(trnsSeqNo)}/match`,
        ),
    );
}

/**
 * Bank Transaction Sync — Account Inquiry "Update" popup. Real Coocon
 * NXISAS scrape: per-account LOGIN → (challenge?) → TRANSACTION → BALANCE
 * → dedup-INSERT into `ACCT_TRNS_HSTR` + refresh `ACCT_MSTR.BAL/REAL_AMT`.
 *
 * Returns a discriminated `status`:
 *   - `COMPLETED` — every selected account synced.
 *   - `OTP_REQUIRED` / `QNA_REQUIRED` / `CAPTCHA_REQUIRED` — caller must
 *     open the matching dialog and POST the answer back via the matching
 *     resume function below, echoing the `session_id`.
 *   - `ERROR` — terminal bank-side / gateway-side rejection.
 *
 * After a `COMPLETED` response, callers should refetch `/accounts` so the
 * on-screen "Last Update" column reflects the new timestamp.
 */
export async function syncTransactions(
    body: ApiTransactionsSyncRequest,
): Promise<ApiTransactionsSyncResponse> {
    // Legacy `nxisas_api.js` parity: log the per-flow request/response the
    // way the EXE engine logged each thread. Masked + gated behind
    // NEXT_PUBLIC_NXISAS_DEBUG (see lib/nxisas/nxisas-debug.ts).
    nxisasDebug("execute thread(sync) input", {
        flowType: "SYNC",
        accounts: body.accounts?.length ?? 0,
        body,
    });
    const res = await unwrap(
        api.post<ApiResponse<ApiTransactionsSyncResponse>>(
            "/api/v1/banking/accounts/transactions-sync",
            body,
        ),
    );
    nxisasDebug("execute thread(sync) output", {
        traceId: res.session_id,
        status: res.status,
        errorCode: res.error_code,
    });
    return res;
}

/** Resume a sync after a security-question (QNA) answer. */
export async function submitSyncQna(
    sessionId: string,
    body: { question: string; hidden_value: string; answer: string },
): Promise<ApiTransactionsSyncResponse> {
    nxisasDebug("continuation input", { flowType: "SYNC", challengeType: "QNA", traceId: sessionId, body });
    const res = await unwrap(
        api.post<ApiResponse<ApiTransactionsSyncResponse>>(
            `/api/v1/banking/accounts/transactions-sync/${encodeURIComponent(sessionId)}/qna`,
            body,
        ),
    );
    nxisasDebug("continuation output", { traceId: res.session_id, status: res.status, errorCode: res.error_code });
    return res;
}

/** Resume a sync after an OTP submission. */
export async function submitSyncOtp(
    sessionId: string,
    value: string,
): Promise<ApiTransactionsSyncResponse> {
    nxisasDebug("continuation input", { flowType: "SYNC", challengeType: "OTP", traceId: sessionId, value });
    const res = await unwrap(
        api.post<ApiResponse<ApiTransactionsSyncResponse>>(
            `/api/v1/banking/accounts/transactions-sync/${encodeURIComponent(sessionId)}/otp`,
            { value },
        ),
    );
    nxisasDebug("continuation output", { traceId: res.session_id, status: res.status, errorCode: res.error_code });
    return res;
}

/** Resume a sync after a CAPTCHA submission. */
export async function submitSyncCaptcha(
    sessionId: string,
    value: string,
): Promise<ApiTransactionsSyncResponse> {
    nxisasDebug("continuation input", { flowType: "SYNC", challengeType: "CAPTCHA", traceId: sessionId, value });
    const res = await unwrap(
        api.post<ApiResponse<ApiTransactionsSyncResponse>>(
            `/api/v1/banking/accounts/transactions-sync/${encodeURIComponent(sessionId)}/captcha`,
            { value },
        ),
    );
    nxisasDebug("continuation output", { traceId: res.session_id, status: res.status, errorCode: res.error_code });
    return res;
}

export function fetchOwnAccounts(): Promise<ApiOwnAccountListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiOwnAccountListResponse>>(
            "/api/v1/banking/transfers/own-accounts",
        ),
    );
}

/**
 * Server-side filter + paging params for the Transfer History list
 * endpoint. Mirrors `TransferHistoryController#list` query params 1:1
 * — `from_dt` / `to_dt` are required `YYYYMMDD`; everything else is
 * optional. `trns_stts` is the radio sentinel ("" = all, "00000000" =
 * success only, "99999999" = failed only — the controller's `@Pattern`).
 * Sort uses the project-wide common-sort contract (`sort_field` ∈
 * {`TRNS_DT`, `OUT_BANK_NM`, `IN_BANK_NM`, `TRSC_AMT`, `RMRK`},
 * `sort_direction` ∈ {ASC, DESC}). `page_no` is 1-based; `page_per_cnt`
 * is on the whitelist {10, 15, 20, 50, 100}, default 15.
 */
export type FetchTransferHistoryParams = {
    fromDt: string;
    toDt: string;
    trnsStts?: "" | "00000000" | "99999999";
    pageNo?: number;
    pagePerCnt?: 10 | 15 | 20 | 50 | 100;
    sort?: ListSortParams | null;
};

export function fetchTransferHistory(
    params: FetchTransferHistoryParams,
): Promise<ApiTransferHistoryResponse> {
    const wire: Record<string, string> = {
        from_dt: params.fromDt,
        to_dt:   params.toDt,
    };
    if (params.trnsStts !== undefined && params.trnsStts !== "") {
        wire.trns_stts = params.trnsStts;
    }
    if (typeof params.pageNo === "number" && params.pageNo >= 1) {
        wire.page_no = String(params.pageNo);
    }
    if (typeof params.pagePerCnt === "number") {
        wire.page_per_cnt = String(params.pagePerCnt);
    }
    if (params.sort?.sortField && params.sort.sortDirection) {
        wire.sort_field     = params.sort.sortField;
        wire.sort_direction = params.sort.sortDirection;
    }
    return unwrap(
        api.get<ApiResponse<ApiTransferHistoryResponse>>(
            "/api/v1/banking/internal-transfer/transfer-history",
            { params: wire },
        ),
    );
}

export function fetchDailyCash(
    params?: { asOf?: string; currencyScope?: string },
): Promise<ApiDailyCashReport> {
    return unwrap(
        api.get<ApiResponse<ApiDailyCashReport>>(
            "/api/v1/banking/reports/daily-cash",
            { params },
        ),
    );
}

/**
 * Daily Cash report (refactor — `daily-cash-report` slug).
 *
 * Targets the new three-tier endpoint at
 * `/api/v1/banking/reports/daily-cash-report` which returns currency
 * summary + per-account detail + currency flow rollup. The legacy
 * `fetchDailyCash` above stays in place until every consumer migrates.
 */
export interface ApiDailyCashReportResponse {
    as_of_date: string;
    currency: string;
    currency_summary: Array<{
        currency_cd: string;
        total_cash: string | number;
        total_demand_deposit: string | number;
        total_term_deposit: string | number;
        total_loan: string | number;
        total_savings: string | number;
    }>;
    accounts: Array<{
        biz_key: string;
        last_collected_date: string | null;
        ref_date: string;
        currency_cd: string;
        acct_type_cd: string;
        bank_cd: string;
        bank_nm: string;
        acct_no: string;
        balance: string | number;
        loan_name: string | null;
        maturity_date: string | null;
        agreement_amount: string | number | null;
        send_count: string | number;
        send_amount: string | number;
        receive_count: string | number;
        receive_amount: string | number;
    }>;
    currency_flow: Array<{
        currency_cd: string;
        before_date_balance: string | number;
        balance: string | number;
        send_count: string | number;
        send_amount: string | number;
        receive_count: string | number;
        receive_amount: string | number;
    }>;
}

export function fetchDailyCashReport(
    params: { asOfDate: string; currency?: string },
): Promise<ApiDailyCashReportResponse> {
    return unwrap(
        api.get<ApiResponse<ApiDailyCashReportResponse>>(
            "/api/v1/banking/reports/daily-cash-report",
            { params },
        ),
    );
}

export function fetchDailyFinancial(
    params?: {
        asOf?: string;
        currencyScope?: string;
        activeAccountsOnly?: boolean;
        includeInternalTransfers?: boolean;
    },
): Promise<ApiDailyFinancialCmcReport> {
    const wire: Record<string, string> = {};
    if (params?.asOf) wire.asOf = params.asOf;
    if (params?.currencyScope) wire.currencyScope = params.currencyScope;
    if (params?.activeAccountsOnly !== undefined) wire.activeAccountsOnly = String(params.activeAccountsOnly);
    if (params?.includeInternalTransfers !== undefined) wire.includeInternalTransfers = String(params.includeInternalTransfers);
    return unwrap(
        api.get<ApiResponse<ApiDailyFinancialCmcReport>>(
            "/api/v1/banking/reports/daily-financial",
            { params: Object.keys(wire).length > 0 ? wire : undefined },
        ),
    );
}

/**
 * Per-account transaction history popup for Daily Financial — mirrors
 * legacy `rept_0015_002_r001`. Backend filters by tenant + bank + account
 * + date, sorts chronologically (ASC) for the running-balance column,
 * and paginates server-side.
 */
export function fetchDailyFinancialTransactions(params: {
    asOf: string;
    bankCd: string;
    acctNo: string;
    includeInternalTransfers?: boolean;
    page?: number;
    size?: number;
}): Promise<ApiDailyFinancialTransactionsReport> {
    const wire: Record<string, string> = {
        asOf: params.asOf,
        bankCd: params.bankCd,
        acctNo: params.acctNo,
    };
    if (params.includeInternalTransfers !== undefined) {
        wire.includeInternalTransfers = String(params.includeInternalTransfers);
    }
    if (params.page !== undefined) wire.page = String(params.page);
    if (params.size !== undefined) wire.size = String(params.size);
    return unwrap(
        api.get<ApiResponse<ApiDailyFinancialTransactionsReport>>(
            "/api/v1/banking/reports/daily-financial/transactions",
            { params: wire },
        ),
    );
}

export function fetchDailyFinancialHs(
    params?: { asOf?: string; accountFilter?: string },
): Promise<ApiDailyFinancialHsReport> {
    return unwrap(
        api.get<ApiResponse<ApiDailyFinancialHsReport>>(
            "/api/v1/banking/reports/daily-financial-hs",
            { params },
        ),
    );
}

/**
 * Cash Flow Report — `GET /api/v1/banking/reports/cash-flow-report`.
 * Mirrors legacy `cash_0001_001_r001`. Currency rates are required when
 * the base currency differs from USD / KRW (backend validates →
 * `WBE_CASH_FLOW_RATE_REQUIRED`). Bank filters serialize as a JSON
 * string in the `bankFilters` query param.
 *
 * NOTE: there is intentionally no `quarter` param. The report is always
 * computed for the full Jan–Dec year (legacy `cash_0001_001` parity); the
 * quarter selector only hides month columns on the client. Sending a
 * quarter would change the backend's Opening / End balances, which legacy
 * never does — PO decision 2026-06-04, gap D-1 / G5. See
 * docs/features/cash-flow/parity-audit/gap-report.md.
 */
export type CashFlowQueryParams = {
    year: number;
    baseCurrency: "VND" | "USD" | "KRW";
    usdRate?: string | number | null;
    krwRate?: string | number | null;
    bankFilters?: Array<{ bankCd: string; accountNo: string }>;
};

export function fetchCashFlow(params: CashFlowQueryParams): Promise<ApiCashFlowReport> {
    const wire: Record<string, string> = {
        year: String(params.year),
        baseCurrency: params.baseCurrency,
    };
    if (params.usdRate != null && params.usdRate !== "") wire.usdRate = String(params.usdRate);
    if (params.krwRate != null && params.krwRate !== "") wire.krwRate = String(params.krwRate);
    if (params.bankFilters && params.bankFilters.length > 0) {
        wire.bankFilters = JSON.stringify(params.bankFilters);
    }
    return unwrap(
        api.get<ApiResponse<ApiCashFlowReport>>(
            "/api/v1/banking/reports/cash-flow-report",
            { params: wire },
        ),
    );
}

/**
 * Exchange Rate Inquiry — reads the Coocon / Shinhan rate matrix for the
 * authenticated tenant.
 *
 * Mirrors {@code GET /api/v1/banking/exchange-rates} (ExchangeRateController).
 * Data is populated by batch {@code EXCH_0001_001}.
 *
 * @param refDate  Reference date YYYYMMDD; omit → today (server resolves)
 * @param bankCd   Bank code, e.g. "11704088" (Shinhan); omit → Shinhan default
 */
export function fetchExchangeRates(params?: {
    refDate?: string;
    bankCd?: string;
    seqNo?: string;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
}): Promise<ExchangeRateListResult> {
    const wire: Record<string, string> = {};
    if (params?.refDate)        wire.ref_date       = params.refDate;
    if (params?.bankCd)         wire.bank_cd        = params.bankCd;
    if (params?.seqNo)          wire.seq_no         = params.seqNo;
    if (params?.sortField)      wire.sort_field     = params.sortField;
    if (params?.sortDirection)  wire.sort_direction = params.sortDirection;
    return unwrap(
        api.get<ApiResponse<ApiExchangeRateListResponse>>(
            "/api/v1/banking/exchange-rates",
            { params: Object.keys(wire).length > 0 ? wire : undefined },
        ),
    ).then(toExchangeRateListResult);
}

/**
 * Returns the distinct bank codes that have exchange rate data for the
 * authenticated tenant — used to populate the bank selector dropdown.
 *
 * Mirrors {@code GET /api/v1/banking/exchange-rates/banks}.
 */
export function fetchExchangeRateBanks(): Promise<ExchangeRateBankOption[]> {
    return unwrap(
        api.get<ApiResponse<ApiExchangeRateBankItem[]>>(
            "/api/v1/banking/exchange-rates/banks",
        ),
    ).then((items) =>
        items.map((b) => ({ bankCd: b.bank_cd, bankNm: b.bank_nm })),
    );
}

/**
 * Returns the distinct currency codes that have exchange rate data for the
 * authenticated tenant — used to populate the full currency row list.
 *
 * Mirrors {@code GET /api/v1/banking/exchange-rates/currencies}.
 */
export function fetchExchangeRateCurrencies(): Promise<string[]> {
    return unwrap(
        api.get<ApiResponse<string[]>>(
            "/api/v1/banking/exchange-rates/currencies",
        ),
    );
}

/* =================================================================
 *  Banking > Own Account Transfer (refactor slug: own-account-transfer).
 *
 *  Mirrors backend `OwnAccountTransferController` — four endpoints
 *  under /api/v1/banking/own-account-transfer/*. The intake POST is
 *  the only mutation; the three GETs are read-only pickers / history.
 * ================================================================= */

/** GET /source-accounts — list the user's eligible source accounts
 *  for an Own Account Transfer. Optional `bank_cd` filter; unsupported
 *  values are silently coerced to "all" server-side (legacy parity).
 *  Optional `sort` carries the common-sort contract (see {@link ListSortParams}).
 *  Pages pass `useTableSort().sortParams` straight through. */
export function fetchOwnAccountSources(
    bankCd?: string | null,
    sort?: ListSortParams | null,
): Promise<ApiOwnAccountSourceListResponse> {
    const wire: Record<string, string> = {};
    if (bankCd && bankCd.trim()) wire.bank_cd = bankCd.trim();
    if (sort?.sortField && sort.sortDirection) {
        wire.sortField     = sort.sortField;
        wire.sortDirection = sort.sortDirection;
    }
    return unwrap(
        api.get<ApiResponse<ApiOwnAccountSourceListResponse>>(
            "/api/v1/banking/own-account-transfer/source-accounts",
            { params: wire },
        ),
    );
}

/** POST /balance-refresh — persist the post-scrape balance outcome
 *  the local NXiSAS engine reported back. Spring patches `ACCT_MSTR`
 *  and writes a `BALANCE_REFRESH` audit row. Returns the canonical
 *  refreshed row.
 *
 *  <p>Path A scope (2026-05-20): this is the only mutation surface
 *  shipped today. The transfer-execution intake (/scraping-result),
 *  target-accounts picker, and transfer-history list are deferred to
 *  the composer/execution MR — they call no client wrapper from here
 *  because the backend doesn't expose them yet. */
export function postBalanceRefresh(
    req: ApiBalanceRefreshRequest,
): Promise<ApiBalanceRefreshResponse> {
    return unwrap(
        api.post<ApiResponse<ApiBalanceRefreshResponse>>(
            "/api/v1/banking/own-account-transfer/balance-refresh",
            req,
        ),
    );
}

/** POST /nxisas/decrypt — B1 SEED-CBC decrypt of the engine result.
 *  Sends the raw engine result array + the session `Uid`/`Action`
 *  (the SEED key/IV, read from `window.CooconiSASNX`) and returns the
 *  decrypted array so the caller parses `Output.Result.balance[]` /
 *  `Output.Result.transfer[]` exactly like legacy.
 *
 *  <p>Mirrors legacy `_v2nxisas.nxisas_decrypt` but as a normal async
 *  call (the bundle's own sync seam can't reach the server — browsers
 *  ban sync XHR). With the backend flag `wecms.oat.seed-decrypt.enabled`
 *  OFF (default) the endpoint echoes the input unchanged, so this is
 *  behaviour-neutral until the flag is flipped per bank.
 *
 *  <p>Best-effort: on ANY failure (no engine session, network, parse) the
 *  ORIGINAL result is returned so a decrypt hiccup never breaks the
 *  balance/transfer flow. */
export async function decryptNxisasResult(rawEngineResult: unknown): Promise<unknown> {
    try {
        const cap = typeof window !== "undefined" ? window.CooconiSASNX : undefined;
        const uid    = typeof cap?.OpenUid    === "string" ? cap.OpenUid    : "";
        const action = typeof cap?.OpenAction === "string" ? cap.OpenAction : "";
        const res = await unwrap(
            api.post<ApiResponse<{ NXISAS_DATA: string }>>(
                "/api/v1/banking/own-account-transfer/nxisas/decrypt",
                {
                    NXISAS_DATA:   JSON.stringify(rawEngineResult),
                    NXISAS_UID:    uid,
                    NXISAS_ACTION: action,
                },
            ),
        );
        return res?.NXISAS_DATA ? JSON.parse(res.NXISAS_DATA) : rawEngineResult;
    } catch {
        // Decrypt is best-effort — a failure must not break the scrape flow.
        return rawEngineResult;
    }
}

/** POST /engine-connection-check — fire-and-forget audit sink the page
 *  mount posts after the NXiSAS bundle's `openNxisas(...)` probe
 *  resolves. The backend writes one audit row and returns
 *  `204 No Content`. The caller MUST swallow errors — a failed audit
 *  POST is non-fatal to the user (see frontend plan §5.3). */
export function postEngineConnectionCheck(
    req: ApiEngineConnectionCheckRequest,
): Promise<void> {
    // No envelope to unwrap — backend returns 204.
    return api.post("/api/v1/banking/own-account-transfer/engine-connection-check", req)
        .then(() => undefined);
}

/** GET /napas-bank-info/{napas_bank_cd} — dictionary lookup. Returns
 *  the internal `bank_cd` for a given NAPAS code; the legacy display
 *  fields (`short_name`/`long_name_*`) ride as null until the composer
 *  MR widens the entity projection. */
export function fetchNapasBankInfo(
    napasBankCd: string,
): Promise<ApiNapasBankInfoRow> {
    return unwrap(
        api.get<ApiResponse<ApiNapasBankInfoRow>>(
            `/api/v1/banking/own-account-transfer/napas-bank-info/${encodeURIComponent(napasBankCd)}`,
        ),
    );
}

/** GET /target-accounts — target-account picker for the composer.
 *  Per OQ-A scope this is the tenant's own VND accounts (excluding
 *  the source row when both keys are supplied); each row may carry
 *  a `napas_bank_cd` for cross-bank routing. */
export function fetchOwnAccountTargets(params?: {
    sourceBankCd?: string | null;
    sourceAcctNo?: string | null;
}): Promise<ApiOwnAccountTargetListResponse> {
    const query: Record<string, string> = {};
    if (params?.sourceBankCd) query.source_bank_cd = params.sourceBankCd;
    if (params?.sourceAcctNo) query.source_acct_no = params.sourceAcctNo;
    return unwrap(
        api.get<ApiResponse<ApiOwnAccountTargetListResponse>>(
            "/api/v1/banking/own-account-transfer/target-accounts",
            { params: query },
        ),
    );
}

/** POST /scraping-result — intake the post-scrape NXiSAS engine
 *  result. The browser bundle runs the bank scrape and POSTs the
 *  structured outcome here. Spring re-validates ownership, amount
 *  tolerance (exact match for VND), bank tx id format, and
 *  idempotency. A duplicate POST with the same `idempotency_key`
 *  returns the previously recorded row with `already_recorded=true`
 *  — clients should treat that as success. */
export function postOwnAccountTransferScrapingResult(
    req: ApiOwnAccountTransferScrapingResultRequest,
): Promise<ApiOwnAccountTransferScrapingResultResponse> {
    return unwrap(
        api.post<ApiResponse<ApiOwnAccountTransferScrapingResultResponse>>(
            "/api/v1/banking/own-account-transfer/scraping-result",
            req,
        ),
    );
}
