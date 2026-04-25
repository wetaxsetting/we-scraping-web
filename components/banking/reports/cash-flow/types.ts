export type CashFlowDetailRow = {
    id: string;
    itemCode: string;
    itemName: string;
    months: string[];
};

export type CashFlowSubgroup = {
    id: string;
    /** Label in two lines: Korean on top, English below (per Figma). */
    labelKo: string;
    labelEn: string;
    details: CashFlowDetailRow[];
};

export type CashFlowGroup = {
    id: string;
    /** Two-line label: 영업 / REVENUE, 지출 / Expenses. */
    labelKo: string;
    labelEn: string;
    subgroups: CashFlowSubgroup[];
    /** Subtotal row values across the monthly columns. */
    subTotals: string[];
};

export type CashFlowReport = {
    months: string[];
    openingBalance: string[];
    groups: CashFlowGroup[];
    /** "Sales Profit" row — Revenue minus first Expenses block. */
    salesProfit: string[];
    /** "Non-Sales Profit" row. */
    nonSalesProfit: string[];
    /** Final "END BALANCE" row. */
    endBalance: string[];
};
