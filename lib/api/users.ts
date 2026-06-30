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

/**
 * Fetch the raw avatar bytes for ANY user-image URL the backend ships
 * (e.g. `/api/v1/users/{id}/image` or the Settings-Users
 * `/api/v1/settings/users/{id}/image?v=<save>`), as a Blob so the caller
 * can pin them to an `<img src={URL.createObjectURL(...)}>`.
 *
 * <p>The streaming GET is JWT-protected (a plain `<img src>` omits the
 * Authorization header), so this wraps the fetch through the shared
 * Axios instance. It is the single image-fetch funnel for the shared
 * `<UserAvatar>` — every approver / signer / user-list avatar resolves
 * its photo through here regardless of which endpoint minted the URL.
 *
 * <p>Returns `null` when the server responds with `WBE2113` (no avatar
 * set) so callers degrade gracefully to the initials placeholder.
 */
export async function fetchUserImageBlobByUrl(url: string): Promise<Blob | null> {
    try {
        const res = await api.get<Blob>(url, { responseType: "blob" });
        return res.data;
    } catch (err) {
        // axios with `responseType: "blob"` still returns the JSON error
        // envelope on a non-2xx — but as a Blob.
        const e = err as {
            response?: { status?: number; data?: Blob };
            message?: string;
        };
        const blob = e.response?.data;
        if (blob && blob.type && blob.type.includes("json")) {
            try {
                const text = await blob.text();
                const envelope = JSON.parse(text) as ApiResponse<unknown>;
                if (envelope.status?.error) {
                    if (envelope.status.code === "WBE2113") return null;
                    throw new ApiCallError(envelope.status.code, envelope.status.message);
                }
            } catch (parseErr) {
                if (parseErr instanceof ApiCallError) throw parseErr;
            }
        }
        if (err instanceof ApiCallError) throw err;
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}
