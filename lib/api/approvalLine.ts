import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import type {
    ApiApprovalLineCreateRequest,
    ApiApprovalLineListResponse,
    ApiApprovalLineRow,
    ApiApprovalLineUpdateRequest,
    ApiResponse,
} from "@/lib/types/api";

/**
 * Settings &gt; Approval Line API client. Mirrors the Spring
 * controller `ApprovalLineController` — five endpoints over
 * `APPR_LINE_INFM` + `APPR_LINE_INFM_DETL` (slug `approval-line`,
 * legacy parity for the `comm_0222_*` family).
 *
 * <p>Errors propagate as {@link ApiCallError} carrying the backend
 * `status.code` so the caller can branch on
 * `WBE_APPROVAL_LINE_NOT_FOUND`,
 * `WBE_APPROVAL_LINE_TOO_MANY_APPROVERS`,
 * `WBE_APPROVAL_LINE_DUP_APPROVER`,
 * `WBE_APPROVAL_LINE_APPROVER_NOT_IN_TENANT`, etc.
 *
 * <p>Wire convention: lowercase snake_case (CTO directive
 * 2026-05-08). Path segment `{apprLineNo}` is the per-tenant
 * surrogate allocated server-side via the V91 `wb_get_next_val`
 * branch on Create (OQ-7).
 */
const BASE = "/api/v1/settings/approval-line";

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

/** Query parameters for the list endpoint. Every field is optional. */
export type FetchApprovalLinesParams = {
    /** Case-insensitive substring match against `appr_line_nm`. */
    q?: string;
    /** Wire token: `REG_DTM` / `APPR_LINE_NM` / `MOD_DTM`. */
    sortField?: string;
    /** `ASC` / `DESC`. Omit for default. */
    sortDir?: "ASC" | "DESC";
};

/**
 * List approval lines for the current tenant. No pagination — the
 * backend returns the full tenant set (feature § 4.3 / OQ-3).
 */
export function fetchApprovalLines(
    params: FetchApprovalLinesParams = {},
): Promise<ApiApprovalLineListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiApprovalLineListResponse>>(BASE, {
            params: {
                q:          params.q || undefined,
                sort_field: params.sortField,
                sort_dir:   params.sortDir,
            },
        }),
    );
}

/**
 * Detail by surrogate. Backend returns the master + full approver
 * chain in the same shape as one list-row element — the Edit dialog
 * mounts this to refresh the approver chain (the list row only carries
 * the inline `approvers[]` snapshot from the list endpoint).
 */
export function fetchApprovalLine(apprLineNo: number): Promise<ApiApprovalLineRow> {
    return unwrap(
        api.get<ApiResponse<ApiApprovalLineRow>>(`${BASE}/${apprLineNo}`),
    );
}

/**
 * Create. Backend allocates `appr_line_no` via the V91
 * `wb_get_next_val('appr_line_infm','appr_line_no',biz_key)` branch
 * (OQ-7), assigns `apprvr_disp_ord` 1..N from request-array position,
 * and returns the resulting {@link ApiApprovalLineRow}.
 */
export function createApprovalLine(
    body: ApiApprovalLineCreateRequest,
): Promise<ApiApprovalLineRow> {
    return unwrap(api.post<ApiResponse<ApiApprovalLineRow>>(BASE, body));
}

/**
 * Update. Same body shape as Create; identity travels via the
 * `{apprLineNo}` path segment. Server-side diff-sync inserts new
 * approvers, updates existing ones with new display order /
 * snapshot fields, and deletes removed ones — all in one tx.
 */
export function updateApprovalLine(
    apprLineNo: number,
    body: ApiApprovalLineUpdateRequest,
): Promise<ApiApprovalLineRow> {
    return unwrap(
        api.put<ApiResponse<ApiApprovalLineRow>>(`${BASE}/${apprLineNo}`, body),
    );
}

/**
 * Hard delete. Removes the master row and every detail row in one
 * tx. No `WBE1190`-style in-use guard (feature § 6 — legacy parity:
 * execution-side approver snapshots don't hold live FKs to
 * `APPR_LINE_INFM`).
 *
 * <p>Cannot use {@link unwrap} — that helper treats a missing `data`
 * field as an error; void responses legitimately omit `data` (matches
 * the contacts / vas-account DELETE precedent).
 */
export async function deleteApprovalLine(apprLineNo: number): Promise<void> {
    try {
        const res = await api.delete<ApiResponse<void>>(`${BASE}/${apprLineNo}`);
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
