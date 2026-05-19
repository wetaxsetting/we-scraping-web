"use client";

import { useMemo } from "react";
import { Calendar as CalendarIcon, Menu as MenuIcon } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { formatAmount } from "@/lib/currency";
import { cn } from "@/lib/utils";

import BankFilterPopover, {
    type BankFilterOption,
    type BankFilterValue,
} from "./BankFilterPopover";
import FilterSelect from "./FilterSelect";
import {
    MONTH_KEYS,
    monthIndicesForQuarter,
    type CashFlowReport,
    type CashFlowRow,
} from "./types";

const BASE_CURRENCIES = ["VND", "USD", "KRW"] as const;
type BaseCcy = (typeof BASE_CURRENCIES)[number];

/**
 * Build the period dropdown options. Labels mirror the legacy
 * `cash_0001_001` strings — "This Year" + "Quarter 1..4". Legacy default
 * is "This Year" which renders the full 12-month matrix; switching to
 * Quarter 1..4 hides months outside the quarter on the frontend AND
 * filters source rows server-side (see backend §3.11). Built at render
 * time because `t({ n })` interpolation requires the `n` arg.
 */
function buildPeriodOptions(t: (key: string, vars?: Record<string, string | number>) => string) {
    return [
        { value: null as number | null, label: t("report.cash_flow.period.this_year") },
        { value: 1, label: t("report.cash_flow.period.quarter_n", { n: 1 }) },
        { value: 2, label: t("report.cash_flow.period.quarter_n", { n: 2 }) },
        { value: 3, label: t("report.cash_flow.period.quarter_n", { n: 3 }) },
        { value: 4, label: t("report.cash_flow.period.quarter_n", { n: 4 }) },
    ];
}

/** Country flag asset for the currency picker chip. Mirrors legacy
 *  `cash_0001_001_view.jsp` flag icons. */
const CURRENCY_FLAG: Record<BaseCcy, string> = {
    VND: "/assets/flag/Vietnam.svg",
    USD: "/assets/flag/United-States.svg",
    KRW: "/assets/flag/South-Korea.svg",
};

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
    bankFilters: BankFilterValue[];
};

type CashFlowPageProps = {
    /** API-fetched report. */
    report?: CashFlowReport;
    /** Current filter draft. */
    filters: CashFlowFilters;
    /** Filter setter. */
    onFiltersChange: (next: CashFlowFilters) => void;
    /** Search trigger — refetches with current filters. */
    onSearch: () => void;
    /** Excel download trigger. */
    onExport: () => void;
    /** True while an API call is in flight. */
    loading?: boolean;
    /** Available bank-account options for the filter popover. */
    bankOptions: BankFilterOption[];
    /** Loading flag for the bank-account list. */
    bankOptionsLoading?: boolean;
};

/**
 * Cash Flow report — refactor of legacy `cash_0001_001`. Auto-loads on
 * mount (no empty placeholder) and renders the three-column grouped
 * matrix that mirrors the legacy layout:
 *
 *   Outer category | Mid category | Item code | Item name | Jan..Dec | Total
 *   (L1 rowspan)   | (L2 rowspan) | (L3 cd)   | (L3 nm)
 *
 * The S.TOTAL subtotal row spans the full width as a tinted band; the
 * End Balance row is a sticky green footer band.
 *
 * Row chrome branches on `rowType`:
 *   - "Opening Balance" / "End Balance" — full-width highlight rows
 *   - "Level 1" — outer-category cell with rowspan (NOT a row of its own)
 *   - "Level 2" — mid-category cell with rowspan (NOT a row of its own)
 *   - "Level 3" — detail row
 *   - "Level 1 Subtotal" — full-width subtotal band
 *   - "Sales Profit" / "SALES PROFIT" — green profit-line accent
 */
