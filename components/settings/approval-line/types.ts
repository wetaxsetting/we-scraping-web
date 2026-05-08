/**
 * Approval Line panel — Figma 9196:11717.
 *
 * Each row represents a saved approval line (a named sequence of approvers
 * the user can attach to a transaction). Rows where multiple approvers are
 * configured render a small count badge plus a chevron in the Approver
 * column so the user can later expand the full approver chain. Single-
 * approver rows omit the badge entirely.
 */
export type ApprovalLineRow = {
    id: string;
    name: string;
    approverName: string;
    /**
     * Number of additional approvers in the chain (rendered as a small chip
     * next to the approver name). `undefined` collapses the badge entirely
     * — used for single-approver rows.
     */
    approverCount?: number;
    /** ISO-style date string ("YYYY-MM-DD"). Pre-formatted by the backend. */
    createDate: string;
};
