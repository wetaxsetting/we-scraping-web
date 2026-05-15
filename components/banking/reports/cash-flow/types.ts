/**
 * Cash Flow report — frontend types. Mirrors the backend
 * `CashFlowReportResponse` shape after snake_case → camelCase
 * translation at the API boundary (see lib/api/mappers.ts).
 *
 * `rowType` is the verbatim legacy classifier — frontend branches on
 * its string value to decide rendering (HEADER / SUBTOTAL / DETAIL
 * styling, hierarchy indentation, accent rows). Do NOT introduce a
 * narrower enum here; backend ships the legacy strings verbatim and
 * unknown values must render as plain detail rows.
 */
export type CashFlowMonthlyAmounts = {
    jan: string;
    feb: string;
    mar: string;
    apr: string;
    may: string;
    jun: string;
    jul: string;
    aug: string;
    sep: string;
    oct: string;
    nov: string;
    dec: string;
};

export type CashFlowRow = {
    displayOrder: string;
    displayCd: string;
    displayNm: string;
    itemCd: string;
    itemNm: string;
    rowType: string;
    groupCd: string;
    parentL2Cd: string;
    displayCurrency: string;
    monthly: CashFlowMonthlyAmounts;
    annualTotal: string;
};

export type CashFlowReport = {
    year: number;
    quarter: number | null;
    baseCurrency: string;
    usdRate: string;
    krwRate: string;
    rows: CashFlowRow[];
};

export const MONTH_KEYS: readonly (keyof CashFlowMonthlyAmounts)[] = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
];

/** Map quarter 1..4 to the inclusive month-index range (0-based). */
export function monthIndicesForQuarter(quarter: number | null): number[] {
    if (quarter === 1) return [0, 1, 2];
    if (quarter === 2) return [3, 4, 5];
    if (quarter === 3) return [6, 7, 8];
    if (quarter === 4) return [9, 10, 11];
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
}
