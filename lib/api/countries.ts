import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import type { ApiResponse } from "@/lib/types/api";

/**
 * Country master API client — backs the global phone-country picker.
 * Mirrors backend `CountryController#list` (refactor counterpart of
 * legacy JEX `comm_0110_001_r001`).
 *
 * Single GET endpoint, read-only reference data. Errors propagate as
 * {@link ApiCallError} so the caller can fall back to a static seed
 * list when the API is unreachable (offline-dev graceful degradation).
 */

/** Wire row — matches `CountryRow` on the backend (snake_case). */
export interface ApiCountryRow {
    ntnl_cd:    string;
    natl_nm:    string;
    natn_num:   string;
    default_yn: string;
}

/** Wire envelope — matches `CountryListResponse`. */
export interface ApiCountryListResponse {
    countries:   ApiCountryRow[];
    total_count: number;
}

/** In-memory shape consumed by the picker (camelCase semantic names). */
export interface Country {
    /** ISO 3166-1 alpha-2 (e.g. `"VN"`). */
    iso2:      string;
    /** Display name (e.g. `"Vietnam"`). */
    name:      string;
    /** Dial code WITHOUT the leading `+` (e.g. `"84"`). */
    dial:      string;
    /** `true` for the default country (legacy `default_yn === "Y"`). */
    isDefault: boolean;
}

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
        const e = err as {
            response?: { data?: ApiResponse<unknown> };
            message?: string;
        };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

function toCountry(row: ApiCountryRow): Country {
    return {
        iso2:      (row.ntnl_cd ?? "").toLowerCase(),
        name:      row.natl_nm ?? "",
        dial:      row.natn_num ?? "",
        isDefault: row.default_yn === "Y",
    };
}

export async function fetchCountries(): Promise<Country[]> {
    const data = await unwrap<ApiCountryListResponse>(
        api.get("/api/v1/common/countries"),
    );
    return (data.countries ?? []).map(toCountry);
}
