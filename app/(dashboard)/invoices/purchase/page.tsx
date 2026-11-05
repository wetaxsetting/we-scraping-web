"use client";

import { Suspense } from "react";

import InvoiceListPage from "@/components/invoices/InvoiceListPage";

export default function Page() {
    return (
        <Suspense>
            <InvoiceListPage key="purchase" direction="purchase" />
        </Suspense>
    );
}
