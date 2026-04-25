/**
 * Daily Financial (CMC) snapshot types — modelled on the live JEX
 * `rept_0015_001.act` response, NOT the HAENGSUNG ledger shape.
 *
 * The CMC report is an "as-of" snapshot per currency that combines
 *   1. a high-level "Financial Status" header (one row of currency totals
 *      split into Current vs. Saving), and
 *   2. a per-account Current Accounts ledger with debit/credit counters and
 *      internal-transfer columns.
 *
 * Saving Accounts and other product types could plug in later as their own
 * ledger blocks; the Figma flow currently only exposes Current Accounts in
 * the result viewport.
 */

export type FinancialStatus = {
    /** Currency code (e.g. "VND", "USD"). */
    currency: string;
    /** Pre-formatted total amount, e.g. `21.437.055.576₫`. */
    total: string;
    /** Pre-formatted column totals shown in the status table. */
    currentAccounts: string;
    savingAccounts: string;
};

export type CurrentAccountRow = {
    id: string;
    bank: string;
    accountNo: string;
    accountNickname: string;
    currency: string;
    numDebits: number;
    debit: string;
    numInternalDebits: number;
    internalDebit: string;
    numCredits: number;
    credit: string;
    numInternalCredits: number;
    internalCredit: string;
    balance: string;
};
