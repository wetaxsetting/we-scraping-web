"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import EInvoicesPage from "./EInvoicesPage";
import { fetchEInvoices } from "@/lib/api/addon";
import { mapEInvoiceRow, mapEInvoiceTotal } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { ApiCallError } from "@/lib/api/banking";
import {
    matchInvoiceStatus,
    toWireStatusValue,
    type InvoiceStatusFilterKey,
} from "@/lib/api/einvoiceStatus";
import { useTableSort } from "@/hooks/useTableSort";
import { useExcelExport } from "@/hooks/useExcelExport";
import { useDialog } from "@/components/shared/dialog";
import { PAGE_SIZE_OPTIONS } from "@/components/shared/Pagination";
import { SCREEN_IDS } from "@/lib/viewSettingScreens";
import { printReport, escapeHtml } from "@/lib/print";
import { useTranslation } from "@/lib/i18n";

import {
    EINVOICE_FALLBACK_COLUMNS,
    buildEInvoiceExportColumns,
} from "./exportConfig";
import type { EInvoiceRow } from "./types";

type Props = {
    /** Backend filter: `SALES` or `EXPENSE` (collapses both routes
     *  through one `EInvoiceController#list` endpoint). */
    type: "SALES" | "EXPENSE";
    translationPrefix: "sales_einvoices" | "expenses_einvoices";
};

const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];
const DEFAULT_RANGE_DAYS = 30;
const KEYWORD_DEBOUNCE_MS = 300;

const SCREEN_ID_BY_TYPE: Record<"SALES" | "EXPENSE", string> = {
    SALES:   SCREEN_IDS.ADDON_SALES_EINVOICES,
    EXPENSE: SCREEN_IDS.ADDON_EXPENSES_EINVOICES,
};

/**
 * Client wrapper for both Sales (outbound) and Bill / Expenses (inbound)
 * e-Invoice lists. Shares `<EInvoicesPage>` with its sibling — the two
 * variants only differ by `type` filter + i18n prefix.
 *
 * <p><b>Frontend MR C — Excel + Print wiring:</b>
 * <ul>
 *   <li><b>Excel</b> — POST {@code /api/v1/addon/einvoices/export} via
 *       the shared {@link useExcelExport} hook. Reuses the page's
 *       current filter / sort / status / keyword state so the
 *       spreadsheet matches what the user sees on screen. Backend
 *       runs the export unpaged so every matching row lands in the
 *       file regardless of which page the user is viewing (rule IR-6).
 *       Loading-state flag wires through to the action bar's Excel
 *       button so a slow download can't be triggered twice.</li>
 *   <li><b>Print</b> — basic print of the current visible page slice
 *       via {@link printReport}. Keeps it simple per the MR scope
 *       ("optional basic print"); a future MR can fetch unpaged data
 *       so the popup carries every matching row.</li>
 *   <li><b>Errors</b> — non-401 export failures surface via
 *       {@link useDialog} as a system error dialog with the
 *       {@code COMMON_HEAD.CODE} carried by {@link ApiCallError}.
 *       401 is handled automatically by the global axios interceptor.</li>
 * </ul>
 */
