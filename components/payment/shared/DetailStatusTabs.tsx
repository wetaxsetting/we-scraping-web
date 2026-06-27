"use client";

import { cn } from "@/lib/utils";

export type DetailStatusTab<Key extends string> = {
    key: Key;
    label: string;
    count: number;
    /** Optional Tailwind colour class for the count number only (the label
     *  stays the default tab colour). Omit → muted `text-wb-ntrl-6`
     *  (current behaviour). Used by the Internal Transfer Result detail
     *  page to colour Success/Failed/In-Progress counts per legacy
     *  `pymn_0010_002`. */
    countClassName?: string;
};

type DetailStatusTabsProps<Key extends string> = {
    active: Key;
    onChange: (key: Key) => void;
    tabs: DetailStatusTab<Key>[];
    className?: string;
};

/**
 * Status tab strip used on Payment Result detail pages
 * (`All / Success / Failed / In Progress`). Same visual contract as
 * Approval Box's `<ApprovalTabs>` — brand-active bottom border, count
 * rendered in a muted weight beside the label, scrollable on narrow
 * viewports so labels never truncate.
 */
export default function DetailStatusTabs<Key extends string>({
    active,
    onChange,
    tabs,
    className,
}: DetailStatusTabsProps<Key>) {
    return (
        <div
            role="tablist"
            className={cn(
                "flex h-8 items-center gap-4 overflow-x-auto border-b border-wb-border-sidebar",
                className,
            )}
        >
            {tabs.map((tab) => {
                const isActive = tab.key === active;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(tab.key)}
                        className={cn(
                            "flex h-full cursor-pointer items-center gap-1 whitespace-nowrap text-wb-13 font-semibold",
                            isActive
                                ? "border-b-2 border-brand-active text-wb-dark"
                                : "text-wb-dark/80 hover:text-wb-dark",
                        )}
                    >
                        <span>{tab.label}</span>
                        <span
                            className={cn(
                                "font-semibold",
                                tab.countClassName ?? "text-wb-ntrl-6",
                            )}
                        >
                            {tab.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
