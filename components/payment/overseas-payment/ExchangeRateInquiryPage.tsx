"use client";

import { useEffect, useMemo, useState } from "react";

import DateField from "@/components/shared/DateField";
import FilterDropdown from "@/components/shared/FilterDropdown";
import FilterRow from "@/components/shared/FilterRow";
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

/** Maps display key to the raw numeric field on ExchangeRateRow for diff calculation. */
const RATE_COL_TO_RAW: Record<RateColKey, keyof Pick<ExchangeRateRow, "buyAmt" | "sellAmt" | "tranBuyAmt" | "tranSellAmt">> = {
    cashBuy:  "buyAmt",
    cashSell: "sellAmt",
    ttBuy:    "tranBuyAmt",
    ttSell:   "tranSellAmt",
};

/** Bank logo mapping */
const BANK_LOGO_MAP: Record<string, string> = {
    "11704088": "/assets/banking_VN/icon/bank logo Shinhan VN1.png",
    "11704020": "/assets/banking_VN/icon/bank logo Woori VN1.png",
};

/** Static fallback bank list — used while the API resolves or on error. */
const STATIC_BANK_OPTIONS: ExchangeRateBankOption[] = [
    { bankCd: "11704088", bankNm: "Shinhan Bank", logo: BANK_LOGO_MAP["11704088"] },
    { bankCd: "11704020", bankNm: "Woori Bank", logo: BANK_LOGO_MAP["11704020"]   },
];

// Shinhan Bank shows "Sequence No." label; all others show "Notification Round"
const SHINHAN_BANK_CD = "11704088";

/** SVG flag map — currency code → flag path. */
const FLAG_MAP: Record<string, string> = {
    USD: "/assets/flag/United-States.svg",
    KRW: "/assets/flag/South Korea.svg",
    JPY: "/assets/flag/Japan.svg",
    EUR: "/assets/flag/Euro.svg",
    AUD: "/assets/flag/Australia.svg",
    GBP: "/assets/flag/United-Kingdom.svg",
    SGD: "/assets/flag/Singapore.svg",
    HKD: "/assets/flag/Hong-Kong.svg",
    CAD: "/assets/flag/Canada.svg",
    CHF: "/assets/flag/Switzerland.svg",
    THB: "/assets/flag/Thailand.svg",
    NZD: "/assets/flag/New-Zealand.svg",
    VND: "/assets/flag/Vietnam.svg",
    CNY: "/assets/flag/China.svg",
};

/** The fixed list of currencies to show in the table, mirroring legacy FLAG_SVG loop. */
const CURRENCY_LIST = Object.keys(FLAG_MAP);

type DiffResult = { text: string; sign: "positive" | "negative" | "zero" | "na" };

function formatDiff(primaryVal: number | null | undefined, compareVal: number | null | undefined): DiffResult {
    if (primaryVal == null || compareVal == null || primaryVal === 0 || compareVal === 0) return { text: "—", sign: "na" };
    const diff = primaryVal - compareVal;
    if (diff === 0) return { text: formatExchangeRate(0), sign: "zero" };
    if (diff > 0)   return { text: formatExchangeRate(diff), sign: "positive" };
    return { text: `(${formatExchangeRate(Math.abs(diff))})`, sign: "negative" };
}