export default function CashFlowPage({
    report,
    filters,
    onFiltersChange,
    onSearch,
    onExport,
    loading = false,
    bankOptions,
    bankOptionsLoading = false,
}: CashFlowPageProps) {
    const { t } = useTranslation();
    const yearOptions = useMemo(buildYearOptions, []);

    const visibleMonthIdx = useMemo(
        () => monthIndicesForQuarter(filters.quarter),
        [filters.quarter],
    );

    const baseCcy: BaseCcy = filters.baseCurrency;

    return (
        <PageLayout>
            <PageHeader title={t("report.cash_flow.title")}>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onExport}
                        disabled={!report}
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
                </div>
            </PageHeader>

            {/* Legacy filter row — compact toolbar wrapped in a light
                outer container card that mirrors `cash_0001_001`.

                Outer card: rounded border + grey background that hugs
                the chips with comfortable padding. Inner row: single
                horizontal flex line, items size to content with a
                uniform 10px gap between them. Each control sits at the
                standard 32px filter-button height
                (`--h-wb-filter-btn`). */}
            <div className="rounded-md border border-wb-ntrl-4 bg-wb-bg-card px-4 py-2.5 shadow-wb-btn">
            <div className="flex shrink-0 flex-wrap items-center gap-[10px]">
                {/* Exchange Rate label + input — borderless, sits flat
                    on the outer card. Only the input itself carries a
                    subtle border so the user sees the editable field;
                    the "Exchange Rate" label is plain text. */}
                <div className="flex h-[var(--h-wb-filter-btn)] items-center gap-3 px-1">
                    <span className="text-wb-14 font-semibold text-wb-dark">
                        {t("report.cash_flow.field.exchange_rate")}
                    </span>
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={formatExchangeRateForDisplay(combinedRate(filters))}
                        onChange={(e) => onFiltersChange(
                            applyCombinedRate(filters, parseExchangeRateInput(e.target.value)),
                        )}
                        className={cn(
                            "h-7 w-[200px] rounded-md border border-wb-ntrl-4",
                            "bg-white px-3 text-right",
                            "text-wb-13 font-medium text-wb-ink shadow-none",
                            "focus-visible:ring-0",
                        )}
                    />
                </div>

                {/* Currency picker — bordered chip, flag + code + caret */}
                <FilterSelect<BaseCcy>
                    value={baseCcy}
                    options={BASE_CURRENCIES.map((c) => ({
                        value: c,
                        label: c,
                        icon: (
                            <img
                                src={CURRENCY_FLAG[c]}
                                alt=""
                                aria-hidden
                                className="size-4"
                            />
                        ),
                    }))}
                    onChange={(next) => onFiltersChange({ ...filters, baseCurrency: next })}
                    ariaLabel={t("report.cash_flow.field.base_currency")}
                    triggerClassName="min-w-[88px]"
                    triggerLabel={baseCcy}
                />

                {/* Year picker — calendar icon */}
                <FilterSelect<number>
                    value={filters.year}
                    options={yearOptions.map((y) => ({ value: y, label: String(y) }))}
                    onChange={(next) => onFiltersChange({ ...filters, year: next })}
                    ariaLabel={t("report.cash_flow.field.year")}
                    triggerClassName="min-w-[96px]"
                    triggerIcon={<CalendarIcon className="size-4 shrink-0 text-wb-ntrl-6" />}
                />

                {/* Period picker — hamburger icon */}
                <FilterSelect<number | null>
                    value={filters.quarter}
                    options={buildPeriodOptions(t)}
                    onChange={(next) => onFiltersChange({ ...filters, quarter: next })}
                    ariaLabel={t("report.cash_flow.field.quarter")}
                    triggerClassName="min-w-[116px]"
                    triggerIcon={<MenuIcon className="size-4 shrink-0 text-wb-ntrl-6" />}
                />

                {/* Bank picker — natural width, chevron at the right edge
                    of the trigger so the chip stays compact like the
                    legacy. */}
                <BankFilterPopover
                    options={bankOptions}
                    value={filters.bankFilters}
                    onChange={(next) => onFiltersChange({ ...filters, bankFilters: next })}
                    loading={bankOptionsLoading}
                    triggerClassName="min-w-[260px]"
                />

                {/* Search button — separate bordered chip, NOT stretched. */}
                <button
                    type="button"
                    onClick={onSearch}
                    disabled={loading}
                    className={cn(
                        "flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center px-5",
                        "rounded-md border border-wb-ntrl-4 bg-white shadow-wb-btn",
                        "text-wb-14 font-medium text-wb-ink",
                        "hover:bg-black/[0.03]",
                        "disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                >
                    {t("common.search")}
                </button>
            </div>
            </div>

            {/* Cash Flow uses its OWN scroll container inside
                `<CashFlowMatrix>` (rounded bordered frame mirroring
                legacy `cash_0001_001`) — so we skip
                `<ReportLayout>`'s scroll viewport here and just
                provide a flex slot that fills the page height. The
                matrix container owns both axes' scrollbars so they
                sit inset along the table's right + bottom edges,
                with sticky thead + END BALANCE band anchored to
                the matrix viewport (not the page). */}
            <div className="flex min-h-0 flex-1 flex-col pb-3">
                <CashFlowMatrix
                    report={report ?? buildEmptyReport(filters.baseCurrency)}
                    visibleMonthIdx={visibleMonthIdx}
                />
                {loading && !report && (
                    <p className="px-2.5 py-3 text-center text-wb-12 text-wb-muted">
                        {t("common.loading")}
                    </p>
                )}
            </div>
        </PageLayout>
    );
}

/**
 * The legacy filter row has ONE "Exchange Rate" input even though the
 * backend accepts both USD and KRW rates. The legacy UX picks the rate
 * relevant to the base currency:
 *
 *   base=VND → input value = USD rate (the common case; KRW rate stays
 *              at its default to satisfy backend validation when KRW
 *              transactions exist).
 *   base=USD → input value = KRW rate (USD ↔ KRW for cross-rate).
 *   base=KRW → input value = USD rate.
 *
 * We mirror this exactly so the filter row reads identical to legacy
 * while the wire still carries both rates.
 */
function combinedRate(f: CashFlowFilters): string {
    return f.baseCurrency === "USD" ? f.krwRate : f.usdRate;
}

function applyCombinedRate(f: CashFlowFilters, value: string): CashFlowFilters {
    if (f.baseCurrency === "USD") return { ...f, krwRate: value };
    return { ...f, usdRate: value };
}

/**
 * Render the wire-stored numeric rate with VND-style thousand grouping
 * (dots) — matches the legacy display (`26000` ⇒ `26.000`, `26389` ⇒
 * `26.389`). Empty string passes through unchanged so the input doesn't
 * lock when the user clears it.
 */
function formatExchangeRateForDisplay(raw: string): string {
    if (!raw) return "";
    // Tolerate already-grouped values (e.g. when re-rendering after an
    // edit) — strip every dot before reformatting.
    const stripped = raw.replace(/\./g, "").replace(/,/g, "");
    if (!/^\d+$/.test(stripped)) return raw;
    return stripped.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Inverse of {@link formatExchangeRateForDisplay} — strips dots so the
 * wire value stays a clean numeric string. The backend expects a plain
 * number (no thousand separator).
 */
function parseExchangeRateInput(value: string): string {
    return value.replace(/\./g, "").replace(/,/g, "");
}

/* ============================== Matrix ============================== */

/**
 * Group of rows under one Level-1 root (REVENUE / EXPENSES / INVESTMENT).
 * Built by walking `report.rows` and bucketing by `group_cd` / parent.
 */
type GroupedRows = {
    l1: CashFlowRow;
    children: L2Group[];
    subtotal: CashFlowRow;
};

type L2Group = {
    l2: CashFlowRow;
    l3s: CashFlowRow[];
};

/**
 * Re-shape the flat backend row list into the legacy three-column
 * grouped layout. The backend emits rows in the right order
 * (Opening → ACC-01 group → ACC-02 group → ACC-03 group → Sales Profit
 * → End Balance), so we walk linearly and bucket.
 */
function groupReport(report: CashFlowReport): {
    opening?: CashFlowRow;
    groups: GroupedRows[];
    salesProfit?: CashFlowRow;
    nonSalesProfit?: CashFlowRow;
    endBalance?: CashFlowRow;
} {
    let opening: CashFlowRow | undefined;
    let salesProfit: CashFlowRow | undefined;
    let nonSalesProfit: CashFlowRow | undefined;
    let endBalance: CashFlowRow | undefined;
    const groups: GroupedRows[] = [];

    // Legacy `cash_0001_001` keys these accent rows off `DISP_CD`
    // (the row is tagged with rowType="Sales Profit" / "SALES PROFIT" by
    // the backend, but the actual distinguishing flag is whether
    // DISP_CD === "NON SALES PROFIT"). Mirror that here so a backend
    // that ships both rows under the umbrella "Sales Profit" rowType
    // still gets routed correctly.

    let currentGroup: GroupedRows | null = null;
    let currentL2: L2Group | null = null;

    for (const row of report.rows) {
        switch (row.rowType) {
            case "Opening Balance":
                opening = row;
                break;
            case "Level 1":
                // Start a new group. The L1 row also carries its own
                // aggregated amounts but we use it primarily for the
                // outer-category cell label.
                currentGroup = { l1: row, children: [], subtotal: row };
                currentL2 = null;
                groups.push(currentGroup);
                break;
            case "Level 2":
                if (currentGroup) {
                    currentL2 = { l2: row, l3s: [] };
                    currentGroup.children.push(currentL2);
                }
                break;
            case "Level 3":
                if (currentL2) {
                    currentL2.l3s.push(row);
                } else if (currentGroup) {
                    // L3 with no L2 parent — synthesise an empty L2 wrapper.
                    const orphan: L2Group = {
                        l2: { ...row, displayCd: "", displayNm: "" },
                        l3s: [row],
                    };
                    currentGroup.children.push(orphan);
                    currentL2 = orphan;
                }
                break;
            case "Level 1 Subtotal":
                // ACC-03's subtotal carries displayCd="NON SALES PROFIT"
                // (backend `CashFlowRowAssembler.subtotalDisplayCode`).
                // Route it into `nonSalesProfit` ONLY — don't store on
                // `currentGroup.subtotal` so the blue SubtotalBand never
                // gets data to render for ACC-03 (defence in depth on top
                // of `suppressSubtotal`).
                if (row.displayCd === "NON SALES PROFIT") {
                    nonSalesProfit = row;
                } else if (currentGroup) {
                    currentGroup.subtotal = row;
                }
                break;
            case "Sales Profit":
            case "SALES PROFIT":
                salesProfit = row;
                break;
            case "End Balance":
            case "Grand Total":
                endBalance = row;
                break;
            default:
                // Unknown row type — skip silently.
                break;
        }
    }

    return { opening, groups, salesProfit, nonSalesProfit, endBalance };
}

/* Sticky-left column widths. Mirrors legacy `cash_0001_001` (image 2):
   5 sticky columns — outer category, mid category, KO name, item code,
   item name. Header row 1 merges the first 3 cols into one wide
   "Opening Balance" cell (colspan=3, rowspan=2) with rowspan=2; row 2
   then carries Item code / Item name as their own header cells.

   Body rows render all 5 columns separately so the legacy four-level
   layout reads correctly (e.g. `수입 REVENUE | 기타 OTHERS | 임대수입/세금환급외 | 1025001 | Tax Refund`).

   Cumulative left offsets are used by each sticky cell's `left: Npx`
   so the columns stack horizontally without gaps. */
const STICKY_COL_WIDTHS = {
    outer: 160,
    mid: 200,
    koNm: 220,
    itemCd: 100,
    itemNm: 180,
} as const;
const STICKY_OFFSETS = {
    outer: 0,
    mid: STICKY_COL_WIDTHS.outer,
    koNm: STICKY_COL_WIDTHS.outer + STICKY_COL_WIDTHS.mid,
    itemCd:
        STICKY_COL_WIDTHS.outer +
        STICKY_COL_WIDTHS.mid +
        STICKY_COL_WIDTHS.koNm,
    itemNm:
        STICKY_COL_WIDTHS.outer +
        STICKY_COL_WIDTHS.mid +
        STICKY_COL_WIDTHS.koNm +
        STICKY_COL_WIDTHS.itemCd,
};
const STICKY_LEFT_TOTAL =
    STICKY_COL_WIDTHS.outer +
    STICKY_COL_WIDTHS.mid +
    STICKY_COL_WIDTHS.koNm +
    STICKY_COL_WIDTHS.itemCd +
    STICKY_COL_WIDTHS.itemNm; // 610px
const STICKY_OPENING_BALANCE_SPAN = 3; // outer + mid + koNm in header row 1

function CashFlowMatrix({
    report,
    visibleMonthIdx,
}: {
    report: CashFlowReport;
    visibleMonthIdx: number[];
}) {
    const { t } = useTranslation();
    const dispCcy = report.baseCurrency;
    const { opening, groups, salesProfit, nonSalesProfit, endBalance } = useMemo(
        () => groupReport(report),
        [report],
    );

    // 5 left sticky columns + N monthly (no annual total column)
    const monthColWidth = "120px";
    const tableMinWidth = STICKY_LEFT_TOTAL + visibleMonthIdx.length * 120;

    // Total column count for full-width subtotal / band rows
    const totalCols = 5 + visibleMonthIdx.length;

    return (
        <div className="cf-scrollbar flex h-full max-h-full flex-col overflow-auto rounded-md border border-wb-ntrl-4">
            <div
                className="flex min-h-full min-w-fit flex-col"
                style={{ minWidth: `${tableMinWidth}px` }}
            >
        <table
            className="w-full table-fixed border-separate [&_td]:border [&_td]:border-wb-ntrl-3 [&_th]:border [&_th]:border-wb-ntrl-3"
            style={{ minWidth: `${tableMinWidth}px`, borderSpacing: 0 }}
        >
            <colgroup>
                <col style={{ width: `${STICKY_COL_WIDTHS.outer}px` }} />
                <col style={{ width: `${STICKY_COL_WIDTHS.mid}px` }} />
                <col style={{ width: `${STICKY_COL_WIDTHS.koNm}px` }} />
                <col style={{ width: `${STICKY_COL_WIDTHS.itemCd}px` }} />
                <col style={{ width: `${STICKY_COL_WIDTHS.itemNm}px` }} />
                {visibleMonthIdx.map((idx) => (
                    <col key={`col-${idx}`} style={{ width: monthColWidth }} />
                ))}
            </colgroup>

            <thead className="sticky top-0 z-20">
                {/* Header row 1 — "Opening Balance" label spans the first 3
                    sticky-left cells (outer + mid + ko name) via colspan=3 +
                    rowspan=2 so it merges into row 2's space too. Then
                    "Item code" + "Item name" headers (rowspan=2 each) cover
                    cols 4-5. Month labels cover the scrolling section.
                    Mirrors legacy `cash_0001_001_view.jsp` exactly. */}
                <tr className="h-[var(--h-wb-table-head)] bg-wb-bg-sidebar">
                    <th
                        colSpan={STICKY_OPENING_BALANCE_SPAN}
                        rowSpan={2}
                        className="sticky z-30 bg-wb-bg-sidebar px-2.5 py-3 text-center align-middle"
                        style={{ left: 0 }}
                    >
                        <span className="text-wb-13 font-semibold text-wb-dark">
                            {t("report.cash_flow.opening_balance")}
                        </span>
                    </th>
                    {/* Row 1 cols 4-5 — empty cells above Item code / Item name
                        so a clean horizontal border separates them from the
                        row-2 header labels (mirrors legacy image 2). */}
                    <th
                        className="sticky z-30 bg-wb-bg-sidebar px-2.5 py-3 align-middle"
                        style={{ left: STICKY_OFFSETS.itemCd }}
                    />
                    <th
                        className="sticky z-30 bg-wb-bg-sidebar px-2.5 py-3 align-middle"
                        style={{ left: STICKY_OFFSETS.itemNm }}
                    />
                    {visibleMonthIdx.map((idx) => (
                        <th
                            key={`mh-${idx}`}
                            className="bg-wb-bg-sidebar px-2.5 py-3 text-center align-middle"
                        >
                            <span className="text-wb-13 font-semibold text-wb-dark">
                                {t(`report.cash_flow.month.${MONTH_KEYS[idx]}`)}
                            </span>
                        </th>
                    ))}
                </tr>
                {/* Header row 2 — Item code / Item name labels, plus the
                    Opening Balance VALUES under each month. The first 3
                    sticky-left cells are absorbed by the rowspan=2 on
                    row 1's "Opening Balance" cell. */}
                <tr className="h-[var(--h-wb-table-head)] bg-wb-bg-sidebar">
                    <th
                        className="sticky z-30 bg-wb-bg-sidebar px-2.5 py-3 text-left align-middle"
                        style={{ left: STICKY_OFFSETS.itemCd }}
                    >
                        <span className="text-wb-13 font-semibold text-wb-dark">
                            {t("report.cash_flow.col.item_code")}
                        </span>
                    </th>
                    <th
                        className="sticky z-30 bg-wb-bg-sidebar px-2.5 py-3 text-left align-middle"
                        style={{ left: STICKY_OFFSETS.itemNm }}
                    >
                        <span className="text-wb-13 font-semibold text-wb-dark">
                            {t("report.cash_flow.col.item_name")}
                        </span>
                    </th>
                    {visibleMonthIdx.map((idx) => {
                        const key = MONTH_KEYS[idx];
                        return (
                            <th
                                key={`open-${idx}`}
                                className="bg-wb-bg-sidebar px-2.5 py-3 text-right align-middle"
                            >
                                <span className="text-wb-13 font-semibold text-wb-dark">
                                    {opening ? renderAmount(opening.monthly[key], dispCcy) : ""}
                                </span>
                            </th>
                        );
                    })}
                </tr>
            </thead>

            <tbody>
                {/* Per-L1 groups, with profit accent rows interleaved
                    around ACC-03 — mirrors legacy `cash_0001_001.ts`:
                      • SALES PROFIT is inserted immediately before the
                        first ACC-03 (Investment) group.
                      • NON SALES PROFIT closes the ACC-03 block (renders
                        right after ACC-03, before the next group).
                    The Level-1 Subtotal band is suppressed for ACC-03
                    and ACC-99 because Sales / Non-Sales Profit replace
                    those subtotals visually. */}
                {(() => {
                    const out: React.ReactNode[] = [];
                    let salesProfitEmitted = false;
                    let withinAcc03 = false;
                    let nonSalesProfitEmitted = false;

                    for (let gi = 0; gi < groups.length; gi++) {
                        const g = groups[gi];
                        const isAcc03 = g.l1.displayCd === "ACC-03";

                        if (isAcc03 && !salesProfitEmitted && salesProfit) {
                            out.push(
                                <ProfitBand
                                    key="sales-profit"
                                    profit={salesProfit}
                                    visibleMonthIdx={visibleMonthIdx}
                                    dispCcy={dispCcy}
                                />,
                            );
                            salesProfitEmitted = true;
                            withinAcc03 = true;
                        }

                        if (withinAcc03 && !isAcc03 && !nonSalesProfitEmitted && nonSalesProfit) {
                            out.push(
                                <ProfitBand
                                    key="non-sales-profit"
                                    profit={nonSalesProfit}
                                    visibleMonthIdx={visibleMonthIdx}
                                    dispCcy={dispCcy}
                                />,
                            );
                            nonSalesProfitEmitted = true;
                            withinAcc03 = false;
                        }

                        out.push(
                            <GroupRows
                                key={`grp-${gi}-${g.l1.displayCd}`}
                                group={g}
                                visibleMonthIdx={visibleMonthIdx}
                                dispCcy={dispCcy}
                                totalCols={totalCols}
                                suppressSubtotal={
                                    g.l1.displayCd === "ACC-03" ||
                                    g.l1.displayCd === "ACC-99"
                                }
                            />,
                        );
                    }

                    // If ACC-03 was the last group, still close with NON SALES PROFIT.
                    if (withinAcc03 && !nonSalesProfitEmitted && nonSalesProfit) {
                        out.push(
                            <ProfitBand
                                key="non-sales-profit-trail"
                                profit={nonSalesProfit}
                                visibleMonthIdx={visibleMonthIdx}
                                dispCcy={dispCcy}
                            />,
                        );
                    }

                    return out;
                })()}

                {/* Empty-state placeholder rows. When the API returns no
                    groups (e.g. tenant has no transactions for the
                    selected year), render a fixed number of empty rows
                    so the table chrome still shows visible cell borders
                    — matches the legacy `cash_0001_001` visual where
                    every chart-of-accounts row renders even with zero
                    amounts. Frontend stop-gap; the backend will ship the
                    full chart hierarchy in a follow-up MR. */}
                {groups.length === 0 && !salesProfit && (
                    <>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <tr
                                key={`empty-${i}`}
                                className="h-9"
                            >
                                <td
                                    className="sticky z-10 bg-white px-3 py-1.5 align-middle"
                                    style={{ left: STICKY_OFFSETS.outer }}
                                />
                                <td
                                    className="sticky z-10 bg-white px-3 py-1.5 align-middle"
                                    style={{ left: STICKY_OFFSETS.mid }}
                                />
                                <td
                                    className="sticky z-10 bg-white px-3 py-1.5 align-middle"
                                    style={{ left: STICKY_OFFSETS.koNm }}
                                />
                                <td
                                    className="sticky z-10 bg-white px-3 py-1.5 align-middle"
                                    style={{ left: STICKY_OFFSETS.itemCd }}
                                />
                                <td
                                    className="sticky z-10 bg-white px-3 py-1.5 align-middle"
                                    style={{ left: STICKY_OFFSETS.itemNm }}
                                />
                                {visibleMonthIdx.map((mIdx) => (
                                    <td
                                        key={`empty-${i}-${mIdx}`}
                                        className="px-3 py-1.5 align-middle"
                                    />
                                ))}
                            </tr>
                        ))}
                    </>
                )}

                {/* Trailing Sales Profit fallback — if the backend
                    didn't ship an ACC-03 group (rare), still surface
                    the Sales Profit row so the matrix doesn't lose it. */}
                {salesProfit && groups.every((g) => g.l1.displayCd !== "ACC-03") && (
                    <ProfitBand
                        profit={salesProfit}
                        visibleMonthIdx={visibleMonthIdx}
                        dispCcy={dispCcy}
                    />
                )}
            </tbody>

        </table>

        {/* End Balance band — sticky-bottom sibling table sharing
            the main table's colgroup widths. `sticky bottom-0`
            anchors the band to the bottom of the scroll viewport so
            it stays visible while body rows scroll behind it (legacy
            `cash_0001_001` parity). `mt-auto` keeps it pinned when
            content is short. */}
        <table
            className="sticky bottom-0 z-20 mt-auto w-full table-fixed border-separate"
            style={{ minWidth: `${tableMinWidth}px`, borderSpacing: 0 }}
        >
            <colgroup>
                <col style={{ width: `${STICKY_COL_WIDTHS.outer}px` }} />
                <col style={{ width: `${STICKY_COL_WIDTHS.mid}px` }} />
                <col style={{ width: `${STICKY_COL_WIDTHS.koNm}px` }} />
                <col style={{ width: `${STICKY_COL_WIDTHS.itemCd}px` }} />
                <col style={{ width: `${STICKY_COL_WIDTHS.itemNm}px` }} />
                {visibleMonthIdx.map((idx) => (
                    <col key={`fcol-${idx}`} style={{ width: monthColWidth }} />
                ))}
            </colgroup>
            <tbody>
                <tr
                    className="h-9"
                    style={{ backgroundColor: "#16a34a" }}
                >
                    <td
                        colSpan={5}
                        className="sticky z-10 align-middle text-wb-13 font-semibold uppercase tracking-wb-tight text-white"
                        style={{
                            left: 0,
                            backgroundColor: "#16a34a",
                            padding: "12px 10px",
                            borderRight: "1px solid rgba(255,255,255,0.25)",
                        }}
                    >
                        {t("report.cash_flow.end_balance")}
                    </td>
                    {visibleMonthIdx.map((idx) => {
                        const key = MONTH_KEYS[idx];
                        return (
                            <td
                                key={`eb-${idx}`}
                                className="text-right align-middle text-wb-13 font-semibold text-white"
                                style={{
                                    backgroundColor: "#16a34a",
                                    padding: "12px 10px",
                                    borderRight: "1px solid rgba(255,255,255,0.25)",
                                }}
                            >
                                {endBalance
                                    ? renderAmount(endBalance.monthly[key], dispCcy)
                                    : "0"}
                            </td>
                        );
                    })}
                </tr>
            </tbody>
        </table>
            </div>
        </div>
    );
}

