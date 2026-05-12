import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import type {
    ApiErpTransactionHistoryListResponse,
    ApiResponse,
} from "@/lib/types/api";

/**
 * Settings &gt; ERP Transaction History API client. Mirrors the Phase 2
 * controller `ErpTrnsHistoryController#list`
 * (`wecms-api-main/.../domain/setting/erptransactionhistory/controller/`)
 * + the per-row file download endpoint.
 *
 * <p>Errors propagate as {@link ApiCallError} carrying the backend
 * {@code status.code} so the caller can decide whether to surface a
 * dialog (auth-token expiry pattern) or fall back to mock data
 * (offline-dev graceful degradation).
 *
 * <p>Wire convention: lowercase snake_case for every param (CTO directive
 * 2026-05-08). {@code from_date} + {@code to_date} are required; the
 * panel defaults them to last-30-days when the user hasn't changed the
 * range.
 */
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
        const e = err as {
            response?: { data?: ApiResponse<unknown> };
            message?: string;
        };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/**
 * Wire shape for the ERP transaction history list call. Mirrors the
 * Phase 2 controller params verbatim — see
 * `wecms-api-main/.../ErpTrnsHistoryController.java`.
 *
 * <ul>
 *   <li>{@code fromDate} / {@code toDate} — required {@code YYYYMMDD}
 *       (axios serializes the JS field as `from_date` / `to_date` via
 *       the {@code params} marshaller below).</li>
 *   <li>{@code erpType} — optional {@code W} / {@code E} / {@code D}.
 *       Backend rejects anything else with {@code WBE_VALIDATION}.</li>
 *   <li>{@code trnsTypeCd} — optional 2-digit numeric in
 *       {@code "01".."17"}.</li>
 *   <li>{@code keyword} — case-insensitive partial match on
 *       {@code reg_id}. Backend escapes `%` / `_` / `!` server-side.</li>
 *   <li>{@code page} — zero-based page index. Defaults backend-side to
 *       0; passing 0 is harmless.</li>
 *   <li>{@code size} — rows per page (server clamps to 100; default 15).</li>
 *   <li>{@code sortField} / {@code sortDirection} — common-sort contract.
 *       Whitelisted FIELD_IDs ({@code REG_DTM}, {@code ERP_TYPE},
 *       {@code TRNS_TYPE_CD}, {@code REG_USER}); unknown values fall
 *       back silently to default ORDER BY ({@code REG_DTM DESC,
 *       SEQ_NO DESC}).</li>
 * </ul>
 */
export type FetchErpTransactionHistoryParams = {
    /** Required — `YYYYMMDD` format. */
    fromDate: string;
    /** Required — `YYYYMMDD` format. */
    toDate: string;
    erpType?: "W" | "E" | "D";
    trnsTypeCd?: string;
    keyword?: string;
    page?: number;
    size?: number;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
};

/**
 * Fetch the paginated ERP transaction history list + 4 tab counts.
 * Translates camelCase params to the snake_case wire form the Phase 2
 * controller expects. Empty / undefined values are stripped so the URL
 * stays deterministic.
 */
export function fetchErpTransactionHistory(
    params: FetchErpTransactionHistoryParams,
): Promise<ApiErpTransactionHistoryListResponse> {
    const wire: Record<string, string | number> = {
        from_date: params.fromDate,
        to_date: params.toDate,
    };
    if (params.erpType) wire.erp_type = params.erpType;
    if (params.trnsTypeCd) wire.trns_type_cd = params.trnsTypeCd;
    if (params.keyword !== undefined && params.keyword !== "")
        wire.keyword = params.keyword;
    if (params.page !== undefined) wire.page = params.page;
    if (params.size !== undefined) wire.size = params.size;
    if (params.sortField) wire.sort_field = params.sortField;
    if (params.sortDirection) wire.sort_direction = params.sortDirection;

    return unwrap(
        api.get<ApiResponse<ApiErpTransactionHistoryListResponse>>(
            "/api/v1/settings/erp-transaction-history",
            { params: wire },
        ),
    );
}

/**
 * Build the canonical download URL for a row's `seqNo`. The frontend
 * passes this to {@code lib/file.ts downloadFile(url, filename)} which
 * fires an authenticated XHR + blob save (the JWT lives in
 * {@code localStorage}, so a plain `<a href download>` would not carry
 * the Bearer header — OQ-FE-1 resolved 2026-05-11).
 *
 * <p>Backend serves the file via
 * {@code GET /api/v1/settings/erp-transaction-history/{seqNo}/download}
 * with RFC 5987 `Content-Disposition: attachment; filename*=UTF-8''…`.
 * Failure modes surface as JSON envelopes with codes:
 *
 * <ul>
 *   <li>{@code WBE2014} — row not found (or not in tenant; backend
 *       merges the two cases so we never leak cross-tenant
 *       existence).</li>
 *   <li>{@code WBE2015} — file_size = 0 OR physical file unreadable on
 *       the configured storage root.</li>
 *   <li>{@code WBE_VALIDATION} — non-positive `seqNo`.</li>
 * </ul>
 */
export function getErpTransactionHistoryDownloadUrl(seqNo: number): string {
    return `/api/v1/settings/erp-transaction-history/${seqNo}/download`;
}
