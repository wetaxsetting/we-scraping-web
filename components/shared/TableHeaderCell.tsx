"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import type { SortDirection } from "@/hooks/useTableSort";
import { cn } from "@/lib/utils";

type TableHeaderCellProps = {
    children: React.ReactNode;
    align?: "left" | "right";
    /**
     * When `true` the column renders a sort glyph and (if a `sortFieldId`
     * + `onSort` are also provided) becomes clickable. Set `false` for
     * non-sortable columns (e.g. `SORT_YN === "N"`, special `CHECKBOX` /
     * `ETC` columns, or columns with no backing DB field).
     */
    sortable?: boolean;
    className?: string;
    /**
     * Override the header text-size token. Defaults to `text-wb-14` for
     * backward compatibility with the 15 existing data-table consumers.
     * New / migrated pages should pass `"text-wb-13"` to opt into the
     * 13px-standard documented in CLAUDE.md §5 (table typography).
     */
    textSizeClass?: string;
    /**
     * View Setting `FIELD_ID` this header represents (e.g. `BANK`,
     * `BALANCE`). Required for click-to-sort wiring; omitted on
     * non-sortable headers. The same key is forwarded to the backend
     * as `sortField` — the backend whitelist (e.g. `AccountSortField`)
     * resolves it against an entity property, never raw SQL.
     */
    sortFieldId?: string;
    /**
     * View Setting `FIELD_ID` currently driving the table-wide sort
     * state. Used to decide whether THIS header renders an active glyph
     * (matches `sortFieldId`) or the inactive default. Sourced from
     * `useTableSort()` once per page.
     */
    activeSortField?: string | null;
    /** Direction of the active sort (`ASC` / `DESC` / `null`). */
    activeSortDirection?: SortDirection;
    /**
     * Click handler — receives the header's own `sortFieldId`. Pass the
     * `toggleSort` returned from `useTableSort()`. Omitting this (or the
     * `sortFieldId`) downgrades the header to a non-clickable display
     * even when `sortable` is true — matches the legacy "icon visible
     * but inert" baseline used during the staged rollout.
     */
    onSort?: (fieldId: string) => void;
    /**
     * Optional trailing info affordance (e.g. a blocked-characters
     * `<BlockedCharsTooltip>`). Rendered AFTER the sort glyph so the
     * header reads **label → sort → info** (CLAUDE.md — Payment header
     * order). It sits OUTSIDE the clickable sort `<button>`, so hovering
     * or clicking the info icon never triggers a sort. On a non-sortable
     * header (no glyph) it simply follows the label (**label → info**),
     * preserving the legacy order for informational-only columns.
     */
    info?: React.ReactNode;
};

/**
 * Unified sortable table header cell used across every data table in the app
 * (Banking, Payment, Add-on). Enforces the font-weight (`font-semibold`),
 * colour (`text-wb-dark`), paired sort glyph, and the left/right align
 * rules documented in the Global UI Consistency Rules. The text-size
 * defaults to `text-wb-14` but can be overridden via {@link textSizeClass}.
 *
 * Sort wiring is opt-in via the `sortFieldId` + `activeSort*` + `onSort`
 * triplet — pages that haven't migrated to the common sort hook keep
 * rendering the static glyph as before. When wired, the glyph reflects
 * the current cycle (default → ASC → DESC → default) and the entire
 * header becomes a `button` for keyboard accessibility.
 *
 * Works inside either the shadcn `<Table>` wrapper or a bare `<table>` — both
 * render `<thead>` → `<tr>` → `<th>` at the DOM level.
 */
export default function TableHeaderCell({
    children,
    align = "left",
    sortable = true,
    className,
    textSizeClass = "text-wb-14",
    sortFieldId,
    activeSortField,
    activeSortDirection,
    onSort,
    info,
}: TableHeaderCellProps) {
    const clickable = sortable && !!sortFieldId && !!onSort;
    const isActive = !!sortFieldId && activeSortField === sortFieldId && activeSortDirection !== null;

    const handleClick = () => {
        if (clickable && sortFieldId) onSort(sortFieldId);
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (sortFieldId) onSort(sortFieldId);
        }
    };

    const glyph = sortable ? (
        isActive && activeSortDirection === "ASC" ? (
            <ChevronUp
                className="size-3.5 shrink-0 text-brand"
                strokeWidth={2.25}
                aria-hidden
            />
        ) : isActive && activeSortDirection === "DESC" ? (
            <ChevronDown
                className="size-3.5 shrink-0 text-brand"
                strokeWidth={2.25}
                aria-hidden
            />
        ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src="/assets/table/ico-sort.svg"
                alt=""
                aria-hidden
                className="h-3 w-2 shrink-0"
            />
        )
    ) : null;

    const inner = (
        <div
            className={cn(
                "flex items-center gap-1",
                align === "right" && "justify-end",
            )}
        >
            <span className={cn("whitespace-nowrap font-semibold text-wb-dark", textSizeClass)}>
                {children}
            </span>
            {glyph}
            {info}
        </div>
    );

    // Clickable sort target — label + glyph only. When a trailing `info`
    // affordance is present the button hugs its content (no `w-full`) so
    // the info icon can sit beside it as a non-sorting sibling; without
    // `info` the button fills the cell for the larger click target the
    // existing consumers rely on.
    const sortButton = (
        <button
            type="button"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={cn(
                "flex cursor-pointer select-none items-center gap-1 bg-transparent p-0 text-inherit",
                info ? undefined : "w-full",
                align === "right" && "justify-end",
            )}
        >
            <span className={cn("whitespace-nowrap font-semibold text-wb-dark", textSizeClass)}>
                {children}
            </span>
            {glyph}
        </button>
    );

    return (
        <TableHead
            className={cn(
                "overflow-hidden py-3 align-middle",
                align === "left" ? "px-2.5 text-left" : "px-2.5 text-right",
                className,
            )}
            aria-sort={
                isActive
                    ? activeSortDirection === "ASC"
                        ? "ascending"
                        : "descending"
                    : sortable
                        ? "none"
                        : undefined
            }
        >
            {clickable ? (
                info ? (
                    // Info icon lives OUTSIDE the sort button so hovering /
                    // clicking it never triggers a sort. Order: label → sort → info.
                    <div
                        className={cn(
                            "flex items-center gap-1",
                            align === "right" && "justify-end",
                        )}
                    >
                        {sortButton}
                        {info}
                    </div>
                ) : (
                    sortButton
                )
            ) : (
                inner
            )}
        </TableHead>
    );
}
