import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import type {
    PaymentResultBatchRow,
    PaymentResultBatchRowStatus,
} from "@/components/payment/shared/PaymentResultBatchListPage";
import type {
    PaymentScheduledBatchRow,
    ScheduledBatchAction,
    ScheduledBatchRowHighlight,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";

/**
 * Overseas Scheduled Payment row — Figma 29:14947. Mirrors the Internal
 * Transfer batch-file shape per CLAUDE.md §12a; Overseas's only structural
 * variation is the extra `scheduleDate` field rendered through the shared
 * `<PaymentScheduledBatchListPage>`'s `extraColumn` slot.
 */
export type OverseasScheduledRow = PaymentScheduledBatchRow & {
    /** Schedule date — Overseas-only column inserted between Total Transfer
     *  Amount and Approval Status (Figma 29:14947). */
    scheduleDate: string;
    /** Withdrawal bank — reused by the detail page summary. */
    fromBank: string;
    fromAccount?: string;
    fileSize?: string;
    /** Detail-page summary requestor (re-uses `requestor` if absent). */
    detailRequestor?: string;
};

/**
 * Overseas Payment Result row — Figma 29:16738. Mirrors Internal Transfer
 * Result's batch-file shape; detail-only fields populate the row used by
 * the Figma 29:17560 sample.
 */
export type OverseasResultRow = PaymentResultBatchRow & {
    fromBank: string;
    fromAccount?: string;
    fromCurrency?: string;
    totalTransferAmount?: string;
    requestor?: string;
    fileSize?: string;
    /** Detail-page breadcrumb — e.g. "Payment_241205". */
    paymentRef?: string;
};

/** Re-export for downstream consumers that switch over status / row variants. */
export type OverseasScheduledStatus = ApprovalStatus;
export type OverseasResultStatus = PaymentResultBatchRowStatus;
export type OverseasScheduledAction = ScheduledBatchAction;
export type OverseasScheduledRowHighlight = ScheduledBatchRowHighlight;

export type ExchangeRateRow = {
    id: string;
    bank: string;
    currencyPair: string;
    buyingRate: string;
    sellingRate: string;
    midRate: string;
    referenceDate: string;
};

export const overseasScheduledRows: OverseasScheduledRow[] = [
    {
        id: "1",
        dateTime: "05-Oct-2025\n11:39:50",
        fileName: "Overseas Payment_Request_241205",
        txnCount: 5,
        txnCurrency: "VND",
        totalAmount: "2.000.000",
        scheduleDate: "—",
        // Figma 29:14947 — warning row has no approval status badge.
        requestor: "Mr.Kim",
        approver: "Cedar Grove",
        approvalRef: "VO_20250908_001",
        approvalTitle: "April - Request for overseas payment",
        action: "document",
        rowHighlight: "warning",
        fromBank: "Shinhan",
    },
    {
        id: "2",
        dateTime: "05-Oct-2025\n11:39:50",
        fileName: "Payment_Request_241205",
        txnCount: 6,
        txnCurrency: "USD",
        totalAmount: "200,00",
        scheduleDate: "11-Dec-2025",
        status: "approved",
        requestor: "Mr.Kim",
        approver: "Cedar Grove",
        approverCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "March - Request for overseas payment",
        action: "transfer",
        fromBank: "Shinhan",
        fromAccount: "700022964690",
        fileSize: "108.69 KB",
    },
    {
        id: "3",
        dateTime: "05-Oct-2025\n11:39:50",
        fileName: "Payment_Request_241205",
        txnCount: 6,
        txnCurrency: "USD",
        totalAmount: "200,00",
        scheduleDate: "28-Dec-2025",
        status: "approved",
        requestor: "Mr.Kim",
        approver: "Cedar Grove",
        approverCount: 3,
        approvalRef: "VO_20250908_001",
        approvalTitle: "February - Request for overseas payment",
        action: "transfer",
        fromBank: "Shinhan",
    },
    {
        id: "4",
        dateTime: "05-Oct-2025\n11:39:50",
        fileName: "Payment_Request_241205",
        txnCount: 8,
        txnCurrency: "KRW",
        totalAmount: "2.000.000",
        scheduleDate: "10-Oct-2025",
        status: "approved",
        requestor: "Mr.Kim",
        approver: "Cedar Grove",
        approverCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "January - Request for overseas payment",
        action: "complete",
        fromBank: "Shinhan",
        fromAccount: "700022964690",
        fileSize: "108.69 KB",
    },
];

export const overseasResultRows: OverseasResultRow[] = [
    {
        id: "1",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Overseas_Payment_upload_EN_005",
        txnCount: 6,
        txnCurrency: "USD",
        totalAmount: "20,000.00",
        status: "completed",
        successCount: 40,
        failedCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "May - Request for overseas payment",
        fromBank: "Shinhan",
    },
    {
        id: "2",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Overseas_Payment_upload_EN_004",
        txnCount: 2,
        txnCurrency: "USD",
        totalAmount: "20.000.000",
        status: "completed",
        successCount: 45,
        failedCount: 0,
        approvalRef: "VO_20250908_001",
        approvalTitle: "April - Request for overseas payment",
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
        fileName: "WeCMS_Overseas_Payment_upload_EN_003",
        txnCount: 4,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "completed",
        successCount: 2,
        failedCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "March - Request for overseas payment",
        fromBank: "Shinhan",
    },
    {
        id: "4",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Overseas_Payment_upload_EN_002",
        txnCount: 3,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "in_progress",
        approvalRef: "VO_20250908_001",
        approvalTitle: "February - Request for overseas payment",
        fromBank: "Shinhan",
    },
    {
        id: "5",
        dateTime: "30-10-2024\n11:39:50",
        fileName: "WeCMS_Overseas_Payment_upload_EN_001",
        txnCount: 8,
        txnCurrency: "VND",
        totalAmount: "20.000.000",
        status: "completed",
        successCount: 1,
        failedCount: 2,
        approvalRef: "VO_20250908_001",
        approvalTitle: "January - Request for overseas payment",
        fromBank: "Shinhan",
    },
];

export const exchangeRateRows: ExchangeRateRow[] = [
    {
        id: "1",
        bank: "BIDV",
        currencyPair: "USD/VND",
        buyingRate: "24,950.00",
        sellingRate: "25,200.00",
        midRate: "25,075.00",
        referenceDate: "30-Jan-2025",
    },
    {
        id: "2",
        bank: "Vietcombank",
        currencyPair: "USD/VND",
        buyingRate: "24,960.00",
        sellingRate: "25,210.00",
        midRate: "25,085.00",
        referenceDate: "30-Jan-2025",
    },
    {
        id: "3",
        bank: "Shinhan",
        currencyPair: "KRW/VND",
        buyingRate: "17.20",
        sellingRate: "17.80",
        midRate: "17.50",
        referenceDate: "30-Jan-2025",
    },
    {
        id: "4",
        bank: "Woori",
        currencyPair: "KRW/VND",
        buyingRate: "17.18",
        sellingRate: "17.78",
        midRate: "17.48",
        referenceDate: "30-Jan-2025",
    },
    {
        id: "5",
        bank: "BIDV",
        currencyPair: "JPY/VND",
        buyingRate: "162.40",
        sellingRate: "168.20",
        midRate: "165.30",
        referenceDate: "30-Jan-2025",
    },
    {
        id: "6",
        bank: "Vietcombank",
        currencyPair: "EUR/VND",
        buyingRate: "26,890.00",
        sellingRate: "27,420.00",
        midRate: "27,155.00",
        referenceDate: "30-Jan-2025",
    },
    {
        id: "7",
        bank: "HD Bank",
        currencyPair: "SGD/VND",
        buyingRate: "18,420.00",
        sellingRate: "18,750.00",
        midRate: "18,585.00",
        referenceDate: "30-Jan-2025",
    },
];
