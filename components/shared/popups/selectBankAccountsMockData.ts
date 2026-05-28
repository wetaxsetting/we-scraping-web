/**
 * Row shape + scrape mapper for the Select Bank Accounts popup
 * (Figma 1081:25485).
 *
 * <p>Live data flows through {@link mapScrapedToBankRow}: the
 * Bank Account / Login Credentials Add chains pass NXISAS-scraped
 * accounts through this mapper into the popup's {@code rows} prop.
 * The earlier {@code SELECT_BANK_ACCOUNTS_ROWS} static seed was
 * retired 2026-05-26 — the popup now requires an explicit
 * {@code rows} prop and renders an empty body when none are scraped.
 */

import type { ApiScrapedAccount } from "@/lib/api/bankCredentials";

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

/** Map an NXISAS-scraped account to the popup's BankAccountRow shape.
 *  Shared by LoginCredentialsPanel + BankAccountPanel Add flows. */
export function mapScrapedToBankRow(
    acc: ApiScrapedAccount,
    index: number,
): BankAccountRow {
    const accountNo = (acc.acct_num ?? "").trim();
    return {
        id:              accountNo || `scraped-${index}`,
        accountNo,
        currency:        (acc.currency ?? "").trim(),
        accountType:     "",
        accountNickname: (acc.acct_name ?? "").trim(),
        accountDetails:  "",
        vasCode:         "",
        vasAccountName:  "",
    };
}
