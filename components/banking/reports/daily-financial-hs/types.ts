export type LedgerEntry = {
    id: string;
    receiptCode: string;
    paymentCode: string;
    descriptionEn: string;
    descriptionKo: string;
    counterparty: string;
    beforeBalance: string;
    receipt: string;
    payment: string;
    balance: string;
    memo: string;
};

export type BankGroup = {
    id: string;
    bankName: string;
    accountNo: string;
    currency: string;
    /** Optional muted subtitle under the bank name (e.g. "(Saving account)"). */
    subtitle?: string;
    /**
     * Optional red-accent label rendered under the bank name. Used for
     * product-type flags the Figma draws in red (LOAN, BRANCH).
     */
    accentLabel?: string;
    /** Optional date accent shown below the account (e.g. "Due Date 13 Jan 2026"). */
    dueDate?: string;
    /**
     * If true this group's sub-total marks the end of a currency section,
     * so the page renders a TOTAL (green) row immediately after its
     * sub-total row.
     */
    closesTotal?: boolean;
    /** Running total across all groups in the currency section so far. */
    runningTotal?: {
        beforeBalance: string;
        receipt: string;
        payment: string;
        balance: string;
    };
    entries: LedgerEntry[];
    subtotal: {
        beforeBalance: string;
        receipt: string;
        payment: string;
        balance: string;
    };
};

export type LedgerTotal = {
    beforeBalance: string;
    receipt: string;
    payment: string;
    balance: string;
};
