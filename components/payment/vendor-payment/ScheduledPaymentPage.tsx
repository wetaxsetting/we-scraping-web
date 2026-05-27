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
    actOnVendorApproval,
    changeVendorApprovalLine,
    deleteVendorPayment,
    dispatchVendorPayment,
    downloadOriginalVendorExcel,
    fetchVendorPaymentDetail,
    fetchVendorScheduledList,
    fetchVendorWithdrawalAccounts,
    withdrawVendorApproval,
} from "@/lib/api/vendorPayment";
import EditApprovalLinePicker, {
    type EditApprovalLinePreview,
} from "@/components/payment/corporate-card/EditApprovalLinePicker";
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

import VendorPaymentUploadDialog from "./VendorPaymentUploadDialog";
import { type VendorScheduledRow } from "./types";

/**
 * Payment > Vendor Payment > Scheduled Payment — Figma 24:1398.
 *
 * Mirrors the Internal Transfer baseline (CLAUDE.md §12a). Server-driven
 * for pagination, sort, period, search, and the approval-status filter;
 * the toolbar's list-view icon opens the shared `<ViewSettingPopover>`
 * keyed by `payment-vendor-payment-scheduled` (seeded by V141).
 *
 * Excel Upload + Request Approval route through the shared dialogs the
 * Internal Transfer page uses — only the Vendor endpoint wiring differs.
 */
