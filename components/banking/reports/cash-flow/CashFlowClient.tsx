"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchAccounts, fetchCashFlow, fetchExchangeRates } from "@/lib/api/banking";
import type { ApiCashFlowReport } from "@/lib/types/api";
import { mapCashFlowReport } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { exportExcel } from "@/lib/excel";
import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { SCREEN_IDS, DEFAULT_AREA_ID } from "@/lib/viewSettingScreens";
import { useTranslation } from "@/lib/i18n";

import CashFlowPage, {
    defaultCashFlowFilters,
    type CashFlowFilters,
} from "./CashFlowPage";
import type { BankFilterOption } from "@/components/shared/BankFilterPopover";
import { MONTH_KEYS } from "./types";

/** Shinhan Bank — the rate-lookup bank is hardcoded in legacy
 *  `cash_0001_001.ts:249` (`let bankCd = '11704088'; //shinhan bank`).
 *  Pinned here too so the seed never follows the bank filter or a
 *  changed backend default. */
const LEGACY_RATE_BANK_CD = "11704088";

/**
 * Cash Flow client wrapper — owns filter state and orchestrates two
 * data sources:
 *
 * 1. **Bank account list** ({@link fetchAccounts}) — loaded once on
 *    mount, feeds the "All Banks" filter popover with `(bankCd, acctNo)`
 *    options.
 * 2. **Cash Flow report** ({@link fetchCashFlow}) — refetched whenever
 *    the user clicks Search. Auto-fires once on mount as soon as the
 *    exchange-rate seed settles, so the first request already carries
 *    the DB rates (mirrors legacy `cash_0001_001`, which runs
 *    `fn_getExchRate` before the delayed first `fn_loadData`).
 *
 * Excel export goes through the shared `exportExcel` helper directly
 * (not `useExcelExport`) because the report page does not adopt the
 * View Setting popover — the seed in V124 supplies the persisted
 * visibility set that `ExcelExportService.load(...)` requires.
 */
