"use client";

import { useEffect, useRef, useState } from "react";

import FilterDropdown from "@/components/shared/FilterDropdown";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import SearchInput from "@/components/shared/SearchInput";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { FirmBankingServiceType } from "./types";

type ServiceTypeOption = "all" | FirmBankingServiceType;

const SERVICE_TYPE_OPTIONS: ServiceTypeOption[] = [
    "all",
    "firm_banking_transaction",
    "scraping_transfer",
    "vietnam_business_inquiry",
    "vietnam_gdt_inquiry",
];

type FirmBankingHistoryFiltersProps = {
    /** ISO `YYYY-MM-DD` start date. */
    startDate: string;
    /** ISO `YYYY-MM-DD` end date. */
    endDate: string;
    serviceType: ServiceTypeOption;
    keyword: string;
    onDateRangeChange: (range: { start: string; end: string }) => void;
    onServiceTypeChange: (value: ServiceTypeOption) => void;
    onKeywordChange: (value: string) => void;
};

/**
 * Filter row for the Firm Banking History panel — Figma 9198:11718.
 *
 * <p>Layout (md+): start chip → arrow → end chip → calendar icon →
 * Service Type dropdown. Search input lives flush right.
 *
 * <p>Date interaction matches the Sales e-Invoices reference exactly,
 * via the shared {@link InteractiveDateRangePicker}:
 * <ul>
 *   <li>Click the <b>start</b> chip → compact single-date popover
 *       commits to {@code start}.</li>
 *   <li>Click the <b>end</b> chip → compact single-date popover
 *       commits to {@code end}.</li>
 *   <li>Click the <b>calendar icon</b> → full dual-month range popover
 *       with quick-pick chips + Cancel / Apply commits both ends.</li>
 * </ul>
 *
 * <p>Input click never opens the range popover; calendar-icon click
 * never opens the single-date popover.
 */
export default function FirmBankingHistoryFilters({
    startDate,
    endDate,
    serviceType,
    keyword,
    onDateRangeChange,
    onServiceTypeChange,
    onKeywordChange,
}: FirmBankingHistoryFiltersProps) {
    const { t } = useTranslation();

    return (
        <div className="flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
                <InteractiveDateRangePicker
                    startIso={startDate}
                    endIso={endDate}
                    onChange={onDateRangeChange}
                />
                <ServiceTypeDropdown
                    value={serviceType}
                    onChange={onServiceTypeChange}
                    t={t}
                />
            </div>
            <SearchInput
                value={keyword}
                onChange={onKeywordChange}
                placeholder={t("settings.firm_banking_history.search_placeholder")}
            />
        </div>
    );
}

function ServiceTypeDropdown({
    value,
    onChange,
    t,
}: {
    value: ServiceTypeOption;
    onChange: (value: ServiceTypeOption) => void;
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

    const label = t(`settings.firm_banking_history.service_type.${value}`);

    return (
        <div ref={ref} className="relative">
            <FilterDropdown
                value={label}
                onClick={() => setOpen((o) => !o)}
                ariaLabel={t("settings.firm_banking_history.service_type.aria")}
                className="w-[220px]"
            />
            {open && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 top-full z-20 mt-1 w-full min-w-full overflow-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                >
                    {SERVICE_TYPE_OPTIONS.map((opt) => (
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
                            {t(`settings.firm_banking_history.service_type.${opt}`)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export type { ServiceTypeOption };