/**
 * One Level-1 root rendered as a block of rows. The L1 cell spans
 * all rows in this group via rowspan; each L2 cell spans its own
 * L3 children; L3 rows carry item code + item name. A final
 * full-width band closes the group with the S.TOTAL subtotal.
 */
function GroupRows({
    group,
    visibleMonthIdx,
    dispCcy,
    totalCols,
    suppressSubtotal = false,
}: {
    group: GroupedRows;
    visibleMonthIdx: number[];
    dispCcy: string;
    totalCols: number;
    /** Skip the trailing "S.TOTAL" band — set for ACC-03 (Investment)
     *  and ACC-99 (Others) where Sales/Non-Sales Profit replace the
     *  subtotal visually per legacy `cash_0001_001`. */
    suppressSubtotal?: boolean;
}) {
    // Total rows this L1 cell needs to span = sum(L2.l3s.length) when L2 has children;
    // an L2 with zero L3s still emits one row (showing the L2 label + empty body).
    // Plus 1 more row for the trailing "S.TOTAL" subtotal band (when rendered) —
    // the L1 cell now extends through that band so the outer category column
    // stays unbroken (matches legacy `cash_0001_001` where 수입 REVENUE flows
    // continuously through the S.TOTAL row).
    const l3RowsTotal = group.children.reduce(
        (acc, l2) => acc + Math.max(l2.l3s.length, 1),
        0,
    );
    const l1RowSpan = l3RowsTotal + (suppressSubtotal ? 0 : 1);

    // Edge case: no L2 children at all — emit one row with empty mid/L3 cells
    // so the L1 cell has something to wrap.
    if (l3RowsTotal === 0) {
        return (
            <>
                <tr className="h-9 border-b border-wb-table-border">
                    <td
                        className="sticky z-10 border-r border-wb-table-border bg-wb-bg-sidebar/40 px-3 py-1.5 align-middle text-wb-13 font-semibold text-wb-ink"
                        style={{ left: STICKY_OFFSETS.outer }}
                    >
                        <CategoryCell row={group.l1} />
                    </td>
                    <td
                        className="sticky z-10 border-r border-wb-table-border bg-white px-3 py-1.5 align-middle text-wb-13 text-wb-muted"
                        style={{ left: STICKY_OFFSETS.mid }}
                    />
                    <td
                        className="sticky z-10 bg-white px-3 py-1.5 align-middle text-wb-13 text-wb-muted"
                        style={{ left: STICKY_OFFSETS.koNm }}
                    />
                    <td
                        className="sticky z-10 bg-white px-3 py-1.5 align-middle text-wb-13 text-wb-muted"
                        style={{ left: STICKY_OFFSETS.itemCd }}
                    />
                    <td
                        className="sticky z-10 border-r border-wb-table-border bg-white px-3 py-1.5 align-middle text-wb-13 text-wb-muted"
                        style={{ left: STICKY_OFFSETS.itemNm }}
                    />
                    {visibleMonthIdx.map((idx) => (
                        <td
                            key={`l1empty-${idx}`}
                            className="px-3 py-1.5 text-right align-middle text-wb-13 text-wb-ink"
                        />
                    ))}
                </tr>
                {!suppressSubtotal && (
                    <SubtotalBand
                        subtotal={group.subtotal}
                        visibleMonthIdx={visibleMonthIdx}
                        dispCcy={dispCcy}
                        totalCols={totalCols}
                    />
                )}
            </>
        );
    }

    const rows: React.ReactNode[] = [];
    let l1Emitted = false;

    for (const l2 of group.children) {
        const l3Count = Math.max(l2.l3s.length, 1);
        let l2Emitted = false;

        const l3sToRender =
            l2.l3s.length > 0
                ? l2.l3s
                : [createEmptyL3Placeholder()];

        l3sToRender.forEach((l3, l3i) => {
            // Legacy splits the L3 row into a KO-name cell (col 3),
            // item code (col 4), and item name (col 5). The backend
            // ships `displayNm = chart_acct_nm_ko` and
            // `itemNm = chart_acct_nm_en` as separate fields —
            // consume them directly. (The earlier "split on first
            // space" heuristic was for an older contract where the
            // wire concatenated KO+EN into one field.)
            const koName = l3.displayNm || "";
            const enItemName = l3.itemNm || "";
            rows.push(
                <tr
                    key={`l3-${l2.l2.displayCd}-${l3.displayCd}-${l3i}`}
                    className="h-9 border-b border-wb-table-border"
                >
                    {/* L1 cell — emitted once, spans the entire group. Sticky-left. */}
                    {!l1Emitted && (
                        <td
                            rowSpan={l1RowSpan}
                            className="sticky z-10 border-r border-wb-table-border bg-wb-bg-sidebar/40 px-3 py-1.5 align-middle text-wb-13 font-semibold text-wb-ink"
                            style={{ left: STICKY_OFFSETS.outer }}
                        >
                            <CategoryCell row={group.l1} />
                        </td>
                    )}
                    {/* L2 cell — emitted once per L2, spans this L2's L3 rows. Sticky-left. */}
                    {!l2Emitted && (
                        <td
                            rowSpan={l3Count}
                            className="sticky z-10 border-r border-wb-table-border bg-white px-3 py-1.5 align-middle text-wb-13 font-semibold text-wb-ink"
                            style={{ left: STICKY_OFFSETS.mid }}
                        >
                            <CategoryCell row={l2.l2} />
                        </td>
                    )}
                    {/* L3 KO name — sticky-left, col 3 in legacy */}
                    <td
                        className="sticky z-10 bg-white px-3 py-1.5 align-middle text-wb-13 font-medium text-wb-ink"
                        style={{ left: STICKY_OFFSETS.koNm }}
                    >
                        <span className="block">{koName}</span>
                    </td>
                    {/* L3 item code — sticky-left */}
                    <td
                        className="sticky z-10 bg-white px-3 py-1.5 align-middle text-wb-13 font-medium text-wb-ink"
                        style={{ left: STICKY_OFFSETS.itemCd }}
                    >
                        <span className="block">{l3.displayCd || ""}</span>
                    </td>
                    {/* L3 item name — sticky-left, with a right border so the
                        sticky stack visually separates from the scrolling
                        month columns. */}
                    <td
                        className="sticky z-10 border-r border-wb-table-border bg-white px-3 py-1.5 align-middle text-wb-13 font-medium text-wb-ink"
                        style={{ left: STICKY_OFFSETS.itemNm }}
                    >
                        <span className="block">{enItemName}</span>
                    </td>
                    {visibleMonthIdx.map((idx) => {
                        const key = MONTH_KEYS[idx];
                        return (
                            <td
                                key={`l3-m-${idx}`}
                                className="px-3 py-1.5 text-right align-middle text-wb-13 font-medium text-wb-ink"
                            >
                                {renderAmount(l3.monthly[key], l3.displayCurrency || dispCcy)}
                            </td>
                        );
                    })}
                </tr>,
            );
            l1Emitted = true;
            l2Emitted = true;
        });
    }

    // Subtotal band — full-width, tinted blue, spans the group's bottom.
    // Skipped for ACC-03 / ACC-99 per legacy `cash_0001_001` (Sales /
    // Non-Sales Profit replace the subtotal visually for those groups).
    if (!suppressSubtotal) {
        rows.push(
            <SubtotalBand
                key={`subtotal-${group.l1.displayCd}`}
                subtotal={group.subtotal}
                visibleMonthIdx={visibleMonthIdx}
                dispCcy={dispCcy}
                totalCols={totalCols}
            />,
        );
    }

    return <>{rows}</>;
}

