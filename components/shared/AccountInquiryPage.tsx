"use client";

import { useState } from "react";

import FilterDropdown from "@/components/shared/FilterDropdown";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";

export type AccountInquiryRow = {
    id: string;
    bankName: string;
    bankType: "Current" | "Savings" | "Fixed";
    accountNo: string;
    nickname: string;
    balance: string;
    available: string;
    lastUpdate: string;
    error?: boolean;
    /** Override the default `VND • {bankType}` chip for FCY rows (e.g. "USD • Current"). */
    currencyLabel?: string;
};

const defaultRows: AccountInquiryRow[] = [
    {
        id: "1",
        bankName: "BIDV",
        bankType: "Current",
        accountNo: "0001-00000569-14",
        nickname: "VIETCOM 8210 - payment account",
        balance: "20.000.000",
        available: "20.000.000",
        lastUpdate: "40mn ago",
    },
    {
        id: "2",
        bankName: "WOORI BANK",
        bankType: "Fixed",
        accountNo: "0001-00000523-06",
        nickname: "VIETCOM 8210 - payment account",
        balance: "20.000.000",
        available: "20.000.000",
        lastUpdate: "40mn ago",
        error: true,
    },
    {
        id: "3",
        bankName: "HD BANK",
        bankType: "Savings",
        accountNo: "0001-00000569-14",
        nickname: "VIETCOM 8210 - payment account",
        balance: "20.000.000",
        available: "20.000.000",
        lastUpdate: "40mn ago",
    },
    {
        id: "4",
        bankName: "HD BANK",
        bankType: "Current",
        accountNo: "0001-00000569-14",
        nickname: "VIETCOM 8210 - payment account",
        balance: "20.000.000",
        available: "20.000.000",
        lastUpdate: "40mn ago",
        error: true,
    },
];

type AccountInquiryPageProps = {
    /** i18n key for the page title. Defaults to the VND variant. */
    titleKey?: string;
    /** i18n key for the summary card "TOTAL ACCOUNTS" label. */
    totalLabelKey?: string;
    /** Rows rendered in the table. Defaults to the VND mock set. */
    rows?: AccountInquiryRow[];
    /** Total accounts count for the pill. */
    totalAccounts?: string;
    /** Formatted summary figures (display only). */
    availableBalance?: string;
    balance?: string;
    /** Filter dropdown label — e.g. "All Banks", "All Currencies". */
    bankFilterLabel?: string;
};

