import type { ApiPurposeSettingRow } from "@/lib/api/purposeSettings";

import type { PurposeOption } from "./types";

/**
 * Flatten the tenant-scoped Purpose tree into a flat picker list for
 * the Transaction History Purpose dropdown. Walks the level-1 +
 * level-2 hierarchy depth-first and surfaces every active node — the
 * legacy `fnsh_0200_001` picker exposes the full set the same way.
 *
 *  • Active rows only (`disp_yn === "Y"`) — the backend already
 *    filters but defence-in-depth keeps a stale frontend state safe.
 *  • Sorted by parent's `disp_ord` then child's `disp_ord` (falling
 *    back to user-visible code for stability) so the picker order
 *    matches Settings > Purpose's manual ordering.
 *  • Children inherit no breadcrumb / parent context — the picker
 *    only renders `<code> <name>`; the hierarchical position lives
 *    in Settings, not in the picker UI.
 */
export function buildPurposeOptions(
    rows: ApiPurposeSettingRow[],
): PurposeOption[] {
    if (rows.length === 0) return [];

    const collator = new Intl.Collator(undefined, {
        sensitivity: "base",
        numeric:     true,
    });

    const roots = [...rows]
        .filter((r) => r.parent_use_usag_cd === null)
        .sort((a, b) => {
            const da = a.disp_ord ?? Number.MAX_SAFE_INTEGER;
            const db = b.disp_ord ?? Number.MAX_SAFE_INTEGER;
            if (da !== db) return da - db;
            return collator.compare(a.hand_use_usag_cd, b.hand_use_usag_cd);
        });

    const out: PurposeOption[] = [];
    for (const root of roots) {
        if (root.disp_yn === "Y") {
            out.push({
                useUsagCd: root.use_usag_cd,
                code:      root.hand_use_usag_cd,
                name:      root.use_usag_nm,
            });
        }
        const children = [...(root.children ?? [])]
            .filter((c) => c.disp_yn === "Y")
            .sort((a, b) => {
                const da = a.disp_ord ?? Number.MAX_SAFE_INTEGER;
                const db = b.disp_ord ?? Number.MAX_SAFE_INTEGER;
                if (da !== db) return da - db;
                return collator.compare(a.hand_use_usag_cd, b.hand_use_usag_cd);
            });
        for (const child of children) {
            out.push({
                useUsagCd: child.use_usag_cd,
                code:      child.hand_use_usag_cd,
                name:      child.use_usag_nm,
            });
        }
    }
    return out;
}
