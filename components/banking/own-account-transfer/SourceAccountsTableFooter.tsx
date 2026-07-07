"use client";

import DataTableFooter from "@/components/shared/DataTableFooter";
import {
    ViewSettingColgroup,
    viewSettingMinWidth,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { OwnAccountSourceTotals } from "./types";

type SourceAccountsTableFooterProps = {
    totals: OwnAccountSourceTotals;
    /** Same visible columns the main table renders — the footer shares
     *  the `<colgroup>` so totals stay aligned under their columns. */
    visibleColumns: ViewSettingItem[];
    className?: string;
};

/**
 * Footer row for the source-account list. Renders the same `<colgroup>`
 * the main table uses so totals stay aligned regardless of which
 * columns the View Setting popover hid / reordered. The totals row
 * renders cells in the SAME order as `visibleColumns`, dropping totals
 * into the matching slots and rendering empty cells everywhere else.
 *
 * <p>The "total accounts" label always anchors the row in the first
 * visible column (cells that follow the BANK_CD slot keep the label
 * width tidy with a single colspan when applicable).
 */
export default function SourceAccountsTableFooter({
    totals,
    visibleColumns,
    className,
}: SourceAccountsTableFooterProps) {
    const { t } = useTranslation();

    // Same DB-size-driven colgroup + Σ-sizes min-width as the main table
    // so the totals stay column-aligned at every scroll offset.
    const colgroup = (
        <ViewSettingColgroup items={visibleColumns} defaultFallback="160px" />
    );
    const minWidth = viewSettingMinWidth(visibleColumns, { fallback: "1100px" });

    return (
        <DataTableFooter colgroup={colgroup} minWidth={minWidth} className={cn("sticky bottom-0 z-20 h-[50px]", className)}>
            <tr className="h-[50px]">
                {visibleColumns.map((col, idx) => {
                    const isFirst = idx === 0;
                    if (isFirst) {
                        return (
                            <td key={col.field_id} className="px-2.5 py-3">
                                <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                                    {t("own_account_transfer.footer.total_accounts", {
                                        count: String(totals.totalAccounts),
                                    })}
                                </span>
                            </td>
                        );
                    }
                    if (col.field_id === "BAL") {
                        return (
                            <td key={col.field_id} className="px-2.5 py-3 text-right">
                                <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                                    {formatAmount(totals.totalBalance, "VND", false)}
                                </span>
                            </td>
                        );
                    }
                    if (col.field_id === "AVI_BAL") {
                        return (
                            <td key={col.field_id} className="px-2.5 py-3 text-right">
                                <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                                    {formatAmount(totals.totalAvailable, "VND", false)}
                                </span>
                            </td>
                        );
                    }
                    return <td key={col.field_id} className="px-2.5 py-3" />;
                })}
            </tr>
        </DataTableFooter>
    );
}
