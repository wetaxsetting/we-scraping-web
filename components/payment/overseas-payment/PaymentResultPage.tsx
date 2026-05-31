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
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import {
    downloadOverseasPaymentFile,
    exportOverseasResultList,
    fetchOverseasResultList,
    type ApiOverseasResultListResponse,
    type ApiOverseasResultRow,
} from "@/lib/api/payment";
import { formatAmount } from "@/lib/currency";
import { useApiData } from "@/lib/api/useApiData";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import { useTranslation } from "@/lib/i18n";
import { formatRegDtmDisplay } from "@/lib/datetime";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import { type OverseasResultRow } from "./types";

/**
 * Payment > Overseas Payment > Payment Result — Figma 29:16738.
 *
 * Composes the shared `<PaymentResultBatchListPage>` (CLAUDE.md §12a) with
 * full server-driven wiring: period dropdown, status checkboxes, search,
 * sort, pagination, View Setting popover, Print, Excel export, and per-row
 * file download all reset the page to 0 and re-fire the list call.
 *
 * <p>Default state: page 0 × 10 rows, period "Last 30 Days", default
 * ORDER BY (`reg_dtm DESC`). The toolbar's period dropdown lets the user
 * widen to 90 / 180 days or pick a manual window; each click resets the
 * page to 0 so the user never lands on an out-of-range page.
 */

