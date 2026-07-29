import type { Metadata } from "next";

import TaxFilingPage from "@/components/addon/tax-filing/TaxFilingPage";

export const metadata: Metadata = {
    title: "Tax Filing",
};

export default function Page() {
    return <TaxFilingPage />;
}
