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
    /** Scheduled Date — formatted from wire `pay_date` (`PAY_TRAN_DT`). */
    scheduleDate?: string;
    /** Payroll Type — raw wire `appr_fund_tp` code (`"0"`=Salary,
     *  `"1"`=Bonus, else blank/null). The label is resolved at render
     *  time so it stays locale-reactive. */
    payrollType?: string | null;
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
