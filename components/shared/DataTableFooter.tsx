"use client";

import { cn } from "@/lib/utils";

type DataTableFooterProps = {
    /**
     * The shared `<colgroup>` element — same component the main table renders
     * — so column widths line up exactly. e.g. `<ApprovalTableColumns />`.
     */
    colgroup: React.ReactNode;
    /**
     * Matches the main table's `min-w-*` so both tables scroll in lockstep
     * inside the shared scroll container. Pass either a CSS length
     * ("1280px") or a CSS var token ("var(--w-wb-ap-table-min)").
     */
    minWidth?: string;
    /**
     * One or more `<tr>` elements rendered inside the `<tfoot>`. Callers own
     * the row shape (colspan distribution, label vs. totals, multi-currency
     * rows) because each feature has a different summary layout:
     *  - "total count only"                → a single `<tr>` with one spanning `<td>`
     *  - "total count + total amounts"     → one `<tr>` with label cell + amount cells
     *  - "multiple currency totals"        → multiple `<tr>` rows, one per currency
     *  - "column-aligned totals"           → caller sets colSpan to align values
     */
    children: React.ReactNode;
    className?: string;
};

/**
 * Sibling footer `<table>` that shares the main table's colgroup so column
 * widths match exactly. Kept as a sibling (not a `<tfoot>` inside the main
 * table) so `DataTableShell` can anchor it at the bottom of the scroll area
 * with `mt-auto` — the Approval Box canonical pattern (CLAUDE.md §7a).
 *
 * This component owns only the outer `<table>` / `<tfoot>` chrome. Callers
 * pass the `<tr>` content — each feature's summary shape is different
 * (multi-currency totals, single-row column-aligned totals, count-only, etc.)
 * and a single rigid shape would need more if/else than composition.
 */
export default function DataTableFooter({
    colgroup,
    minWidth,
    children,
    className,
}: DataTableFooterProps) {
    return (
        <table
            className={cn(
                "w-full table-fixed border-collapse border-t border-wb-table-border bg-white",
                className,
            )}
            style={minWidth ? { minWidth } : undefined}
        >
            {colgroup}
            <tfoot>{children}</tfoot>
        </table>
    );
}
