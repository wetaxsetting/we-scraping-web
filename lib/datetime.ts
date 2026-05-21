/**
 * Date/time helpers — port of the legacy `common.app.humanizeDatetime`
 * + `formatDateTimeForView` used by Account Inquiry's Last Update column.
 *
 * The backend wires `ACCT_BAL_UPD_DTM` as a 14-character
 * `YYYYMMDDHHmmss` string (the legacy `ACCT_BAL_LST_INQ_DTM` shape).
 * Empty / missing → empty display (the legacy renders `<td></td>`).
 *
 * Bucketing mirrors `wabooks.comm.humanizeDatetime` so the output
 * reads identically to the live JEX system:
 *   - minutes <  5            → relative_time.just_now
 *   - minutes  5-9            → relative_time.minutes_n {n:5}
 *   - minutes 10-19/20-29/…   → relative_time.minutes_n {n:10/20/…}
 *   - hours      1            → relative_time.hour_1
 *   - hours    > 1            → relative_time.hours_n {n}
 *   - days       1            → relative_time.day_1
 *   - days       6            → relative_time.week_1
 *   - days     > 1 (and ≠ 6)  → relative_time.days_n {n}
 *   - weeks      1            → relative_time.week_1
 *   - weeks    > 1            → relative_time.weeks_n {n}
 *   - months     1            → relative_time.month_1
 *   - months   2-3            → relative_time.months_n {n}
 *   - months   > 3            → relative_time.months_3plus
 *
 * All display strings are resolved through the `t` function so callers
 * that have a locale context pass `t` from `useTranslation()`. Call
 * sites without a locale context (server code, tests) may omit `t` and
 * receive the English fallback automatically.
 */

import type { Locale } from "@/lib/i18n";

/** Same signature as `LocaleContextValue["t"]` so callers can pass it directly. */
export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

// English fallback strings — kept in sync with locales/en.json.
// Used when humanizeDatetime is called without a t function.
const EN_FALLBACK: Record<string, string> = {
    "relative_time.just_now": "just now",
    "relative_time.minutes_n": "{n}mn ago",
    "relative_time.hour_1": "1hr ago",
    "relative_time.hours_n": "{n}hr ago",
    "relative_time.day_1": "1d ago",
    "relative_time.days_n": "{n}d ago",
    "relative_time.week_1": "1 week ago",
    "relative_time.weeks_n": "{n} weeks ago",
    "relative_time.month_1": "1 month ago",
    "relative_time.months_n": "{n} months ago",
    "relative_time.months_3plus": "3+ months ago",
};

function defaultT(key: string, vars?: Record<string, string | number>): string {
    const raw = EN_FALLBACK[key] ?? key;
    if (!vars) return raw;
    return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
        raw,
    );
}

/** Map a minute count (5-59) to its bucket lower bound: 5, 10, 20, 30, 40, 50. */
function minuteBucket(mn: number): number {
    if (mn < 10) return 5;
    if (mn < 20) return 10;
    if (mn < 30) return 20;
    if (mn < 40) return 30;
    if (mn < 50) return 40;
    return 50;
}

/** Parse a `YYYYMMDDHHmmss` (or shorter `YYYYMMDD`) wire string into a
 *  local-time `Date`. Returns `null` for empty / malformed input. */
export function parseLegacyTimestamp(value: string | null | undefined): Date | null {
    if (!value) return null;
    const m = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?$/.exec(value.trim());
    if (!m) return null;
    return new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4] ?? "0"),
        Number(m[5] ?? "0"),
        Number(m[6] ?? "0"),
    );
}

/**
 * Display timezone for every WeCMS user-facing date/time conversion.
 * Pinned to Asia/Ho_Chi_Minh — the live system runs in Vietnam (GMT+7).
 *
 * Backend stores audit-log + entity timestamps in UTC (see
 * `wecms-api/.../AuditLogService.java:181` and
 * `FirmBankingSettingsService.java:319`); the frontend converts at the
 * mapper boundary so users see their local clock instead of the raw
 * UTC string.
 *
 * If a future MR adds a per-user timezone preference, this constant
 * becomes the fallback and consumers read the preference instead —
 * the helper signature already takes an optional `timeZone` so no
 * call site needs to change for that follow-up.
 */
export const WECMS_DISPLAY_TZ = "Asia/Ho_Chi_Minh";

/**
 * Configuration for {@link formatLegacyDtmInDisplayTz}.
 */
export type LegacyDtmFormatOptions = {
    /** IANA timezone for the conversion. Defaults to
     *  {@link WECMS_DISPLAY_TZ}. */
    timeZone?: string;
    /**
     * Date layout for the output `date` string.
     *   - `"DMY"` (default) → `DD-MM-YYYY` (audit-log convention,
     *     mirrors Figma audit-table cell + Vietnam locale).
     *   - `"YMD"`           → `YYYY-MM-DD` (firm-banking-history
     *     transaction-date column convention).
     */
    dateFormat?: "DMY" | "YMD";
};

