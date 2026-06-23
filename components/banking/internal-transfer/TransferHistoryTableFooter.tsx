"use client";

import DataTableFooter from "@/components/shared/DataTableFooter";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import TransferHistoryTableColumns from "./TransferHistoryTableColumns";
import type { TransferHistoryTotal } from "./types";

type TransferHistoryTableFooterProps = {
    totals: TransferHistoryTotal;
    className?: string;
};

/**
 * Summary row rendered as its own `<table>` sharing the colgroup with the
 * main Transfer History table. Kept as a sibling table (not a `<tfoot>`
 * inside the main table) so the page can pin it to the bottom of the
 * scroll container via `mt-auto` — the Approval Box pattern.
 */
export default function TransferHistoryTableFooter({
    totals,
    className,
}: TransferHistoryTableFooterProps) {
    const { t } = useTranslation();

    return (
        <DataTableFooter
            colgroup={<TransferHistoryTableColumns />}
            minWidth="1080px"
            className={cn("sticky bottom-0 z-20 h-[50px]", className)}
        >
            <tr className="h-[50px]">
                <td className="px-2.5 py-3">
                    <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                        {t("transfer_history.footer.total_currency", {
                            currency: totals.currency,
                        })}
                    </span>
                </td>
                <td colSpan={2} className="px-2.5 py-3">
                    <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                        {t("transfer_history.footer.transaction_count", {
                            count: String(totals.count),
                        })}
                    </span>
                </td>
                <td className="px-2.5 py-3 text-right">
                    <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                        <span className="font-semibold">{totals.total}</span>
                    </span>
                </td>
                <td aria-hidden />
                <td aria-hidden />
            </tr>
        </DataTableFooter>
    );
}
