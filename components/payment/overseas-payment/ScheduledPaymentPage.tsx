"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import PaymentScheduledBatchListPage, {
    type PaymentScheduledBatchRow,
    type ScheduledBatchSortable,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";
import type {
    DateRangeFilterValue,
    DateRangeFilterPreset,
} from "@/components/shared/DateRangeFilter";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import { useTableSort } from "@/hooks/useTableSort";
import {
    fetchOverseasScheduledList,
    fetchOverseasScheduledById,
    fetchOverseasPaymentDetail,
    fetchOverseasWithdrawalAccounts,
    downloadOverseasPaymentFile,
    removeOverseasApprovalLine,
    actOnOverseasApproval,
    type ApiOverseasScheduledRow,
    type ApiOverseasApprover,
    type ApiOverseasPaymentExcelDetailRow,
    type ApiOverseasPaymentDetailResponse,
} from "@/lib/api/payment";
import { useApiData } from "@/lib/api/useApiData";
import { useDialog } from "@/components/shared/dialog";
import RequestApprovalDialog, {
    type RequestApprovalRow,
    type RequestApprovalTransaction,
    type RequestApprovalAccount,
} from "../shared/RequestApprovalDialog";
import ApprovalDetailsDialog, {
    type ApprovalDetailsApprover,
    type ApprovalOutcome,
    type ApproverStatusCode,
} from "../shared/ApprovalDetailsDialog";
import { useTranslation } from "@/lib/i18n";
import { userStorage } from "@/lib/auth/storage";
import { formatRegDtmDisplay } from "@/lib/datetime";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import { cn } from "@/lib/utils";

import OverseasExcelUploadModal from "./OverseasExcelUploadModal";
import ChangeApproverDialog from "./ChangeApproverDialog";
import { type OverseasScheduledRow } from "./types";

/* ─────────────────────────────────────────────────────────────────────────
 *  Helpers
 * ───────────────────────────────────────────────────────────────────────── */

