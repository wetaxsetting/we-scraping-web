"use client";

import { cn } from "@/lib/utils";

export type PageSize = number;

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
};

function Dropdown({
    value,
    className,
}: {
    value: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex h-8 items-center gap-2 overflow-clip rounded-md border border-wb-ntrl-4 bg-white px-2",
                className,
            )}
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
}

function ArrowBtn({
    children,
    disabled = false,
    "aria-label": ariaLabel,
}: {
    children: React.ReactNode;
    disabled?: boolean;
    "aria-label"?: string;
}) {
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn(
                "flex size-7 items-center justify-center rounded-md border border-wb-ntrl-4 bg-white text-wb-ink hover:bg-neutral-50",
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
}: {
    children: React.ReactNode;
    active?: boolean;
}) {
    // Figma 9183:14965 (active) has a dark 1px border; inactive page numbers
    // (9183:14974 / 9183:14978) render as plain 13px text with no border.
    return (
        <button
            type="button"
            className={cn(
                "flex size-7 items-center justify-center rounded-md text-wb-13 text-wb-ink",
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
}: PaginationProps) {
    if (hidden) return null;

    // Show up to 3 numeric buttons centered on current page
    const first = Math.max(1, Math.min(page - 1, Math.max(1, pageCount - 2)));
    const visible = Array.from(
        { length: Math.min(3, pageCount) },
        (_, i) => first + i,
    );

    return (
        // Compact row: left (size + count) and right (page buttons) on the same 32px line.
        <div
            className={cn(
                "flex flex-col items-start gap-2 md:h-8 md:flex-row md:items-center md:justify-between",
                className,
            )}
        >
            {/* Left: page size + count */}
            <div className="flex items-center gap-2">
                <Dropdown value={String(pageSize)} className="w-[var(--w-wb-page-size)]" />
                {totalLabel && (
                    <span className="text-wb-13 font-medium text-wb-ink">{totalLabel}</span>
                )}
            </div>

            {/* Right: arrow + page buttons — Figma order is [prev] [first] [pages] [next] [last] */}
            <div className="flex items-center gap-2.5">
                <ArrowBtn aria-label="Previous page" disabled={page === 1}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/pagination/ico-arrow.svg"
                        alt=""
                        aria-hidden
                        className="size-4"
                    />
                </ArrowBtn>
                <ArrowBtn aria-label="First page" disabled={page === 1}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/pagination/ico-skip-arrow.svg"
                        alt=""
                        aria-hidden
                        className="size-4 rotate-180"
                    />
                </ArrowBtn>
                {visible.map((n) => (
                    <PageBtn key={n} active={n === page}>
                        {n}
                    </PageBtn>
                ))}
                <ArrowBtn aria-label="Next page" disabled={page >= pageCount}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/pagination/ico-arrow.svg"
                        alt=""
                        aria-hidden
                        className="size-4 rotate-180"
                    />
                </ArrowBtn>
                <ArrowBtn aria-label="Last page" disabled={page >= pageCount}>
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
