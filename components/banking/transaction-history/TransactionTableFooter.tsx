"use client";

import DataTableFooter from "@/components/shared/DataTableFooter";
import { useTranslation } from "@/lib/i18n";

import TransactionTableColumns, {
    TRANSACTION_TABLE_MIN_WIDTH,
} from "./TransactionTableColumns";
import type { TransactionTotals } from "./types";

type TransactionTableFooterProps = {
    totals: TransactionTotals;
    /** Currency code shown next to the total label (e.g. "VND", "USD"). */
    currency: string;
    /** Matches the main table's `minWidth` so both scroll in lockstep. */
    minWidth?: string;
    className?: string;
};

/**
 * Summary row rendered as its own `<table>` that imports the same
 * colgroup as the main Transaction History table. Kept as a sibling
 * table (not a `<tfoot>` inside the main table) so the page can pin it
 * to the bottom of the scroll container via `mt-auto` — the Approval
 * Box canonical pattern (CLAUDE.md §7a).
 *
 * Ten columns — count + totals sit under the bank-statement half; the
 * matching panel columns (Purpose, VAS Account, Contacts Name, Confirmed
 * by, Action) are blank in the totals row.
 */
export default function TransactionTableFooter({
    totals,
    currency,
    minWidth = TRANSACTION_TABLE_MIN_WIDTH,
    className,
}: TransactionTableFooterProps) {
    const { t } = useTranslation();

    return (
        <DataTableFooter
            colgroup={<TransactionTableColumns />}
            minWidth={minWidth}
            className={className}
        >
            <tr className="bg-white">
                <td className="px-2.5 py-3 align-middle">
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
                <td className="px-2.5 py-3 text-right align-middle">
                    <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-status-approved-text">
                        {totals.depositTotal}
                    </span>
                </td>
                <td className="px-2.5 py-3 text-right align-middle">
                    <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-status-rejected-text">
                        {totals.withdrawTotal}
                    </span>
                </td>
                <td aria-hidden colSpan={7} />
            </tr>
        </DataTableFooter>
    );
}
