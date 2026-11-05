import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Bordered white section card used on dashboard / settings-like pages. */
export function Card({ title, action, children, className, bodyClassName }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
    return (
        <section className={cn("rounded-lg bg-white shadow-wb-card", className)}>
            {(title || action) && (
                <div className="flex items-center justify-between gap-3 border-b border-wb-border-sidebar px-4 py-3">
                    <h3 className="text-wb-14 font-semibold text-wb-dark">{title}</h3>
                    {action}
                </div>
            )}
            <div className={cn("p-4", bodyClassName)}>{children}</div>
        </section>
    );
}
