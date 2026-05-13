import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import type {
    ApiResponse,
    ApiTenantUserListResponse,
} from "@/lib/types/api";

/**
 * Tenant-user directory API client. Mirrors the Spring
 * {@code UserController} endpoint {@code GET /api/v1/users},
 * the refactor counterpart of legacy {@code comm_0192_001_r001}
 * ("Inquiry Approver").
 *
 * <p>First consumer: the Approval Line "Add Approver" picker
 * (replaces the static {@code APPROVER_POOL} fallback). Future
 * approver / signer pickers reuse the same client.
 *
 * <p>Errors propagate as {@link ApiCallError} carrying the
 * backend {@code status.code} so the caller can branch
 * (e.g. {@code WBE_VALIDATION} on a {@code q} that exceeds the
 * 100-character cap).
 */
const BASE = "/api/v1/users";

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

/**
 * Fetch the tenant-user directory. Optional {@code q} narrows the
 * server-side {@code USER_NM} ILIKE match; missing / blank returns
 * the full active directory for the current tenant.
 */
export function fetchTenantUsers(q?: string): Promise<ApiTenantUserListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiTenantUserListResponse>>(BASE, {
            params: {
                q: q && q.trim() ? q.trim() : undefined,
            },
        }),
    );
}
