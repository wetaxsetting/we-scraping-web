"use client";

import { cn } from "@/lib/utils";

type FilterDropdownProps = {
    /** Visible trigger label. */
    value: string;
    /** Callback fired when the trigger is clicked. UI-only for now. */
    onClick?: () => void;
    /** ARIA label for assistive tech when the visible `value` isn't enough. */
    ariaLabel?: string;
    /** Explicit width utility (e.g. `w-[var(--w-wb-filter-bank)]`). */
    className?: string;
    /** Hide the trailing chevron glyph (used when the control is read-only). */
    hideChevron?: boolean;
    /** Optional icon element to render before the text label. */
    prefixIcon?: React.ReactNode;
};

/**
 * Unified filter-row dropdown trigger. Same 32px height, same raised-card
 * shadow (`shadow-wb-btn`), same 14-tight label typography across every page
 * (Banking, Payment, Add-on). Swaps in for the bespoke "All Banks" dropdown
 * on AccountInquiry and the InvoiceStatusFilter on Sales e-Invoices so new
 * filter controls inherit the same look without per-page re-implementation.
 */
export default function FilterDropdown({
    value,
    onClick,
    ariaLabel,
    className,
    hideChevron = false,
    prefixIcon,
}: FilterDropdownProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel ?? value}
            className={cn(
                "flex h-[var(--h-wb-filter-btn)] shrink-0 cursor-pointer items-center justify-between gap-2 overflow-clip rounded-md bg-white px-2 shadow-wb-btn",
                className,
            )}
        >
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {prefixIcon && <div className="shrink-0">{prefixIcon}</div>}
                <span className="truncate text-left text-wb-14-tight font-medium text-wb-ntrl-8">
                    {value}
                </span>
            </div>
            {!hideChevron && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src="/assets/pagination/ico-dropdown-chevron.svg"
                    alt=""
                    aria-hidden
                    className="size-4 shrink-0"
                />
            )}
        </button>
    );
}
