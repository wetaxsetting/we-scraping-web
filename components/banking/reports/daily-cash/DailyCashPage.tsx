"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import ReportSection from "@/components/banking/reports/ReportSection";
import CurrencyScopeToggle, {
    type CurrencyScope,
} from "@/components/shared/CurrencyScopeToggle";
import DateField from "@/components/shared/DateField";
import { formatIsoDateByLanguage } from "@/lib/datetime";
import FilterRow from "@/components/shared/FilterRow";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import ReportLayout from "@/components/shared/ReportLayout";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { Button } from "@/components/ui/button";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/currency";
import { printDailyCashReport } from "@/lib/dailyCashExport";
import { downloadDailyCashReport } from "@/lib/api/banking";
import { useDialog } from "@/components/shared/dialog";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type {
    DailyCashAccountRow,
    DailyCashSummaryRow,
} from "./types";

type DailyCashPageProps = {
    /** API summary rows. Defaults to an empty array — Sprint 1 stabilization
     *  removed the mock seed; API is the single source of truth. */
    summary?: DailyCashSummaryRow[];
    /**
     * Current Accounts ledger rows (`ACCT_TYPE_CD` ∈ {03,04,07}).
     * The client wrapper splits the backend's flat `accounts` list on
     * the type code before handing them down.
     */
    accounts?: DailyCashAccountRow[];
    /** Saving Accounts ledger rows (`ACCT_TYPE_CD` ∈ {05,06,08}). */
    savingAccounts?: DailyCashAccountRow[];
    /**
     * Optional controlled filter / search wiring. When provided by a
     * client wrapper, the page lifts its `scope` + `asOfDate` + Search
     * trigger up so the wrapper can refetch the backend with the new
     * params. When omitted, the page falls back to local state and
     * renders rows from props verbatim.
     */
    asOfDate?: string;
    /** ISO `YYYY-MM-DD` form of {@link asOfDate}. When provided alongside
     *  {@link onAsOfDateChange} the date chip becomes a live `<DateField>`
     *  so the user can pick the report date instead of staring at a
     *  read-only label. Wrappers that lift filter state pass both. */
    asOfIsoDate?: string;
    onAsOfDateChange?: (iso: string) => void;
    scope?: CurrencyScope;
    onScopeChange?: (next: CurrencyScope) => void;
    onSearch?: () => void;
    /** True once the user has clicked Search at least once. Drives the
     *  empty placeholder → results flow per Figma 96:40920 / 96:41152. */
    hasSearched?: boolean;
    loading?: boolean;
};

/**
 * Daily Cash report — Figma 96:40920 (empty) + 96:41152 (search result).
 *
 * The page mirrors the live JEX `rept_0009_001.act` flow: it boots in an
 * empty state showing only the filter row and a "Please click the Search
 * button." placeholder. Clicking Search flips local state and renders the
 * mock report (centered sub-title, as-of card, four sections).
 *
 * Sections (legacy rept_0009_001 VN layout):
 *   1. Summary — one block per currency: "<CCY> Total : <amount>" + a
 *      Current / Saving summary table (Cash/Time-Deposit/Loan hidden)
 *   2. Current Accounts — per-account rollup (ACCT_TYPE_CD 03/04/07)
 *   3. Savings Accounts — per-account breakdown (ACCT_TYPE_CD 05/06/08)
 *
 * The legacy VN view's Cash table is commented out (Redmine #42096) and is
 * intentionally NOT rendered here.
 */
