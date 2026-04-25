import type { ApprovalStatus } from "@/components/payment/approval-box/types";

/**
 * Payroll Scheduled Payment row — Figma 27:11294. Per CLAUDE.md §12a, every
 * batch-file payment module (Vendor / Expense / Payroll / Overseas) mirrors
 * the Internal Transfer Scheduled batch-file shape so all four modules can
 * reuse the same chrome (toolbar, table columns, totals footer, action
 * column). Each list row is one *uploaded payroll batch* (a file containing
 * N employee transactions), not a single payroll record.
 */
export type PayrollScheduledAction = "transfer" | "document" | "complete";
export type PayrollScheduledRowHighlight = "selected" | "warning";

export type PayrollScheduledRow = {
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
    action?: PayrollScheduledAction;
    /** Optional row tint — selected (light blue) or warning (amber). */
    rowHighlight?: PayrollScheduledRowHighlight;
    /** Withdrawal bank — reused by the detail page summary. */
    fromBank: string;
    /** Withdrawal account number — shown on detail page as "accountNo (currency)". */
    fromAccount?: string;
    /** File size shown in the detail-page file card, e.g. "108.69 KB". */
    fileSize?: string;
};

/**
 * Payroll Payment Result row — Figma 27:12877. Mirrors the Internal Transfer
 * Result batch-file shape (binary status + success/failed counters +
 * trailing per-row download glyph). Detail-only fields populated for the
 * row used by the Figma 27:13703 sample.
 */
export type PayrollResultStatus = "completed" | "in_progress";

export type PayrollResultRow = {
    id: string;
    /** Two-line date + time, e.g. `"30-10-2024\n11:39:50"`. */
    dateTime: string;
    fileName: string;
    /** Number of transactions in the batch (rendered as `"6 Trx (USD)"`). */
    txnCount: number;
    txnCurrency: string;
    /** Pre-formatted total amount, e.g. `"20.000.000"`. */
    totalAmount: string;
    status: PayrollResultStatus;
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
    /** Detail-page breadcrumb identifier — e.g. "Payroll_Payment_241205"
     *  (Figma 27:13703). */
    paymentRef?: string;
};

export const payrollScheduledRows: PayrollScheduledRow[] = [
    {
        id: "1",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Jan 2025 Payroll_250105",
        txnCount: 85,
        txnCurrency: "VND",
        totalAmount: "850.000.000",
        status: "approved",
        requestor: "LE THI HAI YEN",
        approver: "Cedar Grove",
        approverCount: 2,
        approvalRef: "PR_20250908_001",
        approvalTitle: "January - Request for payroll payment",
        action: "transfer",
        fromBank: "BIDV - 0569",
    },
    {
        id: "2",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Jan 2025 Bonus_250105",
        txnCount: 85,
        txnCurrency: "VND",
        totalAmount: "120.000.000",
        status: "in_progress",
        statusStep: "1/3",
        requestor: "LE THI HAI YEN",
        approver: "Lakeside Haven",
        approverCount: 3,
        approvalRef: "PR_20250908_002",
        approvalTitle: "January - Bonus request for payroll",
        action: "document",
        rowHighlight: "selected",
        fromBank: "VCB - 8210",
    },
    {
        id: "3",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Jan 2025 Expat Payroll_250105",
        txnCount: 5,
        txnCurrency: "USD",
        totalAmount: "32,500.00",
        // Warning row has no approval status badge (matches Internal/Vendor/Expense).
        requestor: "LE THI HAI YEN",
        approver: "Maplewood Village",
        approvalRef: "PR_20250908_003",
        approvalTitle: "January - Expat payroll request",
        action: "document",
        rowHighlight: "warning",
        fromBank: "HD BANK - 0442",
    },
    {
        id: "4",
        dateTime: "04-Jan-2025\n09:15:22",
        fileName: "Jan 2025 Probation_250104",
        txnCount: 3,
        txnCurrency: "VND",
        totalAmount: "18.000.000",
        status: "rejected",
        requestor: "LE THI HAI YEN",
        approver: "Maplewood Village",
        approvalRef: "PR_20250908_004",
        approvalTitle: "January - Probation payroll",
        action: "document",
        fromBank: "BIDV - 0569",
    },
    {
        id: "5",
        dateTime: "03-Jan-2025\n14:30:11",
        fileName: "Q4 Performance Bonus_250103",
        txnCount: 12,
        txnCurrency: "VND",
        totalAmount: "60.000.000",
        status: "pending",
        requestor: "LE THI HAI YEN",
        approver: "Maplewood Village",
        approvalRef: "PR_20250908_005",
        approvalTitle: "Q4 Performance bonus request",
        action: "document",
        fromBank: "VCB - 8210",
    },
    {
        id: "6",
        dateTime: "02-Jan-2025\n10:00:00",
        fileName: "Dec 2024 Payroll_250102",
        txnCount: 82,
        txnCurrency: "VND",
        totalAmount: "820.000.000",
        status: "approved",
        requestor: "LE THI HAI YEN",
        approver: "Grove",
        approverCount: 2,
        approvalRef: "PR_20250908_006",
        approvalTitle: "December - Request for payroll payment",
        action: "complete",
        fromBank: "Shinhan",
        fromAccount: "00500044787814",
        fileSize: "108.69 KB",
    },
    {
        id: "7",
        dateTime: "31-Dec-2024\n16:45:30",
        fileName: "Dec 2024 13th Salary_241231",
        txnCount: 82,
        txnCurrency: "VND",
        totalAmount: "820.000.000",
        status: "approved",
        requestor: "LE THI HAI YEN",
        approver: "Grove",
        approverCount: 2,
        approvalRef: "PR_20250908_007",
        approvalTitle: "December - 13th salary payment",
        action: "complete",
        fromBank: "Shinhan",
    },
];

