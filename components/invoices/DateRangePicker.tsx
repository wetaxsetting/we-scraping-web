"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { daysInMonth, isFutureMonth, isoDay, MIN_MONTH, monthsRange, parseDmy, toDmy, todayIsoDay } from "@/components/invoices/period";
import { Popover } from "@/components/shared/Popover";
import { Select } from "@/components/shared/Select";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Period range picker of the invoice lists (UI Spec v1.2 §3.6, B1), placed before "Chọn nhanh".
 * The trigger reads "Tháng 11/2026" / "Năm 2026" / "Tháng 1/2026 → Tháng 3/2026" / "01/11/2026 → 27/11/2026".
 * Left: year + whole year · 12 months · Q I–IV · H1 / H2 (months after today are locked). Right: from–to typed as
 * dd/mm/yyyy or picked on the calendar (first click = start, second = end); Huỷ / Áp dụng. The end never passes today.
 *
 * Its own component (not the shared WeCMS `DateRangePopover`): the spec's presets and the future-month lock differ.
 */
type T = (k: string, p?: Record<string, string | number>) => string;

export function rangeLabel(from: string, to: string, t: T): string {
    const [fy, fm, fd] = from.split("-").map(Number);
    const [ty, tm, td] = to.split("-").map(Number);
    // whole months — the end may be cut at today, so a range ending today also reads as months
    const today = todayIsoDay();
    const wholeMonths = fd === 1 && (td === daysInMonth(ty, tm) || to === today);
    if (wholeMonths) {
        if (fy === ty && fm === 1 && tm === 12) return t("drp.year_n", { y: fy });
        const a = t("drp.month_y", { m: fm, y: fy });
        const b = t("drp.month_y", { m: tm, y: ty });
        return a === b ? a : `${a} → ${b}`;
    }
    return `${toDmy(from)} → ${toDmy(to)}`;
}

/** Years the picker offers: the current year back to the first month of GDT data, newest first. */
function yearOptions(today: string): number[] {
    const out: number[] = [];
    for (let y = Number(today.slice(0, 4)); y >= Number(MIN_MONTH.slice(0, 4)); y--) out.push(y);
    return out;
}

export function DateRangePicker({ from, to, onApply }: { from: string; to: string; onApply: (from: string, to: string) => void }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            className="max-w-[calc(100vw-32px)]"
            trigger={({ toggle }) => (
                <button
                    type="button"
                    onClick={toggle}
                    data-testid="drp-trigger"
                    className={cn(
                        "flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-2 rounded-md bg-white px-3 text-wb-13 font-semibold whitespace-nowrap text-wb-ink shadow-wb-outline hover:bg-wb-bg-sidebar",
                        open && "shadow-wb-focus",
                    )}
                >
                    <CalendarDays className="size-4 text-wb-ntrl-6" />
                    {rangeLabel(from, to, t)}
                    <ChevronDown className={cn("size-4 text-wb-ntrl-6 transition-transform", open && "rotate-180")} />
                </button>
            )}
        >
            {open && (
                <RangePanel
                    from={from}
                    to={to}
                    onCancel={() => setOpen(false)}
                    onApply={(a, b) => {
                        onApply(a, b);
                        setOpen(false);
                    }}
                />
            )}
        </Popover>
    );
}

