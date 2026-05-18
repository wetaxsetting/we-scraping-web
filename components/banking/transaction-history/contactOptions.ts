import type { ApiContactRow } from "@/lib/types/api";

import type { ContactOption } from "./types";

/**
 * Translate the live `/api/v1/settings/contacts` rows into
 * `<ContactSelect>` options. Backend already filters trashed rows
 * server-side; defence-in-depth filter kept here for safety.
 * Sorted by `hand_trco_key` so the picker order matches the
 * Settings panel.
 */
export function buildContactOptions(rows: ApiContactRow[]): ContactOption[] {
    if (rows.length === 0) return [];
    const collator = new Intl.Collator(undefined, {
        sensitivity: "base",
        numeric:     true,
    });
    return rows
        .filter((r) => r.trco_stts !== "C")
        .map<ContactOption>((r) => ({
            trcoKey:     r.trco_key,
            handTrcoKey: r.hand_trco_key,
            name:        r.trco_cmnm,
        }))
        .sort((a, b) => collator.compare(a.handTrcoKey, b.handTrcoKey));
}
