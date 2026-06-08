/**
 * Shared Payroll Type label resolver for the read-only Approval Details popup.
 *
 * Mirrors legacy `comm_0195_001.ts:885-898`:
 *   - withdrawal `BANK_CD === "11704088"` → "Salary/Allowance/Bonus"
 *     (overrides the fund-type code), else
 *   - `APPR_FUND_TP` `"0"` → Salary · `"1"` → Bonus · `"9"` → Other, else blank.
 *
 * Consumed by both Approval Details entry points so the displayed value is
 * identical regardless of path:
 *   - Payroll Scheduled Payment detail (`row.payrollType` = `appr_fund_tp` from
 *     the scheduled-list wire), and
 *   - Approval Box (`detail.appr_fund_tp` from the scheduled-detail response).
 * The withdrawal bank code arrives as the detail's `out_bank_cd` (Approval Box)
 * or `detailsWithdrawal.bankCd` (resolved from the same field).
 */

/** Withdrawal bank code that overrides the Payroll Type label to the combined
 *  "Salary/Allowance/Bonus" string (legacy `comm_0195_001.ts:894`). */
export const PAYROLL_TYPE_BANK_OVERRIDE_CD = "11704088";

export function resolvePayrollTypeLabel(
    apprFundTp: string | null | undefined,
    outBankCd:  string | null | undefined,
    t:          (key: string) => string,
): string {
    if (outBankCd === PAYROLL_TYPE_BANK_OVERRIDE_CD) {
        return t("payment.payroll.fund_type.salary_allowance_bonus");
    }
    switch (apprFundTp) {
        case "0": return t("payment.payroll.fund_type.salary");
        case "1": return t("payment.payroll.fund_type.bonus");
        case "9": return t("payment.payroll.fund_type.other");
        default:  return "";
    }
}
