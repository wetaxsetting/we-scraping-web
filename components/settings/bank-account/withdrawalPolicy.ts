/**
 * Withdrawal-permission bank whitelist (frontend mirror of the backend
 * `WithdrawalBankPolicy`).
 *
 * Withdraw permission (`AUTH_TYPE='W'`) is only legal on the five firm-banking
 * banks that support outbound withdrawal — legacy `comm_0183` WBE0452 rule,
 * business decision 2026-06-16 = keep. For every other bank the Withdraw
 * Permission control is disabled in the table (View Permission stays available).
 *
 * Keep in lockstep with the backend constant in
 * `wecms-api` `domain/setting/bankaccount/service/WithdrawalBankPolicy.java`.
 */
export const WITHDRAWAL_ALLOWED_BANK_CDS: ReadonlySet<string> = new Set([
    "11704004", // Vietcombank
    "11704003", // IBK
    "11704088", // Shinhan
    "11704020", // Woori
    "11704001", // Vietin
]);

/** `true` when `bankCd` is one of the withdrawal-capable banks. */
export function isWithdrawalAllowedBank(bankCd: string | null | undefined): boolean {
    return bankCd != null && WITHDRAWAL_ALLOWED_BANK_CDS.has(bankCd.trim());
}
