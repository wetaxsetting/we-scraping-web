"use client";

import { cn } from "@/lib/utils";

import CalendarIconButton from "./CalendarIconButton";

type DateRangePickerProps = {
    start: string;
    end: string;
    onChange?: (range: { start: string; end: string }) => void;
    /** When true, renders a single date chip without the arrow + end chip. */
    singleDate?: boolean;
    className?: string;
};

/**
 * Shared date range picker trigger — UI-only display that mirrors the Figma
 * "start → end + calendar" pattern. Wiring a real popover picker can slot in
 * later without changing the surrounding layout.
 *
 * Reused by every filter row that has a date range (Approval Box, Sales
 * e-Invoices, Transaction History, Reports, …). The single-date variant is
 * used by Account Inquiry which only inquires against a single snapshot date.
 *
 * The trailing calendar trigger is the shared <CalendarIconButton> — the
 * same component every other filter row uses. Do not inline a calendar
 * `<button>`/`<img>` here.
 */
export default function DateRangePicker({
    start,
    end,
    singleDate = false,
    className,
}: DateRangePickerProps) {
    return (
        <div className={cn("flex items-center gap-2", className)}>
            <DateChip value={start} />
            {!singleDate && (
                <>
                    <span
                        aria-hidden
                        className="text-wb-14-tight font-medium text-black"
                    >
                        →
                    </span>
                    <DateChip value={end} />
                </>
            )}
            <CalendarIconButton />
        </div>
    );
}

function DateChip({ value }: { value: string }) {
    return (
        <div className="flex h-[var(--h-wb-filter-btn)] items-center gap-2 overflow-clip rounded-md bg-white p-2 shadow-wb-btn">
            <span className="whitespace-nowrap text-wb-14-tight font-medium text-wb-ntrl-8">
                {value}
            </span>
        </div>
    );
}
