/** Quick period presets used on the invoice list + dashboard (Invoy "Chọn nhanh"). */
export type PeriodKey = "this_year" | "last_year" | "q1" | "q2" | "q3" | "q4" | `m${string}`;

export const CURRENT_YEAR = 2026;

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

/** Months Jan 2025 … Oct 2026 for the "Month…" select, newest first. */
export function monthOptions(): string[] {
    const out: string[] = [];
    for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 1; y--) {
        for (let m = 12; m >= 1; m--) {
            if (y === CURRENT_YEAR && m > 10) continue;
            out.push(`${y}-${String(m).padStart(2, "0")}`);
        }
    }
    return out;
}
