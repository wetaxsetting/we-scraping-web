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
import { Checkbox } from "@/components/ui/checkbox";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { CurrentAccountRow, FinancialStatus } from "./types";

/**
 * Daily Financial (CMC) report — Figma 96:41637.
 *
 * Empty state mirrors the live JEX `rept_0015_001.act` flow: only the
 * filter row + a centred placeholder are visible until the user clicks
 * Search. Per CLAUDE.md §7b the Search trigger is a Button (not a
 * SearchInput textbox) — the Figma textbox conflicts with the §7b
 * empty-state convention so we follow CLAUDE.md (the Figma is structure
 * reference only).
 *
 * Search-result state renders the live snapshot per currency:
 *   - Financial Status header (currency total + current/saving split)
 *   - Current Accounts ledger with debit / credit / internal-transfer
 *     counters and balance
 *
 * No pagination — report pages route through `<ReportLayout>` (§7b).
 *
 * The HAENGSUNG bank-grouped ledger variant lives at
 * `/banking/reports/daily-financial-hs` — see CLAUDE.md "Banking Report
 * Sidebar Variants" for why these are separate pages.
 */
type DailyFinancialPageProps = {
    /** API financial-status header rows. Empty default — Sprint 1 stabilization
     *  removed the mock seed; API is the single source of truth. */
    financialStatus?: FinancialStatus[];
    /** API current-account ledger rows. Empty default while loading. */
    currentAccounts?: CurrentAccountRow[];
};

export default function DailyFinancialPage({
    financialStatus,
    currentAccounts,
}: DailyFinancialPageProps = {}) {
    const { t } = useTranslation();
    const [scope, setScope] = useState<CurrencyScope>("all");
    const [asOfDate] = useState("25-04-2026");
    const [showNickname, setShowNickname] = useState(true);
    const [activeOnly, setActiveOnly] = useState(false);
    const [internalTransfers, setInternalTransfers] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const sourceStatus = financialStatus ?? [];
    const sourceAccounts = currentAccounts ?? [];

    const visibleStatus =
        scope === "all"
            ? sourceStatus
            : sourceStatus.filter((s) =>
                  scope === "vnd" ? s.currency === "VND" : s.currency !== "VND",
              );

    const visibleAccounts =
        scope === "all"
            ? sourceAccounts
            : sourceAccounts.filter((row) =>
                  scope === "vnd" ? row.currency === "VND" : row.currency !== "VND",
              );

    return (
        <PageLayout>
            <PageHeader title={t("report.daily_financial.title")}>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        aria-label={t("common.print")}
                        className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-print.svg"
                            alt=""
                            aria-hidden
                            className="size-5"
                        />
                    </button>
                    <button
                        type="button"
                        aria-label={t("common.export_excel")}
                        className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-excel.svg"
                            alt=""
                            aria-hidden
                            className="size-5"
                        />
                    </button>
                </div>
            </PageHeader>

            <FilterRow
                right={
                    <div className="flex flex-wrap items-center gap-4">
                        <FilterCheckbox
                            checked={showNickname}
                            onChange={setShowNickname}
                            label={t("report.daily_financial.opt.nickname")}
                        />
                        <FilterCheckbox
                            checked={activeOnly}
                            onChange={setActiveOnly}
                            label={t("report.daily_financial.opt.active_only")}
                        />
                        <FilterCheckbox
                            checked={internalTransfers}
                            onChange={setInternalTransfers}
                            label={t("report.daily_financial.opt.internal_transfers")}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setHasSearched(true)}
                            className="h-[var(--h-wb-filter-btn)] gap-2 px-4 text-wb-14 text-brand"
                        >
                            <Search className="size-4" strokeWidth={2} />
                            {t("common.search")}
                        </Button>
                    </div>
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
                        all: t("report.daily_financial.scope.all"),
                        vnd: t("report.scope.vnd"),
                        fcy: t("report.scope.fcy"),
                    }}
                />
            </FilterRow>

            {hasSearched ? (
                /* Banking report layout (CLAUDE.md §7b) — single
                   continuous-scroll body, no pagination. `sectioned`
                   stacks the as-of card + per-currency status blocks +
                   the Current Accounts ledger inside one scroll context. */
                <ReportLayout sectioned>
                    {/* Centered report sub-title */}
                    <h2 className="text-center text-wb-18 font-semibold tracking-wb-tight text-black">
                        {t("report.daily_financial.title")}
                    </h2>

                    {/* As-of summary card */}
                    <div className="flex items-center rounded-md border border-wb-ntrl-4 bg-white p-4">
                        <p className="text-wb-14-tight font-medium text-black">
                            <span>{t("report.as_of")} </span>
                            <span className="text-wb-13 text-wb-ntrl-8">
                                {asOfDate}
                            </span>
                            <span> {t("report.currency_label")} </span>
                            <span className="text-wb-13 text-wb-ntrl-8">
                                {t(`report.daily_financial.scope.${scope}`)}
                            </span>
                        </p>
                    </div>

                    {/* Per-currency Financial Status blocks — full
                       content width per Figma 96:41637 / live JEX
                       `rept_0015_001.act`. The 2-column status table
                       stretches with the section so "Saving Accounts"
                       pins to the right edge of the page, matching the
                       Current Accounts ledger below.

                       Width parity is enforced by §7d: the ledger's
                       horizontal scroll lives inside its own wrapper
                       below, so this section is never pulled wider
                       than the viewport content area. */}
                    {visibleStatus.map((status) => (
                        <ReportSection
                            key={status.currency}
                            title={t("report.daily_financial.status_title", {
                                currency: status.currency,
                                total: status.total,
                            })}
                        >
                            <FinancialStatusTable status={status} />
                        </ReportSection>
                    ))}

                    {/* Current Accounts ledger — wide report table.
                       Wrapped in its own horizontal-scroll container per
                       CLAUDE.md §7d so the wide ledger pans horizontally
                       in place, instead of forcing the whole report body
                       (status cards, as-of card, page title) to scroll
                       sideways with it. */}
                    <ReportSection
                        title={t("report.daily_financial.section.current_accounts")}
                    >
                        <div className="custom-scrollbar-x w-full overflow-x-auto">
                            <CurrentAccountsTable
                                rows={visibleAccounts}
                                showNickname={showNickname}
                            />
                        </div>
                    </ReportSection>
                </ReportLayout>
            ) : (
                /* Initial empty state per Figma 96:41637 — placeholder
                   centered in the remaining viewport. Wrapper takes the
                   `flex-1 min-h-0` slot a `<ReportLayout>` would, so the
                   §7b height contract is preserved. */
                <div className="flex min-h-0 flex-1 items-center justify-center pb-3">
                    <p className="text-wb-13 font-medium text-black">
                        {t("report.daily_financial.empty_message")}
                    </p>
                </div>
            )}
        </PageLayout>
    );
}

