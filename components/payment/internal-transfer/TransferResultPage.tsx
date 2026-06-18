"use client";

import { useCallback, useMemo, useState } from "react";

import PaymentResultBatchListPage, {
    type PaymentResultBatchRow,
    type ResultBatchSortable,
    type ResultStatusFilter,
} from "@/components/payment/shared/PaymentResultBatchListPage";
import type {
    ManualDateRange,
    PeriodKey,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { ApiCallError } from "@/lib/api/banking";
import { downloadOriginalExcel, fetchTransferResultList } from "@/lib/api/internalTransfer";
import {
    mapTransferResultList,
    type TransferResultList,
    type TransferResultRow,
} from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { formatAmount } from "@/lib/currency";
import { useExcelExport, type ExcelExportColumnConfig } from "@/hooks/useExcelExport";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import { useTranslation } from "@/lib/i18n";
import { formatRegDtmDisplay } from "@/lib/datetime";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import { type InternalResultRow } from "./types";

/**
 * Payment > Internal Transfer > Transfer Result — Figma 1:11730.
 *
 * Mirrors legacy `pymn_0010_001_r001` (Phase A read path). Composes the
 * shared `<PaymentResultBatchListPage>` (CLAUDE.md §12a) with full
 * server-driven wiring: period dropdown, status checkboxes, search,
 * sort, pagination, View Setting popover, and Print all reset the page
 * to 0 and re-fire the list call.
 *
 * <p>Excel export is wired to a "coming soon" notice — backend
 * `POST /api/v1/payment/internal-transfer/results/export` hasn't shipped
 * yet (see CLAUDE.md §13b for the contract). Flip to `useExcelExport`
 * the moment the provider lands; no other change required.
 *
 * <p>Internal Transfer Result is the only Payment Result variant exempt
 * from the totals footer per CLAUDE.md §12a — Figma 1:11730 shows
 * pagination only. Every other Result page (Vendor / Expense / Payroll /
 * Overseas) supplies a `totals` array.
 */
export default function TransferResultPage() {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [period, setPeriod] = useState<PeriodKey>("30d");
    const [manualRange, setManualRange] = useState<ManualDateRange | undefined>(
        undefined,
    );
    const [statusFilter, setStatusFilter] = useState<ResultStatusFilter>({
        completed: false,
        in_progress: false,
    });
    const [search, setSearch] = useState<string>("");
    const sort = useTableSort();

    // View Setting state — mirrors the canonical Account Inquiry pattern
    // (CLAUDE.md §13). The hook loads `vs.items` keyed by the V113-seeded
    // FIELD_IDs for `payment-internal-transfer-result`; the shell's
    // `viewSettingItems` prop gates each column's <col>/<th>/<td> by
    // `USE_YN === "Y"`.
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_RESULT,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    // Reset to page 0 whenever the filter / sort / size changes so the
    // user doesn't land on a now-out-of-range page after the result
    // count shrinks. Mirrors the legacy `fn_loadData(option=true)`
    // reset documented in wecms-web CLAUDE.md §4.
    function changePeriod(next: PeriodKey) {
        setPeriod(next);
        setPage(0);
    }
    function changePageSize(next: number) {
        setPageSize(next);
        setPage(0);
    }
    function handleSort(fieldId: string) {
        sort.toggleSort(fieldId);
        setPage(0);
    }
    function changeSearch(next: string) {
        setSearch(next);
        setPage(0);
    }
    function changeStatusFilter(next: ResultStatusFilter) {
        setStatusFilter(next);
        setPage(0);
    }

    const { fromDate, toDate } = useMemo(
        () => periodToWindow(period, manualRange),
        [period, manualRange],
    );
    // Derive the backend `trnf_stts` param from the checkbox group.
    // Both unchecked OR both checked = no filter; one checked = bias.
    const trnfStts: "Y" | "N" | undefined = useMemo(() => {
        if (statusFilter.completed && !statusFilter.in_progress) return "Y";
        if (statusFilter.in_progress && !statusFilter.completed) return "N";
        return undefined;
    }, [statusFilter]);

    const state = useApiData(
        () =>
            fetchTransferResultList({
                fromDate,
                toDate,
                srchWd: search.trim() || undefined,
                trnfStts,
                page,
                size: pageSize,
                sortField: sort.sortParams?.sortField,
                sortDirection: sort.sortParams?.sortDirection,
            }).then(mapTransferResultList),
        [
            fromDate,
            toDate,
            search,
            trnfStts,
            page,
            pageSize,
            sort.sortField,
            sort.sortDirection,
        ],
    );

    /* Stable-data latch + sticky-wrapped initial-loading gate —
     * preserves the previous response across refetches so the table
     * doesn't flash empty between filter / pagination / sort changes,
     * and keeps the "Loading…" message visible ≥ 400 ms on first paint. */
    const [stableData, setStableData] = useState<TransferResultList | null>(state.data);
    const [prevData, setPrevData] = useState<TransferResultList | null>(state.data);
    if (state.data !== prevData) {
        setPrevData(state.data);
        if (state.data) setStableData(state.data);
    }

    const rows: Array<InternalResultRow & PaymentResultBatchRow> = (
        stableData?.rows ?? []
    ).map(toListRow);
    const totalCount = stableData?.totalCount ?? 0;

    const stickyInitialLoading = useStickyLoading(state.loading && !stableData);
    /* Mutation gate for the per-row Download action — keeps the
     * affordance visibly disabled across the sticky window so a fast
     * download doesn't flicker the icon enabled → disabled → enabled. */
    const [actionInFlight, setActionInFlight] = useState(false);
    const stickyActionInFlight = useStickyLoading(actionInFlight);
    // Currency totals for the sticky footer — same shape as the
    // Scheduled Transfer page (formatAmount with symbol). Until 2026-05-29
    // this page was on `paginationOnly` mode per the original
    // CLAUDE.md §12a carve-out (Figma 1:11730 showed no totals row),
    // but the canonical sticky-footer rollout treats Result pages as
    // a single category — supplying totals here flips the shared
    // shell into the `paginationWithStickyFooter` branch alongside
    // Vendor / Expense / Payroll / Overseas Result.
    const totals = useMemo(
        () =>
            (stableData?.currencyTotals ?? []).map((c) => ({
                currency: c.ccyCd,
                amount:   formatAmount(c.totalAmount, c.ccyCd, true),
            })),
        [stableData],
    );

    // Print → opens a clean popup with the 7 data columns rendered from
    // the current `rows`. Mirrors the Scheduled page's `handlePrint` /
    // `printReport` pattern per CLAUDE.md §6d — never calls
    // window.print() on the live DOM.
    const handlePrint = useCallback(() => {
        const columns: PrintColumn<InternalResultRow & PaymentResultBatchRow>[] = [
            {
                header: t("payment.internal.col.date_time"),
                render: (r) => escapeHtml(r.dateTime.replace(/\n/g, " ")),
            },
            {
                header: t("payment.internal.col.file_name"),
                render: (r) => escapeHtml(r.fileName),
            },
            {
                header: t("payment.internal.col.txn_count"),
                align: "right",
                render: (r) =>
                    escapeHtml(`${r.txnCount} Transaction (${r.txnCurrency})`),
            },
            {
                header: t("payment.internal.col.total_transfer"),
                align: "right",
                render: (r) => escapeHtml(r.totalAmount),
            },
            {
                header: t("payment.internal.result.col.transfer_status"),
                render: (r) =>
                    escapeHtml(
                        r.status === "completed"
                            ? t("payment.internal.result.status.completed")
                            : t("payment.internal.result.status.in_progress"),
                    ),
            },
            {
                header: t("payment.internal.col.approval_ref"),
                render: (r) => escapeHtml(r.approvalRef),
            },
            {
                header: t("payment.internal.col.approval_title"),
                render: (r) => escapeHtml(r.approvalTitle),
            },
        ];
        const summary = t("common.showing_of", {
            shown: String(rows.length),
            total: String(totalCount),
        });
        printReport({
            title: t("payment.internal.result_title"),
            summary,
            columns,
            rows,
        });
    }, [rows, totalCount, t]);

    // List-icon → open View Setting popover anchored to the trigger.
    // Snapshot `vs.items` into a local draft so checkbox / reorder
    // edits stay reversible until Save. Mirrors the canonical Account
    // Inquiry reference (CLAUDE.md §13).
    const handleListView = useCallback(
        (anchorRect: DOMRect) => {
            const seed = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
            setVsDraft(seed.map((it) => ({ ...it })));
            setVsAnchor(anchorRect);
        },
        [vs.items],
    );
    const closeViewSetting = useCallback(() => {
        setVsAnchor(null);
        setVsDraft(null);
    }, []);

    // Excel export — shared `useExcelExport` hook POSTs the filter +
    // sort + View Setting context to the backend
    // `POST /api/v1/payment/internal-transfer/results/export`, which
    // re-runs the same query as the list endpoint and streams XLSX
    // bytes back. Backend provider:
    // `InternalTransferResultExportProvider` (CLAUDE.md §13b).
    const exportXlsx = useExcelExport();
    const handleExcelExport = useCallback(async () => {
        try {
            await exportXlsx({
                endpoint:     "/api/v1/payment/internal-transfer/results/export",
                screenId:     SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_RESULT,
                dymAreaId:    DEFAULT_AREA_ID,
                fileName:     `${t("payment.internal.result_title")}_${todayDmy()}`,
                title:        t("payment.internal.result_title"),
                items:        vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS,
                columnConfig: RESULT_EXPORT_COLUMNS,
                t,
                filters: {
                    fromDate,
                    toDate,
                    srchWd:   search.trim() || undefined,
                    trnfStts: trnfStts,
                },
                sort: sort.sortField && sort.sortDirection
                    ? { field: sort.sortField, direction: sort.sortDirection }
                    : null,
            });
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const message = err instanceof ApiCallError
                ? err.message
                : t("payment.internal.transfer_failed");
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        }
    }, [exportXlsx, vs.items, fromDate, toDate, search, trnfStts, sort.sortField, sort.sortDirection, dialog, t]);

    // Per-row download — streams the original Excel uploaded with the
    // batch. Mirrors the Scheduled list's download handler. Legacy
    // DEV-imported batches without a `save_file_nm` surface as
    // WBE2069; treat that as a "file unavailable" warning rather than
    // a hard error.
    const handleDownloadRow = useCallback(
        async (row: InternalResultRow & PaymentResultBatchRow) => {
            if (actionInFlight) return;
            setActionInFlight(true);
            try {
                await downloadOriginalExcel(row.id);
            } catch (err) {
                if (err instanceof ApiCallError) {
                    dialog.open({
                        type:        err.code === "WBE2069" ? "warning" : "error",
                        title:       err.code === "WBE2069"
                            ? t("dialog.warning")
                            : t("dialog.error"),
                        description: err.message,
                        errorCode:   err.code,
                    });
                    return;
                }
                dialog.open({
                    type:        "error",
                    title:       t("dialog.error"),
                    description: t("payment.internal.download_failed"),
                });
            } finally {
                setActionInFlight(false);
            }
        },
        [dialog, t, actionInFlight],
    );

    // Calendar icon — custom date-range picker isn't built yet (the
    // period dropdown's three presets carry the page today). Surface a
    // warning notice so the click has visible feedback. Replace with a
    // real popover when the date-range component lands.
    const handleCalendarClick = useCallback(() => {
        dialog.open({
            type: "warning",
            title: t("dialog.warning"),
            description: t("payment.internal.calendar_coming_soon"),
        });
    }, [dialog, t]);

    return (
        <>
            <PaymentResultBatchListPage<InternalResultRow & PaymentResultBatchRow>
                title={t("payment.internal.result_title")}
                rows={rows}
                rowDetailHref={(row) =>
                    `/payment/internal-transfer/transfer-result/${row.id}`
                }
                totals={totals}
                txnUnitLabel="Transaction"
                period={period}
                onPeriodChange={changePeriod}
                manualRange={manualRange}
                onManualRangeChange={(r) => {
                    setManualRange(r);
                    setPage(0);
                }}
                search={search}
                onSearchChange={changeSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={changeStatusFilter}
                pagination={{
                    page,
                    pageSize,
                    totalCount,
                    onPageChange: setPage,
                    onPageSizeChange: changePageSize,
                }}
                sort={{
                    field: sort.sortField,
                    direction: sort.sortDirection,
                }}
                sortableColumns={SORTABLE_COLUMNS}
                onSort={handleSort}
                onPrint={handlePrint}
                onListView={handleListView}
                onExcelExport={handleExcelExport}
                onDownloadRow={handleDownloadRow}
                onCalendarClick={handleCalendarClick}
                viewSettingItems={
                    vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS
                }
                fieldIdMap={FIELD_ID_MAP}
                emptyMessage={t("payment.internal.result_empty")}
                loading={stickyInitialLoading}
                actionInFlight={stickyActionInFlight}
            />
            {vsAnchor && vsDraft && (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={(next) => setVsDraft(next)}
                    getLabel={(item) => item.field_nm || item.field_id}
                    onSave={async () => {
                        try {
                            await vs.save(vsDraft);
                        } finally {
                            closeViewSetting();
                        }
                    }}
                    onReset={async () => {
                        const next = await vs.reset();
                        setVsDraft(next.map((it) => ({ ...it })));
                    }}
                    onClose={closeViewSetting}
                />
            )}
        </>
    );
}

/**
 * Mirror of the V219 SYS_SCR_OPTION_WECMS seed for
 * `payment-internal-transfer-result` / `default`. Used as the paint-time
 * fallback while the API resolves so the table doesn't flash empty.
 * The authoritative config still comes from the backend; this exists
 * only to bridge first-render and to drive column widths until V219
 * has been applied to the local DB.
 *
 * Aligned with legacy `pymn_0010_001` PROD widths + FIELD_IDs:
 *   TRAN_DT (Date/Time), FILE_NM (separate from TITL=Approval Title),
 *   SCDUL_PYMN_DETL_NO (No. of Transactions — legacy count name),
 *   TRAN_AMT (Total), PROC_STAT (Transfer Status), APPR_DOC_NO
 *   (Approval Ref).
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "TRAN_DT",            field_nm: "Date/Time",             disp_ord: 1,  disp_yn: "Y", use_yn: "Y", size: "105px", sort_yn: "Y" },
    { field_id: "FILE_NM",            field_nm: "File Name",             disp_ord: 2,  disp_yn: "Y", use_yn: "Y", size: "290px", sort_yn: "Y" },
    { field_id: "SCDUL_PYMN_DETL_NO", field_nm: "No. of Transactions",   disp_ord: 3,  disp_yn: "Y", use_yn: "Y", size: "155px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",           field_nm: "Total Transfer Amount", disp_ord: 4,  disp_yn: "Y", use_yn: "Y", size: "235px", sort_yn: "Y" },
    { field_id: "PROC_STAT",          field_nm: "Transfer Status",       disp_ord: 5,  disp_yn: "Y", use_yn: "Y", size: "190px", sort_yn: "Y" },
    { field_id: "APPR_DOC_NO",        field_nm: "Approval Ref.",         disp_ord: 6,  disp_yn: "Y", use_yn: "Y", size: "160px", sort_yn: "Y" },
    { field_id: "TITL",               field_nm: "Approval Title",        disp_ord: 7,  disp_yn: "Y", use_yn: "Y", size: "250px", sort_yn: "Y" },
    { field_id: "ETC",                field_nm: "",                      disp_ord: 99, disp_yn: "Y", use_yn: "Y", size: "50px",  sort_yn: "N" },
];

/**
 * FIELD_ID aliases supplied to `<PaymentResultBatchListPage>` so the shell
 * maps each column slot to the legacy V219 FIELD_ID rather than the V131
 * default (REG_DTM, ORG_FILE_NM, TOT_TRNS_CNT, …). The shell uses these
 * for both visibility gating AND DB width lookup.
 */
const FIELD_ID_MAP = {
    dateTime:      "TRAN_DT",
    fileName:      "FILE_NM",
    txnCount:      "SCDUL_PYMN_DETL_NO",
    totalAmount:   "TRAN_AMT",
    status:        "PROC_STAT",
    approvalRef:   "APPR_DOC_NO",
    approvalTitle: "TITL",
} as const;

/**
 * Per-column metadata for the shared {@link useExcelExport} hook. Each
 * entry maps a View Setting FIELD_ID to its header i18n key + write
 * format. Keys mirror the V219 legacy seed; the backend
 * `PaymentResultExportProvider.ALLOWED_FIELD_IDS` allow-list must
 * recognise the same FIELD_ID set — out-of-scope FIELD_IDs are dropped
 * by the writer with WBE2013.
 */
const RESULT_EXPORT_COLUMNS: Record<string, ExcelExportColumnConfig> = {
    TRAN_DT:            { headerKey: "payment.internal.col.date_time",       format: "text" },
    FILE_NM:            { headerKey: "payment.internal.col.file_name",       format: "text", widthChars: 40 },
    SCDUL_PYMN_DETL_NO: { headerKey: "payment.internal.col.txn_count",       format: "number", align: "right" },
    TRAN_AMT:           { headerKey: "payment.internal.col.total_transfer",  format: "amount", align: "right" },
    PROC_STAT:          { headerKey: "payment.internal.col.transfer_status", format: "text" },
    APPR_DOC_NO:        { headerKey: "payment.internal.col.approval_ref",    format: "text" },
    TITL:               { headerKey: "payment.internal.col.approval_title",  format: "text", widthChars: 40 },
};

/** Today as `DDMMYYYY` (no separators) — same convention as the
 *  Account Inquiry export filename suffix (CLAUDE.md §13b). */
function todayDmy(): string {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear());
    return `${dd}${mm}${yy}`;
}

/**
 * Per-column FIELD_ID map. Keys are the stable column identifiers the
 * shared shell understands; values are the backend
 * `InternalTransferResultSortField` enum names (aligned with V219 legacy
 * FIELD_IDs).
 *
 * Sortable today (entity column directly available):
 *   DATE_TIME      → TRAN_DT            (ScdulPymnSumr.regDtm)
 *   FILE_NAME      → FILE_NM            (ScdulPymnSumr.orgFileNm)
 *   TXN_COUNT      → SCDUL_PYMN_DETL_NO (ScdulPymnSumr.totTrnsCnt)
 *   TOTAL_AMOUNT   → TRAN_AMT           (ScdulPymnSumr.totalTranAmt)
 *   STATUS         → PROC_STAT          (ScdulPymnSumr.trnfYn — closest
 *                                       single-column proxy; full
 *                                       process-status semantics need
 *                                       the dispatch-tables join)
 *   APPROVAL_REF   → APPR_DOC_NO        (ScdulPymnSumr.erpFileNum — same
 *                                       pattern as the Scheduled list)
 *   APPROVAL_TITLE → TITL               (ScdulPymnSumr.titl)
 */
const SORTABLE_COLUMNS: ResultBatchSortable = {
    DATE_TIME:      "TRAN_DT",
    FILE_NAME:      "FILE_NM",
    TXN_COUNT:      "SCDUL_PYMN_DETL_NO",
    TOTAL_AMOUNT:   "TRAN_AMT",
    STATUS:         "PROC_STAT",
    APPROVAL_REF:   "APPR_DOC_NO",
    APPROVAL_TITLE: "TITL",
};

/* ----------------------------------------------------------------------------
 *  Wire row → list-page row adapter
 *
 *  Backend Phase A populates the core fields; success/failed counters
 *  come from `tot_trns_succ_cnt` / `tot_trns_error_cnt` when present.
 *  Status derives from `trnfStts` — `'Y'` (fully dispatched) reads as
 *  "completed"; anything else reads as "in_progress" so the user sees
 *  the orange in-progress label and no count pills.
 * -------------------------------------------------------------------------- */

function toListRow(
    api: TransferResultRow,
): InternalResultRow & PaymentResultBatchRow {
    // Legacy two-status rule (pymn_0010_001.ts:371-378): a batch reads as
    // "in_progress" while it hasn't dispatched OR while the dispatch-table
    // counts haven't settled. Once dispatched AND succ+err meet total,
    // it flips to "completed" and the chips render.
    const succ  = parseCount(api.totTrnsSuccCnt)  ?? 0;
    const err   = parseCount(api.totTrnsErrorCnt) ?? 0;
    const total = parseCount(api.totTrnsCnt)      ?? 0;
    const isInProgress = api.trnfStts !== "Y" || (succ + err) < total;
    const status: PaymentResultBatchRow["status"] = isInProgress ? "in_progress" : "completed";
    return {
        id:            api.scdulPymnNo,
        dateTime:      formatRegDtm(api.regDtm),
        // File Name now sourced from the master's original Excel name
        // (V219 + backend mapper update). Falls back to the approval
        // title for legacy DEV-imported rows whose master has no
        // `orgFileNm`.
        fileName:      api.fileNm ?? api.titl,
        txnCount:      total,
        txnCurrency:   api.ccyCd,
        // Raw wire decimal — shell re-formats via formatAmount.
        totalAmount:   String(api.totalTranAmt ?? "0"),
        status,
        successCount:  status === "completed" ? succ : undefined,
        failedCount:   status === "completed" ? err  : undefined,
        approvalRef:   api.docNo ?? "",
        // F4b — apprSeqNo keys the shared Approval Details popup (legacy
        // comm_0195_001). Null when the batch has no approval → cell stays text.
        approvalRefId: api.apprSeqNo ?? null,
        approvalTitle: api.titl,
        // Withdrawal bank lives on the detail wire shape, not the list
        // row — keep blank here, detail page fills it in.
        fromBank:      "",
    };
}

function parseCount(raw: string | null | undefined): number | undefined {
    if (raw == null || raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
}

/**
 * `yyyyMMddHHmmss` (14 chars, UTC) → two-line `"DD-MM-YYYY\nHH:mm:ss"`.
 * Matches the Scheduled-page formatter so both lists render the timestamp
 * column identically. Falls back to the raw string when the wire value
 * isn't the expected length so we never throw.
 */
function formatRegDtm(raw: string | null | undefined): string {
    return formatRegDtmDisplay(raw);
}

/**
 * Map a {@link PeriodKey} to the backend `from_date / to_date` window.
 * Always ends today; start is N days back. Output format is
 * `yyyyMMdd` per the controller's `@RequestParam` contract.
 */
function periodToWindow(
    period: PeriodKey,
    manualRange: ManualDateRange | undefined,
): { fromDate: string; toDate: string } {
    const fmt = (d: Date): string => {
        const yyyy = d.getFullYear().toString().padStart(4, "0");
        const mm   = (d.getMonth() + 1).toString().padStart(2, "0");
        const dd   = d.getDate().toString().padStart(2, "0");
        return `${yyyy}${mm}${dd}`;
    };
    if (period === "manual" && manualRange) {
        return manualRange;
    }
    const days = period === "180d" ? 180 : period === "90d" ? 90 : 30;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    return { fromDate: fmt(start), toDate: fmt(today) };
}
