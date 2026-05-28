/**
 * Shared `<colgroup>` for the Chart of Accounts table — used by BOTH the
 * main read-only table (`<ChartOfAccountsTable>`) and the sibling
 * inline Add/Edit row table (`<ChartOfAccountsInlineRow>`). Centralising
 * the column widths here is the canonical CLAUDE.md §7a pattern: any
 * change to a column width updates both tables in lockstep so headers,
 * data rows, and the bottom Add/Edit cells stay aligned regardless of
 * horizontal scroll position.
 *
 * Column order mirrors the table header from left to right:
 *   checkbox · code · english · vietnamese · korean · parent · calc rule
 *   · status · actions
 *
 * Width math (this table has a different column set from the rest of
 * the Settings panels, so it does NOT follow Login Credentials' shared
 * token pattern — literal widths sized for THIS column set):
 *   checkbox    44   — fixed small (selection only)
 *   code       160   — medium (max 10 alphanumeric chars)
 *   name EN    240   — widest (primary "Account Name", PO label)
 *   name VI    200   — secondary translation
 *   name KO    180   — secondary translation
 *   parent     220   — medium-large; holds the "ACC-01 REVENUE" badge
 *   calc rule  110   — medium; 1-char +/- badge or dropdown
 *   status     140   — small/medium; sized so the inline row's status
 *                       dropdown (w-110) + colSpan=2 Cancel/Save group
 *                       (~136px) both fit in the merged 280px cell
 *   actions    140   — fixed; locked at 140 so the inline row merged
 *                       cell stays at 280 (140 + 140). The read-only
 *                       Edit + Delete pair is right-aligned inside this
 *                       cell via `justify-end` on the action `<div>` in
 *                       ChartOfAccountsTable so the buttons visually
 *                       hug the table's right edge.
 *
 * Sum = 1444px. Both tables apply this as their `min-w` so the shared
 * horizontal scroll container scrolls them as a single unit when the
 * modal content area is narrower than the column total.
 */
export default function ChartOfAccountsTableColumns() {
    return (
        <colgroup>
            <col className="w-[44px]" />
            <col className="w-[160px]" />
            <col className="w-[240px]" />
            <col className="w-[200px]" />
            <col className="w-[180px]" />
            <col className="w-[220px]" />
            <col className="w-[110px]" />
            <col className="w-[140px]" />
            <col className="w-[140px]" />
        </colgroup>
    );
}

/**
 * Sum of the column widths above — kept in lockstep with the colgroup.
 *
 * 44 + 160 + 240 + 200 + 180 + 220 + 110 + 140 + 140 = 1444
 */
export const CHART_OF_ACCOUNTS_TABLE_MIN_WIDTH = "1444px";
