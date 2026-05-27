"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Footer mode vocabulary for every paginated list/search page in the app.
 *
 * - `paginationOnly` — pagination at the bottom, no totals row. Use when the
 *   Figma design has pagination but no summary (e.g. Operation Status
 *   Inquiry).
 * - `paginationWithTotals` — pagination at the bottom plus a sibling footer
 *   `<table>` with one or more total rows that share the main table's
 *   `<colgroup>` (e.g. Transaction History, Sales / Expenses e-Invoices,
 *   Internal Transfer pages).
 * - `paginationWithStickyFooter` — free-form summary footer rendered INSIDE
 *   the table's visual frame, anchored at the bottom of the scroll container
 *   via `position: sticky`. Stays pinned to the viewport width when the
 *   table pans horizontally — so the doc count + currency totals never
 *   slide off-screen. Use for Approval Box where the totals don't need
 *   column alignment.
 *
 * Report pages (Daily Cash, Daily Financial, Cash Flow) are the third UI
 * mode — `noPaginationReport`. They MUST NOT render pagination and MUST use
 * `<ReportLayout>` instead of this shell (see CLAUDE.md §7b). That mode is
 * intentionally absent from this union so a compile error surfaces if a
 * report is routed through `<DataTableShell>` by mistake.
 */
export type DataTableFooterMode =
    | "paginationOnly"
    | "paginationWithTotals"
    | "paginationWithStickyFooter";

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

type DataTableShellPaginationWithStickyFooterProps = {
    footerMode: "paginationWithStickyFooter";
    table: React.ReactNode;
    /**
     * Free-form summary footer rendered INSIDE the scroll container, pinned
     * to the bottom-left of the visible viewport via `position: sticky` +
     * JS-measured width. Stays at viewport width during horizontal pan so
     * the totals never slide sideways with the table body. Use only when
     * the footer is a count + currency totals bar that does NOT need column
     * alignment with the table body (e.g. Approval Box). For column-aligned
     * totals use `paginationWithTotals` per §7a.
     */
    footer: React.ReactNode;
    pagination: React.ReactNode;
    className?: string;
};

type DataTableShellProps =
    | DataTableShellPaginationOnlyProps
    | DataTableShellPaginationWithTotalsProps
    | DataTableShellPaginationWithStickyFooterProps;

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
 *  - `paginationOnly`             → pass `table` + `pagination`
 *  - `paginationWithTotals`       → pass `table` + `footer` + `pagination`
 *  - `paginationWithStickyFooter` → pass `table` + `footer` + `pagination`
 *
 * Banking report pages (§7b) must use `<ReportLayout>` instead — they never
 * render pagination.
 */
export default function DataTableShell(props: DataTableShellProps) {
    if (props.footerMode === "paginationWithStickyFooter") {
        return <StickyFooterShell {...props} />;
    }

    const { table, pagination, className } = props;
    const scrollFooter =
        props.footerMode === "paginationWithTotals" ? props.footer : null;

    return (
        <div className={cn("flex min-h-0 flex-1 flex-col gap-3 pb-3", className)}>
            {/* One shared scroll container wraps the table AND (when used) the
               column-aligned footer so they scroll together both vertically and
               horizontally. The inner `flex min-h-full flex-col` + `mt-auto` on
               the footer keeps the summary row anchored at the bottom of the
               viewport when rows are short — the approach §7a exists to enforce. */}
            <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
                <div className="flex min-h-full flex-col">
                    {table}
                    {scrollFooter}
                </div>
            </div>

            {pagination}
        </div>
    );
}

/**
 * Sticky-footer variant. The summary bar lives inside the scroll container
 * — so visually it sits at the bottom of the table's frame — but
 * `position: sticky; bottom: 0; left: 0` + a JS-measured viewport width
 * keep it pinned to the visible viewport bounds when the user pans the
 * wide table horizontally. `mt-auto` inside a `min-h-full` flex column
 * pushes it to the bottom of the viewport even when the table has few
 * rows. Z-index sits above the sticky `<thead>` so the bar always paints
 * over the table when both share the bottom edge.
 */
function StickyFooterShell({
    table,
    footer,
    pagination,
    className,
}: Omit<DataTableShellPaginationWithStickyFooterProps, "footerMode">) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [viewportWidth, setViewportWidth] = useState<number | null>(null);
    const [contentWidth, setContentWidth] = useState<number | null>(null);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const update = () => {
            setViewportWidth(el.clientWidth);
            // scrollWidth = full content width including the horizontally-
            // overflowing portion. This is the width the outer wrapper
            // needs so its border-top extends across the entire table,
            // not just the visible viewport.
            setContentWidth(el.scrollWidth);
        };
        update();
        const containerObserver = new ResizeObserver(update);
        containerObserver.observe(el);
        // Observe every direct descendant too — the table's natural width
        // can change when columns reflow, and that won't trigger a resize
        // on the scroll container itself.
        const contentObserver = new ResizeObserver(update);
        Array.from(el.querySelectorAll<HTMLElement>(":scope > *")).forEach(
            (child) => contentObserver.observe(child),
        );
        return () => {
            containerObserver.disconnect();
            contentObserver.disconnect();
        };
    }, []);

    return (
        <div className={cn("flex min-h-0 flex-1 flex-col gap-3 pb-3", className)}>
            <div
                ref={scrollRef}
                className="custom-scrollbar min-h-0 flex-1 overflow-auto"
            >
                <div className="flex min-h-full flex-col">
                    <div className="flex-1">{table}</div>
                    {/* Two-layer footer:
                       - OUTER spans the full scroll content width (= the
                         wide table's width, measured via scrollWidth) and
                         carries the top-border so the horizontal line
                         extends edge-to-edge of the table — no gap on the
                         right when the table is wider than the viewport.
                       - INNER is the actual totals bar, sticky-positioned
                         at the visible viewport's left edge with a
                         clientWidth-sized width so the doc count + totals
                         never slide off-screen during horizontal pan. */}
                    <div
                        className="sticky bottom-0 z-20 border-t border-wb-table-border bg-white"
                        style={
                            contentWidth != null
                                ? { width: contentWidth }
                                : { width: "100%" }
                        }
                    >
                        <div
                            className="sticky left-0"
                            style={
                                viewportWidth != null
                                    ? { width: viewportWidth }
                                    : undefined
                            }
                        >
                            {footer}
                        </div>
                    </div>
                </div>
            </div>

            {pagination}
        </div>
    );
}