function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetDaysIso(iso: string, days: number): string {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatRegDtm(raw: string | null | undefined): string {
    return formatRegDtmDisplay(raw);
}

function formatApiDate(dt: string | null | undefined): string {
    if (!dt || dt.length < 8) return dt ?? "";
    return `${dt.slice(6, 8)}-${dt.slice(4, 6)}-${dt.slice(0, 4)}`;
}

function deriveStatus(
    apprStts: string | null | undefined,
    trnfYn:   string | null | undefined,
    apprSeqNo: string | null | undefined,
): ApprovalStatus | undefined {
    switch (apprStts) {
        case "C": return "approved";
        case "X": return "rejected";
        case "P": return "pending";
        case "I": return "in_progress";
    }
    if (trnfYn === "Y") return "approved";
    if (apprSeqNo) return "pending";
    return undefined;
}

function mapApiRow(api: ApiOverseasScheduledRow): OverseasScheduledRow & PaymentScheduledBatchRow {
    const status = deriveStatus(api.appr_stts, api.trnf_yn, api.appr_seq_no);

    // Only set transfer/complete action when the batch has been approved —
    // mirrors expense payment's toListRow logic. Unapproved batches show
    // the Delete pill instead.
    const isApproved = api.appr_stts === "C" || api.trnf_yn === "Y";
    let action: "transfer" | "complete" | undefined;
    if (isApproved && api.trnf_yn === "Y") {
        action = "complete";
    } else if (isApproved && api.trnf_yn !== "Y" && api.appr_seq_no) {
        action = "transfer";
    }

    // Show "X/Y" fraction next to status badge when approver count is known.
    // Omit when tot = 0 (Phase A stamp-only: EXPT_RESOL_MSTR not yet written).
    const tot      = api.apprvr_tot_cnt ?? 0;
    const approved = api.apprvr_appr_tot_cnt ?? 0;
    const statusStep = tot > 0 ? `${approved}/${tot}` : undefined;

    return {
        id:            api.ovrs_pymn_no,
        dateTime:      formatRegDtm(api.reg_dtm),
        fileName:      api.titl || api.file_nm || api.bnfc_nm || "-",
        txnCount:      Number(api.tot_trns_cnt) || 0,
        txnCurrency:   api.ccy_cd,
        totalAmount:   api.total_tran_amt?.toString() ?? "0",
        status,
        statusStep,
        requestor:     api.draft_user_nm || api.reg_id || "-",
        approver:      "-",
        approvalRef:   api.appr_seq_no ?? "",
        approvalTitle: api.titl || "-",
        action,
        rowHighlight:    api.appr_seq_no ? undefined : "warning",
        canDelete:       !api.appr_seq_no,
        canDownloadFile: Boolean(api.file_nm),
        fromBank:        api.out_bank_nm || "-",
        fromAccount:     api.wdrl_act_no ?? undefined,
        scheduleDate:    formatApiDate(api.pay_date),
        rawApprovers:    api.approvers ?? [],
    };
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Constants
 * ───────────────────────────────────────────────────────────────────────── */

const APPR_TYPE_OPTIONS = [
    { value: "",   labelKey: "payment.internal.filter.all_status" },
    { value: "00", labelKey: "payment.appr_stts.draft" },
    { value: "01", labelKey: "payment.appr_stts.approved" },
    { value: "02", labelKey: "payment.appr_stts.rejected" },
    { value: "03", labelKey: "payment.appr_stts.in_progress" },
    { value: "04", labelKey: "payment.appr_stts.pending" },
    { value: "99", labelKey: "payment.appr_stts.cancelled" },
] as const;

const SORTABLE_COLUMNS: ScheduledBatchSortable = {
    DATE_TIME:      "REG_DTM",
    TXN_COUNT:      "TOT_TRNS_CNT",
    TOTAL_AMOUNT:   "TOTAL_TRAN_AMT",
    STATUS:         "APPR_STTS",
    REQUESTOR:      "REG_ID",
    APPROVAL_REF:   "APPR_SEQ_NO",
    APPROVAL_TITLE: "TITL",
    // APPROVER omitted — resolved from a separate batch query, not a SQL alias in the UNION result
};

/**
 * Paint-time fallback — mirrors the V178 sys_scr_option_wecms seed.
 * Used when the API hasn't returned view-setting items yet so all columns
 * remain visible instead of being hidden by the empty-array → all-false
 * isVisible() path.
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "REG_DTM",        field_nm: "Date/Time",             disp_ord: 1, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "TITL",           field_nm: "File Name",             disp_ord: 2, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "N" },
    { field_id: "TOT_TRNS_CNT",   field_nm: "No. of Transactions",   disp_ord: 3, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "TOTAL_TRAN_AMT", field_nm: "Total Transfer Amount", disp_ord: 4, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "APPR_STTS",      field_nm: "Approval Status",       disp_ord: 5, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "REG_ID",         field_nm: "Requestor",             disp_ord: 6, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
    { field_id: "APPR_SEQ_NO",    field_nm: "Approval Ref.",         disp_ord: 7, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y" },
];

/* ─────────────────────────────────────────────────────────────────────────
 *  Page
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Payment > Overseas Payment > Scheduled Payment — Figma 29:14947.
 *
 * Mirrors the Expense Payment baseline. Server-driven pagination, sort,
 * date-range (30 / 90 / 180 days preset or manual), and approval-status
 * filter. Excel Upload wires through `<OverseasExcelUploadModal>`.
 */
export default function OverseasScheduledPaymentPage() {
    const { t } = useTranslation();
    const dialog = useDialog();
    /* ── View Setting popover ─────────────────────────────────────── */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_SCHEDULED,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft]   = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    const handleListView = useCallback((anchorRect: DOMRect) => {
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    }, [vs.items]);

    const closeViewSetting = useCallback(() => {
        setVsDraft(null);
        setVsAnchor(null);
    }, []);

    /* ── Toolbar / filter / pagination state ─────────────────────── */
    const [page, setPage]             = useState(0);
    const [pageSize, setPageSize]     = useState(10);
    const [apprType, setApprType]     = useState("");
    const [search, setSearch]         = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const refreshList = useCallback(() => setRefreshKey((k) => k + 1), []);

    const sort = useTableSort();

    /* ── Excel Upload state ──────────────────────────────────────── */
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadKey, setUploadKey]   = useState(0);
    function openUpload() {
        setUploadKey((k) => k + 1);
        setUploadOpen(true);
    }

    /* ── Date-range filter state ─────────────────────────────────── */
    const [dateRange, setDateRange] = useState<DateRangeFilterValue>({
        mode:   "preset",
        preset: "last_30_days",
        start:  offsetDaysIso(todayIso(), -30),
        end:    todayIso(),
    });
    const [dateOpen, setDateOpen] = useState(false);

    /* ── Request Approval state ──────────────────────────────────── */
    const [approvalRows, setApprovalRows] = useState<
        Array<OverseasScheduledRow & PaymentScheduledBatchRow> | null
    >(null);

    /* ── Approval Details dialog state ─────────────────────────────── */
    const [detailsView, setDetailsView] = useState<{
        row:       OverseasScheduledRow & PaymentScheduledBatchRow;
        detail:    ApiOverseasPaymentDetailResponse;
        approvers: ApprovalDetailsApprover[];
    } | null>(null);

    /* ── Change Approver dialog state ───────────────────────────────── */
    const [changeApproverTarget, setChangeApproverTarget] = useState<{
        row:       OverseasScheduledRow & PaymentScheduledBatchRow;
        detail:    ApiOverseasPaymentDetailResponse;
        approvers: ApprovalDetailsApprover[];
    } | null>(null);

    /* ── Filter-change resets ────────────────────────────────────── */
    function changePage(next: number)     { setPage(next); }
    function changePageSize(next: number) { setPageSize(next); setPage(0); }
    function changeApprType(next: string) { setApprType(next); setPage(0); }
    function changeSearch(next: string)   { setSearch(next);   setPage(0); }
    function handleSort(fieldId: string)  { sort.toggleSort(fieldId); setPage(0); }

    const handleDeleteRow = useCallback(
        (row: OverseasScheduledRow & PaymentScheduledBatchRow) => {
            dialog.open({
                type:        "confirmation",
                title:       t("dialog.confirmation"),
                description: t("payment.expense.delete_confirm_description", { fileName: row.fileName }),
                confirmText: t("dialog.continue"),
                cancelText:  t("dialog.cancel"),
                destructive: true,
                onConfirm: async () => {
                    // Delete endpoint — Phase B
                    refreshList();
                },
            });
        },
        [dialog, refreshList, t],
    );

    const handleDownloadRow = useCallback(
        async (row: OverseasScheduledRow & PaymentScheduledBatchRow) => {
            try {
                await downloadOverseasPaymentFile(row.id);
            } catch (err) {
                const message = err instanceof Error ? err.message : t("payment.overseas.download_failed");
                dialog.open({ type: "error", title: t("dialog.error"), description: message });
            }
        },
        [dialog, t],
    );

    const handleDateRangeChange = useCallback((val: DateRangeFilterValue) => {
        let nextStart = val.start;
        const nextEnd = todayIso();
        if (val.mode === "preset") {
            if (val.preset === "last_30_days")  nextStart = offsetDaysIso(nextEnd, -30);
            if (val.preset === "last_90_days")  nextStart = offsetDaysIso(nextEnd, -90);
            if (val.preset === "last_180_days") nextStart = offsetDaysIso(nextEnd, -180);
        }
        setDateRange({ ...val, start: nextStart, end: nextEnd });
        setPage(0);
    }, []);

    const handleRequestApproval = useCallback(
        (chosen: Array<OverseasScheduledRow & PaymentScheduledBatchRow>) => {
            if (chosen.length === 0) {
                dialog.open({
                    type:        "warning",
                    title:       t("dialog.warning"),
                    description: t("payment.request_approval.no_rows_selected"),
                });
                return;
            }
            const alreadySubmitted = chosen.filter((r) => Boolean(r.approvalRef));
            if (alreadySubmitted.length > 0) {
                dialog.open({
                    type:        "warning",
                    title:       t("dialog.warning"),
                    description: t("payment.request_approval.already_submitted", {
                        count: String(alreadySubmitted.length),
                    }),
                });
                return;
            }
            setApprovalRows(chosen);
        },
        [dialog, t],
    );

    const handleDetailsMenuAction = useCallback(
        (action: "edit" | "withdraw" | "resubmit") => {
            if (!detailsView) return;
            const row = detailsView.row;
            if (action === "edit") {
                setChangeApproverTarget({
                    row,
                    detail:    detailsView.detail,
                    approvers: detailsView.approvers,
                });
                setDetailsView(null);
            } else if (action === "withdraw") {
                // "Withdraw" from Approval Details dialog = retract pending approval.
                // The row always has approvalRef here (dialog only opens for submitted rows).
                setDetailsView(null);
                dialog.open({
                    type:        "confirmation",
                    title:       t("dialog.confirmation"),
                    description: t("payment.overseas.remove_approval_confirm", { fileName: row.fileName }),
                    confirmText: t("dialog.continue"),
                    cancelText:  t("dialog.cancel"),
                    destructive: true,
                    onConfirm: async () => {
                        try {
                            await removeOverseasApprovalLine(row.id);
                            refreshList();
                        } catch (err) {
                            const message = err instanceof Error ? err.message : String(err);
                            dialog.open({ type: "error", title: t("dialog.error"), description: message });
                        }
                    },
                });
            }
        },
        [detailsView, dialog, refreshList, t],
    );

    const handleApprove = useCallback(async () => {
        if (!detailsView) return;
        const id = detailsView.row.id;
        setDetailsView(null);
        try {
            await actOnOverseasApproval(id, { action: "APPROVE" });
            refreshList();
            dialog.open({ type: "success", title: t("dialog.success"), description: t("payment.overseas.approve_success") });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            dialog.open({ type: "error", title: t("dialog.error"), description: message });
        }
    }, [detailsView, dialog, refreshList, t]);

    const handleReject = useCallback(async () => {
        if (!detailsView) return;
        const id = detailsView.row.id;
        setDetailsView(null);
        try {
            await actOnOverseasApproval(id, { action: "REJECT" });
            refreshList();
            dialog.open({ type: "success", title: t("dialog.success"), description: t("payment.overseas.reject_success") });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            dialog.open({ type: "error", title: t("dialog.error"), description: message });
        }
    }, [detailsView, dialog, refreshList, t]);

    const handleApprovalRefClick = useCallback(
        (row: OverseasScheduledRow & PaymentScheduledBatchRow): void => {
            if (!row.approvalRef) return;
            Promise.all([
                fetchOverseasPaymentDetail(row.id),
                fetchOverseasScheduledById(row.id),
            ])
                .then(([detail, freshRow]) => {
                    const mappedRow = mapApiRow(freshRow);
                    const approvers = bridgeApprovers(freshRow.approvers ?? []);
                    setDetailsView({ row: mappedRow, detail, approvers });
                })
                .catch((err) => {
                    const message = err instanceof Error ? err.message : t("payment.internal.detail_load_failed");
                    dialog.open({ type: "error", title: t("dialog.error"), description: message });
                });
        },
        [dialog, t],
    );

    /* ── Data fetch ──────────────────────────────────────────────── */
    const state = useApiData(
        () => fetchOverseasScheduledList({
            from_dt:        dateRange.start.replace(/-/g, ""),
            to_dt:          dateRange.end.replace(/-/g, ""),
            appr_type_cd:   apprType ? [apprType] : undefined,
            keyword:        search.trim() || undefined,
            page,
            size:           pageSize,
            sort_field:     sort.sortField ?? undefined,
            sort_direction: sort.sortDirection ?? undefined,
        }),
        [dateRange.start, dateRange.end, apprType, search, page, pageSize, refreshKey, sort.sortField, sort.sortDirection],
    );

    const rows = useMemo(
        (): Array<OverseasScheduledRow & PaymentScheduledBatchRow> =>
            (state.data?.rows ?? []).map(mapApiRow),
        [state.data],
    );

    const totals = useMemo(
        () => (state.data?.totals ?? []).map((tot) => ({
            currency: tot.ccy_cd,
            amount:   tot.total_tran_amt?.toString() ?? "0",
        })),
        [state.data],
    );
    const totalCount = state.data?.total_count ?? 0;

    const handlePrint = useCallback(() => {
        type ScheduledRow = OverseasScheduledRow & PaymentScheduledBatchRow;
        const columns: PrintColumn<ScheduledRow>[] = [
            { header: t("payment.col.date_time"),                render: (r) => escapeHtml(r.dateTime.replace(/\n/g, " ")) },
            { header: t("payment.overseas.col.file_name"),       render: (r) => escapeHtml(r.fileName) },
            { header: t("payment.overseas.col.txn_count"),       align: "right", render: (r) => escapeHtml(`${r.txnCount} Transaction (${r.txnCurrency})`) },
            { header: t("payment.col.scheduled_date"),           render: (r) => escapeHtml((r as OverseasScheduledRow).scheduleDate || "-") },
            { header: t("payment.overseas.col.approval_status"), render: (r) => escapeHtml(r.status ? t(`payment.appr_stts.${r.status}`) : "-") },
            { header: t("payment.col.requestor"),                render: (r) => escapeHtml(r.requestor || "-") },
            { header: t("payment.overseas.col.approval_ref"),    render: (r) => escapeHtml(r.approvalRef || "-") },
            { header: t("payment.overseas.col.approval_title"),  render: (r) => escapeHtml(r.approvalTitle || "-") },
        ];
        printReport({
            title:   t("payment.overseas.scheduled_title"),
            summary: `${dateRange.start} ~ ${dateRange.end}`,
            columns,
            rows,
        });
    }, [rows, dateRange, t]);

    return (
        <>
            <PaymentScheduledBatchListPage<OverseasScheduledRow & PaymentScheduledBatchRow>
                title={t("payment.overseas.scheduled_title")}
                onPrint={handlePrint}
                rows={rows}
                rowDetailHref={(row) => `/payment/overseas-payment/scheduled-payment/${row.id}`}
                onApprovalRefClick={handleApprovalRefClick}
                tableMinWidth="var(--w-wb-st-table-min-overseas)"
                viewSettingItems={vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS}
                onListView={handleListView}
                extraColumn={{
                    key:         "scheduleDate",
                    label:       t("payment.internal.col.schedule_date"),
                    width:       "var(--w-wb-st-schedule-date)",
                    sortFieldId: "PAY_DATE",
                    render: (row) => (
                        <span className="block truncate text-wb-13 font-medium text-wb-ink">
                            {row.scheduleDate}
                        </span>
                    ),
                }}
                totals={totals}
                search={search}
                onSearchChange={changeSearch}
                pagination={{
                    page,
                    pageSize,
                    totalCount,
                    onPageChange:     changePage,
                    onPageSizeChange: changePageSize,
                }}
                sort={{ field: sort.sortField, direction: sort.sortDirection }}
                sortableColumns={SORTABLE_COLUMNS}
                onSort={handleSort}
                onExcelUpload={openUpload}
                onDeleteRow={handleDeleteRow}
                onDownloadRow={handleDownloadRow}
                onRequestApproval={handleRequestApproval}
                toolbarFilters={
                    <>
                        <DateFilterDropdown
                            value={dateRange}
                            open={dateOpen}
                            onToggle={() => setDateOpen((o) => !o)}
                            onChange={(next) => {
                                handleDateRangeChange(next);
                                setDateOpen(false);
                            }}
                            onClose={() => setDateOpen(false)}
                        />
                        <ApprTypeDropdown
                            value={apprType}
                            options={APPR_TYPE_OPTIONS}
                            onChange={changeApprType}
                        />
                    </>
                }
            />

            {uploadOpen && (
                <OverseasExcelUploadModal
                    key={uploadKey}
                    onClose={() => setUploadOpen(false)}
                    onSaved={() => {
                        setUploadOpen(false);
                        setPage(0);
                        refreshList();
                    }}
                />
            )}

            {approvalRows && (
                <RequestApprovalDialog
                    kind="overseas-payment"
                    selectedRows={approvalRows.map(toApprovalDialogRow)}
                    loadTransactions={async () => {
                        if (!approvalRows || approvalRows.length === 0) return [];
                        const out: RequestApprovalTransaction[] = [];
                        for (const row of approvalRows) {
                            try {
                                const detail = await fetchOverseasPaymentDetail(row.id);
                                (detail.rows ?? []).forEach((line, idx) => {
                                    out.push(detailLineToApprovalTransaction(line, detail.ccy_cd, row.id, idx));
                                });
                            } catch { /* Skip per-row failures */ }
                        }
                        return out;
                    }}
                    loadWithdrawalAccounts={async () => {
                        const list = await fetchOverseasWithdrawalAccounts();
                        return list.map((r) => ({
                            bankCd:     r.bank_cd,
                            bankNm:     r.bank_nm,
                            acctNo:     r.acct_no,
                            ccyCd:      r.ccy_cd,
                            acctTypeCd: r.acct_type_cd,
                            acctNickNm: r.acct_nick_nm,
                        }));
                    }}
                    onClose={() => setApprovalRows(null)}
                    onSubmitted={() => {
                        setApprovalRows(null);
                        setPage(0);
                        refreshList();
                    }}
                />
            )}

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

            {detailsView && (
                <ApprovalDetailsDialog
                    kind="overseas-payment"
                    title={detailsView.detail.titl || detailsView.row.fileName}
                    status={detailStatusToOutcome(
                        detailsView.detail.appr_stts,
                        detailsView.row.status,
                    )}
                    documentNo={detailsView.detail.doc_no || detailsView.row.id}
                    scheduledDate={detailsView.row.scheduleDate}
                    totalAmount={detailsView.detail.total_tran_amt?.toString() ?? "0"}
                    withdrawalAccount={{
                        bankNm:  detailsView.detail.out_bank_cd,
                        acctNo:  detailsView.detail.wdrl_act_no,
                        ccyCd:   detailsView.detail.wdrl_ccy_cd ?? detailsView.detail.ccy_cd,
                    }}
                    transactions={detailsView.detail.rows.map((line, idx) =>
                        detailLineToApprovalTransaction(
                            line,
                            detailsView.detail.ccy_cd,
                            detailsView.row.id,
                            idx,
                        ),
                    )}
                    approvers={detailsView.approvers}
                    requestedBy={detailsView.detail.reg_id || detailsView.row.requestor}
                    requestedAt={detailsView.row.dateTime.replace(/\n/g, " ")}
                    onClose={() => setDetailsView(null)}
                    onMenuAction={handleDetailsMenuAction}
                    onApprove={
                        detailsView.detail.appr_stts === "P" &&
                        detailsView.approvers.some((a) => a.id === userStorage.get()?.userId)
                            ? handleApprove
                            : undefined
                    }
                    onReject={
                        detailsView.detail.appr_stts === "P" &&
                        detailsView.approvers.some((a) => a.id === userStorage.get()?.userId)
                            ? handleReject
                            : undefined
                    }
                />
            )}

            {changeApproverTarget && (
                <ChangeApproverDialog
                    paymentId={changeApproverTarget.row.id}
                    title={changeApproverTarget.detail.titl || changeApproverTarget.row.fileName}
                    documentNo={changeApproverTarget.detail.doc_no || changeApproverTarget.row.id}
                    scheduledDate={changeApproverTarget.row.dateTime?.split("\n")[0]}
                    totalAmount={changeApproverTarget.detail.total_tran_amt}
                    ccyCd={changeApproverTarget.detail.ccy_cd}
                    withdrawalBank={changeApproverTarget.detail.out_bank_cd}
                    withdrawalAcct={changeApproverTarget.detail.wdrl_act_no}
                    transactions={changeApproverTarget.detail.rows}
                    requestedBy={changeApproverTarget.detail.reg_id || changeApproverTarget.row.requestor}
                    requestedAt={changeApproverTarget.row.dateTime.replace(/\n/g, " ")}
                    initialApprovers={changeApproverTarget.approvers.map((a) => ({
                        apprvr_id: a.id,
                        apprvr_nm: a.name,
                    }))}
                    onClose={() => setChangeApproverTarget(null)}
                    onSaved={() => {
                        setChangeApproverTarget(null);
                        refreshList();
                    }}
                />
            )}
        </>
    );
}

