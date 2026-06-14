import { z } from "zod";
import type { AxiosError } from "axios";

import { ApiCallError } from "@/lib/api/banking";
import { parseAttachmentFilename } from "@/lib/api/internalTransfer";
import { api } from "@/lib/axios";
import type {
    ApiApprovalAttachment,
    ApiApprovalBoxActionResponse,
    ApiApprovalBoxApprover,
    ApiApprovalBoxBulkApproveResponse,
    ApiApprovalBoxListResponse,
    ApiApprovalBoxRow,
    ApiApprovalTransactionRow,
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

/**
 * Download one Approval Details attachment, shared across every payment
 * type the Approval Box popup can open. Keyed by `APPR_SEQ_NO` so it works
 * for Internal Transfer / Vendor / Expense / Payroll / Overseas uniformly.
 *
 * `fileType` routes to the correct legacy table — `EXPT_RESOL_FILE`
 * (requester uploads) or `EXPT_RESOL_PAY_EVID_FILE` (payment evidence).
 * Omit it (or pass undefined) to default to `EXPT_RESOL_FILE`, preserving
 * backward compatibility for attachments without a recorded source.
 *
 * Backend: `GET /api/v1/payment/approval-box/{apprSeqNo}/attachments/{fileId}?fileType=`.
 * Streams the binary as a blob; throws {@link ApiCallError} (`WBE2069` for
 * a missing file / wrong tenant) on failure — same envelope handling as the
 * other binary downloaders.
 */
export async function downloadApprovalBoxAttachment(
    apprSeqNo: string,
    fileId: string,
    fileType?: string,
): Promise<void> {
    try {
        const res = await api.get(
            `${BASE}/${encodeURIComponent(apprSeqNo)}`
                + `/attachments/${encodeURIComponent(fileId)}`,
            {
                responseType: "blob",
                params: fileType ? { fileType } : undefined,
            },
        );
        const disposition = (res.headers["content-disposition"] as string) ?? "";
        const filename = parseAttachmentFilename(disposition)
            ?? `${apprSeqNo}-attachment-${fileId}`;
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
        // Blob-response error envelope handling — the JSON error body arrives
        // as a Blob because responseType is "blob"; parse it back out.
        if (err && typeof err === "object" && "response" in err) {
            const ax = err as { response?: { data?: Blob } };
            const data = ax.response?.data;
            if (data instanceof Blob) {
                const text = await data.text();
                try {
                    const body = JSON.parse(text) as { status?: { code?: string; message?: string } };
                    if (body.status) {
                        throw new ApiCallError(
                            body.status.code ?? "WBE9999",
                            body.status.message ?? "Download failed",
                        );
                    }
                } catch {
                    // fall through
                }
            }
        }
        if (err instanceof ApiCallError) throw err;
        const e = err as { message?: string };
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

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

/**
 * Fetch the REAL approver chain (`EXPT_RESOL_APPRVR_INFM`, ordered by line)
 * for one approval document. Used by the payment Scheduled detail pages to
 * render true per-approver statuses and gate Approve/Reject on the current
 * pending approver. A blank id short-circuits to an empty list.
 *
 *   GET /api/v1/payment/approval-box/{apprSeqNo}/approvers
 */
export async function fetchApprovalBoxApprovers(
    apprSeqNo: string | null | undefined,
): Promise<ApiApprovalBoxApprover[]> {
    if (!apprSeqNo || !apprSeqNo.trim()) return [];
    try {
        const res = await api.get<ApiResponse<ApiApprovalBoxApprover[]>>(
            `${BASE}/${encodeURIComponent(apprSeqNo)}/approvers`,
        );
        return unwrap(res);
    } catch (err) {
        rethrowAxios(err);
    }
}

/**
 * Common Approval Details master row, resolvable by EITHER identity:
 *   - `apprSeqNo` — direct (Approval Box / card ref).
 *   - `postSeqNo` (+ optional `bltbCd`) — the legacy-safe notification
 *     identity. Legacy `comm_0195_001` loads by `POST_SEQ_NO`; the backend
 *     resolves it → `APPR_SEQ_NO` via `BLTB_POST_INFM`. This is the robust
 *     path because approval-ACTION notifications carry only `POST_SEQ_NO`.
 *
 * Returns the same `ApiApprovalBoxRow` shape the list emits. Throws
 * `ApprovalBoxApiError("WBE_APPROVAL_DETAIL_NOT_FOUND")` when the approval is
 * missing / withdrawn / in another tenant — the dialog surfaces a safe
 * message and closes, never navigates.
 */
export async function fetchApprovalDetailMaster(params: {
    apprSeqNo?: string | null;
    postSeqNo?: string | null;
    bltbCd?: string | null;
}): Promise<ApiApprovalBoxRow> {
    try {
        const res = await api.get<ApiResponse<ApiApprovalBoxRow>>(`${BASE}/detail`, {
            params: {
                ...(params.apprSeqNo ? { appr_seq_no: params.apprSeqNo } : {}),
                ...(params.postSeqNo ? { post_seq_no: params.postSeqNo } : {}),
                ...(params.bltbCd ? { bltb_cd: params.bltbCd } : {}),
            },
        });
        return unwrap(res);
    } catch (err) {
        rethrowAxios(err);
    }
}

/**
 * Read-only per-line transactions for one approval — populates the
 * Transaction Details section of the Approval Details popup opened from a
 * notification. Backend covers the four scheduled kinds; card lines are
 * loaded via {@link fetchCardTransactionsByApproval} instead, and overseas
 * is deferred — both return `[]` here. Returns `[]` on blank input or any
 * error so the popup degrades to its empty state.
 */
export async function fetchApprovalTransactionsByApproval(
    apprSeqNo: string | null | undefined,
): Promise<ApiApprovalTransactionRow[]> {
    if (!apprSeqNo || !apprSeqNo.trim()) return [];
    try {
        const res = await api.get<ApiResponse<ApiApprovalTransactionRow[]>>(
            `${BASE}/${encodeURIComponent(apprSeqNo)}/transactions`,
        );
        return unwrap(res);
    } catch (err) {
        rethrowAxios(err);
    }
}

/**
 * Read-only attachment list for one approval (UNION of EXPT_RESOL_FILE +
 * EXPT_RESOL_PAY_EVID_FILE). Each row's `file_id` + `file_type` drive
 * {@link downloadApprovalBoxAttachment}. Returns `[]` on blank input.
 */
export async function fetchApprovalAttachments(
    apprSeqNo: string | null | undefined,
): Promise<ApiApprovalAttachment[]> {
    if (!apprSeqNo || !apprSeqNo.trim()) return [];
    try {
        const res = await api.get<ApiResponse<ApiApprovalAttachment[]>>(
            `${BASE}/${encodeURIComponent(apprSeqNo)}/attachments`,
        );
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

/**
 * Withdraw an in-flight approval for a NON-CARD payment type
 * (Internal Transfer / Vendor / Expense / Payroll / Overseas).
 *
 *   DELETE /api/v1/payment/approval-box/{apprSeqNo}/withdraw
 *
 * Card approvals keep their dedicated
 * `withdrawCardApproval` (card-transactions) endpoint — the page routes
 * card rows there and every other type here. Throws {@link ApiCallError}
 * (not {@link ApprovalBoxApiError}) so the Approval Box page's existing
 * `instanceof ApiCallError` catch — shared with the card branch — surfaces
 * the `code` in the system dialog.
 */
export async function withdrawApprovalBoxRow(apprSeqNo: string): Promise<void> {
    if (!apprSeqNo.trim()) {
        throw new ApiCallError("WBE_VALIDATION", "appr_seq_no: required");
    }
    try {
        const res = await api.delete<ApiResponse<null>>(
            `${BASE}/${encodeURIComponent(apprSeqNo)}/withdraw`,
        );
        if (res.data.status.error) {
            throw new ApiCallError(res.data.status.code, res.data.status.message);
        }
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as AxiosError<ApiResponse<unknown>>;
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/**
 * Change the approval line on an in-flight approval for a NON-CARD
 * payment type — replaces the approver chain and resets to Pending.
 *
 *   PUT /api/v1/payment/approval-box/{apprSeqNo}/approval-line
 *   body: { appr_line_no }
 *
 * Card approvals use `changeCardApprovalLine`. Same {@link ApiCallError}
 * contract as {@link withdrawApprovalBoxRow}.
 */
export async function changeApprovalBoxApprovalLine(
    apprSeqNo: string,
    apprLineNo: number,
): Promise<void> {
    if (!apprSeqNo.trim()) {
        throw new ApiCallError("WBE_VALIDATION", "appr_seq_no: required");
    }
    if (!apprLineNo || apprLineNo <= 0) {
        throw new ApiCallError("WBE_VALIDATION", "appr_line_no: required");
    }
    try {
        const res = await api.put<ApiResponse<null>>(
            `${BASE}/${encodeURIComponent(apprSeqNo)}/approval-line`,
            { appr_line_no: apprLineNo },
        );
        if (res.data.status.error) {
            throw new ApiCallError(res.data.status.code, res.data.status.message);
        }
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as AxiosError<ApiResponse<unknown>>;
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}
