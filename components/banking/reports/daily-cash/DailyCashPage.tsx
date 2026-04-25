"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import ReportSection from "@/components/banking/reports/ReportSection";
import CurrencyScopeToggle, {
    type CurrencyScope,
} from "@/components/shared/CurrencyScopeToggle";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import {
    mockCashRows,
    mockCurrentAccountRows,
    mockSavingsAccountRows,
    mockSummaryRows,
} from "./mockData";

/**
 * Daily Cash report — Figma 96:40920 (empty) + 96:41152 (search result).
 *
 * The page mirrors the live JEX `rept_0009_001.act` flow: it boots in an
 * empty state showing only the filter row and a "Please click the Search
 * button." placeholder. Clicking Search flips local state and renders the
 * mock report (centered sub-title, as-of card, four sections).
 *
 * Sections:
 *   1. Summary — horizontal totals by category (Cash, Current, Savings,
 *      Time Deposits, Available)
 *   2. Cash — holdings by physical cash type
 *   3. Current Accounts — per-bank-account rollup with checkbox
 *   4. Savings Accounts — per-account breakdown
 */
export default function DailyCashPage() {
    const { t } = useTranslation();
    const [scope, setScope] = useState<CurrencyScope>("all");
    const [asOfDate] = useState("25-04-2024");
    /**
     * Local UI state — flips from empty placeholder to mock report once the
     * user clicks Search. Per CLAUDE.md §7b, this flow lives inside the
     * page; we never route to a separate URL for the result state.
     */
    const [hasSearched, setHasSearched] = useState(false);

    return (
        <PageLayout>
            <PageHeader title={t("report.daily_cash.title")} />

            <FilterRow
                right={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setHasSearched(true)}
                        className="h-[var(--h-wb-filter-btn)] gap-2 px-4 text-wb-14 text-brand"
                    >
                        <Search className="size-4" strokeWidth={2} />
                        {t("common.search")}
                    </Button>
                }
            >
                <span className="text-wb-14-tight font-medium text-black">
                    {t("report.as_of")}
                </span>
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

                    {/* As-of summary card — Figma 9183:20993. Mirrors the
                       live JEX page: shows the current date filter and
                       currency scope so the report reads as a printable
                       snapshot. */}
                    <div className="flex items-center rounded-md border border-wb-ntrl-4 bg-white p-4">
                        <p className="text-wb-14-tight font-medium text-black">
                            <span>{t("report.as_of")} </span>
                            <span className="text-wb-13 text-wb-ntrl-8">
                                {asOfDate}
                            </span>
                            <span> {t("report.currency_label")} </span>
                            <span className="text-wb-13 text-wb-ntrl-8">
                                {t(`report.scope.${scope}`)}
                            </span>
                        </p>
                    </div>

                    {/* 1. Summary section — horizontal totals */}
                    <ReportSection
                        title={t("report.daily_cash.summary_title", {
                            total: "12.640.653.139₫",
                        })}
                    >
                        <SummaryTable rows={mockSummaryRows} />
                    </ReportSection>

                    {/* 2. Cash section — physical cash holdings */}
                    <ReportSection title={t("report.daily_cash.section.cash")}>
                        <HoldingsTable rows={mockCashRows} />
                    </ReportSection>

                    {/* 3. Current Accounts section — per-account breakdown */}
                    <ReportSection
                        title={t("report.daily_cash.section.current_accounts")}
                    >
                        <AccountLedger rows={mockCurrentAccountRows} />
                    </ReportSection>

                    {/* 4. Savings Accounts */}
                    <ReportSection
                        title={t("report.daily_cash.section.savings_accounts")}
                    >
                        <AccountLedger rows={mockSavingsAccountRows} />
                    </ReportSection>
                </ReportLayout>
            ) : (
                /* Initial empty state (Figma 96:40920) — placeholder text
                   centered in the remaining viewport. Wrapper takes the
                   same `flex-1 min-h-0` slot a `<ReportLayout>` would, so
                   the page height contract from §7b is preserved. */
                <div className="flex min-h-0 flex-1 items-center justify-center pb-3">
                    <p className="text-wb-14 font-medium text-wb-ntrl-5">
                        {t("report.daily_cash.empty_message")}
                    </p>
                </div>
            )}
        </PageLayout>
    );
}

