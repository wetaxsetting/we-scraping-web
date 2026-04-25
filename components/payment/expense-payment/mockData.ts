import type { ApprovalStatus } from "@/components/payment/approval-box/types";

/**
 * Expense Scheduled Payment row — Figma 25:7584. Per CLAUDE.md §12a, every
 * batch-file payment module (Vendor / Expense / Payroll / Overseas) mirrors
 * the Internal Transfer Scheduled batch-file shape so all four modules can
 * reuse the same chrome (toolbar, table columns, totals footer, action
 * column). Each list row is one *uploaded batch* (a file containing N
 * transactions), not a single payment.
 */
export type ExpenseScheduledAction = "transfer" | "document" | "complete";
export type ExpenseScheduledRowHighlight = "selected" | "warning";

export type ExpenseScheduledRow = {
    id: string;
    /** Two-line date + time, e.g. `"05-Jan-2025\n11:39:50"`. */
    dateTime: string;
    fileName: string;
    /** Number of transactions in the batch (rendered as `"6 Transaction (USD)"`). */
    txnCount: number;
    txnCurrency: string;
    /** Pre-formatted total amount, e.g. `"20.000.000"`. */
    totalAmount: string;
    /** Approval status — optional. Empty for unsubmitted warning rows. */
    status?: ApprovalStatus;
    /** Progress indicator for `in_progress`, e.g. `"1/3"`. */
    statusStep?: string;
    requestor: string;
    approver: string;
    /** Optional count pill next to the approver name (e.g. `2`). */
    approverCount?: number;
    approvalRef: string;
    approvalTitle: string;
    /** Right-most action column variant. */
    action?: ExpenseScheduledAction;
    /** Optional row tint — selected (light blue) or warning (amber). */
    rowHighlight?: ExpenseScheduledRowHighlight;
    /** Withdrawal bank — reused by the detail page summary. */
    fromBank: string;
    /** Withdrawal account number — shown on detail page as "accountNo (currency)". */
    fromAccount?: string;
    /** File size shown in the detail-page file card, e.g. "108.69 KB". */
    fileSize?: string;
};

/**
 * Expense Payment Result row — Figma 25:9221. Mirrors the Internal Transfer
 * Result batch-file shape (binary status + success/failed counters +
 * trailing per-row download glyph). Detail-only fields populated for the
 * row used by the Figma 25:10047 sample.
 */
export type ExpenseResultStatus = "completed" | "in_progress";

export type ExpenseResultRow = {
    id: string;
    /** Two-line date + time, e.g. `"30-10-2024\n11:39:50"`. */
    dateTime: string;
    fileName: string;
    /** Number of transactions in the batch (rendered as `"6 Trx (USD)"`). */
    txnCount: number;
    txnCurrency: string;
    /** Pre-formatted total amount, e.g. `"20.000.000"`. */
    totalAmount: string;
    status: ExpenseResultStatus;
    /** Inline success counter — only rendered when `status === "completed"`. */
    successCount?: number;
    /** Inline failed counter — only rendered when `status === "completed"`. */
    failedCount?: number;
    approvalRef: string;
    approvalTitle: string;
    /** Withdrawal bank — used by the detail page summary. */
    fromBank: string;
    /** Withdrawal account number — detail-page summary "accountNo (currency)". */
    fromAccount?: string;
    /** Withdrawal account currency code — detail-page summary. */
    fromCurrency?: string;
    /** Pre-formatted total transfer amount with currency suffix
     *  (e.g. `"80.000.000đ"`) — detail-page summary. */
    totalTransferAmount?: string;
    /** Detail-page summary requestor name. */
    requestor?: string;
    /** File size shown in the detail-page file card, e.g. "108.69 KB". */
    fileSize?: string;
    /** Detail-page breadcrumb identifier — e.g. "Expense_Payment_241205"
     *  (Figma 25:10047). */
    paymentRef?: string;
};

