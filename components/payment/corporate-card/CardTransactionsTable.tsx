"use client";

import { ChevronDown, ChevronRight, StickyNote } from "lucide-react";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { Checkbox } from "@/components/ui/checkbox";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import CardTransactionsTableColumns from "./CardTransactionsTableColumns";
import type { CardTransactionRow } from "./types";

type CardTransactionsTableProps = {
    rows: CardTransactionRow[];
    className?: string;
};

/**
 * Card Transactions main table (thead + tbody). Bare <table> so it can share
 * the colgroup with the sibling footer and scroll together in DataTableShell.
 *
 * Special cells:
 *  - Reporting Account: two-line (account code+name + chevron / category path)
 *  - Link Reference: single ref | "Link" action text | multi-ref with +N badge
 *  - Highlighted rows: Figma yellow bg for rows without an approvalRef
 */
export default function CardTransactionsTable({
    rows,
    className,
}: CardTransactionsTableProps) {
    const { t } = useTranslation();

    return (
        <table
            className={cn(
                "w-full min-w-[var(--w-wb-ct-table-min)] table-fixed border-collapse",
                className,
            )}
        >
            <CardTransactionsTableColumns />

            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    {/* Checkbox */}
                    <TableCell className="px-3 py-2.5">
                        <Checkbox aria-label={t("payment.aria.select_all")} />
                    </TableCell>
                    <TableHeaderCell sortable>{t("payment.col.date_time")}</TableHeaderCell>
                    <TableHeaderCell sortable>{t("payment.col.card_number")}</TableHeaderCell>
                    <TableHeaderCell sortable>{t("payment.col.merchant")}</TableHeaderCell>
                    <TableHeaderCell sortable>{t("payment.card.col.card_nickname")}</TableHeaderCell>
                    <TableHeaderCell sortable>{t("payment.card.col.cardholder")}</TableHeaderCell>
                    <TableHeaderCell align="right" sortable>{t("payment.col.amount")}</TableHeaderCell>
                    <TableHeaderCell sortable>{t("payment.card.col.reporting_account")}</TableHeaderCell>
                    <TableHeaderCell sortable>{t("payment.card.col.link_reference")}</TableHeaderCell>
                    <TableHeaderCell sortable>{t("payment.card.col.approval_ref")}</TableHeaderCell>
                    {/* Note — no sort, icon-only column */}
                    <TableCell className="px-2 py-2.5" />
                </TableRow>
            </TableHeader>

            <TableBody>
                {rows.map((row) => (
                    <TableRow
                        key={row.id}
                        className={cn(
                            "h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0",
                            row.highlighted
                                ? "bg-[#fffde7] hover:bg-[#fff9c4]"
                                : "hover:bg-neutral-50/60",
                        )}
                    >
                        {/* Checkbox */}
                        <TableCell className="px-3 py-2.5">
                            <Checkbox
                                aria-label={t("payment.aria.select_file", {
                                    fileName: row.merchant,
                                })}
                            />
                        </TableCell>

                        {/* Date / Time — two lines */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block text-wb-13 font-medium text-wb-ink">
                                {row.date}
                            </span>
                            <span className="block text-wb-13 font-medium text-wb-muted">
                                {row.time}
                            </span>
                        </TableCell>

                        {/* Card Number — brand name + masked number */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block truncate text-wb-13 font-semibold text-wb-ink">
                                {row.cardBrand}
                            </span>
                            <span className="block truncate text-wb-13 font-medium text-wb-muted">
                                {row.cardNumber}
                            </span>
                        </TableCell>

                        {/* Merchant */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.merchant}
                            </span>
                        </TableCell>

                        {/* Card Nickname */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.cardNickname}
                            </span>
                        </TableCell>

                        {/* Cardholder */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.cardholder}
                            </span>
                        </TableCell>

                        {/* Amount — right-aligned */}
                        <TableCell className="px-2.5 py-2.5 text-right">
                            <span className="block text-wb-13 font-medium text-wb-ink">
                                {row.amount}
                            </span>
                        </TableCell>

                        {/* Reporting Account — two-line with inline dropdown arrow */}
                        <TableCell className="px-2.5 py-2.5">
                            <div className="flex items-center gap-0.5">
                                <span className="truncate text-wb-13 font-medium text-wb-ink">
                                    {row.reportingAccount}
                                </span>
                                <ChevronDown
                                    aria-hidden
                                    className="size-4 shrink-0 text-wb-ntrl-6"
                                    strokeWidth={1.8}
                                />
                            </div>
                            <span className="block truncate text-wb-12 font-medium text-wb-muted">
                                {row.reportingCategory}
                            </span>
                        </TableCell>

                        {/* Link Reference — action | single | multi (+N badge) */}
                        <TableCell className="px-2.5 py-2.5">
                            <LinkReferenceCell linkRef={row.linkRef} />
                        </TableCell>

                        {/* Approval Ref. */}
                        <TableCell className="px-2.5 py-2.5">
                            {row.approvalRef ? (
                                <span className="block truncate text-wb-13 font-medium text-brand">
                                    {row.approvalRef}
                                </span>
                            ) : null}
                        </TableCell>

                        {/* Note icon */}
                        <TableCell className="px-2 py-2.5 text-center">
                            <button
                                type="button"
                                aria-label={t("payment.card.col.note")}
                                className="inline-flex cursor-pointer items-center justify-center rounded p-0.5 text-wb-ntrl-6 hover:text-brand"
                            >
                                <StickyNote className="size-[18px]" strokeWidth={1.5} />
                            </button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </table>
    );
}

/** Renders the Link Reference cell in one of three shapes. */
function LinkReferenceCell({
    linkRef,
}: {
    linkRef: CardTransactionRow["linkRef"];
}) {
    if (linkRef.isAction) {
        return (
            <button
                type="button"
                className="cursor-pointer text-wb-13 font-medium text-brand underline-offset-2 hover:underline"
            >
                {linkRef.primary}
            </button>
        );
    }

    if (linkRef.secondary || linkRef.overflow) {
        return (
            <div className="flex items-start gap-1">
                <div className="flex flex-col">
                    <span className="block truncate text-wb-13 font-medium text-brand">
                        {linkRef.primary}
                    </span>
                    {linkRef.secondary && (
                        <span className="block truncate text-wb-13 font-medium text-brand">
                            {linkRef.secondary}
                        </span>
                    )}
                </div>
                {linkRef.overflow && (
                    <span className="inline-flex shrink-0 items-center justify-center rounded-[4px] border border-wb-ntrl-4 bg-wb-ntrl-3 px-1 text-wb-10 font-medium text-wb-ink">
                        {linkRef.overflow}
                    </span>
                )}
                <ChevronRight
                    aria-hidden
                    className="mt-px size-4 shrink-0 text-wb-ntrl-6"
                    strokeWidth={1.8}
                />
            </div>
        );
    }

    return (
        <span className="block truncate text-wb-13 font-medium text-brand">
            {linkRef.primary}
        </span>
    );
}
