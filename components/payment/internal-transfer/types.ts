import type { ApprovalStatus } from "@/components/payment/approval-box/types";

export type ScheduledTransferAction = "transfer" | "document" | "complete";
export type ScheduledTransferRowHighlight = "selected" | "warning";

export type InternalScheduledRow = {
    id: string;
    dateTime: string;
    fileName: string;
    txnCount: number;
    txnCurrency: string;
    totalAmount: string;
    status?: ApprovalStatus;
    statusStep?: string;
    requestor: string;
    approver: string;
    approverCount?: number;
    approvalRef: string;
    docNo?: string | null;
    approvalTitle: string;
    action?: ScheduledTransferAction;
    rowHighlight?: ScheduledTransferRowHighlight;
    fromBank: string;
    fromAccount?: string;
    fileSize?: string;
    /** Scheduled execution date (PAY_DATE from wire — `yyyymmdd`),
     *  formatted as `dd-mm-yyyy` for display. Legacy mirror:
     *  `pymn_0009_001.ts:1162` PAY_DATE cellMapping. */
    scheduleDate?: string;
};

export type TransferResultStatus = "completed" | "in_progress";

export type InternalResultRow = {
    id: string;
    dateTime: string;
    fileName: string;
    txnCount: number;
    txnCurrency: string;
    totalAmount: string;
    status: TransferResultStatus;
    successCount?: number;
    failedCount?: number;
    approvalRef: string;
    approvalTitle: string;
    fromBank: string;
    fromAccount?: string;
    fromCurrency?: string;
    totalTransferAmount?: string;
    requestor?: string;
    fileSize?: string;
    paymentRef?: string;
};
