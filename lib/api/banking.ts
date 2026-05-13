import { api } from "@/lib/axios";
import type {
    ApiAccountListResponse,
    ApiAccountLookupListResponse,
    ApiCashFlowReport,
    ApiDailyCashReport,
    ApiDailyFinancialCmcReport,
    ApiDailyFinancialHsReport,
    ApiExchangeRateBankItem,
    ApiExchangeRateListResponse,
    ApiOwnAccountListResponse,
    ApiResponse,
    ApiTransactionListResponse,
    ApiTransferHistoryResponse,
} from "@/lib/types/api";
import type {
    ExchangeRateBankOption,
    ExchangeRateListResult,
} from "@/components/payment/overseas-payment/types";
import { toExchangeRateListResult } from "@/lib/api/mappers";

/**
 * Banking domain API client. Mirrors the controllers in
 * wecms-api-main/.../domain/banking/controller/*.java. Every fetcher
 * returns the raw UPPER_SNAKE response so callers can either pass it
 * through their own mapper or use the default mappers below.
 *
 * Errors raise `ApiCallError` carrying `status.code` so the caller
 * can decide whether to surface a dialog (auth-token expiry pattern)
 * or fall back to static demo data (Sprint 1 read-only graceful
 * degradation).
 */
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

export function fetchTransactions(
    acctSeqNo: string,
    params?: { from?: string; to?: string; type?: string },
): Promise<ApiTransactionListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiTransactionListResponse>>(
            `/api/v1/banking/accounts/${encodeURIComponent(acctSeqNo)}/transactions`,
            { params },
        ),
    );
}

export function fetchOwnAccounts(): Promise<ApiOwnAccountListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiOwnAccountListResponse>>(
            "/api/v1/banking/transfers/own-accounts",
        ),
    );
}

export function fetchTransferHistory(
    params?: { from?: string; to?: string; status?: string },
): Promise<ApiTransferHistoryResponse> {
    return unwrap(
        api.get<ApiResponse<ApiTransferHistoryResponse>>(
            "/api/v1/banking/transfers/history",
            { params },
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

export function fetchDailyFinancial(
    params?: { asOf?: string; currencyScope?: string },
): Promise<ApiDailyFinancialCmcReport> {
    return unwrap(
        api.get<ApiResponse<ApiDailyFinancialCmcReport>>(
            "/api/v1/banking/reports/daily-financial",
            { params },
        ),
    );
}

export function fetchDailyFinancialHs(
    params?: { asOf?: string; bankCd?: string },
): Promise<ApiDailyFinancialHsReport> {
    return unwrap(
        api.get<ApiResponse<ApiDailyFinancialHsReport>>(
            "/api/v1/banking/reports/daily-financial-hs",
            { params },
        ),
    );
}

export function fetchCashFlow(
    params?: { from?: string; to?: string },
): Promise<ApiCashFlowReport> {
    return unwrap(
        api.get<ApiResponse<ApiCashFlowReport>>(
            "/api/v1/banking/reports/cash-flow",
            { params },
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
}): Promise<ExchangeRateListResult> {
    const wire: Record<string, string> = {};
    if (params?.refDate) wire.ref_date = params.refDate;
    if (params?.bankCd)  wire.bank_cd  = params.bankCd;
    if (params?.seqNo)   wire.seq_no   = params.seqNo;
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
