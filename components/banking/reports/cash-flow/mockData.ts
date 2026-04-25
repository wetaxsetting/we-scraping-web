import type { CashFlowReport } from "./types";

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const m = (jan = "", feb = "", mar = "", apr = "", may = "", jun = ""): string[] => [
    jan, feb, mar, apr, may, jun, "", "", "", "", "", "",
];

export const mockCashFlowReport: CashFlowReport = {
    months: MONTHS,
    openingBalance: ["7,500", "2,500", "2,800", "3,100", "3,600", "4,050", "", "", "", "", "", ""],
    groups: [
        {
            id: "revenue",
            labelKo: "영업",
            labelEn: "REVENUE",
            subgroups: [
                {
                    id: "cash-sales",
                    labelKo: "현금 판매 수익 (현금)",
                    labelEn: "Cash Sales Revenue (Cash)",
                    details: [
                        { id: "cs-1", itemCode: "1357924234", itemName: "Collection (K1 BLU)", months: m("15,000,000") },
                        { id: "cs-2", itemCode: "1357924234", itemName: "Collection (K1 BLU)", months: m("", "", "10,000,000") },
                        { id: "cs-3", itemCode: "1357924",    itemName: "Collection (K1 BLU)", months: m("15,000,000", "9,500,000", "10,000,000", "10,500,000", "11,000,000") },
                        { id: "cs-4", itemCode: "1357924",    itemName: "Collection (K1 BLU)", months: m("", "9,500,000", "10,000,000", "10,500,000", "11,000,000", "11,500,000") },
                    ],
                },
                {
                    id: "cash-revenue-report",
                    labelKo: "현금 수익 보고서 (현금)",
                    labelEn: "Cash Revenue Report (Cash)",
                    details: [
                        { id: "cr-1", itemCode: "1357924",    itemName: "Collection (K1 BLU)", months: m("15,000,000", "", "10,000,000", "10,500,000", "11,000,000", "11,500,000") },
                        { id: "cr-2", itemCode: "1357924",    itemName: "Collection (K1 BLU)", months: m("15,000,000") },
                    ],
                },
                {
                    id: "cash-inflow-summary",
                    labelKo: "현금 수입 내역 (현금)",
                    labelEn: "Cash Inflow Summary (Cash)",
                    details: [
                        { id: "ci-1", itemCode: "1357924234", itemName: "Collection (K1 BLU)", months: m("", "9,500,000", "10,000,000", "10,500,000", "", "11,500,000") },
                        { id: "ci-2", itemCode: "1357924",    itemName: "Collection K1 (BLU)", months: m("15,000,000", "9,500,000", "10,000,000") },
                    ],
                },
            ],
            subTotals: m("0", "0", "0", "0", "0"),
        },
        {
            id: "expenses-1",
            labelKo: "지출",
            labelEn: "Expenses",
            subgroups: [
                {
                    id: "cash-ops",
                    labelKo: "현금 거래 (현금)",
                    labelEn: "Cash Operations (Cash)",
                    details: [
                        { id: "co-1", itemCode: "1357924234", itemName: "Collection (K1 BLU)", months: m("15,000,000") },
                        { id: "co-2", itemCode: "1357924234", itemName: "Collection (K1 BLU)", months: m("", "", "10,000,000") },
                        { id: "co-3", itemCode: "",           itemName: "Collection (K1 BLU)", months: m("", "9,500,000", "", "10,500,000", "11,000,000") },
                        { id: "co-4", itemCode: "",           itemName: "Collection (K1 BLU)", months: m("", "", "", "", "", "11,500,000") },
                    ],
                },
                {
                    id: "cash-earnings",
                    labelKo: "현금 수익 (현금)",
                    labelEn: "Cash Earnings (Cash)",
                    details: [
                        { id: "ce-1", itemCode: "1357924234", itemName: "Collection (K1 BLU)", months: m("15,000,000", "", "10,000,000", "10,500,000", "11,000,000", "11,500,000") },
                        { id: "ce-2", itemCode: "1357924",    itemName: "Collection (K1 BLU)", months: m("15,000,000") },
                    ],
                },
                {
                    id: "cash-receipts",
                    labelKo: "현금 수익 (현금)",
                    labelEn: "Cash Receipts (Cash)",
                    details: [
                        { id: "cr-ex-1", itemCode: "1357924",    itemName: "Collection (K1 BLU)", months: m("", "9,500,000", "10,000,000", "10,500,000", "11,000,000", "11,500,000") },
                        { id: "cr-ex-2", itemCode: "1357924234", itemName: "Collection (K1 BLU)", months: m("15,000,000", "9,500,000", "10,000,000", "10,500,000", "11,000,000") },
                    ],
                },
            ],
            subTotals: m("0", "0", "0", "0", "0"),
        },
    ],
    salesProfit: m("0", "0", "0", "0", "0"),
    nonSalesProfit: m("0", "0", "0", "0", "0"),
    endBalance: m("0", "0", "0", "0", "0"),
};
