/**
 * Shared "View Setting `SIZE` → rendered column width" primitives.
 *
 * <h3>Why this module exists</h3>
 *
 * Every list/table page in WeCMS renders its `<colgroup>` from the same
 * View Setting rows (`SYS_SCR_OPTION_WECMS` / `USER_SCR_OPTION_WECMS`,
 * keyed by `WEB_SVC_ID` + `DYM_AREA_ID`). Legacy JEX maps each visible
 * option row's `SIZE` to a `<col width='SIZE'>` in `DISP_ORD` order (see
 * `osmc.ui.ts:343` — `<col width='SIZE' for='FIELD_ID'>`), inside a
 * `width:100%` + `table-layout:fixed` + `overflow:auto` wrapper. `SIZE`
 * therefore acts as a **proportional basis + horizontal-scroll
 * threshold**, not an absolute fixed pixel width.
 *
 * Before this module the size→width mapping was implemented four separate
 * ways (Approval Box's local `resolveColumnWidth`, Transaction History's
 * inline colgroup, the payment batch shell's `widthFor`, and the
 * `useViewSettingColumns` hook), and ignored entirely on several pages
 * that hardcoded `--w-wb-*` tokens instead. These helpers are the single
 * source of truth: every page's `<col style={{ width }}>` and the
 * table's `min-width` (= Σ visible px sizes) resolve through here, so
 * re-seeding a DB `SIZE` value flows to the UI with no code change and
 * hiding a column shrinks the scroll threshold exactly as legacy does.
 */

/** Minimal shape these helpers read off a View Setting item — kept
 *  structural so both the wire `ApiScreenOptionItem` and the re-exported
 *  `ViewSettingItem` satisfy it without an import cycle. */
export type WidthedViewSettingItem = {
    field_id: string;
    size?: string;
};

/** Options shared by {@link resolveViewSettingWidth} and
 *  {@link viewSettingMinWidthPx}. */
export type ViewSettingWidthOptions = {
    /** Per-FIELD_ID fallback width (e.g. a page's legacy seed mirror) used
     *  only when the wire ships an empty / non-px `size`. Should never fire
     *  in practice — the live seeds carry a px `size` for every row. */
    fallbackByField?: Readonly<Record<string, string>>;
    /** Fallback width when neither `size` nor {@link fallbackByField}
     *  resolves. Defaults to `"auto"` so a stray column degrades to
     *  content width rather than collapsing to 0. */
    defaultFallback?: string;
};

/**
 * Parse a `"Npx"` size string into its numeric pixel count. Returns `0`
 * when the value is missing, malformed, or a non-pixel unit — the safest
 * degradation for the `min-width` sum (a nonsense column contributes
 * nothing rather than `NaN`).
 */
export function parseViewSettingPxSize(raw: string | undefined | null): number {
    if (!raw) return 0;
    const match = raw.trim().match(/^(\d+(?:\.\d+)?)px$/i);
    return match ? Number(match[1]) : 0;
}

/**
 * Resolve the CSS width for one View Setting column. The wire `size`
 * wins whenever it is a positive px value (DB is the single source of
 * truth per CLAUDE.md §13); otherwise the per-field fallback, otherwise
 * {@link ViewSettingWidthOptions.defaultFallback} (`"auto"`).
 *
 * The returned string is CSS-shaped (`"90px"` / `"auto"`) and drops
 * straight into `<col style={{ width }}>`.
 */
export function resolveViewSettingWidth(
    item: WidthedViewSettingItem,
    opts?: ViewSettingWidthOptions,
): string {
    if (item.size && parseViewSettingPxSize(item.size) > 0) return item.size;
    return opts?.fallbackByField?.[item.field_id] ?? opts?.defaultFallback ?? "auto";
}

/**
 * Sum of the resolved pixel widths of `items` (+ any `extraPx` for
 * fixed leading/trailing columns such as a selection checkbox or an
 * action slot that live outside the View Setting seed). This is the
 * table's `min-width`: legacy stretches to fill the container when it is
 * wider than this sum, and locks to these exact px + horizontal-scrolls
 * when it is narrower. Non-px (`"auto"`) columns contribute `0`.
 */
export function viewSettingMinWidthPx(
    items: readonly WidthedViewSettingItem[],
    opts?: ViewSettingWidthOptions & { extraPx?: number },
): number {
    const cols = items.reduce(
        (sum, it) => sum + parseViewSettingPxSize(resolveViewSettingWidth(it, opts)),
        0,
    );
    return cols + (opts?.extraPx ?? 0);
}

/**
 * Same as {@link viewSettingMinWidthPx} but returns a CSS string
 * (`"1840px"`). When nothing resolves to a positive width it returns
 * `fallback` (e.g. a page's `--w-wb-*-table-min` token) so a
 * misconfigured seed can't collapse the table to zero width.
 */
export function viewSettingMinWidth(
    items: readonly WidthedViewSettingItem[],
    opts?: ViewSettingWidthOptions & { extraPx?: number; fallback?: string },
): string {
    const total = viewSettingMinWidthPx(items, opts);
    return total > 0 ? `${total}px` : (opts?.fallback ?? "0px");
}
