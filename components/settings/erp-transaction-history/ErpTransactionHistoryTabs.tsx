"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type {
    ErpTransactionHistoryTabCounts,
    ErpTransactionHistoryTabKey,
} from "./types";

const TAB_KEYS: ErpTransactionHistoryTabKey[] = ["all", "W", "E", "D"];

/** Tab → i18n key suffix. The wire codes (`W`/`E`/`D`) are uppercase
 *  single characters; the locale-file convention is snake_case full
 *  words, so we map them once here rather than scattering the
 *  conversion across components. */
const TAB_LABEL_KEY: Record<ErpTransactionHistoryTabKey, string> = {
    all:  "settings.erp_transaction_history.tab.all",
    W:    "settings.erp_transaction_history.tab.wecms_to_erp",
    E:    "settings.erp_transaction_history.tab.erp_to_wecms",
    D:    "settings.erp_transaction_history.tab.deleted",
};

type ErpTransactionHistoryTabsProps = {
    active: ErpTransactionHistoryTabKey;
    counts: ErpTransactionHistoryTabCounts;
    onChange: (key: ErpTransactionHistoryTabKey) => void;
    className?: string;
};

/**
 * Tab strip — Figma 134:16546.
 *
 * Each tab pairs a label (`All`, `WeCMS → ERP`, `ERP → WeCMS`, `Deleted`)
 * with a count rendered to its right. Active tab gets the brand bottom
 * border AND its label/count flip to brand colour, matching Figma.
 *
 * <p>All four tabs are always visible — refactor is product-agnostic
 * per OQ-2 (resolved 2026-05-11). The legacy HAENGSUNG hide-Deleted
 * branch is intentionally not mirrored.
 *
 * <p>The row scrolls horizontally on narrow viewports so labels never
 * truncate inside the modal.
 */
export default function ErpTransactionHistoryTabs({
    active,
    counts,
    onChange,
    className,
}: ErpTransactionHistoryTabsProps) {
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
                        <span>{t(TAB_LABEL_KEY[key])}</span>
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