/**
 * Split the legacy concatenated "KO EN" `display_name` into its KO
 * leading segment. Used by the Level-3 row to populate the col-3 KO
 * name cell (separately from the col-5 item-name English label).
 *
 * Heuristic: split on the first space; if the part after the space
 * starts with a Latin letter, the prefix is treated as Korean.
 * Otherwise the whole string is treated as the KO segment.
 */
function extractKoName(displayNm: string): string {
    if (!displayNm) return "";
    const spaceIdx = displayNm.indexOf(" ");
    if (spaceIdx <= 0) return displayNm;
    const after = displayNm.charAt(spaceIdx + 1);
    if (/[A-Za-z]/.test(after)) return displayNm.slice(0, spaceIdx);
    return displayNm;
}

function extractEnName(displayNm: string): string {
    if (!displayNm) return "";
    const spaceIdx = displayNm.indexOf(" ");
    if (spaceIdx <= 0) return "";
    const after = displayNm.charAt(spaceIdx + 1);
    if (/[A-Za-z]/.test(after)) return displayNm.slice(spaceIdx + 1);
    return "";
}

/**
 * Renders the L1 / L2 category cell. Display name is the legacy
 * concatenated "KO EN" form (e.g. "수입 REVENUE") produced by the
 * backend's `joinKoEn(ko, en)`. When KO == EN (e.g. Code0091's
 * "INVESTMENT STOCK INVESTMENT STOCK"), strip the duplicate so the
 * cell renders the label once. Single-line text matching the live
 * `cash_0001_001` layout.
 */
