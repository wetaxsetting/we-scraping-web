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
 * Locale rules mirror the LIVE WeCMS OSMC formatter, which formats every
 * amount on every list grid with `Intl.NumberFormat('id-ID', …)` — see
 * `WECMS DEV/WECMS_STATIC/web/js/osmc/osmc_baseData.js:9`
 * (`const _osmc_num_format = 'id-ID';`), `osmc.ui.ts:80-106`, and the
 * per-currency rule in `comm/osmc_ui_amtFormat.js`. The Indonesian locale
 * gives DOT thousands + COMMA decimal — the Vietnamese number convention.
 * Decimal count follows OSMC exactly: only USD gets 2 fraction digits; every
 * other currency renders with 0 (`osmc_ui_amtFormat` branches `if ('USD' ==
 * ccyCd)` → `_USDFormat` (2 dp) else `_numberwithoutDigitsFormat` (0 dp)).
 *   - VND → id-ID locale (dot thousands), 0 fraction digits, ₫ suffix    → 550.000
 *   - USD → id-ID locale (dot thousands), 2 fraction digits, $ prefix    → 10,00 / 1.234,50
 *   - KRW → id-ID locale, 0 fraction digits, ₩ prefix                    → 15.000
 *   - EUR / JPY → id-ID locale, 0 fraction digits, € / ¥ prefix (OSMC parity)
 *   - Other currencies → id-ID locale, 0 fraction digits, no symbol
 *     (extend `CCY_SYMBOLS` and `CCY_RULES` below as new currencies appear)
 *
 * NOTE: the backend `AmountFormatter.forDisplay` (used only for the Excel
 * export subheader) still mirrors the OLD per-CCY locale table. Until it is
 * aligned to id-ID, the on-screen amount and the exported XLSX subheader may
 * differ for USD — tracked as a backend follow-up, out of this change's scope.
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
    VND: { locale: "id-ID", fractionDigits: 0 },
    USD: { locale: "id-ID", fractionDigits: 2 },
    EUR: { locale: "id-ID", fractionDigits: 0 },
    KRW: { locale: "id-ID", fractionDigits: 0 },
    JPY: { locale: "id-ID", fractionDigits: 0 },
};

/**
 * Fallback for any CCY not explicitly listed in {@link CCY_RULES}.
 * Matches the legacy OSMC `_numberwithoutDigitsFormat` branch
 * (id-ID locale, 0 fraction digits, no symbol) — the rule every non-USD
 * currency falls through to in `osmc_ui_amtFormat.js`.
 */
const DEFAULT_RULE: CcyRule = { locale: "id-ID", fractionDigits: 0 };

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

/**
 * Maximum integer digits a VND (0-decimal) Amount field may carry.
 * Bounded by the backend column `BUSA_DOC_MSTR.TOTL_AMT` `NUMERIC(20,6)`
 * → 14 integer digits (20 total − 6 fractional). Kept here so the New
 * Receipt input and any future VND amount field share one ceiling; an
 * overrun would otherwise fail as a raw DB error server-side, so the cap
 * is enforced on input.
 */
export const MAX_VND_AMOUNT_INT_DIGITS = 14;

/**
 * Sanitise raw Amount-field keystrokes for a VND (0-decimal) money field.
 * Strips everything but digits, drops leading zeros, and caps the integer
 * length at {@link MAX_VND_AMOUNT_INT_DIGITS}. Returns the bare digit
 * string (no separators) — store this, send it to the API verbatim, and
 * feed it to {@link groupVndDigits} for display.
 *
 * Mirrors the legacy OSMC `_inputNumberDefaultMask` applied to the legacy
 * `#TOTL_AMT` field (`digits: 0`, `allowMinus: false`, `autoGroup: true`):
 *   "5.555.555" → "5555555"   (dots are display-only, stripped here)
 *   "-1"        → "1"         (minus rejected — VND is positive-only)
 *   "1.2.3"     → "123"       (no decimal point on a VND field)
 *   "007"       → "7"         (leading zeros dropped)
 */
export function sanitizeVndAmountDigits(
    raw: string,
    maxDigits: number = MAX_VND_AMOUNT_INT_DIGITS,
): string {
    const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    return digits.slice(0, maxDigits);
}

/**
 * Group an integer digit-string with the Vietnam (id-ID) thousands
 * separator — a dot. Operates on the raw string so it stays exact for
 * values beyond JS's safe-integer range (a VND amount can exceed 15
 * digits, where `Number()` / `Intl.NumberFormat` would lose precision).
 * Mirrors the legacy OSMC display for `_osmc_num_format === 'id-ID'`:
 *   "5555555" → "5.555.555"
 *   ""        → ""
 */
export function groupVndDigits(digits: string): string {
    const clean = digits.replace(/\D/g, "");
    if (!clean) return "";
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
