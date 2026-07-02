"use client";

import { useEffect, useRef, useState } from "react";

import CalendarIconButton from "@/components/shared/CalendarIconButton";
import FilterDropdown from "@/components/shared/FilterDropdown";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The three day-window presets supported by every filter row using
 *  {@code <DateRangeFilter>}. The dropdown additionally exposes an
 *  "Enter Manually" entry that flips the component into manual mode. */
export type DateRangeFilterPreset =
    | "last_30_days"
    | "last_90_days"
    | "last_180_days";

export const DATE_RANGE_FILTER_PRESETS: readonly DateRangeFilterPreset[] = [
    "last_30_days",
    "last_90_days",
    "last_180_days",
];

/** Day span each preset covers. */
const PRESET_DAY_SPAN: Record<DateRangeFilterPreset, number> = {
    last_30_days: 30,
    last_90_days: 90,
    last_180_days: 180,
};

/** ISO {@code YYYY-MM-DD} for a {@link Date}. */
function toIsoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Default {@code start}/{@code end} ISO window seeded into the manual chips
 * when the user flips from a preset to manual mode. Rolls back {@code span}
 * days from today ({@code today − span … today}) — the same window every
 * shared consumer computes for its preset (Approval Box, e-Invoices, ERP
 * Transaction History, the batch payment lists). Consumers whose preset
 * window uses a different span (e.g. Card Transactions' inclusive
 * {@code today − (span − 1)}) pass a {@code manualSeed} override so the
 * manual range matches the exact API window the preset was already sending —
 * never a today-only collapse.
 */
function defaultManualSeed(preset: DateRangeFilterPreset): { start: string; end: string } {
    const span = PRESET_DAY_SPAN[preset];
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - span);
    return { start: toIsoDate(start), end: toIsoDate(end) };
}

/**
 * Controlled value for {@code <DateRangeFilter>}. The parent owns the
 * full object; the component never mutates it.
 *
 * <p>{@code preset} is kept across mode toggles so the dropdown can
 * remember the last preset if the parent flips the mode back to
 * {@code "preset"} (e.g. from a "Reset filters" affordance).
 *
 * <p>{@code start} / {@code end} are ISO {@code YYYY-MM-DD} — the
 * component formats them into chip strings via {@link formatDateChip}.
 */
export type DateRangeFilterValue = {
    /** {@code "preset"} → render the dropdown + calendar trigger.
     *  {@code "manual"} → render the start → end chip pair + calendar
     *  trigger (same shape Firm Banking History uses). */
    mode: "preset" | "manual";
    /** Currently-selected preset. Always one of the three day-window
     *  presets — never the "enter_manually" sentinel. */
    preset: DateRangeFilterPreset;
    /** ISO {@code YYYY-MM-DD} start date — only displayed when
     *  {@code mode === "manual"}. */
    start: string;
    /** ISO {@code YYYY-MM-DD} end date — only displayed when
     *  {@code mode === "manual"}. */
    end: string;
};

type DateRangeFilterProps = {
    value: DateRangeFilterValue;
    onChange: (value: DateRangeFilterValue) => void;
    /** Optional className applied to the outer wrapper (which is the
     *  {@code <DateRangePicker>}'s wrapper in manual mode and the
     *  {@code flex items-center gap-2} row in preset mode). */
    className?: string;
    /** Override the dropdown trigger width. Defaults to {@code w-[160px]}. */
    presetClassName?: string;
    /**
     * Optional chip formatter forwarded to the manual-mode start/end
     * chips. Defaults to the locale-independent {@code DD MMM YYYY} (the
     * legacy Figma chip). Payment filter rows pass a language-dependent
     * formatter ({@code formatIsoDateByLanguage}) so the picked range
     * follows the active locale (EN dd-MMM-yyyy / KO yyyy-MM-dd / VI
     * dd-MM-yyyy) and matches the Payment table Date columns. Other modules
     * omit it and keep the locale-independent default.
     */
    formatValue?: (iso: string) => string;
    /**
     * Override the {@code start}/{@code end} window seeded into the manual
     * chips when the user switches from a preset to manual mode (via the
     * dropdown's "Enter Manually" row or the trailing calendar trigger).
     * Defaults to {@link defaultManualSeed} ({@code today − span … today}).
     * Pass a page-specific function when the consumer's preset window uses a
     * different span so the opened manual range matches the API window the
     * preset was sending (Card Transactions passes its inclusive
     * {@code today − (span − 1)} seed).
     */
    manualSeed?: (preset: DateRangeFilterPreset) => { start: string; end: string };
};