/**
 * Convert a legacy 14-character `YYYYMMDDHHmmss` **UTC** wire string
 * to the user's display timezone (Asia/Ho_Chi_Minh by default) and
 * split it into the canonical `{ date, time }` parts the audit-log /
 * firm-banking-history tables consume.
 *
 * The wire convention across every refactor backend `*_DTM` /
 * `REG_DTM` / `MOD_DTM` column is "yyyyMMddHHmmss UTC" stored in a
 * `VARCHAR(14)`. A naive substring split (the legacy `splitRegDtm` /
 * `splitTarnDtm` pattern) displays UTC as if it were local time — off
 * by 7 hours in Vietnam — so every mapper that surfaces a 14-char
 * timestamp routes through this helper.
 *
 * <p>Behaviour:
 * <ul>
 *   <li><b>14 chars</b> (full timestamp) — interpreted as UTC instant
 *       via {@code Date.UTC(...)}, formatted via
 *       {@code Intl.DateTimeFormat} with an explicit
 *       {@code timeZone}. {@code hourCycle: "h23"} avoids the
 *       {@code en-US} "24:..." midnight quirk that {@code hour12: false}
 *       alone has on some browser engines.</li>
 *   <li><b>8 chars</b> (date-only) — calendar date with no UTC
 *       semantics; formatted directly from the substrings without a
 *       timezone shift, {@code time} returns empty.</li>
 *   <li><b>Empty / malformed</b> — both parts return empty (caller
 *       renders a blank cell, mirrors the legacy guard).</li>
 * </ul>
 *
 * <p>{@code Intl.DateTimeFormat} with an explicit {@code timeZone} is
 * the only browser-portable way to render a UTC instant in a specific
 * zone regardless of the user's system timezone. Do not refactor to a
 * `Date#toLocaleString` shortcut — that's locale-string-formatted and
 * varies by browser engine.
 */
export function formatLegacyDtmInDisplayTz(
    value: string | null | undefined,
    options: LegacyDtmFormatOptions = {},
): { date: string; time: string } {
    const { timeZone = WECMS_DISPLAY_TZ, dateFormat = "DMY" } = options;

    if (!value) return { date: "", time: "" };
    const trimmed = String(value).trim();
    const m = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?$/.exec(trimmed);
    if (!m) return { date: "", time: "" };

    const hasTime = m[4] !== undefined;

    // Date-only inputs are calendar dates, not UTC instants. The
    // legacy backend uses `YYYYMMDD` for fields like `TRSC_DT` that
    // carry no clock — applying a TZ shift would visibly drift the
    // date by ±1 day at the seam, which is wrong. Format from
    // substrings.
    if (!hasTime) {
        const yyyy = m[1];
        const mm = m[2];
        const dd = m[3];
        const date = dateFormat === "YMD"
            ? `${yyyy}-${mm}-${dd}`
            : `${dd}-${mm}-${yyyy}`;
        return { date, time: "" };
    }

    const utcMs = Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6]),
    );
    const instant = new Date(utcMs);
    if (Number.isNaN(instant.getTime())) return { date: "", time: "" };

    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(instant);

    const lookup: Record<string, string> = {};
    for (const p of parts) {
        if (p.type !== "literal") lookup[p.type] = p.value;
    }
    const { year, month, day, hour, minute, second } = lookup;
    if (!year || !month || !day || !hour || !minute || !second) {
        return { date: "", time: "" };
    }

    const date = dateFormat === "YMD"
        ? `${year}-${month}-${day}`
        : `${day}-${month}-${year}`;
    const time = `${hour}:${minute}:${second}`;
    return { date, time };
}

/** Format a `YYYYMMDDHHmmss` for tooltip display: `DD-MM-YYYY HH:mm:ss`.
 *  Mirrors `common.app.formatDateTimeForView`. Empty / malformed → "". */