/**
 * Paint-time fallback — mirrors the V235 sys_scr_option_wecms seed
 * (legacy pymn_0008_001 column set). Used when the API hasn't
 * returned view-setting items yet so the popover paints with the
 * canonical 7 user FIELD_IDs + ETC.
 *
 * Legacy `dym_area_id = 'table2'` collapses to refactor `'default'`;
 * legacy FIELD_ID suffix `_2` is stripped (e.g. `TRAN_DT_2` →
 * `TRAN_DT`). The refactor's 4 extraColumns (PAY_DATE, APPR_STTS,
 * DRAFT_USER_NM, APPRVR) are NOT in the legacy seed — they auto-hide
 * via the shell's `isVisible()` since their FIELD_IDs are unknown
 * when `viewSettingItems` is populated.
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "TRAN_DT",            field_nm: "Date/Time",             disp_ord: 1,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "105px" },
    { field_id: "FILE_NM",            field_nm: "File Name",             disp_ord: 2,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "290px" },
    { field_id: "SCDUL_PYMN_DETL_NO", field_nm: "No. of Transactions",   disp_ord: 3,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "155px" },
    { field_id: "TRAN_AMT",           field_nm: "Total Transfer Amount", disp_ord: 4,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "235px" },
    { field_id: "PROC_STAT",          field_nm: "Transfer Status",       disp_ord: 5,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "190px" },
    { field_id: "APPR_DOC_NO",        field_nm: "Approval Ref.",         disp_ord: 6,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "160px" },
    { field_id: "TITL",               field_nm: "Approval Title",        disp_ord: 7,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "250px" },
    { field_id: "ETC",                field_nm: "",                      disp_ord: 99, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "N", size: "50px"  },
];

/**
 * FIELD_ID aliases supplied to `<PaymentResultBatchListPage>` so the
 * shell maps each canonical column slot to the legacy V235 FIELD_ID
 * rather than the V131 default.
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
 * Per-column FIELD_ID map for the shared shell. Keys are the stable
 * column identifiers the shell understands; values are the backend
 * {@code OverseasResultSortField} enum names (V235 legacy-aligned).
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

export default function OverseasPaymentResultPage() {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [period, setPeriod] = useState<PeriodKey>("30d");
    const [manualRange, setManualRange] = useState<ManualDateRange | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<ResultStatusFilter>({
        completed: false,
        in_progress: false,
    });
    const sort = useTableSort();

    /* ── View Setting popover ─────────────────────────────────────── */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_RESULT,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft]   = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    /* ── Change handlers — all reset page to 0 ──────────────────── */
    function changePeriod(next: PeriodKey)                       { setPeriod(next);          setPage(0); }
    function changeManualRange(next: ManualDateRange | undefined){ setManualRange(next);     setPage(0); }
    function changePageSize(next: number)                        { setPageSize(next);        setPage(0); }
    function handleSort(fieldId: string)                         { sort.toggleSort(fieldId); setPage(0); }
    function changeSearch(next: string)                          { setSearch(next);          setPage(0); }
    function changeStatusFilter(next: ResultStatusFilter)        { setStatusFilter(next);    setPage(0); }

    /* ── Date window ─────────────────────────────────────────────── */
    const { fromDate, toDate } = useMemo(
        () => periodToWindow(period, manualRange),
        [period, manualRange],
    );

    // Translate checkbox state to trnf_yn: both false or both true → absent (all)
    const trnfYn = useMemo((): "Y" | "N" | undefined => {
        if (statusFilter.completed && !statusFilter.in_progress) return "Y";
        if (statusFilter.in_progress && !statusFilter.completed) return "N";
        return undefined;
    }, [statusFilter]);

    /* ── Data fetch ──────────────────────────────────────────────── */
    const state = useApiData(
        () =>
            fetchOverseasResultList({
                from_date:      fromDate,
                to_date:        toDate,
                keyword:        search || undefined,
                trnf_yn:        trnfYn,
                page,
                size:           pageSize,
                sort_field:     sort.sortField ?? undefined,
                sort_direction: sort.sortDirection ?? undefined,
            }),
        [fromDate, toDate, search, trnfYn, page, pageSize, sort.sortField, sort.sortDirection],
    );

    /* Stable-data latch + sticky gates. */
    const [stableData, setStableData] = useState<ApiOverseasResultListResponse | null>(state.data);
    const [prevData, setPrevData] = useState<ApiOverseasResultListResponse | null>(state.data);
    if (state.data !== prevData) {
        setPrevData(state.data);
        if (state.data) setStableData(state.data);
    }
    const data = stableData;
    const stickyInitialLoading = useStickyLoading(state.loading && !stableData);
    const [actionInFlight, setActionInFlight] = useState(false);
    const stickyActionInFlight = useStickyLoading(actionInFlight);

    const displayRows   = data?.rows   ? data.rows.map(mapApiRow) : [];
    // Per-currency totals — backend wire doesn't yet ship a
    // `currency_totals` aggregate for Overseas Payment Result, so
    // sum the visible page rows client-side. Sticky footer's merge
    // logic anchors USD + VND defaults; the KRW entry below ensures
    // the bar always shows three currencies even when the page has
    // no KRW rows.
    const displayTotals = useMemo<{ currency: string; amount: string }[]>(() => {
        const sumByCcy = new Map<string, number>();
        for (const r of displayRows) {
            const n = Number(r.totalAmount);
            if (!Number.isFinite(n)) continue;
            sumByCcy.set(r.txnCurrency, (sumByCcy.get(r.txnCurrency) ?? 0) + n);
        }
        if (!sumByCcy.has("KRW")) sumByCcy.set("KRW", 0);
        return Array.from(sumByCcy.entries()).map(([ccy, sum]) => ({
            currency: ccy,
            amount:   formatAmount(String(sum), ccy, true),
        }));
    }, [displayRows]);
    const totalCount = data?.total_count || 0;

    /* ── Print ───────────────────────────────────────────────────── */
    const handlePrint = useCallback(() => {
        const columns: PrintColumn<OverseasResultRow & PaymentResultBatchRow>[] = [
            { header: t("payment.col.date_time"),                 render: (r) => escapeHtml(r.dateTime.replace(/\n/g, " ")) },
            { header: t("payment.overseas.col.file_name"),        render: (r) => escapeHtml(r.fileName) },
            { header: t("payment.overseas.col.txn_count"),        align: "right", render: (r) => escapeHtml(`${r.txnCount} Trx (${r.txnCurrency})`) },
            { header: t("payment.overseas.col.total_transfer"),   align: "right", render: (r) => escapeHtml(r.totalAmount) },
            { header: t("payment.col.scheduled_date"),            render: (r) => escapeHtml((r as OverseasResultRow).scheduledDate || "-") },
            { header: t("payment.overseas.col.approval_status"),  render: (r) => escapeHtml((r as OverseasResultRow).approvalStatus || "-") },
            { header: t("payment.col.requestor"),                 render: (r) => escapeHtml((r as OverseasResultRow).requestor || "-") },
            { header: t("payment.col.approver"),                  render: (r) => escapeHtml((r as OverseasResultRow).approver || "-") },
            { header: t("payment.overseas.col.approval_ref"),     render: (r) => escapeHtml(r.approvalRef) },
            { header: t("payment.overseas.col.approval_title"),   render: (r) => escapeHtml(r.approvalTitle) },
        ];
        printReport({
            title:   t("payment.overseas.result_title"),
            summary: t("common.showing_of", { shown: String(displayRows.length), total: String(totalCount) }),
            columns,
            rows:    displayRows,
        });
    }, [displayRows, totalCount, t]);

    /* ── View Setting handlers ───────────────────────────────────── */
    const handleListView = useCallback((anchorRect: DOMRect) => {
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    }, [vs.items]);

    const closeViewSetting = useCallback(() => {
        setVsDraft(null);
        setVsAnchor(null);
    }, []);

    /* ── Excel export ────────────────────────────────────────────── */
    const handleExcelExport = useCallback(async () => {
        try {
            await exportOverseasResultList({
                from_date: fromDate,
                to_date:   toDate,
                keyword:   search || undefined,
                trnf_yn:   trnfYn,
            });
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError
                ? err.message
                : t("payment.overseas.export_failed");
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        }
    }, [fromDate, toDate, search, trnfYn, dialog, t]);

    /* ── Per-row file download ───────────────────────────────────── */
    const handleDownloadRow = useCallback(
        async (row: OverseasResultRow & PaymentResultBatchRow) => {
            if (actionInFlight) return;
            setActionInFlight(true);
            try {
                await downloadOverseasPaymentFile(row.id);
            } catch (err) {
                const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
                const message = err instanceof ApiCallError
                    ? err.message
                    : t("payment.overseas.download_failed");
                dialog.open({
                    type:        "error",
                    title:       t("dialog.error"),
                    description: message,
                    errorCode:   code,
                });
            } finally {
                setActionInFlight(false);
            }
        },
        [dialog, t, actionInFlight],
    );

    /* ── Calendar click (coming soon) ───────────────────────────── */
    const handleCalendarClick = useCallback(() => {
        dialog.open({
            type:        "warning",
            title:       t("dialog.warning"),
            description: t("payment.overseas.calendar_coming_soon"),
        });
    }, [dialog, t]);

    return (
        <>
            <PaymentResultBatchListPage<OverseasResultRow>
                title={t("payment.overseas.result_title")}
                rows={displayRows}
                rowDetailHref={(row) =>
                    `/payment/overseas-payment/payment-result/${row.id}`
                }
                totals={displayTotals}
                search={search}
                onSearchChange={changeSearch}
                period={period}
                onPeriodChange={changePeriod}
                manualRange={manualRange}
                onManualRangeChange={changeManualRange}
                statusFilter={statusFilter}
                onStatusFilterChange={changeStatusFilter}
                sort={{
                    field:      sort.sortField,
                    direction:  sort.sortDirection,
                }}
                sortableColumns={SORTABLE_COLUMNS}
                onSort={handleSort}
                onPrint={handlePrint}
                onListView={handleListView}
                onExcelExport={handleExcelExport}
                onDownloadRow={handleDownloadRow}
                onCalendarClick={handleCalendarClick}
                viewSettingItems={vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS}
                fieldIdMap={FIELD_ID_MAP}
                pagination={{
                    page,
                    pageSize,
                    totalCount,
                    onPageChange:     setPage,
                    onPageSizeChange: changePageSize,
                }}
                extraColumns={[
                    {
                        fieldId:     "PAY_DATE",
                        header:      "Scheduled Date",
                        renderCell:  (row) => row.scheduledDate || "-",
                        width:       "140px",
                        sortFieldId: "PAY_DATE",
                    },
                    {
                        fieldId:     "APPR_STTS",
                        header:      "Approval Status",
                        renderCell:  (row) => row.approvalStatus || "-",
                        width:       "140px",
                        sortFieldId: "APPR_STTS",
                    },
                    {
                        fieldId:     "DRAFT_USER_NM",
                        header:      "Requestor",
                        renderCell:  (row) => row.requestor || "-",
                        width:       "140px",
                        sortFieldId: "DRAFT_USER_NM",
                    },
                    {
                        fieldId:    "APPRVR",
                        header:     "Approver",
                        renderCell: (row) => row.approver || "-",
                        width:      "140px",
                    },
                ]}
                emptyMessage={t("payment.overseas.result_empty")}
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

/* ── Helpers ───────────────────────────────────────────────────────── */

function mapApprovalStatus(code: string | null | undefined): string {
    if (!code) return "-";
    switch (code) {
        case "00": return "Pending";
        case "01": return "Approved";
        case "02": return "Rejected";
        case "03": return "Cancelled";
        default:   return code;
    }
}

function mapApiRow(api: ApiOverseasResultRow): OverseasResultRow {
    return {
        id:            api.ovrs_pymn_no,
        dateTime:      formatRegDtmDisplay(api.reg_dtm),
        fileName:      api.file_nm || "-",
        txnCount:      api.tot_trns_cnt,
        txnCurrency:   api.ccy_cd,
        totalAmount:   api.total_tran_amt.toString(),
        status:        api.trnf_yn === "Y" ? "completed" : "in_progress",
        successCount:  api.success_count || undefined,
        failedCount:   api.failed_count  || undefined,
        approvalRef:   api.doc_no        || "-",
        approvalTitle: api.titl          || "-",
        fromBank:      api.out_bank_nm   || "-",
        fromAccount:   api.wdrl_act_no   || undefined,
        fromCurrency:  api.ccy_cd,
        requestor:     api.draft_user_nm || api.reg_id || "-",
        approver:      api.apprvr_nm     || "-",
        scheduledDate: api.pay_date
            ? api.pay_date.replace(/^(\d{4})(\d{2})(\d{2})$/, "$3-$2-$1")
            : "-",
        approvalStatus: mapApprovalStatus(api.appr_stts),
    };
}

/**
 * Map a {@link PeriodKey} (+ optional manual range) to the backend
 * `from_date / to_date` window. Always ends today for the day-back
 * presets; "manual" returns the page-supplied window verbatim. Output
 * format is `yyyyMMdd` (no separators) per the controller's
 * `@RequestParam` contract.
 */
function periodToWindow(
    period: PeriodKey,
    manualRange?: ManualDateRange,
): { fromDate: string; toDate: string } {
    if (period === "manual" && manualRange) {
        return manualRange;
    }
    const fmt = (d: Date): string =>
        d.getFullYear().toString().padStart(4, "0") +
        (d.getMonth() + 1).toString().padStart(2, "0") +
        d.getDate().toString().padStart(2, "0");
    const days  = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 180;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    return { fromDate: fmt(start), toDate: fmt(today) };
}
