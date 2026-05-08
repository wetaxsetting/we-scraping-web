/**
 * Firm Banking Settings panel — Settings popup submenu (Figma 134:17061).
 *
 * Static UI types for the configuration screen: a pair of automation toggles
 * plus the list of linked banking accounts with status / last-update / kebab
 * row actions. Backend wiring lands later.
 */

export type FirmBankingAccountStatus = "active" | "inactive";

export type FirmBankingAutomationKey =
    | "match_payment_after_history"
    | "transfer_after_full_approval";

export type FirmBankingAutomationSetting = {
    key: FirmBankingAutomationKey;
    /** Translation key for the row label. */
    labelKey: string;
    enabled: boolean;
};

/**
 * Identity for the bank logo. The renderer ([BankLogo]) maps the key to a
 * brand colour + initials so the static UI stays self-contained until real
 * SVG / PNG bank assets are committed under `public/assets/banks/`.
 */
export type BankBrand = "woori" | "shinhan" | "bidv" | "vcb" | "hd_bank";

export type FirmBankingLinkedAccount = {
    id: string;
    bank: BankBrand;
    /** Display name as shown on the row (e.g. "WOORI BANK"). */
    bankName: string;
    /** Account number with currency suffix — e.g. "0001-000000561-14 (USD)". */
    accountNumber: string;
    currency: "USD" | "VND" | "KRW";
    status: FirmBankingAccountStatus;
    /** Free-form display string mirroring Figma — e.g. "30-10-2024, Krong". */
    lastUpdated: string;
};