export default function EInvoicesClient({ type, translationPrefix }: Props) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const exportXlsx = useExcelExport();

    // Date range — kept in ISO `YYYY-MM-DD` for the picker components
    // (which speak ISO uniformly) and converted to legacy `YYYYMMDD` at
    // the wire boundary. Default = last-30-days; mutable via the chip
    // popups + the dual-month range popover behind the calendar icon.
    const [rangeIso, setRangeIso] = useState(() => defaultRangeIso(DEFAULT_RANGE_DAYS));
    const fromDt = isoToYyyymmdd(rangeIso.start);
    const toDt = isoToYyyymmdd(rangeIso.end);

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

    const { sortField, sortDirection, sortParams, toggleSort } = useTableSort({
        sortField: "DATE_TIME",
        sortDirection: "DESC",
    });

    const [statusKey, setStatusKey] = useState<InvoiceStatusFilterKey>("all");

    const [keyword, setKeyword] = useState("");
    const [debouncedKeyword, setDebouncedKeyword] = useState("");
    useEffect(() => {
        const handle = window.setTimeout(
            () => setDebouncedKeyword(keyword),
            KEYWORD_DEBOUNCE_MS,
        );
        return () => window.clearTimeout(handle);
    }, [keyword]);

    const [refreshKey, setRefreshKey] = useState(0);
    const [exporting, setExporting] = useState(false);

    const wireStatus = toWireStatusValue(statusKey);

    const { data } = useApiData(
        () =>
            fetchEInvoices({
                type,
                from: fromDt,
                to: toDt,
                keyword: debouncedKeyword || undefined,
                status: wireStatus,
                page,
                size: pageSize,
                ...(sortParams ?? {}),
            }),
        [
            type,
            fromDt,
            toDt,
            debouncedKeyword,
            wireStatus,
            page,
            pageSize,
            sortField,
            sortDirection,
            refreshKey,
        ],
    );

    const [stableData, setStableData] = useState(data);
    const [prevData, setPrevData] = useState(data);
    if (data !== prevData) {
        setPrevData(data);
        if (data) setStableData(data);
    }

    const allRows = useMemo(
        () => stableData?.rows?.map(mapEInvoiceRow) ?? [],
        [stableData],
    );

    // Phase 2 stop-gap (rule IR-4) — apply the status post-filter on
    // the page slice client-side via the regex matcher.
    const visibleRows = useMemo(() => {
        if (statusKey === "all") return allRows;
        return allRows.filter((r) => matchInvoiceStatus(r.invoiceStatus) === statusKey);
    }, [allRows, statusKey]);

    const totals = useMemo(
        () => stableData?.totals?.map(mapEInvoiceTotal) ?? [],
        [stableData],
    );

    const totalCount = stableData?.total_count ?? 0;
    const totalPages = Math.max(1, stableData?.total_pages ?? 1);
    const pageNumberZeroBased = stableData?.page_number ?? page;
    const effectivePageSize = stableData?.page_size ?? pageSize;

    const handleRefresh = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    const handleStatusChange = useCallback((next: InvoiceStatusFilterKey) => {
        setStatusKey(next);
        setPage(0);
    }, []);

    /** Date-range change — chip popup or range popover Apply both flow
     *  through here. Resets to page 0 (mirrors every other filter
     *  change in the wrapper), keeps status / keyword / sort / page
     *  size intact. Always normalises so {@code start ≤ end}. */
    const handleDateRangeChange = useCallback(
        (next: { start: string; end: string }) => {
            const normalised = next.start <= next.end
                ? next
                : { start: next.end, end: next.start };
            setRangeIso(normalised);
            setPage(0);
        },
        [],
    );

    const handleKeywordChange = useCallback((next: string) => {
        setKeyword(next);
        setPage(0);
    }, []);

    /* --------------------------------------------------------------
     *  Excel export — POST /api/v1/addon/einvoices/export
     * -------------------------------------------------------------- */

    const handleExportExcel = useCallback(async () => {
        if (exporting) return; // guard against double-click while a download is in flight
        setExporting(true);
        try {
            await exportXlsx({
                endpoint: "/api/v1/addon/einvoices/export",
                screenId: SCREEN_ID_BY_TYPE[type],
                dymAreaId: "default",
                // Filename = "<page title>_DDMMYYYY". Backend appends ".xlsx".
                fileName: `${t(`${translationPrefix}.title`)}_${todayDmy()}`,
                // In-sheet row 0 — verbatim page title, no date suffix.
                title: t(`${translationPrefix}.title`),
                // Per IR-9 the page does NOT call useViewSetting() (no
                // popover), so we feed the hook our hardcoded fallback
                // mirroring the V45 seed. Backend defence-in-depth re-
                // intersects with the persisted seed visibility.
                items: EINVOICE_FALLBACK_COLUMNS,
                columnConfig: buildEInvoiceExportColumns(translationPrefix),
                t,
                filters: {
                    type,
                    from: fromDt,
                    to: toDt,
                    keyword: debouncedKeyword.trim() || undefined,
                    status: wireStatus,
                },
                // useTableSort returns `{ sortField, sortDirection }`;
                // the Excel wire shape uses `{ field, direction }`.
                sort: sortParams
                    ? { field: sortParams.sortField, direction: sortParams.sortDirection }
                    : undefined,
            });
        } catch (err) {
            // 401 is handled by the global axios interceptor (re-auth
            // dialog). Everything else surfaces here as a system
            // error dialog with the COMMON_HEAD.CODE.
            const apiErr = err instanceof ApiCallError ? err : null;
            const errorCode = apiErr?.code ?? "WBE9999";
            const description = apiErr?.message ?? String(err);
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description,
                errorCode,
            });
        } finally {
            setExporting(false);
        }
    }, [
        exporting,
        exportXlsx,
        type,
        translationPrefix,
        fromDt,
        toDt,
        debouncedKeyword,
        wireStatus,
        sortParams,
        t,
        dialog,
    ]);

    /* --------------------------------------------------------------
     *  Excel-with-Details — deferred until the backend ships a detail
     *  endpoint. Surface a "not implemented yet" dialog so the menu row
     *  stays interactive (matches legacy `einv_0001_000` UI parity)
     *  without inventing a fake export. Swap the dialog for a real
     *  `exportXlsx(...)` call when the endpoint lands.
     * -------------------------------------------------------------- */

    const handleExportDetails = useCallback(() => {
        dialog.open({
            type: "warning",
            title: t("dialog.warning"),
            description: t(`${translationPrefix}.export_details_not_implemented`),
        });
    }, [dialog, t, translationPrefix]);

    /* --------------------------------------------------------------
     *  Print — basic print of the current page slice
     * -------------------------------------------------------------- */

    const handlePrint = useCallback(() => {
        const k = (suffix: string) => `${translationPrefix}.${suffix}`;
        printReport<EInvoiceRow>({
            title: t(k("title")),
            // Print source is the visible page slice (post status post-
            // filter). "Optional basic print" per the MR scope — a
            // future enhancement can fetch unpaged for full coverage.
            rows: visibleRows,
            columns: [
                {
                    header: t(k("col.date_time")),
                    render: (row) =>
                        `${escapeHtml(row.date)}` +
                        (row.time
                            ? ` <span class="muted">${escapeHtml(row.time)}</span>`
                            : ""),
                },
                {
                    header: t(k("col.invoice_no")),
                    render: (row) => escapeHtml(row.invoiceNo),
                },
                {
                    header: t(k("col.buyer")),
                    render: (row) => {
                        const name = escapeHtml(row.buyerName);
                        const mst = row.mstCode
                            ? ` <span class="muted">(MST: ${escapeHtml(row.mstCode)})</span>`
                            : "";
                        return name + mst;
                    },
                },
                {
                    header: t(k("col.currency")),
                    render: (row) => escapeHtml(row.currency),
                },
                {
                    header: t(k("col.total")),
                    align: "right",
                    render: (row) => escapeHtml(row.totalAmount),
                },
                {
                    header: t(k("col.status")),
                    render: (row) => escapeHtml(row.invoiceStatus),
                },
                {
                    header: t(k("col.tax")),
                    align: "right",
                    render: (row) => escapeHtml(row.taxAmount),
                },
                {
                    header: t(k("col.pretax")),
                    align: "right",
                    render: (row) => escapeHtml(row.amountBeforeTax),
                },
            ],
        });
    }, [translationPrefix, t, visibleRows]);

    return (
        <EInvoicesPage
            translationPrefix={translationPrefix}
            rows={visibleRows}
            totals={totals}
            dateRange={{
                startIso: rangeIso.start,
                endIso: rangeIso.end,
                onChange: handleDateRangeChange,
            }}
            pagination={{
                page: pageNumberZeroBased + 1,
                pageCount: totalPages,
                pageSize: effectivePageSize,
                totalCount,
                shownCount: visibleRows.length,
                onPageChange: (next: number) => setPage(Math.max(0, next - 1)),
                onPageSizeChange: (size: number) => {
                    setPageSize(size);
                    setPage(0);
                },
            }}
            sort={{
                sortField,
                sortDirection,
                onSort: toggleSort,
            }}
            statusFilter={{
                value: statusKey,
                onChange: handleStatusChange,
            }}
            search={{
                value: keyword,
                onChange: handleKeywordChange,
            }}
            onRefresh={handleRefresh}
            onExport={handleExportExcel}
            onExportDetails={handleExportDetails}
            onPrint={handlePrint}
            exporting={exporting}
        />
    );
}

/* ------------------------------------------------------------------
 *  Helpers — date defaults + format conversions
 * ------------------------------------------------------------------ */

/** Default range = today / today − {@code rangeDays} expressed as ISO
 *  `YYYY-MM-DD` strings, the format every shared date picker speaks. */
function defaultRangeIso(rangeDays: number): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - rangeDays);
    return { start: toIso(start), end: toIso(end) };
}

function toIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/** ISO `YYYY-MM-DD` → legacy wire `YYYYMMDD`. */
function isoToYyyymmdd(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? `${m[1]}${m[2]}${m[3]}` : iso;
}

/** "DDMMYYYY" stamp for the export filename — local timezone. */
function todayDmy(): string {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const y = d.getFullYear();
    return `${day}${m}${y}`;
}
