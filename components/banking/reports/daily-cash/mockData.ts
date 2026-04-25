import type {
    DailyCashAccountRow,
    DailyCashHoldingRow,
    DailyCashSummaryRow,
} from "./types";

export const mockSummaryRows: DailyCashSummaryRow[] = [
    {
        currencyLabel: "VND Total",
        cash: "2.300.000₫",
        current: "6.450.000₫",
        savings: "3.200.000₫",
        timeDeposit: "540.000₫",
        available: "12.490.000₫",
    },
    {
        currencyLabel: "FCY Total (USD)",
        cash: "$0.00",
        current: "$87,420.00",
        savings: "$14,890.00",
        timeDeposit: "$0.00",
        available: "$102,310.00",
    },
];

export const mockCashRows: DailyCashHoldingRow[] = [
    {
        id: "cash-vnd",
        type: "Petty cash (VN office)",
        currency: "VND",
        openingBalance: "5.025.231₫",
        numDebits: 2,
        debit: "2.300.000₫",
        numCredits: 3,
        credit: "2.300.000₫",
        balance: "5.025.231₫",
    },
    {
        id: "cash-usd",
        type: "Petty cash (Overseas)",
        currency: "USD",
        openingBalance: "$1,050.00",
        numDebits: 0,
        debit: "$0.00",
        numCredits: 1,
        credit: "$250.00",
        balance: "$1,300.00",
    },
];

export const mockCurrentAccountRows: DailyCashAccountRow[] = [
    {
        id: "ca-1",
        bank: "Vietcombank",
        accountNo: "044-10-00688210",
        currency: "VND",
        numDebits: 4,
        debit: "2.300.000₫",
        numCredits: 2,
        credit: "2.300.000₫",
        balance: "6.450.000₫",
    },
    {
        id: "ca-2",
        bank: "ACB",
        accountNo: "123-45-00099001",
        currency: "VND",
        numDebits: 1,
        debit: "1.200.000₫",
        numCredits: 1,
        credit: "2.500.000₫",
        balance: "3.300.000₫",
    },
    {
        id: "ca-3",
        bank: "WOORI BANK",
        accountNo: "001-00000523-06",
        currency: "USD",
        numDebits: 2,
        debit: "$12,525.00",
        numCredits: 1,
        credit: "$22,000.00",
        balance: "$87,420.00",
    },
];

export const mockSavingsAccountRows: DailyCashAccountRow[] = [
    {
        id: "sa-1",
        bank: "BIDV",
        accountNo: "0001-00000569-14",
        currency: "VND",
        numDebits: 0,
        debit: "0₫",
        numCredits: 0,
        credit: "0₫",
        balance: "3.200.000₫",
    },
];
