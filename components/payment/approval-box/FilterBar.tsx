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
import { formatIsoDateByLanguage } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";
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
    const { locale } = useTranslation();
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
                            // When the user picks "Enter Manually" from
                            // the preset dropdown, `next.start` / `next.end`
                            // are empty (the preset adapter doesn't carry
                            // wire dates). Seed the manual range from the
                            // currently-active preset window so the chips
                            // open with meaningful values instead of empty
                            // ovals — and so the API immediately receives a
                            // real range. Subsequent chip edits go through
                            // the same callback with real `start` / `end`.
                            const seed =
                                next.start && next.end
                                    ? { fromDate: fromIso(next.start), toDate: fromIso(next.end) }
                                    : computePresetRangeYyyymmdd(period);
                            onManualRangeChange?.(seed);
                            if (period !== "manual") onPeriodChange("manual");
                            return;
                        }
                        const nextPeriod = presetToPeriodKey(next.preset);
                        if (nextPeriod !== period) onPeriodChange(nextPeriod);
                    }}
                    formatValue={(iso) => formatIsoDateByLanguage(iso, locale)}
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
        // Inconsistent state guard — if `period === "manual"` but the
        // caller never committed a `manualRange`, fall back to the
        // Last 30 Days preset window so the chips never render empty.
        // The onChange handler above seeds `manualRange` on the next
        // user interaction; this fallback just keeps the UI sane until
        // then.
        const range = manualRange ?? computePresetRangeYyyymmdd("30d");
        return {
            mode:   "manual",
            preset: "last_30_days",
            start:  toIso(range.fromDate),
            end:    toIso(range.toDate),
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

/** Resolve the `yyyymmdd` window for the active preset, anchored to
 *  today. Used to seed `manualRange` the first time the user clicks
 *  "Enter Manually" so the chips never open empty. Falls back to
 *  Last 30 Days when the period is already `"manual"` (shouldn't
 *  happen, but keeps the math total). */
function computePresetRangeYyyymmdd(period: PeriodKey): ManualDateRange {
    const days = period === "180d" ? 180 : period === "90d" ? 90 : 30;
    const fmt = (d: Date): string =>
        d.getFullYear().toString().padStart(4, "0") +
        (d.getMonth() + 1).toString().padStart(2, "0") +
        d.getDate().toString().padStart(2, "0");
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    return { fromDate: fmt(start), toDate: fmt(today) };
}