export default function VendorScheduledPaymentPage() {
    const { t } = useTranslation();
    const dialog = useDialog();

    /* ── Toolbar / filter / pagination state ─────────────────────── */
    const [page, setPage]                 = useState(0);
    const [pageSize, setPageSize]         = useState(10);
    const [period, setPeriod]             = useState<PeriodKey>("30d");
    const [manualRange, setManualRange]   = useState<{ fromDate: string; toDate: string } | undefined>(undefined);
    const [apprType, setApprType]         = useState<string>(""); // "" = All
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
        Array<VendorScheduledRow & PaymentScheduledBatchRow> | null
    >(null);

    /* ── Approval Details dialog state ───────────────────────────────
     * Row currently being shown in the read-only Approval Details
     * dialog (legacy `comm_0195_001`). Set when the user clicks an
     * Approval Ref cell on a row that already has APPR_SEQ_NO; the
     * `detail` payload is fetched lazily before the dialog opens so
     * the General Information section can render the withdrawal
     * account + master totals from the persisted batch.
     */
    const [detailsView, setDetailsView] = useState<{
        row:       VendorScheduledRow & PaymentScheduledBatchRow;
        detail:    ApiScheduledTransferDetailResponse;
        approvers: ApprovalDetailsApprover[];
    } | null>(null);
    // Approval Details edit-mode state — mirrors the Internal Transfer
    // wiring. When `editMode` is true, the dialog swaps the read-only
    // approver chips for an inline `<EditApprovalLinePicker>`; Save
    // calls the real change-approval-line endpoint.
    const [editMode, setEditMode]       = useState(false);
    const [pickedLine, setPickedLine]   = useState<EditApprovalLinePreview | null>(null);
    const [savingEdit, setSavingEdit]   = useState(false);

    /* ── View Setting popover state ──────────────────────────────── */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_VENDOR_PAYMENT_SCHEDULED,
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
        () => fetchVendorScheduledList({
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

    const rows: Array<VendorScheduledRow & PaymentScheduledBatchRow> = useMemo(
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
        const columns: PrintColumn<VendorScheduledRow & PaymentScheduledBatchRow>[] = [
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
            { header: t("payment.internal.col.approval_ref"),   render: (r) => escapeHtml(r.docNo ?? r.approvalRef) },
            { header: t("payment.internal.col.approval_title"), render: (r) => escapeHtml(r.approvalTitle) },
        ];
        const summary = t("common.showing_of", {
            shown: String(rows.length),
            total: String(totalCount),
        });
        printReport({
            title: t("payment.vendor.scheduled_title"),
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
        async (row: VendorScheduledRow & PaymentScheduledBatchRow) => {
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
                description: t("payment.vendor.transfer_confirm_description", {
                    fileName: row.fileName,
                }),
                confirmText: t("dialog.continue"),
                cancelText:  t("dialog.cancel"),
                onConfirm: async () => {
                    try {
                        await dispatchVendorPayment(row.id, { trnf_ccy_cd: row.txnCurrency });
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: row.txnCurrency === "VND"
                                ? t("payment.vendor.transfer_success_vnd")
                                : t("payment.vendor.transfer_success_fcy"),
                        });
                        refreshList();
                    } catch (err) {
                        surfaceError(err, "payment.vendor.transfer_failed");
                    }
                },
            });
        },
        [dialog, refreshList, surfaceError, t],
    );

    const handleDeleteRow = useCallback(
        (row: VendorScheduledRow & PaymentScheduledBatchRow) => {
            if (row.approvalRef) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("payment.vendor.delete_blocked_in_approval"),
                    errorCode: "WBE2062",
                });
                return;
            }
            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("payment.vendor.delete_confirm_description", { fileName: row.fileName }),
                confirmText: t("dialog.continue"),
                cancelText:  t("dialog.cancel"),
                destructive: true,
                onConfirm: async () => {
                    try {
                        await deleteVendorPayment(row.id);
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t("payment.vendor.delete_success"),
                        });
                        refreshList();
                    } catch (err) {
                        surfaceError(err, "payment.vendor.delete_failed");
                    }
                },
            });
        },
        [dialog, refreshList, surfaceError, t],
    );

    const handleRequestApproval = useCallback(
        (chosen: Array<VendorScheduledRow & PaymentScheduledBatchRow>) => {
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

    // Approve / Reject — fires the
    // `POST /api/v1/payment/vendor-payment/{id}/approval-action`
    // endpoint behind the dialog's footer buttons. On success the
    // dialog closes, the list refetches (so the row's status badge
    // flips immediately), and a success toast surfaces. Errors route
    // through the global system-error dialog with the server-supplied
    // code so the user can quote WBE2080 / WBE2081 to support.
    const handleApprovalAction = useCallback(
        async (scdulPymnNo: string, action: "APPROVE" | "REJECT"): Promise<void> => {
            try {
                await actOnVendorApproval(scdulPymnNo, { action });
                setDetailsView(null);
                dialog.open({
                    type:        "success",
                    title:       t("dialog.success"),
                    description: action === "APPROVE"
                        ? t("payment.vendor.approve_success")
                        : t("payment.vendor.reject_success"),
                });
                refreshList();
            } catch (err) {
                surfaceError(err, "payment.vendor.approval_action_failed");
            }
        },
        [dialog, refreshList, surfaceError, t],
    );

    // Withdraw the current approval request — kebab "Delete" action.
    // Mirrors the Internal Transfer wiring; the backend routes through
    // the shared `ApprovalBoxFanoutService.withdrawApproval`.
    const handleWithdrawApproval = useCallback(async () => {
        if (!detailsView) return;
        try {
            await withdrawVendorApproval(detailsView.row.id);
            setDetailsView(null);
            dialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("approval.action.delete_success"),
            });
            refreshList();
        } catch (err) {
            surfaceError(err, "approval.action.delete_failed");
        }
    }, [detailsView, dialog, refreshList, surfaceError, t]);

    // Save the picked approval line via the real change-approval-line
    // endpoint. Same backend logic as Internal Transfer / Card
    // Transactions (shared `ApprovalBoxFanoutService.changeApprovalLine`).
    const handleEditSave = useCallback(async () => {
        if (!detailsView || !pickedLine) return;
        setSavingEdit(true);
        try {
            await changeVendorApprovalLine(detailsView.row.id, pickedLine.apprLineNo);
            dialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("approval.action.edit_success"),
            });
            setDetailsView(null);
            setEditMode(false);
            setPickedLine(null);
            refreshList();
        } catch (err) {
            surfaceError(err, "approval.action.edit_failed");
        } finally {
            setSavingEdit(false);
        }
    }, [detailsView, pickedLine, dialog, refreshList, surfaceError, t]);

    const handleEditCancel = useCallback(() => {
        setEditMode(false);
        setPickedLine(null);
    }, []);

    // Approval-Ref-cell click handler — mirrors legacy `comm_0195_001`
    // UX where the Approval Ref value is the ONLY cell that opens the
    // read-only Approval Details dialog. Fires the detail fetch +
    // approval-lines fetch in parallel; the dialog mounts once both
    // resolve so the General Information section renders the
    // withdrawal account, master totals, and the per-approver chip
    // chain in one go. The approver chain is a Phase A bridge — the
    // wire's detail response doesn't yet ship the per-approver outcome
    // list; we project the master's batch-level `appr_stts` onto the
    // first approver of the user's first approval line. Errors on the
    // master detail call surface through the global error dialog.
    const handleApprovalRefClick = useCallback(
        (row: VendorScheduledRow & PaymentScheduledBatchRow): void => {
            if (!row.approvalRef) return;
            Promise.all([
                fetchVendorPaymentDetail(row.id),
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
    const loadVendorAccounts = useCallback(async (): Promise<RequestApprovalAccount[]> => {
        const list = await fetchVendorWithdrawalAccounts();
        return list.map((r) => ({
            bankCd:     r.bank_cd,
            bankNm:     r.bank_nm,
            acctNo:     r.acct_no,
            ccyCd:      r.ccy_cd,
            acctTypeCd: r.acct_type_cd,
            acctNickNm: r.acct_nick_nm,
        }));
    }, []);

    const loadVendorTransactions = useCallback(async (): Promise<RequestApprovalTransaction[]> => {
        if (!approvalRows || approvalRows.length === 0) return [];
        const out: RequestApprovalTransaction[] = [];
        for (const row of approvalRows) {
            try {
                const detail = await fetchVendorPaymentDetail(row.id);
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
            <PaymentScheduledBatchListPage<VendorScheduledRow & PaymentScheduledBatchRow>
                title={t("payment.vendor.scheduled_title")}
                rows={rows}
                rowDetailHref={(row) => `/payment/vendor-payment/scheduled-payment/${row.id}`}
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
                <VendorPaymentUploadDialog
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
                    kind="vendor-payment"
                    selectedRows={approvalRows.map(toApprovalDialogRow)}
                    loadTransactions={loadVendorTransactions}
                    documentNo={approvalRows[0]?.docNo || approvalRows[0]?.approvalRef || approvalRows[0]?.id}
                    loadWithdrawalAccounts={loadVendorAccounts}
                    onClose={() => setApprovalRows(null)}
                    onSubmitted={() => {
                        setApprovalRows(null);
                        setPage(0);
                        refreshList();
                    }}
                />
            )}
            {detailsView && (() => {
                const editApproverSlot = editMode ? (
                    <div className="flex flex-col gap-2">
                        <EditApprovalLinePicker
                            value={pickedLine?.apprLineNo ?? null}
                            onPick={setPickedLine}
                        />
                        {pickedLine && pickedLine.approvers.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                                {pickedLine.approvers.map((a, i) => (
                                    <span
                                        key={`${a.apprvrId}-${i}`}
                                        className="inline-flex items-center gap-1 rounded border border-wb-ntrl-4 bg-white px-2 py-0.5 text-wb-12 font-medium text-wb-ink"
                                    >
                                        <span className="text-wb-ntrl-6">{i + 1}</span>
                                        <span className="uppercase">{a.apprvrNm || a.apprvrId}</span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ) : undefined;
                return (
                <ApprovalDetailsDialog
                    kind="vendor-payment"
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
                        bankNm:
                            detailsView.detail.out_bank_nm
                            || detailsView.row.fromBank
                            || detailsView.detail.out_bank_cd,
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
                                    void downloadOriginalVendorExcel(detailsView.row.id);
                                },
                            }]
                            : []
                    }
                    requestedBy={detailsView.detail.reg_id || detailsView.row.requestor}
                    requestedAt={detailsView.row.dateTime.replace(/\n/g, " ")}
                    onClose={() => {
                        setDetailsView(null);
                        setEditMode(false);
                        setPickedLine(null);
                    }}
                    onApprove={
                        isFinalApprovalState(detailsView.detail.appr_stts) || editMode
                            ? undefined
                            : () => { void handleApprovalAction(detailsView.row.id, "APPROVE"); }
                    }
                    onReject={
                        isFinalApprovalState(detailsView.detail.appr_stts) || editMode
                            ? undefined
                            : () => { void handleApprovalAction(detailsView.row.id, "REJECT"); }
                    }
                    onMenuAction={
                        isFinalApprovalState(detailsView.detail.appr_stts) || editMode
                            ? undefined
                            : (action) => {
                                  if (action === "edit") {
                                      setPickedLine(null);
                                      setEditMode(true);
                                      return;
                                  }
                                  if (action === "withdraw") {
                                      dialog.open({
                                          type:        "confirmation",
                                          title:       t("dialog.confirmation"),
                                          description: t("approval.action.confirm_delete"),
                                          confirmText: t("dialog.continue"),
                                          cancelText:  t("dialog.cancel"),
                                          onConfirm:   handleWithdrawApproval,
                                      });
                                      return;
                                  }
                                  dialog.open({
                                      type:        "warning",
                                      title:       t("dialog.warning"),
                                      description: t("approval.action.resubmit_not_implemented"),
                                  });
                              }
                    }
                    editMode={editMode}
                    editApproverSlot={editApproverSlot}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                    editSaveDisabled={pickedLine == null || savingEdit}
                />
                );
            })()}
        </>
    );
}

/** True when the batch's approval is in a final state ("C" approved
 *  or "X" rejected) and further approve / reject actions should be
 *  suppressed. Mirrors the backend's WBE2081 idempotency guard. */
function isFinalApprovalState(apprStts: string | null): boolean {
    return apprStts === "C" || apprStts === "A" || apprStts === "X" || apprStts === "R";
}

/** Map a list-row {@link ApprovalStatus} onto the dialog's narrower
 *  {@link ApprovalOutcome} vocabulary. `draft` and unknown states
 *  fold into `pending`. */
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

/** Resolve the dialog's status badge variant from the master's
 *  freshly-fetched {@code appr_stts} when available, falling back to
 *  the list row's stale projection. Mirrors `deriveStatus` priority. */
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

/** Wire `file_size` (decimal bytes, serialised verbatim) → human-readable
 *  "x.xx KB" / "x.xx MB" suffix. Returns the raw value when parsing
 *  fails so the dialog never displays "NaN KB". */
function formatFileSize(bytesStr: string): string {
    const n = Number(bytesStr);
    if (!Number.isFinite(n) || n <= 0) return bytesStr;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Phase A bridge from approval-line approvers → dialog chip list.
 *
 * The wire's `ApiScheduledTransferDetailResponse` doesn't yet ship the
 * per-approver outcome list. Until that lands, we approximate the
 * chain by reading the user's first approval line and projecting the
 * master's batch-level `appr_stts` onto the first approver:
 *   - master apprStts === "C" → approver[0] = A (approved), rest = W
 *   - master apprStts === "X" → approver[0] = R (rejected), rest = W
 *   - master apprStts null   → approver[0] = P (pending), rest = W
 *
 * Returns an empty array when no approval lines exist — the dialog's
 * approver row hides entirely in that case.
 */
function bridgeApprovers(
    lines: ApiApprovalLineRow[],
    masterApprStts: string | null,
    masterModDtm: string | null,
): ApprovalDetailsApprover[] {
    const first = lines[0];
    if (!first || first.approvers.length === 0) return [];
    const firstOutcome: "A" | "R" | "P" =
        masterApprStts === "C" || masterApprStts === "A" ? "A"
        : masterApprStts === "X" || masterApprStts === "R" ? "R"
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

/** Format a wire `yyyyMMddHHmmss` string (UTC, 14 chars) for display
 *  on the approver chip — `"DD-MM-YYYY HH:mm"`. Returns undefined when
 *  the input is missing or shorter than 12 chars so the chip falls
 *  back to the no-date verb. */
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

/** Mirror of the V141 SYS_SCR_OPTION_WECMS seed — paint-time fallback. */
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

/** Approval-status filter options (same shape as Internal Transfer). The
 *  backend's `appr_type` param is forwarded but silently ignored today —
 *  the real filter binding lands with the EXPT_RESOL_* join. */
const APPR_TYPE_OPTIONS = [
    { value: "",   labelKey: "payment.internal.filter.all_status" },
    { value: "00", labelKey: "payment.appr_stts.draft" },
    { value: "01", labelKey: "payment.appr_stts.approved" },
    { value: "02", labelKey: "payment.appr_stts.rejected" },
    { value: "03", labelKey: "payment.appr_stts.in_progress" },
    { value: "04", labelKey: "payment.appr_stts.pending" },
    { value: "99", labelKey: "payment.appr_stts.cancelled" },
] as const;

/** Per-column FIELD_ID → backend sort key. Columns missing here render
 *  with a non-clickable header glyph (status / approver / file name —
 *  same Phase A treatment as Internal Transfer). */
const SORTABLE_COLUMNS: ScheduledBatchSortable = {
    DATE_TIME:      "REG_DTM",
    TXN_COUNT:      "TOT_TRNS_CNT",
    TOTAL_AMOUNT:   "TOTAL_TRAN_AMT",
    REQUESTOR:      "REG_ID",
    APPROVAL_REF:   "APPR_SEQ_NO",
    APPROVAL_TITLE: "TITL",
};

/* ─────────────────────────────────────────────────────────────────────────
 *  Wire → in-memory row mapper (snake_case wire → snake-case row props
 *  consumed by the shared shell). Mirrors the Phase A list mapping that
 *  shipped earlier; no changes to row shape here.
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
    doc_no?:           string | null;
}): VendorScheduledRow & PaymentScheduledBatchRow {
    const isApproved =
        api.appr_stts === "C" || api.appr_stts === "A" || api.appr_stts === "01" || api.trnf_yn === "Y";
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
        // Raw wire decimal — shell re-formats via formatAmount.
        // Double-formatting through formatNumber would mis-parse the
        // vi-VN thousand separator (`.`) as a decimal point (1000x bug).
        totalAmount:   String(api.total_tran_amt ?? "0"),
        status:        deriveStatus(api.appr_stts, api.trnf_yn, api.appr_seq_no),
        requestor:     api.reg_id,
        approver:      "",
        approvalRef:   api.appr_seq_no ?? "",
        docNo:         api.doc_no ?? null,
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
        case "00": return "draft";
    }
    if (trnfYn === "Y") return "approved";
    // Legacy / null-apprStts fallback: an apprSeqNo without an explicit
    // APPR_STTS means the batch was submitted but no approver has acted
    // yet — safer to render as Pending than In Progress. Refactor
    // backend now stamps apprStts='P' on Request Approval (see
    // VendorPaymentService.stampApproval); this fallback covers
    // legacy rows + pre-V120 imports.
    if (apprSeqNo) return "pending";
    return undefined;
}

function formatRegDtm(raw: string | null | undefined): string {
    return formatRegDtmDisplay(raw);
}

/** PeriodKey (+ optional manual range) → backend window. */
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

/** In-memory list row → `<RequestApprovalDialog>` row shape. */
function toApprovalDialogRow(
    row: VendorScheduledRow & PaymentScheduledBatchRow,
): ApprovalRow {
    return {
        id:          row.id,
        fileName:    row.fileName,
        ccyCd:       row.txnCurrency,
        totalAmount: row.totalAmount,
        txnCount:    row.txnCount,
    };
}

/** Per-line detail row → dialog transaction shape. */
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
