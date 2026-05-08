"use client";

import { useState } from "react";

import CalendarIconButton from "@/components/shared/CalendarIconButton";
import FilterDropdown from "@/components/shared/FilterDropdown";
import FilterRow from "@/components/shared/FilterRow";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { exchangeRateMatrixRows, type ExchangeRateMatrixRow } from "./mockData";

type RateColKey = keyof Pick<ExchangeRateMatrixRow, "cashBuy" | "cashSell" | "ttBuy" | "ttSell">;

const RATE_COLS: { key: RateColKey; labelKey: string }[] = [
    { key: "cashBuy",  labelKey: "payment.exchange_rate.col.cash_buy"  },
    { key: "cashSell", labelKey: "payment.exchange_rate.col.cash_sell" },
    { key: "ttBuy",    labelKey: "payment.exchange_rate.col.tt_buy"    },
    { key: "ttSell",   labelKey: "payment.exchange_rate.col.tt_sell"   },
];

const BANK_OPTIONS = ["Shinhan Bank", "BIDV", "Vietcombank", "Woori Bank", "HD Bank"];
const INQUIRY_DATETIME = "25/04/2025 10:51:00";

/**
 * Exchange Rate Inquiry — Figma 38:13376.
 *
 * Structural baseline: Approval Box (TableHeader / TableRow / TableHead /
 * TableBody / TableCell from @/components/ui/table, sticky header,
 * bg-wb-bg-sidebar, border-wb-table-border).
 *
 * Visual design: Figma 38:13376 — currency-matrix table (rows = currencies
 * with emoji flags, columns = bank rate types with two-line headers), no
 * pagination, "Inquired on" timestamp footer.
 */
