"use client";

import EInvoicesClient from "./EInvoicesClient";

/**
 * Sales e-Invoices (outbound customer invoices) — Add-On Service module,
 * Figma node 9194:6696. Thin variant wrapper around the shared
 * {@link EInvoicesClient}; the shared component owns every layout decision
 * so Sales and Expenses cannot drift apart.
 */
export default function SalesEInvoicesPage() {
    return (
        <EInvoicesClient
            type="SALES"
            translationPrefix="sales_einvoices"
        />
    );
}
