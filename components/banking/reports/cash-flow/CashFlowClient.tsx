"use client";

import { useCallback, useMemo, useState } from "react";

import { fetchCashFlow } from "@/lib/api/banking";
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
import { MONTH_KEYS } from "./types";

/**
 * Cash Flow client wrapper — owns filter state + the `hasSearched` flag.
 * `useApiData` re-runs on `searchKey` so the user has explicit control
 * over when a request fires (mirrors the legacy `cash_0001_001` flow).
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
    const [searchKey, setSearchKey] = useState(0);
    const [hasSearched, setHasSearched] = useState(false);

    const loader = useCallback(
        () =>
            fetchCashFlow({
                year: filters.year,
                quarter: filters.quarter,
                baseCurrency: filters.baseCurrency,
                usdRate: filters.usdRate || null,
                krwRate: filters.krwRate || null,
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [searchKey],
    );

    const { data, loading } = useApiData(loader, [searchKey]);

    const report = useMemo(() => (data ? mapCashFlowReport(data) : undefined), [data]);

    const handleSearch = useCallback(() => {
        setHasSearched(true);
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
            hasSearched={hasSearched}
            onSearch={handleSearch}
            onExport={handleExport}
            loading={loading}
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
