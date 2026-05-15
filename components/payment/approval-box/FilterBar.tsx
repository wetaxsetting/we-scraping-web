"use client";

import { useState } from "react";

import CalendarIconButton from "@/components/shared/CalendarIconButton";
import DateRangePopover from "@/components/shared/DateRangePopover";
import SearchInput from "@/components/shared/SearchInput";
import PaymentPeriodDropdown, {
    type ManualDateRange,
    type PeriodKey,
} from "@/components/payment/shared/PaymentPeriodDropdown";
import { cn } from "@/lib/utils";

type FilterBarProps = {
    /** Period preset OR `"manual"`. */
    period: PeriodKey;
    onPeriodChange: (period: PeriodKey) => void;
    /** Manual range (yyyymmdd) committed via the dropdown's popover. */
    manualRange?: ManualDateRange;
    onManualRangeChange?: (range: ManualDateRange) => void;
    /** ISO `YYYY-MM-DD` start date (for the dual-month popover seed). */
    startDateIso: string;
    /** ISO `YYYY-MM-DD` end date (for the dual-month popover seed). */
    endDateIso: string;
    search: string;
    onSearchChange?: (value: string) => void;
    className?: string;
};

/**
 * Approval Box filter row — mirrors legacy `resl_0001_001_view_osmc.jsp`:
 * period dropdown (Last 30/90/180 Days + Enter Manually) on the left,
 * calendar icon next to it, search input on the right. Wraps to two
 * lines below `md`.
 *
 * <p>The calendar icon opens the shared dual-month
 * {@link DateRangePopover} (Figma 123:4630) — preset chips + two
 * side-by-side calendars + Cancel / Apply. Apply commits the chosen
 * range as a manual period (flips {@code period} to `"manual"` and
 * writes the yyyymmdd pair into {@code manualRange}).
 */
export default function FilterBar({
    period,
    onPeriodChange,
    manualRange,
    onManualRangeChange,
    startDateIso,
    endDateIso,
    search,
    onSearchChange,
    className,
}: FilterBarProps) {
    const [rangeOpen, setRangeOpen] = useState(false);

    return (
        // `relative z-20` keeps the period dropdown and the dual-month
        // calendar popover above the sibling `<DataTableShell>` (the
        // sticky `<thead>` would otherwise clip the dropdown items —
        // same fix as the Payment shells' `ScheduledToolbar`).
        <div
            className={cn(
                "relative z-20 flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between",
                className,
            )}
        >
            <div className="flex flex-wrap items-center gap-2">
                <PaymentPeriodDropdown
                    period={period}
                    onPeriodChange={onPeriodChange}
                    manualRange={manualRange}
                    onManualRangeChange={onManualRangeChange}
                />
                <div className="relative">
                    <CalendarIconButton onClick={() => setRangeOpen((v) => !v)} />
                    {rangeOpen && (
                        <DateRangePopover
                            start={startDateIso}
                            end={endDateIso}
                            onApply={(range) => {
                                onManualRangeChange?.({
                                    fromDate: range.start.replace(/-/g, ""),
                                    toDate:   range.end.replace(/-/g, ""),
                                });
                                onPeriodChange("manual");
                                setRangeOpen(false);
                            }}
                            onClose={() => setRangeOpen(false)}
                        />
                    )}
                </div>
            </div>
            <SearchInput value={search} onChange={(v) => onSearchChange?.(v)} />
        </div>
    );
}
