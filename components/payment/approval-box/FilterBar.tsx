"use client";

import DateRangeFilter, {
    type DateRangeFilterPreset,
    type DateRangeFilterValue,
} from "@/components/shared/DateRangeFilter";
import SearchInput from "@/components/shared/SearchInput";
import type {
    ManualDateRange,
    PeriodKey,
} from "@/components/payment/shared/PaymentPeriodDropdown";
import { cn } from "@/lib/utils";

type FilterBarProps = {
    /** Period preset OR `"manual"`. */
    period: PeriodKey;
    onPeriodChange: (period: PeriodKey) => void;
    /** Manual range (yyyymmdd) committed via the dropdown's popover. */
    manualRange?: ManualDateRange;
    onManualRangeChange?: (range: ManualDateRange) => void;
    /**
     * ISO `YYYY-MM-DD` seed dates retained for backward compatibility with
     * earlier callers; not consumed by the shared {@code <DateRangeFilter>}
     * which reads the start / end from the {@code manualRange} pair.
     */
    startDateIso?: string;
    endDateIso?:   string;
    search: string;
    onSearchChange?: (value: string) => void;
    className?: string;
};

/**
 * Approval Box filter row — period dropdown + calendar trigger on the
 * left, search input on the right. Wraps to two lines below `md`.
 *
 * <p>Period control is the shared {@link DateRangeFilter} — same chrome
 * used by Add-on Service > Sales / Expenses e-Invoices and by every
 * Payment Scheduled / Result list page. Preset mode renders the "Last
 * 30 / 90 / 180 Days · Enter Manually" dropdown plus the canonical
 * calendar trigger; manual mode swaps to the start ↔ end range chips.
 */
export default function FilterBar({
    period,
    onPeriodChange,
    manualRange,
    onManualRangeChange,
    search,
    onSearchChange,
    className,
}: FilterBarProps) {
    const value = periodToDateRangeFilterValue(period, manualRange);
    return (
        // `relative z-20` keeps the period dropdown's popover above the
        // sibling `<DataTableShell>` (the sticky `<thead>` would
        // otherwise clip the dropdown items — same fix as the Payment
        // shells' `ScheduledToolbar`).
        <div
            className={cn(
                "relative z-20 flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between",
                className,
            )}
        >
            <div className="flex flex-wrap items-center gap-2">
                <DateRangeFilter
                    value={value}
                    onChange={(next) => {
                        if (next.mode === "manual") {
                            if (onManualRangeChange && next.start && next.end) {
                                onManualRangeChange({
                                    fromDate: fromIso(next.start),
                                    toDate:   fromIso(next.end),
                                });
                            }
                            if (period !== "manual") onPeriodChange("manual");
                            return;
                        }
                        const nextPeriod = presetToPeriodKey(next.preset);
                        if (nextPeriod !== period) onPeriodChange(nextPeriod);
                    }}
                />
            </div>
            <SearchInput value={search} onChange={(v) => onSearchChange?.(v)} />
        </div>
    );
}

function periodToDateRangeFilterValue(
    period: PeriodKey,
    manualRange: ManualDateRange | undefined,
): DateRangeFilterValue {
    if (period === "manual") {
        return {
            mode:   "manual",
            preset: "last_30_days",
            start:  manualRange ? toIso(manualRange.fromDate) : "",
            end:    manualRange ? toIso(manualRange.toDate)   : "",
        };
    }
    return {
        mode:   "preset",
        preset: periodKeyToPreset(period),
        start:  "",
        end:    "",
    };
}

function periodKeyToPreset(period: Exclude<PeriodKey, "manual">): DateRangeFilterPreset {
    switch (period) {
        case "180d": return "last_180_days";
        case "90d":  return "last_90_days";
        case "30d":
        default:     return "last_30_days";
    }
}

function presetToPeriodKey(preset: DateRangeFilterPreset): PeriodKey {
    switch (preset) {
        case "last_180_days": return "180d";
        case "last_90_days":  return "90d";
        case "last_30_days":
        default:              return "30d";
    }
}

function toIso(raw: string): string {
    if (!raw || raw.length !== 8) return "";
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}
function fromIso(iso: string): string {
    if (!iso || iso.length !== 10) return "";
    return iso.replace(/-/g, "");
}
