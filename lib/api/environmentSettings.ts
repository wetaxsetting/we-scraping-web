import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import type {
    ApiEnvironmentSetting,
    ApiEnvironmentSettingUpdateRequest,
    ApiResponse,
} from "@/lib/types/api";

/**
 * Settings &gt; Environment Settings API client. Mirrors two legacy
 * WSVCs that any module may call with any env_set_inf code:
 *
 * <ul>
 *   <li><b>Read</b>: legacy {@code comm_0600_001_r001} →
 *       {@code GET /api/v1/settings/environment-settings/{env_set_inf}}.
 *       Single-row shape; backend applies COALESCE(BUSI, SYS) so a
 *       tenant that has not yet customised the value still gets the
 *       system default.</li>
 *   <li><b>Update</b>: legacy {@code comm_0215_001_u001} →
 *       {@code PUT /api/v1/settings/environment-settings/{env_set_inf}}.
 *       Pure UPDATE; the BUSI row is pre-seeded at tenant bootstrap.</li>
 * </ul>
 *
 * <p>Both endpoints are generic — first consumer is the Firm Banking
 * Settings panel (codes {@code 00078} Auto Transfer / {@code 00079}
 * Auto Match), but any future module sharing the same toggle pattern
 * consumes the same routes without backend changes.
 *
 * <p>The toggle UI fires per-code calls on click (no batching),
 * mirroring legacy {@code comm_0220_001.ts:114/120}'s
 * {@code functionUpadateEnv(code, isChecked ? "Y" : "N")} pattern.
 */

/** Five-char codes consumed today. New codes can be added without
 *  changing the shape of this client — extend the panel registry. */
export const ENV_AUTO_TRANSFER_CD = "00078";
export const ENV_AUTO_MATCH_CD = "00079";

const BASE = "/api/v1/settings/environment-settings";

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
 * Fetch one environment-setting value for the current tenant. Backend
 * applies COALESCE(BUSI, SYS) so callers do not need to handle
 * "tenant not yet bootstrapped" — the SYS default is returned in
 * that case. Mirrors legacy {@code comm_0600_001_r001}.
 */
export function fetchEnvironmentSetting(
    envSetInf: string,
): Promise<ApiEnvironmentSetting> {
    return unwrap(
        api.get<ApiResponse<ApiEnvironmentSetting>>(
            `${BASE}/${encodeURIComponent(envSetInf)}`,
        ),
    );
}

/**
 * Save one environment-setting value. Returns the persisted row so
 * the caller can confirm the final value matches the optimistic
 * update. Mirrors legacy {@code comm_0215_001_u001}.
 *
 * <p>Backend errors propagate as {@link ApiCallError}:
 *   - {@code WBE2030} — env_set_inf not registered in
 *     {@code SYS_ENV_SET_INFM}
 *   - {@code WBE2031} — tenant has no BUSI row for this code yet
 *     (run tenant bootstrap)
 *   - {@code WBE_VALIDATION} — request body fails bean-validation
 */
export function updateEnvironmentSetting(
    envSetInf: string,
    body: ApiEnvironmentSettingUpdateRequest,
): Promise<ApiEnvironmentSetting> {
    return unwrap(
        api.put<ApiResponse<ApiEnvironmentSetting>>(
            `${BASE}/${encodeURIComponent(envSetInf)}`,
            body,
        ),
    );
}
