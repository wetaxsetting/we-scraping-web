import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import type {
    ApiPreferencesResponse,
    ApiPreferencesUpdateRequest,
    ApiResponse,
} from "@/lib/types/api";

/**
 * Settings &gt; Preferences API client — company-profile read + update.
 * Mirrors the BUSI_INFM half of legacy {@code comm_0215_001}; the two
 * preference toggles (Use Purpose code {@code 00077} / Use VAS Account
 * code {@code 00074}) route through the generic env-settings client at
 * {@link ../api/environmentSettings.ts}.
 *
 * <p>One single-row resource per tenant — no list, no pagination, no
 * search. Tenant scope comes from the JWT; route does not carry
 * {@code biz_key}.
 *
 * <p>Errors propagate as {@link ApiCallError}. Codes the controller
 * surfaces today:
 * <ul>
 *   <li>{@code WBE2080} — BUSI_INFM row missing for the current tenant
 *       (should never happen post-login; surfaces only if the row was
 *       deleted out-of-band).</li>
 *   <li>{@code WBE_VALIDATION} — request body fails bean-validation
 *       (vietnamese_name / tax_id / representative_email / address.*
 *       required, email format, max lengths).</li>
 * </ul>
 */

const BASE = "/api/v1/settings/preferences";

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

/** Read the current tenant's company profile. */
export function fetchPreferences(): Promise<ApiPreferencesResponse> {
    return unwrap(api.get<ApiResponse<ApiPreferencesResponse>>(BASE));
}

/** Save the editable company-profile fields. Returns the persisted
 *  row so the caller can confirm the final value matches the optimistic
 *  draft. */
export function updatePreferences(
    body: ApiPreferencesUpdateRequest,
): Promise<ApiPreferencesResponse> {
    return unwrap(api.put<ApiResponse<ApiPreferencesResponse>>(BASE, body));
}

/**
 * Upload a new company logo. Multipart field name is {@code file}.
 * Backend caps at 2 MB and the extension allow-list
 * (jpg / jpeg / png / gif / svg). On success the response carries
 * the refreshed profile with a non-null {@code logo_url}.
 *
 * <p>Errors propagate as {@link ApiCallError}. Codes:
 * <ul>
 *   <li>{@code WBE2081} — disk write failed</li>
 *   <li>{@code WBE2084} — uploaded file has no usable filename</li>
 *   <li>{@code WBE2085} — empty file</li>
 *   <li>{@code WBE2086} — file too large ({0} = cap)</li>
 *   <li>{@code WBE2087} — file extension not allowed</li>
 * </ul>
 */
export function uploadPreferencesLogo(
    file: File,
): Promise<ApiPreferencesResponse> {
    const form = new FormData();
    form.append("file", file);
    return unwrap(
        api.post<ApiResponse<ApiPreferencesResponse>>(`${BASE}/logo`, form, {
            headers: { "Content-Type": "multipart/form-data" },
        }),
    );
}

/**
 * Clear the company logo. Idempotent — a tenant with no logo set
 * still gets a 200 and the unchanged profile back. Returns the
 * refreshed profile.
 */
export function deletePreferencesLogo(): Promise<ApiPreferencesResponse> {
    return unwrap(
        api.delete<ApiResponse<ApiPreferencesResponse>>(`${BASE}/logo`),
    );
}

/**
 * Fetch the raw logo bytes as a Blob so the caller can pin them to an
 * {@code <img src={URL.createObjectURL(...)}>}. The streaming GET
 * endpoint is JWT-protected (browsers omit the Authorization header
 * on plain {@code <img src>} requests), so the page wraps the fetch
 * here and revokes the object URL on unmount / re-fetch.
 *
 * <p>Returns {@code null} when the server responds with
 * {@code WBE2082} (no logo set) so callers can degrade gracefully
 * to the placeholder card.
 */
export async function fetchPreferencesLogoBlob(): Promise<Blob | null> {
    try {
        const res = await api.get<Blob>(`${BASE}/logo`, {
            responseType: "blob",
        });
        return res.data;
    } catch (err) {
        // axios with `responseType: "blob"` still returns the JSON
        // error envelope on a non-2xx — but as a Blob. Inspect the
        // response status first, then read the body if it looks like
        // JSON.
        const e = err as {
            response?: { status?: number; data?: Blob };
            message?: string;
        };
        const resp = e.response;
        const blob = resp?.data;
        if (blob && blob.type && blob.type.includes("json")) {
            try {
                const text = await blob.text();
                const envelope = JSON.parse(text) as ApiResponse<unknown>;
                if (envelope.status?.error) {
                    if (envelope.status.code === "WBE2082") return null;
                    throw new ApiCallError(envelope.status.code, envelope.status.message);
                }
            } catch (parseErr) {
                if (parseErr instanceof ApiCallError) throw parseErr;
                // Fall through to the generic network error below.
            }
        }
        if (err instanceof ApiCallError) throw err;
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}
