"use client";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
    title: React.ReactNode;
    /** Optional muted line under the title (WeInvoice pages show the working MST / period here). */
    subtitle?: React.ReactNode;
    /** Right-side slot — action buttons, chips, dropdowns. Caller controls layout. */
    children?: React.ReactNode;
    className?: string;
};

/**
 * Shared page-level heading row. Every feature page (Account Inquiry, Approval
 * Box, Transaction History, …) renders its title and optional right-side actions
 * through this component so top-of-page spacing, font size, and weight stay
 * identical across the whole app without per-page drift.
 *
 * The caller owns the right-side slot layout (gap, wrapping, button order) — the
 * header itself only enforces the outer flex alignment and the responsive top
 * padding (16px mobile → 24px desktop).
 */
export default function PageHeader({ title, subtitle, children, className }: PageHeaderProps) {
    return (
        <div
            className={cn(
                "flex shrink-0 flex-wrap items-center justify-between gap-3 pt-4 md:pt-6",
                className,
            )}
        >
            <div className="flex min-w-0 flex-col">
                <h1 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                    {title}
                </h1>
                {subtitle && <p className="text-wb-12 text-wb-ntrl-6">{subtitle}</p>}
            </div>
            {children}
        </div>
    );
}