export default function DailyCashPage({
    summary,
    accounts,
    savingAccounts,
    asOfDate: asOfDateProp,
    asOfIsoDate,
    onAsOfDateChange,
    scope: scopeProp,
    onScopeChange,
    onSearch,
    hasSearched: hasSearchedProp,
    loading = false,
}: DailyCashPageProps = {}) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();
    const [localScope, setLocalScope] = useState<CurrencyScope>("all");
    const scope = scopeProp ?? localScope;
    const setScope = (next: CurrencyScope) => {
        if (onScopeChange) onScopeChange(next);
        else setLocalScope(next);
    };
    const asOfDate = asOfDateProp ?? "25-04-2024";
    const summaryRows = summary ?? [];
    /* Order the per-currency summary blocks: VND → USD → KRW → others
       alphabetically. The API returns currency_summary in alphabetical
       (ccy_cd ASC) order, so VND would otherwise render last. */
    const orderedSummaryRows = [...summaryRows].sort((a, b) =>
        compareCurrency(a.currencyLabel, b.currencyLabel),
    );
    /* The summary status block ALWAYS renders after Search (legacy / Daily
       Financial parity). When the API returns no per-currency summary
       (e.g. the selected date has no snapshot), fall back to zero rows for
       the default currencies so the user still sees
       "Daily Cash Status — VND/USD/KRW Total : 0". Detail tables stay empty
       — no account rows are fabricated. */
    const summaryRowsForDisplay =
        orderedSummaryRows.length > 0
            ? orderedSummaryRows
            : DEFAULT_SUMMARY_CURRENCIES.map(zeroSummaryRow);
    const currentAccountRows = accounts ?? [];
    const savingsAccountRows = savingAccounts ?? [];
    /**
     * Local UI state — flips from empty placeholder to results once the
     * user clicks Search. When a wrapper provides `hasSearched`, the
     * wrapper owns the flag (so it survives across refetches). Per
     * CLAUDE.md §7b, this flow lives inside the page; we never route
     * to a separate URL for the result state.
     */
    const [localSearched, setLocalSearched] = useState(false);
    const hasSearched = hasSearchedProp ?? localSearched;
    const handleSearch = () => {
        if (onSearch) onSearch();
        else setLocalSearched(true);
    };

    /* Sticky-wrap the in-flight flag so a fast API response doesn't blink
       the Search / Excel / Print disabled state or flash the table-body
       "Loading…" notice on/off. `useApiData` already latches the previous
       response across refetches (stale-while-revalidate), so rows stay
       visible while this gate holds. Gated on `hasSearched` so the
       no-op mount fetch (before the first Search) never disables the
       Search button while the empty placeholder is showing. */
    const stickyLoading = useStickyLoading(loading && hasSearched);

    const handlePrint = () => {
        printDailyCashReport({
            title: t("report.daily_cash.title"),
            asOfLabel: `${t("report.as_of")} : ${asOfDate}`,
            currencyLabel: `${t("report.currency_label")} ${t(`report.scope.${scope}`)}`,
            summaryRows,
            currentAccountRows,
            savingsAccountRows,
            labels: {
                currentAccounts: t("report.daily_cash.section.current_accounts"),
                savingsAccounts: t("report.daily_cash.section.savings_accounts"),
                totalLabel: (ccy) => `Total (${ccy})`,
                colBank: t("report.daily_cash.col.bank"),
                colAccountNo: t("report.daily_cash.col.account_no"),
                colCurrency: t("report.daily_cash.col.currency"),
                colNumDebits: t("report.daily_cash.col.num_debits"),
                colDebit: t("report.daily_cash.col.debit"),
                colNumCredits: t("report.daily_cash.col.num_credits"),
                colCredit: t("report.daily_cash.col.credit"),
                colBalance: t("report.daily_cash.col.balance"),
            },
        });
    };

    /* PO-requested template-populated backend Excel Download (replaces the
       former client-side `xlsx-js-style` builder). Streams the locale
       `.xlsx` report from `GET …/daily-cash-report/report`, reusing the same
       as-of date + currency scope the report was searched with. Print stays
       client-side (`handlePrint`). */
    const handleExportExcel = async () => {
        try {
            await downloadDailyCashReport({
                asOfDate: asOfIsoDate ?? isoFromDmy(asOfDate),
                currency: scopeToCurrency(scope),
                lang: locale,
            });
        } catch (err) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: err instanceof Error ? err.message : String(err),
                errorCode: (err as { code?: string })?.code,
            });
        }
    };

    return (
        <PageLayout>
            <PageHeader title={t("report.daily_cash.title")} />

            <FilterRow
                right={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleSearch}
                        disabled={stickyLoading}
                        className="h-[var(--h-wb-filter-btn)] gap-2 px-4 text-wb-14 text-brand"
                    >
                        <Search className="size-4" strokeWidth={2} />
                        {t("common.search")}
                    </Button>
                }
            >
                <span className="text-wb-14-tight font-medium text-wb-ntrl-8">
                    {t("report.as_of")}
                </span>
                {asOfIsoDate && onAsOfDateChange ? (
                    <DateField
                        value={asOfIsoDate}
                        onChange={onAsOfDateChange}
                    />
                ) : (
                    <div className="flex h-[var(--h-wb-filter-btn)] items-center gap-2 overflow-clip rounded-md bg-white p-2 shadow-wb-btn">
                        <span className="whitespace-nowrap text-wb-14-tight font-medium text-wb-ntrl-8">
                            {asOfDate}
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-calendar-outline.svg"
                            alt=""
                            aria-hidden
                            className="size-4"
                        />
                    </div>
                )}
                <CurrencyScopeToggle
                    value={scope}
                    onChange={setScope}
                    labels={{
                        all: t("report.scope.all"),
                        vnd: t("report.scope.vnd"),
                        fcy: t("report.scope.fcy"),
                    }}
                />
            </FilterRow>

            {/* Print + Excel action row — appears below the filter row
               and ONLY after the user clicks Search. Disabled while
               the fetch is in flight or no rows are available so the
               export can never produce an empty workbook. Mirrors the
               live JEX `rept_0009_001` toolbar (Figma — right-aligned
               icons under the Search button). */}
            {hasSearched && (
                <div className="flex shrink-0 items-center justify-end gap-1">
                    <button
                        type="button"
                        aria-label={t("common.export_excel")}
                        onClick={handleExportExcel}
                        disabled={stickyLoading}
                        className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/common/ico-excel.svg" alt="" aria-hidden className="size-5" />
                    </button>
                    <span aria-hidden className="h-4 w-px bg-wb-ntrl-4" />
                    <button
                        type="button"
                        aria-label={t("common.print")}
                        onClick={handlePrint}
                        disabled={stickyLoading}
                        className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/common/ico-print.svg" alt="" aria-hidden className="size-5" />
                    </button>
                </div>
            )}

            {hasSearched ? (
                /* Banking report layout (CLAUDE.md §7b) — continuous-scroll
                   body, no pagination. `sectioned` wraps children in the
                   shared gap-6 stack so sections share one scroll context.
                   The centered sub-title and "As of … Currency : …" card
                   live INSIDE the scroll viewport (per Figma 9183:20977) so
                   they scroll with the report on a short viewport (laptop). */
                <ReportLayout sectioned>
                    {/* Centered report sub-title — Figma 9183:20991 */}
                    <h2 className="text-center text-wb-18 font-semibold tracking-wb-tight text-black">
                        {t("report.daily_cash.title")}
                    </h2>

                    {/* As-of summary card — same style as the Daily Financial
                       report (light-gray inline band; date in DD-MMM-YYYY). */}
                    <div className="flex items-center rounded-md bg-wb-bg-sidebar p-4">
                        <p className="text-wb-14-tight font-medium text-black">
                            <span>{t("report.as_of")} </span>
                            <span className="text-wb-13 text-wb-ntrl-8">
                                {asOfIsoDate ? formatIsoDateByLanguage(asOfIsoDate, locale) : asOfDate}
                            </span>
                            <span> {t("report.currency_label")} </span>
                            <span className="text-wb-13 text-wb-ntrl-8">
                                {t(`report.scope.${scope}`)}
                            </span>
                        </p>
                    </div>

                    {/* 1. Summary section — one block per currency:
                       "Daily Cash Status — <CCY> Total : <amount>" heading + a
                       Current / Saving summary table. Mirrors the legacy VN view
                       (rept_0009_001_view_osmc.jsp:189-296): a per-currency
                       total line above a two-column Current/Saving table, with
                       the Cash / Time-Deposit / Loan columns hidden. Always
                       renders after Search — when the API returns no buckets it
                       falls back to zero rows for VND/USD/KRW
                       (`summaryRowsForDisplay`). The legacy VN Cash table is
                       commented out (Redmine #42096) so it is not shown here. */}
                    {summaryRowsForDisplay.map((row) => (
                        <ReportSection
                            key={row.currencyLabel}
                            title={t("report.daily_cash.currency_total", {
                                ccy: row.currencyLabel,
                                total: formatAmount(currencyTotal(row), row.currencyLabel, true),
                            })}
                        >
                            <SummaryTable row={row} />
                        </ReportSection>
                    ))}

                    {/* 2. Current Accounts section — per-account breakdown */}
                    <ReportSection
                        title={t("report.daily_cash.section.current_accounts")}
                    >
                        <AccountLedger rows={currentAccountRows} loading={stickyLoading} />
                    </ReportSection>

                    {/* 3. Savings Accounts */}
                    <ReportSection
                        title={t("report.daily_cash.section.savings_accounts")}
                    >
                        <AccountLedger rows={savingsAccountRows} loading={stickyLoading} />
                    </ReportSection>
                </ReportLayout>
            ) : (
                /* Initial empty state (Figma 96:40920) — placeholder text
                   centered in the remaining viewport. Wrapper takes the
                   same `flex-1 min-h-0` slot a `<ReportLayout>` would, so
                   the page height contract from §7b is preserved. */
                <div className="flex min-h-0 flex-1 items-center justify-center pb-3">
                    <p className="text-wb-13 font-normal text-wb-muted">
                        {t("report.daily_cash.empty_message")}
                    </p>
                </div>
            )}
        </PageLayout>
    );
}