export function formatDateTimeForView(value: string | null | undefined): string {
    const d = parseLegacyTimestamp(value);
    if (!d) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss}`;
}

/** English short-month names — same set legacy {@code common.app.formatDateLang}
 *  uses (Jan / Feb / … / Dec). Indexed by zero-based month. */
const FORMAT_DATE_LANG_MONTHS_EN = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * Format an ISO {@code YYYY-MM-DD} date as a {@code DD-MMM-YYYY} chip
 * string — {@code 2025-01-05 → 05-Jan-2025}.
 *
 * <p>Used by every filter row that renders a date chip — the shared
 * {@code <DateRangePicker>} (Approval Box, e-Invoices, Reports, …),
 * the {@code <DateRangeFilter>} (Settings → ERP Transaction History,
 * Firm Banking History), and the Firm Banking History table column.
 *
 * <p>The output is locale-independent on purpose: Figma (WB365) shows
 * the EN short-month form on every locale, so a date chip should read
 * the same in EN / KO / VI / KM.
 *
 * <p>Returns the input unchanged when the wire string is not a strict
 * {@code YYYY-MM-DD} match — surfaces malformed input visibly instead
 * of dropping the value.
 */
export function formatDateChip(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    const month = FORMAT_DATE_LANG_MONTHS_EN[Number(m[2]) - 1] ?? m[2];
    return `${m[3]}-${month}-${m[1]}`;
}

/**
 * Locale-aware date-only formatter — port of legacy
 * {@code common.app.formatDateLang(dateStr, lang)} from
 * {@code WECMS_STATIC/web/js/wabooks/wabooks.comm_osmc.js}. Used by every
 * legacy page that displays a "date" column where the format differs per
 * locale — Account Inquiry's transaction-date column, Card Transactions,
 * and Operation Status Inquiry's Last Update.
 *
 * <p>Input: legacy {@code YYYYMMDD} (or {@code YYYYMMDDHHmmss} — the
 * helper slices the leading 8 chars). Output:
 *
 * <ul>
 *   <li>{@code locale = "EN"} → {@code DD-MMM-YYYY} (e.g. {@code "29-Sep-2025"})</li>
 *   <li>{@code locale = "KO"} → {@code YYYY-MM-DD} (e.g. {@code "2025-09-29"})</li>
 *   <li>everything else (VI, future KM) → {@code DD-MM-YYYY}
 *       (e.g. {@code "29-09-2025"}) — falls back to legacy
 *       {@code formatDateForView} via the same {@code DD-MM-YYYY} shape
 *       returned by {@code getLocaleDateFormat()}.</li>
 * </ul>
 *
 * <p>Empty / malformed input → empty string (mirrors legacy "{@code
 * dateStr.length < 8 → return ''}" guard). The time portion is
 * intentionally discarded — legacy splits the formatted datetime on
 * the space and renders only the date half.
 *
 * <p>This helper is the canonical refactor port; pages SHOULD NOT
 * inline {@code substring(0, 8)} + per-locale switch logic. Reuse
 * across screens keeps the locale rules in one place.
 *
 * @param value  legacy {@code YYYYMMDD} or {@code YYYYMMDDHHmmss}
 *               wire string (also accepts {@code null} / {@code undefined})
 * @param locale active {@link Locale} from {@code useTranslation().locale}
 */
export function formatDateLang(
    value: string | null | undefined,
    locale: Locale,
): string {
    if (!value) return "";
    const trimmed = String(value).trim();
    if (trimmed.length < 8) return "";
    const year  = trimmed.substring(0, 4);
    const month = trimmed.substring(4, 6);
    const day   = trimmed.substring(6, 8);
    const monthIdx = parseInt(month, 10) - 1;
    if (Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return "";

    if (locale === "EN") {
        return `${day}-${FORMAT_DATE_LANG_MONTHS_EN[monthIdx]}-${year}`;
    }
    if (locale === "KO") {
        return `${year}-${month}-${day}`;
    }
    // VI / KM / fallback — legacy `formatDateForView` returns the
    // user-locale default `DD-MM-YYYY`.
    return `${day}-${month}-${year}`;
}

/**
 * Convert a legacy `YYYYMMDDHHmmss` timestamp to a translated relative-time
 * display string. Returns `""` (empty cell) when the value is missing /
 * malformed — matches the legacy `<td></td>` empty case.
 *
 * Pass `t` from `useTranslation()` so the output respects the active locale.
 * Omitting `t` falls back to English (backward-compatible with non-React call
 * sites such as the print helper).
 */
export function humanizeDatetime(
    value: string | null | undefined,
    t: TFunc = defaultT,
): string {
    const d = parseLegacyTimestamp(value);
    if (!d) return "";

    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return t("relative_time.just_now"); // future / clock skew

    const minutes = diffMs / 60000;
    const hours = minutes / 60;
    const days = hours / 24;
    const weeks = days / 7;
    const months = days / 30;

    if (months >= 1) {
        const m = Math.floor(months);
        if (m === 1) return t("relative_time.month_1");
        if (m > 3) return t("relative_time.months_3plus");
        return t("relative_time.months_n", { n: m });
    }
    if (weeks >= 1) {
        const w = Math.floor(weeks);
        return w === 1 ? t("relative_time.week_1") : t("relative_time.weeks_n", { n: w });
    }
    if (days >= 1) {
        const dn = Math.floor(days);
        if (dn === 1) return t("relative_time.day_1");
        if (dn === 6) return t("relative_time.week_1");
        return t("relative_time.days_n", { n: dn });
    }
    if (hours >= 1) {
        const h = Math.floor(hours);
        return h === 1 ? t("relative_time.hour_1") : t("relative_time.hours_n", { n: h });
    }
    if (minutes > 0) {
        const mn = Math.floor(minutes);
        if (mn < 5) return t("relative_time.just_now");
        return t("relative_time.minutes_n", { n: minuteBucket(mn) });
    }
    return t("relative_time.just_now");
}
