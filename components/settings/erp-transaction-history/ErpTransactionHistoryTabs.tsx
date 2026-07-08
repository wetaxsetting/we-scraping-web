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
    /** Hide the "Deleted" (`D`) tab for HAENGSUNG (product type `'H'`),
     *  matching legacy `comm_0219_001_view.jsp:118` (`if (!"H".equals(prdtTypes))`).
     *  Other product types are unaffected. */
    hideDeleted?: boolean;
};

/**
 * Tab strip — Figma 134:16546.
 *
 * Each tab pairs a label (`All`, `WeCMS → ERP`, `ERP → WeCMS`, `Deleted`)
 * with a count rendered to its right. Active tab gets the brand bottom
 * border AND its label/count flip to brand colour, matching Figma.
 *
 * <p>Tabs shown: All / WeCMS → ERP / ERP → WeCMS / Deleted. The
 * "Deleted" tab is hidden for HAENGSUNG (product type `'H'`) via the
 * {@code hideDeleted} prop — legacy parity with
 * {@code comm_0219_001_view.jsp:118} (`if (!"H".equals(prdtTypes))`),
 * restored 2026-07-08 (R4, PO decision). Every other product type keeps
 * all four tabs. (This reverts the earlier OQ-2 "product-agnostic tabs"
 * divergence for the Deleted tab only.)
 *
 * <p>The row scrolls horizontally on narrow viewports so labels never
 * truncate inside the modal.
 */
export default function ErpTransactionHistoryTabs({
    active,
    counts,
    onChange,
    className,
    hideDeleted = false,
}: ErpTransactionHistoryTabsProps) {
    const { t } = useTranslation();
    // HAENGSUNG ('H') hides the Deleted tab (legacy parity); every other
    // product type keeps all four tabs.
    const tabKeys = hideDeleted
        ? TAB_KEYS.filter((key) => key !== "D")
        : TAB_KEYS;
    return (
        <div
            role="tablist"
            className={cn(
                "flex h-9 items-center gap-5 overflow-x-auto border-b border-wb-border-sidebar",
                className,
            )}
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
