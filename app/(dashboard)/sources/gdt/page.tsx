"use client";

import { Suspense } from "react";

import ConnectionsPage from "@/components/connections/ConnectionsPage";

export default function Page() {
    return (
        <Suspense>
            <ConnectionsPage />
        </Suspense>
    );
}
