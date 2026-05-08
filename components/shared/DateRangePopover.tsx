"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Date-range popover — Figma 123:4630.
 *
 * <p>Click the calendar icon next to a date-range filter and this
 * popover unfolds. It carries:
 * <ul>
 *   <li>A grey header bar with a year selector (◀ 2026 ▶) and a
 *       live "DD-MM-YYYY ~ DD-MM-YYYY" preview of the pending range.</li>
 *   <li>Three rows of preset chips — Today / Yesterday / This week /
 *       Last week / This month / Last month / This year, then
 *       1st Half / 2nd Half / four quarters / By Today, then the
 *       12 monthly chips. Each chip rewrites the pending range
 *       relative to the current header year.</li>
 *   <li>Two side-by-side calendars — the right calendar is locked
 *       to the left's month + 1. Each calendar has its own month
 *       dropdown + prev / next chevrons. Click any day to set the
 *       range start (first click) or end (second click); a third
 *       click on the same calendar starts the cycle over.</li>
 *   <li>A Cancel / Apply footer. Cancel discards everything;
 *       Apply commits the pending range via {@code onApply}.</li>
 * </ul>
 *
 * <p>The popover is uncontrolled while open — internal state holds
 * the pending {@code start} / {@code end} until the user clicks
 * Apply. The parent only sees the new range after Apply, which
 * keeps the page's request loop quiet while the user picks dates.
 *
 * <p>Click outside or press {@code Escape} to dismiss without
 * applying — same UX contract as {@code <DateField>}.
 *
 * <p>Mounting position: positioned absolutely below the trigger
 * (caller wraps the popover + trigger in a {@code relative}
 * container). Width is fixed at 730 px to fit the dual-calendar
 * layout per Figma; on narrow viewports the caller is responsible
 * for placing the trigger somewhere the popover can render off
 * to the side without clipping.
 */

type DateRangePopoverProps = {
    /** ISO `YYYY-MM-DD` start date currently in effect. */
    start: string;
    /** ISO `YYYY-MM-DD` end date currently in effect. */
    end: string;
    /** Fires when the user clicks Apply with a non-empty pair. Both
     *  values are ISO `YYYY-MM-DD`; the parent normalises to its
     *  preferred wire format (e.g. `YYYYMMDD`). */
    onApply: (range: { start: string; end: string }) => void;
    /** Fires when the user clicks Cancel, presses {@code Escape}, or
     *  clicks outside the popover. Parent should close the popover. */
    onClose: () => void;
    /** Optional positioning class, e.g. {@code "right-0"} to right-align
     *  the popover under the trigger. Defaults to {@code "left-0"}. */
    align?: "left" | "right";
};

const MONTHS_LONG = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
] as const;

const MONTHS_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

type ViewState = { year: number; month: number };

function isoOf(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function parseIso(iso: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function nextViewMonth(v: ViewState): ViewState {
    return v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 };
}

function prevViewMonth(v: ViewState): ViewState {
    return v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 };
}

/** "20240115" → "15-01-2024" — matches the Figma preview format. */
function dmyDashes(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return `${m[3]}-${m[2]}-${m[1]}`;
}

