"use client";

import EInvoicesClient from "@/components/addon/sales-einvoices/EInvoicesClient";

/**
 * Expenses e-Invoices (inbound supplier invoices) — sibling of Sales
 * e-Invoices. Thin variant wrapper around the shared {@link EInvoicesClient};
 * the shared component owns every layout decision so Sales and Expenses
 * cannot drift apart.
 */
export default function ExpensesEInvoicesPage() {
    return (
        <EInvoicesClient
            type="EXPENSE"
            translationPrefix="expenses_einvoices"
        />
    );
}
