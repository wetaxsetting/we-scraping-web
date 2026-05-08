"use client";

import { useEffect, useRef, useState } from "react";

import DateRangeFilter, {
    type DateRangeFilterValue,
} from "@/components/shared/DateRangeFilter";
import FilterDropdown from "@/components/shared/FilterDropdown";
import SearchInput from "@/components/shared/SearchInput";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { TransactionTypeKey } from "./types";

export type TransactionTypeOption = "all" | TransactionTypeKey;

const TRANSACTION_TYPE_OPTIONS: TransactionTypeOption[] = [
    "all",
    "internal_scheduled_transfer",
    "vendor_scheduled_payment",
    "expense_scheduled_payment",
    "payroll_scheduled_payment",
    "overseas_scheduled_payment",
];

type TransactionHistoryFiltersProps = {
    dateRange: DateRangeFilterValue;
    onDateRangeChange: (value: DateRangeFilterValue) => void;
    transactionType: TransactionTypeOption;
    onTransactionTypeChange: (value: TransactionTypeOption) => void;
    keyword: string;
    onKeywordChange: (value: string) => void;
};

/**
 * Filter row for the Transaction History panel — Figma 134:16546.
 *
 * Date control routes through the shared <DateRangeFilter> so the
 * preset → manual swap looks identical to every other filter row that
 * adopts it (Firm Banking History next).
 *
 * The transaction-type dropdown and search input are unchanged across
 * modes — only the date control toggles.
 */
export default function TransactionHistoryFilters({
    dateRange,
    onDateRangeChange,
    transactionType,
    onTransactionTypeChange,
    keyword,
    onKeywordChange,
}: TransactionHistoryFiltersProps) {
    const { t } = useTranslation();

    return (
        <div className="flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
                <DateRangeFilter value={dateRange} onChange={onDateRangeChange} />
                <TransactionTypeDropdown
                    value={transactionType}
                    onChange={onTransactionTypeChange}
                    t={t}
                />
            </div>
            <SearchInput
                value={keyword}
                onChange={onKeywordChange}
                placeholder={t("settings.transaction_history.search_placeholder")}
            />
        </div>
    );
}

function TransactionTypeDropdown({
    value,
    onChange,
    t,
}: {
    value: TransactionTypeOption;
    onChange: (value: TransactionTypeOption) => void;
    t: (key: string) => string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const label = t(`settings.transaction_history.transaction_type.${value}`);
    return (
        <div ref={ref} className="relative">
            <FilterDropdown
                value={label}
                onClick={() => setOpen((o) => !o)}
                ariaLabel={t("settings.transaction_history.transaction_type.aria")}
                className="w-[260px]"
            />
            {open && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 top-full z-20 mt-1 min-w-full overflow-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                >
                    {TRANSACTION_TYPE_OPTIONS.map((opt) => (
                        <li
                            key={opt}
                            role="option"
                            aria-selected={opt === value}
                            onClick={() => {
                                onChange(opt);
                                setOpen(false);
                            }}
                            className={cn(
                                "cursor-pointer whitespace-nowrap px-3 py-1.5 text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-active",
                                opt === value && "bg-wb-bg-active",
                            )}
                        >
                            {t(`settings.transaction_history.transaction_type.${opt}`)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
