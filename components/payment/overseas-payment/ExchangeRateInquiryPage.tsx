"use client";

import { useEffect, useMemo, useState } from "react";

import DateField from "@/components/shared/DateField";
import FilterDropdown from "@/components/shared/FilterDropdown";
import FilterRow from "@/components/shared/FilterRow";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { useDialog } from "@/components/shared/dialog";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ApiCallError, fetchExchangeRateBanks, fetchExchangeRates } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import { formatExchangeRate } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { exchangeRateMatrixRows } from "./mockData";
import type {
    ExchangeRateBankOption,
    ExchangeRateDisplayRow,
    ExchangeRateListResult,
    ExchangeRateRow,
} from "./types";

type RateColKey = keyof Pick<ExchangeRateDisplayRow, "cashBuy" | "cashSell" | "ttBuy" | "ttSell">;

const RATE_COLS: { key: RateColKey; labelKey: string }[] = [
    { key: "cashBuy",  labelKey: "payment.exchange_rate.col.cash_buy"  },
    { key: "cashSell", labelKey: "payment.exchange_rate.col.cash_sell" },
    { key: "ttBuy",    labelKey: "payment.exchange_rate.col.tt_buy"    },
    { key: "ttSell",   labelKey: "payment.exchange_rate.col.tt_sell"   },
];

/** Static fallback bank list — used while the API resolves or on error. */
const STATIC_BANK_OPTIONS: ExchangeRateBankOption[] = [
    { bankCd: "11704088", bankNm: "Shinhan Bank" },
    { bankCd: "11704020", bankNm: "Woori Bank"   },
];

/** Emoji flag map — currency code → flag emoji. */
const FLAG_MAP: Record<string, string> = {
    USD: "🇺🇸", KRW: "🇰🇷", JPY: "🇯🇵", EUR: "🇪🇺",
    AUD: "🇦🇺", GBP: "🇬🇧", SGD: "🇸🇬", HKD: "🇭🇰",
    CAD: "🇨🇦", CHF: "🇨🇭", THB: "🇹🇭", NZD: "🇳🇿",
    VND: "🇻🇳", CNY: "🇨🇳", TWD: "🇹🇼", MYR: "🇲🇾",
};

/** Translate a camelCase ExchangeRateRow into the display shape. */
function toDisplayRow(row: ExchangeRateRow): ExchangeRateDisplayRow {
    return {
        currency: row.ccyCd,
        flag:     FLAG_MAP[row.ccyCd] ?? "🏳️",
        cashBuy:  formatExchangeRate(row.buyAmt),
        cashSell: formatExchangeRate(row.sellAmt),
        ttBuy:    formatExchangeRate(row.tranBuyAmt),
        ttSell:   formatExchangeRate(row.tranSellAmt),
    };
}

/**
 * Exchange Rate Inquiry — Figma 38:13376.
 *
 * Currency-matrix table (rows = currencies with emoji flags, columns = bank
 * rate types with two-line headers). No pagination, "Inquired on" timestamp
 * footer. Compare-with feature expands the table from 5 → 9 columns when a
 * second bank is selected.
 */
