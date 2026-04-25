import type { ApprovalRow, CurrencyTotal, TabCounts } from "./types";

/**
 * Static mock data mirroring the Figma Approval Box sample. The shape matches
 * {@link ApprovalRow} so the table swaps to a real API response without any
 * structural changes. Values stay in the UI-pre-formatted form Figma shows.
 */
export const mockRows: ApprovalRow[] = [
    {
        id: "1",
        date: "30-Jan-2025",
        type: "Vendor Payment",
        documentNo: "VO_241030_002",
        title: "January - Request for internal transfer",
        fileName: "WeCMS_Internal_Transfer_upload_EN",
        currency: "VND",
        amount: "2.000.000",
        status: "in_progress",
        statusStep: "1/3",
        scheduledDate: "30-10-2025",
        requestor: "LE THI HAI YEN",
        approver: "Liam Hawthorne",
        approverCount: 3,
    },
    {
        id: "2",
        date: "30-Jan-2025",
        type: "Vendor Payment",
        documentNo: "VO_241030_002",
        title: "January - Request for Vendor Payment",
        fileName: "WeCMS_Vendor_Payment_upload_EN",
        currency: "VND",
        amount: "2.000.000",
        status: "rejected",
        scheduledDate: "30-10-2025",
        requestor: "LE THI HAI YEN",
        approver: "Maya Sinclair",
        approverCount: 3,
    },
    {
        id: "3",
        date: "30-Jan-2025",
        type: "Expense Payment",
        documentNo: "VO_241030_002",
        title: "January - Request for Expense Payment",
        fileName: "WeCMS_Expense_Payment_upload_EN",
        currency: "VND",
        amount: "2.000.000",
        status: "approved",
        statusStep: "3/3",
        scheduledDate: "30-10-2025",
        requestor: "LE THI HAI YEN",
        approver: "Noah Kensington",
        approverCount: 1,
    },
    {
        id: "4",
        date: "30-Jan-2025",
        type: "Corporate Card",
        documentNo: "VO_241030_002",
        title: "January - Request for Card Payment",
        fileName: "WeCMS_Card_Payment_upload_EN",
        currency: "VND",
        amount: "2.000.000",
        status: "draft",
        scheduledDate: undefined,
        requestor: "LE THI HAI YEN",
        approver: "Noah Kensington",
        approverCount: 1,
    },
    {
        id: "5",
        date: "30-Jan-2025",
        type: "Payroll",
        documentNo: "VO_241030_002",
        title: "January - Request for Payroll Payment",
        fileName: "WeCMS_Payroll_Payment_upload_EN",
        currency: "VND",
        amount: "2.000.000",
        status: "pending",
        scheduledDate: "30-10-2025",
        requestor: "LE THI HAI YEN",
        approver: "Noah Kensington",
        approverCount: 3,
    },
];

export const mockTabCounts: TabCounts = {
    all: 18,
    draft: 2,
    pending: 2,
    in_progress: 1,
    approved: 2,
    rejected: 14,
};

export const mockCurrencyTotals: CurrencyTotal[] = [
    { currency: "USD", total: "0" },
    { currency: "VND", total: "10.000.000" },
    { currency: "KRW", total: "0" },
];
