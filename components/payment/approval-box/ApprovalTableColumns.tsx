/**
 * Shared column definition for the Approval Box table. Both the main table
 * (header + body) and the footer summary reuse this `<colgroup>` so column
 * widths are defined exactly once. The widths themselves live as CSS tokens
 * in `app/globals.css` (`--w-wb-ap-*`) so the design system owns them.
 *
 * 10-column set (no leading checkbox — bulk selection removed per
 * 2026-05-17 design decision). No trailing Action column either —
 * `resl_0001_001_view_osmc.jsp` surfaces Approve / Reject via the
 * Approval Details dialog only.
 */
export default function ApprovalTableColumns() {
    return (
        <colgroup>
            <col className="w-[var(--w-wb-ap-date)]" />
            <col className="w-[var(--w-wb-ap-type)]" />
            <col className="w-[var(--w-wb-ap-docno)]" />
            <col className="w-[var(--w-wb-ap-title)]" />
            <col className="w-[var(--w-wb-ap-currency)]" />
            <col className="w-[var(--w-wb-ap-amount)]" />
            <col className="w-[var(--w-wb-ap-status)]" />
            <col className="w-[var(--w-wb-ap-scheduled)]" />
            <col className="w-[var(--w-wb-ap-requestor)]" />
            <col className="w-[var(--w-wb-ap-approver)]" />
        </colgroup>
    );
}

export const APPROVAL_COLUMN_COUNT = 10;
