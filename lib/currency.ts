/**
 * Currency / amount formatting — port of the legacy OSMC helpers
 * (`_osmc.ui.formatAmount`, `_osmc.ui.formatNumber`,
 * `_osmc.ui.getCurrencySymbol`, `_osmc.ui.getLocalCurrency`).
 *
 * The Spring Boot backend wires raw numeric strings (no separators, no
 * symbol — see `domain/banking/service/AmountFormatter#wire`); the
 * frontend formats for display via this module so the wire payload
 * stays deterministic against seed data.
 *
 * Per-CCY locale + fraction rules MUST stay in lock-step with backend
 * `AmountFormatter.forDisplay(value, ccyCd)`. The on-screen tile, the
 * print popup, and the Excel subheader all run through these tables —
 * they need to print byte-identical strings for the same value/CCY.
 *
 * Locale rules mirror the legacy behaviour for the VN tenant:
 *   - VND       → vi-VN locale (period thousands), 0 fraction digits, ₫ suffix
 *   - USD / EUR → en-US locale (comma thousands), 2 fraction digits, $ / € prefix
 *   - KRW / JPY → en-US locale (comma thousands), 0 fraction digits, ₩ / ¥ prefix
 *   - Other currencies → vi-VN locale, 0 fraction digits, no symbol
 *     (extend `CCY_SYMBOLS` and `CCY_RULES` below as new currencies appear)
 *
 * Suffix-vs-prefix follows the OSMC `POS_NUM_DISP_TYPE` map for the VN
 * tenant: VND uses "002" (`1{radix_point}1{ccy_sym}`), USD uses "001"
 * (`{ccy_sym}1{radix_point}1`). Currencies not on the table render
 * without a symbol.
 */

const CCY_SYMBOLS: Record<string, string> = {
    VND: "₫",
    USD: "$",
    EUR: "€",
    KRW: "₩",
    JPY: "¥",
};

/** Currencies whose symbol prefixes the number (legacy POS_NUM_DISP_TYPE 001 / 003). */
const PREFIX_SYMBOL: ReadonlySet<string> = new Set(["USD", "EUR", "KRW", "JPY"]);

/**
 * Per-CCY formatting rules. Mirrors backend `AmountFormatter.forDisplay`
 * so the frontend tile and the backend Excel subheader print byte-equal
 * strings. Add a row when a new CCY appears in real data; until then
 * unknown currencies fall through to {@link DEFAULT_RULE}.
 */
type CcyRule = { locale: string; fractionDigits: number };

const CCY_RULES: Record<string, CcyRule> = {
    VND: { locale: "vi-VN", fractionDigits: 0 },
    USD: { locale: "en-US", fractionDigits: 2 },
    EUR: { locale: "en-US", fractionDigits: 2 },
    KRW: { locale: "en-US", fractionDigits: 0 },
    JPY: { locale: "en-US", fractionDigits: 0 },
};

/**
 * Fallback for any CCY not explicitly listed in {@link CCY_RULES}.
 * Matches backend `AmountFormatter.forDisplay`'s `default` branch
 * (vi-VN, 0 fraction digits, no symbol) — keep these in sync.
 */
const DEFAULT_RULE: CcyRule = { locale: "vi-VN", fractionDigits: 0 };

/**
 * Memoise constructed `Intl.NumberFormat` instances — construction is
 * non-trivial and the per-page render hits {@link formatAmount} many
 * times. Cache key combines locale and fractionDigits because two
 * different CCYs may share a rule (e.g. KRW + JPY).
 */
const FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

function getFormatter(rule: CcyRule): Intl.NumberFormat {
    const key = `${rule.locale}|${rule.fractionDigits}`;
    let cached = FORMATTER_CACHE.get(key);
    if (!cached) {
        cached = new Intl.NumberFormat(rule.locale, {
            minimumFractionDigits: rule.fractionDigits,
            maximumFractionDigits: rule.fractionDigits,
        });
        FORMATTER_CACHE.set(key, cached);
    }
    return cached;
}

/** Sprint 1 tenant is `VN_VNM0004_000001` — local currency is VND. */
export function getLocalCurrency(): "VND" {
    return "VND";
}

export function getCurrencySymbol(ccy?: string | null): string {
    if (!ccy) return "";
    return CCY_SYMBOLS[ccy.trim().toUpperCase()] ?? "";
}

/**
 * Format a money value for display. Mirrors `_osmc.ui.formatAmount(num, ccyCd, incSymbol)`.
 * Accepts the raw wire strings the backend emits — null / empty / NaN
 * collapse to `"0"` so the table never renders a blank cell.
 *
 * Locale + fraction rules per CCY are sourced from {@link CCY_RULES};
 * unknown currencies fall through to {@link DEFAULT_RULE}. Stays in
 * lock-step with backend `AmountFormatter.forDisplay`.
 */
export function formatAmount(
    value: string | number | null | undefined,
    ccy: string = "VND",
    includeSymbol: boolean = true,
): string {
    const n = parseAmount(value);
    if (n === null) return includeSymbol ? withSymbol("0", ccy) : "0";
    const ccyU = ccy.trim().toUpperCase();
    const rule = CCY_RULES[ccyU] ?? DEFAULT_RULE;
    const formatted = getFormatter(rule).format(n);
    if (!includeSymbol) return formatted;
    return withSymbol(formatted, ccyU);
}

/**
 * Format a value as a plain locale-aware number (no currency symbol,
 * no fraction digits). Mirrors `_osmc.ui.formatNumber(num)`.
 */
export function formatNumber(value: string | number | null | undefined): string {
    const n = parseAmount(value);
    if (n === null) return "0";
    return getFormatter(CCY_RULES.VND).format(n);
}

function withSymbol(formatted: string, ccyU: string): string {
    const sym = getCurrencySymbol(ccyU);
    if (!sym) return formatted;
    return PREFIX_SYMBOL.has(ccyU) ? `${sym}${formatted}` : `${formatted}${sym}`;
}

function parseAmount(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n : null;
}

/**
 * Format an exchange rate value for display in the rate matrix table.
 *
 * Rates < 1 (e.g. KRW 0.0504 per VND unit from the Coocon API) need 4
 * decimal places to avoid rendering "0.05" when the real value is 0.0504.
 * All other rates use 2 decimal places (standard FX convention).
 * Comma grouping uses en-US locale so thousands separators are commas
 * regardless of the user's browser locale.
 *
 * Returns "—" (em-dash) for null / undefined — consistent with the
 * legacy JEX exchange rate table's missing-rate placeholder.
 */
export function formatExchangeRate(value: number | null | undefined): string {
    if (value === null || value === undefined) return "-";
    const decimals = value < 1 ? 4 : 2;
    return value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}
