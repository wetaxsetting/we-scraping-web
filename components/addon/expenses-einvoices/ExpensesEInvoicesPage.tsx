"use client";

import EInvoicesPage from "@/components/addon/sales-einvoices/EInvoicesPage";

import {
    mockExpenseInvoiceRows,
    mockExpenseInvoiceTotals,
} from "./mockData";

/**
 * Expenses e-Invoices (inbound supplier invoices) — sibling of Sales
 * e-Invoices. Thin variant wrapper around the shared {@link EInvoicesPage};
 * the shared component owns every layout decision so Sales and Expenses
 * cannot drift apart.
 */
export default function ExpensesEInvoicesPage() {
    return (
        <EInvoicesPage
            translationPrefix="expenses_einvoices"
            rows={mockExpenseInvoiceRows}
            totals={mockExpenseInvoiceTotals}
            dateRange={{ start: "01-Dec-2024", end: "31-Dec-2024" }}
            pagination={{ page: 1, pageCount: 2, pageSize: 10, total: "12" }}
        />
    );
}
