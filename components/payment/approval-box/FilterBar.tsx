"use client";

import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import SearchInput from "@/components/shared/SearchInput";
import { cn } from "@/lib/utils";

type FilterBarProps = {
    /** ISO `YYYY-MM-DD` start date. */
    startDateIso: string;
    /** ISO `YYYY-MM-DD` end date. */
    endDateIso: string;
    search: string;
    onSearchChange?: (value: string) => void;
    onDateChange?: (range: { start: string; end: string }) => void;
    className?: string;
};

/**
 * Approval Box filter row — mirrors Figma: left-aligned interactive
 * date-range picker (chip inputs + calendar-icon dual-month popover),
 * right-aligned search input (230px). Wraps onto two lines below `md`.
 */
export default function FilterBar({
    startDateIso,
    endDateIso,
    search,
    onSearchChange,
    onDateChange,
    className,
}: FilterBarProps) {
    return (
        <div
            className={cn(
                "flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between",
                className,
            )}
        >
            <InteractiveDateRangePicker
                startIso={startDateIso}
                endIso={endDateIso}
                onChange={(range) => onDateChange?.(range)}
            />

            <SearchInput value={search} onChange={(v) => onSearchChange?.(v)} />
        </div>
    );
}