export default function ExchangeRateInquiryPage() {
    const { t } = useTranslation();
    const dialog = useDialog();

    // Filter state
    const [refDate, setRefDate] = useState<string>(
        () => new Date().toISOString().split("T")[0],
    );
    const [bankCd, setBankCd] = useState<string>(STATIC_BANK_OPTIONS[0].bankCd);
    const [compareEnabled, setCompareEnabled] = useState(false);
    const [compareBankCd, setCompareBankCd] = useState<string>(STATIC_BANK_OPTIONS[1].bankCd);
    const [search, setSearch] = useState("");

    // Compare data — kept separate from useApiData to avoid polluting the
    // main error state when compare is disabled or the secondary call fails.
    const [compareData, setCompareData] = useState<ExchangeRateListResult | null>(null);

    // Available banks for the dropdown selectors
    const { data: banksData } = useApiData(
        () => fetchExchangeRateBanks(),
        [],
    );
    const banks: ExchangeRateBankOption[] = banksData ?? STATIC_BANK_OPTIONS;

    // Primary exchange rate fetch — re-fires when refDate or bankCd changes
    const { data: apiData, error: apiError } = useApiData(
        () => fetchExchangeRates({ refDate: refDate.replace(/-/g, ""), bankCd }),
        [refDate, bankCd],
    );

    // Surface API errors via the system error dialog
    useEffect(() => {
        if (!apiError) return;
        const code = apiError instanceof ApiCallError ? apiError.code : "NETWORK";
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: t("payment.exchange_rate.error.load_failed"),
            errorCode: code,
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiError]);

    // Fetch compare bank data whenever compare is enabled or the inputs change
    useEffect(() => {
        if (!compareEnabled || !compareBankCd) {
            setCompareData(null);
            return;
        }
        fetchExchangeRates({ refDate: refDate.replace(/-/g, ""), bankCd: compareBankCd })
            .then(setCompareData)
            .catch(() => setCompareData(null));
    }, [compareEnabled, compareBankCd, refDate]);

    // Build display rows from live API data, falling back to static mock rows
    const matrixRows = useMemo<ExchangeRateDisplayRow[]>(() => {
        if (apiData && apiData.rates.length > 0) {
            return apiData.rates.map(toDisplayRow);
        }
        return exchangeRateMatrixRows;
    }, [apiData]);

    // Build O(1) lookup map for compare bank rates keyed by currency code
    const compareMap = useMemo(() => {
        if (!compareData || !compareEnabled) return new Map<string, ExchangeRateDisplayRow>();
        const map = new Map<string, ExchangeRateDisplayRow>();
        for (const row of compareData.rates) {
            const display = toDisplayRow(row);
            map.set(display.currency, display);
        }
        return map;
    }, [compareData, compareEnabled]);

    // "Inquired on" timestamp — sourced from the API response when available
    const inquiredOn = useMemo(() => {
        const first = apiData?.rates[0];
        if (first && first.lastUpdateDate && first.lastUpdateTime) {
            const d = first.lastUpdateDate;  // YYYYMMDD
            const tm = first.lastUpdateTime; // HHMMSS
            return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)} ${tm.slice(0, 2)}:${tm.slice(2, 4)}:${tm.slice(4, 6)}`;
        }
        return "25/04/2025 10:51:00";
    }, [apiData]);

    const filteredRows = search.trim()
        ? matrixRows.filter((r) =>
              r.currency.toLowerCase().includes(search.trim().toLowerCase()),
          )
        : matrixRows;

    const bankName        = banks.find((b) => b.bankCd === bankCd)?.bankNm        ?? bankCd;
    const compareBankName = banks.find((b) => b.bankCd === compareBankCd)?.bankNm ?? compareBankCd;

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
                {/* Choose bank — native <select> overlaid on FilterDropdown for real interaction */}
                <div className="flex items-center gap-2">
                    <span className="shrink-0 text-wb-14-tight font-medium text-wb-ntrl-8">
                        {t("payment.exchange_rate.choose_bank")}
                    </span>
                    <div className="relative w-[154px]">
                        <FilterDropdown value={bankName} className="w-full" />
                        <select
                            className="absolute inset-0 w-full cursor-pointer opacity-0"
                            value={bankCd}
                            onChange={(e) => setBankCd(e.target.value)}
                            aria-label={t("payment.exchange_rate.choose_bank")}
                        >
                            {banks.map((b) => (
                                <option key={b.bankCd} value={b.bankCd}>
                                    {b.bankNm}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Sequence No. — UI-only placeholder until endpoint is wired */}
                <div className="flex items-center gap-2">
                    <span className="shrink-0 text-wb-14-tight font-medium text-wb-ntrl-8">
                        {t("payment.exchange_rate.sequence_no")}
                    </span>
                    <FilterDropdown
                        value={t("payment.exchange_rate.last_time")}
                        className="w-[96px]"
                    />
                </div>

                {/* Reference date — shared DateField (includes calendar popup) */}
                <DateField
                    value={refDate}
                    onChange={setRefDate}
                    ariaLabelKey="payment.exchange_rate.title"
                />

                {/* Compare with — checkbox + secondary bank selector */}
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
                            "relative w-[130px] transition-opacity",
                            !compareEnabled && "pointer-events-none opacity-40",
                        )}
                    >
                        <FilterDropdown value={compareBankName} className="w-full" />
                        <select
                            className="absolute inset-0 w-full cursor-pointer opacity-0"
                            value={compareBankCd}
                            onChange={(e) => setCompareBankCd(e.target.value)}
                            aria-label={t("payment.exchange_rate.compare_with")}
                            tabIndex={compareEnabled ? undefined : -1}
                        >
                            {banks.map((b) => (
                                <option key={b.bankCd} value={b.bankCd}>
                                    {b.bankNm}
                                </option>
                            ))}
                        </select>
                    </div>
                </label>
            </FilterRow>

            {/* Currency-matrix table — Figma 38:13376 */}
            <div className="flex min-h-0 flex-1 flex-col pb-3">
                <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
                    <div className="flex min-h-full flex-col">
                        {/*
                         * Bare <table> (not the shadcn wrapper) so we own the
                         * scroll container — same pattern as ApprovalTable.
                         * TableHeader / TableRow / TableHead / TableBody / TableCell
                         * are the shared shadcn primitives.
                         */}
                        <table className="w-full table-fixed border-collapse">
                            <colgroup>
                                <col className="w-[var(--w-wb-er-currency)]" />
                                {RATE_COLS.map((c) => (
                                    <col key={`main-${c.key}`} className="w-[var(--w-wb-er-rate)]" />
                                ))}
                                {compareEnabled &&
                                    RATE_COLS.map((c) => (
                                        <col key={`cmp-${c.key}`} className="w-[var(--w-wb-er-rate)]" />
                                    ))}
                            </colgroup>

                            {/* ── thead — Approval Box baseline ── */}
                            <TableHeader className="sticky top-0 z-10">
                                <TableRow className="border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                                    <TableHeaderCell align="left">
                                        {t("payment.col.currency")}
                                    </TableHeaderCell>

                                    {/* Primary bank — two-line header per Figma 38:13376 */}
                                    {RATE_COLS.map((col) => (
                                        <TableHead
                                            key={`main-${col.key}`}
                                            className="px-2.5 py-2 text-center align-middle"
                                        >
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="whitespace-nowrap text-wb-13 font-medium leading-none text-wb-ntrl-6">
                                                    {bankName}
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

                                    {/* Compare bank columns — visible only when enabled */}
                                    {compareEnabled &&
                                        RATE_COLS.map((col) => (
                                            <TableHead
                                                key={`cmp-${col.key}`}
                                                className="px-2.5 py-2 text-center align-middle"
                                            >
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="whitespace-nowrap text-wb-13 font-medium leading-none text-wb-ntrl-6">
                                                        {compareBankName}
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
                                {filteredRows.map((row) => {
                                    const cmpRow = compareMap.get(row.currency);
                                    return (
                                        <TableRow
                                            key={row.currency}
                                            className="h-12 border-b border-wb-table-border last:border-b-0"
                                        >
                                            {/* Currency: emoji flag + ISO code */}
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

                                            {/* Primary bank rate cells */}
                                            {RATE_COLS.map((col) => (
                                                <TableCell
                                                    key={`main-${col.key}`}
                                                    className="px-2.5 py-2 text-right"
                                                >
                                                    <span className="block text-wb-13 font-medium text-wb-ink">
                                                        {row[col.key]}
                                                    </span>
                                                </TableCell>
                                            ))}

                                            {/* Compare bank rate cells */}
                                            {compareEnabled &&
                                                RATE_COLS.map((col) => (
                                                    <TableCell
                                                        key={`cmp-${col.key}`}
                                                        className="px-2.5 py-2 text-right"
                                                    >
                                                        <span className="block text-wb-13 font-medium text-wb-ink">
                                                            {cmpRow ? cmpRow[col.key] : "—"}
                                                        </span>
                                                    </TableCell>
                                                ))}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </table>

                        {/* "Inquired on" timestamp — Figma 38:14116, bottom-right */}
                        <p className="mt-auto shrink-0 px-2.5 pt-5 text-right text-wb-13 font-medium text-wb-ntrl-6">
                            {t("payment.exchange_rate.inquired_on", { date: inquiredOn })}
                        </p>
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}
