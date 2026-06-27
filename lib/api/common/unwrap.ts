import type { ApiResponse } from "@/lib/types/api";

/**
 * Shared envelope unwrapper for WeCMS JSON endpoints — the single
 * canonical implementation extracted from the ~12 byte-identical local
 * copies that previously lived in `lib/api/*` (frontend architecture
 * action plan, finding H-2).
 *
 * Behavior is preserved exactly from the original `banking.ts` copy:
 * a response is an error when `status.error` is true OR `data` is
 * missing (`!body.data`); axios transport errors are mapped to an
 * {@link ApiCallError} carrying the server `status.code` when present,
 * else `"NETWORK"`.
 *
 * IMPORTANT — JSON only. Binary download / export endpoints return a
 * blob / `ResponseEntity`, never the `ApiResponse<T>` envelope, and are
 * consumed via `lib/file.ts` / `lib/excel.ts`. They must NEVER be routed
 * through this helper (see wecms-api/CLAUDE.md §"Binary download/export").
 *
 * Modules with deliberately different envelope semantics are NOT migrated
 * to this helper and keep their own local `unwrap` by design — see the
 * H-2 migration note in the same action plan:
 *   - void/empty-data-tolerant (`status.error` only): cardTransactions,
 *     payment, smartOrganizer, payrollPayment, expensePayment,
 *     loginCredentials (the `!body.data` check was a documented bug here);
 *   - `body.data === undefined` check: approvalLine, chartOfAccounts,
 *     userManagement, users;
 *   - custom transport error: bankCredentials (`WBE_TRANSPORT`);
 *   - no network mapping: screenOption;
 *   - synchronous variants: notification (ApiCallError), approval-box
 *     (custom `ApprovalBoxApiError` carrying `trace_id`).
 *
 * Errors raise {@link ApiCallError} carrying `status.code` so the caller
 * can decide whether to surface a dialog (auth-token expiry pattern) or
 * fall back to static demo data (read-only graceful degradation).
 */
export class ApiCallError extends Error {
    code: string;
    constructor(code: string, message: string) {
        super(message);
        this.code = code;
    }
}

export async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
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
