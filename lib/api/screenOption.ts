import { api } from "@/lib/axios";
import type {
    ApiResponse,
    ApiScreenAreaListResponse,
    ApiScreenOptionItem,
    ApiScreenOptionListResponse,
} from "@/lib/types/api";

import { ApiCallError } from "@/lib/api/banking";

/**
 * Screen-option (View Setting) API client. Mirrors
 * wecms-api/.../domain/setting/controller/ScreenOptionController.java:
 *
 *   GET    /api/v1/screen-options/{webSvcId}/{dymAreaId}  → load merged config
 *   GET    /api/v1/screen-options/{webSvcId}/areas        → list configured areas
 *   PUT    /api/v1/screen-options/{webSvcId}/{dymAreaId}  → save user overrides
 *   DELETE /api/v1/screen-options/{webSvcId}/{dymAreaId}  → reset (delete user rows)
 *
 * `webSvcId` follows the semantic-id convention locked in by
 * docs/features/view-setting.md (§1.1): `<module>-<page>[-<type>]`,
 * lowercase kebab-case, globally unique. The first wired page is
 * `banking-account-inquiry-vnd`.
 *
 * `dymAreaId` is required on every call. Single-area pages pass
 * `"default"`; multi-area pages pass meaningful kebab-case names per
 * §1.5 (e.g. `summary`, `current-accounts`). Legacy numeric names like
 * `table1` are forbidden.
 *
 * Load / save / reset all return the same merged-list shape so the popup
 * can use one render pipeline regardless of which action triggered the
 * round-trip.
 */
async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    const res = await promise;
    const body = res.data;
    if (body.status.error || !body.data) {
        throw new ApiCallError(body.status.code, body.status.message);
    }
    return body.data;
}

export function fetchScreenOptions(
    webSvcId: string,
    dymAreaId: string,
): Promise<ApiScreenOptionListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiScreenOptionListResponse>>(
            `/api/v1/screen-options/${encodeURIComponent(webSvcId)}/${encodeURIComponent(dymAreaId)}`,
        ),
    );
}

export function fetchScreenAreas(
    webSvcId: string,
): Promise<ApiScreenAreaListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiScreenAreaListResponse>>(
            `/api/v1/screen-options/${encodeURIComponent(webSvcId)}/areas`,
        ),
    );
}

export function saveScreenOptions(
    webSvcId: string,
    dymAreaId: string,
    items: ApiScreenOptionItem[],
): Promise<ApiScreenOptionListResponse> {
    return unwrap(
        api.put<ApiResponse<ApiScreenOptionListResponse>>(
            `/api/v1/screen-options/${encodeURIComponent(webSvcId)}/${encodeURIComponent(dymAreaId)}`,
            { items },
        ),
    );
}

export function resetScreenOptions(
    webSvcId: string,
    dymAreaId: string,
): Promise<ApiScreenOptionListResponse> {
    return unwrap(
        api.delete<ApiResponse<ApiScreenOptionListResponse>>(
            `/api/v1/screen-options/${encodeURIComponent(webSvcId)}/${encodeURIComponent(dymAreaId)}`,
        ),
    );
}
