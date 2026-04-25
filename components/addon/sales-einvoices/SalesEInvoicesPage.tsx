"use client";

import EInvoicesPage from "./EInvoicesPage";
import { mockInvoiceCurrencyTotals, mockInvoiceRows } from "./mockData";

/**
 * Sales e-Invoices (outbound customer invoices) — Add-On Service module,
 * Figma node 9194:6696. Thin variant wrapper around the shared
 * {@link EInvoicesPage}; the shared component owns every layout decision
 * so Sales and Expenses cannot drift apart.
 */
export default function SalesEInvoicesPage() {
    return (
        <EInvoicesPage
            translationPrefix="sales_einvoices"
            rows={mockInvoiceRows}
            totals={mockInvoiceCurrencyTotals}
            dateRange={{ start: "05-Jan-2025", end: "30-Jan-2025" }}
            pagination={{ page: 2, pageCount: 3, pageSize: 5, total: "30" }}
        />
    );
}
