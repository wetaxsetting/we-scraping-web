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

import EInvoiceTableColumns from "./EInvoiceTableColumns";
import type { EInvoiceRow } from "./types";

type EInvoiceTableProps = {
    rows: EInvoiceRow[];
    /**
     * i18n key prefix for column labels. Defaults to `sales_einvoices`;
     * the Expenses variant passes `expenses_einvoices` so the same table
     * renders with different header copy (Buyer → Supplier) without
     * duplicating the component.
     */
    translationPrefix?: "sales_einvoices" | "expenses_einvoices";
    className?: string;
};

/**
 * Sales / Expenses e-Invoices table — renders `<thead>` + `<tbody>` only.
 * The summary rows (per-currency totals) are a sibling
 * `<EInvoiceTableFooter>` pinned to the bottom of the scroll container
 * via `mt-auto` (CLAUDE.md §7a canonical pattern). Both tables import
 * the same `<EInvoiceTableColumns>` so Total / Tax / Pre-tax totals
 * align under their columns.
 */
export default function EInvoiceTable({
    rows,
    translationPrefix = "sales_einvoices",
    className,
}: EInvoiceTableProps) {
    const { t } = useTranslation();
    const k = (suffix: string) => `${translationPrefix}.${suffix}`;
    return (
        <table
            className={cn(
                "w-full min-w-[var(--w-wb-si-table-min)] table-fixed border-collapse",
                className,
            )}
        >
            <EInvoiceTableColumns />

            <TableHeader className="sticky top-0 z-20">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell>{t(k("col.date_time"))}</TableHeaderCell>
                    <TableHeaderCell>{t(k("col.invoice_no"))}</TableHeaderCell>
                    <TableHeaderCell>{t(k("col.buyer"))}</TableHeaderCell>
                    <TableHeaderCell>{t(k("col.currency"))}</TableHeaderCell>
                    <TableHeaderCell align="right">{t(k("col.total"))}</TableHeaderCell>
                    <TableHeaderCell>{t(k("col.status"))}</TableHeaderCell>
                    <TableHeaderCell align="right">{t(k("col.tax"))}</TableHeaderCell>
                    <TableHeaderCell align="right">{t(k("col.pretax"))}</TableHeaderCell>
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
                            <div className="flex flex-col">
                                <span className="text-wb-13 font-normal text-wb-ink">
                                    {row.invoiceNo}
                                </span>
                                <span className="text-wb-13 font-medium text-brand-hover">
                                    {row.invoiceType}
                                </span>
                            </div>
                        </TableCell>

                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <div className="flex flex-col gap-0.5">
                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                    {row.buyerName}
                                </span>
                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                    {t(k("mst_label"), { code: row.mstCode })}
                                    <span className="pl-1 text-brand-hover">
                                        {row.buyerStatus}
                                    </span>
                                </span>
                            </div>
                        </TableCell>

                        <TextCell>{row.currency}</TextCell>
                        <TextCell align="right">{row.totalAmount}</TextCell>
                        <TextCell>{row.invoiceStatus}</TextCell>
                        <TextCell align="right">{row.taxAmount}</TextCell>
                        <TextCell align="right">{row.amountBeforeTax}</TextCell>
                    </TableRow>
                ))}
            </TableBody>
        </table>
    );
}

function TextCell({
    children,
    align = "left",
    className,
}: {
    children: React.ReactNode;
    align?: "left" | "right";
    className?: string;
}) {
    return (
        <TableCell
            className={cn(
                "px-2.5 py-2.5 align-middle",
                align === "right" && "text-right",
                className,
            )}
        >
            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                {children}
            </span>
        </TableCell>
    );
}
