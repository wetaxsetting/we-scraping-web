/**
 * Shared approver-chain types for the common Approver popover. Used by the
 * Payment Approval Box and every Payment Scheduled batch list (Internal
 * Transfer, Vendor, Expense, Payroll, Overseas). Each page maps its own
 * row-shaped approver data into {@link ApproverChainEntry} so the popover
 * UI stays a single implementation.
 */

/** Legacy single-letter approver status code (`APPRVR_STTS`). */
export type ApproverStatusCode = "P" | "A" | "R" | "W" | "S";

/** Normalised approver row consumed by the shared popover. Pages adapt their
 *  own approver shapes (`ApprovalApprover`, `ScheduledBatchApprover`, …) into
 *  this. */
export type ApproverChainEntry = {
    /** 1-based sequence number; falls back to the array index when absent. */
    lineNo?: number;
    /** Stable key + avatar-colour seed. Prefer the login id; fall back to the
     *  name when the wire carries no id (legacy batch approver rows). */
    seed: string;
    /** Approver display name. */
    name: string;
    /** Status code → drives the label, colour, and icon. */
    status: ApproverStatusCode;
    /** Pre-formatted `dd-MM-yyyy HH:mm:ss`, or null when the approver has not
     *  acted (drives the status-description secondary line instead). */
    actedAt: string | null;
};

/** Narrow an arbitrary wire status string to a known code, defaulting unknown
 *  / empty values to Pending (mirrors the legacy fallback). */
export function normalizeApproverStatus(
    status: string | null | undefined,
): ApproverStatusCode {
    return status === "P" ||
        status === "A" ||
        status === "R" ||
        status === "W" ||
        status === "S"
        ? status
        : "P";
}