function rowStatusToOutcome(status: ApprovalStatus | undefined): ApprovalOutcome {
    switch (status) {
        case "approved":
        case "rejected":
        case "in_progress":
        case "pending":
            return status;
        default:
            return "pending";
    }
}

function detailStatusToOutcome(
    masterApprStts: string | null,
    rowStatus: ApprovalStatus | undefined,
): ApprovalOutcome {
    switch (masterApprStts) {
        case "C": return "approved";
        case "X": return "rejected";
        case "P": return "pending";
        case "I": return "in_progress";
    }
    return rowStatusToOutcome(rowStatus);
}

function bridgeApprovers(
    approvers: ApiOverseasApprover[],
): ApprovalDetailsApprover[] {
    if (!approvers || approvers.length === 0) return [];

    const formatAt = (raw: string | null) => {
        if (!raw || raw.length < 12) return undefined;
        return `${raw.slice(6, 8)}-${raw.slice(4, 6)}-${raw.slice(0, 4)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}`;
    };

    return approvers.map((a, idx) => {
        const stts = (a.apprvr_stts || "W") as ApproverStatusCode;
        const acted = (stts === "A" || stts === "R") ? formatAt(a.mod_dtm) : undefined;
        return {
            seq:     idx + 1,
            id:      a.apprvr_id,
            name:    a.apprvr_nm,
            outcome: stts,
            actedAt: acted,
            imgUrl:  a.reg_img_url ?? undefined,
        };
    });
}

