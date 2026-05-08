export type LinkTab = "all" | "linked" | "unlinked";

export type LinkRef = {
    /** Primary reference code (clickable blue link). */
    primary: string;
    /** Second stacked reference code (multi-ref rows only). */
    secondary?: string;
    /** Overflow count badge text — "+2", "+3", … (multi-ref rows only). */
    overflow?: string;
    /** When true the cell renders the "Link" action text instead of a ref code. */
    isAction?: boolean;
};

export type CardTransactionRow = {
    id: string;
    /** "05-07-2025\n11:39:50" — date on line 1, time on line 2. */
    date: string;
    time: string;
    /** "SHINHAN" — bank/card brand name. */
    cardBrand: string;
    /** "4001-0023-4569-5665" — masked card number. */
    cardNumber: string;
    merchant: string;
    cardNickname: string;
    cardholder: string;
    /** Formatted amount string, e.g. "25.500.000". */
    amount: string;
    /** Account code + name for first line, e.g. "2001019 - Payables". */
    reportingAccount: string;
    /** Sub-category path shown on second line, e.g. "Revenue > Sales". */
    reportingCategory: string;
    linkRef: LinkRef;
    /** Approval reference No., e.g. "VO_02312_003". Empty string when not yet approved. */
    approvalRef: string;
    /** Rows with no approvalRef get the Figma yellow highlight. */
    highlighted: boolean;
};

export type CardSummary = {
    total: number;
    totalAmount: string;
    approvalNotRequested: number;
    approvalNotRequestedAmount: string;
    approvalRequested: number;
    approvalRequestedAmount: string;
};

export type CurrencyTotal = {
    currency: string;
    total: string;
};
