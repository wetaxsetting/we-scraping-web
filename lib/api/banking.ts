import { api } from "@/lib/axios";
import type {
    ApiAccountListResponse,
    ApiCashFlowReport,
    ApiDailyCashReport,
    ApiDailyFinancialCmcReport,
    ApiDailyFinancialHsReport,
    ApiOwnAccountListResponse,
    ApiResponse,
    ApiTransactionListResponse,
    ApiTransferHistoryResponse,
} from "@/lib/types/api";

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