/** Currency-scope toggle → backend `currency` query value. */
function scopeToCurrency(scope: CurrencyScope): string {
    return scope === "vnd" ? "VND" : scope === "fcy" ? "FCY" : "ALL";
}

/** `DD-MM-YYYY` → `YYYY-MM-DD` (fallback when the ISO date prop is absent). */
function isoFromDmy(dmy: string): string {
    const [d, m, y] = dmy.split("-");
    return y && m && d ? `${y}-${m}-${d}` : dmy;
}

/** Default currencies for the always-on summary block when the API
 *  returns no per-currency summary (kept in the required display order). */
const DEFAULT_SUMMARY_CURRENCIES = ["VND", "USD", "KRW"];

/** Build an all-zero summary row for a currency (used for the empty-data
 *  fallback). Real account rows are never fabricated — only the summary
 *  totals are shown as zero. */
function zeroSummaryRow(currencyLabel: string): DailyCashSummaryRow {
    return {
        currencyLabel,
        cash: "0",
        current: "0",
        savings: "0",
        timeDeposit: "0",
        loan: "0",
        available: "0",
    };
}

/** Summary-block ordering: VND → USD → KRW → everything else
 *  alphabetically. */
const CURRENCY_PRIORITY: Record<string, number> = { VND: 0, USD: 1, KRW: 2 };
function compareCurrency(a: string, b: string): number {
    const ka = (a ?? "").trim().toUpperCase();
    const kb = (b ?? "").trim().toUpperCase();
    const pa = CURRENCY_PRIORITY[ka] ?? 99;
    const pb = CURRENCY_PRIORITY[kb] ?? 99;
    if (pa !== pb) return pa - pb;
    return ka.localeCompare(kb);
}

