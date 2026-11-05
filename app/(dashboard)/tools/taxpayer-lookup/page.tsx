"use client";

import { Suspense } from "react";

import TaxpayerLookupPage from "@/components/tools/TaxpayerLookupPage";

export default function Page() {
    return (
        <Suspense>
            <TaxpayerLookupPage />
        </Suspense>
    );
}
