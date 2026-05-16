"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import CalendarIconButton from "@/components/shared/CalendarIconButton";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Shared filter-row date input + calendar popup.
 *
 * Replaces every page that previously inlined a chip + `CalendarIconButton`
 * with a transparent `<input type="date">` overlay. Both the chip and the
 * icon share one toggle: clicking either opens the popup; clicking outside
 * (or pressing ESC) closes it; selecting a day commits the value and
 * closes.
 *
 * The popup mirrors Figma 77:12230 — month + year dropdowns and prev/next
 * chevrons in the header, then a 6-week grid (32 px cells) where the
 * current day renders on a brand chip, the selected day uses the
 * brand-soft pill, days outside the visible month dim to muted neutral,
 * and hover lands on neutral-04 grey. Brand / neutral colours come from
 * the existing `--color-*` tokens — no per-page hex values.
 *
 * The picker is single-date only; `value` and `onChange` always carry an
 * ISO `YYYY-MM-DD` string so the wire shape matches every backend that
 * already accepts that format. Pages format the chip via the optional
 * `formatValue` prop when they need a non-default display.
 */

type DateFieldProps = {
    /** ISO `YYYY-MM-DD`. Empty string is acceptable and renders the placeholder. */
    value: string;
    /** Fires once a day is picked. Always emits an ISO `YYYY-MM-DD` value. */
    onChange: (iso: string) => void;
    /** Optional chip formatter. Defaults to `DD MMM YYYY` (e.g. `25 Nov 2024`). */
    formatValue?: (iso: string) => string;
    /** Override the icon's translated aria-label key. */
    ariaLabelKey?: string;
    /** Container class — typically left empty so the field sits flush in a filter row. */
    className?: string;
    /** Hide the trailing {@link CalendarIconButton} so the chip is the
     *  only visible trigger. Used by date-range layouts that bind a
     *  single shared calendar icon to a sibling range popover, while
     *  the start / end chips each open the standalone single-date popup. */
    hideCalendarIcon?: boolean;
    /** Optional placeholder rendered when `value` is empty. */
    placeholder?: string;
    /** Optional inclusive minimum selectable date (ISO `YYYY-MM-DD`).
     *  Days strictly before {@code minIso} render disabled and ignore
     *  clicks. Used by the Contacts Valid Till field to enforce
     *  "today + 1 or later" per legacy parity. */
    minIso?: string;
    /** Render the calendar popover into {@code document.body} via a
     *  portal anchored to the chip's bounding rect. Use this when the
     *  field is rendered inside a container that clips overflow
     *  (e.g. shadcn {@code <DialogContent>}). Defaults to {@code false}
     *  so existing filter-row consumers continue to render the popover
     *  inline. */
    portalled?: boolean;
    /** Render the calendar icon INSIDE the chip (right edge) instead of
     *  as a sibling. Use this for form-field layouts (e.g. Edit Bank
     *  Account → Maturity Date) where the chip should read as a single
     *  input control with an inline trailing affix. Filter-row consumers
     *  keep the default sibling layout so the icon stays a separate hit
     *  target next to the chip. */
    iconInside?: boolean;
};

const MONTHS_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * Default chip formatter — `2025-11-25` → `25 Nov 2025`. Mirrors the
 * legacy AccountInquiry chip and stays the source of truth across all
 * pages that adopt {@link DateField}.
 */
export function formatDateChip(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    const month = MONTHS_SHORT[Number(m[2]) - 1] ?? m[2];
    return `${m[3]} ${month} ${m[1]}`;
}

/**
 * Numeric chip formatter — `2025-11-25` → `25-11-2025` (DD-MM-YYYY).
 * Used by Edit Bank Account → Maturity Date (Figma 142:21385) so the
 * dialog mirrors the live JEX rendering of `EXPI_DT`.
 */
export function formatDateChipNumeric(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Today as ISO `YYYY-MM-DD` in the user's local timezone. */
export function todayIso(): string {
    const d = new Date();
    return isoOf(d);
}

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

type ViewState = { year: number; month: number };

function prevMonth(v: ViewState): ViewState {
    return v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 };
}

