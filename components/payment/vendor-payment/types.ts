import type { ApprovalStatus } from "@/components/payment/approval-box/types";

export type VendorScheduledAction = "transfer" | "document" | "complete";
export type VendorScheduledRowHighlight = "selected" | "warning";

export type VendorScheduledRow = {
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
    action?: VendorScheduledAction;
    rowHighlight?: VendorScheduledRowHighlight;
    fromBank: string;
    fromAccount?: string;
    fileSize?: string;
};

export type VendorResultStatus = "completed" | "in_progress";

export type VendorResultRow = {
    id: string;
    dateTime: string;
    fileName: string;
    txnCount: number;
    txnCurrency: string;
    totalAmount: string;
    status: VendorResultStatus;
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
