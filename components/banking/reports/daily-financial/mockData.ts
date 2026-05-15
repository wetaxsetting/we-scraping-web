import type {
    CurrencyFlowRow,
    CurrentAccountRow,
    FinancialStatus,
    TransactionDetailRow,
} from "./types";

/**
 * Daily Financial (CMC) mock — modelled on the live JEX
 * `rept_0015_001.act` snapshot for `dev.wecms.vn`. Numbers are
 * pre-formatted strings so the page renders exactly the punctuation
 * the live report emits. Each account carries a small transactions
 * list so the drill-down can be exercised against the static UI.
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

const wooriTx: TransactionDetailRow[] = [
    {
        accountSeqNo: "1",
        transactionTime: "09:14:22",
        amount: "1.500.000",
        balanceAfter: "8.453.810.000",
        inOutDiv: "IN",
        remark: "Customer payment",
        rcvPayUsageCd: "01",
        rcvPayUsageNm: "Sales",
    },
    {
        accountSeqNo: "2",
        transactionTime: "10:32:08",
        amount: "20.000.000",
        balanceAfter: "8.433.810.000",
        inOutDiv: "OUT",
        remark: "Internal transfer → Payroll",
        rcvPayUsageCd: "09",
        rcvPayUsageNm: "Internal transfer",
    },
];

const bidvTx: TransactionDetailRow[] = [
    {
        accountSeqNo: "1",
        transactionTime: "11:05:51",
        amount: "5.000.000",
        balanceAfter: "1.240.700.631",
        inOutDiv: "IN",
        remark: "Payroll funding",
        rcvPayUsageCd: "09",
        rcvPayUsageNm: "Internal transfer",
    },
];

export const mockCurrentAccounts: CurrentAccountRow[] = [
    {
        id: "ca-1",
        bank: "WOORI",
        bankCd: "11704011",
        accountNo: "1005-602-308840",
        accountNickname: "Operating Account",
        currency: "VND",
        accountTypeCd: "11",
        activeYn: "Y",
        numDebits: 14,
        debit: "152.300.000",
        numInternalDebits: 2,
        internalDebit: "20.000.000",
        numCredits: 9,
        credit: "248.520.000",
        numInternalCredits: 1,
        internalCredit: "5.000.000",
        balance: "8.452.310.000",
        transactions: wooriTx,
    },
    {
        id: "ca-2",
        bank: "BIDV",
        bankCd: "11704022",
        accountNo: "190-291-3050569",
        accountNickname: "Payroll",
        currency: "VND",
        accountTypeCd: "11",
        activeYn: "Y",
        numDebits: 4,
        debit: "32.640.000",
        numInternalDebits: 0,
        internalDebit: "-",
        numCredits: 2,
        credit: "60.000.000",
        numInternalCredits: 0,
        internalCredit: "-",
        balance: "1.235.700.631",
        transactions: bidvTx,
    },
    {
        id: "ca-3",
        bank: "VCB",
        bankCd: "11704033",
        accountNo: "0011-001-128210",
        accountNickname: "Petty Cash",
        currency: "VND",
        accountTypeCd: "11",
        activeYn: "N",
        numDebits: 6,
        debit: "8.450.000",
        numInternalDebits: 0,
        internalDebit: "-",
        numCredits: 1,
        credit: "20.000.000",
        numInternalCredits: 1,
        internalCredit: "5.000.000",
        balance: "460.072.000",
        transactions: [],
    },
    {
        id: "ca-4",
        bank: "WOORI",
        bankCd: "11704011",
        accountNo: "1005-602-700408",
        accountNickname: "USD Operating",
        currency: "USD",
        accountTypeCd: "11",
        activeYn: "Y",
        numDebits: 2,
        debit: "1,200.00",
        numInternalDebits: 0,
        internalDebit: "-",
        numCredits: 1,
        credit: "5,000.00",
        numInternalCredits: 0,
        internalCredit: "-",
        balance: "12,854.25",
        transactions: [],
    },
];

export const mockCurrencyFlow: CurrencyFlowRow[] = [
    {
        currency: "VND",
        beforeDateBalance: "10.000.000.000",
        balance: "10.148.082.631",
        sendCount: 24,
        sendAmount: "193.390.000",
        receiveCount: 12,
        receiveAmount: "328.520.000",
    },
    {
        currency: "USD",
        beforeDateBalance: "9,054.25",
        balance: "12,854.25",
        sendCount: 2,
        sendAmount: "1,200.00",
        receiveCount: 1,
        receiveAmount: "5,000.00",
    },
];
