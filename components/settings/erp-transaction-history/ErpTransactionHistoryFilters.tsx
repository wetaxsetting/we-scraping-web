"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import DateRangeFilter, {
    type DateRangeFilterValue,
} from "@/components/shared/DateRangeFilter";
import FilterDropdown from "@/components/shared/FilterDropdown";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import SearchInput from "@/components/shared/SearchInput";
import { isProductType } from "@/lib/auth/client";
import { userStorage } from "@/lib/auth/storage";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import {
    DELETED_TAB_TYPE_SUBSET,
    HAENGSUNG_ONLY_TYPE_CODES,
    TRANSACTION_TYPE_CODES,
    type ErpTransactionHistoryTabKey,
    type ErpTransactionTypeCode,
} from "./types";

/** Dropdown option = `"all"` (all types) or one of the 2-digit codes. */
export type TransactionTypeOption = "all" | ErpTransactionTypeCode;

type ErpTransactionHistoryFiltersProps = {
    /** Controlled date-range state. Carries `mode` (preset|manual) + the
     *  active preset + ISO start/end. The panel owns translation to
     *  wire `YYYYMMDD` at the axios boundary. */
    dateRange: DateRangeFilterValue;
    onDateRangeChange: (value: DateRangeFilterValue) => void;
    transactionType: TransactionTypeOption;
    onTransactionTypeChange: (value: TransactionTypeOption) => void;
    keyword: string;
    onKeywordChange: (value: string) => void;
    /** Active tab — drives the Deleted-tab type-subset filter on the
     *  dropdown options (the only universal legacy filter preserved per
     *  OQ-2 — applies to every product type via legacy
     *  `comm_0219_001.ts:482-510`). */
    activeTab: ErpTransactionHistoryTabKey;
};

/**
 * Filter row for the ERP Transaction History panel — Figma 134:16546.
 *
 * <p>Date control is two-state:
 * <ul>
 *   <li><b>Preset mode (default)</b> — shared
 *       {@code <DateRangeFilter>} renders a "Last 30 Days / Last 90 Days /
 *       Last 180 Days / Enter Manually" dropdown + calendar-icon trigger.
 *       This matches the original panel UX (Figma 134:16546).</li>
 *   <li><b>Manual mode</b> — the shared
 *       {@code <InteractiveDateRangePicker>} renders the start/end chip
 *       pair with a real dual-month calendar popover for custom
 *       selection. Activated when the user picks "Enter Manually" from
 *       the dropdown or clicks the calendar trigger.</li>
 * </ul>
 *
 * <p>Transaction-type dropdown options are rendered in **legacy display
 * order** (not numeric code order) per {@link TRANSACTION_TYPE_CODES}.
 * On the All / W / E tabs the 16 base codes show for every tenant; the
 * HAENGSUNG-only Exchange Rate (`15`) is appended last only when the
 * tenant's product type is `H` (legacy `comm_0219_001_view.jsp:307-315`,
 * restored 2026-06-30 — reverts the earlier OQ-2 "show 15 to everyone"
 * divergence). The Deleted tab narrows to the scheduled-payment subset
 * ({@link DELETED_TAB_TYPE_SUBSET}) for all product types. When the
 * active selection becomes hidden by a tab switch the parent resets to
 * {@code "all"}.
 *
 * <p>The HAENGSUNG-only per-tab filtering of W/E tabs (legacy
 * `comm_0219_001.ts:513-543`) is still intentionally not mirrored — on
 * W/E every tenant continues to see the full base list. Only the
 * Exchange Rate product gate was restored.
 */
