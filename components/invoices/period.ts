/**
 * Quick period presets used on the invoice list + dashboard (Invoy "Chọn nhanh"); `m2026-09` = one month,
 * `r2026-01-01_2026-11-27` = a range from the date-range picker (UI Spec v1.2 §3.6).
 */
export type PeriodKey = "this_year" | "last_year" | "q1" | "q2" | "q3" | "q4" | `m${string}` | `r${string}`;

/** Range from the date-range picker → period key. */
export const rangeKey = (from: string, to: string) => `r${from}_${to}` as PeriodKey;

export const CURRENT_YEAR = new Date().getFullYear();

export function periodRange(key: PeriodKey, year = CURRENT_YEAR): { from: string; to: string } {
    if (key.startsWith("r")) {
        const [from, to] = key.slice(1).split("_");
        return { from, to };
    }
    if (key === "this_year") return { from: `${year}-01-01`, to: `${year}-12-31` };
    if (key === "last_year") return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    if (key.startsWith("q")) {
        const q = Number(key.slice(1));
        const m1 = (q - 1) * 3 + 1;
        const m3 = m1 + 2;
        const last = new Date(year, m3, 0).getDate();
        return { from: `${year}-${String(m1).padStart(2, "0")}-01`, to: `${year}-${String(m3).padStart(2, "0")}-${last}` };
    }
    // "m2026-09"
    const [y, m] = key.slice(1).split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: `${y}-${String(m).padStart(2, "0")}-${last}` };
}

/** Default period of the invoice lists = the CURRENT MONTH (UI Spec v1.2 §3.6, B2). */
export function currentMonthKey(now = new Date()): PeriodKey {
    return `m${currentMonth(now)}` as PeriodKey;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
/** "YYYY-MM-DD" of a local date. */
export const isoDay = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
/** Days in month m (1–12) of year y. */
export const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
/** "YYYY-MM-DD" of today (local). */
export const todayIsoDay = (now = new Date()) => isoDay(now.getFullYear(), now.getMonth() + 1, now.getDate());

/** "YYYY-MM-DD" → "dd/mm/yyyy". */
export const toDmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** Typed "d/m/yyyy" → "YYYY-MM-DD", or null when it is not a real date. */
export function parseDmy(s: string): string | null {
    const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
    return isoDay(y, mo, d);
}

/** Month m (1–12) of year y starts after today → locked in the picker (§3.6). */
export const isFutureMonth = (y: number, m: number, today: string) => isoDay(y, m, 1) > today;

/**
 * Months m1…m2 of year y as a range; the end never passes today (§3.6: "ngày kết thúc không quá hôm nay").
 * Null when the whole range lies in the future.
 */
export function monthsRange(y: number, m1: number, m2: number, today: string): { from: string; to: string } | null {
    const from = isoDay(y, m1, 1);
    if (from > today) return null;
    const end = isoDay(y, m2, daysInMonth(y, m2));
    return { from, to: end > today ? today : end };
}

/** First month the month pickers offer (GDT e-invoice data, TT78). */
export const MIN_MONTH = "2022-01";

/** Longest sync range the backend accepts (`SyncRunService.MAX_MONTHS`, WBE3023). */
export const MAX_SYNC_MONTHS = 36;

/** "YYYY-MM" of the given (default: current) local date. */
export function currentMonth(now = new Date()): string {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" shifted by n months (n may be negative). */
export function addMonths(ym: string, n: number): string {
    const [y, m] = ym.split("-").map(Number);
    const i = y * 12 + (m - 1) + n;
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" → "MM/YYYY". */
export function fmtMonth(ym: string): string {
    return `${ym.slice(5)}/${ym.slice(0, 4)}`;
}

/** Latest "to" month allowed for a sync starting at `from`: not in the future, at most MAX_SYNC_MONTHS long. */
export function syncRangeEnd(from: string, now = currentMonth()): string {
    const last = addMonths(from, MAX_SYNC_MONTHS - 1);
    return last < now ? last : now;
}

/** Keep `to` inside [from, syncRangeEnd(from)] after "from" changed. */
export function fitSyncTo(from: string, to: string, now = currentMonth()): string {
    if (to < from) return from;
    const end = syncRangeEnd(from, now);
    return to > end ? end : to;
}
