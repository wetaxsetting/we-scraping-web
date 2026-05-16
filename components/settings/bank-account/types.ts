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
    /** Legacy `BANK_CD` — primary key on the wire. Used to resolve the
     *  real bank logo via `resolveBankHeroLogoUrl` and to address the
     *  per-row endpoints (`/api/v1/settings/bank-account/{bankCd}/{acctNo}`). */
    bankCd: string;
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
    /** VAS Account FK — `BUSI_VAS_ACCT_INFM.VAS_ACCT_SEQ_NO`. `0` /
     *  `null` when this bank account has no VAS mapping. Used by the
     *  edit dialog to seed the picker. */
    vasAcctSeqNo: number;
    /** Short VAS code rendered in the "VAS Code" column (e.g. `"333"`).
     *  Mirrors legacy `comm_0183_001.ts:772`. Empty when no mapping. */
    vasCode: string;
    /** VAS account name rendered in the "VAS Account Name" column —
     *  the raw `VAS_ACCT_NM` (e.g. `"Test"`). */
    vasAccountName: string;
    /** VAS account display string with currency suffix
     *  (e.g. `"Test(VND)"`). Kept for table cells that want the
     *  compact one-line label. Empty when no mapping. */
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
