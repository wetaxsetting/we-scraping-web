import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import type {
    ApiChartOfAccountCreateRequest,
    ApiChartOfAccountListResponse,
    ApiChartOfAccountRow,
    ApiChartOfAccountTreeResponse,
    ApiChartOfAccountUpdateRequest,
    ApiResponse,
} from "@/lib/types/api";

/**
 * Settings &gt; Chart of Accounts API client. Mirrors the Spring
 * controller `ChartOfAccountsController` — six endpoints over
 * `CHART_ACCT_INFM` (slug `chart-of-accounts`, legacy parity for the
 * `comm_0223_001_*` family).
 *
 * <p>Errors propagate as {@link ApiCallError} carrying the backend
 * `status.code` so the caller can branch on
 * `WBE_CHART_OF_ACCOUNTS_NOT_FOUND`,
 * `WBE_CHART_OF_ACCOUNTS_DUPLICATE_CODE`,
 * `WBE_CHART_OF_ACCOUNTS_PARENT_NOT_FOUND`,
 * `WBE_CHART_OF_ACCOUNTS_RESTRICTED_CODE`,
 * `WBE_CHART_OF_ACCOUNTS_CYCLE`,
 * `WBE_CHART_OF_ACCOUNTS_DEPTH_EXCEEDED`,
 * `WBE_CHART_OF_ACCOUNTS_SELF_PARENT`.
 *
 * <p>Wire convention: lowercase snake_case (CTO directive
 * 2026-05-08). Path segment `{chart_acct_seq_no}` is the per-tenant
 * surrogate allocated server-side via the V95 `wb_get_next_val`
 * branch on Create.
 */
const BASE = "/api/v1/settings/chart-of-accounts";

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    try {
        const res = await promise;
        const body = res.data;
        if (body.status.error || body.data === undefined) {
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

/** Query parameters for the list endpoint. All optional. */
export type FetchChartOfAccountsParams = {
    /** Case-insensitive substring match against `chart_acct_cd`
     *  OR `chart_acct_nm_en`. */
    search?:    string;
    /** Wire token: `CHART_ACCT_CD` / `CHART_ACCT_NM_EN` / `STTS` / `MOD_DTM`. */
    sortField?: string;
    /** `ASC` / `DESC`. Omit for default. */
    sortDir?:   "ASC" | "DESC";
};

/**
 * List active chart-of-accounts rows for the current tenant. No
 * pagination — backend returns the full tenant slice (planning doc
 * §"Service contracts" — load-all matches legacy).
 */
export function fetchChartOfAccounts(
    params: FetchChartOfAccountsParams = {},
): Promise<ApiChartOfAccountListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiChartOfAccountListResponse>>(BASE, {
            params: {
                search:     params.search || undefined,
                sort_field: params.sortField,
                sort_dir:   params.sortDir,
            },
        }),
    );
}

/**
 * Tree projection for the inline parent-account picker. Active rows
 * whose hierarchy level resolves to 1..4; orphans / deeper rows are
 * filtered out (legacy R002 outer filter mirror).
 */
export function fetchChartOfAccountsTree(): Promise<ApiChartOfAccountTreeResponse> {
    return unwrap(
        api.get<ApiResponse<ApiChartOfAccountTreeResponse>>(`${BASE}/tree`),
    );
}

/**
 * Single-row read. Used when the panel needs to refresh one row
 * after an edit elsewhere. Returns the same projected shape as one
 * element of the list response.
 */
export function fetchChartOfAccount(seqNo: string): Promise<ApiChartOfAccountRow> {
    return unwrap(
        api.get<ApiResponse<ApiChartOfAccountRow>>(`${BASE}/${encodeURIComponent(seqNo)}`),
    );
}

/**
 * Create a new chart-of-accounts row, or revive a soft-deleted row
 * with the same code (backend handles the revive transparently).
 * Backend allocates `chart_acct_seq_no` and returns the resulting
 * {@link ApiChartOfAccountRow}.
 */
export function createChartOfAccount(
    body: ApiChartOfAccountCreateRequest,
): Promise<ApiChartOfAccountRow> {
    return unwrap(api.post<ApiResponse<ApiChartOfAccountRow>>(BASE, body));
}

/**
 * Update an existing chart-of-accounts row. Identity travels via the
 * `{chart_acct_seq_no}` path segment. Backend blocks restricted-row
 * edits + renames TO a restricted code with
 * `WBE_CHART_OF_ACCOUNTS_RESTRICTED_CODE`.
 */
export function updateChartOfAccount(
    seqNo: string,
    body: ApiChartOfAccountUpdateRequest,
): Promise<ApiChartOfAccountRow> {
    return unwrap(
        api.put<ApiResponse<ApiChartOfAccountRow>>(
            `${BASE}/${encodeURIComponent(seqNo)}`,
            body,
        ),
    );
}

/**
 * Soft-delete a chart-of-accounts row for the current tenant.
 * Re-parents every active child to the deleting row's parent in the
 * same transaction (backend handles the cascade).
 *
 * <p>Cannot use {@link unwrap} — that helper treats a missing `data`
 * field as an error; void responses legitimately omit `data` (matches
 * the contacts / approval-line DELETE precedent).
 */
export async function deleteChartOfAccount(seqNo: string): Promise<void> {
    try {
        const res = await api.delete<ApiResponse<void>>(
            `${BASE}/${encodeURIComponent(seqNo)}`,
        );
        const env = res.data;
        if (env.status.error) {
            throw new ApiCallError(env.status.code, env.status.message);
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
