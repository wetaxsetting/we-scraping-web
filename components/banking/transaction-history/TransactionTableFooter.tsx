"use client";

import DataTableFooter from "@/components/shared/DataTableFooter";
import { isSpecialViewSettingField, type ViewSettingItem } from "@/components/shared/view-setting";
import { useTranslation } from "@/lib/i18n";

import TransactionTableColumns from "./TransactionTableColumns";
import { TRANSACTION_HISTORY_COLUMN_REGISTRY } from "./columnRegistry";
import type { TransactionTotals } from "./types";

type TransactionTableFooterProps = {
    totals: TransactionTotals;
    /** Currency code shown next to the total label (e.g. "VND", "USD"). */
    currency: string;
    /** Live View Setting items (already filtered to use_yn='Y' and
     *  sorted by disp_ord) — drives the footer's column structure so
     *  Deposit / Withdraw totals stay aligned under their headers
     *  regardless of which columns the user has toggled on. */
    visibleColumns: ViewSettingItem[];
    /** Matches the main table's `minWidth` so both scroll in lockstep. */
    minWidth?: string;
    className?: string;
};

/**
 * Summary row rendered as its own `<table>` that imports the same
 * column structure as the main Transaction History table. Pinned to
 * the bottom of the scroll container via `mt-auto` (CLAUDE.md §7a).
 *
 * Column placement is driven by {@link visibleColumns}:
 *   - The count label drops into the FIRST visible column (whichever
 *     it is after the user's reorder / toggle).
 *   - The Deposit total renders only when `DEPOSIT_AMT` is visible.
 *   - The Withdrawal total renders only when `WITHDRAW_AMT` is visible.
 *   - The trailing action column is always reserved (matches the main
 *     table's hardcoded action cell).
 */
export default function TransactionTableFooter({
    totals,
    currency,
    visibleColumns,
    minWidth,
    className,
}: TransactionTableFooterProps) {
    const { t } = useTranslation();

    // Renderable columns mirror the main table's filter — specials
    // dropped, unknown FIELD_IDs dropped. The footer's cells must
    // align 1:1 with the body's, so use the same filter logic.
    const renderable = visibleColumns.filter(
        (col) =>
            !isSpecialViewSettingField(col.field_id) &&
            TRANSACTION_HISTORY_COLUMN_REGISTRY[col.field_id] !== undefined,
    );

    return (
        <DataTableFooter
            colgroup={<TransactionTableColumns visibleColumns={visibleColumns} />}
            minWidth={minWidth}
            className={className}
        >
            <tr className="bg-white">
                {renderable.map((col, index) => {
                    if (index === 0) {
                        // Count label sits in the first visible column.
                        return (
                            <td
                                key={col.field_id}
                                className="px-2.5 py-3 align-middle"
                            >
                                <div className="flex flex-col">
                                    <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                                        {t("txn_history.total_label", { currency })}
                                    </span>
                                    <span className="whitespace-nowrap text-wb-13 font-medium text-wb-muted">
                                        {t("txn_history.transaction_count", {
                                            count: totals.count,
                                        })}
                                    </span>
                                </div>
                            </td>
                        );
                    }
                    if (col.field_id === "DEPOSIT_AMT") {
                        return (
                            <td
                                key={col.field_id}
                                className="px-2.5 py-3 align-middle"
                            >
                                <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-ink">
                                    {totals.depositTotal}
                                </span>
                            </td>
                        );
                    }
                    if (col.field_id === "WITHDRAW_AMT") {
                        return (
                            <td
                                key={col.field_id}
                                className="px-2.5 py-3 align-middle"
                            >
                                <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-ink">
                                    {totals.withdrawTotal}
                                </span>
                            </td>
                        );
                    }
                    return <td key={col.field_id} aria-hidden />;
                })}
                {/* Trailing action column — always reserved. */}
                <td aria-hidden />
            </tr>
        </DataTableFooter>
    );
}
