"use client";

import DataTableFooter from "@/components/shared/DataTableFooter";
import { useTranslation } from "@/lib/i18n";

import TransferOwnAccountsTableColumns from "./TransferOwnAccountsTableColumns";
import type { OwnAccountTotals } from "./types";

type TransferOwnAccountsTableFooterProps = {
    totals: OwnAccountTotals;
    className?: string;
};

/**
 * Summary row rendered as its own `<table>` that shares the colgroup with
 * the main Transfer Own Accounts table. Kept as a sibling table (rather
 * than a `<tfoot>` inside the main table) so the page can pin it to the
 * bottom of the scroll container via `mt-auto` — the Approval Box pattern.
 */
export default function TransferOwnAccountsTableFooter({
    totals,
    className,
}: TransferOwnAccountsTableFooterProps) {
    const { t } = useTranslation();

    return (
        <DataTableFooter
            colgroup={<TransferOwnAccountsTableColumns />}
            minWidth="1100px"
            className={className}
        >
            <tr>
                <td colSpan={2} className="px-2.5 py-3">
                    <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                        {t("transfer_own.footer.total_accounts", {
                            count: String(totals.count),
                        })}
                    </span>
                </td>
                <td className="px-2.5 py-3 text-right">
                    <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                        <span className="font-semibold">{totals.balance}</span>
                    </span>
                </td>
                <td className="px-2.5 py-3 text-right">
                    <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                        <span className="font-semibold">{totals.available}</span>
                    </span>
                </td>
                <td aria-hidden />
                <td aria-hidden />
            </tr>
        </DataTableFooter>
    );
}