/** Per-currency grand total for the summary heading — mirrors the legacy
 *  "<CCY> Total" line (rept_0009_001_osmc.ts:524,536), which sums
 *  Cash + Current + Savings + Time Deposit + Loan for that currency. Cash
 *  stays 0 in the refactor until the legacy cash source (cash_repy_mstr)
 *  is ported. Returns the raw numeric string for {@link formatAmount}. */
function currencyTotal(row: DailyCashSummaryRow): string {
    const n = (s: string) => Number.parseFloat(s || "0") || 0;
    const total =
        n(row.cash) + n(row.current) + n(row.savings) + n(row.timeDeposit) + n(row.loan ?? "0");
    return String(total);
}

/** Per-currency summary table — two columns (Current Accounts / Saving
 *  Accounts), matching the legacy VN view's visible summary columns. */
function SummaryTable({ row }: { row: DailyCashSummaryRow }) {
    const { t } = useTranslation();
    return (
        <table className="w-full min-w-[560px] table-fixed border-collapse">
            <colgroup>
                <col />
                <col />
            </colgroup>
            <TableHeader>
                <TableRow className="h-[var(--h-wb-table-head)] border-y border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell align="right" sortable={false} textSizeClass="text-wb-13">
                        {t("report.daily_cash.col.current")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false} textSizeClass="text-wb-13">
                        {t("report.daily_cash.col.savings")}
                    </TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0">
                    {/* Symbol included to mirror the legacy summary cells
                       (e.g. 10.123.605.216₫ / $1.391.673,99). */}
                    <SumCell>{formatAmount(row.current, row.currencyLabel, true)}</SumCell>
                    <SumCell>{formatAmount(row.savings, row.currencyLabel, true)}</SumCell>
                </TableRow>
            </TableBody>
        </table>
    );
}

