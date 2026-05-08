"use client";

import DateRangePicker from "@/components/shared/DateRangePicker";
import FilterDropdown from "@/components/shared/FilterDropdown";
import SearchInput from "@/components/shared/SearchInput";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { LinkTab } from "./types";

type CardTransactionsFilterBarProps = {
    startDate: string;
    endDate: string;
    activeTab: LinkTab;
    search: string;
    onTabChange: (tab: LinkTab) => void;
    onSearchChange: (value: string) => void;
    className?: string;
};

const LINK_TABS: { key: LinkTab; labelKey: string }[] = [
    { key: "all", labelKey: "payment.card.tab.all" },
    { key: "linked", labelKey: "payment.card.tab.linked" },
    { key: "unlinked", labelKey: "payment.card.tab.unlinked" },
];

/**
 * Card Transactions filter bar — Figma 45:18250 toolbar row.
 *
 * Left cluster: Request Approval button → date range → card company dropdown
 *               → card dropdown.
 * Right cluster: All | Linked | Unlinked inline tabs → search input.
 */
export default function CardTransactionsFilterBar({
    startDate,
    endDate,
    activeTab,
    search,
    onTabChange,
    onSearchChange,
    className,
}: CardTransactionsFilterBarProps) {
    const { t } = useTranslation();

    return (
        <div
            className={cn(
                "flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between",
                className,
            )}
        >
            {/* Left cluster */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Request Approval — outlined action button */}
                <button
                    type="button"
                    className="flex h-[var(--h-wb-filter-btn)] shrink-0 cursor-pointer items-center justify-center rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14-tight font-medium text-wb-ntrl-8 shadow-wb-btn hover:bg-neutral-50"
                >
                    {t("payment.card.request_approval")}
                </button>

                <DateRangePicker start={startDate} end={endDate} />

                <FilterDropdown
                    value={t("payment.card.all_companies")}
                    className="w-[var(--w-wb-ct-company-filter)]"
                />
                <FilterDropdown
                    value={t("payment.card.all_cards")}
                    className="w-[var(--w-wb-ct-card-filter)]"
                />
            </div>

            {/* Right cluster */}
            <div className="flex items-center gap-3">
                {/* All / Linked / Unlinked inline tabs */}
                <div className="flex items-center gap-0">
                    {LINK_TABS.map((tab, i) => (
                        <span key={tab.key} className="flex items-center">
                            {i > 0 && (
                                <span
                                    aria-hidden
                                    className="mx-2 h-4 w-px shrink-0 bg-wb-ntrl-4"
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => onTabChange(tab.key)}
                                className={cn(
                                    "cursor-pointer text-wb-14-tight font-medium",
                                    activeTab === tab.key
                                        ? tab.key === "unlinked"
                                            ? "text-[#c50712]"
                                            : "text-brand"
                                        : "text-wb-ntrl-8 hover:text-brand",
                                )}
                            >
                                {t(tab.labelKey)}
                            </button>
                        </span>
                    ))}
                </div>

                <SearchInput
                    value={search}
                    onChange={onSearchChange}
                    placeholder={t("payment.search_placeholder")}
                />
            </div>
        </div>
    );
}
