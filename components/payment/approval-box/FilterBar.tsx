"use client";

import SearchInput from "@/components/shared/SearchInput";
import { cn } from "@/lib/utils";

import DateRangePicker from "./DateRangePicker";

type FilterBarProps = {
    startDate: string;
    endDate: string;
    search: string;
    onSearchChange?: (value: string) => void;
    onDateChange?: (range: { start: string; end: string }) => void;
    className?: string;
};

/**
 * Approval Box filter row — mirrors Figma: left-aligned date-range picker,
 * right-aligned search input (230px). Wraps onto two lines below `md`.
 */
export default function FilterBar({
    startDate,
    endDate,
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
            <DateRangePicker start={startDate} end={endDate} onChange={onDateChange} />

            <SearchInput value={search} onChange={(v) => onSearchChange?.(v)} />
        </div>
    );
}
