import { api } from "@/lib/axios";
import { ApiCallError } from "@/lib/api/banking";
import type {
    ApiFirmBankingHistoryListResponse,
    ApiResponse,
} from "@/lib/types/api";

/**
 * Settings &gt; Firm Banking History API client. Mirrors the Phase 2
 * controller `FirmBankingHistoryController#list`
 * (`wecms-api/.../domain/setting/firmbankinghistory/controller/`).
 *
 * <p>Errors propagate as {@link ApiCallError} carrying the backend
 * `status.code` so the caller can decide whether to surface a dialog
 * (auth-token expiry pattern) or fall back to mock data
 * (Sprint-1 read-only graceful degradation).
 *
 * <p>Wire convention: lowercase snake_case for every param (CTO directive
 * 2026-05-08). `from_date` + `to_date` are <b>required</b>; the panel
 * defaults them to last-30-days when the user hasn't changed the range.
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
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/**
 * Wire shape for the Firm Banking History list call. Mirrors the Phase 2
 * controller params verbatim — see
 * `wecms-api/.../FirmBankingHistoryController.java`.
 *
 * <ul>
 *   <li>{@code fromDate} / {@code toDate} — required {@code YYYYMMDD}
 *       (axios serializes the JS field as `from_date` / `to_date` via
 *       the {@code params} marshaller below).</li>
 *   <li>{@code svcType} — optional {@code F} / {@code S} / {@code G} /
 *       {@code B}. Backend rejects anything else with `WBE_VALIDATION`.</li>
 *   <li>{@code keyword} — case-insensitive partial match on
 *       {@code seq_no}. Backend escapes `%` / `_` / `!` server-side.</li>
 *   <li>{@code page} — zero-based page index. Defaults backend-side to
 *       0; passing 0 is harmless.</li>
 *   <li>{@code size} — rows per page (server clamps to 100; default 15).</li>
 *   <li>{@code sortField} / {@code sortDirection} — common-sort contract.
 *       Whitelisted FIELD_IDs ({@code TARN_DTM}, {@code SVC_TYPE},
 *       {@code SVC_NM}, {@code SEQ_NO}, {@code DEP_BANK_CD},
 *       {@code RSLT_CD}); unknown values fall back silently to default
 *       ORDER BY ({@code TARN_DTM DESC, SEQ_NO DESC}).</li>
 * </ul>
 */
export type FetchFirmBankingHistoryParams = {
    /** Required — `YYYYMMDD` format. */
    fromDate: string;
    /** Required — `YYYYMMDD` format. */
    toDate: string;
    svcType?: "F" | "S" | "G" | "B";
    keyword?: string;
    page?: number;
    size?: number;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
};

/**
 * Fetch the paginated firm-banking history list. Translates camelCase
 * params to the snake_case wire form the Phase 2 controller expects.
 * Empty / undefined values are stripped so the URL stays deterministic.
 */
export function fetchFirmBankingHistory(
    params: FetchFirmBankingHistoryParams,
): Promise<ApiFirmBankingHistoryListResponse> {
    const wire: Record<string, string | number> = {
        from_date: params.fromDate,
        to_date: params.toDate,
    };
    if (params.svcType) wire.svc_type = params.svcType;
    if (params.keyword !== undefined && params.keyword !== "") wire.keyword = params.keyword;
    if (params.page !== undefined) wire.page = params.page;
    if (params.size !== undefined) wire.size = params.size;
    if (params.sortField) wire.sort_field = params.sortField;
    if (params.sortDirection) wire.sort_direction = params.sortDirection;

    return unwrap(
        api.get<ApiResponse<ApiFirmBankingHistoryListResponse>>(
            "/api/v1/settings/firm-banking-history",
            { params: wire },
        ),
    );
}
