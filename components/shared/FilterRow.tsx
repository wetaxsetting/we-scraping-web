"use client";

import { cn } from "@/lib/utils";

type FilterRowProps = {
    /** Left-aligned controls (dropdowns, date pickers). */
    children: React.ReactNode;
    /** Right-aligned control slot — typically <SearchInput>. */
    right?: React.ReactNode;
    className?: string;
};

/**
 * Shared filter row layout — stacks below md, single row md+. Enforces the
 * left-children / right-slot split used across every data-table page so the
 * search input always sits on the right edge and the dropdowns cluster left.
 */
export default function FilterRow({ children, right, className }: FilterRowProps) {
    return (
        <div
            className={cn(
                "flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between",
                className,
            )}
        >
            <div className="flex flex-wrap items-center gap-2">{children}</div>
            {right}
        </div>
    );
}
