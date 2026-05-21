import type { ApprovalStatus } from "@/components/payment/approval-box/types";

export type PayrollScheduledAction = "transfer" | "document" | "complete";
export type PayrollScheduledRowHighlight = "selected" | "warning";

export type PayrollScheduledRow = {
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
    action?: PayrollScheduledAction;
    rowHighlight?: PayrollScheduledRowHighlight;
    fromBank: string;
    fromAccount?: string;
    fileSize?: string;
};

export type PayrollResultStatus = "completed" | "in_progress";

export type PayrollResultRow = {
    id: string;
    dateTime: string;
    fileName: string;
    txnCount: number;
    txnCurrency: string;
    totalAmount: string;
    status: PayrollResultStatus;
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
