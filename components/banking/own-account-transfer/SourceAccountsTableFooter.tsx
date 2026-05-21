"use client";

import DataTableFooter from "@/components/shared/DataTableFooter";
import type { ViewSettingItem } from "@/components/shared/view-setting";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

import { SOURCE_ACCOUNTS_COLUMN_REGISTRY } from "./source-accounts-columns";
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

    const colgroup = (
        <colgroup>
            {visibleColumns.map((col) => {
                const def = SOURCE_ACCOUNTS_COLUMN_REGISTRY[col.field_id];
                return (
                    <col
                        key={col.field_id}
                        className={def?.colClassName ?? "w-[160px]"}
                    />
                );
            })}
        </colgroup>
    );

    return (
        <DataTableFooter colgroup={colgroup} minWidth="1100px" className={className}>
            <tr>
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
