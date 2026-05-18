"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
import {
    ApiCallError,
    fetchExchangeRateBanks,
    fetchExchangeRateCurrencies,
    fetchExchangeRates,
} from "@/lib/api/banking";
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

const WOORI_BANK_CD = "11704020";

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

/** Fallback currency list — used while the API resolves or on error. */
const STATIC_CURRENCY_LIST = Object.keys(FLAG_MAP);

type DiffResult = { text: string; sign: "positive" | "negative" | "zero" | "na" };

function formatDiff(primaryVal: number | null | undefined, compareVal: number | null | undefined): DiffResult {
    if (primaryVal == null || compareVal == null || primaryVal === 0 || compareVal === 0) return { text: "-", sign: "na" };
    const diff = primaryVal - compareVal;
    if (diff === 0) return { text: "0.00", sign: "zero" };
    if (diff > 0)   return { text: formatExchangeRate(diff), sign: "positive" };
    return { text: `(${formatExchangeRate(Math.abs(diff))})`, sign: "negative" };
}

/**
 * Returns the "display currency" — the foreign currency shown as the row label.
 * Shinhan stores foreign currency in ccyCd (e.g. USD), local reference in refCcyCd.
 * Woori stores the local currency in ccyCd (always VND) and foreign in refCcyCd.
 */
function getDisplayCcy(row: ExchangeRateRow): string {
    return row.ccyCd === "VND" ? row.refCcyCd : row.ccyCd;
}

