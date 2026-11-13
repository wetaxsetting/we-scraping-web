"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Popover } from "@/components/shared/Popover";
import { addMonths, currentMonth, fmtMonth, MIN_MONTH } from "@/components/invoices/period";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Month picker ("YYYY-MM"): the 32 px filter trigger of `Select`, opening a year header (‹ year ›) over a
 * 4×3 month grid. Months outside [min, max] are disabled; `max` defaults to the current month.
 * Replaces the flat month lists (docs/issues/weinvoice-month-picker-2026-11-13.md).
 */
export function MonthPicker({
    value,
    onChange,
    min = MIN_MONTH,
    max,
    prefix,
    placeholder,
    width,
    fullWidth,
    highlight,
}: {
    /** "YYYY-MM", or "" for none (shows `placeholder`). */
    value: string;
    onChange: (month: string) => void;
    min?: string;
    max?: string;
    prefix?: string;
    placeholder?: string;
    /** Trigger width in px (computed per filter, not a token). */
    width?: number;
    fullWidth?: boolean;
    highlight?: boolean;
}) {
    const { t } = useTranslation();
    const now = currentMonth();
    const hi = max ?? now;
    const lo = min > hi ? hi : min;
    const [open, setOpen] = useState(false);
    const [year, setYear] = useState(() => Number((value || hi).slice(0, 4)));
    const minYear = Number(lo.slice(0, 4));
    const maxYear = Number(hi.slice(0, 4));

    const onOpenChange = (o: boolean) => {
        if (o) setYear(Number((value || hi).slice(0, 4)));
        setOpen(o);
    };
    const pick = (m: string) => {
        onChange(m);
        setOpen(false);
    };
    const allowed = (m: string) => m >= lo && m <= hi;
    const shortcuts = [
        { label: t("period.this_month"), month: now },
        { label: t("period.last_month"), month: addMonths(now, -1) },
    ];

    return (
        <Popover
            open={open}
            onOpenChange={onOpenChange}
            rootClassName={fullWidth ? "w-full" : undefined}
            width={264}
            trigger={({ toggle }) => (
                <button
                    type="button"
                    onClick={toggle}
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    style={width && !fullWidth ? { width } : undefined}
                    className={cn(
                        fullWidth && "w-full",
                        "flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-2 rounded-md bg-white px-2.5 text-wb-13 font-medium text-wb-ink shadow-wb-outline hover:bg-wb-bg-sidebar [&_svg]:size-4 [&_svg]:shrink-0",
                        (open || highlight) && "text-brand shadow-wb-focus",
                    )}
                >
                    <CalendarDays className="text-wb-ntrl-6" />
                    <span className="min-w-0 flex-1 truncate text-left">
                        {prefix && <span className="text-wb-ntrl-6">{prefix}: </span>}
                        {value ? fmtMonth(value) : <span className="text-wb-ntrl-6">{placeholder}</span>}
                    </span>
                    <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
                </button>
            )}
        >
            <div className="p-2">
                <div className="mb-1 flex items-center justify-between">
                    <button
                        type="button"
                        aria-label={t("period.prev_year")}
                        disabled={year <= minYear}
                        onClick={() => setYear((y) => y - 1)}
                        className="flex size-8 cursor-pointer items-center justify-center rounded-md text-wb-ink hover:bg-wb-bg-sidebar disabled:cursor-default disabled:text-wb-ntrl-4 disabled:hover:bg-transparent [&_svg]:size-4"
                    >
                        <ChevronLeft />
                    </button>
                    <span className="text-wb-14 font-semibold text-wb-ink">{year}</span>
                    <button
                        type="button"
                        aria-label={t("period.next_year")}
                        disabled={year >= maxYear}
                        onClick={() => setYear((y) => y + 1)}
                        className="flex size-8 cursor-pointer items-center justify-center rounded-md text-wb-ink hover:bg-wb-bg-sidebar disabled:cursor-default disabled:text-wb-ntrl-4 disabled:hover:bg-transparent [&_svg]:size-4"
                    >
                        <ChevronRight />
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                    {Array.from({ length: 12 }, (_, i) => {
                        const m = `${year}-${String(i + 1).padStart(2, "0")}`;
                        const ok = allowed(m);
                        const selected = m === value;
                        return (
                            <button
                                key={m}
                                type="button"
                                disabled={!ok}
                                aria-pressed={selected}
                                onClick={() => pick(m)}
                                className={cn(
                                    "h-9 cursor-pointer rounded-md text-wb-13 font-medium",
                                    selected
                                        ? "bg-brand text-white"
                                        : ok
                                          ? cn("text-wb-ink hover:bg-wb-bg-sidebar", m === now && "text-brand shadow-wb-outline")
                                          : "cursor-default text-wb-ntrl-4",
                                )}
                            >
                                {t(`period.mon.${i + 1}`)}
                            </button>
                        );
                    })}
                </div>
                <div className="mt-2 flex gap-1 border-t border-wb-border-sidebar pt-2">
                    {shortcuts.map((s) => (
                        <button
                            key={s.month}
                            type="button"
                            disabled={!allowed(s.month)}
                            onClick={() => pick(s.month)}
                            className="h-7 flex-1 cursor-pointer rounded-md text-wb-12 font-medium text-brand hover:bg-brand-soft disabled:cursor-default disabled:text-wb-ntrl-4 disabled:hover:bg-transparent"
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>
        </Popover>
    );
}
