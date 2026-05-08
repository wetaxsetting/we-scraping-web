/**
 * Bank Account panel — Settings popup submenu (Figma 142:18741).
 *
 * Static UI types for the bank-account management table — one row per
 * registered account, with VAS code wiring, view / withdrawal permission
 * roster, and the latest audit-log entry. Backend wiring lands later.
 */

export type BankAccountType = "current" | "saving";

export type BankAccountRow = {
    id: string;
    /** Bank name displayed as a blue link in the Account column. */
    bankName: string;
    /** Account number shown beneath the bank name. */
    accountNumber: string;
    /** ISO currency code displayed in parentheses next to the account number. */
    currency: "VND" | "USD" | "KRW";
    /** Free-form nickname (e.g. legacy Korean tag like "기업(1015)"). */
    nickname: string;
    /** Description text. Empty string renders the "-" placeholder. */
    description: string;
    accountType: BankAccountType;
    /**
     * Maturity date for saving accounts (e.g. "23-Sep-2025"). Empty for
     * current accounts; the cell renders blank.
     */
    maturityDate: string;
    /** Numeric VAS code (e.g. "11211"). */
    vasCode: string;
    /** First line of the VAS account name cell — the dotted code. */
    vasAccountCode: string;
    /** Second line of the VAS account name cell — bank label + currency. */
    vasAccountBank: string;
    /** Display label for the View Permission link (e.g. "김세명 외 3명"). */
    viewPermissionLabel: string;
    /** Display label for the Withdrawal Permission link. */
    withdrawalPermissionLabel: string;
    /** Audit-log actor + action (e.g. "김세명, 비번수정"). */
    auditLogActor: string;
    /** Audit-log date (e.g. "20-09-2024"). */
    auditLogDate: string;
};
