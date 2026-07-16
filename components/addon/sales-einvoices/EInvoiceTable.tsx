"use client";

import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { matchInvoiceStatus } from "@/lib/api/einvoiceStatus";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { SortDirection } from "@/hooks/useTableSort";
import { formatAmount } from "@/lib/currency";
import { formatLocalDtmByLanguage } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import EInvoiceStatusText from "./EInvoiceStatusText";
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
    /**
     * View Setting `FIELD_ID` currently driving the table-wide sort
     * state. Forwarded to every {@link TableHeaderCell} so only the
     * active column renders the coloured glyph.
     */
    sortField?: string | null;
    /** Direction of the active sort (`ASC` / `DESC` / `null`). */
    sortDirection?: SortDirection;
    /** Cycle handler — receives the clicked column's `FIELD_ID`. */
    onSort?: (fieldId: string) => void;
    /**
     * Row-click handler — opens the "View e-Invoice Details" modal. Clicks
     * that originate on an interactive control (checkbox, button, link,
     * dropdown, or anything marked `data-ignore-row-click`) are ignored so
     * the row click never hijacks those affordances.
     */
    onRowClick?: (row: EInvoiceRow) => void;
};

/**
 * Sales / Bill e-Invoices table — renders `<thead>` + `<tbody>` only.
 * The summary rows (per-currency totals) are a sibling
 * `<EInvoiceTableFooter>` pinned to the bottom of the scroll container
 * via `mt-auto` (CLAUDE.md §7a canonical pattern). Both tables import
 * the same `<EInvoiceTableColumns>` so Total / Tax / Pre-tax totals
 * align under their columns.
 *
 * <p>Frontend MR A — every header opts into the shared `useTableSort`
 * cycle. The 8 sort `FIELD_ID`s match the backend `EInvoiceSortField`
 * whitelist verbatim ({@code DATE_TIME}, {@code INVOICE_NO}, …,
 * {@code PRETAX}).
 */
export default function EInvoiceTable({
    rows,
    translationPrefix = "sales_einvoices",
    className,
    sortField,
    sortDirection,
    onSort,
    onRowClick,
}: EInvoiceTableProps) {
    const { t, locale } = useTranslation();
    const k = (suffix: string) => `${translationPrefix}.${suffix}`;

    // Translate the stored (Vietnamese) EINV_INVOICESTATUS to the localized
    // label the legacy `wb_get_invoice_status(value, LANG_CD)` produced
    // (Original / Replacement / …). Unknown values fall back to the raw string
    // (legacy fallback). Drives both the invoice-no sub-line and the status cell.
    const statusLabel = (raw: string): string => {
        const logical = matchInvoiceStatus(raw);
        return logical === "other" ? raw : t(k(`filter.status.${logical}`));
    };

    // Ignore clicks that land on an interactive control so the row-click never
    // hijacks a checkbox / button / link / dropdown. Mirrors the canonical
    // Payment list-row guard.
    const handleRowClick =
        (row: EInvoiceRow) => (event: React.MouseEvent<HTMLTableRowElement>) => {
            if (!onRowClick) return;
            const target = event.target as HTMLElement;
            if (
                target.closest(
                    'button, a, input, select, textarea, [role="button"], [data-ignore-row-click]',
                )
            ) {
                return;
            }
            onRowClick(row);
        };
    return (
        <table
            className={cn(
                "w-full min-w-[var(--w-wb-si-table-min)] table-fixed border-collapse",
                className,
            )}
        >
            <EInvoiceTableColumns />

            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell
                        sortFieldId="DATE_TIME"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                    >
                        {t(k("col.date"))}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="INVOICE_NO"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                    >
                        {t(k("col.invoice_no"))}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="BUYER"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                    >
                        {t(k("col.buyer"))}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="CURRENCY"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                    >
                        {t(k("col.currency"))}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="TOTAL"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        align="right"
                        textSizeClass="text-wb-13"
                    >
                        {t(k("col.total"))}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="STATUS"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                    >
                        {t(k("col.status"))}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="TAX"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        align="right"
                        textSizeClass="text-wb-13"
                    >
                        {t(k("col.tax"))}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="PRETAX"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        align="right"
                        textSizeClass="text-wb-13"
                    >
                        {t(k("col.pretax"))}
                    </TableHeaderCell>
                </TableRow>
            </TableHeader>

            <TableBody>
                {rows.map((row) => {
                    // Locale-aware Date (date only — legacy `einv_0001_000` grid
                    // shows the ISSU_DT calendar date with NO time). `row.date`
                    // is the raw ISSU_DT (YYYYMMDD, zone-free → no TZ shift);
                    // `formatLocalDtmByLanguage` renders it EN DD-MMM-YYYY /
                    // KO YYYY-MM-DD / VI DD-MM-YYYY. The time proxy is not shown.
                    const { date: dispDate } = formatLocalDtmByLanguage(
                        row.date,
                        locale,
                    );
                    return (
                    <TableRow
                        key={row.id}
                        onClick={onRowClick ? handleRowClick(row) : undefined}
                        className={cn(
                            "h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0",
                            onRowClick && "cursor-pointer hover:bg-black/[0.02]",
                        )}
                    >
                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <span className="text-wb-13 font-medium text-wb-ink">
                                {dispDate}
                            </span>
                        </TableCell>

                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <div className="flex flex-col">
                                <span className="text-wb-13 font-medium text-wb-ink">
                                    {row.invoiceNo}
                                </span>
                                <span className="text-wb-13 font-medium text-brand-hover">
                                    {statusLabel(row.invoiceType)}
                                </span>
                            </div>
                        </TableCell>

                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <div className="flex flex-col gap-0.5">
                                <EllipsisTooltip
                                    text={row.buyerName}
                                    className="text-wb-13 font-medium text-wb-ink"
                                />
                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                    {t(k("mst_label"), { code: row.mstCode })}
                                    <span className="pl-1 text-brand-hover">
                                        {row.buyerStatus}
                                    </span>
                                </span>
                            </div>
                        </TableCell>

                        <TextCell>{row.currency}</TextCell>
                        <TextCell align="right">
                            {formatAmount(row.totalAmount, row.currency, false)}
                        </TextCell>
                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <EInvoiceStatusText
                                value={row.invoiceStatus}
                                label={statusLabel(row.invoiceStatus)}
                            />
                        </TableCell>
                        <TextCell align="right">
                            {formatAmount(row.taxAmount, row.currency, false)}
                        </TextCell>
                        <TextCell align="right">
                            {formatAmount(row.amountBeforeTax, row.currency, false)}
                        </TextCell>
                    </TableRow>
                    );
                })}
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
