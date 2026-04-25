"use client";

import { cn } from "@/lib/utils";

/**
 * Footer mode vocabulary for every paginated list/search page in the app.
 *
 * - `paginationOnly` — pagination at the bottom, no totals row. Use when the
 *   Figma design has pagination but no summary (e.g. Operation Status
 *   Inquiry).
 * - `paginationWithTotals` — pagination at the bottom plus a sibling footer
 *   `<table>` with one or more total rows that share the main table's
 *   `<colgroup>` (e.g. Approval Box, Transaction History, Sales / Expenses
 *   e-Invoices, Internal Transfer pages).
 *
 * Report pages (Daily Cash, Daily Financial, Cash Flow) are the third UI
 * mode — `noPaginationReport`. They MUST NOT render pagination and MUST use
 * `<ReportLayout>` instead of this shell (see CLAUDE.md §7b). That mode is
 * intentionally absent from this union so a compile error surfaces if a
 * report is routed through `<DataTableShell>` by mistake.
 */
export type DataTableFooterMode = "paginationOnly" | "paginationWithTotals";

type DataTableShellPaginationOnlyProps = {
    footerMode: "paginationOnly";
    table: React.ReactNode;
    pagination: React.ReactNode;
    /**
     * Must be omitted for `paginationOnly`. The discriminated union below
     * prevents passing a footer in this mode — if the page has totals, switch
     * `footerMode` to `paginationWithTotals` instead of slipping the footer
     * in on the side.
     */
    footer?: never;
    className?: string;
};

type DataTableShellPaginationWithTotalsProps = {
    footerMode: "paginationWithTotals";
    table: React.ReactNode;
    /** Sibling footer `<table>` (via <DataTableFooter> / feature footer). */
    footer: React.ReactNode;
    pagination: React.ReactNode;
    className?: string;
};

type DataTableShellProps =
    | DataTableShellPaginationOnlyProps
    | DataTableShellPaginationWithTotalsProps;

/**
 * Canonical paginated-list table shell (CLAUDE.md §7a) — the bottom block
 * every data-table page uses (Banking Transaction History / Internal
 * Transfer, Payment Approval Box, Add-on e-Invoices / Operation Status
 * Inquiry).
 *
 * Owns the outer flex stack, the shared scroll container, the `mt-auto`
 * footer anchor, and the pagination slot — so pages cannot accidentally
 * drift from the layout and no page re-implements these wrappers.
 *
 * Callers MUST declare intent via `footerMode` (see `DataTableFooterMode`):
 *  - `paginationOnly`        → pass `table` + `pagination`
 *  - `paginationWithTotals`  → pass `table` + `footer` + `pagination`
 *
 * Banking report pages (§7b) must use `<ReportLayout>` instead — they never
 * render pagination.
 */
export default function DataTableShell(props: DataTableShellProps) {
    const { table, pagination, className } = props;
    const footer = props.footerMode === "paginationWithTotals" ? props.footer : null;

    return (
        <div className={cn("flex min-h-0 flex-1 flex-col gap-3 pb-3", className)}>
            {/* One shared scroll container wraps the table AND the footer so they
               scroll together both vertically and horizontally. The inner
               `flex min-h-full flex-col` + `mt-auto` on the footer keeps the
               summary row anchored at the bottom of the viewport when rows
               are short — the approach §7a exists to enforce. */}
            <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
                <div className="flex min-h-full flex-col">
                    {table}
                    {footer}
                </div>
            </div>

            {pagination}
        </div>
    );
}
