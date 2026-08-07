/**
 * Human-readable tax-period label.
 *
 * The API's own `period_label` returns `"01/2026"` for January and `"Q1/2026"`
 * for the first quarter. Only the quarter carries a marker, so `"01/2026"` reads
 * as "Q1" to anyone scanning the list — that misreading happened during review
 * on 2026-08-04, on a row that was actually a monthly declaration. Since a
 * declaration is filed either monthly or quarterly and the two overlap in
 * meaning, the period type has to be visible in the label.
 *
 * Every field needed is already on the row, so the label is derived rather than
 * trusted: `period_type` + `period_value` + `decl_year`.
 */

export type VatPeriod = {
    periodType?: string | null;
    periodValue?: number | null;
    declYear?: number | null;
};

/**
 * @param t          `useTranslation().t`
 * @param period     the row / detail carrying the three period fields
 * @param fallback   the API's `period_label`, used when the fields are absent
 */
export function formatVatPeriod(
    t: (key: string, vars?: Record<string, string | number>) => string,
    period: VatPeriod,
    fallback = "",
): string {
    const { periodType, periodValue, declYear } = period;
    if (!periodType || periodValue == null || declYear == null) return fallback;

    const type = periodType.toUpperCase();
    if (type === "M") {
        return t("tax_filing.period.month", {
            // Two digits so "Tháng 01/2026" lines up with "Tháng 12/2026".
            value: String(periodValue).padStart(2, "0"),
            year: declYear,
        });
    }
    if (type === "Q") {
        return t("tax_filing.period.quarter", { value: periodValue, year: declYear });
    }
    return fallback;
}
