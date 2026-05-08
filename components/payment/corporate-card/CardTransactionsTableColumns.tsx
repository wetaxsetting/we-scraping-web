/**
 * Shared colgroup for the Card Transactions table and its sibling footer.
 * Widths are CSS tokens defined in app/globals.css (--w-wb-ct-*).
 */
export default function CardTransactionsTableColumns() {
    return (
        <colgroup>
            <col className="w-[var(--w-wb-ct-checkbox)]" />
            <col className="w-[var(--w-wb-ct-datetime)]" />
            <col className="w-[var(--w-wb-ct-card-number)]" />
            <col className="w-[var(--w-wb-ct-merchant)]" />
            <col className="w-[var(--w-wb-ct-nickname)]" />
            <col className="w-[var(--w-wb-ct-cardholder)]" />
            <col className="w-[var(--w-wb-ct-amount)]" />
            <col className="w-[var(--w-wb-ct-reporting)]" />
            <col className="w-[var(--w-wb-ct-link-ref)]" />
            <col className="w-[var(--w-wb-ct-approval-ref)]" />
            <col className="w-[var(--w-wb-ct-note)]" />
        </colgroup>
    );
}

export const CT_COLUMN_COUNT = 11;
