"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import FilterDropdown from "@/components/shared/FilterDropdown";
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
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { mockLedgerGroups } from "./mockData";
import type { BankGroup } from "./types";

/**
 * Daily Financial (HS) report — HAENGSUNG variant, Figma 9183:18510.
 * Bank-grouped ledger with sub-total per account and a grand TOTAL row at
 * the bottom of each currency section. This is the customer-specific
 * (Haengsung Electronics Vietnam) variant; the CMC Daily Financial page
 * (`/banking/reports/daily-financial`) is the standard/default variant.
 *
 * Both variants share `<ReportLayout>` (CLAUDE.md §7b) — no pagination,
 * single continuous-scroll body. They cannot share a page component
 * because the data shape is fundamentally different.
 */
export default function DailyFinancialHsPage() {
    const { t } = useTranslation();
    const [asOfDate] = useState("08-09-2025");

    return (
        <PageLayout>
            {/* Title row (Figma 9183:18709): title left, list icon +
               Download Excel pinned top-right. */}
            <PageHeader title={t("report.daily_financial_hs.title")}>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-label={t("common.open_list")}
                        className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-list.svg"
                            alt=""
                            aria-hidden
                            className="size-5"
                        />
                    </button>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-[var(--h-wb-filter-btn)] gap-2 px-4 text-wb-14"
                    >
                        {/* Figma 9183:18722 ico_file (Button: Single → Download Excel)
                           extracted to /assets/common/ico-excel.svg. Do NOT swap in
                           a lucide / generic Excel glyph here — the Figma asset is
                           a solid green file with a white "X" and that visual
                           weight is part of the spec. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-excel.svg"
                            alt=""
                            aria-hidden
                            className="size-4"
                        />
                        {t("report.download_excel")}
                    </Button>
                </div>
            </PageHeader>

            {/* Filter row (legacy `rept_0017_001.act`): As-of date + bank
               dropdown + Search button — all on the left. No keyword
               SearchInput on this report (the legacy WeCMS HS page does
               not have one); the Search button just re-runs the report
               for the current filter values. */}
            <FilterRow>
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
                <FilterDropdown
                    value={t("report.filter.all_accounts")}
                    className="min-w-[200px]"
                />
                <Button
                    type="button"
                    variant="outline"
                    className="h-[var(--h-wb-filter-btn)] gap-2 px-4 text-wb-14 text-brand"
                >
                    <Search className="size-4" strokeWidth={2} />
                    {t("common.search")}
                </Button>
            </FilterRow>

            {/* Banking report layout (CLAUDE.md §7b) — continuous-scroll
               body, no pagination. The wide ledger lives inside its own
               horizontal-scroll wrapper (§7d) so headers keep their
               authored widths instead of being compressed. */}
            <ReportLayout>
                <div className="custom-scrollbar-x w-full overflow-x-auto">
                    <LedgerTable />
                </div>
            </ReportLayout>
        </PageLayout>
    );
}

function LedgerTable() {
    const { t } = useTranslation();
    /* Column widths sized so every header label (Figma 9183:18725) fits at
       `text-wb-14 font-semibold` + 16 px sort glyph + 20 px cell padding
       without overlapping the next cell. Sum of `<col>` widths = 1820 px,
       so `min-w-[1820px]` matches exactly — `table-fixed` will honour
       widths instead of compressing them, and the §7d wrapper around
       <LedgerTable> handles horizontal scroll. */
    return (
        <table className="w-full min-w-[1820px] table-fixed border-collapse">
            <colgroup>
                <col className="w-[160px]" />
                <col className="w-[90px]" />
                <col className="w-[130px]" />
                <col className="w-[130px]" />
                <col className="w-[200px]" />
                <col className="w-[200px]" />
                <col className="w-[180px]" />
                <col className="w-[150px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[220px]" />
            </colgroup>

            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell>{t("report.daily_financial_hs.col.bank")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_financial_hs.col.currency")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_financial_hs.col.receipt_code")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_financial_hs.col.payment_code")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_financial_hs.col.description_en")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_financial_hs.col.description_ko")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_financial_hs.col.counterparty")}</TableHeaderCell>
                    <TableHeaderCell align="right">{t("report.daily_financial_hs.col.before_balance")}</TableHeaderCell>
                    <TableHeaderCell align="right">{t("report.daily_financial_hs.col.receipt")}</TableHeaderCell>
                    <TableHeaderCell align="right">{t("report.daily_financial_hs.col.payment")}</TableHeaderCell>
                    <TableHeaderCell align="right">{t("report.daily_financial_hs.col.balance")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_financial_hs.col.memo")}</TableHeaderCell>
                </TableRow>
            </TableHeader>

            <TableBody>
                {mockLedgerGroups.map((group) => (
                    <BankGroupRows key={group.id} group={group} />
                ))}
            </TableBody>
        </table>
    );
}

