"use client";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { Button } from "@/components/ui/button";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import TransferOwnAccountsTableColumns from "./TransferOwnAccountsTableColumns";
import type { OwnAccountRow } from "./types";

type TransferOwnAccountsTableProps = {
    rows: OwnAccountRow[];
    onTransfer: (row: OwnAccountRow) => void;
    className?: string;
};

/**
 * Account list for the Transfer Own Accounts page. Renders `<thead>` +
 * `<tbody>` only — the summary row is a sibling `<TransferOwnAccountsTableFooter>`
 * so the page can pin it to the bottom of the scroll area via `mt-auto`
 * (Approval Box pattern). Both tables share `TransferOwnAccountsTableColumns`
 * so column widths align.
 */
export default function TransferOwnAccountsTable({
    rows,
    onTransfer,
    className,
}: TransferOwnAccountsTableProps) {
    const { t } = useTranslation();

    return (
        <table
            className={cn(
                "w-full min-w-[1100px] table-fixed border-collapse",
                className,
            )}
        >
            <TransferOwnAccountsTableColumns />

            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell>{t("account_inquiry.col.bank")}</TableHeaderCell>
                    <TableHeaderCell>{t("account_inquiry.col.nickname")}</TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("account_inquiry.col.balance")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("account_inquiry.col.available")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("account_inquiry.col.last_update")}
                    </TableHeaderCell>
                    <TableHead className="px-2.5 text-right align-middle">
                        <span className="text-wb-14 font-semibold text-wb-dark">
                            {t("transfer_own.col.action")}
                        </span>
                    </TableHead>
                </TableRow>
            </TableHeader>

            <TableBody>
                {rows.map((row) => (
                    <TableRow
                        key={row.id}
                        className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                    >
                        <TableCell className="py-2.5 pr-2.5 pl-2.5">
                            <div className="flex flex-col items-start gap-1">
                                <div className="flex items-center gap-1.5">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="/assets/table/ico-building.svg"
                                        alt=""
                                        aria-hidden
                                        className="size-[var(--size-wb-icon-sm)] shrink-0 opacity-50"
                                    />
                                    <span className="whitespace-nowrap text-wb-14 font-medium text-wb-ink">
                                        {row.bankName}
                                    </span>
                                    <span className="whitespace-nowrap text-wb-14 font-medium text-wb-ntrl-6">
                                        {row.currency} • {row.bankType}
                                    </span>
                                </div>
                                <span className="whitespace-nowrap text-wb-13 font-normal text-wb-muted">
                                    {row.accountNo}
                                </span>
                            </div>
                        </TableCell>

                        <TableCell className="py-2.5 pr-4">
                            <span className="text-wb-14 font-medium text-wb-dark">
                                {row.nickname}
                            </span>
                        </TableCell>

                        <TableCell className="p-2.5 text-right">
                            <span className="text-wb-14 font-medium text-wb-ink">
                                {row.balance}
                            </span>
                        </TableCell>

                        <TableCell className="p-2.5 text-right">
                            <span className="text-wb-14 font-medium text-wb-ink">
                                {row.available}
                            </span>
                        </TableCell>

                        <TableCell className="py-2.5 pl-4">
                            {row.error ? (
                                <div className="flex flex-col">
                                    <span className="text-wb-14-loose font-medium text-wb-status-rejected-text">
                                        {t("transfer_own.status.failed")}
                                    </span>
                                    <span className="text-wb-14 font-medium text-wb-muted">
                                        {row.lastUpdate}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-wb-14-loose font-medium text-wb-muted">
                                    {row.lastUpdate}
                                </span>
                            )}
                        </TableCell>

                        <TableCell className="p-2.5 text-right">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-8 px-4 text-wb-13"
                                onClick={() => onTransfer(row)}
                            >
                                {t("transfer_own.transfer")}
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </table>
    );
}