export default function AccountInquiryPage({
    titleKey = "account_inquiry.title",
    totalLabelKey = "account_inquiry.total_label",
    rows = defaultRows,
    totalAccounts,
    availableBalance = "20.000.000₫",
    balance = "20.000.000₫",
    bankFilterLabel = "All Banks",
}: AccountInquiryPageProps = {}) {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const total = totalAccounts ?? String(rows.length);

    return (
        // Full-height flex column: main inherits viewport height from AppShell,
        // the table section flexes to fill, and pagination pins to the bottom.
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 md:px-6">
                {/* Page header */}
                <PageHeader title={t(titleKey)}>
                    <div className="flex flex-wrap items-center gap-6">
                        {/* Dashboard chip — §11 action-button standard */}
                        <button
                            type="button"
                            className="flex h-9 cursor-pointer items-center gap-2 rounded-md bg-white px-4 text-wb-14 font-medium text-brand shadow-wb-btn"
                        >
                            <span>{t("account_inquiry.dashboard")}</span>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/assets/common/ico-eye.svg"
                                alt=""
                                aria-hidden
                                className="size-5"
                            />
                        </button>

                        <PageActionButtons showList showPrint showExcel />

                        {/* Update — disabled state per Figma, §11 action-button standard */}
                        <button
                            type="button"
                            disabled
                            className="flex h-9 items-center gap-2 rounded-md bg-wb-ntrl-4 px-4 text-wb-14 font-medium text-white shadow-wb-outline"
                        >
                            <span>{t("account_inquiry.update")}</span>
                        </button>
                    </div>
                </PageHeader>

                {/* Summary card */}
                <div className="flex h-[var(--w-wb-summary-h)] w-full max-w-[var(--w-wb-summary)] flex-col justify-between rounded-md border border-wb-border-sidebar bg-wb-bg-card p-4 md:w-[var(--w-wb-summary)]">
                    <div className="flex items-center gap-1.5">
                        <p className="text-wb-12 font-bold text-brand">
                            {t(totalLabelKey)}
                        </p>
                        <span className="flex items-center rounded-full bg-brand-softer px-1.5 py-0.5">
                            <span className="text-wb-10 font-bold text-brand">
                                {t("account_inquiry.accounts_count", { count: total })}
                            </span>
                        </span>
                    </div>

                    <div className="flex w-full flex-col gap-2">
                        <div className="flex w-full items-center justify-between">
                            <span className="text-wb-16 font-medium text-black">
                                {t("account_inquiry.available_balance")}
                            </span>
                            <span className="text-wb-16 font-medium text-black">
                                {availableBalance}
                            </span>
                        </div>
                        <div className="flex w-full items-center justify-between">
                            <span className="text-wb-13 font-medium text-black opacity-50">
                                {t("account_inquiry.balance")}
                            </span>
                            <span className="text-wb-13 font-medium text-black opacity-50">
                                {balance}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Content area */}
                <div className="flex min-h-0 flex-1 flex-col gap-6">
                    {/* Filter row */}
                    <div className="flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <FilterDropdown
                                value={bankFilterLabel}
                                className="w-[var(--w-wb-filter-bank)]"
                            />
                            <div className="flex items-center">
                                {/* Figma 9183:14798 — inquiry date (single date chip, no chevron) */}
                                <div className="flex h-[var(--h-wb-filter-btn)] items-center gap-2 overflow-clip rounded-md bg-white p-2 shadow-wb-btn">
                                    <span className="whitespace-nowrap text-wb-14-tight font-medium text-wb-ntrl-8">
                                        25 Nov 2024
                                    </span>
                                </div>
                                {/* Figma 9183:14799 — calendar icon, no background */}
                                <button
                                    type="button"
                                    aria-label={t("common.open_calendar")}
                                    className="flex size-8 shrink-0 items-center justify-center"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="/assets/common/ico-calendar-outline.svg"
                                        alt=""
                                        aria-hidden
                                        className="size-4"
                                    />
                                </button>
                            </div>
                        </div>
                        <SearchInput value={search} onChange={setSearch} />
                    </div>

                    {/* Table section — Table's container is the single scroll ancestor
                       (both axes), so the sticky header anchors correctly while rows
                       scroll vertically. Columns stay at their fixed widths so cell
                       content is never squeezed; horizontal scroll kicks in when the
                       sum of column widths exceeds the visible container. */}
                    <Table
                        containerClassName="min-h-0 flex-1"
                        className="min-w-[var(--w-wb-table-min)] table-fixed"
                    >
                        <colgroup>
                            <col className="w-[var(--w-wb-col-checkbox)]" />
                            <col className="w-[var(--w-wb-col-bank)]" />
                            <col className="w-[var(--w-wb-col-nickname)]" />
                            <col className="w-[var(--w-wb-col-balance)]" />
                            <col className="w-[var(--w-wb-col-available)]" />
                            <col className="w-[var(--w-wb-col-last-update)]" />
                        </colgroup>
                        <TableHeader className="sticky top-0 z-10">
                            <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                                <TableHead className="px-2.5 text-left">
                                    <Checkbox className="size-[var(--size-wb-icon-sm)]" />
                                </TableHead>
                                <TableHeaderCell>{t("account_inquiry.col.bank")}</TableHeaderCell>
                                <TableHeaderCell>{t("account_inquiry.col.nickname")}</TableHeaderCell>
                                <TableHeaderCell align="right">{t("account_inquiry.col.balance")}</TableHeaderCell>
                                <TableHeaderCell align="right">{t("account_inquiry.col.available")}</TableHeaderCell>
                                <TableHeaderCell className="pl-4">
                                    {t("account_inquiry.col.last_update")}
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
                                    <TableCell className="py-2.5 pr-2.5">
                                        {/* Figma node 9183:14838 — flex-col, row 1 inline = icon + name + currency,
                                           row 2 = account number in muted hierarchy. */}
                                        <div className="flex flex-col items-start gap-1">
                                            <div className="flex items-center gap-1.5">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src="/assets/table/ico-building.svg"
                                                    alt=""
                                                    aria-hidden
                                                    className="size-[var(--size-wb-icon-sm)] shrink-0 opacity-50"
                                                />
                                                <span className="whitespace-nowrap text-wb-14 font-medium text-wb-ink">
                                                    {row.bankName}
                                                </span>
                                                <span className="whitespace-nowrap text-wb-14 font-medium text-wb-ntrl-6">
                                                    {row.currencyLabel ?? `VND • ${row.bankType}`}
                                                </span>
                                            </div>
                                            <span className="whitespace-nowrap text-wb-13 font-normal text-wb-muted">
                                                {row.accountNo}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2.5 pr-4">
                                        <span className="text-wb-14 font-medium text-wb-dark">
                                            {row.nickname}
                                        </span>
                                    </TableCell>
                                    <TableCell className="p-2.5 text-right">
                                        <span className="text-wb-14 font-medium text-wb-ink">
                                            {row.balance}
                                        </span>
                                    </TableCell>
                                    <TableCell className="p-2.5 text-right">
                                        <span className="text-wb-14 font-medium text-wb-ink">
                                            {row.available}
                                        </span>
                                    </TableCell>
                                    <TableCell className="py-2.5 pl-4">
                                        {row.error ? (
                                            <div className="flex flex-col">
                                                <span className="text-wb-14-loose font-medium text-wb-error">
                                                    {t("account_inquiry.error")}
                                                </span>
                                                <span className="text-wb-14 font-medium text-wb-muted">
                                                    {row.lastUpdate}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-wb-14-loose font-medium text-wb-muted">
                                                {row.lastUpdate}
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Pagination — compact 32px row, 12px bottom per Figma */}
                    <Pagination
                        page={1}
                        pageCount={3}
                        pageSize={10}
                        totalLabel="10 of 30"
                        className="shrink-0 pb-3"
                    />
                </div>
            </div>
        </div>
    );
}
