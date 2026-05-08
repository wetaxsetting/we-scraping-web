/**
 * Shared `<colgroup>` for the VAS Account table — Figma 9194:8615.
 *
 * Column order mirrors the table header from left to right:
 *   vas code · vas account name · status · actions (kebab)
 *
 * Sums to 1000px which fits comfortably inside the Settings panel right
 * column (~1025px content area at the 1300px modal width minus the
 * 211px sidebar minus 64px px-8 padding).
 */
export default function VasAccountTableColumns() {
    return (
        <colgroup>
            <col className="w-[220px]" />
            <col className="w-[600px]" />
            <col className="w-[120px]" />
            <col className="w-[60px]" />
        </colgroup>
    );
}

/**
 * Sum of the column widths above. Applied as `min-w` so the table
 * scrolls horizontally inside the panel scroll container only when
 * the viewport is narrower than the column total.
 *
 * 220 + 600 + 120 + 60 = 1000
 */
export const VAS_ACCOUNT_TABLE_MIN_WIDTH = "1000px";
