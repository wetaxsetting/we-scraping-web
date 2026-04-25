/**
 * Settings popup modal — Figma 9196:11717.
 *
 * Settings is a multi-panel popup: one left side-nav, many content panels
 * (Purpose, VAS Account, Contacts, Approval Line, …). The panel key is the
 * stable identity of each entry and drives both the nav's active state and
 * the right-side content swap.
 */
export type SettingsPanelKey =
    | "purpose"
    | "vas_account"
    | "contacts"
    | "approval_line"
    | "chart_of_accounts"
    | "login_credentials"
    | "bank_account"
    | "preferences"
    | "user"
    | "transaction_history"
    | "firm_banking_setting"
    | "firm_banking_history";