export const expenseScheduledRows: ExpenseScheduledRow[] = [
    {
        id: "1",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Expense_Payment_250130",
        txnCount: 6,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        status: "approved",
        requestor: "Mr.Kim",
        approver: "Cedar Grove",
        approverCount: 2,
        approvalRef: "EX_20250908_001",
        approvalTitle: "June - Request for expense payment",
        action: "transfer",
        fromBank: "BIDV - 0569",
    },
    {
        id: "2",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Expense_Payment_250129",
        txnCount: 6,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        status: "in_progress",
        statusStep: "1/3",
        requestor: "Mr.Kim",
        approver: "Lakeside Haven",
        approverCount: 3,
        approvalRef: "EX_20250908_001",
        approvalTitle: "May - Request for expense payment",
        action: "document",
        rowHighlight: "selected",
        fromBank: "VCB - 8210",
    },
    {
        id: "3",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Expense_Payment_250128",
        txnCount: 12,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        // Warning row has no approval status badge (matches Internal/Vendor).
        requestor: "Mr.Kim",
        approver: "Maplewood Village",
        approvalRef: "EX_20250908_001",
        approvalTitle: "April - Request for expense payment",
        action: "document",
        rowHighlight: "warning",
        fromBank: "HD BANK - 0442",
    },
    {
        id: "4",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Expense_Payment_250127",
        txnCount: 45,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "rejected",
        requestor: "Mr.Kim",
        approver: "Maplewood Village",
        approvalRef: "EX_20250908_001",
        approvalTitle: "April - Request for expense payment",
        action: "document",
        fromBank: "BIDV - 0569",
    },
    {
        id: "5",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Expense_Payment_250126",
        txnCount: 15,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "pending",
        requestor: "Mr.Kim",
        approver: "Maplewood Village",
        approvalRef: "EX_20250908_001",
        approvalTitle: "March - Request for expense payment",
        action: "document",
        fromBank: "VCB - 8210",
    },
    {
        id: "6",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Expense_Payment_250125",
        txnCount: 4,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "approved",
        requestor: "Mr.Kim",
        approver: "Grove",
        approverCount: 2,
        approvalRef: "EX_20250908_001",
        approvalTitle: "February - Request for expense payment",
        action: "complete",
        fromBank: "Shinhan",
        fromAccount: "00500044787814",
        fileSize: "108.69 KB",
    },
    {
        id: "7",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Expense_Payment_250124",
        txnCount: 4,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "approved",
        requestor: "Mr.Kim",
        approver: "Grove",
        approverCount: 2,
        approvalRef: "EX_20250908_001",
        approvalTitle: "January - Request for expense payment",
        action: "complete",
        fromBank: "Shinhan",
    },
];

export const expenseResultRows: ExpenseResultRow[] = [
    {
        id: "1",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Expense_Payment_upload_EN_005",
        txnCount: 6,
        txnCurrency: "USD",
        totalAmount: "20,000.00",
        status: "completed",
        successCount: 40,
        failedCount: 2,
        approvalRef: "EX_20250908_001",
        approvalTitle: "May - Request for expense payment",
        fromBank: "Shinhan",
    },
    {
        id: "2",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Expense_Payment_upload_EN_004",
        txnCount: 2,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        status: "completed",
        successCount: 45,
        failedCount: 0,
        approvalRef: "EX_241030_002",
        approvalTitle: "April - Request for expense payment",
        fromBank: "Shinhan",
        fromAccount: "00500044787814",
        fromCurrency: "VND",
        totalTransferAmount: "80.000.000đ",
        requestor: "Mr.Kim",
        fileSize: "108.69 KB",
        paymentRef: "Expense_Payment_241205",
    },
    {
        id: "3",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Expense_Payment_upload_EN_003",
        txnCount: 4,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "completed",
        successCount: 2,
        failedCount: 2,
        approvalRef: "EX_20250908_001",
        approvalTitle: "March - Request for expense payment",
        fromBank: "Shinhan",
    },
    {
        id: "4",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Expense_Payment_upload_EN_002",
        txnCount: 3,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "in_progress",
        approvalRef: "EX_20250908_001",
        approvalTitle: "February - Request for expense payment",
        fromBank: "Shinhan",
    },
    {
        id: "5",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Expense_Payment_upload_EN_001",
        txnCount: 8,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "completed",
        successCount: 1,
        failedCount: 2,
        approvalRef: "EX_20250908_001",
        approvalTitle: "January - Request for expense payment",
        fromBank: "Shinhan",
    },
];
