import {
    resolveViewSettingWidth,
    type ViewSettingWidthOptions,
    type WidthedViewSettingItem,
} from "./columnWidth";

/** A fixed (non-View-Setting) column rendered before or after the
 *  configurable columns — e.g. the always-present selection checkbox
 *  (leading) or an action slot (trailing). Its width is a literal CSS
 *  value (`"40px"` / `"var(--w-wb-col-checkbox)"`), not seed-driven. */
export type FixedColgroupCol = {
    /** Stable React key. */
    key: string;
    /** CSS width for the `<col>`. */
    width: string;
};

type ViewSettingColgroupProps = {
    /** Visible, `DISP_ORD`-ordered View Setting items. One `<col>` is
     *  emitted per item with `width = size` (DB single source of truth,
     *  per CLAUDE.md §13), falling back per {@link opts}. */
    items: readonly WidthedViewSettingItem[];
    /** Fixed columns rendered BEFORE the configurable columns (checkbox). */
    leading?: readonly FixedColgroupCol[];
    /** Fixed columns rendered AFTER the configurable columns (action slot). */
    trailing?: readonly FixedColgroupCol[];
} & ViewSettingWidthOptions;

/**
 * Shared `<colgroup>` for every View-Setting-driven table. The main
 * table (`<thead>` + `<tbody>`) and its sibling totals footer MUST render
 * the SAME element from the SAME visible-column list so their cells stay
 * column-aligned at every horizontal-scroll offset (CLAUDE.md §7a). This
 * component is that single element — it replaces the per-page colgroups
 * (Approval Box's `ApprovalColgroup`, Transaction History's inline
 * colgroup, Account Inquiry / Own Account Transfer's `colClassName`
 * colgroups, etc.) so column widths are defined exactly once, from the
 * DB `SIZE`.
 *
 * Legacy parity: mirrors `osmc.ui.ts`'s `<col width='SIZE' for='FIELD_ID'>`
 * per `USE_YN='Y'` column — the caller is responsible for filtering to
 * visible columns and ordering by `DISP_ORD` before passing `items`.
 */
export default function ViewSettingColgroup({
    items,
    leading,
    trailing,
    fallbackByField,
    defaultFallback,
}: ViewSettingColgroupProps) {
    const opts: ViewSettingWidthOptions = { fallbackByField, defaultFallback };
    return (
        <colgroup>
            {leading?.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
            ))}
            {items.map((it) => (
                <col
                    key={it.field_id}
                    style={{ width: resolveViewSettingWidth(it, opts) }}
                />
            ))}
            {trailing?.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
            ))}
        </colgroup>
    );
}
