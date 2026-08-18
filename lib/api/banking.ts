import { api } from "@/lib/axios";
import { downloadFile } from "@/lib/file";
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
    ApiSyncStatusResponse,
    ApiTransferHistoryResponse,
    ApiSyncHistoryListResponse,
    ApiMemoRow,
    ApiMemoListResponse,
    ApiCreateMemoRequest,
    ApiUpdateMemoRequest,
    ApiUpdateMemoColorRequest,
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

/* ── Transaction memo (side-panel) — legacy `comm_0105_001` on MEMO_INFM,
 *    4-key thread (BANK_CD/ACCT_NO/TRSC_DT/ACCT_SEQ_NO) derived server-side.
 *    `scope` selects the memo WEB_SVC_ID (VND vs FCY). Shared shape with
 *    Card Transactions memos, minus the client-supplied `ref_no`. ── */

/** VND vs FCY — picks the memo `WEB_SVC_ID` server-side. */
export type TransactionMemoScope = "VND" | "FCY";

/**
 * Void-tolerant envelope check for endpoints that return
 * {@code ApiResponse<Void>} (`data: null`). The shared {@link unwrap}
 * treats `!body.data` as an error, so a `WBI0000` success with a null
 * body would wrongly throw — the same documented pitfall the Card
 * Transactions memo client avoids with its own local unwrap. Mirrors
 * the inline pattern already used by {@link undoConfirmTransaction}:
 * success = `status.error === false`, regardless of `data`.
 */
async function unwrapVoid(
    promise: Promise<{ data: ApiResponse<unknown> }>,
): Promise<void> {
    try {
        const res = await promise;
        if (res.data.status.error) {
            throw new ApiCallError(res.data.status.code, res.data.status.message);
        }
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/** Base memo path for one transaction under the account route. */
function txnMemoBase(acctSeqNo: string, trnsSeqNo: string): string {
    return `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}`
        + `/transactions/${encodeURIComponent(trnsSeqNo)}/memos`;
}

/** List one transaction's memos (newest first). */
export function fetchTransactionMemos(
    acctSeqNo: string,
    trnsSeqNo: string,
    scope: TransactionMemoScope,
): Promise<ApiMemoListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiMemoListResponse>>(
            txnMemoBase(acctSeqNo, trnsSeqNo),
            { params: { scope } },
        ),
    );
}

/** Add one memo to a transaction (`ref_no` derived server-side). */
export function createTransactionMemo(
    acctSeqNo: string,
    trnsSeqNo: string,
    scope: TransactionMemoScope,
    body: Omit<ApiCreateMemoRequest, "ref_no">,
): Promise<ApiMemoRow> {
    return unwrap(
        api.post<ApiResponse<ApiMemoRow>>(
            txnMemoBase(acctSeqNo, trnsSeqNo),
            body,
            { params: { scope } },
        ),
    );
}

/** Edit one memo's text — author-only (`WBE_MEMO_NOT_AUTHOR`). */
export function updateTransactionMemo(
    acctSeqNo: string,
    trnsSeqNo: string,
    scope: TransactionMemoScope,
    seqNo: string,
    body: ApiUpdateMemoRequest,
): Promise<ApiMemoRow> {
    return unwrap(
        api.patch<ApiResponse<ApiMemoRow>>(
            `${txnMemoBase(acctSeqNo, trnsSeqNo)}/${encodeURIComponent(seqNo)}`,
            body,
            { params: { scope } },
        ),
    );
}

/** Set the row-level sticker color for a transaction's whole memo thread. */
export async function updateTransactionMemoColor(
    acctSeqNo: string,
    trnsSeqNo: string,
    scope: TransactionMemoScope,
    body: Omit<ApiUpdateMemoColorRequest, "ref_no">,
): Promise<void> {
    // Void response (`data: null`) — use the void-tolerant check so a
    // WBI0000 success doesn't throw. Color changes stay silent (no dialog),
    // matching Card Transactions.
    await unwrapVoid(
        api.patch<ApiResponse<void>>(
            `${txnMemoBase(acctSeqNo, trnsSeqNo)}/color`,
            body,
            { params: { scope } },
        ),
    );
}

