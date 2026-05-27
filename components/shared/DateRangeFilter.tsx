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
                />
            </div>
        );
    }

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <PresetDropdown
                value={value.preset}
                onPresetChange={(preset) =>
                    onChange({ ...value, mode: "preset", preset })
                }
                onPickManual={() => onChange({ ...value, mode: "manual" })}
                className={presetClassName}
            />
            <CalendarIconButton
                onClick={() => onChange({ ...value, mode: "manual" })}
            />
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
        <div ref={ref} className="relative">
            <FilterDropdown
                value={t(`date_range_filter.${value}`)}
                onClick={() => setOpen((o) => !o)}
                ariaLabel={t("date_range_filter.aria")}
                className={cn("w-[160px]", className)}
            />
            {open && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 top-full z-20 mt-1 min-w-full overflow-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
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