function CategoryCell({ row }: { row: CashFlowRow }) {
    const name = dedupeKoEn(row.displayNm || row.displayCd || "");
    return <span className="block">{name}</span>;
}

/**
 * Collapse `"X X"` (KO == EN — same string twice) into a single `"X"`.
 * The backend's `joinKoEn(ko, en)` doesn't dedupe — when a chart account
 * has identical Korean and English names the wire ships them twice with
 * a space in between. Split the string in half; if both halves match,
 * return one half.
 */
function dedupeKoEn(s: string): string {
    if (!s) return s;
    const mid = s.length;
    // Try every space as a potential split point — pick the one where
    // left == right (after trimming) so the dedupe is exact.
    let idx = s.indexOf(" ");
    while (idx > 0 && idx < mid) {
        const left = s.slice(0, idx).trim();
        const right = s.slice(idx + 1).trim();
        if (left && left === right) return left;
        idx = s.indexOf(" ", idx + 1);
    }
    return s;
}

/**
 * Full-width green accent band for the SALES PROFIT / NON SALES PROFIT
 * rows. Mirrors legacy `appendProfitRow` in `cash_0001_001.ts` — the
 * label cell spans the 5 sticky-left columns and each month column
 * shows the profit amount. Background is the same green token the End
 * Balance band uses (light tint vs. the EB band's solid green).
 */
