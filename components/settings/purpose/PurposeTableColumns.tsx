/**
 * Shared `<colgroup>` for the Purpose table — used by BOTH the main
 * read-only tree (`<PurposeTable>`) and the sibling inline Add/Edit row
 * (`<PurposeFormRow>`). Centralising the widths here is the canonical
 * CLAUDE.md §7a pattern: any change updates both tables in lockstep so
 * the header, data rows, and the bottom form cells stay aligned
 * regardless of horizontal scroll position.
 *
 * Column order mirrors the header from left to right:
 *   chevron · code · name · description · actions
 *
 * The form row consumes `description` + `actions` via `colSpan={2}` so
 * the merged cell (`280 + 240 = 520px`) holds the description input,
 * the parent picker, and the Cancel / Save buttons in one flex row.
 */
export default function PurposeTableColumns() {
    return (
        <colgroup>
            <col className="w-[44px]" />
            <col className="w-[160px]" />
            <col className="w-[260px]" />
            <col className="w-[280px]" />
            <col className="w-[240px]" />
        </colgroup>
    );
}

/**
 * Sum of the column widths above. Both tables apply this as their
 * `min-w` so the shared horizontal scroll container scrolls them as a
 * single unit when the content area is narrower than the column total.
 *
 * 44 + 160 + 260 + 280 + 240 = 984
 */
export const PURPOSE_TABLE_MIN_WIDTH = "984px";
