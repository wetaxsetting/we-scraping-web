"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ApprovalTabKey, TabCounts } from "./types";

const tabKeys: ApprovalTabKey[] = [
    "all",
    "draft",
    "pending",
    "in_progress",
    "approved",
    "rejected",
];

type ApprovalTabsProps = {
    active: ApprovalTabKey;
    counts: TabCounts;
    onChange: (key: ApprovalTabKey) => void;
    className?: string;
};

/**
 * Tab strip — active tab carries the brand-active underline per Figma; count
 * renders in a muted weight beside the label. The row scrolls horizontally
 * on narrow viewports so the tabs never truncate.
 */
export default function ApprovalTabs({
    active,
    counts,
    onChange,
    className,
}: ApprovalTabsProps) {
    const { t } = useTranslation();
    return (
        <div
            className={cn(
                "flex h-8 items-center gap-4 overflow-x-auto border-b border-wb-border-sidebar",
                className,
            )}
            role="tablist"
        >
            {tabKeys.map((key) => {
                const isActive = key === active;
                return (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(key)}
                        className={cn(
                            // Figma 1:8178 — all tab labels are full-color
                            // semibold #333; only the active tab gains the
                            // 2px brand bottom border.
                            "flex h-full cursor-pointer items-center gap-1 whitespace-nowrap text-wb-13 font-semibold text-wb-dark",
                            isActive && "border-b-2 border-brand-active",
                        )}
                    >
                        <span>{t(`approval.tab.${key}`)}</span>
                        <span className="font-semibold text-wb-ntrl-6">
                            {counts[key]}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
