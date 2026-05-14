/**
 * Daily Financial (CMC) snapshot types — modelled on
 * `docs/refactor-wecms/features/daily-financial-report.md`.
 *
 * Compared to the predecessor Daily Cash report this carries:
 *   1. a per-currency Financial Status header (Current / Saving split),
 *   2. a per-account Current Accounts ledger with debit / credit counters
 *      AND a per-row transaction drill-down,
 *   3. a per-currency flow rollup (REC3 — opening / closing balance,
 *      total send / receive counts and amounts).
 *
 * Plus two filters not present on Daily Cash:
 *   - Active accounts only (Y/N) — hide closed / inactive accounts,
 *   - Include internal transfers (Y/N) — show own-account-transfer rows
 *     separately or roll them up.
 */

export type FinancialStatus = {
    currency: string;
    total: string;
    currentAccounts: string;
    savingAccounts: string;
};

export type TransactionDetailRow = {
    accountSeqNo: string;
    transactionTime: string;
    amount: string;
    balanceAfter: string;
    /** "IN" | "OUT" — direction the money moved relative to the account. */
    inOutDiv: string;
    remark: string;
    rcvPayUsageCd: string;
    rcvPayUsageNm: string;
};

export type CurrentAccountRow = {
    id: string;
    bank: string;
    bankCd: string;
    accountNo: string;
    accountNickname: string;
    currency: string;
    /** Legacy ACCT_TYPE_CD — "11" current, "12" savings, etc. */
    accountTypeCd: string;
    /** Y / N — used to drive the "Active accounts only" filter. */
    activeYn: string;
    numDebits: number;
    debit: string;
    numInternalDebits: number;
    internalDebit: string;
    numCredits: number;
    credit: string;
    numInternalCredits: number;
    internalCredit: string;
    balance: string;
    transactions: TransactionDetailRow[];
};

export type CurrencyFlowRow = {
    currency: string;
    beforeDateBalance: string;
    balance: string;
    sendCount: number;
    sendAmount: string;
    receiveCount: number;
    receiveAmount: string;
};
