import { api } from "@/lib/axios";
import { unwrap } from "./common/unwrap";

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

// `unwrap` is the shared canonical helper imported from ./common/unwrap (H-2).

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
