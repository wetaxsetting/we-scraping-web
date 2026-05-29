"use client";

import { useMemo, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import DateRangeFilter, {
    type DateRangeFilterValue,
} from "@/components/shared/DateRangeFilter";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import PaymentListTable from "./PaymentListTable";
import PaymentListTableFooter from "./PaymentListTableFooter";
import type { CurrencyTotal, PaymentListColumn } from "./types";

const DEFAULT_DATE_RANGE: DateRangeFilterValue = {
    mode:   "preset",
    preset: "last_30_days",
    start:  "",
    end:    "",
};

type PaymentListPageProps<Row extends { id: string }> = {
    /** Translation key for the page title. */
    titleKey: string;
    /** Column definitions — labels, widths, render functions. */
    columns: PaymentListColumn<Row>[];
    /** Mock or real rows — search filter is applied by the caller's `searchableFields`. */
    rows: Row[];
    /**
     * Total currency rows to render in the sibling footer. Omit to render the
     * footer with only the count cell.
     */
    totals?: CurrencyTotal[];
    /**
     * Optional formatter for total cells. Defaults to `Total {currency} : {value}`.
     * `t(approval.total_label, …)` is the canonical Approval Box format.
     */
    formatTotal?: (t: CurrencyTotal) => { prefix: string; value: string };
    /** Translation key + arg for the count label, e.g. `payment.list.transaction_count`. */
    countLabelKey: string;
    /** Min-width of the table — must be wide enough for all columns to fit. */
    minWidth: string;
    /**
     * Field keys searched by the top-right `<SearchInput>`. The page filters
     * `rows` client-side — UI-only placeholder until the real query lands.
     */
    searchableFields?: (keyof Row)[];
    /** Optional placeholder for the search input. */
    searchPlaceholder?: string;
    /**
     * Footer mode — `paginationWithTotals` (default) shows the sibling footer
     * row; `paginationOnly` hides totals (Exchange Rate Inquiry, etc.).
     */
    footerMode?: "paginationWithTotals" | "paginationOnly";
    /**
     * Optional initial date-range filter value. Defaults to the
     * "Last 30 Days" preset — same default the Add-on Service e-Invoices
     * page uses so every Payment list page boots with consistent chrome.
     */
    initialDateRange?: DateRangeFilterValue;
    /**
     * Builds the detail-page route for a given row. When provided each list
     * row becomes a keyboard-accessible link to its detail page — required
     * for Sprint 2 Scheduled / Result pages per CLAUDE.md "Payment Detail
     * Page Rules". Pages without a detail (Exchange Rate Inquiry) omit it.
     */
    rowHref?: (row: Row) => string;
};

/**
 * Shared template for every Sprint 2 payment list page. Wraps `PageLayout`,
 * `PageHeader` (title + standard list/print/export action buttons), the
 * Approval-Box-style filter row (`DateRangePicker` + `SearchInput`), and the
 * `<DataTableShell>` body — so each page is a thin config that supplies
 * columns, rows, and totals.
 *
 * Visual contract is identical to Approval Box: same title typography, same
 * filter chrome, same `paginationWithTotals` shell, same `mt-auto` footer
 * anchor, same shared pagination. Page-specific look is only allowed via
 * column `render` functions (status badges, etc.).
 */
export default function PaymentListPage<Row extends { id: string }>({
    titleKey,
    columns,
    rows,
    totals,
    formatTotal,
    countLabelKey,
    minWidth,
    searchableFields,
    searchPlaceholder,
    footerMode = "paginationWithTotals",
    initialDateRange = DEFAULT_DATE_RANGE,
    rowHref,
}: PaymentListPageProps<Row>) {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState<DateRangeFilterValue>(initialDateRange);

    const filteredRows = useMemo(() => {
        if (!search.trim()) return rows;
        const q = search.trim().toLowerCase();
        const fields = searchableFields ?? (Object.keys(rows[0] ?? {}) as (keyof Row)[]);
        return rows.filter((row) =>
            fields
                .map((f) => {
                    const v = row[f];
                    return typeof v === "string" ? v : "";
                })
                .join(" ")
                .toLowerCase()
                .includes(q),
        );
    }, [rows, search, searchableFields]);

    const countLabel = t(countLabelKey, { count: String(filteredRows.length) });

    return (
        <PageLayout>
            <PageHeader title={t(titleKey)}>
                <PageActionButtons showList showPrint showExcel />
            </PageHeader>

            <FilterRow
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={searchPlaceholder}
            />

            {footerMode === "paginationWithTotals" ? (
                <DataTableShell
                    footerMode="paginationWithTotals"
                    table={
                        <PaymentListTable
                            columns={columns}
                            rows={filteredRows}
                            minWidth={minWidth}
                            rowHref={rowHref}
                        />
                    }
                    footer={
                        <PaymentListTableFooter
                            columns={columns}
                            countLabel={countLabel}
                            totals={totals}
                            formatTotal={formatTotal}
                            minWidth={minWidth}
                            className="mt-auto"
                        />
                    }
                    pagination={
                        <Pagination
                            page={1}
                            pageCount={Math.max(1, Math.ceil(filteredRows.length / 10))}
                            pageSize={10}
                            totalLabel={t("common.showing_of", {
                                shown: String(filteredRows.length),
                                total: String(filteredRows.length),
                            })}
                            className="shrink-0"
                        />
                    }
                />
            ) : (
                <DataTableShell
                    footerMode="paginationOnly"
                    table={
                        <PaymentListTable
                            columns={columns}
                            rows={filteredRows}
                            minWidth={minWidth}
                            rowHref={rowHref}
                        />
                    }
                    pagination={
                        <Pagination
                            page={1}
                            pageCount={Math.max(1, Math.ceil(filteredRows.length / 10))}
                            pageSize={10}
                            totalLabel={t("common.showing_of", {
                                shown: String(filteredRows.length),
                                total: String(filteredRows.length),
                            })}
                            className="shrink-0"
                        />
                    }
                />
            )}
        </PageLayout>
    );
}

function FilterRow({
    dateRange,
    onDateRangeChange,
    search,
    onSearchChange,
    searchPlaceholder,
    className,
}: {
    dateRange: DateRangeFilterValue;
    onDateRangeChange: (next: DateRangeFilterValue) => void;
    search: string;
    onSearchChange: (v: string) => void;
    searchPlaceholder?: string;
    className?: string;
}) {
    return (
        // `relative z-20` keeps the period dropdown's popover above the
        // sibling `<DataTableShell>` (the sticky `<thead>` would
        // otherwise clip the dropdown items).
        <div
            className={cn(
                "relative z-20 flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between",
                className,
            )}
        >
            <DateRangeFilter value={dateRange} onChange={onDateRangeChange} />
            <SearchInput
                value={search}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
            />
        </div>
    );
}
