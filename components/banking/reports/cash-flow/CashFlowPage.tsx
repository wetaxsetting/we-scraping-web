"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import FilterDropdown from "@/components/shared/FilterDropdown";
import FilterRow from "@/components/shared/FilterRow";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import ReportLayout from "@/components/shared/ReportLayout";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { formatAmount } from "@/lib/currency";
import { cn } from "@/lib/utils";

import {
    MONTH_KEYS,
    monthIndicesForQuarter,
    type CashFlowMonthlyAmounts,
    type CashFlowReport,
    type CashFlowRow,
} from "./types";

const BASE_CURRENCIES = ["VND", "USD", "KRW"] as const;
type BaseCcy = (typeof BASE_CURRENCIES)[number];

const QUARTER_OPTIONS = [
    { value: null as number | null, label: "All Year" },
    { value: 1, label: "Q1" },
    { value: 2, label: "Q2" },
    { value: 3, label: "Q3" },
    { value: 4, label: "Q4" },
];

/** Years offered in the year dropdown — current year back 8 years (legacy parity). */
function buildYearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let i = 0; i < 9; i++) years.push(currentYear - i);
    return years;
}

export type CashFlowFilters = {
    year: number;
    quarter: number | null;
    baseCurrency: BaseCcy;
    usdRate: string;
    krwRate: string;
};

type CashFlowPageProps = {
    /** API-fetched report. Undefined until the user has clicked Search. */
    report?: CashFlowReport;
    /** Current filter draft (lifted to the client wrapper so re-fetches
     *  use the same values). */
    filters: CashFlowFilters;
    /** Filter setter — drives the parent's `useApiData` deps. */
    onFiltersChange: (next: CashFlowFilters) => void;
    /** True once the user has clicked Search at least once. Before this
     *  the page renders the §7b empty-state placeholder. */
    hasSearched: boolean;
    /** Search trigger — flips `hasSearched` in the wrapper. */
    onSearch: () => void;
    /** Excel download trigger — wired to the per-resource POST endpoint. */
    onExport: () => void;
    /** True while an API call is in flight. */
    loading?: boolean;
};

/**
 * Cash Flow report — refactor of legacy `cash_0001_001` (Figma
 * 9183:23697). Follows CLAUDE.md §7b: empty state until the user
 * clicks Search, then a single continuous-scroll matrix table inside
 * `<ReportLayout>`. No pagination.
 *
 * The matrix renders one row per backend `CashFlowRow`; row chrome
 * branches on `rowType`:
 *   - "Opening Balance" / "End Balance" — sticky-header highlight rows
 *   - "Level 1" — bold section header (no monthly amounts)
 *   - "Level 2" — semibold sub-header indented under L1
 *   - "Level 3" — plain detail row indented under L2
 *   - "Level 1 Subtotal" — progress-blue accent
 *   - "SALES PROFIT" / "NON SALES PROFIT" — green accent
 *
 * Quarter selection hides irrelevant monthly columns (legacy frontend
 * `Q1 = months 1..3`, etc.); column visibility is computed locally.
 */