export default function DateRangePopover({
    start,
    end,
    onApply,
    onClose,
    align = "left",
}: DateRangePopoverProps) {
    const { t } = useTranslation();
    const ref = useRef<HTMLDivElement>(null);

    // Pending state — committed only on Apply.
    const [tempStart, setTempStart] = useState<string>(start);
    const [tempEnd, setTempEnd] = useState<string>(end);
    /** When true, the next day click sets {@code tempEnd}. False after a
     *  fresh start click; resets to false again after end is set. Drives
     *  the in-place click cycle on either calendar. */
    const [pickingEnd, setPickingEnd] = useState<boolean>(false);

    const initialLeft = parseIso(start) ?? new Date();
    const [leftView, setLeftView] = useState<ViewState>({
        year: initialLeft.getFullYear(),
        month: initialLeft.getMonth(),
    });
    const rightView = nextViewMonth(leftView);

    const [headerYear, setHeaderYear] = useState<number>(leftView.year);
    const [leftMonthOpen, setLeftMonthOpen] = useState(false);
    const [leftYearOpen, setLeftYearOpen] = useState(false);

    // Click-outside / Escape dismiss.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onClick);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onClick);
        };
    }, [onClose]);

    const handleDayClick = (iso: string) => {
        if (!pickingEnd) {
            setTempStart(iso);
            setTempEnd(iso);
            setPickingEnd(true);
            return;
        }
        // pickingEnd = true — the user just chose the start; this click
        // closes the range. If the user clicked a date BEFORE the
        // start, swap so start ≤ end.
        if (iso < tempStart) {
            setTempEnd(tempStart);
            setTempStart(iso);
        } else {
            setTempEnd(iso);
        }
        setPickingEnd(false);
    };

    const applyPreset = (preset: PresetRange) => {
        const range = computePreset(preset, headerYear);
        setTempStart(range.start);
        setTempEnd(range.end);
        setPickingEnd(false);
        // Move the left calendar to the new range's start month.
        const startDate = parseIso(range.start);
        if (startDate) {
            setLeftView({ year: startDate.getFullYear(), month: startDate.getMonth() });
        }
    };

    const handleApply = () => {
        if (!tempStart || !tempEnd) return;
        onApply({ start: tempStart, end: tempEnd });
    };

    const yearOptions: number[] = [];
    {
        const baseYear = new Date().getFullYear();
        for (let y = baseYear - 10; y <= baseYear + 10; y++) yearOptions.push(y);
    }

    return (
        <div
            ref={ref}
            role="dialog"
            aria-label={t("common.open_calendar")}
            className={cn(
                "absolute top-full z-30 mt-1 flex w-[780px] max-w-[calc(100vw-32px)] flex-col gap-3 rounded-md border border-wb-ntrl-4 bg-white p-4 shadow-wb-card",
                align === "right" ? "right-0" : "left-0",
            )}
        >
            {/* Top bar — year selector + live range preview */}
            <div className="flex items-center justify-between rounded-md bg-neutral-100 px-3 py-2">
                <div className="flex items-center gap-3">
                    <span className="whitespace-nowrap text-wb-14 font-semibold text-wb-ntrl-6">
                        {t("date_range.year_label")}
                    </span>
                    <YearStepper
                        value={headerYear}
                        onChange={setHeaderYear}
                    />
                </div>
                <span className="whitespace-nowrap text-wb-14 font-semibold text-wb-ink">
                    {dmyDashes(tempStart)} ~ {dmyDashes(tempEnd)}
                </span>
            </div>

            {/* Preset chips */}
            <div className="flex flex-col gap-2">
                <PresetRow
                    presets={["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_year"]}
                    onSelect={applyPreset}
                    t={t}
                />
                <PresetRow
                    presets={["1st_half", "2nd_half", "q1", "q2", "q3", "q4", "by_today"]}
                    onSelect={applyPreset}
                    t={t}
                />
                <PresetRow
                    presets={[
                        "month_1", "month_2", "month_3", "month_4", "month_5", "month_6",
                        "month_7", "month_8", "month_9", "month_10", "month_11", "month_12",
                    ]}
                    onSelect={applyPreset}
                    t={t}
                />
            </div>

            {/* Dual calendars + flow arrow */}
            <div className="flex items-center justify-center gap-3">
                <CalendarPane
                    view={leftView}
                    monthOpen={leftMonthOpen}
                    yearOpen={leftYearOpen}
                    onPrev={() => setLeftView(prevViewMonth)}
                    onNext={() => setLeftView(nextViewMonth)}
                    onToggleMonth={() => {
                        setLeftMonthOpen((o) => !o);
                        setLeftYearOpen(false);
                    }}
                    onToggleYear={() => {
                        setLeftYearOpen((o) => !o);
                        setLeftMonthOpen(false);
                    }}
                    onPickMonth={(month) => {
                        setLeftView((v) => ({ ...v, month }));
                        setLeftMonthOpen(false);
                    }}
                    onPickYear={(year) => {
                        setLeftView((v) => ({ ...v, year }));
                        setLeftYearOpen(false);
                    }}
                    yearOptions={yearOptions}
                    rangeStart={tempStart}
                    rangeEnd={tempEnd}
                    onDayClick={handleDayClick}
                />
                <span aria-hidden className="flex-shrink-0 text-wb-ntrl-6">
                    →
                </span>
                <CalendarPane
                    view={rightView}
                    monthOpen={false}
                    yearOpen={false}
                    onPrev={() => setLeftView(prevViewMonth)}
                    onNext={() => setLeftView(nextViewMonth)}
                    onToggleMonth={() => undefined}
                    onToggleYear={() => undefined}
                    onPickMonth={() => undefined}
                    onPickYear={() => undefined}
                    yearOptions={yearOptions}
                    rangeStart={tempStart}
                    rangeEnd={tempEnd}
                    onDayClick={handleDayClick}
                    headerReadonly
                />
            </div>

            {/* Footer — Cancel / Apply */}
            <div className="flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-8 cursor-pointer items-center justify-center gap-1 overflow-clip rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                >
                    {t("common.cancel")}
                </button>
                <button
                    type="button"
                    onClick={handleApply}
                    className="flex h-8 cursor-pointer items-center justify-center gap-1 overflow-clip rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                >
                    {t("common.apply")}
                </button>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------
 *  Sub-components
 * ------------------------------------------------------------------ */

function YearStepper({ value, onChange }: { value: number; onChange: (next: number) => void }) {
    return (
        <div className="flex h-8 w-[100px] items-center justify-between overflow-clip rounded-md bg-white px-2 shadow-wb-btn">
            <button
                type="button"
                aria-label="Previous year"
                onClick={() => onChange(value - 1)}
                className="flex size-4 cursor-pointer items-center justify-center text-wb-ink"
            >
                <ChevronLeft className="size-4" strokeWidth={1.8} />
            </button>
            <span className="text-wb-14 font-semibold text-wb-ink">{value}</span>
            <button
                type="button"
                aria-label="Next year"
                onClick={() => onChange(value + 1)}
                className="flex size-4 cursor-pointer items-center justify-center text-wb-ink"
            >
                <ChevronRight className="size-4" strokeWidth={1.8} />
            </button>
        </div>
    );
}

type PresetRange =
    | "today" | "yesterday"
    | "this_week" | "last_week"
    | "this_month" | "last_month" | "this_year"
    | "1st_half" | "2nd_half"
    | "q1" | "q2" | "q3" | "q4" | "by_today"
    | "month_1" | "month_2" | "month_3" | "month_4" | "month_5" | "month_6"
    | "month_7" | "month_8" | "month_9" | "month_10" | "month_11" | "month_12";

const PRESET_LABEL_KEY: Record<PresetRange, string> = {
    today:      "date_range.preset.today",
    yesterday:  "date_range.preset.yesterday",
    this_week:  "date_range.preset.this_week",
    last_week:  "date_range.preset.last_week",
    this_month: "date_range.preset.this_month",
    last_month: "date_range.preset.last_month",
    this_year:  "date_range.preset.this_year",
    "1st_half": "date_range.preset.1st_half",
    "2nd_half": "date_range.preset.2nd_half",
    q1:         "date_range.preset.q1",
    q2:         "date_range.preset.q2",
    q3:         "date_range.preset.q3",
    q4:         "date_range.preset.q4",
    by_today:   "date_range.preset.by_today",
    month_1:    "date_range.preset.month_1",
    month_2:    "date_range.preset.month_2",
    month_3:    "date_range.preset.month_3",
    month_4:    "date_range.preset.month_4",
    month_5:    "date_range.preset.month_5",
    month_6:    "date_range.preset.month_6",
    month_7:    "date_range.preset.month_7",
    month_8:    "date_range.preset.month_8",
    month_9:    "date_range.preset.month_9",
    month_10:   "date_range.preset.month_10",
    month_11:   "date_range.preset.month_11",
    month_12:   "date_range.preset.month_12",
};

function PresetRow({
    presets,
    onSelect,
    t,
}: {
    presets: ReadonlyArray<PresetRange>;
    onSelect: (preset: PresetRange) => void;
    t: (key: string) => string;
}) {
    return (
        <div className="flex w-full items-start gap-2">
            {presets.map((p) => (
                <button
                    key={p}
                    type="button"
                    onClick={() => onSelect(p)}
                    className="flex h-7 flex-1 cursor-pointer items-center justify-center overflow-clip whitespace-nowrap rounded-md border border-black/15 bg-white px-2 text-wb-13 font-medium tracking-wb-tight text-wb-ink hover:bg-neutral-100"
                >
                    {t(PRESET_LABEL_KEY[p])}
                </button>
            ))}
        </div>
    );
}

function computePreset(preset: PresetRange, headerYear: number): { start: string; end: string } {
    const today = new Date();
    const cy = today.getFullYear();
    const useY = headerYear === cy ? cy : headerYear;

    const yyyymmddOf = (y: number, m: number, d: number) =>
        isoOf(new Date(y, m, d));

    const monthRange = (m: number) => {
        const last = new Date(useY, m + 1, 0).getDate();
        return { start: yyyymmddOf(useY, m, 1), end: yyyymmddOf(useY, m, last) };
    };

    switch (preset) {
        case "today":
            return { start: isoOf(today), end: isoOf(today) };
        case "yesterday": {
            const y = new Date();
            y.setDate(y.getDate() - 1);
            return { start: isoOf(y), end: isoOf(y) };
        }
        case "this_week": {
            // ISO week starts Monday — but Figma's "Su Mo Tu We …" header
            // suggests a Sunday-start convention. Use Sunday-of-this-week.
            const start = new Date();
            start.setDate(start.getDate() - start.getDay());
            return { start: isoOf(start), end: isoOf(today) };
        }
        case "last_week": {
            const sunday = new Date();
            sunday.setDate(sunday.getDate() - sunday.getDay() - 7);
            const saturday = new Date(sunday);
            saturday.setDate(sunday.getDate() + 6);
            return { start: isoOf(sunday), end: isoOf(saturday) };
        }
        case "this_month": {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            return { start: isoOf(start), end: isoOf(today) };
        }
        case "last_month": {
            const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const end = new Date(today.getFullYear(), today.getMonth(), 0);
            return { start: isoOf(start), end: isoOf(end) };
        }
        case "this_year":
            return {
                start: yyyymmddOf(useY, 0, 1),
                end: useY === cy ? isoOf(today) : yyyymmddOf(useY, 11, 31),
            };
        case "1st_half":
            return { start: yyyymmddOf(useY, 0, 1), end: yyyymmddOf(useY, 5, 30) };
        case "2nd_half":
            return { start: yyyymmddOf(useY, 6, 1), end: yyyymmddOf(useY, 11, 31) };
        case "q1": return { start: yyyymmddOf(useY, 0, 1), end: yyyymmddOf(useY, 2, 31) };
        case "q2": return { start: yyyymmddOf(useY, 3, 1), end: yyyymmddOf(useY, 5, 30) };
        case "q3": return { start: yyyymmddOf(useY, 6, 1), end: yyyymmddOf(useY, 8, 30) };
        case "q4": return { start: yyyymmddOf(useY, 9, 1), end: yyyymmddOf(useY, 11, 31) };
        case "by_today":
            // Year-to-date — Jan 1 (header year) → today.
            return { start: yyyymmddOf(useY, 0, 1), end: isoOf(today) };
        default: {
            // month_1..month_12 — 1-indexed month chips (Jan = 1, …, Dec = 12).
            const idx = Number(preset.slice("month_".length));
            return monthRange(idx - 1);
        }
    }
}

function CalendarPane({
    view,
    monthOpen,
    yearOpen,
    onPrev,
    onNext,
    onToggleMonth,
    onToggleYear,
    onPickMonth,
    onPickYear,
    yearOptions,
    rangeStart,
    rangeEnd,
    onDayClick,
    headerReadonly = false,
}: {
    view: ViewState;
    monthOpen: boolean;
    yearOpen: boolean;
    onPrev: () => void;
    onNext: () => void;
    onToggleMonth: () => void;
    onToggleYear: () => void;
    onPickMonth: (month: number) => void;
    onPickYear: (year: number) => void;
    yearOptions: ReadonlyArray<number>;
    rangeStart: string;
    rangeEnd: string;
    onDayClick: (iso: string) => void;
    headerReadonly?: boolean;
}) {
    const cells = buildGrid(view.year, view.month);
    return (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-wb-ntrl-4 p-3">
            {/* Header — prev / month + year / next */}
            <div className="flex w-full items-center gap-2">
                <button
                    type="button"
                    aria-label="Previous month"
                    onClick={onPrev}
                    className="flex size-6 cursor-pointer items-center justify-center rounded-full bg-wb-ink text-white shadow-wb-btn"
                >
                    <ChevronLeft className="size-3" strokeWidth={2} />
                </button>
                <div className="flex min-w-px flex-1 items-center gap-2">
                    <HeaderDropdown
                        value={MONTHS_LONG[view.month].slice(0, 3)}
                        open={monthOpen}
                        onToggle={onToggleMonth}
                        readonly={headerReadonly}
                        flex
                    >
                        {monthOpen && (
                            <DropdownList
                                options={MONTHS_LONG.map((m, i) => ({ label: m.slice(0, 3), value: i }))}
                                selected={view.month}
                                onSelect={(value) => onPickMonth(Number(value))}
                            />
                        )}
                    </HeaderDropdown>
                    <HeaderDropdown
                        value={String(view.year)}
                        open={yearOpen}
                        onToggle={onToggleYear}
                        readonly={headerReadonly}
                        widthClass="w-[84px]"
                    >
                        {yearOpen && (
                            <DropdownList
                                options={yearOptions.map((y) => ({ label: String(y), value: y }))}
                                selected={view.year}
                                onSelect={(value) => onPickYear(Number(value))}
                            />
                        )}
                    </HeaderDropdown>
                </div>
                <button
                    type="button"
                    aria-label="Next month"
                    onClick={onNext}
                    className="flex size-6 cursor-pointer items-center justify-center rounded-full bg-wb-ink text-white shadow-wb-btn"
                >
                    <ChevronRight className="size-3" strokeWidth={2} />
                </button>
            </div>

            {/* Body */}
            <div className="flex flex-col items-start gap-1.5">
                <div className="flex items-start gap-1 text-wb-12 font-medium text-wb-ntrl-6">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                        <span key={d} className="flex w-8 justify-center">
                            {d}
                        </span>
                    ))}
                </div>
                <div className="flex w-[252px] flex-wrap content-start items-start gap-1">
                    {cells.map((c) => {
                        const key = isoOf(c.date);
                        const isStart = key === rangeStart;
                        const isEnd = key === rangeEnd;
                        const inRange = key > rangeStart && key < rangeEnd;
                        const dim = c.outside;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => onDayClick(key)}
                                className={cn(
                                    "flex size-8 cursor-pointer items-center justify-center rounded-md text-wb-13 font-medium",
                                    !dim && !isStart && !isEnd && !inRange &&
                                        "border border-wb-ntrl-4 bg-white text-wb-ink hover:bg-neutral-100",
                                    inRange && !isStart && !isEnd &&
                                        "border border-brand-soft bg-brand-softer text-brand",
                                    (isStart || isEnd) &&
                                        "border border-brand bg-brand-soft text-brand",
                                    dim && "border border-wb-ntrl-4 text-wb-ntrl-4 opacity-0",
                                )}
                                aria-pressed={isStart || isEnd}
                            >
                                {c.date.getDate()}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function HeaderDropdown({
    value,
    open,
    onToggle,
    readonly,
    flex,
    widthClass,
    children,
}: {
    value: string;
    open: boolean;
    onToggle: () => void;
    readonly: boolean;
    flex?: boolean;
    widthClass?: string;
    children?: React.ReactNode;
}) {
    return (
        <div className={cn("relative", flex && "flex-1", widthClass)}>
            <button
                type="button"
                onClick={readonly ? undefined : onToggle}
                aria-expanded={open}
                aria-haspopup="listbox"
                disabled={readonly}
                className={cn(
                    "flex w-full items-center overflow-clip rounded-md bg-white shadow-wb-btn",
                    readonly ? "cursor-default" : "cursor-pointer",
                )}
            >
                <span className="flex flex-1 items-center px-2 py-2 text-left text-wb-14-tight font-medium text-wb-ink">
                    {value}
                </span>
                <span className="flex items-center justify-center px-2 py-2">
                    <ChevronDown className="size-4" strokeWidth={1.8} />
                </span>
            </button>
            {children}
        </div>
    );
}

function DropdownList<TValue extends string | number>({
    options,
    selected,
    onSelect,
}: {
    options: ReadonlyArray<{ label: string; value: TValue }>;
    selected: TValue;
    onSelect: (value: TValue) => void;
}) {
    return (
        <ul
            role="listbox"
            className="custom-scrollbar-y absolute left-0 top-full z-10 mt-1 max-h-48 w-full min-w-full overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
        >
            {options.map((opt) => (
                <li
                    key={String(opt.value)}
                    role="option"
                    aria-selected={opt.value === selected}
                    onClick={() => onSelect(opt.value)}
                    className={cn(
                        "cursor-pointer px-2 py-1.5 text-wb-14-tight font-medium text-wb-ink hover:bg-neutral-100",
                        opt.value === selected && "bg-brand-soft text-brand",
                    )}
                >
                    {opt.label}
                </li>
            ))}
        </ul>
    );
}

function buildGrid(year: number, month: number): Array<{ date: Date; outside: boolean }> {
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const start = new Date(year, month, 1 - startWeekday);
    const cells: Array<{ date: Date; outside: boolean }> = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        cells.push({ date: d, outside: d.getMonth() !== month });
    }
    return cells;
}

// Re-export the internal MONTHS_SHORT so callers (e.g. chip formatters)
// can mirror the popup's month abbreviations without redefining.
export { MONTHS_SHORT };
