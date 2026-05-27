"use client";

import { useCallback, useMemo, useState } from "react";

import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import PaymentScheduledBatchListPage, {
    type ManualDateRange,
    type PaymentScheduledBatchRow,
    type PeriodKey,
    type ScheduledBatchSortable,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";
import { dmyFromYyyymmdd } from "@/components/payment/shared/PaymentPeriodDropdown";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";
import { useTableSort } from "@/hooks/useTableSort";
import {
    fetchOverseasScheduledList,
    fetchOverseasScheduledById,
    fetchOverseasPaymentDetail,
    fetchOverseasWithdrawalAccounts,
    downloadOverseasPaymentFile,
    removeOverseasApprovalLine,
    actOnOverseasApproval,
    deleteOverseasDraftBatch,
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

/** Derive the wire `from_date` / `to_date` window (yyyymmdd) from the
 *  current period state. Manual mode → use the committed range verbatim;
 *  preset mode → today − N days through today. */
function deriveDateWindow(
    period: PeriodKey,
    manualRange: ManualDateRange | undefined,
): { fromYmd: string; toYmd: string } {
    if (period === "manual" && manualRange) {
        return { fromYmd: manualRange.fromDate, toYmd: manualRange.toDate };
    }
    const today = new Date();
    const days =
        period === "180d" ? 180 :
        period === "90d"  ? 90 :
        period === "7d"   ? 7 :
        30;
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    const fmt = (d: Date) =>
        `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return { fromYmd: fmt(start), toYmd: fmt(today) };
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
        case "C":
        case "A":
        case "01": return "approved";
        case "X":
        case "R":
        case "02": return "rejected";   // backend ApprovalBoxService derives "R" from APPR_TYPE_CD='02'
        case "P":
        case "04": return "pending";
        case "I":
        case "03": return "in_progress";
        case "00": return "draft";
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
    const isApproved = api.appr_stts === "C" || api.appr_stts === "A" || api.appr_stts === "01" || api.trnf_yn === "Y";
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
        fileName:      api.file_nm || api.bnfc_nm || "-",
        txnCount:      Number(api.tot_trns_cnt) || 0,
        txnCurrency:   api.ccy_cd,
        totalAmount:   api.total_tran_amt?.toString() ?? "0",
        status,
        statusStep,
        requestor:     api.draft_user_nm || api.reg_id || "-",
        approver:      "-",
        approvalRef:   api.appr_seq_no ?? "",
        docNo:         api.doc_no ?? null,
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
    // Mirrors Vendor / Expense / Payroll Scheduled — period preset +
    // optional manual range, owned by the shared shell's built-in chrome
    // (PaymentPeriodDropdown + CalendarRangeAffordance).
    const [period, setPeriod] = useState<PeriodKey>("30d");
    const [manualRange, setManualRange] = useState<ManualDateRange | undefined>(undefined);

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
                    try {
                        await deleteOverseasDraftBatch(row.id);
                        refreshList();
                    } catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        dialog.open({ type: "error", title: t("dialog.error"), description: message });
                    }
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

    const changePeriod = useCallback((next: PeriodKey) => {
        setPeriod(next);
        setPage(0);
    }, []);
    const changeManualRange = useCallback((next: ManualDateRange) => {
        setManualRange(next);
        setPage(0);
    }, []);

    // Derive the wire `from_date` / `to_date` (yyyymmdd) from the current
    // period state. Mirrors the legacy server-side defaulting in
    // pymn_0007_001 — preset windows always end today, manual range
    // uses the committed yyyymmdd pair verbatim.
    const { fromYmd, toYmd } = useMemo(
        () => deriveDateWindow(period, manualRange),
        [period, manualRange],
    );

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
            from_date:      fromYmd,
            to_date:        toYmd,
            appr_type_cd:   apprType ? [apprType] : undefined,
            keyword:        search.trim() || undefined,
            page,
            size:           pageSize,
            sort_field:     sort.sortField ?? undefined,
            sort_direction: sort.sortDirection ?? undefined,
        }),
        [fromYmd, toYmd, apprType, search, page, pageSize, refreshKey, sort.sortField, sort.sortDirection],
    );

    const rows = useMemo(
        (): Array<OverseasScheduledRow & PaymentScheduledBatchRow> =>
            (state.data?.rows ?? []).map(mapApiRow),
        [state.data],
    );

    const totals: { currency: string; amount: string }[] = [];
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
            { header: t("payment.overseas.col.approval_ref"),    render: (r) => escapeHtml(r.docNo || r.approvalRef || "-") },
            { header: t("payment.overseas.col.approval_title"),  render: (r) => escapeHtml(r.approvalTitle || "-") },
        ];
        printReport({
            title:   t("payment.overseas.scheduled_title"),
            summary: `${dmyFromYyyymmdd(fromYmd)} ~ ${dmyFromYyyymmdd(toYmd)}`,
            columns,
            rows,
        });
    }, [rows, fromYmd, toYmd, t]);

    return (
        <>
            <PaymentScheduledBatchListPage<OverseasScheduledRow & PaymentScheduledBatchRow>
                title={t("payment.overseas.scheduled_title")}
                onPrint={handlePrint}
                rows={rows}
                rowDetailHref={(row) => `/payment/overseas-payment/scheduled-payment/${row.docNo || row.id}`}
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
                period={period}
                onPeriodChange={changePeriod}
                manualRange={manualRange}
                onManualRangeChange={changeManualRange}
                apprType={apprType}
                apprTypeOptions={APPR_TYPE_OPTIONS}
                onApprTypeChange={changeApprType}
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
                        (detailsView.detail.appr_stts === "P" || detailsView.detail.appr_stts === "04") &&
                        detailsView.approvers.some((a) => a.id === userStorage.get()?.userId)
                            ? handleApprove
                            : undefined
                    }
                    onReject={
                        (detailsView.detail.appr_stts === "P" || detailsView.detail.appr_stts === "04") &&
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
                        apprvr_id: a.id ?? "",
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
        case "C":
        case "A":
        case "01": return "approved";
        case "X":
        case "R":
        case "02": return "rejected";
        case "P":
        case "04": return "pending";
        case "I":
        case "03": return "in_progress";
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

