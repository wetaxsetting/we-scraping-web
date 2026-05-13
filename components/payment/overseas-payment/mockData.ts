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

import type { ExchangeRateDisplayRow } from "./types";
export type { ExchangeRateDisplayRow };

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

/** Mock data for the currency × bank-rate matrix — Figma 38:13376 (Shinhan Bank selected). */
export const exchangeRateMatrixRows: ExchangeRateDisplayRow[] = [
    { currency: "USD", flag: "🇺🇸", cashBuy: "25,890.00", cashSell: "26,900.00", ttBuy: "25,900.00", ttSell: "26,240.00" },
    { currency: "KRW", flag: "🇰🇷", cashBuy: "18.12",     cashSell: "19.64",     ttBuy: "19.64",     ttSell: "19.64"     },
    { currency: "JPY", flag: "🇯🇵", cashBuy: "174.41",    cashSell: "181.93",    ttBuy: "181.93",    ttSell: "181.93"    },
    { currency: "EUR", flag: "🇪🇺", cashBuy: "29,881.00", cashSell: "31,000.00", ttBuy: "31,000.00", ttSell: "31,000.00" },
    { currency: "AUD", flag: "🇦🇺", cashBuy: "16,816.00", cashSell: "17,408.00", ttBuy: "17,408.00", ttSell: "17,408.00" },
    { currency: "GBP", flag: "🇬🇧", cashBuy: "34,698.00", cashSell: "35,991.00", ttBuy: "35,991.00", ttSell: "35,991.00" },
    { currency: "SGD", flag: "🇸🇬", cashBuy: "20,097.00", cashSell: "20,804.00", ttBuy: "20,804.00", ttSell: "20,804.00" },
    { currency: "HKD", flag: "🇭🇰", cashBuy: "3,306.00",  cashSell: "3,426.00",  ttBuy: "3,426.00",  ttSell: "3,426.00"  },
    { currency: "CAD", flag: "🇨🇦", cashBuy: "18,783.00", cashSell: "19,444.00", ttBuy: "19,444.00", ttSell: "19,444.00" },
    { currency: "CHF", flag: "🇨🇭", cashBuy: "32,079.00", cashSell: "33,207.00", ttBuy: "33,207.00", ttSell: "33,207.00" },
    { currency: "THB", flag: "🇹🇭", cashBuy: "781.17",    cashSell: "833.21",    ttBuy: "833.21",    ttSell: "833.21"    },
    { currency: "NZD", flag: "🇳🇿", cashBuy: "14,999.00", cashSell: "15,706.00", ttBuy: "15,706.00", ttSell: "15,706.00" },
];
