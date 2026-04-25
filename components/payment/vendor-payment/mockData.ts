import type { ApprovalStatus } from "@/components/payment/approval-box/types";

/**
 * Vendor Scheduled Payment row — Figma 24:1398. Mirrors the Internal
 * Transfer Scheduled batch-file shape so Vendor Payment can reuse the same
 * chrome (toolbar, table columns, totals footer, action column) as Internal
 * Transfer per CLAUDE.md baseline directive: each list row is one *uploaded
 * batch* (a file containing N transactions), not a single payment.
 */
export type VendorScheduledAction = "transfer" | "document" | "complete";
export type VendorScheduledRowHighlight = "selected" | "warning";

export type VendorScheduledRow = {
    id: string;
    /** Two-line date + time, e.g. `"05-Jan-2025\n11:39:50"`. */
    dateTime: string;
    fileName: string;
    /** Number of transactions in the batch (rendered as `"6 Transaction (USD)"`). */
    txnCount: number;
    txnCurrency: string;
    /** Pre-formatted total amount, e.g. `"20.000.000"`. */
    totalAmount: string;
    /** Approval status — optional. Figma 24:1398 leaves the cell empty for
     *  unsubmitted warning rows (placeholder drafts), so this is opt-in. */
    status?: ApprovalStatus;
    /** Progress indicator for `in_progress`, e.g. `"1/3"`. */
    statusStep?: string;
    requestor: string;
    approver: string;
    /** Optional count pill next to the approver name (e.g. `2`). */
    approverCount?: number;
    approvalRef: string;
    approvalTitle: string;
    /** Right-most action column variant — Figma 24:1398 mixes 4 states per row. */
    action?: VendorScheduledAction;
    /** Optional row tint — selected (light blue) or warning (amber). */
    rowHighlight?: VendorScheduledRowHighlight;
    /** Withdrawal bank — reused by the detail page summary. */
    fromBank: string;
    /** Withdrawal account number — shown on detail page as "accountNo (currency)". */
    fromAccount?: string;
    /** File size shown in the detail-page file card, e.g. "108.69 KB". */
    fileSize?: string;
};

/**
 * Vendor Payment Result row — Figma 24:5491. Mirrors Internal Transfer's
 * Result batch-file shape (binary status + success/failed counters +
 * trailing per-row download glyph). Detail-only fields populated for the
 * row used by the Figma 24:6337 sample.
 */
export type VendorResultStatus = "completed" | "in_progress";

export type VendorResultRow = {
    id: string;
    /** Two-line date + time, e.g. `"30-10-2024\n11:39:50"`. */
    dateTime: string;
    fileName: string;
    /** Number of transactions in the batch (rendered as `"6 Trx (USD)"`). */
    txnCount: number;
    txnCurrency: string;
    /** Pre-formatted total amount, e.g. `"20.000.000"`. */
    totalAmount: string;
    status: VendorResultStatus;
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
    /** Detail-page breadcrumb identifier — e.g. "Vendor_Payment_241205"
     *  (Figma 24:6337). */
    paymentRef?: string;
};

export const vendorScheduledRows: VendorScheduledRow[] = [
    {
        id: "1",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Expense_Payment_241205",
        txnCount: 6,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        status: "approved",
        requestor: "Mr.Kim",
        approver: "Cedar Grove",
        approverCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "June - Request for vendor payment",
        action: "transfer",
        fromBank: "BIDV - 0569",
    },
    {
        id: "2",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Dec 2024 1st Payroll_241205",
        txnCount: 6,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        status: "in_progress",
        statusStep: "1/3",
        requestor: "Mr.Kim",
        approver: "Lakeside Haven",
        approverCount: 3,
        approvalRef: "VO_20250908_001",
        approvalTitle: "May - Request for vendor payment",
        action: "document",
        rowHighlight: "selected",
        fromBank: "VCB - 8210",
    },
    {
        id: "3",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Vender_Payment_241205",
        txnCount: 12,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        // Figma 24:1398 — warning row has no approval status badge.
        requestor: "Mr.Kim",
        approver: "Maplewood Village",
        approvalRef: "VO_20250908_001",
        approvalTitle: "April - Request for vendor payment",
        action: "document",
        rowHighlight: "warning",
        fromBank: "HD BANK - 0442",
    },
    {
        id: "4",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Dec 2024 1st Payroll_241205",
        txnCount: 45,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "rejected",
        requestor: "Mr.Kim",
        approver: "Maplewood Village",
        approvalRef: "VO_20250908_001",
        approvalTitle: "April - Request for vendor payment",
        action: "document",
        fromBank: "BIDV - 0569",
    },
    {
        id: "5",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Expense_Payment_241105",
        txnCount: 15,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "pending",
        requestor: "Mr.Kim",
        approver: "Maplewood Village",
        approvalRef: "VO_20250908_001",
        approvalTitle: "March - Request for vendor payment",
        action: "document",
        fromBank: "VCB - 8210",
    },
    {
        id: "6",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Nov 2024 2st Payroll_241105",
        txnCount: 4,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "approved",
        requestor: "Mr.Kim",
        approver: "Grove",
        approverCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "February - Request for vendor payment",
        action: "complete",
        fromBank: "Shinhan",
        fromAccount: "00500044787814",
        fileSize: "108.69 KB",
    },
    {
        id: "7",
        dateTime: "05-Jan-2025\n11:39:50",
        fileName: "Nov 2024 2st Payroll_241105",
        txnCount: 4,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "approved",
        requestor: "Mr.Kim",
        approver: "Grove",
        approverCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "January - Request for vendor payment",
        action: "complete",
        fromBank: "Shinhan",
    },
];

export const vendorResultRows: VendorResultRow[] = [
    {
        id: "1",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Vendor_Payment_upload_EN_005",
        txnCount: 6,
        txnCurrency: "USD",
        totalAmount: "20,000.00",
        status: "completed",
        successCount: 40,
        failedCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "June - Request for vendor payment",
        fromBank: "Shinhan",
    },
    {
        id: "2",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Vendor_Payment_upload_EN_004",
        txnCount: 2,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        status: "completed",
        successCount: 45,
        failedCount: 0,
        approvalRef: "VO_241030_002",
        approvalTitle: "May - Request for vendor payment",
        fromBank: "Shinhan",
        fromAccount: "00500044787814",
        fromCurrency: "VND",
        totalTransferAmount: "80.000.000đ",
        requestor: "Mr.Kim",
        fileSize: "108.69 KB",
        paymentRef: "Vendor_Payment_241205",
    },
    {
        id: "3",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Vendor_Payment_upload_EN_003",
        txnCount: 4,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "completed",
        successCount: 2,
        failedCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "April - Request for vendor payment",
        fromBank: "Shinhan",
    },
    {
        id: "4",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Vendor_Payment_upload_EN_002",
        txnCount: 3,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "in_progress",
        approvalRef: "VO_20250908_001",
        approvalTitle: "March - Request for vendor payment",
        fromBank: "Shinhan",
    },
    {
        id: "5",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Vendor_Payment_upload_EN_001",
        txnCount: 8,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "completed",
        successCount: 1,
        failedCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "January - Request for vendor payment",
        fromBank: "Shinhan",
    },
];
