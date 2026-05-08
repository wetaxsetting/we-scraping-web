import type { ViewSettingItem } from "@/components/shared/view-setting";

/**
 * Static View Setting column definitions for the Bank Account panel.
 *
 * Mirrors the wire shape of `ApiScreenOptionItem` so the static panel can
 * feed the shared <ViewSettingPopover> (CLAUDE.md §13) without going
 * through the `useViewSetting` API hook. Real backend wiring would supply
 * the same shape from `GET /api/v1/screen-options/{webSvcId}/{dymAreaId}`.
 *
 * `FIELD_NM` carries the column's English display name; the popover is
 * passed a `getLabel` translator that maps the `FIELD_ID` to the i18n
 * header key already used by [BankAccountTable.tsx], so EN / KO / VI all
 * resolve through the existing `settings.bank_account.col.*` key set.
 */
export type BankAccountFieldId =
    | "ACCOUNT"
    | "ACCOUNT_NICKNAME"
    | "DESCRIPTION"
    | "ACCOUNT_TYPE"
    | "MATURITY_DATE"
    | "VAS_CODE"
    | "VAS_ACCOUNT_NAME"
    | "VIEW_PERMISSION"
    | "WITHDRAWAL_PERMISSION"
    | "AUDIT_LOGS";

export const BANK_ACCOUNT_FIELD_LABEL_KEY: Record<BankAccountFieldId, string> = {
    ACCOUNT: "settings.bank_account.col.account",
    ACCOUNT_NICKNAME: "settings.bank_account.col.nickname",
    DESCRIPTION: "settings.bank_account.col.description",
    ACCOUNT_TYPE: "settings.bank_account.col.type",
    MATURITY_DATE: "settings.bank_account.col.maturity",
    VAS_CODE: "settings.bank_account.col.vas_code",
    VAS_ACCOUNT_NAME: "settings.bank_account.col.vas_name",
    VIEW_PERMISSION: "settings.bank_account.col.view_permission",
    WITHDRAWAL_PERMISSION: "settings.bank_account.col.withdrawal_permission",
    AUDIT_LOGS: "settings.bank_account.col.audit_logs",
};

export const DEFAULT_BANK_ACCOUNT_VIEW_SETTING_ITEMS: ViewSettingItem[] = [
    { field_id: "ACCOUNT",               field_nm: "Account",                disp_ord: 1,  use_yn: "Y", fix_yn: "N" },
    { field_id: "ACCOUNT_NICKNAME",      field_nm: "Account Nickname",       disp_ord: 2,  use_yn: "Y", fix_yn: "N" },
    { field_id: "DESCRIPTION",           field_nm: "Description",            disp_ord: 3,  use_yn: "Y", fix_yn: "N" },
    { field_id: "ACCOUNT_TYPE",          field_nm: "Account Type",           disp_ord: 4,  use_yn: "Y", fix_yn: "N" },
    { field_id: "MATURITY_DATE",         field_nm: "Maturity Date",          disp_ord: 5,  use_yn: "Y", fix_yn: "N" },
    { field_id: "VAS_CODE",              field_nm: "VAS Code",               disp_ord: 6,  use_yn: "Y", fix_yn: "N" },
    { field_id: "VAS_ACCOUNT_NAME",      field_nm: "VAS Account Name",       disp_ord: 7,  use_yn: "Y", fix_yn: "N" },
    { field_id: "VIEW_PERMISSION",       field_nm: "View Permission",        disp_ord: 8,  use_yn: "Y", fix_yn: "N" },
    { field_id: "WITHDRAWAL_PERMISSION", field_nm: "Withdrawal Permission",  disp_ord: 9,  use_yn: "Y", fix_yn: "N" },
    { field_id: "AUDIT_LOGS",            field_nm: "Audit Logs",             disp_ord: 10, use_yn: "Y", fix_yn: "N" },
];
