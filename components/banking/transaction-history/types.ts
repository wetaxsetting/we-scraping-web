/**
 * Transaction row shape for the per-account Transaction History page.
 * Figma shows a split layout: left side is the bank statement (Date/Time,
 * Deposit, Withdraw, Balance, Remarks); right side is the classification
 * / matching panel (Purpose, VAS Account, Contacts Name, Confirmed by).
 * Unconfirmed rows are editable (yellow-tinted, Confirm button); confirmed
 * rows are read-only with an Undo button.
 */
export type TransactionFlow = "deposit" | "withdraw";

export type TransactionRow = {
    id: string;
    date: string;
    time: string;
    /** Credit amount when this is an incoming transaction. */
    deposit?: string;
    /** Debit amount when this is an outgoing transaction. */
    withdraw?: string;
    /** Running balance after this transaction. */
    balance: string;
    remarks: string;
    /**
     * Matching fields — filled only after the row has been classified.
     * `confirmed: false` renders an editable (yellow) row with placeholders;
     * `confirmed: true` renders read-only values plus the confirmer + date.
     */
    confirmed: boolean;
    purpose?: string;
    vasAccount?: string;
    contactsName?: string;
    confirmedBy?: {
        name: string;
        date: string;
    };
    /** Doc icon colour — Figma shows yellow / pink variants on confirmed rows. */
    docIconVariant?: "yellow" | "pink";
};

export type TransactionTypeFilter = "all" | "deposit" | "withdraw";

export type TransactionStatusFilter = "all" | "confirmed" | "unconfirmed";

export type TransactionStatusCounts = {
    all: number;
    confirmed: number;
    unconfirmed: number;
};

export type TransactionTotals = {
    /** Count of transactions in the current filter scope. */
    count: number;
    /** Sum of all deposits (formatted string, per currency convention). */
    depositTotal: string;
    /** Sum of all withdraws (formatted string, per currency convention). */
    withdrawTotal: string;
};
