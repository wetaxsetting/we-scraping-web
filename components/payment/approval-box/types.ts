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

export type ApprovalType =
    | "payroll"
    | "vendor"
    | "expense"
    | "corporate_card"
    | "overseas"
    | "internal_transfer";

export type ApproverStatus = "P" | "A" | "R" | "W" | "S";

export type ApprovalApprover = {
    lineNo: number;
    userId: string;
    userName: string;
    status: ApproverStatus;
    /** ISO-display string (e.g. `28-04-2026 09:00:00`); null when the approver has not acted. */
    actedAt: string | null;
};

export type ApprovalRow = {
    id: string;
    apprSeqNo: string;
    date: string;              // Registration date — DD-MMM-YYYY for display
    type: string;              // Localised label resolved via t(typeKey)
    typeKey: ApprovalType | null;
    documentNo: string;
    title: string;
    /** Free-form approval content set by the requestor on Request
     *  Approval. Renders in the Approval Details popup's "Approval
     *  Content" section. Null / empty hides the section. */
    cont: string | null;
    fileName: string;
    currency: "VND" | "USD" | "KRW";
    amount: string;            // Raw numeric string from the wire — format at render with formatAmount(amount, currency)
    status: ApprovalStatus;
    /** Optional progress for in_progress / approved statuses (e.g. "1/3"). */
    statusStep?: string;
    scheduledDate?: string;    // May be missing → rendered as "-"
    requestor: string;
    approver: string;          // First step's display name
    /** Inline badge next to the approver name. Format is `X/Y` where
     *  X = approvers who have already approved (APPRVR_STTS='A') and
     *  Y = total approvers in the chain. Mirrors legacy
     *  `comm_0195_001.ts:535` "Approver (X/Y)" math — a fresh request
     *  reads as `0/N`, the first approval flips to `1/N`, all-approved
     *  reads as `N/N`. Undefined when there is no chain (rare). */
    approverCount?: string;
    approvers: ApprovalApprover[];
    /** Caller is an assigned approver whose row is `PENDING`. Drives the
     *  per-row Approve / Reject CTA visibility. */
    actionable: boolean;
    payEndYn: "Y" | "N";
};

export type TabCounts = Record<ApprovalTabKey, number>;

export type CurrencyTotal = {
    currency: "VND" | "USD" | "KRW";
    total: string;
};

export type RowAction = "approve" | "reject";