function AccountLedger({
    rows,
    loading = false,
}: {
    rows: {
        id: string;
        bank: string;
        accountNo: string;
        currency: string;
        numDebits: number;
        debit: string;
        numCredits: number;
        credit: string;
        balance: string;
    }[];
    /** Sticky-wrapped in-flight flag. While true, an empty body shows the
     *  "Loading…" notice; the "No data" empty state appears only once the
     *  fetch has fully settled. */
    loading?: boolean;
}) {
    const { t } = useTranslation();
    return (
        <table className="w-full min-w-[960px] table-fixed border-collapse">
            <colgroup>
                <col className="w-[18%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
            </colgroup>
            <TableHeader>
                <TableRow className="h-[var(--h-wb-table-head)] border-y border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell sortable={false} textSizeClass="text-wb-13">{t("report.daily_cash.col.bank")}</TableHeaderCell>
                    <TableHeaderCell sortable={false} textSizeClass="text-wb-13">{t("report.daily_cash.col.account_no")}</TableHeaderCell>
                    <TableHeaderCell sortable={false} textSizeClass="text-wb-13">{t("report.daily_cash.col.currency")}</TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false} textSizeClass="text-wb-13">
                        {t("report.daily_cash.col.num_debits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false} textSizeClass="text-wb-13">
                        {t("report.daily_cash.col.debit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false} textSizeClass="text-wb-13">
                        {t("report.daily_cash.col.num_credits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false} textSizeClass="text-wb-13">
                        {t("report.daily_cash.col.credit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false} textSizeClass="text-wb-13">
                        {t("report.daily_cash.col.balance")}
                    </TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow
                        key={row.id}
                        className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                    >
                        <CellLeft>{row.bank}</CellLeft>
                        <CellLeft>{row.accountNo}</CellLeft>
                        <CellLeft>{row.currency}</CellLeft>
                        <CellRight>{row.numDebits}</CellRight>
                        <CellRight>{formatAmount(row.debit, row.currency, false)}</CellRight>
                        <CellRight>{row.numCredits}</CellRight>
                        <CellRight>{formatAmount(row.credit, row.currency, false)}</CellRight>
                        <CellRight strong>{formatAmount(row.balance, row.currency, false)}</CellRight>
                    </TableRow>
                ))}
                {rows.length === 0 && (
                    <TableRow className="h-[var(--h-wb-table-row)] border-b border-wb-table-border">
                        <TableCell
                            colSpan={8}
                            className="px-2.5 text-center text-wb-13 text-wb-muted"
                        >
                            {loading ? t("common.loading") : t("common.no_rows")}
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </table>
    );
}

function CellLeft({ children }: { children: React.ReactNode }) {
    return (
        <TableCell className="px-2.5 py-2.5 align-middle">
            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                {children}
            </span>
        </TableCell>
    );
}

function CellRight({
    children,
    strong = false,
}: {
    children: React.ReactNode;
    strong?: boolean;
}) {
    return (
        <TableCell className="px-2.5 py-2.5 text-right align-middle">
            <span
                className={cn(
                    "block truncate text-wb-13",
                    strong ? "font-semibold text-wb-ink" : "font-medium text-wb-ink",
                )}
            >
                {children}
            </span>
        </TableCell>
    );
}

function SumCell({ children }: { children: React.ReactNode }) {
    return (
        <TableCell className="px-2.5 py-2.5 text-right align-middle">
            <span className="text-wb-14 font-semibold text-wb-ink">{children}</span>
        </TableCell>
    );
}
