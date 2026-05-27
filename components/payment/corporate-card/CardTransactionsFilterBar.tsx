"use client";

import { useEffect, useRef, useState } from "react";

import DateRangeFilter from "@/components/shared/DateRangeFilter";
import type { DateRangeFilterValue } from "@/components/shared/DateRangeFilter";
import FilterDropdown from "@/components/shared/FilterDropdown";
import SearchInput from "@/components/shared/SearchInput";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { LinkTab } from "./types";

export type BankFilterOption = {
    bank_cd: string;
    bank_nm: string;
};

export type CardFilterOption = {
    bank_cd: string;
    card_no: string;
    label:   string;
};

type CardTransactionsFilterBarProps = {
    /** Shared period dropdown value — owns mode (preset / manual),
     *  the active preset, and the manual start/end ISO dates. The
     *  parent translates this into a {@code yyyyMMdd} window before
     *  hitting the API (see {@code CardTransactionsPage}). */
    dateRange:           DateRangeFilterValue;
    onDateRangeChange:   (next: DateRangeFilterValue) => void;
    bankOptions:       readonly BankFilterOption[];
    selectedBankCd:    string | null;
    onBankCdChange:    (next: string | null) => void;
    cardOptions:       readonly CardFilterOption[];
    selectedCardNo:    string | null;
    onCardNoChange:    (next: string | null) => void;
    activeTab:         LinkTab;
    search:            string;
    onTabChange:       (tab: LinkTab) => void;
    onSearchChange:    (value: string) => void;
    /** Count of currently-selected rows — drives the Request
     *  Approval button's enabled state + badge. */
    selectedCount?:    number;
    /** Fired when the user clicks Request Approval. The parent
     *  snapshots the current selection and opens the shared
     *  {@link RequestApprovalDialog}. */
    onRequestApproval?: () => void;
    className?:        string;
};

const LINK_TABS: { key: LinkTab; labelKey: string }[] = [
    { key: "all", labelKey: "payment.card.tab.all" },
    { key: "linked", labelKey: "payment.card.tab.linked" },
    { key: "unlinked", labelKey: "payment.card.tab.unlinked" },
];

/**
 * Card Transactions filter bar — Figma 45:18250 toolbar row.
 *
 * <p>Left cluster: Request Approval button → start-date chip → arrow →
 * end-date chip → shared calendar icon → Card Company dropdown → All
 * Cards dropdown.
 * <p>Right cluster: All | Linked | Unlinked inline tabs → search input.
 *
 * <h2>Date range</h2>
 * <p>Both date chips are interactive {@link DateField}s — each opens
 * its own single-date calendar popup. The trailing shared
 * {@link CalendarIconButton} is decorative for now (the per-chip
 * triggers cover the picker need); kept so the filter row's footprint
 * matches the legacy comm_0218 toolbar. Wire shape is {@code yyyyMMdd}
 * end-to-end; conversion to/from {@code DateField}'s ISO
 * {@code YYYY-MM-DD} happens locally via the two tiny helpers below.
 *
 * <h2>Bank / Card dropdowns</h2>
 * <p>Click the trigger to open an inline single-select popover (same
 * pattern as Account Inquiry's `BankFilterPopover`). Selecting "All …"
 * clears the filter; selecting a row narrows the ledger. The Card
 * dropdown is automatically filtered to the rows whose `bank_cd`
 * matches the currently-selected bank — the parent resets the card
 * selection if it stops matching the chosen bank.
 */