function nextMonth(v: ViewState): ViewState {
    return v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 };
}

export default function DateField({
    value,
    onChange,
    formatValue = formatDateChip,
    ariaLabelKey = "common.open_calendar",
    className,
    hideCalendarIcon = false,
    placeholder,
    minIso,
    portalled = false,
    iconInside = false,
}: DateFieldProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    /** Anchor rect for the portalled popover. Re-measured on each open
     *  + on window resize / scroll while the popover is visible so the
     *  card tracks the chip when the dialog scrolls. */
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

    useLayoutEffect(() => {
        if (!open || !portalled || !ref.current) {
            setAnchorRect(null);
            return;
        }
        const measure = () => {
            if (ref.current) setAnchorRect(ref.current.getBoundingClientRect());
        };
        measure();
        window.addEventListener("scroll", measure, true);
        window.addEventListener("resize", measure);
        return () => {
            window.removeEventListener("scroll", measure, true);
            window.removeEventListener("resize", measure);
        };
    }, [open, portalled]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        const onClick = (e: MouseEvent) => {
            const target = e.target as Node;
            // When portalled, the popover sits outside `ref.current` —
            // ignore clicks inside either the chip or the popover itself.
            if (
                ref.current && !ref.current.contains(target) &&
                (!popoverRef.current || !popoverRef.current.contains(target))
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("keydown", onKey);
        // Defer the mousedown listener by a tick so the SAME click that
        // opened the popover (or the click that selects a day) doesn't
        // immediately close it via this listener firing on the wrong
        // side of the React commit. Mirrors the ViewSettingPopover
        // pattern (the canonical portalled popover in this app).
        const id = setTimeout(() => {
            document.addEventListener("mousedown", onClick);
        }, 0);
        return () => {
            clearTimeout(id);
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onClick);
        };
    }, [open]);

    const display = value ? formatValue(value) : (placeholder ?? "");
    const toggle = () => setOpen((o) => !o);

    return (
        <div ref={ref} className={cn("relative inline-flex items-center", className)}>
            {/* Visible chip — same shadow / radius / typography as the
               legacy inline chip so the closed visual is byte-identical
               to the prior AccountInquiry filter row.
               When `iconInside`, the calendar icon renders inside the
               chip's right edge as a trailing affix; the whole chip
               (including the icon) is one click target. */}
            <button
                type="button"
                onClick={toggle}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={cn(
                    "flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-2 overflow-clip rounded-md border-0 bg-white shadow-wb-btn",
                    iconInside ? "w-full justify-between pl-2 pr-1.5" : "p-2",
                )}
            >
                <span
                    className={cn(
                        "whitespace-nowrap text-wb-14-tight font-medium",
                        value ? "text-wb-ntrl-8" : "text-wb-ntrl-5",
                    )}
                >
                    {display}
                </span>
                {iconInside && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src="/assets/common/ico-calendar-outline.svg"
                        alt=""
                        aria-hidden
                        className="size-4 shrink-0"
                    />
                )}
            </button>
            {!hideCalendarIcon && !iconInside && (
                <CalendarIconButton onClick={toggle} ariaLabelKey={ariaLabelKey} />
            )}

            {open && !portalled && (
                <CalendarPopover
                    value={value}
                    minIso={minIso}
                    onSelect={(iso) => {
                        onChange(iso);
                        setOpen(false);
                    }}
                    closeLabel={t(ariaLabelKey)}
                    // When the chip is rendered as a form field
                    // (iconInside), right-anchor the popover so the
                    // 268px card extends LEFT from the chip's right
                    // edge — keeps it inside the dialog instead of
                    // overflowing the right viewport edge.
                    inlineAlign={iconInside ? "right" : "left"}
                />
            )}
            {open && portalled && anchorRect && typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={popoverRef}
                        // Stop Radix's `onPointerDownOutside` /
                        // `onInteractOutside` from intercepting clicks
                        // inside the popover when the field is rendered
                        // inside a shadcn `<DialogContent>`. Without this,
                        // Radix sees clicks on the portalled popover as
                        // "outside the dialog" and calls preventDefault on
                        // them (per its stackLevel=2 default), which
                        // swallows the day-cell `onClick` entirely.
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                            position: "fixed",
                            // Anchor below the chip + 4 px gap (matches the
                            // inline `mt-1`). Right-align the 268 px card to
                            // the chip's right edge so it doesn't clip the
                            // viewport when the chip sits near the right.
                            top: anchorRect.bottom + 4,
                            left: Math.max(
                                8,
                                Math.min(
                                    anchorRect.right - 268,
                                    window.innerWidth - 268 - 8,
                                ),
                            ),
                            zIndex: 110,
                        }}
                    >
                        <CalendarPopover
                            value={value}
                            minIso={minIso}
                            onSelect={(iso) => {
                                onChange(iso);
                                setOpen(false);
                            }}
                            closeLabel={t(ariaLabelKey)}
                            portalled
                        />
                    </div>,
                    document.body,
                )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Calendar popover — Figma 77:12230. Internal to this file so the only