function toApprovalDialogRow(
    row: OverseasScheduledRow & PaymentScheduledBatchRow,
): RequestApprovalRow {
    return {
        id:          row.id,
        fileName:    row.fileName,
        ccyCd:       row.txnCurrency,
        totalAmount: row.totalAmount,
        txnCount:    row.txnCount,
    };
}

function detailLineToApprovalTransaction(
    line: ApiOverseasPaymentExcelDetailRow,
    batchCcy: string,
    rowId: string,
    idx: number,
): RequestApprovalTransaction {
    return {
        id:               `${rowId}-${line.trn_seq || idx}`,
        depositBankCode:  line.bic_cd ?? "",
        depositBankName:  line.bnfc_bank_nm ?? "",
        depositBankCcyCd: line.ccy_cd ?? batchCcy,
        depositAccountNo: line.bnfc_acct_no ?? "",
        transferAmount:   line.trnf_amt?.toString() ?? "0",
        recipientName:    line.bnfc_nm ?? undefined,
        remarks:          line.memo ?? undefined,
        description:      line.memo ?? undefined,
        reportingAccount: line.rprt_acct_cd ?? undefined,
        feePayer:         line.fee_payer_cd ?? undefined,
    };
}

/* ─────────────────────────────────────────────────────────────────────────
 *  DateFilterDropdown
 *  Handles both Presets and Manual entry in a single popover.
 * ───────────────────────────────────────────────────────────────────────── */

