import type { CurrentAccountRow, FinancialStatus } from "./types";

/**
 * Daily Financial (CMC) mock — modelled on the live JEX `rept_0015_001.act`
 * snapshot for `dev.wecms.vn`. Numbers are pre-formatted strings so the page
 * renders exactly the punctuation/symbol the live report emits.
 */

export const mockFinancialStatus: FinancialStatus[] = [
    {
        currency: "VND",
        total: "21.437.055.576₫",
        currentAccounts: "10.148.082.631₫",
        savingAccounts: "107.464.831₫",
    },
    {
        currency: "USD",
        total: "$12,942.15",
        currentAccounts: "$12,854.25",
        savingAccounts: "$87.90",
    },
];

export const mockCurrentAccounts: CurrentAccountRow[] = [
    {
        id: "ca-1",
        bank: "WOORI",
        accountNo: "1005-602-308840",
        accountNickname: "Operating Account",
        currency: "VND",
        numDebits: 14,
        debit: "152.300.000",
        numInternalDebits: 2,
        internalDebit: "20.000.000",
        numCredits: 9,
        credit: "248.520.000",
        numInternalCredits: 1,
        internalCredit: "5.000.000",
        balance: "8.452.310.000",
    },
    {
        id: "ca-2",
        bank: "BIDV",
        accountNo: "190-291-3050569",
        accountNickname: "Payroll",
        currency: "VND",
        numDebits: 4,
        debit: "32.640.000",
        numInternalDebits: 0,
        internalDebit: "-",
        numCredits: 2,
        credit: "60.000.000",
        numInternalCredits: 0,
        internalCredit: "-",
        balance: "1.235.700.631",
    },
    {
        id: "ca-3",
        bank: "VCB",
        accountNo: "0011-001-128210",
        accountNickname: "Petty Cash",
        currency: "VND",
        numDebits: 6,
        debit: "8.450.000",
        numInternalDebits: 0,
        internalDebit: "-",
        numCredits: 1,
        credit: "20.000.000",
        numInternalCredits: 1,
        internalCredit: "5.000.000",
        balance: "460.072.000",
    },
    {
        id: "ca-4",
        bank: "WOORI",
        accountNo: "1005-602-700408",
        accountNickname: "USD Operating",
        currency: "USD",
        numDebits: 2,
        debit: "1,200.00",
        numInternalDebits: 0,
        internalDebit: "-",
        numCredits: 1,
        credit: "5,000.00",
        numInternalCredits: 0,
        internalCredit: "-",
        balance: "12,854.25",
    },
];
