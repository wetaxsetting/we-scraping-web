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
     *  acted (drives the status-description secondary line instead). Legacy
     *  fallback — prefer {@link actedAtRaw} so the timestamp formats locale +
     *  timezone aware. */
    actedAt: string | null;
    /**
     * Raw legacy 14-char UTC wire timestamp (APPR_DTM / MOD_DTM — stored
     * `OffsetDateTime.now(ZoneOffset.UTC)`). When set, the shared chip
     * renderer formats it locale-aware AND converts UTC → Asia/Ho_Chi_Minh,
     * so the hover-chip acted-at matches the Approval Details popup exactly.
     * Falls back to {@link actedAt} when absent.
     */
    actedAtRaw?: string | null;
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