function SummaryTable({
    rows,
}: {
    rows: { currencyLabel: string; cash: string; current: string; savings: string; timeDeposit: string; available: string }[];
}) {
    const { t } = useTranslation();
    return (
        <table className="w-full min-w-[720px] table-fixed border-collapse">
            <TableHeader>
                <TableRow className="h-[var(--h-wb-table-head)] border-y border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.cash")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.current")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.savings")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.time_deposit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.available")}
                    </TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow
                        key={row.currencyLabel}
                        className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                    >
                        <SumCell>{row.cash}</SumCell>
                        <SumCell>{row.current}</SumCell>
                        <SumCell>{row.savings}</SumCell>
                        <SumCell>{row.timeDeposit}</SumCell>
                        <SumCell>{row.available}</SumCell>
                    </TableRow>
                ))}
            </TableBody>
        </table>
    );
}

function HoldingsTable({
    rows,
}: {
    rows: {
        id: string;
        type: string;
        currency: string;
        openingBalance: string;
        numDebits: number;
        debit: string;
        numCredits: number;
        credit: string;
        balance: string;
    }[];
}) {
    const { t } = useTranslation();
    return (
        <table className="w-full min-w-[900px] table-fixed border-collapse">
            <colgroup>
                <col className="w-[18%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
            </colgroup>
            <TableHeader>
                <TableRow className="h-[var(--h-wb-table-head)] border-y border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell>{t("report.daily_cash.col.type")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_cash.col.currency")}</TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.opening_balance")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.num_debits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.debit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.num_credits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.credit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
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
                        <CellLeft>{row.type}</CellLeft>
                        <CellLeft>{row.currency}</CellLeft>
                        <CellRight>{row.openingBalance}</CellRight>
                        <CellRight>{row.numDebits}</CellRight>
                        <CellRight>{row.debit}</CellRight>
                        <CellRight>{row.numCredits}</CellRight>
                        <CellRight>{row.credit}</CellRight>
                        <CellRight strong>{row.balance}</CellRight>
                    </TableRow>
                ))}
            </TableBody>
        </table>
    );
}

function AccountLedger({
    rows,
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
}) {
    const { t } = useTranslation();
    return (
        <table className="w-full min-w-[960px] table-fixed border-collapse">
            <colgroup>
                <col className="w-[var(--w-wb-col-checkbox)]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[8%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
            </colgroup>
            <TableHeader>
                <TableRow className="h-[var(--h-wb-table-head)] border-y border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <th className="bg-wb-bg-sidebar px-2.5 text-left align-middle">
                        <Checkbox className="size-[var(--size-wb-icon-sm)]" />
                    </th>
                    <TableHeaderCell>{t("report.daily_cash.col.bank")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_cash.col.account_no")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_cash.col.currency")}</TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.num_debits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.debit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.num_credits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_cash.col.credit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
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
                        <TableCell className="px-2.5">
                            <Checkbox className="size-[var(--size-wb-icon-sm)]" />
                        </TableCell>
                        <CellLeft>{row.bank}</CellLeft>
                        <CellLeft>{row.accountNo}</CellLeft>
                        <CellLeft>{row.currency}</CellLeft>
                        <CellRight>{row.numDebits}</CellRight>
                        <CellRight>{row.debit}</CellRight>
                        <CellRight>{row.numCredits}</CellRight>
                        <CellRight>{row.credit}</CellRight>
                        <CellRight strong>{row.balance}</CellRight>
                    </TableRow>
                ))}
                {rows.length === 0 && (
                    <TableRow className="h-[var(--h-wb-table-row)] border-b border-wb-table-border">
                        <TableCell
                            colSpan={9}
                            className="px-2.5 text-center text-wb-13 text-wb-muted"
                        >
                            {t("common.no_rows")}
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
