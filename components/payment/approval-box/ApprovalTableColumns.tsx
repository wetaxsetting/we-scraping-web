/**
 * Shared column definition for the Approval Box table. Both the main table
 * (header + body) and the footer summary reuse this `<colgroup>` so column
 * widths are defined exactly once. The widths themselves live as CSS tokens
 * in `app/globals.css` (`--w-wb-ap-*`) so the design system owns them.
 */
export default function ApprovalTableColumns() {
    return (
        <colgroup>
            <col className="w-[var(--w-wb-ap-date)]" />
            <col className="w-[var(--w-wb-ap-type)]" />
            <col className="w-[var(--w-wb-ap-docno)]" />
            <col className="w-[var(--w-wb-ap-title)]" />
            <col className="w-[var(--w-wb-ap-filename)]" />
            <col className="w-[var(--w-wb-ap-currency)]" />
            <col className="w-[var(--w-wb-ap-amount)]" />
            <col className="w-[var(--w-wb-ap-status)]" />
            <col className="w-[var(--w-wb-ap-scheduled)]" />
            <col className="w-[var(--w-wb-ap-requestor)]" />
            <col className="w-[var(--w-wb-ap-approver)]" />
        </colgroup>
    );
}

export const APPROVAL_COLUMN_COUNT = 11;
