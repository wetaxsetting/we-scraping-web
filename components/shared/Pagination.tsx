"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type PageSize = number;

/**
 * Canonical page-size options for every paginated list/search page in the
 * app. Mirrors the legacy JEX `#PAGE_SIZE` select-box set, with `10`
 * substituted for the legacy `15` so the static UI default produces a
 * round-number "10 of N" count. New pages should consume this constant
 * — never hardcode a per-page list.
 */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

/**
 * Shared pagination state hook — single source of truth for the
 * `page` / `pageSize` / `paged` triplet used by every list page that
 * paginates client-side.
 *
 * Keeps the math (clamp page to `pageCount`, slice items, reset page on
 * size change) in one place so individual pages don't reimplement it.
 * Filter-change resets are the caller's responsibility — filters live
 * outside this hook, so pages call {@link UsePaginationResult.resetPage}
 * from their own bank / search / date `onChange` handlers.
 *
 * The optional `onPageSizeChange` fires AFTER the size is committed, so
 * pages can react to a size change without subscribing to a separate
 * effect (typical use: clear row selection — matches the legacy
 * `$('#checkbox-all').prop('checked', false)` reset on every reload).
 */
export type UsePaginationOptions<T> = {
    items: T[];
    /** Default page size. Defaults to 10 (the smallest option). */
    initialPageSize?: number;
    /** Fires after a page-size change is committed. */
    onPageSizeChange?: () => void;
};

export type UsePaginationResult<T> = {
    page: number;
    pageSize: number;
    pageCount: number;
    paged: T[];
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
    resetPage: () => void;
    /** Convenience tuple for the `common.showing_of` translation key. */
    counts: { shown: number; total: number };
};

export function usePagination<T>({
    items,
    initialPageSize = PAGE_SIZE_OPTIONS[0],
    onPageSizeChange,
}: UsePaginationOptions<T>): UsePaginationResult<T> {
    const [page, setPageState] = useState(1);
    const [pageSize, setPageSizeState] = useState<number>(initialPageSize);

    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(Math.max(1, page), pageCount);
    const paged = items.slice((safePage - 1) * pageSize, safePage * pageSize);

    const setPage = (next: number) => {
        const clamped = Math.max(1, Math.min(pageCount, next));
        setPageState(clamped);
    };
    const setPageSize = (size: number) => {
        setPageSizeState(size);
        setPageState(1);
        onPageSizeChange?.();
    };
    const resetPage = () => setPageState(1);

    return {
        page: safePage,
        pageSize,
        pageCount,
        paged,
        setPage,
        setPageSize,
        resetPage,
        counts: { shown: paged.length, total: items.length },
    };
}

type PaginationProps = {
    page: number;
    pageCount: number;
    pageSize: PageSize;
    totalLabel?: string;
    className?: string;
    /**
     * When `true`, render nothing. Lets pages conditionally hide pagination
     * (e.g. a variant that shows all rows) without adding a ternary around
     * every call site. Report pages must NOT use this — use `<ReportLayout>`
     * instead per CLAUDE.md §7b.
     */
    hidden?: boolean;
    /**
     * Optional handlers — when omitted the component stays visually
     * identical but the buttons are inert (preserves the existing
     * static-shell behaviour for pages that have not wired pagination
     * yet). When provided, arrow / page / size controls become functional.
     */
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    /** Page-size options surfaced in the dropdown popover. Defaults to {@link PAGE_SIZE_OPTIONS}. */
    pageSizeOptions?: readonly number[];
};

