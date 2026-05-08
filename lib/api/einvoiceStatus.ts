/**
 * Logical-status helpers for the Sales / Bill e-Invoice screens.
 *
 * <p>The legacy backend resolves {@code EINV_INVOICESTATUS} via the
 * {@code wb_get_invoice_status(value, LANG_CD)} DB function, so the
 * same logical state surfaces as different display strings depending
 * on the user's locale (vi / en / ko). The refactor's Phase 2 returns
 * the raw stored value (rule IR-4 — no DB function port), and the
 * frontend resolves the logical state via regex pattern matching
 * mirroring the legacy {@code loadTextColorInvBillOut}.
 *
 * <p>Six logical states (verified against
 * {@code WECMS DEV/.../einv_0001_001.ts:2788-2801}):
 * <ul>
 *   <li>{@code original}     — Hóa đơn mới / Original / 세금계산서</li>
 *   <li>{@code replacement}  — Hóa đơn thay thế / Replacement / 대체세금계산서</li>
 *   <li>{@code adjustment}   — Hóa đơn điều chỉnh / Adjustment / 수정세금계산서</li>
 *   <li>{@code replaced}     — Hóa đơn đã bị thay thế / Replaced / 대체된 세금계산서</li>
 *   <li>{@code adjusted}     — Hóa đơn đã bị điều chỉnh / Adjusted / 수정 (전)세금계산서</li>
 *   <li>{@code cancelled}    — Hóa đơn đã bị hủy / Cancelled / 취소된 세금계산서</li>
 * </ul>
 */

export type LogicalInvoiceStatus =
    | "original"
    | "replacement"
    | "adjustment"
    | "replaced"
    | "adjusted"
    | "cancelled"
    | "other";

/**
 * Regex patterns mirroring the legacy
 * {@code einv_0001_001.ts.loadTextColorInvBillOut} alternation. Order
 * matters — {@code replaced} / {@code adjusted} (past-passive forms)
 * must precede {@code replacement} / {@code adjustment} (active forms)
 * because the Vietnamese passive contains the active stem.
 */
const STATUS_PATTERNS: ReadonlyArray<{ key: LogicalInvoiceStatus; re: RegExp }> = [
    { key: "cancelled",   re: /(Hóa đơn đã bị hủy|Cancelled|취소된 세금계산서)/i },
    { key: "replaced",    re: /(Hóa đơn đã bị thay thế|Replaced|대체된 세금계산서)/i },
    { key: "adjusted",    re: /(Hóa đơn đã bị điều chỉnh|Adjusted|수정 \(전\)세금계산서)/i },
    { key: "replacement", re: /(Hóa đơn thay thế|Replacement|대체세금계산서)/i },
    { key: "adjustment",  re: /(Hóa đơn điều chỉnh|Adjustment|수정세금계산서)/i },
    { key: "original",    re: /(Hóa đơn mới|Original|세금계산서)/i },
];

/**
 * Match a localised {@code EINV_INVOICESTATUS} string to its logical
 * state. Returns {@code "other"} for any value that doesn't match the
 * 6 known patterns — the frontend renders these as plain text without
 * a colour token (mirrors legacy fallback).
 */
export function matchInvoiceStatus(raw: string | null | undefined): LogicalInvoiceStatus {
    if (!raw) return "other";
    const trimmed = raw.trim();
    if (!trimmed) return "other";
    for (const { key, re } of STATUS_PATTERNS) {
        if (re.test(trimmed)) return key;
    }
    return "other";
}

/**
 * Status-filter dropdown option key. The dropdown ships {@code all}
 * (clears the filter) plus the 4 actively-issued states; the two
 * past-passive states ({@code replaced}, {@code adjusted}) are not
 * filterable on the static UI per Figma 9194:6696. Bill / Expenses
 * shares the same option set.
 */
export type InvoiceStatusFilterKey =
    | "all"
    | "original"
    | "replacement"
    | "adjustment"
    | "cancelled";

/**
 * Wire-shaped value the backend will compare against
 * {@code EINV_INVOICESTATUS}. Returns the canonical English label for
 * non-{@code all} keys; the future backend filter (per IR-4 — not yet
 * implemented; Frontend MR B sends the param forward-compatibly) will
 * either accept this English form or run regex matching server-side.
 *
 * <p>Returns {@code undefined} for {@code "all"} so the wire param is
 * omitted entirely — backend then applies no status predicate.
 */
export function toWireStatusValue(key: InvoiceStatusFilterKey): string | undefined {
    if (key === "all") return undefined;
    switch (key) {
        case "original":    return "Original";
        case "replacement": return "Replacement";
        case "adjustment":  return "Adjustment";
        case "cancelled":   return "Cancelled";
    }
}

/**
 * Five dropdown options surfaced in the {@code <InvoiceStatusFilter>}.
 * The {@code labelKey} is i18n-scoped per page (Sales /
 * Bill share the keys; the Bill locale namespace mirrors them).
 */
export const INVOICE_STATUS_FILTER_OPTIONS: ReadonlyArray<{
    key: InvoiceStatusFilterKey;
    labelKey: string;
}> = [
    { key: "all",         labelKey: "filter.status.all" },
    { key: "original",    labelKey: "filter.status.original" },
    { key: "replacement", labelKey: "filter.status.replacement" },
    { key: "adjustment",  labelKey: "filter.status.adjustment" },
    { key: "cancelled",   labelKey: "filter.status.cancelled" },
];
