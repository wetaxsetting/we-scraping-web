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
 * 15 columns (legacy on-screen-table parity plus the Reporting Account
 * + VAS Account inserts):
 *   col 1 (Transaction ID) → count label
 *   col 2 (Date/Time)      → empty
 *   col 3 (Deposit)        → deposit total
 *   col 4 (Withdrawal)     → withdrawal total
 *   cols 5–15              → empty (Balance · Remarks · File Name ·
 *                            Matched Date · Matched By · Reporting
 *                            Account · Purpose · VAS Account ·
 *                            Contact Name · Confirmed by · Action)
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
                {/* col 1 — Transaction ID slot hosts the count label */}
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
                {/* col 2 — Date/Time */}
                <td aria-hidden />
                {/* col 3 — Deposit total. Legacy left-aligns the
                   number under the (also left-aligned) Deposit column
                   header. */}
                <td className="px-2.5 py-3 align-middle">
                    <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-ink">
                        {totals.depositTotal}
                    </span>
                </td>
                {/* col 4 — Withdrawal total */}
                <td className="px-2.5 py-3 align-middle">
                    <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-ink">
                        {totals.withdrawTotal}
                    </span>
                </td>
                {/* cols 5–15 — Balance, Remarks, File Name, Matched
                   Date, Matched By, Reporting Account, Purpose,
                   VAS Account, Contact Name, Confirmed by, Action */}
                <td aria-hidden colSpan={11} />
            </tr>
        </DataTableFooter>
    );
}
