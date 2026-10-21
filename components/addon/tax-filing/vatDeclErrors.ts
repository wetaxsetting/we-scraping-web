/**
 * Server error code → i18n key for the VAT declaration flows.
 *
 * Every code here was **observed from the live backend** on 2026-08-04, not
 * inferred from the spec — an earlier guess (`WBE_VAT_PREV_PERIOD_NOT_LOCKED`)
 * never matched anything, so the user saw the raw server string. When adding a
 * code, trigger it against the API first and paste the real value.
 *
 * Codes are shared by the dashboard actions (`useTaxFilingActions`) and the
 * create dialog, so the same failure reads identically wherever it surfaces.
 */
export const VAT_DECL_ERROR_KEYS: Readonly<Record<string, string>> = {
    // §9 create/lock order — the preceding period exists but is still Draft.
    WBE_VAT_DECL_PREV_NOT_LOCKED: "tax_filing.error.prev_period_not_locked",
    // §9 — no declaration at all for the preceding period (backend enforces
    // this across the year boundary: locking 01/2026 needs 12/2025 in place).
    WBE_VAT_DECL_PREV_MISSING: "tax_filing.error.prev_period_missing",
    // §9 unlock order — a later period is still locked, so this one is pinned.
    WBE_VAT_DECL_NEXT_LOCKED: "tax_filing.error.next_period_locked",
    // §9 delete order — a later period exists, so removing this one would
    // break the [43] → [22] chain behind it.
    WBE_VAT_DECL_LATER_PERIOD_EXISTS: "tax_filing.error.later_period_exists",
    // §11.2 — one declaration per (year, period type, period value).
    WBE_VAT_DECL_DUPLICATE_PERIOD: "tax_filing.error.duplicate_period",
    // A locked declaration rejects edit / sync / delete (§7.1 read-only).
    WBE_VAT_DECL_LOCKED: "tax_filing.error.decl_locked",
    WBE_VAT_DECL_NOT_FOUND: "tax_filing.error.decl_not_found",
};

/**
 * Localized message for a failed VAT declaration call. Falls back to the
 * server's own message so an unmapped code still says something specific, and
 * only then to a generic string.
 */
export function vatDeclErrorMessage(
    err: { code?: string; message?: string } | null | undefined,
    t: (key: string) => string,
): string {
    const key = err?.code ? VAT_DECL_ERROR_KEYS[err.code] : undefined;
    if (key) return t(key);
    return err?.message ?? t("common.error_unknown");
}