export default function CashFlowClient() {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [filters, setFilters] = useState<CashFlowFilters>(defaultCashFlowFilters);
    // Search button bumps this to refetch with current filters.
    const [searchKey, setSearchKey] = useState(0);
    // The first report load waits for the exchange-rate seed to settle —
    // legacy sequencing (`fn_getExchRate` before the delayed first
    // `fn_loadData`). Flips true whether the seed succeeded or failed.
    const [ratesReady, setRatesReady] = useState(false);
    // DB-seeded rates, kept independent of the user-editable filter state
    // so a cleared input falls back to the DB rate at search time (legacy
    // `fn_loadData` `cash_0001_001.ts:329-333`).
    const seededRatesRef = useRef<{ usd: string | null; krw: string | null }>({
        usd: null,
        krw: null,
    });

    // Report load — fires once the rate seed settles, refires on Search.
    const loader = useCallback(
        (): Promise<ApiCashFlowReport | null> => {
            if (!ratesReady) return Promise.resolve(null);
            return fetchCashFlow({
                year: filters.year,
                // No quarter — the report is always full-year; the quarter
                // selector only hides month columns client-side (legacy
                // parity, gap D-1 / G5, PO decision 2026-06-04).
                baseCurrency: filters.baseCurrency,
                usdRate: filters.usdRate || seededRatesRef.current.usd,
                krwRate: filters.krwRate || seededRatesRef.current.krw,
                bankFilters: filters.bankFilters.map((b) => ({
                    bankCd: b.bankCd,
                    accountNo: b.acctNo,
                })),
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ratesReady, searchKey],
    );

    const { data, loading } = useApiData(loader, [ratesReady, searchKey]);

    const report = useMemo(() => (data ? mapCashFlowReport(data) : undefined), [data]);

    // Bank account list — loaded once on mount. The filter starts on
    // "All Banks" (empty `bankFilters` array); the user opts in to a
    // specific account via the popover. Matches the legacy default
    // dropdown label shown on page load.
    const [bankOptions, setBankOptions] = useState<BankFilterOption[]>([]);
    const [bankOptionsLoading, setBankOptionsLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetchAccounts();
                if (cancelled) return;
                const opts: BankFilterOption[] = (res.accounts ?? []).map((a) => ({
                    bankCd: a.bank_cd,
                    bankNm: a.bank_nm,
                    acctNo: a.acct_no,
                }));
                setBankOptions(opts);
            } catch {
                // Non-fatal — empty list is acceptable, the popover degrades to "All Banks" only.
                if (!cancelled) setBankOptions([]);
            } finally {
                if (!cancelled) setBankOptionsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Live exchange rates — seed `filters.usdRate` / `filters.krwRate`
    // from the latest BANK_EXCH_RATE_INFM row on mount, mirroring legacy
    // `cash_0001_001.ts fn_getExchRate` (Shinhan hardcoded at `:249`,
    // once per page view — currency / year / bank / Search never refetch).
    //
    // The endpoint returns VND-base rows: `ccy_cd = 'VND'` with the
    // foreign currency in `ref_ccy_cd` — so the foreign code must be
    // resolved the same way ExchangeRateInquiryPage's displayCurrency
    // helper does. Legacy reads TRAN_SELL_AMT (transfer sell) ONLY —
    // never SELL_AMT (spot sell; 26455 vs 26465 on 2026-07-02, per
    // Sonny's 2026-07-02 directive). Falls back silently to the empty
    // defaults if the endpoint errors or has no USD/KRW row.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetchExchangeRates({ bankCd: LEGACY_RATE_BANK_CD });
                if (cancelled) return;
                const foreignCcy = (r: { ccyCd: string; refCcyCd: string }) =>
                    r.ccyCd === "VND" ? r.refCcyCd : r.ccyCd;
                const usdRow = res.rates?.find((r) => foreignCcy(r) === "USD");
                const krwRow = res.rates?.find((r) => foreignCcy(r) === "KRW");
                const usdRate = usdRow?.tranSellAmt;
                const krwRate = krwRow?.tranSellAmt;
                seededRatesRef.current = {
                    usd: usdRate != null ? String(usdRate) : null,
                    krw: krwRate != null ? String(krwRate) : null,
                };
                setFilters((prev) => {
                    let next = prev;
                    if (usdRate != null) {
                        next = { ...next, usdRate: String(usdRate) };
                    }
                    if (krwRate != null) {
                        next = { ...next, krwRate: String(krwRate) };
                    }
                    return next;
                });
            } catch {
                // Non-fatal — empty defaults from defaultCashFlowFilters stay in place.
            } finally {
                // Release the first report load whether the seed succeeded
                // or not (a failed seed then mirrors legacy's r002-empty
                // failure mode: the report call is rejected by validation).
                if (!cancelled) setRatesReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleSearch = useCallback(() => {
        setSearchKey((k) => k + 1);
    }, []);

    const handleExport = useCallback(async () => {
        const titleBase = t("report.cash_flow.title");
        const datePart = formatDateDdMmYyyy(new Date());
        try {
            await exportExcel({
                endpoint: "/api/v1/banking/reports/cash-flow-report/export",
                screenId: SCREEN_IDS.CASH_FLOW_REPORT,
                dymAreaId: DEFAULT_AREA_ID,
                fileName: `CashFlow_${datePart}`,
                title: titleBase,
                columns: buildExportColumns(t, filters.baseCurrency),
                filters: {
                    year: filters.year,
                    quarter: filters.quarter ?? "",
                    baseCurrency: filters.baseCurrency,
                    // Same effective rates as the report loader — a
                    // cleared input falls back to the DB seed so the
                    // exported workbook matches the on-screen matrix.
                    usdRate: filters.usdRate || seededRatesRef.current.usd || "",
                    krwRate: filters.krwRate || seededRatesRef.current.krw || "",
                    bankFilters: JSON.stringify(
                        filters.bankFilters.map((b) => ({
                            bankCd: b.bankCd,
                            accountNo: b.acctNo,
                        })),
                    ),
                },
            });
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "UNKNOWN";
            const message = err instanceof Error ? err.message : String(err);
            if (code !== "WBE1401") {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: message,
                    errorCode: code,
                });
            }
        }
    }, [t, dialog, filters]);

    return (
        <CashFlowPage
            report={report}
            filters={filters}
            onFiltersChange={setFilters}
            onSearch={handleSearch}
            onExport={handleExport}
            loading={loading}
            bankOptions={bankOptions}
            bankOptionsLoading={bankOptionsLoading}
        />
    );
}

function buildExportColumns(
    t: (key: string, vars?: Record<string, string | number>) => string,
    baseCcy: string,
) {
    return [
        { fieldId: "DISP_CD", header: t("report.cash_flow.col.code"), format: "text" as const, widthChars: 14 },
        { fieldId: "DISP_NM", header: t("report.cash_flow.col.display_name"), format: "text" as const, widthChars: 30 },
        { fieldId: "ITEM_CD", header: t("report.cash_flow.col.item_code"), format: "text" as const, widthChars: 14 },
        { fieldId: "ITEM_NM", header: t("report.cash_flow.col.item_name"), format: "text" as const, widthChars: 26 },
        { fieldId: "ROW_TYPE", header: t("report.cash_flow.col.row_type"), format: "text" as const, widthChars: 18 },
        ...MONTH_KEYS.map((m) => ({
            fieldId: `${m.toUpperCase()}_AMT`,
            header: t(`report.cash_flow.month.${m}`),
            format: "amount" as const,
            ccyCd: baseCcy,
            widthChars: 16,
        })),
        { fieldId: "TOTAL_AMT", header: t("report.cash_flow.col.total"), format: "amount" as const, ccyCd: baseCcy, widthChars: 20 },
        { fieldId: "DISP_CCY_CD", header: t("report.cash_flow.col.display_currency"), format: "text" as const, widthChars: 10 },
    ];
}

function formatDateDdMmYyyy(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}`;
}
