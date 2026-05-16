import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import type {
    ApiCheckLoginIdResponse,
    ApiMenuEntitlementResponse,
    ApiMenuEntitlementUpdateRequest,
    ApiResponse,
    ApiUserMgmtCreateRequest,
    ApiUserMgmtListResponse,
    ApiUserMgmtRow,
    ApiUserMgmtUpdateRequest,
} from "@/lib/types/api";

/**
 * Settings > Users management API client. Mirrors the Spring
 * `UserManagementController` at `/api/v1/settings/users` — CRUD
 * over `USER_INFM` + `USER_BUSI_CONN_INFM` + `BUSI_ADMN_INFM`.
 *
 * <p>Distinct from `lib/api/users.ts` (the tenant-user directory
 * picker at `/api/v1/users` used by Approval Line "Add Approver").
 * Same database tables, different concern.
 *
 * <p>Errors propagate as {@link ApiCallError} carrying the backend
 * `status.code` so the caller can branch on
 * `WBE_USERS_PLAN_LIMIT_REACHED`,
 * `WBE_USERS_DUPLICATE_LOGIN_ID`,
 * `WBE_USERS_CANNOT_DELETE_SELF`,
 * `WBE_USERS_CANNOT_DEMOTE_LAST_ADMIN`,
 * `WBE_USERS_NOT_FOUND`, etc.
 *
 * <p>Wire convention: lowercase snake_case (CTO directive 2026-05-08).
 */
const BASE = "/api/v1/settings/users";

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

/** List every active user linked to the current tenant. Carries the
 *  count + the hard plan cap so the panel can paint the "{used} / {max}"
 *  subtitle and disable the Add affordance at the cap. */
export function fetchUserMgmtList(): Promise<ApiUserMgmtListResponse> {
    return unwrap(api.get<ApiResponse<ApiUserMgmtListResponse>>(BASE));
}

/** Single-row read. */
export function fetchUserMgmtDetail(userId: string): Promise<ApiUserMgmtRow> {
    return unwrap(
        api.get<ApiResponse<ApiUserMgmtRow>>(`${BASE}/${encodeURIComponent(userId)}`),
    );
}

/** Login-id availability probe — drives the panel's "Check
 *  availability" button. `available = true` means no `USER_INFM`
 *  row exists for the candidate id. */
export function checkLoginId(loginId: string): Promise<ApiCheckLoginIdResponse> {
    return unwrap(
        api.get<ApiResponse<ApiCheckLoginIdResponse>>(`${BASE}/check-id`, {
            params: { login_id: loginId },
        }),
    );
}

/** Create a new user. Backend enforces the 5-user plan cap and
 *  throws `WBE_USERS_PLAN_LIMIT_REACHED` on the 6th. */
export function createUserMgmt(
    body: ApiUserMgmtCreateRequest,
): Promise<ApiUserMgmtRow> {
    return unwrap(api.post<ApiResponse<ApiUserMgmtRow>>(BASE, body));
}

/** Update profile + (optional) password + admin toggle. `user_id`
 *  is immutable — it travels via the URI path only. */
export function updateUserMgmt(
    userId: string,
    body: ApiUserMgmtUpdateRequest,
): Promise<ApiUserMgmtRow> {
    return unwrap(
        api.put<ApiResponse<ApiUserMgmtRow>>(
            `${BASE}/${encodeURIComponent(userId)}`,
            body,
        ),
    );
}

/** Load the user's current granted menu slugs. Y-only — the response
 *  carries only granted slugs; the panel intersects them against the
 *  static `ENTITLEMENT_SECTIONS` tree to render checked / unchecked. */
export function fetchMenuEntitlement(
    userId: string,
): Promise<ApiMenuEntitlementResponse> {
    return unwrap(
        api.get<ApiResponse<ApiMenuEntitlementResponse>>(
            `${BASE}/${encodeURIComponent(userId)}/menu-entitlement`,
        ),
    );
}

/** Replace every grant with the supplied slug list. Backend uses
 *  delete-then-insert in one transaction. Empty list = revoke all. */
export function saveMenuEntitlement(
    userId: string,
    body: ApiMenuEntitlementUpdateRequest,
): Promise<ApiMenuEntitlementResponse> {
    return unwrap(
        api.put<ApiResponse<ApiMenuEntitlementResponse>>(
            `${BASE}/${encodeURIComponent(userId)}/menu-entitlement`,
            body,
        ),
    );
}

/** Per-tenant unlink. `USER_BUSI_CONN_INFM.DEL_YN='Y'` +
 *  `BUSI_ADMN_INFM` row removed; `USER_INFM` master left intact.
 *  Cannot use {@link unwrap} — that helper treats a missing `data`
 *  field as an error; void responses legitimately omit `data` (matches
 *  the approval-line / contacts / vas-account DELETE precedent). */
export async function deleteUserMgmt(userId: string): Promise<void> {
    try {
        const res = await api.delete<ApiResponse<void>>(
            `${BASE}/${encodeURIComponent(userId)}`,
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

/**
 * Upload (or replace) a user's avatar. Multipart field name is
 * {@code file}. Backend caps at 2 MB and an extension allow-list
 * (JPG / JPEG / PNG / GIF / SVG). Returns the refreshed user row
 * whose `user_img_url` carries the cache-busted streaming URL.
 *
 * <p>Possible error codes:
 * <ul>
 *   <li>WBE2111 — disk write failed</li>
 *   <li>WBE2115 — bad filename</li>
 *   <li>WBE2116 — empty file</li>
 *   <li>WBE2117 — file too large ({0} = cap)</li>
 *   <li>WBE2118 — extension not allowed ({0} = allow-list)</li>
 * </ul>
 */
export function uploadUserImage(
    userId: string,
    file: File,
): Promise<ApiUserMgmtRow> {
    const form = new FormData();
    form.append("file", file);
    return unwrap(
        api.post<ApiResponse<ApiUserMgmtRow>>(
            `${BASE}/${encodeURIComponent(userId)}/image`,
            form,
            { headers: { "Content-Type": "multipart/form-data" } },
        ),
    );
}

/** Clear a user's avatar. Idempotent — a user with no avatar set
 *  still gets a 200 and the unchanged row back. */
export function deleteUserImage(userId: string): Promise<ApiUserMgmtRow> {
    return unwrap(
        api.delete<ApiResponse<ApiUserMgmtRow>>(
            `${BASE}/${encodeURIComponent(userId)}/image`,
        ),
    );
}

/**
 * Fetch the raw avatar bytes as a Blob so the caller can pin them to
 * an {@code <img src={URL.createObjectURL(...)}>}. The streaming GET
 * endpoint is JWT-protected (browsers omit the Authorization header
 * on plain {@code <img src>} requests), so the page wraps the fetch
 * here and revokes the object URL on unmount / re-fetch.
 *
 * <p>Returns {@code null} when the server responds with
 * {@code WBE2113} (no avatar set) so callers can degrade gracefully
 * to the initials placeholder.
 */
export async function fetchUserImageBlob(userId: string): Promise<Blob | null> {
    try {
        const res = await api.get<Blob>(
            `${BASE}/${encodeURIComponent(userId)}/image`,
            { responseType: "blob" },
        );
        return res.data;
    } catch (err) {
        // axios with `responseType: "blob"` still returns the JSON
        // error envelope on a non-2xx — but as a Blob.
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
