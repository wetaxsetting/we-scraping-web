"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { PurposeTabKey } from "./types";

const tabKeys: PurposeTabKey[] = ["deposit", "withdrawal", "deleted"];

type PurposeTabsProps = {
    active: PurposeTabKey;
    onChange: (key: PurposeTabKey) => void;
    className?: string;
};

/**
 * Purpose sub-tab strip (Banking Deposit / Banking Withdrawal / Deleted).
 * Mirrors the Approval Box tab pattern — brand-active bottom border on
 * the selected tab, muted label otherwise — so both screens read as the
 * same system.
 */
export default function PurposeTabs({
    active,
    onChange,
    className,
}: PurposeTabsProps) {
    const { t } = useTranslation();
    return (
        <div
            role="tablist"
            className={cn(
                "flex h-9 shrink-0 items-center gap-5 border-b border-wb-border-sidebar",
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
                            "flex h-full cursor-pointer items-center whitespace-nowrap text-wb-13 font-semibold transition-colors",
                            isActive
                                ? "border-b-2 border-brand-active text-brand"
                                : "text-wb-dark hover:text-wb-ink",
                        )}
                    >
                        {t(`settings.purpose.tab.${key}`)}
                    </button>
                );
            })}
        </div>
    );
}