function ProfitBand({
    profit,
    visibleMonthIdx,
    dispCcy,
}: {
    profit: CashFlowRow;
    visibleMonthIdx: number[];
    dispCcy: string;
}) {
    return (
        <tr className="h-9 bg-wb-status-approved-bg">
            <td
                colSpan={5}
                className="sticky z-10 bg-wb-status-approved-bg px-3 py-1.5 text-center align-middle text-wb-13 font-semibold text-wb-ink"
                style={{ left: 0 }}
            >
                {profit.displayNm || profit.displayCd}
            </td>
            {visibleMonthIdx.map((idx) => {
                const key = MONTH_KEYS[idx];
                return (
                    <td
                        key={`profit-${idx}`}
                        className="bg-wb-status-approved-bg px-3 py-1.5 text-right align-middle text-wb-13 font-semibold text-wb-ink"
                    >
                        {renderAmount(profit.monthly[key], dispCcy)}
                    </td>
                );
            })}
        </tr>
    );
}

function SubtotalBand({
    subtotal,
    visibleMonthIdx,
    dispCcy,
    totalCols: _totalCols,
}: {
    subtotal: CashFlowRow;
    visibleMonthIdx: number[];
    dispCcy: string;
    totalCols: number;
}) {
    void _totalCols;
    return (
        <tr className="h-9 border-b border-wb-table-border">
            {/* Col 1 (outer) is absorbed by the L1 cell's rowSpan
                from the row block above — DO NOT emit a placeholder
                `<td>` here. The L1 cell extends down through the
                S.TOTAL band so the outer category column stays
                unbroken (matches legacy `cash_0001_001`).

                Band starts at col 2 (mid category) and spans
                cols 2-5 plus all month columns. Label centered. */}
            <td
                colSpan={4}
                className="sticky z-10 bg-wb-status-progress-bg px-3 py-1.5 text-center align-middle text-wb-13 font-semibold text-wb-ink"
                style={{ left: STICKY_OFFSETS.mid }}
            >
                {subtotal.displayNm || subtotal.displayCd}
            </td>
            {visibleMonthIdx.map((idx) => {
                const key = MONTH_KEYS[idx];
                return (
                    <td
                        key={`sub-${idx}`}
                        className="bg-wb-status-progress-bg px-3 py-1.5 text-right align-middle text-wb-13 font-semibold text-wb-ink"
                    >
                        {renderAmount(subtotal.monthly[key], dispCcy)}
                    </td>
                );
            })}
        </tr>
    );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
    return (
        <th className="bg-wb-bg-sidebar px-2.5 py-3 text-left align-middle">
            <span className="text-wb-13 font-semibold text-wb-dark">{children}</span>
        </th>
    );
}