/** Delete one memo — author-only (`WBE_MEMO_NOT_AUTHOR`). */
export async function deleteTransactionMemo(
    acctSeqNo: string,
    trnsSeqNo: string,
    scope: TransactionMemoScope,
    seqNo: string,
): Promise<void> {
    // Void response — void-tolerant check (see updateTransactionMemoColor).
    await unwrapVoid(
        api.delete<ApiResponse<void>>(
            `${txnMemoBase(acctSeqNo, trnsSeqNo)}/${encodeURIComponent(seqNo)}`,
            { params: { scope } },
        ),
    );
}

/**
 * Excel Download — Account Inquiry (VND), the PO-requested template-populated
 * `.xls` report (legacy `fnsh_0001_001` localized download). Streams an
 * authenticated blob from `GET /api/v1/banking/accounts/report` and saves it
 * with the server-supplied localized filename (`Account Inquiry (VND).xls` /
 * `계좌조회 (VND).xls` / `Tra cứu tài khoản (VND).xls`).
 *
 * This is the dedicated report endpoint — NOT the generic `POST /accounts/export`.
 *
 * @param lang UI locale (`en` / `ko` / `vi`); the backend maps KM/other → EN.
 */
export function downloadAccountInquiryReport(lang: string): Promise<void> {
    return downloadFile(
        `/api/v1/banking/accounts/report?lang=${encodeURIComponent(lang)}`,
        "Account Inquiry (VND).xls",
    );
}

/**
 * Excel Download — Account Inquiry (FCY), the PO-requested template-populated
 * `.xls` report (legacy `fnsh_0005_001` localized download). Streams an
 * authenticated blob from the dedicated `GET /api/v1/banking/accounts/report-fcy`
 * endpoint and saves it with the server-supplied localized filename
 * (`Account Inquiry (FCY).xls` / `계좌조회 (FCY).xls` / `Tra cứu tài khoản (FCY).xls`).
 *
 * Dedicated FCY report endpoint — NOT the generic `POST /accounts/export` and
 * NOT the VND `/accounts/report`.
 *
 * @param lang     UI locale (`en` / `ko` / `vi`); the backend maps KM/other → EN.
 * @param currency on-screen currency scope — `FCY` (all foreign currencies) or a
 *                 concrete CCY (`USD`/`KRW`/…) when the page is narrowed via the
 *                 in-page currency dropdown. Omitted → all FCY accounts.
 */
export function downloadAccountInquiryFcyReport(
    lang: string,
    currency?: string,
): Promise<void> {
    const search = new URLSearchParams();
    search.set("lang", lang);
    if (currency && currency.trim()) search.set("currency", currency.trim());
    return downloadFile(
        `/api/v1/banking/accounts/report-fcy?${search.toString()}`,
        "Account Inquiry (FCY).xls",
    );
}

/**
 * Excel Download — Transaction History (VND), the PO-requested template-populated
 * `.xls` report (legacy `fnsh_0002_001` localized download). Streams an
 * authenticated blob from
 * `GET /api/v1/banking/accounts/{acctSeqNo}/transactions/report` and saves it
 * with the server-supplied localized filename (`Transaction History (VND).xls` /
 * `거래내역조회 (VND).xls` / `Tra cứu giao dịch (VND).xls`).
 *
 * Honours the same filter set as the on-screen list. Dedicated report endpoint —
 * NOT the generic `POST /accounts/transactions/export`.
 *
 * @param lang UI locale (`en` / `ko` / `vi`); the backend maps KM/other → EN.
 */
export function downloadTransactionHistoryReport(
    acctSeqNo: string,
    params: FetchTransactionsParams | undefined,
    lang: string,
): Promise<void> {
    const wire = transactionsQueryParams(params) ?? {};
    const search = new URLSearchParams(wire);
    search.set("lang", lang);
    return downloadFile(
        `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/report?${search.toString()}`,
        "Transaction History (VND).xls",
    );
}

