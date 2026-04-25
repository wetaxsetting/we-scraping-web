"use client";

import { cn } from "@/lib/utils";

type ReportSectionProps = {
    /** Bulleted title shown above the table (e.g. "Cash", "Current Accounts"). */
    title: string;
    children: React.ReactNode;
    className?: string;
};

/**
 * Reusable section wrapper used by every Banking report page (Daily Cash,
 * Daily Financial, Cash Flow). Renders the bullet-dot + section title used
 * in the Figma frames, then the caller-supplied content below.
 */
export default function ReportSection({
    title,
    children,
    className,
}: ReportSectionProps) {
    return (
        <div className={cn("flex flex-col gap-2.5", className)}>
            <div className="flex items-center gap-1.5">
                <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full bg-brand"
                />
                <p className="text-wb-13 font-medium text-black">{title}</p>
            </div>
            {children}
        </div>
    );
}
