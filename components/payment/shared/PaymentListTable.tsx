"use client";

import { useRouter } from "next/navigation";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { PaymentListColumn } from "./types";

type SortDirection = "ASC" | "DESC" | null;

type PaymentListTableProps<Row extends { id: string }> = {
    columns: PaymentListColumn<Row>[];
    rows: Row[];
    /**
     * Min-width of the table — must match the sibling footer's `minWidth` so
     * both tables scroll horizontally in lockstep inside `<DataTableShell>`.
     */
    minWidth: string;
    /**
     * Builds the detail-page route for a given row. When provided, every row
     * becomes a keyboard-accessible link: clicking or pressing Enter/Space
     * pushes the route. Hovering prefetches the destination.
     *
     * Omit on read-only screens (e.g. Exchange Rate Inquiry has no detail).
     */
    rowHref?: (row: Row) => string;
    /**
     * Optional per-row Tailwind class string — used for row-level highlights
     * (e.g. amber background for rows with an assigned Reporting Account per
     * Figma 8:599). Returns `undefined` / empty string to apply no extra class.
     */
    getRowClass?: (row: Row) => string | undefined;
    /**
     * Sort state — when set, sortable columns render the WeCMS sort glyph
     * and the click handler cycles via {@code onSort}. The parent component
     * owns the {@code useTableSort} hook so the same cycle can be reused
     * across search / pagination resets.
     */
    sort?: { field: string | null; direction: SortDirection };
    onSort?: (fieldId: string) => void;
    className?: string;
};

/**
 * Generic payment list table. Same visual contract as Approval Box's
 * `ApprovalTable`: bare `<table>` with a `<colgroup>` so the sibling footer
 * row can share column widths, sticky `<thead>` with the WeCMS sort glyph,
 * `text-wb-13 font-medium text-wb-ink` body cells.
 *
 * When `rowHref` is supplied each `<tr>` is keyboard-navigable (`role="link"`,
 * Enter/Space → `router.push`) and the cursor switches to pointer — the
 * canonical pattern for Payment list → detail navigation per CLAUDE.md
 * "Payment Detail Page Rules".
 */
export default function PaymentListTable<Row extends { id: string }>({
    columns,
    rows,
    minWidth,
    rowHref,
    getRowClass,
    sort,
    onSort,
    className,
}: PaymentListTableProps<Row>) {
    const router = useRouter();

    return (
        <table
            className={cn("w-full table-fixed border-collapse", className)}
            style={{ minWidth }}
        >
            <colgroup>
                {columns.map((c) => (
                    <col key={c.key} style={{ width: c.width }} />
                ))}
            </colgroup>
            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    {columns.map((c) => {
                        const wired = c.sortable && sort && onSort;
                        return (
                            <TableHeaderCell
                                key={c.key}
                                textSizeClass="text-wb-13"
                                align={c.align === "right" ? "right" : "left"}
                                // `sortable={wired}` so non-wired columns render
                                // a static label without the sort glyph. Without
                                // this, every header drew the chevron even when
                                // the page didn't enable sort (visible on
                                // Overseas Result detail among others).
                                sortable={!!wired}
                                {...(wired
                                    ? {
                                          sortFieldId: c.key,
                                          activeSortField: sort.field,
                                          activeSortDirection: sort.direction,
                                          onSort,
                                      }
                                    : {})}
                            >
                                {c.label}
                            </TableHeaderCell>
                        );
                    })}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => {
                    const href = rowHref?.(row);
                    const linkProps = href
                        ? {
                            role: "link" as const,
                            tabIndex: 0,
                            onClick: () => router.push(href),
                            onMouseEnter: () => router.prefetch(href),
                            onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    router.push(href);
                                }
                            },
                        }
                        : {};
                    return (
                        <TableRow
                            key={row.id}
                            {...linkProps}
                            className={cn(
                                "h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0",
                                href && "cursor-pointer hover:bg-wb-bg-active",
                                getRowClass?.(row),
                            )}
                        >
                            {columns.map((c) => {
                                const content = c.render
                                    ? c.render(row)
                                    : (row as Record<string, unknown>)[c.key];
                                return (
                                    <TableCell
                                        key={c.key}
                                        className={cn(
                                            "px-2.5 py-2.5",
                                            c.align === "right" && "text-right",
                                            c.align === "center" && "text-center",
                                            c.cellClassName,
                                        )}
                                    >
                                        {c.render ? (
                                            (content as React.ReactNode)
                                        ) : (
                                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                                {content as React.ReactNode}
                                            </span>
                                        )}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    );
                })}
            </TableBody>
        </table>
    );
}
