"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAccounts, fetchCashFlow, fetchExchangeRates } from "@/lib/api/banking";
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
import type { BankFilterOption } from "./BankFilterPopover";
import { MONTH_KEYS } from "./types";

/**
 * Cash Flow client wrapper — owns filter state and orchestrates two
 * data sources:
 *
 * 1. **Bank account list** ({@link fetchAccounts}) — loaded once on
 *    mount, feeds the "All Banks" filter popover with `(bankCd, acctNo)`
 *    options.
 * 2. **Cash Flow report** ({@link fetchCashFlow}) — refetched whenever
 *    the user clicks Search. Also auto-fires once on mount with default
 *    filters so the page renders the matrix immediately (mirrors legacy
 *    `cash_0001_001` which renders on page open).
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
    // `searchKey` starts at 0 — `useApiData` fires immediately on mount.
    // Search button bumps it to refetch with current filters.
    const [searchKey, setSearchKey] = useState(0);

    // Report load — refires on Search.
    const loader = useCallback(
        () =>
            fetchCashFlow({
                year: filters.year,
                quarter: filters.quarter,
                baseCurrency: filters.baseCurrency,
                usdRate: filters.usdRate || null,
                krwRate: filters.krwRate || null,
                bankFilters: filters.bankFilters.map((b) => ({
                    bankCd: b.bankCd,
                    accountNo: b.acctNo,
                })),
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [searchKey],
    );

    const { data, loading } = useApiData(loader, [searchKey]);

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
    // from the latest BANK_EXCH_RATE_INFM row on mount. Without this the
    // filter shows the static `26000` / `19` defaults from
    // `defaultCashFlowFilters` (placeholders only). The legacy
    // `cash_0001_001` page reads the same source for its rate field.
    //
    // Uses `sell_amt` — the bank's selling rate, mirroring the legacy
    // Exchange Rate Inquiry default. Falls back silently to the static
    // defaults if the endpoint errors or has no USD/KRW row today.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetchExchangeRates();
                if (cancelled) return;
                const usdRow = res.rates?.find((r) => r.ccyCd === "USD");
                const krwRow = res.rates?.find((r) => r.ccyCd === "KRW");
                setFilters((prev) => {
                    let next = prev;
                    if (usdRow?.sellAmt != null) {
                        next = { ...next, usdRate: String(usdRow.sellAmt) };
                    }
                    if (krwRow?.sellAmt != null) {
                        next = { ...next, krwRate: String(krwRow.sellAmt) };
                    }
                    return next;
                });
            } catch {
                // Non-fatal — static defaults from defaultCashFlowFilters stay in place.
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
                    usdRate: filters.usdRate,
                    krwRate: filters.krwRate,
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
