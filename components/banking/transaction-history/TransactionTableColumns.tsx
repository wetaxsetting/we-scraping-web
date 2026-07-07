import {
    isSpecialViewSettingField,
    ViewSettingColgroup,
    viewSettingMinWidthPx,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { TRANSACTION_HISTORY_COLUMN_REGISTRY } from "./columnRegistry";

/** Width of the trailing action column (Confirm / Undo). Hardcoded
 *  because the action column is not part of the View Setting seed —
 *  it is admin chrome that always renders. */
export const TRANSACTION_ACTION_COL_WIDTH = "110px";

/** field_id → registry `defaultWidth`, used as the per-column fallback
 *  when a seed row ships no `size`. Fed to the shared width helpers so
 *  Transaction History resolves widths through the same code path as
 *  every other View-Setting-driven table (CLAUDE.md §13). */
const TRANSACTION_DEFAULT_WIDTH_BY_FIELD: Record<string, string> =
    Object.fromEntries(
        Object.entries(TRANSACTION_HISTORY_COLUMN_REGISTRY).map(
            ([fieldId, def]) => [fieldId, def.defaultWidth],
        ),
    );

/** Visible columns the table actually renders — drops CHECKBOX/ETC
 *  specials and any FIELD_ID without a registry renderer, matching the
 *  main table + footer body. */
function renderableColumns(
    visibleColumns: ViewSettingItem[],
): ViewSettingItem[] {
    return visibleColumns.filter(
        (c) =>
            !isSpecialViewSettingField(c.field_id) &&
            TRANSACTION_HISTORY_COLUMN_REGISTRY[c.field_id] !== undefined,
    );
}

/**
 * Build the minimum table width string (`"NNNNpx"`) from the visible
 * View Setting columns plus the trailing action column. The main
 * table and the footer table share this value so they scroll
 * horizontally in lockstep (CLAUDE.md §7a). Delegates to the shared
 * Σ-visible-px helper so the "min-width = sum of DB sizes" rule is
 * defined once for the whole app.
 */
export function computeTransactionTableMinWidth(
    visibleColumns: ViewSettingItem[],
): string {
    const total = viewSettingMinWidthPx(renderableColumns(visibleColumns), {
        fallbackByField: TRANSACTION_DEFAULT_WIDTH_BY_FIELD,
        // Trailing action column (Confirm / Undo) — admin chrome outside
        // the seed, so added as a fixed extra.
        extraPx: parseInt(TRANSACTION_ACTION_COL_WIDTH, 10),
    });
    return `${total}px`;
}

/**
 * Shared `<colgroup>` for the Transaction History table and its sibling
 * footer table. Both tables iterate the same `visibleColumns` list
 * (filtered to use_yn='Y' + sorted by disp_ord) so column widths align
 * at every viewport width.
 *
 * Routes through the shared {@link ViewSettingColgroup}: each configurable
 * column's width comes from the DB `size` (falling back to the registry's
 * `defaultWidth`), and the trailing `<col>` reserves space for the action
 * column (Confirm / Undo) rendered as hardcoded chrome by the main table —
 * see {@link TRANSACTION_ACTION_COL_WIDTH}.
 */
export default function TransactionTableColumns({
    visibleColumns,
}: {
    visibleColumns: ViewSettingItem[];
}) {
    return (
        <ViewSettingColgroup
            items={renderableColumns(visibleColumns)}
            fallbackByField={TRANSACTION_DEFAULT_WIDTH_BY_FIELD}
            trailing={[
                { key: "__action", width: TRANSACTION_ACTION_COL_WIDTH },
            ]}
        />
    );
}
