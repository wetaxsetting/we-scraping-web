/** Number / date formatting shared by every screen (VN conventions). */

export function fmtMoney(n: number): string {
    return Math.round(n).toLocaleString("vi-VN");
}

/** Compact money for KPI cards: 1.2 tỷ / 60.5 tr / 950 k (VI) — 1.2B / 60.5M (EN/KO). */
export function fmtCompact(n: number, locale: string): string {
    const abs = Math.abs(n);
    const vi = locale.toLowerCase() === "vi";
    if (abs >= 1e9) return `${(n / 1e9).toFixed(abs >= 1e10 ? 0 : 1).replace(".", vi ? "," : ".")}${vi ? " tỷ" : "B"}`;
    if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e8 ? 0 : 1).replace(".", vi ? "," : ".")}${vi ? " tr" : "M"}`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}${vi ? " k" : "K"}`;
    return String(Math.round(n));
}

/** "2026-09-15" → "15/09/2026" */
export function fmtDate(iso: string): string {
    if (!iso) return "";
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
}

/** ISO datetime → "15/09/2026 10:39" */
export function fmtDateTime(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    const p = (x: number) => String(x).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function todayIso(): string {
    const d = new Date();
    const p = (x: number) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
