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
import { useExcelExport, type ExcelExportColumnConfig } from "@/hooks/useExcelExport";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import { ApiCallError } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import type { ApiTransferResultListResponse } from "@/lib/types/api";
import {
    downloadOriginalVendorExcel,
    fetchVendorPaymentResultList,
} from "@/lib/api/vendorPayment";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { formatRegDtmDisplay } from "@/lib/datetime";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import { type VendorResultRow } from "./types";

/**
 * Payment > Vendor Payment > Payment Result — Figma 24:5491.
 *
 * Server-driven for pagination, sort, period, search, and the
 * Completed / In Progress status filter. Toolbar's list-view icon
 * opens the shared `<ViewSettingPopover>` keyed by
 * `payment-vendor-payment-result`. Print routes through the shared
 * `printReport` helper. Excel export currently raises a warning
 * dialog (backend export endpoint pending).
 *
 * Mirrors the Payroll Result page wiring pattern (CLAUDE.md §12a).
 */
export default function VendorPaymentResultPage() {
    const { t } = useTranslation();
    const dialog = useDialog();

    /* ── Toolbar / filter / pagination state ─────────────────────── */
    const [page, setPage]         = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [period, setPeriod]     = useState<PeriodKey>("30d");
    const [manualRange, setManualRange] = useState<ManualDateRange | undefined>(
        undefined,
    );
    const [search, setSearch]     = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<ResultStatusFilter>({
        completed:   false,
        in_progress: false,
    });

    const sort = useTableSort();

    /* ── View Setting popover state ──────────────────────────────── */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_VENDOR_PAYMENT_RESULT,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft]   = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    /* ── Filter-change resets ────────────────────────────────────── */
    function changePeriod(next: PeriodKey)            { setPeriod(next);   setPage(0); }
    function changePageSize(next: number)             { setPageSize(next); setPage(0); }
    function changeSearch(next: string)               { setSearch(next);   setPage(0); }
    function changeStatusFilter(next: ResultStatusFilter) {
        setStatusFilter(next);
        setPage(0);
    }
    function handleSort(fieldId: string) {
        sort.toggleSort(fieldId);
        setPage(0);
    }

    /* ── Map status checkbox state → backend trnf_stts param.
     *    `Y` filter when only "Completed" is checked; `N` filter when
     *    only "In Progress" is checked. Neither (or both) checked
     *    means "no filter" — the backend returns every batch. */
    const trnfStts: "Y" | "N" | undefined = useMemo(() => {
        if (statusFilter.completed && !statusFilter.in_progress)   return "Y";
        if (statusFilter.in_progress && !statusFilter.completed)   return "N";
        return undefined;
    }, [statusFilter]);

    /* ── Data fetch ──────────────────────────────────────────────── */
    const { fromDate, toDate } = useMemo(
        () => periodToWindow(period, manualRange),
        [period, manualRange],
    );
    const state = useApiData(
        () => fetchVendorPaymentResultList({
            fromDate,
            toDate,
            srchWd:        search.trim() || undefined,
            trnfStts,
            page,
            size:          pageSize,
            sortField:     sort.sortParams?.sortField,
            sortDirection: sort.sortParams?.sortDirection,
        }),
        [
            fromDate, toDate, search, trnfStts,
            page, pageSize,
            sort.sortField, sort.sortDirection,
        ],
    );

    /* Stable-data latch + sticky gates — smooth empty/refetch transitions. */
    const [stableData, setStableData] = useState<ApiTransferResultListResponse | null>(state.data);
    const [prevData, setPrevData] = useState<ApiTransferResultListResponse | null>(state.data);
    if (state.data !== prevData) {
        setPrevData(state.data);
        if (state.data) setStableData(state.data);
    }

    const rows: Array<VendorResultRow & PaymentResultBatchRow> = useMemo(
        () => (stableData?.rows ?? []).map(toResultRow),
        [stableData],
    );

    const totals = useMemo(
        () =>
            (stableData?.currency_totals ?? []).map((c) => ({
                currency: c.ccy_cd,
                // formatAmount with symbol so the footer matches the
                // Scheduled page output ("$10.00" / "100.000đ").
                amount: formatAmount(c.total_amount, c.ccy_cd, true),
            })),
        [stableData],
    );
    const totalCount = stableData?.total_count ?? rows.length;

    const stickyInitialLoading = useStickyLoading(state.loading && !stableData);
    const [actionInFlight, setActionInFlight] = useState(false);
    const stickyActionInFlight = useStickyLoading(actionInFlight);

    /* ── Print ───────────────────────────────────────────────────── */
    const handlePrint = useCallback(() => {
        const columns: PrintColumn<VendorResultRow & PaymentResultBatchRow>[] = [
            { header: t("payment.internal.col.date_time"),     render: (r) => escapeHtml(r.dateTime.replace(/\n/g, " ")) },
            { header: t("payment.internal.col.file_name"),     render: (r) => escapeHtml(r.fileName) },
            {
                header: t("payment.internal.col.txn_count"),
                align: "right",
                render: (r) => escapeHtml(t("payment.internal.txn_count_with_currency", {
                    count: String(r.txnCount), currency: r.txnCurrency,
                })),
            },
            { header: t("payment.internal.col.total_transfer"), align: "right", render: (r) => escapeHtml(r.totalAmount) },
            { header: t("payment.internal.col.transfer_status"), render: (r) => escapeHtml(t(`payment.result_status.${r.status}`)) },
            { header: t("payment.internal.col.approval_ref"),   render: (r) => escapeHtml(r.approvalRef) },
            { header: t("payment.internal.col.approval_title"), render: (r) => escapeHtml(r.approvalTitle) },
        ];
        const summary = t("common.showing_of", {
            shown: String(rows.length),
            total: String(totalCount),
        });
        printReport({
            title: t("payment.vendor.result_title"),
            summary,
            columns,
            rows,
        });
    }, [rows, totalCount, t]);

    /* ── View Setting popover ────────────────────────────────────── */
    const handleListView = useCallback((anchorRect: DOMRect) => {
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_RESULT_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    }, [vs.items]);
    const closeViewSetting = useCallback(() => {
        setVsAnchor(null);
        setVsDraft(null);
    }, []);

    /* ── Excel export — shared `useExcelExport` hook POSTs to
     *    `POST /api/v1/payment/vendor-payment/results/export`. Provider:
     *    `VendorPaymentResultExportProvider` (CLAUDE.md §13b). */
    const exportXlsx = useExcelExport();
    const handleExcelExport = useCallback(async () => {
        try {
            await exportXlsx({
                endpoint:     "/api/v1/payment/vendor-payment/results/export",
                screenId:     SCREEN_IDS.PAYMENT_VENDOR_PAYMENT_RESULT,
                dymAreaId:    DEFAULT_AREA_ID,
                fileName:     `${t("payment.vendor.result_title")}_${todayDmy()}`,
                title:        t("payment.vendor.result_title"),
                items:        vs.items.length > 0 ? vs.items : FALLBACK_RESULT_COLUMNS,
                columnConfig: RESULT_EXPORT_COLUMNS,
                t,
                filters: {
                    fromDate,
                    toDate,
                    srchWd:   search.trim() || undefined,
                    trnfStts,
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

    /* ── Per-row download — streams the original uploaded Excel. */
    const handleDownloadRow = useCallback(
        async (row: VendorResultRow & PaymentResultBatchRow) => {
            if (actionInFlight) return;
            setActionInFlight(true);
            try {
                await downloadOriginalVendorExcel(row.id);
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

    return (
        <>
            <PaymentResultBatchListPage<VendorResultRow & PaymentResultBatchRow>
                title={t("payment.vendor.result_title")}
                rows={rows}
                rowDetailHref={(row) =>
                    `/payment/vendor-payment/payment-result/${row.id}`
                }
                totals={totals}
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
                    onPageChange:     setPage,
                    onPageSizeChange: changePageSize,
                }}
                sort={{ field: sort.sortField, direction: sort.sortDirection }}
                sortableColumns={SORTABLE_COLUMNS}
                onSort={handleSort}
                onPrint={handlePrint}
                onListView={handleListView}
                onExcelExport={handleExcelExport}
                onDownloadRow={handleDownloadRow}
                viewSettingItems={vs.items.length > 0 ? vs.items : FALLBACK_RESULT_COLUMNS}
                fieldIdMap={FIELD_ID_MAP}
                emptyMessage={t("payment.vendor.result_empty")}
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
                        try { await vs.save(vsDraft); }
                        finally { closeViewSetting(); }
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
 * Mirror of the V223 SYS_SCR_OPTION_WECMS seed for
 * `payment-vendor-payment-result` / `default`. Paint-time fallback used
 * while the API resolves so the table doesn't flash empty and column
 * widths are correct on first paint.
 *
 * Aligned with legacy `pymn_0002_001` PROD widths + FIELD_IDs (FILE_NM
 * separate from TITL=Approval Title; SCDUL_PYMN_DETL_NO replaces
 * TOT_TRNS_CNT for the count column; PROC_STAT replaces TRNF_YN;
 * APPR_DOC_NO replaces APPR_SEQ_NO).
 */
const FALLBACK_RESULT_COLUMNS: ViewSettingItem[] = [
    { field_id: "TRAN_DT",            field_nm: "Date/Time",             disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "105px", sort_yn: "Y" },
    { field_id: "FILE_NM",            field_nm: "File Name",             disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "290px", sort_yn: "Y" },
    { field_id: "SCDUL_PYMN_DETL_NO", field_nm: "No. of Transactions",   disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "155px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",           field_nm: "Total Transfer Amount", disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "235px", sort_yn: "Y" },
    { field_id: "PROC_STAT",          field_nm: "Transfer Status",       disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "190px", sort_yn: "Y" },
    { field_id: "APPR_DOC_NO",        field_nm: "Approval Ref.",         disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "Y" },
    { field_id: "TITL",               field_nm: "Approval Title",        disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "250px", sort_yn: "Y" },
    { field_id: "ETC",                field_nm: "",                      disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "Y", size: "50px",  sort_yn: "N" },
];

/**
 * FIELD_ID aliases supplied to `<PaymentResultBatchListPage>` so the
 * shell maps each column slot to the legacy V223 FIELD_ID rather than
 * the V150 default (REG_DTM, ORG_FILE_NM, TOT_TRNS_CNT, …).
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
 * Per-column FIELD_ID map. Keys are the stable column identifiers the
 * shared shell understands; values are the backend
 * `VendorPaymentResultSortField` enum names (aligned with V223 legacy
 * FIELD_IDs).
 *
 * Same coverage as Internal Transfer Result — every column maps to an
 * entity property on the shared `ScdulPymnSumr` table.
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

/**
 * Per-column metadata for {@link useExcelExport}. Keys mirror the V223
 * legacy seed; the backend `VendorPaymentResultExportProvider.ALLOWED_FIELD_IDS`
 * allow-list must recognise the same FIELD_ID set — anything not listed
 * here is dropped by the writer with WBE2013.
 */
const RESULT_EXPORT_COLUMNS: Record<string, ExcelExportColumnConfig> = {
    TRAN_DT:            { headerKey: "payment.internal.col.date_time",       format: "text" },
    FILE_NM:            { headerKey: "payment.internal.col.file_name",       format: "text", widthChars: 40 },
    SCDUL_PYMN_DETL_NO: { headerKey: "payment.internal.col.txn_count",       format: "number", align: "right" },
    TRAN_AMT:           { headerKey: "payment.internal.col.total_transfer",  format: "amount", align: "right" },
    PROC_STAT:          { headerKey: "payment.internal.col.transfer_status", format: "text" },
    APPR_DOC_NO:        { headerKey: "payment.internal.col.approval_ref",    format: "text" },
    TITL:               { headerKey: "payment.internal.col.approval_title", format: "text", widthChars: 40 },
};

/** Today as `DDMMYYYY` — matches Account Inquiry export filename suffix. */
function todayDmy(): string {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`;
}

/** PeriodKey → backend `from_date` / `to_date` window (yyyyMMdd). */
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

/**
 * Map an `ApiTransferResultListResponse.rows[*]` wire row onto the
 * Vendor Payment Result list-page row shape. Status is computed from
 * the legacy two-status rule (`pymn_0002_001.ts:443-450`): in_progress
 * until the batch dispatches AND succ+err meet total.
 */
function toResultRow(api: {
    scdul_pymn_no:      string;
    titl:               string;
    file_nm:            string | null;
    appr_seq_no:        string | null;
    total_tran_amt:     string;
    tot_trns_cnt:       string;
    tot_trns_succ_cnt:  string | null;
    tot_trns_error_cnt: string | null;
    trnf_stts:          string | null;
    reg_dtm:            string;
    ccy_cd:             string;
    doc_no:             string | null;
}): VendorResultRow & PaymentResultBatchRow {
    const succ  = Number(api.tot_trns_succ_cnt  ?? "0") || 0;
    const err   = Number(api.tot_trns_error_cnt ?? "0") || 0;
    const total = Number(api.tot_trns_cnt       ?? "0") || 0;
    const isInProgress = api.trnf_stts !== "Y" || (succ + err) < total;
    const status: "completed" | "in_progress" = isInProgress ? "in_progress" : "completed";
    return {
        id:            api.scdul_pymn_no,
        dateTime:      formatRegDtm(api.reg_dtm),
        // File Name sourced from the master's original Excel name (V223 +
        // backend mapper update). Falls back to the approval title for
        // legacy DEV-imported rows whose master has no `orgFileNm`.
        fileName:      api.file_nm ?? api.titl,
        txnCount:      total,
        txnCurrency:   api.ccy_cd,
        // Raw wire decimal — shell re-formats via formatAmount.
        totalAmount:   String(api.total_tran_amt ?? "0"),
        status,
        successCount:  status === "completed" ? succ : undefined,
        failedCount:   status === "completed" ? err  : undefined,
        approvalRef:   api.doc_no ?? "",
        approvalTitle: api.titl,
        fromBank:      "",
    };
}

function formatRegDtm(raw: string | null | undefined): string {
    return formatRegDtmDisplay(raw);
}
