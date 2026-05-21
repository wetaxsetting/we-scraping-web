import { z } from "zod";
import type { AxiosError } from "axios";

import { api } from "@/lib/axios";
import type {
    ApiApprovalBoxActionResponse,
    ApiApprovalBoxBulkApproveResponse,
    ApiApprovalBoxListResponse,
    ApiResponse,
} from "@/lib/types/api";

/**
 * Payment > Approval Box API client. Wraps the four endpoints delivered
 * by `wecms-api/.../domain/payment/approvalbox`:
 *
 *   GET    /api/v1/payment/approval-box
 *   POST   /api/v1/payment/approval-box/{apprSeqNo}/approve
 *   POST   /api/v1/payment/approval-box/{apprSeqNo}/reject
 *   POST   /api/v1/payment/approval-box/bulk-approve
 *
 * Every call goes through the shared {@link api} Axios instance so the
 * JWT interceptor + 401 session-expired re-auth bus apply uniformly.
 *
 * Business errors arrive as `{ status: { error: true, code, message } }`
 * with HTTP 200; the helpers unwrap the envelope into a typed
 * {@link ApprovalBoxApiError} so callers can branch on `code` and surface
 * the `traceId` in the global error dialog.
 */

const BASE = "/api/v1/payment/approval-box";

/** Zod schema mirroring the backend request envelope. Validates the
 *  caller's payload before we hit the network so mistakes (empty array,
 *  whitespace ids) surface as form errors rather than a 200/WBE2054. */
export const approvalBoxBulkApproveSchema = z.object({
    appr_seq_nos: z
        .array(z.string().trim().min(1, "approval.error.empty_seq_no"))
        .min(1, "approval.error.empty_selection")
        .max(100, "approval.error.bulk_too_large"),
});

export type ApprovalBoxBulkApproveInput = z.infer<typeof approvalBoxBulkApproveSchema>;

export type ApprovalBoxListQuery = {
    fromDate: string;        // YYYYMMDD
    toDate: string;          // YYYYMMDD
    apprTypeCd?: "" | "00" | "01" | "02" | "03";
    srchWd?: string;
    sortField?: string;      // whitelisted FIELD_ID (REG_DTM / DOC_NM / …)
    sortDirection?: "ASC" | "DESC";
    page?: number;           // 0-based
    size?: number;
};

/** Thrown when the backend returns `{ status: { error: true } }`. Mirrors
 *  the `ApiCallError` shape used by every other feature client so the
 *  global error dialog can render `code` + `traceId` consistently. */
export class ApprovalBoxApiError extends Error {
    readonly code: string;
    readonly traceId?: string;
    constructor(code: string, message: string, traceId?: string) {
        super(message);
        this.code = code;
        this.traceId = traceId;
        this.name = "ApprovalBoxApiError";
    }
}

function unwrap<T>(res: { data: ApiResponse<T> }): T {
    const body = res.data;
    if (body.status.error || body.data === undefined) {
        throw new ApprovalBoxApiError(
            body.status.code,
            body.status.message,
            body.trace_id,
        );
    }
    return body.data;
}

function rethrowAxios(err: unknown): never {
    const axiosErr = err as AxiosError<ApiResponse<unknown>>;
    const body = axiosErr?.response?.data;
    if (body?.status) {
        throw new ApprovalBoxApiError(
            body.status.code,
            body.status.message,
            body.trace_id,
        );
    }
    throw err;
}

export async function fetchApprovalBoxList(
    q: ApprovalBoxListQuery,
): Promise<ApiApprovalBoxListResponse> {
    try {
        const res = await api.get<ApiResponse<ApiApprovalBoxListResponse>>(BASE, {
            params: {
                from_date: q.fromDate,
                to_date: q.toDate,
                appr_type_cd: q.apprTypeCd ?? "",
                srch_wd: q.srchWd ?? "",
                sort_field: q.sortField ?? "",
                sort_direction: q.sortDirection ?? "",
                page: q.page ?? 0,
                size: q.size ?? 15,
            },
        });
        return unwrap(res);
    } catch (err) {
        rethrowAxios(err);
    }
}

export async function approveApprovalBoxRow(
    apprSeqNo: string,
): Promise<ApiApprovalBoxActionResponse> {
    if (!apprSeqNo.trim()) {
        throw new ApprovalBoxApiError("WBE_VALIDATION", "appr_seq_no: is required");
    }
    try {
        const res = await api.post<ApiResponse<ApiApprovalBoxActionResponse>>(
            `${BASE}/${encodeURIComponent(apprSeqNo)}/approve`,
        );
        return unwrap(res);
    } catch (err) {
        rethrowAxios(err);
    }
}

export async function rejectApprovalBoxRow(
    apprSeqNo: string,
): Promise<ApiApprovalBoxActionResponse> {
    if (!apprSeqNo.trim()) {
        throw new ApprovalBoxApiError("WBE_VALIDATION", "appr_seq_no: is required");
    }
    try {
        const res = await api.post<ApiResponse<ApiApprovalBoxActionResponse>>(
            `${BASE}/${encodeURIComponent(apprSeqNo)}/reject`,
        );
        return unwrap(res);
    } catch (err) {
        rethrowAxios(err);
    }
}

export async function bulkApproveApprovalBoxRows(
    input: ApprovalBoxBulkApproveInput,
): Promise<ApiApprovalBoxBulkApproveResponse> {
    const parsed = approvalBoxBulkApproveSchema.parse(input);
    try {
        const res = await api.post<ApiResponse<ApiApprovalBoxBulkApproveResponse>>(
            `${BASE}/bulk-approve`,
            parsed,
        );
        return unwrap(res);
    } catch (err) {
        rethrowAxios(err);
    }
}
