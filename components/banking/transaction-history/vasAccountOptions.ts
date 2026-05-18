import type { ApiVasAccountRow } from "@/lib/types/api";

import type { VasAccountOption } from "./types";

/**
 * Translate the live `/api/v1/settings/vas-account` rows into
 * `<VasAccountSelect>` options. Filters to active rows only
 * (`stts === "A"`) and sorts by code so the picker matches the
 * Settings panel ordering.
 */
export function buildVasAccountOptions(
    rows: ApiVasAccountRow[],
): VasAccountOption[] {
    if (rows.length === 0) return [];
    const collator = new Intl.Collator(undefined, {
        sensitivity: "base",
        numeric:     true,
    });
    return rows
        .filter((r) => r.stts === "A")
        .map<VasAccountOption>((r) => ({
            vasAcctCd: r.vas_acct_cd,
            name:      r.vas_acct_nm,
        }))
        .sort((a, b) => collator.compare(a.vasAcctCd, b.vasAcctCd));
}
