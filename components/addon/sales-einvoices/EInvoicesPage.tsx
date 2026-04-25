"use client";

import { useMemo, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import DateRangePicker from "@/components/shared/DateRangePicker";
import FilterRow from "@/components/shared/FilterRow";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import { useTranslation } from "@/lib/i18n";

import EInvoiceTable from "./EInvoiceTable";
import EInvoiceTableFooter from "./EInvoiceTableFooter";
import InvoiceStatusFilter from "./InvoiceStatusFilter";
import SalesEInvoiceActionBar from "./SalesEInvoiceActionBar";
import type { EInvoiceCurrencyTotal, EInvoiceRow } from "./types";

type DateRange = { start: string; end: string };

type PaginationState = {
    page: number;
    pageCount: number;
    pageSize: number;
    /** Total-record string shown in the "X of Y" pagination label. */
    total: string;
};

type EInvoicesPageProps = {
    /**
     * i18n prefix that namespaces every translation key on the page
     * (`{prefix}.title`, `{prefix}.filter.status.all`, `{prefix}.col.*`,
     * `{prefix}.total_label`, `{prefix}.transaction_count`). Sales uses
     * `sales_einvoices`; Expenses uses `expenses_einvoices`.
     */
    translationPrefix: "sales_einvoices" | "expenses_einvoices";
    rows: EInvoiceRow[];
    totals: EInvoiceCurrencyTotal[];
    dateRange: DateRange;
    pagination: PaginationState;
};

/**
 * Shared Add-on Service e-Invoices shell — used by both Sales (outbound
 * customer invoices) and Expenses (inbound supplier invoices). The two
 * variants only differ by translation prefix, rows, totals, date range,
 * and pagination state — every layout decision lives here so the pages
 * cannot drift apart visually.
 *
 * Bottom layout follows the Approval Box canonical pattern (CLAUDE.md
 * §7a): table + footer sit inside one shared flex scroll container and
 * the footer uses `mt-auto` to stay anchored at the bottom of the
 * viewport even when there are few rows; pagination sits outside that
 * container.
 */
export default function EInvoicesPage({
    translationPrefix,
    rows,
    totals,
    dateRange,
    pagination,
}: EInvoicesPageProps) {
    const { t } = useTranslation();
    const k = (suffix: string) => `${translationPrefix}.${suffix}`;
    const [search, setSearch] = useState("");

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) =>
            [r.invoiceNo, r.buyerName, r.mstCode, r.invoiceStatus, r.invoiceType]
                .join(" ")
                .toLowerCase()
                .includes(q),
        );
    }, [rows, search]);

    return (
        <PageLayout>
            <PageHeader title={t(k("title"))}>
                <SalesEInvoiceActionBar />
            </PageHeader>

            <FilterRow right={<SearchInput value={search} onChange={setSearch} />}>
                <InvoiceStatusFilter value={t(k("filter.status.all"))} />
                <DateRangePicker start={dateRange.start} end={dateRange.end} />
            </FilterRow>

            <DataTableShell
                footerMode="paginationWithTotals"
                table={
                    <EInvoiceTable
                        rows={filteredRows}
                        translationPrefix={translationPrefix}
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
                            shown: String(filteredRows.length),
                            total: pagination.total,
                        })}
                        className="shrink-0"
                    />
                }
            />
        </PageLayout>
    );
}
