import type { CashFlowReport, CashFlowMonthlyAmounts } from "./types";

const ZERO_MONTHLY: CashFlowMonthlyAmounts = {
    jan: "", feb: "", mar: "", apr: "", may: "", jun: "",
    jul: "", aug: "", sep: "", oct: "", nov: "", dec: "",
};

export const mockCashFlowReport: CashFlowReport = {
    year: 2026,
    quarter: null,
    baseCurrency: "VND",
    usdRate: "",
    krwRate: "",
    rows: [
        {
            displayOrder: "1",
            displayCd: "REVENUE",
            displayNm: "REVENUE",
            itemCd: "",
            itemNm: "",
            rowType: "HEADER",
            groupCd: "",
            parentL2Cd: "",
            displayCurrency: "VND",
            monthly: { ...ZERO_MONTHLY },
            annualTotal: "",
        },
    ],
};