export default function CashFlowPage({
    report,
    filters,
    onFiltersChange,
    hasSearched,
    onSearch,
    onExport,
    loading = false,
}: CashFlowPageProps) {
    const { t } = useTranslation();
    const yearOptions = useMemo(buildYearOptions, []);

    const visibleMonthIdx = useMemo(
        () => monthIndicesForQuarter(filters.quarter),
        [filters.quarter],
    );

    const baseCcy: BaseCcy = filters.baseCurrency;
    const showUsdRate = baseCcy !== "USD";
    const showKrwRate = baseCcy !== "KRW";

    return (
        <PageLayout>
            <PageHeader title={t("report.cash_flow.title")}>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onExport}
                    className="h-9 gap-2 px-4 text-wb-14"
                >
                    <img
                        src="/assets/common/ico-excel.svg"
                        alt=""
                        aria-hidden
                        className="size-5"
                    />
                    {t("report.download_excel")}
                </Button>
            </PageHeader>

            <FilterRow
                right={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onSearch}
                        disabled={loading}
                        className="h-[var(--h-wb-filter-btn)] gap-2 px-4 text-wb-14"
                    >
                        <Search className="size-4" />
                        {t("common.search")}
                    </Button>
                }
            >
                <FilterDropdown
                    value={String(filters.year)}
                    onClick={() => {
                        const idx = yearOptions.indexOf(filters.year);
                        const next = yearOptions[(idx + 1) % yearOptions.length];
                        onFiltersChange({ ...filters, year: next });
                    }}
                    className="w-[100px]"
                    ariaLabel={t("report.cash_flow.field.year")}
                />
                <FilterDropdown
                    value={
                        filters.quarter == null
                            ? t("report.cash_flow.period.all_year")
                            : t("report.cash_flow.period.quarter", { n: filters.quarter })
                    }
                    onClick={() => {
                        const idx = QUARTER_OPTIONS.findIndex((q) => q.value === filters.quarter);
                        const next = QUARTER_OPTIONS[(idx + 1) % QUARTER_OPTIONS.length];
                        onFiltersChange({ ...filters, quarter: next.value });
                    }}
                    className="w-[120px]"
                    ariaLabel={t("report.cash_flow.field.quarter")}
                />
                <FilterDropdown
                    value={baseCcy}
                    onClick={() => {
                        const idx = BASE_CURRENCIES.indexOf(baseCcy);
                        const next = BASE_CURRENCIES[(idx + 1) % BASE_CURRENCIES.length];
                        onFiltersChange({ ...filters, baseCurrency: next });
                    }}
                    className="w-[90px]"
                    ariaLabel={t("report.cash_flow.field.base_currency")}
                />
                {showUsdRate && (
                    <RateInput
                        label="USD"
                        value={filters.usdRate}
                        onChange={(v) => onFiltersChange({ ...filters, usdRate: v })}
                    />
                )}
                {showKrwRate && (
                    <RateInput
                        label="KRW"
                        value={filters.krwRate}
                        onChange={(v) => onFiltersChange({ ...filters, krwRate: v })}
                    />
                )}
            </FilterRow>

            {hasSearched && report ? (
                <ReportLayout>
                    <div className="custom-scrollbar-x w-full overflow-x-auto">
                        <CashFlowMatrix
                            report={report}
                            visibleMonthIdx={visibleMonthIdx}
                        />
                    </div>
                </ReportLayout>
            ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center pb-3">
                    <p className="text-wb-14 font-medium text-wb-muted">
                        {t("report.cash_flow.empty_message")}
                    </p>
                </div>
            )}
        </PageLayout>
    );
}

function RateInput({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="flex h-[var(--h-wb-filter-btn)] items-center gap-2 rounded-md border border-wb-ntrl-4 bg-white px-2 shadow-wb-btn">
            <span className="text-wb-13 font-medium text-wb-muted">{label}</span>
            <Input
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="0"
                className="h-6 w-[90px] border-0 bg-transparent p-0 text-right text-wb-13 font-medium text-wb-ink shadow-none focus-visible:ring-0"
            />
        </div>
    );
}

/* ------------------------------ Matrix ------------------------------ */

function CashFlowMatrix({
    report,
    visibleMonthIdx,
}: {
    report: CashFlowReport;
    visibleMonthIdx: number[];
}) {
    const { t } = useTranslation();
    const dispCcy = report.baseCurrency;

    // Column widths: code / name / item-code / item-name + N monthly + total.
    const monthColWidth = "110px";
    const tableMinWidth = 480 + visibleMonthIdx.length * 110 + 140;

    return (
        <table
            className="w-full table-fixed border-collapse"
            style={{ minWidth: `${tableMinWidth}px` }}
        >
            <colgroup>
                <col className="w-[100px]" />
                <col className="w-[220px]" />
                <col className="w-[100px]" />
                <col className="w-[180px]" />
                {visibleMonthIdx.map((idx) => (
                    <col key={`col-${idx}`} style={{ width: monthColWidth }} />
                ))}
                <col className="w-[140px]" />
            </colgroup>

            <thead className="sticky top-0 z-10">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar">
                    <TableHeaderCell>{t("report.cash_flow.col.code")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.cash_flow.col.display_name")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.cash_flow.col.item_code")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.cash_flow.col.item_name")}</TableHeaderCell>
                    {visibleMonthIdx.map((idx) => (
                        <th
                            key={`mh-${idx}`}
                            className="bg-wb-bg-sidebar px-2.5 py-3 text-right align-middle"
                        >
                            <span className="text-wb-13 font-semibold text-wb-dark">
                                {t(`report.cash_flow.month.${MONTH_KEYS[idx]}`)}
                            </span>
                        </th>
                    ))}
                    <th className="bg-wb-bg-sidebar px-2.5 py-3 text-right align-middle">
                        <span className="text-wb-13 font-semibold text-wb-dark">
                            {t("report.cash_flow.col.total")}
                        </span>
                    </th>
                </tr>
            </thead>

            <tbody>
                {report.rows.map((row, i) => (
                    <CashFlowRowView
                        key={`${row.displayOrder}-${i}`}
                        row={row}
                        visibleMonthIdx={visibleMonthIdx}
                        dispCcy={dispCcy}
                    />
                ))}
            </tbody>
        </table>
    );
}