function BankGroupRows({ group }: { group: BankGroup }) {
    const { t } = useTranslation();
    const rowCount = group.entries.length;
    return (
        <>
            {group.entries.map((entry, idx) => (
                <TableRow
                    key={entry.id}
                    className="h-[var(--h-wb-table-row)] border-b border-wb-table-border"
                >
                    {idx === 0 && (
                        <TableCell
                            rowSpan={rowCount}
                            className="border-r border-wb-table-border px-2.5 py-2.5 align-top"
                        >
                            <div className="flex flex-col gap-0.5">
                                <span className="text-wb-13 font-semibold text-wb-ink">
                                    {group.bankName}
                                </span>
                                {group.accentLabel && (
                                    <span className="text-wb-13 font-semibold text-wb-status-rejected-text">
                                        {group.accentLabel}
                                    </span>
                                )}
                                {group.subtitle && (
                                    <span className="text-wb-13 font-medium text-wb-muted">
                                        {group.subtitle}
                                    </span>
                                )}
                                <span className="text-wb-13 font-normal text-wb-muted">
                                    {group.accountNo}
                                </span>
                                {group.dueDate && (
                                    <span className="mt-1 text-wb-12 font-medium text-wb-status-rejected-text">
                                        {group.dueDate}
                                    </span>
                                )}
                            </div>
                        </TableCell>
                    )}
                    {idx === 0 && (
                        <TableCell
                            rowSpan={rowCount}
                            className="border-r border-wb-table-border px-2.5 py-2.5 align-top"
                        >
                            <span className="text-wb-13 font-medium text-wb-ink">
                                {group.currency}
                            </span>
                        </TableCell>
                    )}
                    {/* Empty cells render blank — never echo the column label
                       as a fallback. The earlier `placeholder(label)` helper
                       made every empty cell look like a search input box,
                       which is not the Figma spec for a static report. */}
                    <LedgerCell>{entry.receiptCode}</LedgerCell>
                    <LedgerCell>{entry.paymentCode}</LedgerCell>
                    <LedgerCell>{entry.descriptionEn}</LedgerCell>
                    <LedgerCell>{entry.descriptionKo}</LedgerCell>
                    <LedgerCell>{entry.counterparty}</LedgerCell>
                    <CellRight>{entry.beforeBalance || "-"}</CellRight>
                    <CellRight>{entry.receipt || "-"}</CellRight>
                    <CellRight>{entry.payment || "-"}</CellRight>
                    <CellRight>{entry.balance || "-"}</CellRight>
                    <LedgerCell>{entry.memo}</LedgerCell>
                </TableRow>
            ))}

            {/* Sub-total row */}
            <TableRow className="h-[var(--h-wb-table-row)] border-b border-wb-table-border bg-wb-status-progress-bg hover:bg-wb-status-progress-bg">
                <TableCell
                    colSpan={7}
                    className="px-2.5 py-3 text-right align-middle"
                >
                    <span className="text-wb-13 font-semibold text-wb-dark">
                        {t("report.daily_financial_hs.sub_total")}
                    </span>
                </TableCell>
                <CellRight strong>{group.subtotal.beforeBalance}</CellRight>
                <CellRight strong>{group.subtotal.receipt}</CellRight>
                <CellRight strong>{group.subtotal.payment}</CellRight>
                <CellRight strong>{group.subtotal.balance}</CellRight>
                <TableCell className="px-2.5" />
            </TableRow>

            {/* Currency-section TOTAL — only when this group closes the run */}
            {group.closesTotal && group.runningTotal && (
                <TableRow className="h-[var(--h-wb-table-row)] border-b border-wb-table-border bg-wb-status-approved-bg hover:bg-wb-status-approved-bg">
                    <TableCell
                        colSpan={7}
                        className="px-2.5 py-3 text-right align-middle"
                    >
                        <span className="text-wb-13 font-semibold text-wb-dark">
                            {t("report.daily_financial_hs.total")}
                        </span>
                    </TableCell>
                    <CellRight strong>{group.runningTotal.beforeBalance}</CellRight>
                    <CellRight strong>{group.runningTotal.receipt}</CellRight>
                    <CellRight strong>{group.runningTotal.payment}</CellRight>
                    <CellRight strong>{group.runningTotal.balance}</CellRight>
                    <TableCell className="px-2.5" />
                </TableRow>
            )}
        </>
    );
}

function LedgerCell({ children }: { children: React.ReactNode }) {
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
                    strong ? "font-semibold text-wb-dark" : "font-medium text-wb-ink",
                )}
            >
                {children}
            </span>
        </TableCell>
    );
}

