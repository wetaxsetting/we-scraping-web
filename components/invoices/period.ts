/** Quick period presets used on the invoice list + dashboard (Invoy "Chọn nhanh"). */
export type PeriodKey = "this_year" | "last_year" | "q1" | "q2" | "q3" | "q4" | `m${string}`;

export const CURRENT_YEAR = new Date().getFullYear();

export function periodRange(key: PeriodKey, year = CURRENT_YEAR): { from: string; to: string } {
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