export default function CardTransactionsFilterBar({
    dateRange,
    onDateRangeChange,
    bankOptions,
    selectedBankCd,
    onBankCdChange,
    cardOptions,
    selectedCardNo,
    onCardNoChange,
    activeTab,
    search,
    onTabChange,
    onSearchChange,
    selectedCount,
    onRequestApproval,
    className,
}: CardTransactionsFilterBarProps) {
    const { t } = useTranslation();

    /* ------------------------------------------------------------------
     *  Bank + Card dropdowns — inline popovers anchored under each
     *  trigger. Single-select semantics with an explicit "All …" row
     *  for clearing the filter (matches Account Inquiry precedent).
     * ---------------------------------------------------------------- */

    const [bankOpen,  setBankOpen]  = useState(false);
    const [cardOpen,  setCardOpen]  = useState(false);

    const bankLabel = (() => {
        if (!selectedBankCd) return t("payment.card.all_companies");
        const match = bankOptions.find((b) => b.bank_cd === selectedBankCd);
        return match?.bank_nm ?? selectedBankCd;
    })();

    const cardLabel = (() => {
        if (!selectedCardNo) return t("payment.card.all_cards");
        const match = cardOptions.find((c) => c.card_no === selectedCardNo);
        return match?.label ?? selectedCardNo;
    })();

    return (
        <div
            className={cn(
                "flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between",
                className,
            )}
        >
            {/* Left cluster */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Request Approval — batch action button. Disabled
                    when no rows are selected; otherwise opens the
                    approval-line picker popover anchored to itself.
                    Legacy `card_0001_001.ts:644-676`. */}
                <button
                    type="button"
                    onClick={() => onRequestApproval?.()}
                    disabled={!onRequestApproval || (selectedCount ?? 0) === 0}
                    className={cn(
                        "flex h-[var(--h-wb-filter-btn)] shrink-0 items-center justify-center rounded-md bg-white px-4 text-wb-14-tight font-medium shadow-wb-btn transition-colors",
                        onRequestApproval && (selectedCount ?? 0) > 0
                            ? "cursor-pointer text-wb-ink hover:bg-neutral-50"
                            : "cursor-not-allowed text-wb-ntrl-5",
                    )}
                >
                    {t("payment.card.request_approval")}
                </button>

                {/* Shared period dropdown — "Last 30 Days /
                    Last 90 Days / Last 180 Days / Enter Manually"
                    chip + calendar trigger. Same control the Settings
                    panels use (Firm Banking History, ERP Transaction
                    History) so the period filter reads identically
                    across the product. */}
                <DateRangeFilter
                    value={dateRange}
                    onChange={onDateRangeChange}
                />

                {/* All Card Companies dropdown */}
                <div className="relative">
                    <FilterDropdown
                        value={bankLabel}
                        onClick={() => setBankOpen((o) => !o)}
                        className="w-[var(--w-wb-ct-company-filter)]"
                    />
                    {bankOpen && (
                        <SingleSelectPopover
                            items={bankOptions.map((b) => ({
                                value: b.bank_cd, label: b.bank_nm,
                            }))}
                            selected={selectedBankCd}
                            allLabel={t("payment.card.all_companies")}
                            onSelect={(v) => {
                                onBankCdChange(v);
                                setBankOpen(false);
                            }}
                            onClose={() => setBankOpen(false)}
                        />
                    )}
                </div>

                {/* All Cards dropdown */}
                <div className="relative">
                    <FilterDropdown
                        value={cardLabel}
                        onClick={() => setCardOpen((o) => !o)}
                        className="w-[var(--w-wb-ct-card-filter)]"
                    />
                    {cardOpen && (
                        <SingleSelectPopover
                            items={cardOptions.map((c) => ({
                                value: c.card_no, label: c.label,
                            }))}
                            selected={selectedCardNo}
                            allLabel={t("payment.card.all_cards")}
                            onSelect={(v) => {
                                onCardNoChange(v);
                                setCardOpen(false);
                            }}
                            onClose={() => setCardOpen(false)}
                        />
                    )}
                </div>
            </div>

            {/* Right cluster */}
            <div className="flex items-center gap-3">
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

/* --------------------------------------------------------------------
 *  Single-select inline popover. Same pattern as the Account Inquiry
 *  `BankFilterPopover` — an "All …" row at the top + one row per
 *  option. Click-outside / Escape both close.
 * ------------------------------------------------------------------ */

type SingleSelectItem = { value: string; label: string };

function SingleSelectPopover({
    items,
    selected,
    allLabel,
    onSelect,
    onClose,
}: {
    items:    readonly SingleSelectItem[];
    selected: string | null;
    allLabel: string;
    onSelect: (value: string | null) => void;
    onClose:  () => void;
}) {
    const ref = useRef<HTMLUListElement>(null);
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [onClose]);

    return (
        <ul
            ref={ref}
            role="listbox"
            className="custom-scrollbar-y absolute left-0 top-full z-20 mt-1 max-h-64 w-full min-w-[180px] overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
        >
            <li
                role="option"
                aria-selected={selected === null}
                onClick={() => onSelect(null)}
                className={cn(
                    "cursor-pointer truncate whitespace-nowrap px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                    selected === null && "bg-wb-bg-active",
                )}
            >
                {allLabel}
            </li>
            {items.map((item) => (
                <li
                    key={item.value}
                    role="option"
                    aria-selected={selected === item.value}
                    onClick={() => onSelect(item.value)}
                    className={cn(
                        "cursor-pointer truncate whitespace-nowrap px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                        selected === item.value && "bg-wb-bg-active",
                    )}
                    title={item.label}
                >
                    {item.label}
                </li>
            ))}
        </ul>
    );
}