/** Translate a camelCase ExchangeRateRow into the display shape. */
function toDisplayRow(row: ExchangeRateRow): ExchangeRateDisplayRow {
    const displayCcy = getDisplayCcy(row);
    return {
        currency: displayCcy,
        flag:     FLAG_MAP[displayCcy] ?? "",
        cashBuy:  row.buyAmt === 0 || row.buyAmt == null ? "-" : formatExchangeRate(row.buyAmt),
        cashSell: row.sellAmt === 0 || row.sellAmt == null ? "-" : formatExchangeRate(row.sellAmt),
        ttBuy:    row.tranBuyAmt === 0 || row.tranBuyAmt == null ? "-" : formatExchangeRate(row.tranBuyAmt),
        ttSell:   row.tranSellAmt === 0 || row.tranSellAmt == null ? "-" : formatExchangeRate(row.tranSellAmt),
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
    // null = no filter (latest per currency); set when user explicitly picks a round
    const [seqNo, setSeqNo] = useState<string | null>(null);
    const [compareEnabled, setCompareEnabled] = useState(false);
    const [compareBankCd, setCompareBankCd] = useState<string>(STATIC_BANK_OPTIONS[1].bankCd);
    const [search, setSearch] = useState("");

    // Popover toggle states
    const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
    const [seqNoDropdownOpen, setSeqNoDropdownOpen] = useState(false);
    const [compareDropdownOpen, setCompareDropdownOpen] = useState(false);

    // All known currency codes — drives the full row list regardless of rate availability
    const { data: currenciesData } = useApiData(
        () => fetchExchangeRateCurrencies(),
        [],
    );
    const allCurrencies: string[] = currenciesData ?? STATIC_CURRENCY_LIST;

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

    const bankPopoverOptions = banks.map(b => ({ value: b.bankCd, label: b.bankNm }));

    // Compare data
    const [compareData, setCompareData] = useState<ExchangeRateListResult | null>(null);

    // Sync comparison bank when primary bank or available banks change.
    // Prefer a different bank; fall back to the same bank when only one has data.
    useEffect(() => {
        if (banks.length === 0) return;
        const otherBank = banks.find((b) => b.bankCd !== bankCd);
        setCompareBankCd(otherBank ? otherBank.bankCd : bankCd);
    }, [bankCd, banks]);

    // Primary exchange rate fetch
    const { data: apiData, error: apiError } = useApiData(
        () => fetchExchangeRates({
            refDate: refDate.replace(/-/g, ""),
            bankCd,
            seqNo: seqNo || undefined,
        }),
        [refDate, bankCd, seqNo],
    );

    const roundsData = apiData?.rounds;

    const roundPopoverOptions = useMemo(() => {
        if (!roundsData || roundsData.length === 0) {
            return bankCd === WOORI_BANK_CD 
                ? [] 
                : [{ value: "", label: t("payment.exchange_rate.last_time") }];
        }

        const getOrdinal = (n: number) => {
            const s = ["th", "st", "nd", "rd"];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        const formatTime = (time?: string | null) => {
            if (!time) return "";
            return `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`;
        };

        if (bankCd === WOORI_BANK_CD) {
            // Woori: HH:MM:SS [Nth], Reversed order, No "Last time"
            return [...roundsData]
                .reverse()
                .map((r, i, arr) => {
                    // Original index was roundsData.length - i
                    const originalIndex = roundsData.length - i;
                    return {
                        value: r.seqNo,
                        label: `${formatTime(r.lastUpdateTime)} [${getOrdinal(originalIndex)}]`,
                    };
                });
        } else {
            // Shinhan: "Last time" + "1st time"
            const options = [{ value: "", label: t("payment.exchange_rate.last_time") }];
            const apiOptions = roundsData.slice(0, 1).map((r, i) => ({
                value: r.seqNo,
                label: `${getOrdinal(i + 1)} time`,
            }));
            return [...options, ...apiOptions];
        }
    }, [roundsData, t, bankCd]);

    // Update seqNo if the current seqNo is not in the new roundsData.
    // We only reset if seqNo is NOT null (because null means "Last time") 
    // and it's not found in the current rounds list.
    useEffect(() => {
        if (roundsData && roundsData.length > 0 && seqNo !== null) {
            if (!roundsData.find(r => r.seqNo === seqNo)) {
                setSeqNo(roundsData[0].seqNo);
            }
        }
    }, [roundsData, seqNo]);

    // Surface API errors via the system error dialog
    useEffect(() => {
        if (!apiError) return;
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: t("payment.exchange_rate.error.load_failed"),
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiError]);

    // Secondary fetch — re-fires when refDate or compareBankCd changes.
    useEffect(() => {
        if (!compareEnabled || !compareBankCd) {
            setCompareData(null);
            return;
        }

        let canceled = false;
        fetchExchangeRates({
            refDate: refDate.replace(/-/g, ""),
            bankCd: compareBankCd,
        })
            .then((data) => {
                if (!canceled) setCompareData(data);
            })
            .catch(() => {
                if (!canceled) setCompareData(null);
            });

        return () => {
            canceled = true;
        };
    }, [refDate, compareBankCd, compareEnabled]);

    // Transform `ExchangeRateRow[]` arrays into Maps keyed by currency
    const primaryRawMap = useMemo(() => {
        const out = new Map<string, ExchangeRateRow>();
        for (const r of apiData?.rates ?? []) {
            out.set(getDisplayCcy(r), r);
        }
        return out;
    }, [apiData]);

    const compareRawMap = useMemo(() => {
        const out = new Map<string, ExchangeRateRow>();
        for (const r of compareData?.rates ?? []) {
            out.set(getDisplayCcy(r), r);
        }
        return out;
    }, [compareData]);

    // Build the full currency matrix from the complete currency list.
    // Currencies with no rate data for the selected date/bank show "-" for every rate cell.
    const matrixRows = useMemo(() => {
        // Merge: known currencies from the API + any extras the rate responses contain
        const ccySet = new Set<string>(allCurrencies);
        for (const key of primaryRawMap.keys()) ccySet.add(key);
        for (const key of compareRawMap.keys()) ccySet.add(key);

        return Array.from(ccySet)
            .sort((a, b) => a.localeCompare(b))
            .map((ccy) => {
                const primary = primaryRawMap.get(ccy);
                const compare = compareRawMap.get(ccy);
                return {
                    currency: ccy,
                    flag:     FLAG_MAP[ccy] ?? "",
                    bank1:    primary ? toDisplayRow(primary) : null,
                    bank2:    compare ? toDisplayRow(compare) : null,
                    raw1:     primary,
                    raw2:     compare,
                };
            });
    }, [allCurrencies, primaryRawMap, compareRawMap]);

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

    const shortenBankNm = (nm: string) => nm.replace(/\s*\(Vietnam\)/gi, " VN").trim();
    const bankNameShort        = shortenBankNm(bankName);
    const compareBankNameShort = shortenBankNm(compareBankName);

    // Resolve the display label for the currently selected notification round
    const seqNoLabel = bankCd === WOORI_BANK_CD 
        ? t("payment.exchange_rate.notification_round")
        : t("payment.exchange_rate.sequence_no");
    const seqNoDisplay = seqNo == null
        ? t("payment.exchange_rate.last_time")
        : roundPopoverOptions.find((o) => o.value === seqNo)?.label ?? t("payment.exchange_rate.last_time");

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
                {/* Choose bank — Custom popover dropdown */}
                <div className="flex items-center gap-2">
                    <span className="shrink-0 text-wb-14-tight font-medium text-wb-ntrl-8">
                        {t("payment.exchange_rate.choose_bank")}
                    </span>
                    <div className="relative w-[154px]">
                        <FilterDropdown
                            value={bankName}
                            onClick={() => setBankDropdownOpen((o) => !o)}
                            className="w-full"
                            prefixIcon={
                                activeBank?.logo ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={activeBank.logo} alt="" className="size-4 object-contain" />
                                ) : undefined
                            }
                        />
                        {bankDropdownOpen && (
                            <DropdownPopover
                                options={bankPopoverOptions}
                                selected={bankCd}
                                onSelect={(v) => { setBankCd(v); setBankDropdownOpen(false); }}
                                onClose={() => setBankDropdownOpen(false)}
                                className="w-[154px]"
                            />
                        )}
                    </div>
                </div>

                {/* Reference date — shared DateField (includes calendar popup) */}
                <DateField
                    value={refDate}
                    onChange={setRefDate}
                    ariaLabelKey="payment.exchange_rate.title"
                />

                {/* Sequence No. / Notification Round — functional dropdown */}
                <div className="flex items-center gap-2">
                    <span className="shrink-0 text-wb-14-tight font-medium text-wb-ntrl-8">
                        {seqNoLabel}
                    </span>
                    <div className="relative w-[150px]">
                        <FilterDropdown
                            value={seqNoDisplay}
                            onClick={() => setSeqNoDropdownOpen((o) => !o)}
                            className="w-full"
                        />
                        {seqNoDropdownOpen && (
                            <DropdownPopover
                                options={roundPopoverOptions}
                                selected={seqNo ?? ""}
                                onSelect={(v) => { setSeqNo(v || null); setSeqNoDropdownOpen(false); }}
                                onClose={() => setSeqNoDropdownOpen(false)}
                                className="w-[150px]"
                            />
                        )}
                    </div>
                </div>

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
                            "relative w-[154px] transition-opacity",
                            !compareEnabled && "pointer-events-none opacity-40",
                        )}
                    >
                        <FilterDropdown
                            value={compareBankName}
                            onClick={() => compareEnabled && setCompareDropdownOpen((o) => !o)}
                            className="w-full"
                            prefixIcon={
                                activeCompareBank?.logo ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={activeCompareBank.logo} alt="" className="size-4 object-contain" />
                                ) : undefined
                            }
                        />
                        {compareDropdownOpen && (
                            <DropdownPopover
                                options={bankPopoverOptions}
                                selected={compareBankCd}
                                onSelect={(newCompareCd) => {
                                    if (newCompareCd === bankCd) {
                                        setBankCd(compareBankCd);
                                    }
                                    setCompareBankCd(newCompareCd);
                                    setCompareDropdownOpen(false);
                                }}
                                onClose={() => setCompareDropdownOpen(false)}
                                className="w-[154px]"
                            />
                        )}
                    </div>
                </label>
            </FilterRow>

            {/* Currency-matrix table — Figma 38:13376 */}
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="custom-scrollbar min-h-0 flex-1 overflow-auto pb-3">
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
                                                className="px-2.5 py-2 text-right align-middle"
                                            >
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="whitespace-nowrap text-wb-14 font-semibold text-wb-dark">
                                                        {bankNameShort}
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
                                                className="px-2.5 py-2 text-right align-middle"
                                            >
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="whitespace-nowrap text-wb-14 font-semibold text-wb-dark">
                                                        {compareBankNameShort}
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
                                                className="px-2.5 py-2 text-right align-middle"
                                            >
                                                <div className="flex flex-col items-end gap-1">
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
                                                            {row.bank1 ? row.bank1[col.key] : "-"}
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
                                                            {row.bank2 ? row.bank2[col.key] : "-"}
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
                                                                    diff.sign === "zero"     && "bg-wb-status-approved-bg text-wb-status-approved-text",
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

                    </div>
                </div>
                {/* "Inquired on" timestamp — Figma 38:14116, fixed at bottom-right */}
                {inquiredOn && (
                    <p className="shrink-0 border-t border-wb-table-border px-2.5 py-2 text-right text-wb-13 font-medium text-wb-ntrl-6">
                        {t("payment.exchange_rate.inquired_on", { date: inquiredOn })}
                    </p>
                )}
            </div>
        </PageLayout>
    );
}

function DropdownPopover({
    options,
    selected,
    onSelect,
    onClose,
    className,
}: {
    options: { value: string; label: string; }[];
    selected: string | null;
    onSelect: (value: string) => void;
    onClose: () => void;
    className?: string;
}) {
    const ref = useRef<HTMLUListElement>(null);
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [onClose]);
    return (
        <ul
            ref={ref}
            role="listbox"
            className={cn(
                "custom-scrollbar-y absolute left-0 top-full z-20 mt-1 max-h-64 overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card",
                className || "w-[150px]",
            )}
        >
            {options.map((opt) => (
                <li
                    key={opt.value}
                    role="option"
                    aria-selected={selected === opt.value}
                    onClick={() => {
                        onSelect(opt.value);
                        onClose();
                    }}
                    className={cn(
                        "cursor-pointer truncate whitespace-nowrap px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                        selected === opt.value && "bg-wb-bg-active",
                    )}
                >
                    {opt.label}
                </li>
            ))}
        </ul>
    );
}
