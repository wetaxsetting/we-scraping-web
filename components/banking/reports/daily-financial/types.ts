/**
 * Daily Financial (CMC) snapshot types — modelled on
 * `docs/refactor-wecms/features/daily-financial-report.md`.
 *
 * Compared to the predecessor Daily Cash report this carries:
 *   1. a per-currency Financial Status header (Current / Saving split),
 *   2. a per-account Current Accounts ledger with debit / credit counters.
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

/**
 * Per-account transaction row returned by the "Transaction History
 * Details" popup endpoint. Mirrors legacy `rept_0015_002_r001` REC item.
 * Distinct from {@link TransactionDetailRow} (the inline drill-down used
 * by an earlier refactor revision) — kept separate so the popup wire
 * type can evolve independently.
 */
export type TxHistoryRow = {
    transactionTime: string;
    currency: string;
    amount: string;
    balanceAfter: string;
    /** "1" = credit/in, "2" = debit/out. */
    inOutDiv: string;
    remark: string;
};

/** Full popup response shape — pagination metadata + per-day totals + page rows. */
export type TxHistoryResponse = {
    totalCount: number;
    totalIn: string;
    totalOut: string;
    closingBalance: string;
    pageNo: number;
    pageSize: number;
    rows: TxHistoryRow[];
};

export type CurrentAccountRow = {
    id: string;
    bank: string;
    bankCd: string;
    accountNo: string;
    accountNickname: string;
    currency: string;
    /** Legacy ACCT_TYPE_CD. Current = 03 / 04 / 07 (KHR / USD / KRW current),
     *  Savings = 05 / 06 / 08 (KHR / USD / KRW savings). Used to partition
     *  the ledger into separate "Current Accounts" + "Saving Accounts"
     *  tables on the Daily Financial page (mirrors legacy rept_0015_001). */
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