export default function ExchangeRateInquiryPage() {
    const { t } = useTranslation();

    const [selectedBank, setSelectedBank] = useState("Shinhan Bank");
    const [compareEnabled, setCompareEnabled] = useState(false);
    const [search, setSearch] = useState("");

    const filteredRows = search.trim()
        ? exchangeRateMatrixRows.filter((r) =>
              r.currency.toLowerCase().includes(search.trim().toLowerCase()),
          )
        : exchangeRateMatrixRows;

    return (
        <PageLayout>
            <PageHeader title={t("payment.exchange_rate.title")}>
                <PageActionButtons showList />
            </PageHeader>

            <FilterRow
                right={
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder={t("common.search")}
                    />
                }
            >
                {/* Choose bank */}
                <div className="flex items-center gap-2">
                    <span className="shrink-0 text-wb-14-tight font-medium text-wb-ntrl-8">
                        {t("payment.exchange_rate.choose_bank")}
                    </span>
                    <FilterDropdown
                        value={selectedBank}
                        onClick={() =>
                            setSelectedBank(
                                BANK_OPTIONS[
                                    (BANK_OPTIONS.indexOf(selectedBank) + 1) %
                                        BANK_OPTIONS.length
                                ],
                            )
                        }
                        className="w-[154px]"
                    />
                </div>

                {/* Sequence No. */}
                <div className="flex items-center gap-2">
                    <span className="shrink-0 text-wb-14-tight font-medium text-wb-ntrl-8">
                        {t("payment.exchange_rate.sequence_no")}
                    </span>
                    <FilterDropdown
                        value={t("payment.exchange_rate.last_time")}
                        className="w-[96px]"
                    />
                </div>

                {/* Date + calendar trigger */}
                <div className="flex items-center gap-0.5">
                    <div className="flex h-[var(--h-wb-filter-btn)] items-center rounded-md bg-white px-2 shadow-wb-btn">
                        <span className="text-wb-14-tight font-medium text-wb-ntrl-8">
                            05-Jan-2025
                        </span>
                    </div>
                    <CalendarIconButton />
                </div>

                {/* Compare with checkbox + secondary bank */}
                <label className="flex cursor-pointer items-center gap-2">
                    <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-[var(--color-brand)]"
                        checked={compareEnabled}
                        onChange={(e) => setCompareEnabled(e.target.checked)}
                    />
                    <span className="shrink-0 text-wb-14-tight font-medium text-wb-ntrl-8">
                        {t("payment.exchange_rate.compare_with")}
                    </span>
                    <div
                        className={cn(
                            "transition-opacity",
                            !compareEnabled && "pointer-events-none opacity-40",
                        )}
                    >
                        <FilterDropdown value="Woori Bank" className="w-[130px]" />
                    </div>
                </label>
            </FilterRow>

            {/* Currency-matrix table — structural baseline: Approval Box */}
            <div className="flex min-h-0 flex-1 flex-col pb-3">
                <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
                    <div className="flex min-h-full flex-col">
                        {/*
                         * Raw <table> (not the shadcn <Table> wrapper) so we own
                         * the scroll container, matching the ApprovalTable pattern.
                         * TableHeader / TableRow / TableHead / TableBody / TableCell
                         * are the same shadcn primitives used by ApprovalTable.
                         */}
                        <table className="w-full table-fixed border-collapse">
                            <colgroup>
                                <col className="w-[var(--w-wb-er-currency)]" />
                                {RATE_COLS.map((c) => (
                                    <col key={c.key} className="w-[var(--w-wb-er-rate)]" />
                                ))}
                            </colgroup>

                            {/* ── thead — Approval Box baseline ── */}
                            <TableHeader className="sticky top-0 z-10">
                                <TableRow className="border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                                    {/*
                                     * "Currency" — single-line header via the shared
                                     * TableHeaderCell, identical pattern to ApprovalTable.
                                     */}
                                    <TableHeaderCell align="left">
                                        {t("payment.col.currency")}
                                    </TableHeaderCell>

                                    {/*
                                     * Rate columns — two-line header (Figma 38:13376):
                                     *   line 1: bank name   (text-wb-13 / medium / ntrl-6)
                                     *   line 2: rate type   (text-wb-14 / semibold / dark)
                                     * Uses TableHead directly (same primitive TableHeaderCell
                                     * calls internally) so we control the two-line layout.
                                     */}
                                    {RATE_COLS.map((col) => (
                                        <TableHead
                                            key={col.key}
                                            className="px-2.5 py-2 text-center align-middle"
                                        >
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="whitespace-nowrap text-wb-13 font-medium leading-none text-wb-ntrl-6">
                                                    {selectedBank}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <span className="whitespace-nowrap text-wb-14 font-semibold text-wb-dark">
                                                        {t(col.labelKey)}
                                                    </span>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src="/assets/table/ico-sort.svg"
                                                        alt=""
                                                        aria-hidden
                                                        className="h-3 w-2 shrink-0"
                                                    />
                                                </div>
                                            </div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>

                            {/* ── tbody — Approval Box baseline ── */}
                            <TableBody>
                                {filteredRows.map((row) => (
                                    <TableRow
                                        key={row.currency}
                                        className="h-12 border-b border-wb-table-border last:border-b-0"
                                    >
                                        {/* Currency cell: emoji flag + code */}
                                        <TableCell className="px-2.5 py-2">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="text-xl leading-none"
                                                    aria-hidden="true"
                                                >
                                                    {row.flag}
                                                </span>
                                                <span className="text-wb-13 font-medium text-wb-ink">
                                                    {row.currency}
                                                </span>
                                            </div>
                                        </TableCell>

                                        {/* Rate cells: right-aligned numbers */}
                                        {RATE_COLS.map((col) => (
                                            <TableCell
                                                key={col.key}
                                                className="px-2.5 py-2 text-right"
                                            >
                                                <span className="block text-wb-13 font-medium text-wb-ink">
                                                    {row[col.key]}
                                                </span>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </table>

                        {/* "Inquired on" timestamp — Figma 38:14116, bottom-right */}
                        <p className="mt-auto shrink-0 px-2.5 pt-5 text-right text-wb-13 font-medium text-wb-ntrl-6">
                            {t("payment.exchange_rate.inquired_on", { date: INQUIRY_DATETIME })}
                        </p>
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}
