"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import EInvoicesPage from "./EInvoicesPage";
import UpdateEInvoiceModal from "./UpdateEInvoiceModal";
import { fetchEInvoices } from "@/lib/api/addon";
import { mapEInvoiceRow, mapEInvoiceTotal } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { ApiCallError } from "@/lib/api/banking";
import {
    matchInvoiceStatus,
    toWireStatusValue,
    type InvoiceStatusFilterKey,
} from "@/lib/api/einvoiceStatus";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import { useExcelExport } from "@/hooks/useExcelExport";
import {
    type DateRangeFilterPreset,
    type DateRangeFilterValue,
} from "@/components/shared/DateRangeFilter";
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
const KEYWORD_DEBOUNCE_MS = 300;

/** Map a preset to its day-window. Mirrors {@link ErpTransactionHistoryPanel}
 *  so both consumers translate the same dropdown labels into the same
 *  date ranges. */
const PRESET_DAYS: Record<DateRangeFilterPreset, number> = {
    last_30_days: 30,
    last_90_days: 90,
    last_180_days: 180,
};

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

    // Date range — shared {@link DateRangeFilterValue} carrying the
    // dropdown mode (preset|manual) + the active preset + ISO start/end.
    // Default = Last 30 Days preset mode (matches ERP Transaction
    // History panel). Preset-mode wire dates anchor to "today" on each
    // resolution; manual-mode dates come from the user-edited chips.
    const [dateRange, setDateRange] = useState<DateRangeFilterValue>(
        () => defaultDateRangeValue(),
    );
    const { start: fromIso, end: toIsoStr } = useMemo(
        () => resolveIsoRange(dateRange),
        [dateRange],
    );
    const fromDt = isoToYyyymmdd(fromIso);
    const toDt = isoToYyyymmdd(toIsoStr);

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
    // Drives the "Update e-Invoice Information" popup. The page's
    // Update action opens this modal rather than firing an immediate
    // refetch — actual list refresh happens after the user runs an
    // inquiry inside the popup (wired in a follow-up MR). Keeping the
    // refetch trigger (`refreshKey`) wired so a later MR can flip the
    // popup's CTA to bump it on success without re-plumbing state.
    const [updateModalOpen, setUpdateModalOpen] = useState(false);

    const wireStatus = toWireStatusValue(statusKey);

    const { data, loading } = useApiData(
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

    /* Smooth the loading→empty / loading→table flicker on the very first
     * paint. `loading && !stableData` is true only while no response has
     * latched yet, so sticky-wrapping it covers initial load, the empty
     * resolution after a fast cached fetch, and the brief seam between
     * "nothing rendered" and "rows arrived". Once `stableData` lights up,
     * subsequent refetches keep the previous rows visible and the gate
     * stays false — search/filter/pagination flicker is handled by the
     * stable-data latch itself. Mirrors the Settings module's
     * VasAccountPanel / FirmBankingHistoryPanel pattern. */
    const stickyInitialLoading = useStickyLoading(loading && !stableData);

    /* Keep the Excel button visibly busy for the minimum-visibility
     * window so a fast download doesn't flicker the chip enabled →
     * disabled → enabled. The functional guard (`exporting`) still
     * blocks the second click at handler entry. */
    const stickyExporting = useStickyLoading(exporting);

    const allRows = useMemo(
        () => stableData?.rows?.map(mapEInvoiceRow) ?? [],
        [stableData],
    );

    // Phase 2 stop-gap (rule IR-4) — apply the status post-filter on
    // the page slice client-side via the regex matcher.
    const visibleRows = useMemo(() => {
        if (statusKey === "all") return allRows;
        return allRows.filter((r: EInvoiceRow) => matchInvoiceStatus(r.invoiceStatus) === statusKey);
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
        // Opens the Update e-Invoice Information popup. The legacy
        // `setRefreshKey` bump moves into the popup's inquiry-success
        // path (added with the API wiring MR).
        setUpdateModalOpen(true);
    }, []);

    const handleStatusChange = useCallback((next: InvoiceStatusFilterKey) => {
        setStatusKey(next);
        setPage(0);
    }, []);

    /** Date-range change — fires from the preset dropdown, the
     *  "Enter Manually" sentinel, the calendar-icon trigger (which
     *  flips mode to manual), or the manual-mode chip popups. Resets
     *  to page 0 (mirrors every other filter change in the wrapper),
     *  keeps status / keyword / sort / page size intact.
     *
     *  <p>When the user picks a preset, refresh the ISO start/end so a
     *  later flip to manual mode opens the calendar at the equivalent
     *  range. Manual-mode edits and manual ↔ manual passes go through
     *  verbatim — {@link DateRangeFilter} normalises {@code start ≤ end}
     *  inside the popover before emitting. */
    const handleDateRangeChange = useCallback(
        (next: DateRangeFilterValue) => {
            if (next.mode === "preset") {
                const { start, end } = rangeFromPreset(next.preset);
                setDateRange({ ...next, start, end });
            } else {
                setDateRange(next);
            }
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
        <>
            <EInvoicesPage
                translationPrefix={translationPrefix}
                rows={visibleRows}
                totals={totals}
                // Initial-load gate: true only while the first fetch is in
                // flight (no response latched yet). Sticky-wrapped so a fast
                // cached response doesn't flash "Loading…" → "No Data Found"
                // → rows in under a perceptual frame. Later refetches keep
                // the previous rows visible via `stableData`, so a resolved
                // empty result shows "No Data Found" rather than the loading
                // text once the sticky window closes.
                loading={stickyInitialLoading}
                dateRange={{
                    value: dateRange,
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
                exporting={stickyExporting}
            />
            {updateModalOpen && (
                <UpdateEInvoiceModal
                    variant={type}
                    onClose={() => setUpdateModalOpen(false)}
                />
            )}
        </>
    );
}

/* ------------------------------------------------------------------
 *  Helpers — date defaults + format conversions
 * ------------------------------------------------------------------ */

/** Default filter value — preset mode anchored to Last 30 Days
 *  (mirrors the ERP Transaction History panel default). ISO start/end
 *  are populated so a later flip to manual mode opens the calendar at
 *  the equivalent window without a flicker. */
function defaultDateRangeValue(): DateRangeFilterValue {
    const preset: DateRangeFilterPreset = "last_30_days";
    const { start, end } = rangeFromPreset(preset);
    return { mode: "preset", preset, start, end };
}

/** Compute the ISO start/end pair for a given preset, anchored to today.
 *  Used both to seed the value's ISO fields when the user picks a
 *  preset AND to recompute the wire dates on each render in preset mode. */
function rangeFromPreset(preset: DateRangeFilterPreset): {
    start: string;
    end: string;
} {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - PRESET_DAYS[preset]);
    return { start: toIso(start), end: toIso(today) };
}

/** Resolve the effective ISO start/end pair for the current filter
 *  state. Manual mode uses the user-chosen literal start/end; preset
 *  mode recomputes from the day-window so the value stays anchored to
 *  "today" across re-renders. */
function resolveIsoRange(value: DateRangeFilterValue): {
    start: string;
    end: string;
} {
    if (value.mode === "manual") {
        return { start: value.start, end: value.end };
    }
    return rangeFromPreset(value.preset);
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
