/**
 * Shared column definition for the Sales e-Invoices table. Both the main
 * table (header + body) and the footer summary reuse this `<colgroup>` so
 * column widths are defined exactly once. Widths themselves live as CSS
 * tokens in `app/globals.css` (`--w-wb-si-*`) so the design system owns them.
 */
export default function EInvoiceTableColumns() {
    return (
        <colgroup>
            <col className="w-[var(--w-wb-si-datetime)]" />
            <col className="w-[var(--w-wb-si-invoice-no)]" />
            <col className="w-[var(--w-wb-si-buyer)]" />
            <col className="w-[var(--w-wb-si-currency)]" />
            <col className="w-[var(--w-wb-si-total)]" />
            <col className="w-[var(--w-wb-si-status)]" />
            <col className="w-[var(--w-wb-si-tax)]" />
            <col className="w-[var(--w-wb-si-pretax)]" />
        </colgroup>
    );
}

export const EINVOICE_COLUMN_COUNT = 8;