export const payrollResultRows: PayrollResultRow[] = [
    {
        id: "1",
        dateTime: "31-12-2024\n17:00:00",
        fileName: "WeCMS_Payroll_upload_EN_005",
        txnCount: 82,
        txnCurrency: "VND",
        totalAmount: "820.000.000",
        status: "completed",
        successCount: 80,
        failedCount: 2,
        approvalRef: "PR_20250908_001",
        approvalTitle: "December - Request for payroll payment",
        fromBank: "Shinhan",
    },
    {
        id: "2",
        dateTime: "31-12-2024\n17:05:00",
        fileName: "WeCMS_Payroll_upload_EN_004",
        txnCount: 82,
        txnCurrency: "VND",
        totalAmount: "820.000.000",
        status: "completed",
        successCount: 82,
        failedCount: 0,
        approvalRef: "PR_241231_002",
        approvalTitle: "December - 13th salary payment",
        fromBank: "Shinhan",
        fromAccount: "00500044787814",
        fromCurrency: "VND",
        totalTransferAmount: "820.000.000đ",
        requestor: "LE THI HAI YEN",
        fileSize: "108.69 KB",
        paymentRef: "Payroll_Payment_241231",
    },
    {
        id: "3",
        dateTime: "31-12-2024\n17:10:00",
        fileName: "WeCMS_Payroll_upload_EN_003",
        txnCount: 5,
        txnCurrency: "USD",
        totalAmount: "32,500.00",
        status: "completed",
        successCount: 3,
        failedCount: 2,
        approvalRef: "PR_20250908_003",
        approvalTitle: "December - Expat payroll",
        fromBank: "Shinhan",
    },
    {
        id: "4",
        dateTime: "30-12-2024\n09:00:00",
        fileName: "WeCMS_Payroll_upload_EN_002",
        txnCount: 2,
        txnCurrency: "VND",
        totalAmount: "12.000.000",
        status: "in_progress",
        approvalRef: "PR_20250908_004",
        approvalTitle: "December - Probation payroll",
        fromBank: "Shinhan",
    },
    {
        id: "5",
        dateTime: "29-12-2024\n15:30:00",
        fileName: "WeCMS_Payroll_upload_EN_001",
        txnCount: 10,
        txnCurrency: "VND",
        totalAmount: "50.000.000",
        status: "completed",
        successCount: 8,
        failedCount: 2,
        approvalRef: "PR_20250908_005",
        approvalTitle: "Q3 Performance bonus",
        fromBank: "Shinhan",
    },
];