function DateFilterDropdown({
    value,
    open,
    onToggle,
    onChange,
    onClose,
}: {
    value: DateRangeFilterValue;
    open: boolean;
    onToggle: () => void;
    onChange: (val: DateRangeFilterValue) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [view, setView] = useState<"presets" | "manual">("presets");

    // Internal state for manual entry before "Save"
    const [tempStart, setTempStart] = useState(value.start);
    const [tempEnd, setTempEnd] = useState(value.end);

    useEffect(() => {
        if (!open) {
            setView("presets");
            return;
        }
        setTempStart(value.start);
        setTempEnd(value.end);

        function onDocMouseDown(e: MouseEvent) {
            if (!rootRef.current?.contains(e.target as Node)) onClose();
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("mousedown", onDocMouseDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, onClose, value]);

    const presets: DateRangeFilterPreset[] = ["last_30_days", "last_90_days", "last_180_days"];

    const triggerLabel = value.mode === "preset"
        ? t(`date_range_filter.${value.preset}`)
        : t("date_range_filter.enter_manually");

    return (
        <div ref={rootRef} className="relative flex items-center gap-2">
            <div className="relative" style={{ width: "var(--w-wb-st-period)" }}>
                <button
                    type="button"
                    onClick={onToggle}
                    className={cn(
                        "flex h-[var(--h-wb-filter-btn)] w-full cursor-pointer items-center justify-between gap-2 overflow-clip rounded-md border bg-white px-2.5 text-wb-13 font-medium text-wb-ink shadow-sm transition-all",
                        open ? "border-black" : "border-wb-ntrl-4 hover:bg-neutral-50"
                    )}
                >
                    <span className="flex-1 truncate text-left">{triggerLabel}</span>
                    <ChevronDown
                        className={cn("size-4 shrink-0 text-wb-ntrl-6 transition-transform", open && "rotate-180")}
                        strokeWidth={1.8}
                    />
                </button>

                {open && (
                    <div className="absolute left-0 top-[calc(var(--h-wb-filter-btn)+4px)] z-10 w-[350px] rounded-md border border-wb-ntrl-4 bg-white p-1 shadow-wb-card">
                        {view === "presets" ? (
                            <ul role="listbox">
                                {presets.map((p) => {
                                    const isSelected = value.mode === "preset" && p === value.preset;
                                    return (
                                        <li key={p}>
                                            <button
                                                type="button"
                                                onClick={() => onChange({ ...value, mode: "preset", preset: p })}
                                                className={cn(
                                                    "block w-full truncate px-2.5 py-2 text-left text-wb-13 font-medium",
                                                    isSelected ? "bg-brand-soft text-brand" : "text-wb-ink hover:bg-wb-bg-sidebar"
                                                )}
                                            >
                                                {t(`date_range_filter.${p}`)}
                                            </button>
                                        </li>
                                    );
                                })}
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => setView("manual")}
                                        className="block w-full truncate px-2.5 py-2 text-left text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-sidebar"
                                    >
                                        {t("date_range_filter.enter_manually")}
                                    </button>
                                </li>
                            </ul>
                        ) : (
                            <div className="flex flex-col gap-4 p-3">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="date"
                                            value={tempStart}
                                            onChange={(e) => setTempStart(e.target.value)}
                                            className="h-9 w-full rounded-md border border-wb-ntrl-3 px-2 pr-8 text-wb-13 outline-none focus:border-brand"
                                        />
                                        <Calendar className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-wb-ntrl-6" />
                                    </div>
                                    <span className="text-wb-ntrl-5">~</span>
                                    <div className="relative flex-1">
                                        <input
                                            type="date"
                                            value={tempEnd}
                                            onChange={(e) => setTempEnd(e.target.value)}
                                            className="h-9 w-full rounded-md border border-wb-ntrl-3 px-2 pr-8 text-wb-13 outline-none focus:border-brand"
                                        />
                                        <Calendar className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-wb-ntrl-6" />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setView("presets")}
                                        className="h-9 rounded-md border border-wb-ntrl-3 px-4 text-wb-13 font-medium text-wb-ink hover:bg-neutral-50"
                                    >
                                        {t("common.cancel")}
                                    </button>
                                    <button
                                        onClick={() => onChange({ ...value, mode: "manual", start: tempStart, end: tempEnd })}
                                        className="h-9 rounded-md bg-brand px-6 text-wb-13 font-medium text-white hover:bg-brand-active"
                                    >
                                        {t("common.save")}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <button
                type="button"
                onClick={() => {
                    setView("manual");
                    onToggle();
                }}
                className="flex h-[var(--h-wb-filter-btn)] w-10 items-center justify-center rounded-md border border-wb-ntrl-4 bg-white text-wb-ntrl-8 shadow-sm hover:bg-wb-bg-active"
            >
                <Calendar className="size-4" />
            </button>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  ApprTypeDropdown
 *  Single-select approval-status filter matching the shared shell's
 *  StatusFilterDropdown style (expense / vendor baseline).
 * ───────────────────────────────────────────────────────────────────────── */

function ApprTypeDropdown({
    value,
    options,
    onChange,
}: {
    value: string;
    options: ReadonlyArray<{ value: string; labelKey: string }>;
    onChange: (next: string) => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        function onDocMouseDown(e: MouseEvent) {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", onDocMouseDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const current = options.find((o) => o.value === value) ?? options[0];

    return (
        <div
            ref={rootRef}
            className="relative"
            style={{ width: "var(--w-wb-st-status-filter)" }}
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex h-[var(--h-wb-filter-btn)] w-full cursor-pointer items-center justify-between gap-2 overflow-clip rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-13 font-medium text-wb-ink hover:bg-neutral-50"
            >
                <span className="flex-1 truncate text-left">
                    {t(current.labelKey)}
                </span>
                <ChevronDown
                    aria-hidden
                    className={cn(
                        "size-4 shrink-0 text-wb-ntrl-6 transition-transform",
                        open && "rotate-180",
                    )}
                    strokeWidth={1.8}
                />
            </button>
            {open && (
                <ul
                    role="listbox"
                    className="absolute left-0 right-0 top-[calc(var(--h-wb-filter-btn)+4px)] z-10 rounded-md border border-wb-ntrl-4 bg-white py-1 shadow-wb-card"
                >
                    {options.map((opt) => {
                        const isSelected = opt.value === value;
                        return (
                            <li key={opt.value || "__all__"}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "block w-full truncate px-2.5 py-2 text-left text-wb-13 font-medium",
                                        isSelected
                                            ? "bg-brand-soft text-brand"
                                            : "text-wb-ink hover:bg-wb-bg-sidebar",
                                    )}
                                >
                                    {t(opt.labelKey)}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