function FilterCheckbox({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
                checked={checked}
                onCheckedChange={(v) => onChange(v === true)}
                className="size-[18px]"
            />
            <span className="text-wb-14-tight font-medium text-wb-ntrl-8">
                {label}
            </span>
        </label>
    );
}

function FinancialStatusTable({ status }: { status: FinancialStatus }) {
    const { t } = useTranslation();
    return (
        <table className="w-full min-w-[560px] table-fixed border-collapse">
            <colgroup>
                <col />
                <col />
            </colgroup>
            <TableHeader>
                <TableRow className="h-[var(--h-wb-table-head)] border-y border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.current_accounts")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.saving_accounts")}
                    </TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow className="h-[var(--h-wb-table-row)]">
                    <SumCell>{status.currentAccounts}</SumCell>
                    <SumCell>{status.savingAccounts}</SumCell>
                </TableRow>
            </TableBody>
        </table>
    );
}

function CurrentAccountsTable({
    rows,
    showNickname,
}: {
    rows: CurrentAccountRow[];
    showNickname: boolean;
}) {
    const { t } = useTranslation();
    /* Column widths sized so every header label fits at
       `text-wb-14 font-semibold` + the 16px sort glyph + 20px cell padding
       without truncation. Sum (with nickname) = 1940px; the table's
       `min-w` matches so `table-fixed` preserves widths exactly and
       horizontal scroll engages inside the wrapper. */
    return (
        <table className="w-full min-w-[1940px] table-fixed border-collapse">
            <colgroup>
                <col className="w-[110px]" />
                <col className="w-[150px]" />
                {showNickname && <col className="w-[180px]" />}
                <col className="w-[100px]" />
                <col className="w-[140px]" />
                <col className="w-[130px]" />
                <col className="w-[200px]" />
                <col className="w-[150px]" />
                <col className="w-[140px]" />
                <col className="w-[130px]" />
                <col className="w-[200px]" />
                <col className="w-[150px]" />
                <col className="w-[160px]" />
            </colgroup>
            <TableHeader>
                <TableRow className="h-[var(--h-wb-table-head)] border-y border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell>{t("report.daily_financial.col.bank")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_financial.col.account_no")}</TableHeaderCell>
                    {showNickname && (
                        <TableHeaderCell>
                            {t("report.daily_financial.col.account_nickname")}
                        </TableHeaderCell>
                    )}
                    <TableHeaderCell>
                        {t("report.daily_financial.col.currency")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.num_debits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.debit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.num_internal_debits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.internal_debit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.num_credits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.credit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.num_internal_credits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.internal_credit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.balance")}
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
                        {showNickname && <CellLeft>{row.accountNickname}</CellLeft>}
                        <CellLeft>{row.currency}</CellLeft>
                        <CellRight>{row.numDebits}</CellRight>
                        <CellRight>{row.debit}</CellRight>
                        <CellRight>{row.numInternalDebits}</CellRight>
                        <CellRight>{row.internalDebit}</CellRight>
                        <CellRight>{row.numCredits}</CellRight>
                        <CellRight>{row.credit}</CellRight>
                        <CellRight>{row.numInternalCredits}</CellRight>
                        <CellRight>{row.internalCredit}</CellRight>
                        <CellRight strong>{row.balance}</CellRight>
                    </TableRow>
                ))}
                {rows.length === 0 && (
                    <TableRow className="h-[var(--h-wb-table-row)] border-b border-wb-table-border">
                        <TableCell
                            colSpan={showNickname ? 13 : 12}
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
                    strong
                        ? "font-semibold text-wb-ink"
                        : "font-medium text-wb-ink",
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
