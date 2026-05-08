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
 */
export default function ChartOfAccountsTableColumns() {
    return (
        <colgroup>
            <col className="w-[44px]" />
            <col className="w-[160px]" />
            <col className="w-[200px]" />
            <col className="w-[200px]" />
            <col className="w-[180px]" />
            <col className="w-[150px]" />
            <col className="w-[110px]" />
            {/* Status — widened from 110px to 140px so the inline row's
               status dropdown (Active ▾, ~110px) sits comfortably inside
               the cell with breathing room before the colSpan=2 buttons
               flex starts. The read-only "Active" badge naturally
               left-aligns in the wider cell with no visual change. */}
            <col className="w-[140px]" />
            {/* Actions — widened from 96px to 140px so the inline row's
               Cancel + Save pair (~60 + 8 + 50 = ~118px) fits without
               touching the cell edges, and the read-only edit + delete
               icon pair (size-7 each, gap-1.5 = 64px) keeps its existing
               left-aligned position with extra trailing room. */}
            <col className="w-[140px]" />
        </colgroup>
    );
}

/**
 * Sum of the column widths above. Both tables apply this as their
 * `min-w` so the shared horizontal scroll container scrolls them as a
 * single unit when the content area is narrower than the column total.
 *
 * 44 + 160 + 200 + 200 + 180 + 150 + 110 + 140 + 140 = 1334
 */
export const CHART_OF_ACCOUNTS_TABLE_MIN_WIDTH = "1334px";