function renderAmount(value: string, ccy: string): string {
    // Legacy fmtAmt: zero / NaN / empty renders as an empty cell (no
    // hyphen, no zero). Matches `cash_0001_001.ts` behaviour exactly so
    // the matrix reads like the live spreadsheet — only populated months
    // show a value.
    if (!value) return "";
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return "";
    return formatAmount(value, ccy, true);
}

/**
 * Build a structurally-valid empty {@link CashFlowReport} so the matrix
 * always renders its chrome (header, Opening Balance row, End Balance
 * footer) even before the API responds. The body emits zero data rows;
 * a separate "Loading..." note appears alongside until the real report
 * lands.
 */
function buildEmptyReport(baseCurrency: string): CashFlowReport {
    return {
        year: new Date().getFullYear(),
        quarter: null,
        baseCurrency,
        usdRate: "",
        krwRate: "",
        rows: [],
    };
}

function createEmptyL3Placeholder(): CashFlowRow {
    return {
        displayOrder: "",
        displayCd: "",
        displayNm: "",
        itemCd: "",
        itemNm: "",
        rowType: "Level 3",
        groupCd: "",
        parentL2Cd: "",
        displayCurrency: "",
        monthly: {
            jan: "", feb: "", mar: "", apr: "", may: "", jun: "",
            jul: "", aug: "", sep: "", oct: "", nov: "", dec: "",
        },
        annualTotal: "",
    };
}

/** Default filter values for the first render — current year, all-year,
 *  VND base, sample rates, no bank filter. */
export function defaultCashFlowFilters(): CashFlowFilters {
    return {
        year: new Date().getFullYear(),
        quarter: null,
        baseCurrency: "VND",
        usdRate: "26000",
        krwRate: "19",
        bankFilters: [],
    };
}