export default function ErpTransactionHistoryFilters({
    dateRange,
    onDateRangeChange,
    transactionType,
    onTransactionTypeChange,
    keyword,
    onKeywordChange,
    activeTab,
}: ErpTransactionHistoryFiltersProps) {
    const { t } = useTranslation();

    // HAENGSUNG (product type 'H') resolved once from the signed JWT
    // claim cached in StoredUser. Mirrors legacy
    // `loginUser.getPrdtType().getValue()` gate in
    // `comm_0219_001_view.jsp:307`. Stable for the panel's lifetime —
    // the session product type doesn't change without a re-login.
    const [isHaengsung] = useState(() =>
        isProductType(userStorage.get(), "H"),
    );

    const visibleCodes = useMemo<ErpTransactionTypeCode[]>(() => {
        // Deleted tab narrows to the universal scheduled-payment subset
        // (no Exchange Rate — code 15 is never in that subset).
        if (activeTab === "D") return DELETED_TAB_TYPE_SUBSET;
        // All / W / E tabs render the full legacy-ordered list, with
        // the HAENGSUNG-only Exchange Rate (15) appended last and only
        // for product type 'H' (legacy `comm_0219_001_view.jsp:307-315`).
        return isHaengsung
            ? [...TRANSACTION_TYPE_CODES, ...HAENGSUNG_ONLY_TYPE_CODES]
            : TRANSACTION_TYPE_CODES;
    }, [activeTab, isHaengsung]);

    return (
        <div className="flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
                {dateRange.mode === "manual" ? (
                    /* Manual mode — full interactive picker. Stays in
                     * manual mode for the panel's lifetime (closing the
                     * Settings modal unmounts state and re-opens reset
                     * to preset mode via the parent's `initial`). */
                    <InteractiveDateRangePicker
                        startIso={dateRange.start}
                        endIso={dateRange.end}
                        onChange={(range) =>
                            onDateRangeChange({
                                ...dateRange,
                                mode: "manual",
                                start: range.start,
                                end: range.end,
                            })
                        }
                    />
                ) : (
                    /* Preset mode (default) — dropdown UX. Picking
                     * "Enter Manually" or clicking the trailing calendar
                     * trigger flips `mode` to "manual" via onChange. */
                    <DateRangeFilter
                        value={dateRange}
                        onChange={onDateRangeChange}
                    />
                )}
                <TransactionTypeDropdown
                    value={transactionType}
                    options={visibleCodes}
                    onChange={onTransactionTypeChange}
                    t={t}
                />
            </div>
            <SearchInput
                value={keyword}
                onChange={onKeywordChange}
                placeholder={t("settings.erp_transaction_history.search_placeholder")}
            />
        </div>
    );
}

function TransactionTypeDropdown({
    value,
    options,
    onChange,
    t,
}: {
    value: TransactionTypeOption;
    options: ErpTransactionTypeCode[];
    onChange: (value: TransactionTypeOption) => void;
    t: (key: string, vars?: Record<string, string>) => string;
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

    const label =
        value === "all"
            ? t("settings.erp_transaction_history.transaction_type.all")
            : t(`settings.erp_transaction_history.type.${value}`);

    return (
        <div ref={ref} className="relative">
            <FilterDropdown
                value={label}
                onClick={() => setOpen((o) => !o)}
                ariaLabel={t("settings.erp_transaction_history.transaction_type.aria")}
                className="w-[260px]"
            />
            {open && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 top-full z-20 mt-1 max-h-[320px] min-w-full overflow-auto rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                >
                    <Option
                        active={value === "all"}
                        label={t("settings.erp_transaction_history.transaction_type.all")}
                        onSelect={() => {
                            onChange("all");
                            setOpen(false);
                        }}
                    />
                    {options.map((code) => (
                        <Option
                            key={code}
                            active={value === code}
                            label={t(`settings.erp_transaction_history.type.${code}`)}
                            onSelect={() => {
                                onChange(code);
                                setOpen(false);
                            }}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

function Option({
    active,
    label,
    onSelect,
}: {
    active: boolean;
    label: string;
    onSelect: () => void;
}) {
    return (
        <li
            role="option"
            aria-selected={active}
            onClick={onSelect}
            className={cn(
                "cursor-pointer whitespace-nowrap px-3 py-1.5 text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-active",
                active && "bg-wb-bg-active",
            )}
        >
            {label}
        </li>
    );
}
