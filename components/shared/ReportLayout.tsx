"use client";

import { cn } from "@/lib/utils";

type ReportLayoutProps = {
    /**
     * When `true`, children are wrapped in a `flex flex-col gap-6` stack so
     * multiple `<ReportSection>` blocks share the same scroll container but
     * render as distinct sections (e.g. Daily Cash). When `false` (default),
     * children render directly — suitable for a single monolithic report
     * table (e.g. Daily Financial, Cash Flow).
     */
    sectioned?: boolean;
    children: React.ReactNode;
    className?: string;
};

/**
 * Banking report continuous-scroll body (CLAUDE.md §7b) — the canonical
 * layout for "as-of" snapshot reports (Daily Cash, Daily Financial, Cash
 * Flow). Owns the single scroll container every report page uses so no page
 * re-implements the responsive height + scroll chain.
 *
 * Height contract (responsive, viewport-driven — never hardcoded):
 *   AppShell `h-screen`
 *     → main `flex-1 min-h-0 flex-col`
 *       → PageLayout `flex-1 min-h-0 flex-col`
 *         → ReportLayout outer `flex-1 min-h-0 flex-col pb-3`
 *           → scroll viewport `flex-1 min-h-0 overflow-auto`
 *
 * `pb-3` lives on the OUTER wrapper (not inside the scroll viewport) so the
 * scrollbar reaches the bottom of the available space — matching §7a's
 * `DataTableShell` behaviour and keeping report and paginated pages
 * visually consistent at every viewport height (default desktop and laptop).
 *
 * Never renders pagination — §7b explicitly prohibits pagination on report
 * pages. For paginated list/search pages use `<DataTableShell>` instead.
 */
export default function ReportLayout({
    sectioned = false,
    children,
    className,
}: ReportLayoutProps) {
    return (
        <div className={cn("flex min-h-0 flex-1 flex-col pb-3", className)}>
            <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
                {sectioned ? (
                    <div className="flex flex-col gap-6">{children}</div>
                ) : (
                    children
                )}
            </div>
        </div>
    );
}
