import type { ReactNode } from "react";

import AppShell from "@/components/layout/AppShell";

/** Authenticated WeInvoice chrome. Route gating happens at the edge in `proxy.ts`. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
    return <AppShell>{children}</AppShell>;
}