function Dropdown({
    value,
    className,
    options,
    onSelect,
}: {
    value: string;
    className?: string;
    options?: readonly number[];
    onSelect?: (size: number) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const interactive = !!options && !!onSelect;

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    const trigger = (
        <div
            className={cn(
                "flex h-8 items-center gap-2 overflow-clip rounded-md border border-wb-ntrl-4 bg-white px-2",
                interactive && "cursor-pointer",
                className,
            )}
            onClick={interactive ? () => setOpen((o) => !o) : undefined}
        >
            <span className="flex-1 truncate text-wb-13 font-medium text-wb-ink">
                {value}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/assets/pagination/ico-dropdown-chevron.svg"
                alt=""
                aria-hidden
                className="size-4 shrink-0 text-wb-ink"
            />
        </div>
    );

    if (!interactive) return trigger;

    return (
        <div ref={ref} className="relative">
            {trigger}
            {open && (
                <ul
                    className="absolute bottom-full left-0 z-20 mb-1 min-w-full overflow-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                    role="listbox"
                >
                    {options!.map((opt) => (
                        <li
                            key={opt}
                            role="option"
                            aria-selected={String(opt) === value}
                            className={cn(
                                "cursor-pointer px-2 py-1.5 text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-active",
                                String(opt) === value && "bg-wb-bg-active",
                            )}
                            onClick={() => {
                                onSelect!(opt);
                                setOpen(false);
                            }}
                        >
                            {opt}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function ArrowBtn({
    children,
    disabled = false,
    onClick,
    "aria-label": ariaLabel,
}: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    "aria-label"?: string;
}) {
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "flex size-7 items-center justify-center rounded-md border border-wb-ntrl-4 bg-white text-wb-ink hover:bg-neutral-50",
                !disabled && "cursor-pointer",
                disabled && "cursor-not-allowed opacity-40 hover:bg-white",
            )}
        >
            {children}
        </button>
    );
}

function PageBtn({
    children,
    active = false,
    onClick,
}: {
    children: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
}) {
    // Figma 9183:14965 (active) has a dark 1px border; inactive page numbers
    // (9183:14974 / 9183:14978) render as plain 13px text with no border.
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex size-7 cursor-pointer items-center justify-center rounded-md text-wb-13 text-wb-ink",
                active
                    ? "border border-wb-ink bg-white font-bold"
                    : "font-medium hover:text-brand",
            )}
        >
            {children}
        </button>
    );
}

export default function Pagination({
    page,
    pageCount,
    pageSize,
    totalLabel,
    className,
    hidden = false,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationProps) {
    if (hidden) return null;

    // Show up to 3 numeric buttons centered on current page
    const first = Math.max(1, Math.min(page - 1, Math.max(1, pageCount - 2)));
    const visible = Array.from(
        { length: Math.min(3, pageCount) },
        (_, i) => first + i,
    );

    const goto = (n: number) => {
        if (!onPageChange) return;
        const clamped = Math.max(1, Math.min(pageCount, n));
        if (clamped !== page) onPageChange(clamped);
    };

    return (
        // Compact 32px row at every breakpoint. On mobile (< md) the page-size
        // dropdown and "x of y" count are hidden per Figma 60:20238 — only the
        // arrow/number buttons render, centered horizontally. On md+ the
        // three-zone layout (left info / center buttons / right placeholder)
        // distributes via justify-between so the button group sits inward
        // from the right edge.
        <div
            className={cn(
                "flex h-8 items-center justify-center md:justify-between",
                className,
            )}
        >
            {/* Left: page size + count — desktop/tablet only (hidden on mobile per Figma) */}
            <div className="hidden items-center gap-2 md:flex">
                <Dropdown
                    value={String(pageSize)}
                    // Interactive dropdown widens to 80px so 3-digit values
                    // (`100`) fit alongside the chevron — the legacy 62px
                    // token only fits 2-digit defaults and was truncating
                    // to "1...". Inert callers keep the legacy width so
                    // other pages stay visually unchanged.
                    className={onPageSizeChange ? "w-20" : "w-[var(--w-wb-page-size)]"}
                    options={onPageSizeChange ? pageSizeOptions : undefined}
                    onSelect={onPageSizeChange}
                />
                {totalLabel && (
                    <span className="text-wb-13 font-medium text-wb-ink">{totalLabel}</span>
                )}
            </div>

            {/* Center: arrow + page buttons — Figma order is [prev] [first] [pages] [next] [last] */}
            <div className="flex items-center gap-2.5">
                <ArrowBtn aria-label="Previous page" disabled={page === 1} onClick={() => goto(page - 1)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/pagination/ico-arrow.svg"
                        alt=""
                        aria-hidden
                        className="size-4"
                    />
                </ArrowBtn>
                <ArrowBtn aria-label="First page" disabled={page === 1} onClick={() => goto(1)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/pagination/ico-skip-arrow.svg"
                        alt=""
                        aria-hidden
                        className="size-4 rotate-180"
                    />
                </ArrowBtn>
                {visible.map((n) => (
                    <PageBtn key={n} active={n === page} onClick={() => goto(n)}>
                        {n}
                    </PageBtn>
                ))}
                <ArrowBtn aria-label="Next page" disabled={page >= pageCount} onClick={() => goto(page + 1)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/pagination/ico-arrow.svg"
                        alt=""
                        aria-hidden
                        className="size-4 rotate-180"
                    />
                </ArrowBtn>
                <ArrowBtn aria-label="Last page" disabled={page >= pageCount} onClick={() => goto(pageCount)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/pagination/ico-skip-arrow.svg"
                        alt=""
                        aria-hidden
                        className="size-4"
                    />
                </ArrowBtn>
            </div>

            {/* Right placeholder — Figma 9183:14941 has three zones (left info,
               centered arrows, right slot). Keeping this empty placeholder lets
               the outer `justify-between` distribute three children so the arrow
               group sits inward from the right edge, matching the Figma layout. */}
            <div className="hidden items-center gap-2 md:flex" aria-hidden />
        </div>
    );
}
