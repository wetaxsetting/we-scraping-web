"use client";

import { useCallback, useMemo, useState } from "react";

import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import ApprovalDetailsDialog, {
    type ApprovalDetailsApprover,
    type ApprovalOutcome,
} from "@/components/payment/shared/ApprovalDetailsDialog";
import PaymentScheduledBatchListPage, {
    type PaymentScheduledBatchRow,
    type PeriodKey,
    type ScheduledBatchSortable,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";
import RequestApprovalDialog, {
    type RequestApprovalAccount,
    type RequestApprovalRow as ApprovalRow,
    type RequestApprovalTransaction,
} from "@/components/payment/shared/RequestApprovalDialog";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useTableSort } from "@/hooks/useTableSort";
import { fetchApprovalLines } from "@/lib/api/approvalLine";
import { ApiCallError } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import {
    actOnPayrollApproval,
    deletePayrollPayment,
    dispatchPayrollPayment,
    downloadOriginalPayrollExcel,
    fetchPayrollPaymentDetail,
    fetchPayrollScheduledList,
    fetchPayrollWithdrawalAccounts,
} from "@/lib/api/payrollPayment";
import { formatAmount, formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { formatRegDtmDisplay } from "@/lib/datetime";
import { validateBankingTime } from "@/lib/payment/validateBankingTime";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import type {
    ApiApprovalLineRow,
    ApiScheduledTransferDetailResponse,
    ApiTransferLineDetail,
} from "@/lib/types/api";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import PayrollPaymentUploadDialog from "./PayrollPaymentUploadDialog";
import { type PayrollScheduledRow } from "./mockData";

/**
 * Payment > Payroll Payment > Scheduled Payment — Figma 27:11294.
 *
 * Mirrors the Internal Transfer / Vendor / Expense baseline (CLAUDE.md
 * §12a). Server-driven for pagination, sort, period, search, and the
 * approval-status filter; the toolbar's list-view icon opens the shared
 * `<ViewSettingPopover>` keyed by `payment-payroll-payment-scheduled`
 * (seeded by V144).
 */
export default function PayrollScheduledPaymentPage() {
    const { t } = useTranslation();
    const dialog = useDialog();

    /* ── Toolbar / filter / pagination state ─────────────────────── */
    const [page, setPage]                 = useState(0);
    const [pageSize, setPageSize]         = useState(10);
    const [period, setPeriod]             = useState<PeriodKey>("30d");
    const [manualRange, setManualRange]   = useState<{ fromDate: string; toDate: string } | undefined>(undefined);
    const [apprType, setApprType]         = useState<string>("");
    const [search, setSearch]             = useState<string>("");
    const [refreshKey, setRefreshKey]     = useState(0);
    const refreshList = useCallback(() => setRefreshKey((k) => k + 1), []);

    const sort = useTableSort();

    /* ── Excel Upload state ──────────────────────────────────────── */
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadKey, setUploadKey]   = useState(0);
    function openUpload() {
        setUploadKey((k) => k + 1);
        setUploadOpen(true);
    }

    /* ── Request Approval state ──────────────────────────────────── */
    const [approvalRows, setApprovalRows] = useState<
        Array<PayrollScheduledRow & PaymentScheduledBatchRow> | null
    >(null);

    /* ── Approval Details dialog state ───────────────────────────── */
    const [detailsView, setDetailsView] = useState<{
        row:       PayrollScheduledRow & PaymentScheduledBatchRow;
        detail:    ApiScheduledTransferDetailResponse;
        approvers: ApprovalDetailsApprover[];
    } | null>(null);

    /* ── View Setting popover state ──────────────────────────────── */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_PAYROLL_PAYMENT_SCHEDULED,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft]   = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    /* ── Filter-change resets ────────────────────────────────────── */
    function changePeriod(next: PeriodKey)   { setPeriod(next);   setPage(0); }
    function changePageSize(next: number)    { setPageSize(next); setPage(0); }
    function changeApprType(next: string)    { setApprType(next); setPage(0); }
    function changeSearch(next: string)      { setSearch(next);   setPage(0); }
    function handleSort(fieldId: string) {
        sort.toggleSort(fieldId);
        setPage(0);
    }

    /* ── Data fetch ──────────────────────────────────────────────── */
    const { fromDate, toDate } = useMemo(
        () => periodToWindow(period, manualRange),
        [period, manualRange],
    );
    const state = useApiData(
        () => fetchPayrollScheduledList({
            fromDate,
            toDate,
            srchWd:        search.trim() || undefined,
            apprType:      apprType || undefined,
            page,
            size:          pageSize,
            sortField:     sort.sortParams?.sortField,
            sortDirection: sort.sortParams?.sortDirection,
        }),
        [
            fromDate, toDate, search, apprType,
            page, pageSize,
            sort.sortField, sort.sortDirection,
            refreshKey,
        ],
    );

    const rows: Array<PayrollScheduledRow & PaymentScheduledBatchRow> = useMemo(
        () => (state.data?.rows ?? []).map(toListRow),
        [state.data],
    );

    const totals = useMemo(
        () => (state.data?.currency_totals ?? []).map((c) => ({
            currency: c.ccy_cd,
            amount:   formatAmount(c.total_amount, c.ccy_cd, true),
        })),
        [state.data],
    );
    const totalCount = state.data?.total_count ?? 0;

    /* ── Print ───────────────────────────────────────────────────── */
    const handlePrint = useCallback(() => {
        const columns: PrintColumn<PayrollScheduledRow & PaymentScheduledBatchRow>[] = [
            { header: t("payment.internal.col.date_time"), render: (r) => escapeHtml(r.dateTime.replace(/\n/g, " ")) },
            { header: t("payment.internal.col.file_name"), render: (r) => escapeHtml(r.fileName) },
            {
                header: t("payment.internal.col.txn_count"),
                align: "right",
                render: (r) => escapeHtml(t("payment.internal.txn_count_with_currency", {
                    count: String(r.txnCount), currency: r.txnCurrency,
                })),
            },
            { header: t("payment.internal.col.total_transfer"), align: "right", render: (r) => escapeHtml(r.totalAmount) },
            { header: t("approval.col.status"),                 render: (r) => r.status ? escapeHtml(t(`payment.status.${r.status}`)) : "" },
            { header: t("payment.col.requestor"),               render: (r) => escapeHtml(r.requestor) },
            { header: t("payment.col.approver"),                render: (r) => escapeHtml(r.approver) },
            { header: t("payment.internal.col.approval_ref"),   render: (r) => escapeHtml(r.approvalRef) },
            { header: t("payment.internal.col.approval_title"), render: (r) => escapeHtml(r.approvalTitle) },
        ];
        const summary = t("common.showing_of", {
            shown: String(rows.length),
            total: String(totalCount),
        });
        printReport({
            title: t("payment.payroll.scheduled_title"),
            summary,
            columns,
            rows,
        });
    }, [rows, totalCount, t]);

    /* ── View Setting popover ────────────────────────────────────── */
    const handleListView = useCallback((anchorRect: DOMRect) => {
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    }, [vs.items]);
    const closeViewSetting = useCallback(() => {
        setVsAnchor(null);
        setVsDraft(null);
    }, []);

    /* ── Row actions ─────────────────────────────────────────────── */

    const surfaceError = useCallback((err: unknown, fallbackKey: string) => {
        const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
        const message = err instanceof ApiCallError ? err.message : t(fallbackKey);
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: message,
            errorCode: code,
        });
    }, [dialog, t]);

    const handleTransferRow = useCallback(
        async (row: PayrollScheduledRow & PaymentScheduledBatchRow) => {
            if (row.action !== "transfer") return;

            // Pre-flight cut-off-time guard — see lib/payment/validateBankingTime.
            const ok = await validateBankingTime({
                bankCd:      row.fromBank ?? "",
                txnCurrency: row.txnCurrency,
                dialog,
                t,
            });
            if (!ok) return;

            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("payment.payroll.transfer_confirm_description", {
                    fileName: row.fileName,
                }),
                confirmText: t("dialog.continue"),
                cancelText:  t("dialog.cancel"),
                onConfirm: async () => {
                    try {
                        await dispatchPayrollPayment(row.id, { trnf_ccy_cd: row.txnCurrency });
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: row.txnCurrency === "VND"
                                ? t("payment.payroll.transfer_success_vnd")
                                : t("payment.payroll.transfer_success_fcy"),
                        });
                        refreshList();
                    } catch (err) {
                        surfaceError(err, "payment.payroll.transfer_failed");
                    }
                },
            });
        },
        [dialog, refreshList, surfaceError, t],
    );

    const handleDeleteRow = useCallback(
        (row: PayrollScheduledRow & PaymentScheduledBatchRow) => {
            if (row.approvalRef) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("payment.payroll.delete_blocked_in_approval"),
                    errorCode: "WBE2062",
                });
                return;
            }
            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("payment.payroll.delete_confirm_description", { fileName: row.fileName }),
                confirmText: t("dialog.continue"),
                cancelText:  t("dialog.cancel"),
                destructive: true,
                onConfirm: async () => {
                    try {
                        await deletePayrollPayment(row.id);
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t("payment.payroll.delete_success"),
                        });
                        refreshList();
                    } catch (err) {
                        surfaceError(err, "payment.payroll.delete_failed");
                    }
                },
            });
        },
        [dialog, refreshList, surfaceError, t],
    );

    const handleRequestApproval = useCallback(
        (chosen: Array<PayrollScheduledRow & PaymentScheduledBatchRow>) => {
            if (chosen.length === 0) {
                dialog.open({
                    type: "warning",
                    title: t("dialog.warning"),
                    description: t("payment.request_approval.no_rows_selected"),
                });
                return;
            }
            const alreadySubmitted = chosen.filter((r) => Boolean(r.approvalRef));
            if (alreadySubmitted.length > 0) {
                dialog.open({
                    type: "warning",
                    title: t("dialog.warning"),
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

    const handleApprovalAction = useCallback(
        async (scdulPymnNo: string, action: "APPROVE" | "REJECT"): Promise<void> => {
            try {
                await actOnPayrollApproval(scdulPymnNo, { action });
                setDetailsView(null);
                dialog.open({
                    type:        "success",
                    title:       t("dialog.success"),
                    description: action === "APPROVE"
                        ? t("payment.payroll.approve_success")
                        : t("payment.payroll.reject_success"),
                });
                refreshList();
            } catch (err) {
                surfaceError(err, "payment.payroll.approval_action_failed");
            }
        },
        [dialog, refreshList, surfaceError, t],
    );

    const handleApprovalRefClick = useCallback(
        (row: PayrollScheduledRow & PaymentScheduledBatchRow): void => {
            if (!row.approvalRef) return;
            Promise.all([
                fetchPayrollPaymentDetail(row.id),
                fetchApprovalLines().catch(() => ({ total_count: 0, approval_lines: [] })),
            ])
                .then(([detail, lines]) => {
                    const approvers = bridgeApprovers(
                        lines.approval_lines,
                        detail.appr_stts,
                        detail.mod_dtm,
                    );
                    setDetailsView({ row, detail, approvers });
                })
                .catch((err) => {
                    const code = err instanceof ApiCallError ? err.code : "WBE9999";
                    const message =
                        err instanceof ApiCallError
                            ? err.message
                            : t("payment.internal.detail_load_failed");
                    dialog.open({
                        type:        "error",
                        title:       t("dialog.error"),
                        description: message,
                        errorCode:   code,
                    });
                });
        },
        [dialog, t],
    );

    /* ── Request Approval dialog loaders ─────────────────────────── */
    const loadPayrollAccounts = useCallback(async (): Promise<RequestApprovalAccount[]> => {
        const list = await fetchPayrollWithdrawalAccounts();
        return list.map((r) => ({
            bankCd:     r.bank_cd,
            bankNm:     r.bank_nm,
            acctNo:     r.acct_no,
            ccyCd:      r.ccy_cd,
            acctTypeCd: r.acct_type_cd,
            acctNickNm: r.acct_nick_nm,
        }));
    }, []);

    const loadPayrollTransactions = useCallback(async (): Promise<RequestApprovalTransaction[]> => {
        if (!approvalRows || approvalRows.length === 0) return [];
        const out: RequestApprovalTransaction[] = [];
        for (const row of approvalRows) {
            try {
                const detail = await fetchPayrollPaymentDetail(row.id);
                (detail.rows ?? []).forEach((line, idx) => {
                    out.push(detailLineToApprovalTransaction(line, detail.ccy_cd, row.id, idx));
                });
            } catch {
                // Skip per-row failures so the dialog still opens.
            }
        }
        return out;
    }, [approvalRows]);

    return (
        <>
            <PaymentScheduledBatchListPage<PayrollScheduledRow & PaymentScheduledBatchRow>
                title={t("payment.payroll.scheduled_title")}
                rows={rows}
                rowDetailHref={(row) => `/payment/payroll/scheduled-payment/${row.id}`}
                onApprovalRefClick={handleApprovalRefClick}
                totals={totals}
                onExcelUpload={openUpload}
                onPrint={handlePrint}
                onListView={handleListView}
                search={search}
                onSearchChange={changeSearch}
                apprType={apprType}
                apprTypeOptions={APPR_TYPE_OPTIONS}
                onApprTypeChange={changeApprType}
                pagination={{
                    page,
                    pageSize,
                    totalCount,
                    onPageChange: setPage,
                    onPageSizeChange: changePageSize,
                }}
                sort={{ field: sort.sortField, direction: sort.sortDirection }}
                sortableColumns={SORTABLE_COLUMNS}
                onSort={handleSort}
                period={period}
                onPeriodChange={changePeriod}
                manualRange={manualRange}
                onManualRangeChange={(r) => { setManualRange(r); setPage(0); }}
                viewSettingItems={vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS}
                onTransferRow={handleTransferRow}
                onDeleteRow={handleDeleteRow}
                onRequestApproval={handleRequestApproval}
            />
            {uploadOpen && (
                <PayrollPaymentUploadDialog
                    key={uploadKey}
                    onClose={() => setUploadOpen(false)}
                    onSaved={() => {
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
            {approvalRows && (
                <RequestApprovalDialog
                    kind="payroll"
                    selectedRows={approvalRows.map(toApprovalDialogRow)}
                    loadTransactions={loadPayrollTransactions}
                    documentNo={approvalRows[0]?.approvalRef || approvalRows[0]?.id}
                    loadWithdrawalAccounts={loadPayrollAccounts}
                    onClose={() => setApprovalRows(null)}
                    onSubmitted={() => {
                        setApprovalRows(null);
                        setPage(0);
                        refreshList();
                    }}
                />
            )}
            {detailsView && (
                <ApprovalDetailsDialog
                    kind="payroll"
                    title={detailsView.row.approvalTitle || detailsView.row.fileName}
                    status={detailStatusToOutcome(
                        detailsView.detail.appr_stts,
                        detailsView.row.status,
                    )}
                    documentNo={detailsView.detail.doc_no || detailsView.row.id}
                    totalAmount={formatAmount(
                        detailsView.detail.total_tran_amt,
                        detailsView.detail.ccy_cd,
                        true,
                    )}
                    withdrawalAccount={{
                        bankNm: detailsView.row.fromBank || detailsView.detail.out_bank_cd,
                        acctNo: detailsView.detail.wdrl_act_no,
                        ccyCd:  detailsView.detail.wdrl_ccy_cd ?? detailsView.detail.ccy_cd,
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
                    attachments={
                        detailsView.detail.org_file_nm
                            ? [{
                                id:   "1",
                                name: detailsView.detail.org_file_nm,
                                size: detailsView.detail.file_size
                                    ? formatFileSize(detailsView.detail.file_size)
                                    : "",
                                onDownload: () => {
                                    void downloadOriginalPayrollExcel(detailsView.row.id);
                                },
                            }]
                            : []
                    }
                    requestedBy={detailsView.detail.reg_id || detailsView.row.requestor}
                    requestedAt={detailsView.row.dateTime.replace(/\n/g, " ")}
                    onClose={() => setDetailsView(null)}
                    onApprove={
                        isFinalApprovalState(detailsView.detail.appr_stts)
                            ? undefined
                            : () => { void handleApprovalAction(detailsView.row.id, "APPROVE"); }
                    }
                    onReject={
                        isFinalApprovalState(detailsView.detail.appr_stts)
                            ? undefined
                            : () => { void handleApprovalAction(detailsView.row.id, "REJECT"); }
                    }
                />
            )}
        </>
    );
}

function isFinalApprovalState(apprStts: string | null): boolean {
    return apprStts === "C" || apprStts === "X";
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

function formatFileSize(bytesStr: string): string {
    const n = Number(bytesStr);
    if (!Number.isFinite(n) || n <= 0) return bytesStr;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function bridgeApprovers(
    lines: ApiApprovalLineRow[],
    masterApprStts: string | null,
    masterModDtm: string | null,
): ApprovalDetailsApprover[] {
    const first = lines[0];
    if (!first || first.approvers.length === 0) return [];
    const firstOutcome: "A" | "R" | "P" =
        masterApprStts === "C" ? "A"
        : masterApprStts === "X" ? "R"
        : "P";
    const firstActedAt =
        (firstOutcome === "A" || firstOutcome === "R")
            ? formatYyyyMmDdHhMmSsForDisplay(masterModDtm)
            : undefined;
    return first.approvers.map((a, idx) => ({
        seq:     idx + 1,
        name:    a.apprvr_nm,
        outcome: idx === 0 ? firstOutcome : "W",
        actedAt: idx === 0 ? firstActedAt : undefined,
    }));
}

function formatYyyyMmDdHhMmSsForDisplay(raw: string | null): string | undefined {
    if (!raw || raw.length < 12) return undefined;
    const yyyy = raw.slice(0, 4);
    const mm   = raw.slice(4, 6);
    const dd   = raw.slice(6, 8);
    const HH   = raw.slice(8, 10);
    const MM   = raw.slice(10, 12);
    return `${dd}-${mm}-${yyyy} ${HH}:${MM}`;
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Constants
 * ───────────────────────────────────────────────────────────────────────── */

/** Mirror of the V144 SYS_SCR_OPTION_WECMS seed — paint-time fallback. */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "CHECKBOX",       field_nm: "Checkbox",              disp_ord: 0,  disp_yn: "Y", use_yn: "Y", fix_yn: "Y", size: "38px",  sort_yn: "N" },
    { field_id: "REG_DTM",        field_nm: "Date / Time",           disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "150px", sort_yn: "Y" },
    { field_id: "TITL",           field_nm: "File Name",             disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "240px", sort_yn: "Y" },
    { field_id: "TOT_TRNS_CNT",   field_nm: "No. of Transactions",   disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "TOTAL_TRAN_AMT", field_nm: "Total Transfer Amount", disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "APPR_STTS",      field_nm: "Approval Status",       disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "N" },
    { field_id: "REG_ID",         field_nm: "Requestor",             disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "APPR_SEQ_NO",    field_nm: "Approval Ref.",         disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "TRNF_YN",        field_nm: "Transfer Status",       disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "120px", sort_yn: "Y" },
    { field_id: "DOC_NO",         field_nm: "Doc No.",               disp_ord: 9,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "ETC",            field_nm: "",                      disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "60px",  sort_yn: "N" },
];

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
    REQUESTOR:      "REG_ID",
    APPROVAL_REF:   "APPR_SEQ_NO",
    APPROVAL_TITLE: "TITL",
};

/* ─────────────────────────────────────────────────────────────────────────
 *  Wire → in-memory row mapper
 * ───────────────────────────────────────────────────────────────────────── */

function toListRow(api: {
    scdul_pymn_no:     string;
    titl:              string;
    appr_seq_no:       string | null;
    total_tran_amt:    string;
    tot_trns_cnt:      string;
    reg_dtm:           string;
    reg_id:            string;
    appr_stts:         string | null;
    trnf_yn:           string | null;
    ccy_cd:            string;
    out_bank_cd:       string;
    wdrl_act_no:       string | null;
    file_nm:           string | null;
}): PayrollScheduledRow & PaymentScheduledBatchRow {
    const isApproved =
        api.appr_stts === "C" || api.appr_stts === "A" || api.trnf_yn === "Y";
    let action: "transfer" | "complete" | undefined;
    if (isApproved && api.trnf_yn === "Y") {
        action = "complete";
    } else if (isApproved && api.trnf_yn !== "Y" && api.appr_seq_no) {
        action = "transfer";
    }

    return {
        id:            api.scdul_pymn_no,
        dateTime:      formatRegDtm(api.reg_dtm),
        fileName:      api.file_nm ?? api.titl,
        txnCount:      Number(api.tot_trns_cnt ?? "0") || 0,
        txnCurrency:   api.ccy_cd,
        totalAmount:   formatNumber(api.total_tran_amt),
        status:        deriveStatus(api.appr_stts, api.trnf_yn, api.appr_seq_no),
        requestor:     api.reg_id,
        approver:      "",
        approvalRef:   api.appr_seq_no ?? "",
        approvalTitle: api.titl,
        action,
        rowHighlight:  api.appr_seq_no ? undefined : "warning",
        fromBank:      api.out_bank_cd,
        fromAccount:   api.wdrl_act_no ?? undefined,
        canDelete:     !api.appr_seq_no,
        canDownloadFile: Boolean(api.file_nm),
    };
}

function deriveStatus(
    apprStts: string | null,
    trnfYn:   string | null,
    apprSeqNo: string | null,
): ApprovalStatus | undefined {
    switch (apprStts) {
        case "C": return "approved";
        case "X": return "rejected";
        case "P": return "pending";
        case "I": return "in_progress";
    }
    if (trnfYn === "Y") return "approved";
    // Legacy / null-apprStts fallback — see ScheduledPaymentPage Vendor
    // sibling for the full reasoning. Default to Pending, not In Progress.
    if (apprSeqNo) return "pending";
    return undefined;
}

function formatRegDtm(raw: string | null | undefined): string {
    return formatRegDtmDisplay(raw);
}

function periodToWindow(
    period: PeriodKey,
    manualRange?: { fromDate: string; toDate: string },
): { fromDate: string; toDate: string } {
    if (period === "manual" && manualRange) return manualRange;
    const fmt = (d: Date): string => {
        const yyyy = d.getFullYear().toString().padStart(4, "0");
        const mm   = (d.getMonth() + 1).toString().padStart(2, "0");
        const dd   = d.getDate().toString().padStart(2, "0");
        return `${yyyy}${mm}${dd}`;
    };
    const days = period === "180d" ? 180 : period === "90d" ? 90 : 30;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    return { fromDate: fmt(start), toDate: fmt(today) };
}

function toApprovalDialogRow(
    row: PayrollScheduledRow & PaymentScheduledBatchRow,
): ApprovalRow {
    return {
        id:          row.id,
        fileName:    row.fileName,
        ccyCd:       row.txnCurrency,
        totalAmount: row.totalAmount,
        txnCount:    row.txnCount,
    };
}

function detailLineToApprovalTransaction(
    line: ApiTransferLineDetail,
    batchCcy: string,
    rowId: string,
    idx: number,
): RequestApprovalTransaction {
    const reportingAccount = line.chart_acct_cd
        ? (line.chart_acct_seq_no
            ? `${line.chart_acct_cd} - ${line.chart_acct_seq_no}`
            : line.chart_acct_cd)
        : undefined;
    return {
        id:                  `${rowId}-${line.scdul_pymn_detl_no || idx}`,
        depositBankCode:     line.tar_bank_cd ?? "",
        depositBankName:     "",
        depositBankCcyCd:    line.depo_ccy_cd ?? line.ccy_cd ?? batchCcy,
        depositAccountNo:    line.finc_mda_no ?? "",
        transferAmount:      formatNumber(line.tran_amt),
        recipientName:       line.rcpt_nm ?? undefined,
        remarks:             line.note ?? undefined,
        description:         line.tran_usag ?? undefined,
        documentNo:          line.doc_no ?? undefined,
        reportingAccount,
        reportingBreadcrumb: undefined,
    };
}