function CashFlowRowView({
    row,
    visibleMonthIdx,
    dispCcy,
}: {
    row: CashFlowRow;
    visibleMonthIdx: number[];
    dispCcy: string;
}) {
    const variant = classifyRowType(row.rowType);
    const indent = indentFor(variant);
    const cellCcy = row.displayCurrency || dispCcy;

    return (
        <tr
            className={cn(
                "h-[var(--h-wb-table-row)] border-b border-wb-table-border",
                variant === "header" && "bg-wb-bg-sidebar font-semibold",
                variant === "subtotal" &&
                    "bg-wb-status-progress-bg hover:bg-wb-status-progress-bg",
                variant === "openingBalance" &&
                    "bg-wb-status-progress-bg hover:bg-wb-status-progress-bg",
                variant === "endBalance" &&
                    "bg-wb-status-approved-text hover:bg-wb-status-approved-text",
                variant === "salesProfit" &&
                    "bg-wb-status-approved-bg hover:bg-wb-status-approved-bg",
                variant === "nonSalesProfit" &&
                    "bg-wb-status-approved-bg hover:bg-wb-status-approved-bg",
            )}
        >
            <td
                className={cn(
                    "px-2.5 py-2.5 align-middle text-wb-13",
                    variant === "endBalance" ? "text-white" : "text-wb-ink",
                    variant === "header" || variant === "subtotal"
                        ? "font-semibold"
                        : "font-medium",
                )}
            >
                <span style={{ paddingLeft: `${indent}px` }} className="block truncate">
                    {row.displayCd || ""}
                </span>
            </td>
            <td
                className={cn(
                    "px-2.5 py-2.5 align-middle text-wb-13",
                    variant === "endBalance" ? "text-white" : "text-wb-ink",
                    variant === "header" || variant === "subtotal"
                        ? "font-semibold"
                        : variant === "salesProfit" || variant === "nonSalesProfit"
                            ? "font-semibold"
                            : "font-medium",
                )}
            >
                <span className="block truncate">{row.displayNm}</span>
            </td>
            <td className="px-2.5 py-2.5 align-middle text-wb-13 font-normal text-wb-muted">
                <span className="block truncate">{row.itemCd || ""}</span>
            </td>
            <td
                className={cn(
                    "px-2.5 py-2.5 align-middle text-wb-13",
                    variant === "endBalance" ? "text-white" : "text-wb-ink",
                    "font-medium",
                )}
            >
                <span className="block truncate">{row.itemNm || ""}</span>
            </td>
            {visibleMonthIdx.map((idx) => {
                const key = MONTH_KEYS[idx];
                const value = row.monthly[key];
                return (
                    <td
                        key={`m-${idx}`}
                        className={cn(
                            "px-2.5 py-2.5 text-right align-middle text-wb-13",
                            variant === "endBalance" ? "text-white" : "text-wb-ink",
                            variant === "subtotal" ||
                            variant === "salesProfit" ||
                            variant === "nonSalesProfit" ||
                            variant === "openingBalance" ||
                            variant === "endBalance"
                                ? "font-semibold"
                                : "font-medium",
                        )}
                    >
                        {renderAmount(value, cellCcy)}
                    </td>
                );
            })}
            <td
                className={cn(
                    "px-2.5 py-2.5 text-right align-middle text-wb-13 font-semibold",
                    variant === "endBalance" ? "text-white" : "text-wb-ink",
                )}
            >
                {renderAmount(row.annualTotal, cellCcy)}
            </td>
        </tr>
    );
}

type RowVariant =
    | "header"
    | "subgroup"
    | "detail"
    | "subtotal"
    | "openingBalance"
    | "endBalance"
    | "salesProfit"
    | "nonSalesProfit";

function classifyRowType(rowType: string): RowVariant {
    switch (rowType) {
        case "Opening Balance": return "openingBalance";
        case "End Balance":
        case "Grand Total":
            return "endBalance";
        case "Level 1": return "header";
        case "Level 2": return "subgroup";
        case "Level 3": return "detail";
        case "Level 1 Subtotal": return "subtotal";
        case "SALES PROFIT": return "salesProfit";
        case "NON SALES PROFIT": return "nonSalesProfit";
        default: return "detail";
    }
}

function indentFor(variant: RowVariant): number {
    switch (variant) {
        case "header": return 0;
        case "subgroup": return 16;
        case "detail": return 32;
        default: return 0;
    }
}

function renderAmount(value: string, ccy: string): string {
    if (!value || value === "0") return "-";
    // Sign-preserved formatting via the shared helper. Includes the
    // currency symbol so spreadsheet and screen render identically.
    return formatAmount(value, ccy, true);
}

/** Default filter values for the first render — current year, all-year,
 *  VND base, sample rates. */
export function defaultCashFlowFilters(): CashFlowFilters {
    return {
        year: new Date().getFullYear(),
        quarter: null,
        baseCurrency: "VND",
        usdRate: "26000",
        krwRate: "19",
    };
}
