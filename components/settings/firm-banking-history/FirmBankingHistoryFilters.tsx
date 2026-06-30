"use client";

import { useEffect, useRef, useState } from "react";

import FilterDropdown from "@/components/shared/FilterDropdown";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import SearchInput from "@/components/shared/SearchInput";
import { isProductType } from "@/lib/auth/client";
import { userStorage } from "@/lib/auth/storage";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { FirmBankingServiceType } from "./types";

type ServiceTypeOption = "all" | FirmBankingServiceType;

// Order mirrors legacy `comm_0221_001_view.jsp:148-181` exactly:
// Firm Banking Transaction (F) → Scraping (S) → Vietnam GDT Inquiry (G) →
// Vietnam Business Inquiry (B). The earlier B-before-G ordering was the
// GAP-1 parity defect; GDT must precede Business.
const SERVICE_TYPE_OPTIONS: ServiceTypeOption[] = [
    "all",
    "firm_banking_transaction",
    "scraping_transfer",
    "vietnam_gdt_inquiry",
    "vietnam_business_inquiry",
];

/**
 * Product-type `H` (HAENGSUNG) hides the Vietnam GDT (`G`) and Vietnam
 * Business (`B`) service-type options — GAP-3 parity with legacy
 * `comm_0221_001_view.jsp:161-182` (`!"H".equals(prdtTypes)` gate).
 * This is a UI filter only; neither the legacy API nor the refactor API
 * rejects `svc_type=G/B` server-side. Product types `F` / `M` see all
 * four. Resolved once on mount via the same `isProductType` helper the
 * rest of the app uses; product type is a display hint sourced from the
 * signed-JWT-backed `StoredUser`, never a security boundary.
 */
const H_HIDDEN_OPTIONS: ReadonlySet<ServiceTypeOption> = new Set([
    "vietnam_gdt_inquiry",
    "vietnam_business_inquiry",
]);

/**
 * Filter-dropdown label key for a service-type option.
 *
 * <p>Legacy renders the Scraping option's label from a DIFFERENT ML code
 * in the filter vs. the table: the dropdown uses `comm_0221_001_ml004`
 * ("Scraping" — see `comm_0221_001_view.jsp:156`), while the table cell
 * uses `comm_0221_001.ts:j007` ("Scraping Transfer" —
 * `comm_0221_001.ts:60,311`). The shared `service_type.*` key drives the
 * TABLE cell (`FirmBankingHistoryTable.tsx`), so the dropdown overrides
 * ONLY `scraping_transfer` with a filter-scoped "Scraping" key; every
 * other option keeps the shared key. This keeps the table text untouched
 * (legacy still shows "Scraping Transfer" there) while the filter label
 * matches the legacy dropdown.
 */
function serviceTypeLabelKey(opt: ServiceTypeOption): string {
    return opt === "scraping_transfer"
        ? "settings.firm_banking_history.service_type_filter.scraping_transfer"
        : `settings.firm_banking_history.service_type.${opt}`;
}

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

    // GAP-3: drop the GDT/Business options for product type H. Resolved
    // once on mount — the Settings modal mounts client-side after auth,
    // so `userStorage` is always populated by the time this renders.
    const [options] = useState<ServiceTypeOption[]>(() =>
        isProductType(userStorage.get(), "H")
            ? SERVICE_TYPE_OPTIONS.filter((o) => !H_HIDDEN_OPTIONS.has(o))
            : SERVICE_TYPE_OPTIONS,
    );

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

    const label = t(serviceTypeLabelKey(value));

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
                    {options.map((opt) => (
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
                            {t(serviceTypeLabelKey(opt))}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export type { ServiceTypeOption };
