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
 * Width math (sums to the 1024px modal content area at the 1300px
 * Settings card minus the 211px nav + 64px panel `px-8` padding) so the
 * table fills the modal cleanly without right-side empty space:
 *   chevron     44   — expand/collapse gutter
 *   code       180   — short alphanumeric codes (BD01, BD01-01, …)
 *   name       280   — medium-large
 *   description 380   — widest column (Figma 9438:19204)
 *   action     140   — sized to Edit + Delete + ToggleSwitch group
 *
 * The form row consumes `description` + `actions` via `colSpan={2}` so
 * the merged cell (380 + 140 = 520px) holds the description input, the
 * parent picker (180px), and the Cancel / Save buttons in one flex row —
 * matching the previous 280 + 240 = 520px merged cell so the form
 * layout stays unchanged.
 */
export default function PurposeTableColumns() {
    return (
        <colgroup>
            <col className="w-[44px]" />
            <col className="w-[180px]" />
            <col className="w-[280px]" />
            <col className="w-[380px]" />
            <col className="w-[140px]" />
        </colgroup>
    );
}

/**
 * Sum of the column widths above. Both tables apply this as their
 * `min-w` so the shared horizontal scroll container scrolls them as a
 * single unit when the content area is narrower than the column total.
 *
 * 44 + 180 + 280 + 380 + 140 = 1024
 */
export const PURPOSE_TABLE_MIN_WIDTH = "1024px";
