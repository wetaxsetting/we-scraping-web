/**
 * Static rows for the Select Bank Accounts popup (Figma 1081:25485).
 *
 * Static UI only — no API. Replace this constant with a real fetcher
 * (`useApiData` + `lib/api/bankAccounts.ts`) once the registration
 * endpoint lands; the popup composition above does not change.
 */

export type BankAccountRow = {
    id: string;
    accountNo: string;
    currency: string;
    /** Initial value of the row's Account Type dropdown — stays as
     *  "Select" placeholder for the static UI. */
    accountType: string;
    accountNickname: string;
    /** Initial Account Details value — empty so the placeholder shows. */
    accountDetails: string;
    vasCode: string;
    vasAccountName: string;
};

export const SELECT_BANK_ACCOUNTS_ROWS: readonly BankAccountRow[] = [
    {
        id: "92002-20202",
        accountNo: "92002-20202",
        currency: "KRW",
        accountType: "",
        accountNickname: "BIDV(5665)",
        accountDetails: "",
        vasCode: "1213122",
        vasAccountName: "1160.0280.9516 BIDV(VND)",
    },
    {
        id: "39383-398400-44",
        accountNo: "39383-398400-44",
        currency: "KRW",
        accountType: "",
        accountNickname: "BIDV(5665)",
        accountDetails: "",
        vasCode: "1213123",
        vasAccountName: "1160.0280.9515 BIDV(VND)",
    },
    {
        id: "38380-0333",
        accountNo: "38380-0333",
        currency: "USD",
        accountType: "",
        accountNickname: "BIDV(5665)",
        accountDetails: "",
        vasCode: "1213124",
        vasAccountName: "1160.0280.9521 BIDV(VND)",
    },
];