export function RangePanel({ from, to, onCancel, onApply, today = todayIsoDay() }: { from: string; to: string; onCancel: () => void; onApply: (from: string, to: string) => void; today?: string }) {
    const { t } = useTranslation();
    const years = useMemo(() => yearOptions(today), [today]);
    const [year, setYear] = useState(Number(from.slice(0, 4)));
    const [a, setA] = useState(from);
    const [b, setB] = useState<string | null>(to > today ? today : to);
    const [fromTxt, setFromTxt] = useState(toDmy(from));
    const [toTxt, setToTxt] = useState(toDmy(to > today ? today : to));
    const [view, setView] = useState({ y: Number(from.slice(0, 4)), m: Number(from.slice(5, 7)) });

    const set = (r: { from: string; to: string } | null) => {
        if (!r) return;
        setA(r.from);
        setB(r.to);
        setFromTxt(toDmy(r.from));
        setToTxt(toDmy(r.to));
        setView({ y: Number(r.from.slice(0, 4)), m: Number(r.from.slice(5, 7)) });
    };
    const months = (m1: number, m2: number) => set(monthsRange(year, m1, m2, today));
    const future = (m: number) => isFutureMonth(year, m, today);
    const isSel = (m1: number, m2: number) => {
        const r = monthsRange(year, m1, m2, today);
        return !!r && a === r.from && b === r.to;
    };

    const pickDay = (d: string) => {
        if (d > today) return;
        // waiting for the end day → close the range; otherwise start a new one
        if (b === null && d >= a) {
            setB(d);
            setToTxt(toDmy(d));
            return;
        }
        setA(d);
        setB(null);
        setFromTxt(toDmy(d));
        setToTxt("");
    };
    const cells = useMemo(() => {
        const lead = (new Date(view.y, view.m - 1, 1).getDay() + 6) % 7; // Monday first
        const out: (string | null)[] = Array(lead).fill(null);
        for (let d = 1; d <= daysInMonth(view.y, view.m); d++) out.push(isoDay(view.y, view.m, d));
        return out;
    }, [view]);
    const nav = (k: number) =>
        setView((v) => {
            const m = v.m + k;
            return m < 1 ? { y: v.y - 1, m: 12 } : m > 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m };
        });
    const valid = !!b && a <= b && b <= today;
    const chip = (on: boolean) =>
        cn(
            "h-8 cursor-pointer rounded-md px-1 text-wb-12 font-medium disabled:cursor-not-allowed disabled:opacity-40",
            on ? "bg-brand text-white" : "bg-brand-softer text-brand hover:bg-brand/15",
        );
    const section = "mt-3 mb-1 text-wb-11 font-semibold uppercase text-wb-ntrl-5";
    const field = "mt-0.5 h-8 w-full rounded-md bg-white px-2 text-wb-13 text-wb-ink shadow-wb-outline outline-none focus:shadow-wb-focus";

    return (
        <div className="flex w-[680px] max-w-full flex-wrap" data-testid="drp-panel">
            {/* presets */}
            <div className="w-full border-b border-wb-border-sidebar p-3 md:w-[320px] md:border-r md:border-b-0">
                <p className="mb-1 text-wb-11 font-semibold uppercase text-wb-ntrl-5">{t("drp.year")}</p>
                <div className="flex items-center gap-2">
                    <Select value={String(year)} width={140} options={years.map((y) => ({ value: String(y), label: t("drp.year_n", { y }) }))} onChange={(v) => setYear(Number(v))} />
                    <button type="button" className={cn(chip(isSel(1, 12)), "flex-1 px-3")} onClick={() => months(1, 12)} disabled={future(1)} data-testid="drp-whole-year">
                        {t("drp.whole_year", { y: year })}
                    </button>
                </div>
                <p className={section}>{t("drp.month")}</p>
                <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <button key={m} type="button" disabled={future(m)} className={chip(isSel(m, m))} onClick={() => months(m, m)} data-testid={`drp-m${m}`}>
                            {t("drp.month_n", { m })}
                        </button>
                    ))}
                </div>
                <p className={section}>{t("drp.quarter")}</p>
                <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((q) => (
                        <button key={q} type="button" disabled={future(q * 3 - 2)} className={chip(isSel(q * 3 - 2, q * 3))} onClick={() => months(q * 3 - 2, q * 3)} data-testid={`drp-q${q}`}>
                            {t("drp.quarter_n", { q: ["I", "II", "III", "IV"][q - 1] })}
                        </button>
                    ))}
                </div>
                <p className={section}>{t("drp.half")}</p>
                <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" disabled={future(1)} className={chip(isSel(1, 6))} onClick={() => months(1, 6)} data-testid="drp-h1">
                        {t("drp.h1")}
                    </button>
                    <button type="button" disabled={future(7)} className={chip(isSel(7, 12))} onClick={() => months(7, 12)} data-testid="drp-h2">
                        {t("drp.h2")}
                    </button>
                </div>
            </div>
            {/* custom range */}
            <div className="min-w-0 flex-1 p-3">
                <div className="flex items-end gap-2">
                    <label className="flex-1 text-wb-11 text-wb-ntrl-6">
                        {t("drp.from")}
                        <input
                            value={fromTxt}
                            placeholder="dd/mm/yyyy"
                            data-testid="drp-from"
                            onChange={(e) => {
                                setFromTxt(e.target.value);
                                const v = parseDmy(e.target.value);
                                if (v && v <= today) {
                                    setA(v);
                                    setView({ y: Number(v.slice(0, 4)), m: Number(v.slice(5, 7)) });
                                }
                            }}
                            className={field}
                        />
                    </label>
                    <span className="pb-1.5 text-wb-ntrl-5">→</span>
                    <label className="flex-1 text-wb-11 text-wb-ntrl-6">
                        {t("drp.to")}
                        <input
                            value={toTxt}
                            placeholder="dd/mm/yyyy"
                            data-testid="drp-to"
                            onChange={(e) => {
                                setToTxt(e.target.value);
                                setB(parseDmy(e.target.value));
                            }}
                            className={field}
                        />
                    </label>
                </div>
                <div className="mt-2 flex items-center justify-between">
                    <b className="text-wb-13">{t("drp.month_y", { m: view.m, y: view.y })}</b>
                    <span className="flex gap-1">
                        <button type="button" aria-label={t("drp.prev_month")} onClick={() => nav(-1)} className="cursor-pointer rounded p-1 hover:bg-wb-bg-sidebar">
                            <ChevronLeft className="size-4" />
                        </button>
                        <button type="button" aria-label={t("drp.next_month")} onClick={() => nav(1)} className="cursor-pointer rounded p-1 hover:bg-wb-bg-sidebar">
                            <ChevronRight className="size-4" />
                        </button>
                    </span>
                </div>
                <div className="mt-1 grid grid-cols-7 text-center text-wb-11 text-wb-ntrl-5">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <span key={i}>{t(`drp.wd.${i}`)}</span>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5 text-center text-wb-13">
                    {cells.map((d, i) => {
                        if (!d) return <span key={`e${i}`} />;
                        const inRange = b ? d >= a && d <= b : d === a;
                        const edge = d === a || d === b;
                        return (
                            <button
                                key={d}
                                type="button"
                                disabled={d > today}
                                onClick={() => pickDay(d)}
                                data-day={d}
                                className={cn(
                                    "h-8 cursor-pointer tabular-nums disabled:cursor-not-allowed disabled:text-wb-ntrl-4",
                                    inRange && "bg-brand-softer",
                                    edge && "rounded-md bg-brand font-semibold text-white",
                                )}
                            >
                                {Number(d.slice(8))}
                            </button>
                        );
                    })}
                </div>
                <p className="mt-1 text-wb-11 text-wb-ntrl-5">{b ? t("drp.hint_done") : t("drp.hint_pick_end")}</p>
                <div className="mt-2 flex justify-end gap-2">
                    <Button size="wb-sm" variant="neutral" onClick={onCancel}>
                        {t("common.cancel")}
                    </Button>
                    <Button size="wb-sm" variant="primary" disabled={!valid} data-testid="drp-apply" onClick={() => b && onApply(a, b)}>
                        {t("drp.apply")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
