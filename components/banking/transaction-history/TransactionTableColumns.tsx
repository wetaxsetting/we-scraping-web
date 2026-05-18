import { isSpecialViewSettingField, type ViewSettingItem } from "@/components/shared/view-setting";
import { TRANSACTION_HISTORY_COLUMN_REGISTRY } from "./columnRegistry";

/** Width of the trailing action column (Confirm / Undo). Hardcoded
 *  because the action column is not part of the View Setting seed —
 *  it is admin chrome that always renders. */
export const TRANSACTION_ACTION_COL_WIDTH = "110px";

/** Parse a `SIZE` token like `"160px"` into a number, falling back to
 *  the registry's default width when the token is blank / malformed. */
function parseSize(token: string | undefined, fallback: string): number {
    const raw = (token && token.trim()) || fallback;
    const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : 160;
}

/**
 * Build the minimum table width string (`"NNNNpx"`) from the visible
 * View Setting columns plus the trailing action column. The main
 * table and the footer table share this value so they scroll
 * horizontally in lockstep (CLAUDE.md §7a).
 */
export function computeTransactionTableMinWidth(
    visibleColumns: ViewSettingItem[],
): string {
    let total = parseSize(TRANSACTION_ACTION_COL_WIDTH, "110px");
    for (const col of visibleColumns) {
        if (isSpecialViewSettingField(col.field_id)) continue;
        const def = TRANSACTION_HISTORY_COLUMN_REGISTRY[col.field_id];
        if (!def) continue;
        total += parseSize(col.size, def.defaultWidth);
    }
    return `${total}px`;
}

/**
 * Shared `<colgroup>` for the Transaction History table and its sibling
 * footer table. Both tables iterate the same `visibleColumns` list
 * (filtered to use_yn='Y' + sorted by disp_ord) so column widths align
 * at every viewport width.
 *
 * The trailing `<col>` reserves space for the action column (Confirm /
 * Undo) which is rendered as hardcoded chrome by the main table — see
 * {@link TRANSACTION_ACTION_COL_WIDTH}.
 */
export default function TransactionTableColumns({
    visibleColumns,
}: {
    visibleColumns: ViewSettingItem[];
}) {
    return (
        <colgroup>
            {visibleColumns.map((col) => {
                if (isSpecialViewSettingField(col.field_id)) return null;
                const def = TRANSACTION_HISTORY_COLUMN_REGISTRY[col.field_id];
                if (!def) return null;
                return (
                    <col
                        key={col.field_id}
                        style={{ width: col.size || def.defaultWidth }}
                    />
                );
            })}
            <col style={{ width: TRANSACTION_ACTION_COL_WIDTH }} />
        </colgroup>
    );
}
