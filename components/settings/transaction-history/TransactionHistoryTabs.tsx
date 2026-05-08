"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type {
    TransactionHistoryTabCounts,
    TransactionHistoryTabKey,
} from "./types";

const TAB_KEYS: TransactionHistoryTabKey[] = [
    "all",
    "wecms_to_erp",
    "erp_to_wecms",
    "deleted",
];

type TransactionHistoryTabsProps = {
    active: TransactionHistoryTabKey;
    counts: TransactionHistoryTabCounts;
    onChange: (key: TransactionHistoryTabKey) => void;
    className?: string;
};

/**
 * Tab strip — Figma 134:16546.
 *
 * Each tab pairs a label (`All`, `WeCMS → ERP`, `ERP → WeCMS`, `Deleted`)
 * with a count rendered to its right. Active tab gets the brand bottom
 * border AND its label/count flip to brand colour, matching Figma.
 *
 * The row scrolls horizontally on narrow viewports so labels never
 * truncate inside the modal.
 */
export default function TransactionHistoryTabs({
    active,
    counts,
    onChange,
    className,
}: TransactionHistoryTabsProps) {
    const { t } = useTranslation();
    return (
        <div
            role="tablist"
            className={cn(
                "flex h-9 items-center gap-5 overflow-x-auto border-b border-wb-border-sidebar",
                className,
            )}
        >
            {TAB_KEYS.map((key) => {
                const isActive = key === active;
                return (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(key)}
                        className={cn(
                            "flex h-full cursor-pointer items-center gap-1 whitespace-nowrap text-wb-13 font-semibold",
                            isActive
                                ? "border-b-2 border-brand-active text-brand"
                                : "text-wb-dark hover:text-wb-ink",
                        )}
                    >
                        <span>{t(`settings.transaction_history.tab.${key}`)}</span>
                        <span
                            className={cn(
                                "font-semibold",
                                isActive ? "text-brand" : "text-wb-ntrl-6",
                            )}
                        >
                            {counts[key]}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
