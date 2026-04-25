"use client";

import { cn } from "@/lib/utils";

type PageLayoutProps = {
    children: React.ReactNode;
    className?: string;
};

/**
 * Shared page outer layout used by every menu-level screen (Banking, Payment,
 * Add-on). Enforces:
 *   - full-height flex column so main inherits viewport height from AppShell
 *   - standard horizontal gutters (16px mobile → 24px desktop)
 *   - vertical spacing between header / filter / table / pagination (gap-5)
 *
 * New pages should compose inside this wrapper — never duplicate the outer
 * `flex min-h-0 flex-1 flex-col … px-4 md:px-6` chain.
 */
export default function PageLayout({ children, className }: PageLayoutProps) {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div
                className={cn(
                    "flex min-h-0 flex-1 flex-col gap-5 px-4 md:px-6",
                    className,
                )}
            >
                {children}
            </div>
        </div>
    );
}
