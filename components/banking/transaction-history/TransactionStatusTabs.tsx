"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type {
    TransactionStatusCounts,
    TransactionStatusFilter,
} from "./types";

type TransactionStatusTabsProps = {
    active: TransactionStatusFilter;
    counts: TransactionStatusCounts;
    onChange: (next: TransactionStatusFilter) => void;
    className?: string;
};

const TABS: TransactionStatusFilter[] = ["all", "confirmed", "unconfirmed"];

/**
 * Legacy WeCMS colours the status tabs by meaning, not by active state:
 * All stays default/dark, Confirmed is blue, Unconfirmed is red. The text
 * colour is therefore fixed per tab; the active tab is still distinguished
 * by the blue underline below.
 */
const TAB_TEXT_COLOR: Record<TransactionStatusFilter, string> = {
    all: "text-wb-dark",
    confirmed: "text-brand",
    unconfirmed: "text-wb-red-07",
};

/**
 * Status tabs for the Transaction History matching panel. Figma node
 * 989:22011 shows three inline tabs — All / Confirmed / Unconfirmed —
 * each with its count appended, sitting above the matching columns.
 * The active tab is indicated with the brand color and underline
 * (same visual language as the Approval Box tabs pattern).
 */
export default function TransactionStatusTabs({
    active,
    counts,
    onChange,
    className,
}: TransactionStatusTabsProps) {
    const { t } = useTranslation();
    return (
        <div
            role="tablist"
            className={cn("flex items-center gap-5", className)}
        >
            {TABS.map((key) => {
                const isActive = key === active;
                return (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(key)}
                        className={cn(
                            "flex cursor-pointer items-center gap-1 border-b-2 pb-1 text-wb-14-tight font-semibold whitespace-nowrap",
                            TAB_TEXT_COLOR[key],
                            isActive ? "border-brand" : "border-transparent",
                        )}
                    >
                        <span>{t(`txn_history.status.${key}`)}</span>
                        <span>{counts[key]}</span>
                    </button>
                );
            })}
        </div>
    );
}