/**
 * Shared period / date-range filter — the canonical filter-row date
 * control across Settings panels and any future page that needs a
 * "Last N Days · Enter Manually" period chip.
 *
 * <p>Two modes, one component:
 *
 * <ul>
 *   <li><b>Preset</b> — dropdown ("Last 30 Days" / "Last 90 Days" /
 *       "Last 180 Days" / "Enter Manually") followed by a calendar
 *       trigger. Picking any of the three day-window presets stays in
 *       preset mode; picking "Enter Manually" or clicking the trailing
 *       calendar trigger flips the component into manual mode.</li>
 *
 *   <li><b>Manual</b> — start chip → arrow → end chip + calendar
 *       trigger. Mirrors {@code <DateRangePicker>} so manual entry
 *       looks identical to the Firm Banking History panel.</li>
 * </ul>
 *
 * <p>The component is purely controlled — the parent owns the
 * {@link DateRangeFilterValue} and decides how to translate
 * {@code preset} into a real date range when filtering data. The
 * static UI does not yet wire a real day-picker; the calendar trigger
 * inside the manual chips is currently a no-op (same as
 * {@code <DateRangePicker>} elsewhere). When the picker pop-up lands,
 * extend this component — pages must not roll their own.
 */
export default function DateRangeFilter({
    value,
    onChange,
    className,
    presetClassName,
    formatValue,
    manualSeed,
}: DateRangeFilterProps) {
    if (value.mode === "manual") {
        return (
            <div className={className}>
                <InteractiveDateRangePicker
                    startIso={value.start}
                    endIso={value.end}
                    onChange={({ start, end }) =>
                        onChange({ ...value, mode: "manual", start, end })
                    }
                    formatValue={formatValue}
                />
            </div>
        );
    }

    /* Flip preset → manual. Seed the chips from the active preset window
     * (via the consumer's `manualSeed` or the shared default) so the picker
     * opens on the same range the preset was already sending — never a
     * today-only collapse. */
    const switchToManual = () => {
        const { start, end } = (manualSeed ?? defaultManualSeed)(value.preset);
        onChange({ ...value, mode: "manual", start, end });
    };

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <PresetDropdown
                value={value.preset}
                onPresetChange={(preset) =>
                    onChange({ ...value, mode: "preset", preset })
                }
                onPickManual={switchToManual}
                className={presetClassName}
            />
            <CalendarIconButton onClick={switchToManual} />
        </div>
    );
}

function PresetDropdown({
    value,
    onPresetChange,
    onPickManual,
    className,
}: {
    value: DateRangeFilterPreset;
    onPresetChange: (preset: DateRangeFilterPreset) => void;
    onPickManual: () => void;
    className?: string;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={ref} className={cn("relative w-[160px]", className)}>
            <FilterDropdown
                value={t(`date_range_filter.${value}`)}
                onClick={() => setOpen((o) => !o)}
                ariaLabel={t("date_range_filter.aria")}
                className="w-full"
            />
            {open && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                >
                    {DATE_RANGE_FILTER_PRESETS.map((opt) => (
                        <li
                            key={opt}
                            role="option"
                            aria-selected={opt === value}
                            onClick={() => {
                                onPresetChange(opt);
                                setOpen(false);
                            }}
                            className={cn(
                                "cursor-pointer whitespace-nowrap px-3 py-1.5 text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-active",
                                opt === value && "bg-wb-bg-active",
                            )}
                        >
                            {t(`date_range_filter.${opt}`)}
                        </li>
                    ))}
                    <li
                        role="option"
                        aria-selected={false}
                        onClick={() => {
                            onPickManual();
                            setOpen(false);
                        }}
                        className="cursor-pointer whitespace-nowrap px-3 py-1.5 text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-active"
                    >
                        {t("date_range_filter.enter_manually")}
                    </li>
                </ul>
            )}
        </div>
    );
}