// public surface is <DateField>. Other pages must not render this directly;
// if a popup is needed without the chip+icon trigger, extract a sibling
// component first and document the use case.
// ---------------------------------------------------------------------------

function CalendarPopover({
    value,
    onSelect,
    closeLabel,
    minIso,
    portalled = false,
    inlineAlign = "left",
}: {
    value: string;
    onSelect: (iso: string) => void;
    closeLabel: string;
    minIso?: string;
    portalled?: boolean;
    inlineAlign?: "left" | "right";
}) {
    const initial = parseIso(value) ?? new Date();
    const [view, setView] = useState<ViewState>({
        year: initial.getFullYear(),
        month: initial.getMonth(),
    });
    const [monthOpen, setMonthOpen] = useState(false);
    const [yearOpen, setYearOpen] = useState(false);

    const todayKey = isoOf(new Date());
    const selectedKey = value;

    // Plain const derivations — the React Compiler handles memoization
    // (lint rule react-hooks/preserve-manual-memoization forbids useMemo here).
    const cells = buildGrid(view.year, view.month);
    const baseYear = new Date().getFullYear();
    const yearOptions: number[] = [];
    for (let y = baseYear - 10; y <= baseYear + 10; y++) yearOptions.push(y);

    return (
        <div
            // Figma node 77:12230 — 1px gray border, 16px radius, soft card
            // shadow. Width derives from the 254px grid + 2×16px padding.
            // When portalled, the parent wrapper handles positioning via
            // `position: fixed`; otherwise anchor to the chip inline.
            role="dialog"
            aria-label={closeLabel}
            className={cn(
                "flex w-[268px] flex-col items-start overflow-clip rounded-2xl border border-wb-ntrl-4 bg-white shadow-wb-card",
                !portalled && "absolute top-full z-30 mt-1",
                !portalled && inlineAlign === "left" && "left-0",
                !portalled && inlineAlign === "right" && "right-0",
            )}
        >
            {/* Header */}
            <div className="flex w-full items-center gap-1.5 px-3 pt-3 pb-1.5">
                <div className="flex flex-1 items-start gap-1.5">
                    <HeaderDropdown
                        value={MONTHS_SHORT[view.month]}
                        open={monthOpen}
                        onToggle={() => {
                            setMonthOpen((o) => !o);
                            setYearOpen(false);
                        }}
                        flex
                    >
                        {monthOpen && (
                            <DropdownList
                                options={MONTHS_SHORT.map((m, i) => ({ label: m, value: i }))}
                                selected={view.month}
                                onSelect={(month) => {
                                    setView((v) => ({ ...v, month: Number(month) }));
                                    setMonthOpen(false);
                                }}
                            />
                        )}
                    </HeaderDropdown>

                    <HeaderDropdown
                        value={String(view.year)}
                        open={yearOpen}
                        onToggle={() => {
                            setYearOpen((o) => !o);
                            setMonthOpen(false);
                        }}
                        widthClass="w-[75px]"
                    >
                        {yearOpen && (
                            <DropdownList
                                options={yearOptions.map((y) => ({ label: String(y), value: y }))}
                                selected={view.year}
                                onSelect={(year) => {
                                    setView((v) => ({ ...v, year: Number(year) }));
                                    setYearOpen(false);
                                }}
                            />
                        )}
                    </HeaderDropdown>
                </div>

                {/* Prev / Next — joined with a 1px gap per Figma */}
                <div className="flex items-start gap-px">
                    <button
                        type="button"
                        aria-label="Previous month"
                        onClick={() => setView(prevMonth)}
                        className="flex size-7 cursor-pointer items-center justify-center overflow-clip rounded-l-md text-wb-ink hover:bg-neutral-100"
                    >
                        <ChevronLeft className="size-4" strokeWidth={1.8} />
                    </button>
                    <button
                        type="button"
                        aria-label="Next month"
                        onClick={() => setView(nextMonth)}
                        className="flex size-7 cursor-pointer items-center justify-center overflow-clip rounded-r-md text-wb-ink hover:bg-neutral-100"
                    >
                        <ChevronRight className="size-4" strokeWidth={1.8} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-col items-start gap-1.5 px-3 pb-3 pt-1">
                <div className="flex w-full items-center justify-center gap-0.5 text-wb-12 font-medium text-wb-ntrl-5">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                        <span key={d} className="flex w-8 justify-center">
                            {d}
                        </span>
                    ))}
                </div>

                <div className="flex w-[244px] flex-wrap content-center items-center justify-center gap-0.5">
                    {cells.map((c) => {
                        const key = isoOf(c.date);
                        const isToday = key === todayKey;
                        const isSelected = key === selectedKey;
                        const dim = c.outside;
                        const disabled = !!minIso && key < minIso;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => {
                                    if (disabled) return;
                                    onSelect(key);
                                }}
                                disabled={disabled}
                                className={cn(
                                    "flex size-8 items-center justify-center rounded-lg text-wb-13 font-medium",
                                    disabled
                                        ? "cursor-not-allowed text-wb-ntrl-4"
                                        : "cursor-pointer",
                                    !disabled && isToday &&
                                        "border border-black/10 bg-brand text-white hover:bg-brand-hover",
                                    !disabled && !isToday && isSelected &&
                                        "border border-brand/10 bg-brand-soft text-brand",
                                    !disabled && !isToday && !isSelected && dim && "text-wb-ntrl-5",
                                    !disabled && !isToday && !isSelected && !dim && "text-wb-ink hover:bg-neutral-200",
                                )}
                                aria-current={isToday ? "date" : undefined}
                                aria-pressed={isSelected}
                                aria-disabled={disabled || undefined}
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

/** Outlined dropdown trigger inside the calendar header (month / year). */
function HeaderDropdown({
    value,
    open,
    onToggle,
    flex,
    widthClass,
    children,
}: {
    value: string;
    open: boolean;
    onToggle: () => void;
    flex?: boolean;
    widthClass?: string;
    children?: React.ReactNode;
}) {
    return (
        <div className={cn("relative", flex && "flex-1", widthClass)}>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-haspopup="listbox"
                className="flex w-full cursor-pointer items-center overflow-clip rounded-md bg-white shadow-wb-btn"
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

/** Shared list popover used by both header dropdowns. */
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

/** 6-week × 7-day grid starting on the Sunday before / on the 1st. */
function buildGrid(year: number, month: number): Array<{ date: Date; outside: boolean }> {
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay(); // 0 = Sunday
    const start = new Date(year, month, 1 - startWeekday);
    const cells: Array<{ date: Date; outside: boolean }> = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        cells.push({ date: d, outside: d.getMonth() !== month });
    }
    return cells;
}
