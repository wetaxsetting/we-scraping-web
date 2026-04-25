/**
 * Shared types for the Approval Box feature. Field names stay aligned with
 * the future backend contract (UPPER_SNAKE on the wire, camelCase in the UI
 * layer) so the mock rows can be swapped for real API data without reshaping
 * the table.
 */

export type ApprovalStatus =
    | "draft"
    | "pending"
    | "in_progress"
    | "approved"
    | "rejected";

export type ApprovalTabKey = "all" | ApprovalStatus;

export type ApprovalRow = {
    id: string;
    date: string;              // Registration date (Figma format: 30-Jan-2025)
    type: string;              // Payment type: Vendor Payment / Expense Payment / …
    documentNo: string;
    title: string;
    fileName: string;
    currency: "VND" | "USD" | "KRW";
    amount: string;            // Pre-formatted per locale (UI-only)
    status: ApprovalStatus;
    /** Optional progress for in_progress / approved statuses (e.g. "1/3"). */
    statusStep?: string;
    scheduledDate?: string;    // May be missing → rendered as "-"
    requestor: string;
    approver: string;
    approverCount?: number;    // Small numeric badge next to approver name
};

export type TabCounts = Record<ApprovalTabKey, number>;

export type CurrencyTotal = {
    currency: "VND" | "USD" | "KRW";
    total: string;
};
