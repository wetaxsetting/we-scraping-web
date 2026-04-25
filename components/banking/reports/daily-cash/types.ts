export type CurrencyScope = "all" | "vnd" | "fcy";

/** Summary row in the top "TOTAL" table — one row per currency bucket. */
export type DailyCashSummaryRow = {
    currencyLabel: string;
    cash: string;
    current: string;
    savings: string;
    timeDeposit: string;
    available: string;
};

/** Row in the "Cash" section — holdings by physical cash type. */
export type DailyCashHoldingRow = {
    id: string;
    type: string;
    currency: string;
    openingBalance: string;
    numDebits: number;
    debit: string;
    numCredits: number;
    credit: string;
    balance: string;
};

/** Row in the "Current Accounts" section — per-bank-account ledger. */
export type DailyCashAccountRow = {
    id: string;
    bank: string;
    accountNo: string;
    currency: string;
    numDebits: number;
    debit: string;
    numCredits: number;
    credit: string;
    balance: string;
};
