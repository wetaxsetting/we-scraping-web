import type { ApprovalStatus } from "@/components/payment/approval-box/types";

export type ExpenseScheduledAction = "transfer" | "document" | "complete";
export type ExpenseScheduledRowHighlight = "selected" | "warning";

export type ExpenseScheduledRow = {
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
    action?: ExpenseScheduledAction;
    rowHighlight?: ExpenseScheduledRowHighlight;
    fromBank: string;
    fromAccount?: string;
    fileSize?: string;
};

export type ExpenseResultStatus = "completed" | "in_progress";

export type ExpenseResultRow = {
    id: string;
    dateTime: string;
    fileName: string;
    txnCount: number;
    txnCurrency: string;
    totalAmount: string;
    status: ExpenseResultStatus;
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
