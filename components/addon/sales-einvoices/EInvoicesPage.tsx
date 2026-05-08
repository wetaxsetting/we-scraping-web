"use client";

import DataTableShell from "@/components/shared/DataTableShell";
import FilterRow from "@/components/shared/FilterRow";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import type { SortDirection } from "@/hooks/useTableSort";
import type { InvoiceStatusFilterKey } from "@/lib/api/einvoiceStatus";
import { useTranslation } from "@/lib/i18n";

import EInvoiceDateRangeControl from "./EInvoiceDateRangeControl";
import EInvoiceTable from "./EInvoiceTable";
import EInvoiceTableFooter from "./EInvoiceTableFooter";
import InvoiceStatusFilter from "./InvoiceStatusFilter";
import SalesEInvoiceActionBar from "./SalesEInvoiceActionBar";
import type { EInvoiceCurrencyTotal, EInvoiceRow } from "./types";

type DateRangeState = {
    /** ISO `YYYY-MM-DD` start date — bound to the start chip + range popover. */
    startIso: string;
    /** ISO `YYYY-MM-DD` end date — bound to the end chip + range popover. */
    endIso: string;
    /** Fires when either end is updated (chip popup or range popover Apply). */
    onChange: (range: { start: string; end: string }) => void;
};

type PaginationState = {
    page: number;
    pageCount: number;
    pageSize: number;
    totalCount: number;
    shownCount: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
};

type SortState = {
    sortField: string | null;
    sortDirection: SortDirection;
    onSort: (fieldId: string) => void;
};

type StatusFilterState = {
    value: InvoiceStatusFilterKey;
    onChange: (next: InvoiceStatusFilterKey) => void;
};

type SearchState = {
    value: string;
    onChange: (next: string) => void;
};

type EInvoicesPageProps = {
    translationPrefix: "sales_einvoices" | "expenses_einvoices";
    rows: EInvoiceRow[];
    totals: EInvoiceCurrencyTotal[];
    dateRange: DateRangeState;
    pagination: PaginationState;
    sort: SortState;
    statusFilter: StatusFilterState;
    search: SearchState;
    onRefresh: () => void;
    onExport: () => void;
    /** Called when the user clicks the "Download Excel with Details" row in
     *  the Excel-button popover. Backend endpoint is not implemented yet —
     *  the page wrapper currently routes this to a "not implemented" dialog
     *  per task spec; swap to the real flow when the detail-export endpoint
     *  lands. */
    onExportDetails: () => void;
    onPrint: () => void;
    /** True while an Excel export request is in flight — disables the
     *  Excel button so a slow download can't be triggered twice. */
    exporting: boolean;
};

/**
 * Shared Add-on Service e-Invoices shell — used by both Sales (outbound
 * customer invoices) and Bill / Expenses (inbound supplier invoices).
 *
 * <p>Frontend MR B wires every interactive control:
 * <ul>
 *   <li>Status dropdown — popover with the 5 logical-status options.
 *       Selection cascades up to the client wrapper.</li>
 *   <li>Search input — feeds a debounced wire-side {@code keyword}
 *       param via the wrapper's debounce loop.</li>
 *   <li>Update button — calls {@code onRefresh} which bumps a refetch
 *       trigger in the wrapper. No external GDT calls.</li>
 * </ul>
 *
 * Bottom layout follows the Approval Box canonical pattern (CLAUDE.md
 * §7a): table + footer sit inside one shared flex scroll container and
 * the footer uses {@code mt-auto} to stay anchored at the bottom of
 * the viewport even when there are few rows; pagination sits outside
 * that container.
 */
export default function EInvoicesPage({
    translationPrefix,
    rows,
    totals,
    dateRange,
    pagination,
    sort,
    statusFilter,
    search,
    onRefresh,
    onExport,
    onExportDetails,
    onPrint,
    exporting,
}: EInvoicesPageProps) {
    const { t } = useTranslation();

    return (
        <PageLayout>
            <PageHeader title={t(`${translationPrefix}.title`)}>
                <SalesEInvoiceActionBar
                    onUpdate={onRefresh}
                    onExport={onExport}
                    onExportDetails={onExportDetails}
                    onPrint={onPrint}
                    exporting={exporting}
                />
            </PageHeader>

            <FilterRow
                right={
                    <SearchInput value={search.value} onChange={search.onChange} />
                }
            >
                <InvoiceStatusFilter
                    value={statusFilter.value}
                    translationPrefix={translationPrefix}
                    onChange={statusFilter.onChange}
                />
                <EInvoiceDateRangeControl
                    startIso={dateRange.startIso}
                    endIso={dateRange.endIso}
                    onChange={dateRange.onChange}
                />
            </FilterRow>

            <DataTableShell
                footerMode="paginationWithTotals"
                table={
                    <EInvoiceTable
                        rows={rows}
                        translationPrefix={translationPrefix}
                        sortField={sort.sortField}
                        sortDirection={sort.sortDirection}
                        onSort={sort.onSort}
                    />
                }
                footer={
                    <EInvoiceTableFooter
                        totals={totals}
                        translationPrefix={translationPrefix}
                        className="mt-auto"
                    />
                }
                pagination={
                    <Pagination
                        page={pagination.page}
                        pageCount={pagination.pageCount}
                        pageSize={pagination.pageSize}
                        totalLabel={t("common.showing_of", {
                            shown: String(pagination.shownCount),
                            total: String(pagination.totalCount),
                        })}
                        onPageChange={pagination.onPageChange}
                        onPageSizeChange={pagination.onPageSizeChange}
                        className="shrink-0"
                    />
                }
            />
        </PageLayout>
    );
}
