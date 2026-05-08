import type {
    TransactionHistoryRow,
    TransactionHistoryTabCounts,
} from "./types";

/**
 * Static mock for the Transaction History panel — values mirror the Figma
 * frame (134:16546). Replace with the real `/api/v1/settings/erp-transaction-history`
 * call when the backend lands; the row shape already matches the expected
 * UPPER_SNAKE → camelCase mapping.
 */
export const mockTransactionHistoryRows: TransactionHistoryRow[] = [
    {
        id: "txh-1",
        date: "2023-07-05",
        time: "11:39:50",
        type: "deleted",
        transactionType: "internal_scheduled_transfer",
        fileName: "WeCMS_Internal_Payment_upload_EN_003.xlsx",
        user: "Phuoc Thanh",
    },
    {
        id: "txh-2",
        date: "2023-07-05",
        time: "11:39:50",
        type: "deleted",
        transactionType: "vendor_scheduled_payment",
        fileName: "WeCMS_Vendor_Payment_upload_EN_001.xlsx",
        user: "Phuoc Thanh",
    },
    {
        id: "txh-3",
        date: "2023-07-05",
        time: "11:39:50",
        type: "deleted",
        transactionType: "expense_scheduled_payment",
        fileName: "WeCMS_Expense_Payment_upload_EN_001.xlsx",
        user: "Nguyen Thungán",
    },
    {
        id: "txh-4",
        date: "2023-07-05",
        time: "11:39:50",
        type: "deleted",
        transactionType: "payroll_scheduled_payment",
        fileName: "WeCMS_Payroll_Payment_upload_EN_001.xlsx",
        user: "Nguyễn Văn Thiệu",
    },
    {
        id: "txh-5",
        date: "2023-07-05",
        time: "11:39:50",
        type: "deleted",
        transactionType: "overseas_scheduled_payment",
        fileName: "WeCMS_Overseas_Payment_upload_EN_002.xlsx",
        user: "Nguyen Thungán",
    },
    {
        id: "txh-6",
        date: "2023-07-05",
        time: "11:39:50",
        type: "deleted",
        transactionType: "overseas_scheduled_payment",
        fileName: "WeCMS_Overseas_Payment_upload_EN_001.xlsx",
        user: "Nguyen Thungán",
    },
    {
        id: "txh-7",
        date: "2023-07-05",
        time: "11:39:50",
        type: "deleted",
        transactionType: "internal_scheduled_transfer",
        fileName: "WeCMS_Internal_Payment_upload_EN_002.xlsx",
        user: "Nguyễn Văn Thiệu",
    },
    {
        id: "txh-8",
        date: "2023-07-05",
        time: "11:39:50",
        type: "deleted",
        transactionType: "internal_scheduled_transfer",
        fileName: "WeCMS_Internal_Payment_upload_EN_001.xlsx",
        user: "Nguyễn Văn Thiệu",
    },
];

/**
 * Tab counts mirror the Figma frame — the visible row dataset above only
 * carries the "Deleted" subset, but the tab strip surfaces totals across
 * every flow. When the API lands, derive these from `COMMON_HEAD` /
 * `REC.COUNTS` instead of this constant.
 */
export const MOCK_TAB_COUNTS: TransactionHistoryTabCounts = {
    all: 14,
    wecms_to_erp: 5,
    erp_to_wecms: 2,
    deleted: 30,
};
