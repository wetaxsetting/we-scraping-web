"use client";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type TableHeaderCellProps = {
    children: React.ReactNode;
    align?: "left" | "right";
    sortable?: boolean;
    className?: string;
};

/**
 * Unified sortable table header cell used across every data table in the app
 * (Banking, Payment, Add-on). Enforces the standard text-wb-14 / font-semibold
 * / text-wb-dark typography, the paired sort glyph, and the left/right align
 * rules documented in the Global UI Consistency Rules.
 *
 * Works inside either the shadcn `<Table>` wrapper or a bare `<table>` — both
 * render `<thead>` → `<tr>` → `<th>` at the DOM level.
 */
export default function TableHeaderCell({
    children,
    align = "left",
    sortable = true,
    className,
}: TableHeaderCellProps) {
    return (
        <TableHead
            className={cn(
                "py-3 align-middle",
                align === "left" ? "px-2.5 text-left" : "px-2.5 text-right",
                className,
            )}
        >
            <div
                className={cn(
                    "flex items-center gap-1",
                    align === "right" && "justify-end",
                )}
            >
                <span className="whitespace-nowrap text-wb-14 font-semibold text-wb-dark">
                    {children}
                </span>
                {sortable && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src="/assets/table/ico-sort.svg"
                        alt=""
                        aria-hidden
                        className="h-3 w-2 shrink-0"
                    />
                )}
            </div>
        </TableHead>
    );
}
