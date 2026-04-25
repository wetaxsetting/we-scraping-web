"use client";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import TransferHistoryTableColumns from "./TransferHistoryTableColumns";
import type { TransferRow } from "./types";

type TransferHistoryTableProps = {
    rows: TransferRow[];
    className?: string;
};

/**
 * Transfer History table — Figma 96:42769. Columns: Date/Time, From Bank,
 * To Bank, Transfer Amount, Remarks, Results. Renders `<thead>` + `<tbody>`
 * only; the summary row is a sibling `<TransferHistoryTableFooter>` pinned
 * to the bottom of the scroll container via `mt-auto` (Approval Box
 * pattern). Both tables share `TransferHistoryTableColumns` so the totals
 * align with the Transfer Amount column.
 */
export default function TransferHistoryTable({
    rows,
    className,
}: TransferHistoryTableProps) {
    const { t } = useTranslation();

    return (
        <table
            className={cn(
                "w-full min-w-[1080px] table-fixed border-collapse",
                className,
            )}
        >
            <TransferHistoryTableColumns />

            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell>{t("transfer_history.col.date_time")}</TableHeaderCell>
                    <TableHeaderCell>{t("transfer_history.col.from_bank")}</TableHeaderCell>
                    <TableHeaderCell>{t("transfer_history.col.to_bank")}</TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("transfer_history.col.amount")}
                    </TableHeaderCell>
                    <TableHeaderCell>{t("transfer_history.col.remarks")}</TableHeaderCell>
                    <TableHeaderCell>{t("transfer_history.col.results")}</TableHeaderCell>
                </TableRow>
            </TableHeader>

            <TableBody>
                {rows.map((row) => (
                    <TableRow
                        key={row.id}
                        className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                    >
                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <div className="flex flex-col">
                                <span className="text-wb-13 font-medium text-wb-ink">
                                    {row.date}
                                </span>
                                <span className="text-wb-13 font-medium text-wb-muted">
                                    {row.time}
                                </span>
                            </div>
                        </TableCell>

                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <BankCell
                                bank={row.fromBank}
                                currency={row.fromCurrency}
                                account={row.fromAccount}
                            />
                        </TableCell>

                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <BankCell
                                bank={row.toBank}
                                currency={row.toCurrency}
                                account={row.toAccount}
                            />
                        </TableCell>

                        <TableCell className="px-2.5 py-2.5 text-right align-middle">
                            <span className="text-wb-13 font-medium text-wb-ink">
                                {row.amount}
                            </span>
                        </TableCell>

                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.remarks}
                            </span>
                        </TableCell>

                        <TableCell className="px-2.5 py-2.5 align-middle">
                            {row.status === "failed" ? (
                                <div className="flex flex-col">
                                    <span className="text-wb-14-loose font-medium text-wb-status-rejected-text">
                                        {t("transfer_history.status.failed")}
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
                    </TableRow>
                ))}
            </TableBody>
        </table>
    );
}

function BankCell({
    bank,
    currency,
    account,
}: {
    bank: string;
    currency: string;
    account: string;
}) {
    return (
        <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/table/ico-building.svg"
                    alt=""
                    aria-hidden
                    className="size-[var(--size-wb-icon-sm)] shrink-0 opacity-50"
                />
                <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                    {bank}
                </span>
                <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ntrl-6">
                    {currency}
                </span>
            </div>
            <span className="whitespace-nowrap text-wb-13 font-normal text-wb-muted">
                {account}
            </span>
        </div>
    );
}