/**
 * Excel Download — Transaction History (FCY), the PO-requested template-populated
 * `.xls` report (legacy `fnsh_0006_001` localized download). Streams an
 * authenticated blob from the dedicated
 * `GET /api/v1/banking/accounts/{acctSeqNo}/transactions/report-fcy` endpoint and
 * saves it with the server-supplied localized filename
 * (`Transaction History (FCY).xls` / `거래내역조회 (FCY).xls` /
 * `Tra cứu giao dịch (FCY).xls`).
 *
 * Honours the same filter set as the on-screen list. Dedicated FCY report
 * endpoint — NOT the generic `POST /accounts/transactions/export` and NOT the
 * VND `/accounts/{id}/transactions/report`.
 *
 * @param lang UI locale (`en` / `ko` / `vi`); the backend maps KM/other → EN.
 */
export function downloadTransactionHistoryFcyReport(
    acctSeqNo: string,
    params: FetchTransactionsParams | undefined,
    lang: string,
): Promise<void> {
    const wire = transactionsQueryParams(params) ?? {};
    const search = new URLSearchParams(wire);
    search.set("lang", lang);
    return downloadFile(
        `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions/report-fcy?${search.toString()}`,
        "Transaction History (FCY).xls",
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
 * Smart Organizer — list payment candidates the user may match the bank
 * transaction to. Returns domestic non-payroll detail lines, payroll batch
 * rows, and overseas detail lines that pass the exact amount / date /
 * transfer-time / transferred / dispatch-success / unmatched / unlocked filter
 * set. Mirrors legacy {@code comm_0196_001_r001} / {@code OVRS_PYMN_SUMR_DETL_R006}.
 */
export type FetchMatchCandidatesParams = {
    from?: string;     // yyyyMMdd
    to?: string;       // yyyyMMdd
    keyword?: string;
    /** Legacy MATCH_RMRK_YN — `"N"` disables the effective-remark containment
     *  filter; omit (or any other value) to keep it on. */
    matchRmrkYn?: string;
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
    if (params?.matchRmrkYn) wire.match_rmrk_yn = params.matchRmrkYn;
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
 * Bank Transaction Sync — Account Inquiry "Update" popup (Phase 2, async).
 * The start POST validates + registers a tenant-scoped session, schedules the
 * scrape on a bounded server executor, and returns a RUNNING status snapshot
 * <b>immediately</b>. The caller then polls {@link fetchSyncStatus} (~750ms)
 * for real per-account progress + the terminal / challenge outcome.
 *
 * `status`: `RUNNING` / `COMPLETED` / `FAILED` / `CANCELLED` /
 * `OTP_REQUIRED` / `QNA_REQUIRED` / `CAPTCHA_REQUIRED`. After `COMPLETED`,
 * refetch `/accounts` so the "Last Update" column reflects the new timestamp.
 */
export async function syncTransactions(
    body: ApiTransactionsSyncRequest,
): Promise<ApiSyncStatusResponse> {
    // Legacy `nxisas_api.js` parity: log the per-flow request/response the
    // way the EXE engine logged each thread. Masked + gated behind
    // NEXT_PUBLIC_NXISAS_DEBUG (see lib/nxisas/nxisas-debug.ts).
    nxisasDebug("execute thread(sync) input", {
        flowType: "SYNC",
        accounts: body.accounts?.length ?? 0,
        body,
    });
    const res = await unwrap(
        api.post<ApiResponse<ApiSyncStatusResponse>>(
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

/**
 * Poll the async sync status (Phase 2). Read-only, safe for repeated polling;
 * returns a stable snapshot of progress + counters + challenge / terminal state.
 */
export async function fetchSyncStatus(
    sessionId: string,
): Promise<ApiSyncStatusResponse> {
    return unwrap(
        api.get<ApiResponse<ApiSyncStatusResponse>>(
            `/api/v1/banking/accounts/transactions-sync/${encodeURIComponent(sessionId)}/status`,
        ),
    );
}

/** Resume a sync after a security-question (QNA) answer — schedules a fresh
 *  background segment. Returns the RUNNING snapshot; keep polling `/status`. */
export async function submitSyncQna(
    sessionId: string,
    body: { question: string; hidden_value: string; answer: string },
): Promise<ApiSyncStatusResponse> {
    nxisasDebug("continuation input", { flowType: "SYNC", challengeType: "QNA", traceId: sessionId, body });
    const res = await unwrap(
        api.post<ApiResponse<ApiSyncStatusResponse>>(
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
): Promise<ApiSyncStatusResponse> {
    nxisasDebug("continuation input", { flowType: "SYNC", challengeType: "OTP", traceId: sessionId, value });
    const res = await unwrap(
        api.post<ApiResponse<ApiSyncStatusResponse>>(
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
): Promise<ApiSyncStatusResponse> {
    nxisasDebug("continuation input", { flowType: "SYNC", challengeType: "CAPTCHA", traceId: sessionId, value });
    const res = await unwrap(
        api.post<ApiResponse<ApiSyncStatusResponse>>(
            `/api/v1/banking/accounts/transactions-sync/${encodeURIComponent(sessionId)}/captcha`,
            { value },
        ),
    );
    nxisasDebug("continuation output", { traceId: res.session_id, status: res.status, errorCode: res.error_code });
    return res;
}

/**
 * Cancel a sync (universal in Phase 2 — the session id is known from the
 * immediate start response). The backend sets the cooperative cancel flag,
 * best-effort LOGOUTs the bank session, and marks CANCELLED (any later resume
 * is refused). Idempotent server-side — an unknown / finished id still
 * resolves to `CANCELLED`.
 */
export async function cancelSync(
    sessionId: string,
): Promise<ApiSyncStatusResponse> {
    nxisasDebug("cancel input", { flowType: "SYNC", traceId: sessionId });
    const res = await unwrap(
        api.post<ApiResponse<ApiSyncStatusResponse>>(
            `/api/v1/banking/accounts/transactions-sync/${encodeURIComponent(sessionId)}/cancel`,
        ),
    );
    nxisasDebug("cancel output", { traceId: res.session_id, status: res.status });
    return res;
}

/**
 * Cancel the CURRENT 2nd-cert challenge (QNA / OTP / CAPTCHA) — an
 * ACCOUNT-LEVEL operation, NOT a whole-session cancel. The backend records the
 * current login group's account(s) as `LOGIN_CAN` failures and continues the
 * batch with the next account; the returned snapshot is `RUNNING` (keep polling)
 * and the sync finishes normally with a "Success X / Failed Y" summary. Distinct
 * from {@link cancelSync}, which stops the whole session (main-popup Cancel/X).
 */
export async function cancelSyncChallenge(
    sessionId: string,
): Promise<ApiSyncStatusResponse> {
    nxisasDebug("challenge-cancel input", { flowType: "SYNC", traceId: sessionId });
    const res = await unwrap(
        api.post<ApiResponse<ApiSyncStatusResponse>>(
            `/api/v1/banking/accounts/transactions-sync/${encodeURIComponent(sessionId)}/challenge-cancel`,
        ),
    );
    nxisasDebug("challenge-cancel output", { traceId: res.session_id, status: res.status });
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

/**
 * Excel Download — Reports → Daily Cash, the PO-requested template-populated
 * `.xlsx` report. Streams an authenticated blob from the dedicated
 * `GET /api/v1/banking/reports/daily-cash-report/report` endpoint and saves it
 * with the server-supplied localized filename (`Daily Cash.xlsx` /
 * `일일시재.xlsx` / `Báo cáo dòng tiền hàng ngày.xlsx`).
 *
 * Dedicated report endpoint — NOT the generic `POST …/daily-cash-report/export`.
 * Reuses the same `asOfDate` + currency scope as the on-screen report so the
 * file and the screen agree.
 *
 * @param lang UI locale (`en` / `ko` / `vi`); the backend maps KM/other → EN.
 */
export function downloadDailyCashReport(params: {
    asOfDate: string;
    currency?: string;
    lang: string;
}): Promise<void> {
    const search = new URLSearchParams();
    search.set("asOfDate", params.asOfDate);
    if (params.currency && params.currency.trim()) search.set("currency", params.currency.trim());
    search.set("lang", params.lang);
    return downloadFile(
        `/api/v1/banking/reports/daily-cash-report/report?${search.toString()}`,
        "Daily Cash.xlsx",
    );
}

/**
 * Excel Download — Reports → Daily Financial (CMC), the PO-requested
 * template-populated `.xlsx` report. Streams an authenticated blob from the
 * dedicated `GET /api/v1/banking/reports/daily-financial/report` endpoint and
 * saves it with the server-supplied localized filename (`Daily Financial.xlsx` /
 * `자금일보.xlsx` / `Báo cáo tài chính hàng ngày.xlsx`).
 *
 * Honours the same filters as the on-screen report (`asOf` / currency scope /
 * `activeAccountsOnly` / `includeInternalTransfers`). Dedicated report endpoint.
 *
 * @param lang UI locale (`en` / `ko` / `vi`); the backend maps KM/other → EN.
 */
export function downloadDailyFinancialReport(params: {
    asOf?: string;
    currencyScope?: string;
    activeAccountsOnly?: boolean;
    includeInternalTransfers?: boolean;
    lang: string;
}): Promise<void> {
    const search = new URLSearchParams();
    if (params.asOf) search.set("asOf", params.asOf);
    if (params.currencyScope) search.set("currencyScope", params.currencyScope);
    if (params.activeAccountsOnly !== undefined) {
        search.set("activeAccountsOnly", String(params.activeAccountsOnly));
    }
    if (params.includeInternalTransfers !== undefined) {
        search.set("includeInternalTransfers", String(params.includeInternalTransfers));
    }
    search.set("lang", params.lang);
    return downloadFile(
        `/api/v1/banking/reports/daily-financial/report?${search.toString()}`,
        "Daily Financial.xlsx",
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
 * Per-field save of an HS ledger row's editable cell(s) — mirrors legacy
 * `rept_0017_001_u001` (auto-save on blur/Enter). The frontend PATCHes only the
 * changed column(s); the row is keyed by `acctSeqNo` (the tenant comes from the
 * JWT). Send `""` to clear a field. Unknown row →
 * `WBE_DAILY_FINANCIAL_HS_ENTRY_NOT_FOUND`.
 */
export async function updateDailyFinancialHsEntry(
    acctSeqNo: string,
    patch: {
        rept_cd?: string;
        pymn_cd?: string;
        desc_nm_en?: string;
        desc_nm_ko?: string;
        memo?: string;
    },
): Promise<void> {
    // Void-tolerant: a successful save returns `{ status: { error:false,
    // code:"WBI0000" }, data:null }`. The shared `unwrap` treats a missing
    // `data` as a failure (`!body.data`) and would raise ApiCallError("WBI0000",
    // "Success") on this empty-body PATCH — the documented void-response pitfall
    // in unwrap.ts. So check `status.error` only here.
    try {
        const res = await api.patch<ApiResponse<null>>(
            `/api/v1/banking/reports/daily-financial-hs/entries/${encodeURIComponent(acctSeqNo)}`,
            patch,
        );
        if (res.data.status.error) {
            throw new ApiCallError(res.data.status.code, res.data.status.message);
        }
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/**
 * Daily Financial (HS) Excel download — `GET .../daily-financial-hs/report`.
 * Mirrors legacy `rept_0017_001_r002_excel`: the backend re-runs the report
 * (saved DB data) and streams a 12-column bank-grouped `.xlsx`. Honours the
 * current As-of date + bank/account filter.
 *
 * @param lang UI locale (`en` / `ko` / `vi`); the backend maps KM/other → EN.
 */
export function downloadDailyFinancialHsReport(params: {
    asOf?: string;
    accountFilter?: string;
    lang: string;
}): Promise<void> {
    const search = new URLSearchParams();
    if (params.asOf) search.set("asOf", params.asOf);
    if (params.accountFilter) search.set("accountFilter", params.accountFilter);
    search.set("lang", params.lang);
    return downloadFile(
        `/api/v1/banking/reports/daily-financial-hs/report?${search.toString()}`,
        "Daily Financial (HS).xlsx",
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

/** POST /nxisas/decrypt — SEED-CBC decrypt of the engine result.
 *  Sends the raw engine result array + the session `Uid`/`Action`
 *  (the SEED key/IV, read from `window.CooconiSASNX`) and returns the
 *  decrypted array so the caller parses `Output.Result.balance[]` /
 *  `Output.Result.transfer[]` exactly like legacy.
 *
 *  Mirrors legacy `_v2nxisas.nxisas_decrypt` (`nxisas_v2.js:1672-1704`) but as
 *  a normal async call — the bundle's own sync seam cannot reach the server
 *  because browsers ban sync XHR, so the JEX adapter short-circuits the
 *  bundle's `nxisas_decrypt` action client-side and this function is the real
 *  decrypt leg. The engine encrypts `Output.Result` on EVERY response,
 *  including `ErrorCode "00000000"`, so this is on the happy path.
 *
 *  Wire keys are lowercase snake_case (`nxisas_data` / `nxisas_uid` /
 *  `nxisas_action`) per the project wire convention. Fixed 2026-08-18: this
 *  used to send and read the legacy UPPER_SNAKE names while the backend record
 *  exposed snake_case, so the request field bound `null`, the endpoint answered
 *  HTTP 200 with `{"nxisas_data": null}`, and the `catch`/fallback below
 *  silently handed the still-encrypted payload back to the caller — which is
 *  why Update Balance failed with "Balance is required." and a successful
 *  transfer recorded composed values instead of the bank's echoed ones.
 *
 *  Best-effort by design (legacy is tolerant too): on ANY failure — no engine
 *  session, network, parse — the ORIGINAL result is returned so a decrypt
 *  hiccup never breaks the balance/transfer flow. Unlike before, every
 *  fallback now logs, so the next failure is visible instead of silent. */
export async function decryptNxisasResult(rawEngineResult: unknown): Promise<unknown> {
    try {
        const cap = typeof window !== "undefined" ? window.CooconiSASNX : undefined;
        const uid    = typeof cap?.OpenUid    === "string" ? cap.OpenUid    : "";
        const action = typeof cap?.OpenAction === "string" ? cap.OpenAction : "";

        if (!uid || !action) {
            // No engine session → the cipher key/IV are unknown. Legacy hits the
            // same wall; it just fails silently. Say so instead.
            console.warn(
                "[nxisas] decrypt skipped — no engine session (OpenUid/OpenAction empty). " +
                "Output.Result stays encrypted; balance/transfer reads will find nothing.",
            );
            return rawEngineResult;
        }

        const res = await unwrap(
            api.post<ApiResponse<{ nxisas_data: string }>>(
                "/api/v1/banking/own-account-transfer/nxisas/decrypt",
                {
                    nxisas_data:   JSON.stringify(rawEngineResult),
                    nxisas_uid:    uid,
                    nxisas_action: action,
                },
            ),
        );

        if (!res?.nxisas_data) {
            console.warn(
                "[nxisas] decrypt returned no payload — Output.Result stays encrypted. " +
                "Check the /nxisas/decrypt wire contract (expects nxisas_data/nxisas_uid/nxisas_action).",
                res,
            );
            return rawEngineResult;
        }

        const decrypted = JSON.parse(res.nxisas_data);
        // Legacy parity: the bundle logs the resolved job output before the
        // success/fail dispatch (`nxisas_v2.js:2345`), and `trns_0001_007.ts:1642`
        // logs it again on the screen side. Keeping that breadcrumb is what makes
        // an engine-side change diagnosable from a browser console alone.
        console.log("[nxisas] decrypted engine output ::", decrypted);
        return decrypted;
    } catch (err) {
        // Decrypt is best-effort — a failure must not break the scrape flow.
        console.warn("[nxisas] decrypt failed; using the raw (encrypted) engine result.", err);
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
