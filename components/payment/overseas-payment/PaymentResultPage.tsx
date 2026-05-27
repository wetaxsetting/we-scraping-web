"use client";

import { useCallback, useMemo, useState } from "react";

import PaymentResultBatchListPage, {
    type PaymentResultBatchRow,
    type ResultBatchSortable,
    type ResultStatusFilter,
} from "@/components/payment/shared/PaymentResultBatchListPage";
import type { PeriodKey } from "@/components/payment/shared/PaymentScheduledBatchListPage";
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
    type ApiOverseasResultRow,
} from "@/lib/api/payment";
import { useApiData } from "@/lib/api/useApiData";
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
 * <p>Default state: page 0 × 10 rows, period "Last 180 Days", default
 * ORDER BY (`reg_dtm DESC`). The toolbar's period dropdown lets the user
 * narrow to 7 / 30 / 90 days; each click resets the page to 0 so the
 * user never lands on an out-of-range page.
 */

/**
 * Paint-time fallback — mirrors the V177 sys_scr_option_wecms seed.
 * Used when the API hasn't returned view-setting items yet (first render
 * or migration not yet applied) so all columns remain visible instead of
 * being hidden by the empty-array → all-false isVisible() path.
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "REG_DTM",        field_nm: "Date/Time",             disp_ord: 1,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "ORG_FILE_NM",    field_nm: "File Name",             disp_ord: 2,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "TOT_TRNS_CNT",   field_nm: "No. of Transactions",   disp_ord: 3,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "TOTAL_TRAN_AMT", field_nm: "Total Transfer Amount", disp_ord: 4,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "PAY_DATE",       field_nm: "Scheduled Date",        disp_ord: 5,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "APPR_STTS",      field_nm: "Approval Status",       disp_ord: 6,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "DRAFT_USER_NM",  field_nm: "Requestor",             disp_ord: 7,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "APPRVR",         field_nm: "Approver",              disp_ord: 8,  use_yn: "N", fix_yn: "N", disp_yn: "Y", sort_yn: "N" },
    { field_id: "APPR_SEQ_NO",    field_nm: "Approval Ref.",         disp_ord: 9,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "TITL",           field_nm: "Approval Title",        disp_ord: 10, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
];

/**
 * Per-column FIELD_ID map. Keys are the stable column identifiers the
 * shared shell understands; values are the backend
 * `OverseasPaymentResultSortField` enum names. Columns missing from the map
 * render without sort wiring.
 */
const SORTABLE_COLUMNS: ResultBatchSortable = {
    DATE_TIME:      "REG_DTM",
    FILE_NAME:      "ORG_FILE_NM",
    TXN_COUNT:      "TOT_TRNS_CNT",
    TOTAL_AMOUNT:   "TOTAL_TRAN_AMT",
    APPROVAL_REF:   "DOC_NO",
    APPROVAL_TITLE: "APPR_TITL",
};

export default function OverseasPaymentResultPage() {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [period, setPeriod] = useState<PeriodKey>("180d");
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
    function changePeriod(next: PeriodKey)               { setPeriod(next);       setPage(0); }
    function changePageSize(next: number)                { setPageSize(next);     setPage(0); }
    function handleSort(fieldId: string)                 { sort.toggleSort(fieldId); setPage(0); }
    function changeSearch(next: string)                  { setSearch(next);       setPage(0); }
    function changeStatusFilter(next: ResultStatusFilter){ setStatusFilter(next); setPage(0); }

    /* ── Date window ─────────────────────────────────────────────── */
    const { fromDate, toDate } = useMemo(() => periodToWindow(period), [period]);

    // Translate checkbox state to trnf_yn: both false or both true → absent (all)
    const trnfYn = useMemo((): "Y" | "N" | undefined => {
        if (statusFilter.completed && !statusFilter.in_progress) return "Y";
        if (statusFilter.in_progress && !statusFilter.completed) return "N";
        return undefined;
    }, [statusFilter]);

    /* ── Data fetch ──────────────────────────────────────────────── */
    const { data } = useApiData(
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

    const displayRows   = data?.rows   ? data.rows.map(mapApiRow) : [];
    const displayTotals: { currency: string; amount: string }[] = [];
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
            }
        },
        [dialog, t],
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
 * Map a {@link PeriodKey} to the backend `from_date / to_date` window.
 * Always ends today; start is N days back. Output format is
 * `yyyyMMdd` (no separators) per the controller's `@RequestParam` contract.
 */
function periodToWindow(period: PeriodKey): { fromDate: string; toDate: string } {
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
