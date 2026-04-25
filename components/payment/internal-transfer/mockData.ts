import type { ApprovalStatus } from "@/components/payment/approval-box/types";

/**
 * One Scheduled Transfer batch — Figma 1:9972 lists each row as a *file*
 * (one upload containing N transactions), not as a single transfer. So the
 * row shape mirrors the Figma columns: file metadata + a transaction count
 * + the batch's total transfer amount, plus the approval-line metadata
 * (requestor / approver / ref / title) used by both this list and the
 * detail page.
 */
export type ScheduledTransferAction = "transfer" | "document" | "complete";
export type ScheduledTransferRowHighlight = "selected" | "warning";

export type InternalScheduledRow = {
    id: string;
    /** Two-line date + time, e.g. `"05-07-2025\n11:39:50"`. */
    dateTime: string;
    fileName: string;
    /** Number of transactions in the batch (rendered as `"6 Transaction (USD)"`). */
    txnCount: number;
    txnCurrency: string;
    /** Pre-formatted total amount, e.g. `"20.000.000"`. */
    totalAmount: string;
    /** Approval status — optional. Figma 1:9972 leaves the cell empty for
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
    /** Right-most action column variant — Figma 1:9972 mixes 4 states per row. */
    action?: ScheduledTransferAction;
    /** Optional row tint — selected (light blue) or warning (amber). */
    rowHighlight?: ScheduledTransferRowHighlight;
    /** Withdrawal bank — reused by the detail page summary. */
    fromBank: string;
    /** Withdrawal account number — shown on detail page as "accountNo (currency)". */
    fromAccount?: string;
    /** File size shown in the detail-page file card, e.g. "108.69 KB". */
    fileSize?: string;
};

/**
 * One Transfer Result batch — Figma 1:11730 mirrors Scheduled Transfer's
 * file-level row shape but adds:
 *   • a binary `status` (Completed | In Progress) — narrower vocabulary than
 *     the approval-status badge (the approval flow has finished by the time
 *     a row reaches this list)
 *   • inline success / failed counters rendered next to the status pill
 *   • a trailing per-row download button (no checkbox column on this page)
 *
 * Detail-page-only fields (`fromAccount`, `fromCurrency`, `requestor`,
 * `fileSize`, `totalTransferAmount`) are populated only for the row used by
 * the static detail mock so the detail page renders the Figma 1:13476
 * sample summary without a fork in the type.
 */
export type TransferResultStatus = "completed" | "in_progress";

export type InternalResultRow = {
    id: string;
    /** Two-line date + time, e.g. `"30-10-2024\n11:39:50"`. */
    dateTime: string;
    fileName: string;
    /** Number of transactions in the batch (rendered as `"6 Trx (USD)"`). */
    txnCount: number;
    txnCurrency: string;
    /** Pre-formatted total amount, e.g. `"20.000.000"`. */
    totalAmount: string;
    status: TransferResultStatus;
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
    /** Detail-page breadcrumb identifier — e.g. "Payment_241205" (Figma 1:13476).
     *  Distinct from `fileName` (which is the upload doc) and `approvalRef`
     *  (the approval reference). When omitted, the detail page derives a
     *  display label from the file name. */
    paymentRef?: string;
};

export const internalScheduledRows: InternalScheduledRow[] = [
    {
        id: "1",
        dateTime: "05-07-2025\n11:39:50",
        fileName: "Internal_Transfer_241210",
        txnCount: 6,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        status: "approved",
        requestor: "Mr.Kim",
        approver: "Cedar Grove",
        approverCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "May - Request for internal transfer",
        action: "transfer",
        fromBank: "BIDV - 0569",
    },
    {
        id: "2",
        dateTime: "05-07-2025\n11:39:50",
        fileName: "Internal_Transfer_241209",
        txnCount: 6,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        status: "in_progress",
        statusStep: "1/3",
        requestor: "Mr.Kim",
        approver: "Lakeside Haven",
        approverCount: 3,
        approvalRef: "VO_20250908_001",
        approvalTitle: "April - Request for internal transfer",
        action: "document",
        rowHighlight: "selected",
        fromBank: "VCB - 8210",
    },
    {
        id: "3",
        dateTime: "05-07-2025\n11:39:50",
        fileName: "Internal_Transfer_241208",
        txnCount: 12,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        // Figma 1:9972 — warning row has no approval status badge.
        requestor: "Mr.Kim",
        approver: "Maplewood Village",
        approvalRef: "VO_20250908_001",
        approvalTitle: "March - Request for internal transfer",
        action: "document",
        rowHighlight: "warning",
        fromBank: "HD BANK - 0442",
    },
    {
        id: "4",
        dateTime: "05-07-2025\n11:39:50",
        fileName: "Internal_Transfer_241207",
        txnCount: 45,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "rejected",
        requestor: "Mr.Kim",
        approver: "Maplewood Village",
        approvalRef: "VO_20250908_001",
        approvalTitle: "March - Request for internal transfer",
        action: "document",
        fromBank: "BIDV - 0569",
    },
    {
        id: "5",
        dateTime: "05-07-2025\n11:39:50",
        fileName: "Internal_Transfer_241206",
        txnCount: 15,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "pending",
        requestor: "Mr.Kim",
        approver: "Maplewood Village",
        approvalRef: "VO_20250908_001",
        approvalTitle: "February - Request for internal transfer",
        action: "document",
        fromBank: "VCB - 8210",
    },
    {
        id: "6",
        dateTime: "05-07-2025\n11:39:50",
        fileName: "Internal_Transfer_241205",
        txnCount: 4,
        txnCurrency: "USD",
        totalAmount: "$400,00",
        status: "approved",
        requestor: "Mr.Kim",
        approver: "Grove",
        approverCount: 2,
        approvalRef: "VO_241030_002",
        approvalTitle: "January - Request for internal transfer",
        action: "complete",
        fromBank: "Shinhan",
        fromAccount: "00500044787814",
        fileSize: "108.69 KB",
    },
];

export const internalResultRows: InternalResultRow[] = [
    {
        id: "1",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Internal_Transfer_upload_EN_005",
        txnCount: 6,
        txnCurrency: "USD",
        totalAmount: "20,000.00",
        status: "completed",
        successCount: 40,
        failedCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "May - Request for internal transfer",
        fromBank: "Shinhan",
    },
    {
        id: "2",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Internal_Transfer_upload_EN_004",
        txnCount: 2,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        status: "completed",
        successCount: 45,
        failedCount: 0,
        approvalRef: "VO_241030_002",
        approvalTitle: "April - Request for internal transfer",
        fromBank: "Shinhan",
        fromAccount: "00500044787814",
        fromCurrency: "VND",
        totalTransferAmount: "80.000.000đ",
        requestor: "Mr.Kim",
        fileSize: "108.69 KB",
        paymentRef: "Payment_241205",
    },
    {
        id: "3",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Internal_Transfer_upload_EN_003",
        txnCount: 4,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "completed",
        successCount: 2,
        failedCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "March - Request for internal transfer",
        fromBank: "Shinhan",
    },
    {
        id: "4",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Internal_Transfer_upload_EN_002",
        txnCount: 3,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "in_progress",
        approvalRef: "VO_20250908_001",
        approvalTitle: "February - Request for internal transfer",
        fromBank: "Shinhan",
    },
    {
        id: "5",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Internal_Transfer_upload_EN_001",
        txnCount: 8,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "completed",
        successCount: 1,
        failedCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "January - Request for internal transfer",
        fromBank: "Shinhan",
    },
];
