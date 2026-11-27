/** Number / date formatting shared by every screen (VN conventions). */

export function fmtMoney(n: number): string {
    return Math.round(n).toLocaleString("vi-VN");
}

/**
 * Invoice currency as an ISO 4217 code (spec 02 §3.3 as amended: any `DVTTe`; `VNĐ` / `Đ` / blank → `VND`).
 * The backend already normalises; this guards mock / uploaded data.
 */
export function invoiceCurrency(c?: string | null): string {
    const s = (c ?? "").trim().toUpperCase();
    return !s || s === "VNĐ" || s === "Đ" ? "VND" : s;
}

const CCY_DIGITS = new Map<string, number>();

/** Minor-unit digits of a currency (USD/EUR 2, KRW/JPY 0); 2 for a code the runtime does not know. */
function currencyDigits(ccy: string): number {
    let d = CCY_DIGITS.get(ccy);
    if (d === undefined) {
        try {
            d = new Intl.NumberFormat("en", { style: "currency", currency: ccy }).resolvedOptions().maximumFractionDigits ?? 2;
        } catch {
            d = 2;
        }
        CCY_DIGITS.set(ccy, d);
    }
    return d;
}

/**
 * One invoice amount in the invoice's own currency, number only: VND as `fmtMoney` (no decimals),
 * other currencies with their minor-unit digits — USD 7303.84 → "7.303,84" (not rounded to "7.304").
 */
export function fmtInvoiceAmount(n: number, currency?: string | null): string {
    const ccy = invoiceCurrency(currency);
    if (ccy === "VND") return fmtMoney(n);
    const d = currencyDigits(ccy);
    return n.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** {@link fmtInvoiceAmount} with the ISO code as unit: "48.000 VND", "7.303,84 USD", "15.000 KRW" (user 2026-11-25). */
export function fmtInvoiceMoney(n: number, currency?: string | null): string {
    const ccy = invoiceCurrency(currency);
    return `${fmtInvoiceAmount(n, ccy)} ${ccy}`;
}

/**
 * Unit price as on the XML (UI Spec v1.2 §3.14): up to 6 decimals, not rounded to whole units;
 * a foreign currency keeps at least its minor-unit digits.
 */
export function fmtPrice(n: number, currency?: string | null): string {
    const ccy = invoiceCurrency(currency);
    const min = ccy === "VND" ? 0 : Math.min(currencyDigits(ccy), 6);
    return n.toLocaleString("vi-VN", { minimumFractionDigits: min, maximumFractionDigits: 6 });
}

/** Quantity as on the XML: up to 6 decimals (§3.14). */
export function fmtQty(n: number): string {
    return n.toLocaleString("vi-VN", { maximumFractionDigits: 6 });
}

/** Exchange rate: up to 4 decimals; "—" when unknown. */
export function fmtRate(r: number | null | undefined): string {
    return r == null ? "—" : r.toLocaleString("vi-VN", { maximumFractionDigits: 4 });
}

/** VAT rate label: −1 KCT, −2 KKKNT, else "n%". */
export function vatRateText(r: number): string {
    return r === -2 ? "KKKNT" : r < 0 ? "KCT" : `${r}%`;
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