/** Translate a camelCase ExchangeRateRow into the display shape. */
function toDisplayRow(row: ExchangeRateRow): ExchangeRateDisplayRow {
    return {
        currency: row.ccyCd,
        flag:     FLAG_MAP[row.ccyCd] ?? "",
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
 * rate types). Normal view: 5 columns. Compare view: 13 columns with per-rate-
 * type interleaving — [Bank1 | Bank2 | Diff] repeated for each of 4 rate types.
 * Mirrors JEX exch_0001_001.
 */
export default function ExchangeRateInquiryPage() {
    const { t } = useTranslation();
    const dialog = useDialog();

    // Filter state
    const [refDate, setRefDate] = useState<string>(
        () => new Date().toISOString().split("T")[0],
    );
    const [bankCd, setBankCd] = useState<string>(STATIC_BANK_OPTIONS[0].bankCd);
    const [seqNo, setSeqNo] = useState<string>("2"); // "2" = Last time (Shinhan default)
    const [compareEnabled, setCompareEnabled] = useState(false);
    const [compareBankCd, setCompareBankCd] = useState<string>(STATIC_BANK_OPTIONS[1].bankCd);
    const [search, setSearch] = useState("");

    // Sync comparison bank when primary bank changes (legacy exch_0001_001 behavior)
    useEffect(() => {
        const otherBank = STATIC_BANK_OPTIONS.find((b) => b.bankCd !== bankCd);
        if (otherBank) {
            setCompareBankCd(otherBank.bankCd);
        }
    }, [bankCd]);

    // Compare data — kept separate from useApiData to avoid polluting the
    // main error state when compare is disabled or the secondary call fails.
    const [compareData, setCompareData] = useState<ExchangeRateListResult | null>(null);

    // Available banks for the dropdown selectors
    const { data: banksData } = useApiData(
        () => fetchExchangeRateBanks(),
        [],
    );
    const banks: ExchangeRateBankOption[] = useMemo(() => {
        const rawBanks = banksData ?? STATIC_BANK_OPTIONS;
        return rawBanks.map(b => ({
            ...b,
            logo: b.logo ?? BANK_LOGO_MAP[b.bankCd],
        }));
    }, [banksData]);

    // Primary exchange rate fetch — re-fires when refDate, bankCd, or seqNo changes
    const { data: apiData, error: apiError } = useApiData(
        () => fetchExchangeRates({ refDate: refDate.replace(/-/g, ""), bankCd, seqNo }),
        [refDate, bankCd, seqNo],
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
        fetchExchangeRates({ refDate: refDate.replace(/-/g, ""), bankCd: compareBankCd, seqNo })
            .then(setCompareData)
            .catch(() => setCompareData(null));
    }, [compareEnabled, compareBankCd, refDate, seqNo]);

    // Primary raw numeric lookup map — needed for diff calculation and formatting
    const primaryRawMap = useMemo(() => {
        const map = new Map<string, ExchangeRateRow>();
        if (apiData) {
            for (const row of apiData.rates) map.set(row.ccyCd, row);
        }
        return map;
    }, [apiData]);

    // Compare raw numeric lookup map
    const compareRawMap = useMemo(() => {
        const map = new Map<string, ExchangeRateRow>();
        if (compareData && compareEnabled) {
            for (const row of compareData.rates) map.set(row.ccyCd, row);
        }
        return map;
    }, [compareData, compareEnabled]);

    // Build unified matrix rows from the fixed CURRENCY_LIST.
    // This matches legacy exch_0001_001.ts behavior: it iterates over all known flags.
    const matrixRows = useMemo(() => {
        return CURRENCY_LIST.map((ccy) => {
            const primary = primaryRawMap.get(ccy);
            const compare = compareRawMap.get(ccy);

            // Display row for Bank 1
            const bank1Display = primary ? toDisplayRow(primary) : null;
            // Display row for Bank 2
            const bank2Display = compare ? toDisplayRow(compare) : null;

            return {
                currency: ccy,
                flag: FLAG_MAP[ccy] ?? "",
                bank1: bank1Display,
                bank2: bank2Display,
                raw1: primary,
                raw2: compare,
            };
        });
    }, [primaryRawMap, compareRawMap]);

    // "Inquired on" timestamp — sourced from the API response when available
    const inquiredOn = useMemo(() => {
        const first = apiData?.rates[0];
        if (first && first.lastUpdateDate && first.lastUpdateTime) {
            const d  = first.lastUpdateDate;  // YYYYMMDD
            const tm = first.lastUpdateTime;  // HHMMSS
            return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)} ${tm.slice(0, 2)}:${tm.slice(2, 4)}:${tm.slice(4, 6)}`;
        }
        return "";
    }, [apiData]);

    const filteredRows = search.trim()
        ? matrixRows.filter((r) =>
              r.currency.toLowerCase().includes(search.trim().toLowerCase()),
          )
        : matrixRows;

    const activeBank = banks.find((b) => b.bankCd === bankCd);
    const activeCompareBank = banks.find((b) => b.bankCd === compareBankCd);

    const bankName        = activeBank?.bankNm ?? bankCd;
    const compareBankName = activeCompareBank?.bankNm ?? compareBankCd;

    // Sequence No. label — "Sequence No." for Shinhan, "Notification Round" for others
    const seqNoLabel = bankCd === SHINHAN_BANK_CD
        ? t("payment.exchange_rate.sequence_no")
        : t("payment.exchange_rate.notification_round");

    const seqNoDisplay = seqNo === "1"
        ? t("payment.exchange_rate.first_time")
        : t("payment.exchange_rate.last_time");

    return (
        <PageLayout>
            <PageHeader title={t("payment.exchange_rate.title")} />

            <FilterRow
                right={
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder={t("common.search")}
                    />
                }
            >
                {/* Choose bank — native <select> overlaid on FilterDropdown */}
                <div className="flex items-center gap-2">
                    <span className="shrink-0 text-wb-14-tight font-medium text-wb-ntrl-8">
                        {t("payment.exchange_rate.choose_bank")}
                    </span>
                    <div className="relative w-[154px]">
                        <FilterDropdown
                            value={bankName}
                            className="w-full"
                            prefixIcon={
                                activeBank?.logo ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={activeBank.logo} alt="" className="size-4 object-contain" />
                                ) : undefined
                            }
                        />
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

                {/* Sequence No. / Notification Round — functional dropdown */}
                <div className="flex items-center gap-2">
                    <span className="shrink-0 text-wb-14-tight font-medium text-wb-ntrl-8">
                        {seqNoLabel}
                    </span>
                    <div className="relative w-[104px]">
                        <FilterDropdown value={seqNoDisplay} className="w-full" />
                        <select
                            className="absolute inset-0 w-full cursor-pointer opacity-0"
                            value={seqNo}
                            onChange={(e) => setSeqNo(e.target.value)}
                            aria-label={seqNoLabel}
                        >
                            <option value="2">{t("payment.exchange_rate.last_time")}</option>
                            <option value="1">{t("payment.exchange_rate.first_time")}</option>
                        </select>
                    </div>
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
                        <FilterDropdown
                            value={compareBankName}
                            className="w-full"
                            prefixIcon={
                                activeCompareBank?.logo ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={activeCompareBank.logo} alt="" className="size-4 object-contain" />
                                ) : undefined
                            }
                        />
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
                        <table className="w-full table-fixed border-collapse">
                            <colgroup>
                                <col className="w-[var(--w-wb-er-currency)]" />
                                {RATE_COLS.flatMap((c) => {
                                    const cols = [
                                        <col key={`main-${c.key}`} className="w-[var(--w-wb-er-rate)]" />,
                                    ];
                                    if (compareEnabled) {
                                        cols.push(
                                            <col key={`cmp-${c.key}`}  className="w-[var(--w-wb-er-rate)]" />,
                                            <col key={`diff-${c.key}`} className="w-[var(--w-wb-er-diff)]" />,
                                        );
                                    }
                                    return cols;
                                })}
                            </colgroup>

                            {/* ── thead ── */}
                            <TableHeader className="sticky top-0 z-10">
                                <TableRow className="border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                                    <TableHeaderCell align="left">
                                        {t("payment.col.currency")}
                                    </TableHeaderCell>

                                    {RATE_COLS.flatMap((col) => {
                                        const mainHeader = (
                                            <TableHead
                                                key={`main-${col.key}`}
                                                className="px-2.5 py-2 text-center align-middle"
                                            >
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="whitespace-nowrap text-wb-14 font-semibold text-wb-dark">
                                                        {bankName}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="whitespace-nowrap text-wb-13 font-medium leading-none text-wb-ntrl-6">
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
                                        );

                                        if (!compareEnabled) return [mainHeader];

                                        const cmpHeader = (
                                            <TableHead
                                                key={`cmp-${col.key}`}
                                                className="px-2.5 py-2 text-center align-middle"
                                            >
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="whitespace-nowrap text-wb-14 font-semibold text-wb-dark">
                                                        {compareBankName}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="whitespace-nowrap text-wb-13 font-medium leading-none text-wb-ntrl-6">
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
                                        );

                                        const diffHeader = (
                                            <TableHead
                                                key={`diff-${col.key}`}
                                                className="px-2.5 py-2 text-center align-middle"
                                            >
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="whitespace-nowrap text-wb-14 font-semibold text-wb-dark">
                                                        {t("payment.exchange_rate.col.diff")}
                                                    </span>
                                                    {/* spacer line to align with two-line rate headers */}
                                                    <span className="invisible text-wb-13 leading-none">-</span>
                                                </div>
                                            </TableHead>
                                        );

                                        return [mainHeader, cmpHeader, diffHeader];
                                    })}
                                </TableRow>
                            </TableHeader>

                            {/* ── tbody ── */}
                            <TableBody>
                                {filteredRows.map((row) => {
                                    return (
                                        <TableRow
                                            key={row.currency}
                                            className="h-12 border-b border-wb-table-border last:border-b-0"
                                        >
                                            {/* Currency: flag + ISO code */}
                                            <TableCell className="px-2.5 py-2">
                                                <div className="flex items-center gap-2">
                                                    {row.flag ? (
                                                        <figure className="mb-0 flex shrink-0 items-center justify-center overflow-hidden">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img width="28" height="28" src={row.flag} alt={`${row.currency} Flag`} className="object-cover" />
                                                        </figure>
                                                    ) : (
                                                        <span className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-wb-ntrl-2 text-wb-11 font-medium text-wb-ntrl-6">
                                                            {row.currency.slice(0, 2)}
                                                        </span>
                                                    )}
                                                    <span className="text-wb-13 font-medium text-wb-ink">
                                                        {row.currency}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            {/*
                                             * Per rate type: [Bank1 cell] [Bank2 cell?] [Diff cell?]
                                             */}
                                            {RATE_COLS.flatMap((col) => {
                                                const rawField = RATE_COL_TO_RAW[col.key];

                                                const primaryCell = (
                                                    <TableCell
                                                        key={`main-${col.key}`}
                                                        className="px-2.5 py-2 text-right"
                                                    >
                                                        <span className="block text-wb-13 font-medium text-wb-ink">
                                                            {row.bank1 ? row.bank1[col.key] : "—"}
                                                        </span>
                                                    </TableCell>
                                                );

                                                if (!compareEnabled) return [primaryCell];

                                                const cmpCell = (
                                                    <TableCell
                                                        key={`cmp-${col.key}`}
                                                        className="px-2.5 py-2 text-right"
                                                    >
                                                        <span className="block text-wb-13 font-medium text-wb-ink">
                                                            {row.bank2 ? row.bank2[col.key] : "—"}
                                                        </span>
                                                    </TableCell>
                                                );

                                                const diff = formatDiff(
                                                    row.raw1?.[rawField],
                                                    row.raw2?.[rawField],
                                                );

                                                const diffCell = (
                                                    <TableCell
                                                        key={`diff-${col.key}`}
                                                        className="px-2.5 py-2 text-right"
                                                    >
                                                        <div className="flex justify-end">
                                                            <span
                                                                className={cn(
                                                                    "inline-flex min-w-[70px] justify-center rounded-full px-2.5 py-0.5 text-wb-13 font-semibold",
                                                                    diff.sign === "positive" && "bg-wb-status-approved-bg text-wb-status-approved-text",
                                                                    diff.sign === "negative" && "bg-wb-status-rejected-bg text-wb-status-rejected-text",
                                                                    diff.sign === "zero"     && "bg-wb-status-draft-bg text-wb-status-draft-text",
                                                                    diff.sign === "na"       && "text-wb-ntrl-6",
                                                                )}
                                                            >
                                                                {diff.text}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                );

                                                return [primaryCell, cmpCell, diffCell];
                                            })}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </table>

                        {/* "Inquired on" timestamp — Figma 38:14116, bottom-right */}
                        {inquiredOn && (
                            <p className="mt-auto shrink-0 px-2.5 pt-5 text-right text-wb-13 font-medium text-wb-ntrl-6">
                                {t("payment.exchange_rate.inquired_on", { date: inquiredOn })}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}
