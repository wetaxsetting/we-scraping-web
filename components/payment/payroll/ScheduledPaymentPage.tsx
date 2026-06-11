"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import ApprovalDetailsDialog, {
    chainToDialogApprovers,
    isCurrentUserActiveApprover,
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
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import { fetchApprovalBoxApprovers } from "@/lib/api/approval-box";
import { ApiCallError } from "@/lib/api/banking";
import { userStorage } from "@/lib/auth/storage";
import { useApiData } from "@/lib/api/useApiData";
import {
    actOnPayrollApproval,
    changePayrollApprovalLine,
    deletePayrollPayment,
    dispatchPayrollPayment,
    downloadOriginalPayrollExcel,
    fetchPayrollPaymentDetail,
    fetchPayrollScheduledList,
    fetchPayrollWithdrawalAccounts,
    withdrawPayrollApproval,
} from "@/lib/api/payrollPayment";
import EditApprovalLinePicker, {
    type EditApprovalLinePreview,
} from "@/components/payment/corporate-card/EditApprovalLinePicker";
import { formatAmount, formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { formatRegDtmDisplay } from "@/lib/datetime";
import { validateBankingTime } from "@/lib/payment/validateBankingTime";
import { resolvePayrollTypeLabel } from "@/lib/payment/payrollType";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import type {
    ApiApprovalLineRow,
    ApiScheduledTransferDetailResponse,
    ApiScheduledTransferListResponse,
    ApiTransferLineDetail,
} from "@/lib/types/api";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import PayrollPaymentUploadDialog from "./PayrollPaymentUploadDialog";
import { type PayrollScheduledRow } from "./types";

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
    // Approval Details edit-mode state — same pattern as Internal
    // Transfer / Vendor / Expense.
    const [editMode, setEditMode]       = useState(false);
    const [pickedLine, setPickedLine]   = useState<EditApprovalLinePreview | null>(null);
    const [savingEdit, setSavingEdit]   = useState(false);

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

    /* Stable-data latch + sticky loading + sticky action-in-flight —
     * smooth empty/loading/refetch transitions per the canonical
     * Account Inquiry / Approval Box pattern. */
    const [stableData, setStableData] = useState<ApiScheduledTransferListResponse | null>(state.data);
    const [prevData, setPrevData] = useState<ApiScheduledTransferListResponse | null>(state.data);
    if (state.data !== prevData) {
        setPrevData(state.data);
        if (state.data) setStableData(state.data);
    }

    const rows: Array<PayrollScheduledRow & PaymentScheduledBatchRow> = useMemo(
        () => (stableData?.rows ?? []).map(toListRow),
        [stableData],
    );

    const totals = useMemo(
        () => (stableData?.currency_totals ?? []).map((c) => ({
            currency: c.ccy_cd,
            amount:   formatAmount(c.total_amount, c.ccy_cd, true),
        })),
        [stableData],
    );
    const totalCount = stableData?.total_count ?? 0;

    const stickyInitialLoading = useStickyLoading(state.loading && !stableData);
    const [actionInFlight, setActionInFlight] = useState(false);
    const stickyActionInFlight = useStickyLoading(actionInFlight || savingEdit);

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
            { header: t("payment.internal.col.approval_ref"),   render: (r) => escapeHtml(r.docNo ?? r.approvalRef) },
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
                    setActionInFlight(true);
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
                    } finally {
                        setActionInFlight(false);
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
                    setActionInFlight(true);
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
                    } finally {
                        setActionInFlight(false);
                    }
                },
            });
        },
        [dialog, refreshList, surfaceError, t],
    );

    // Per-row download of the batch's original uploaded Excel. Mirrors the
    // Internal Transfer / Overseas handlers so the Scheduled list renders the
    // download glyph whenever the row has an on-disk file (canDownloadFile).
    const handleDownloadRow = useCallback(
        async (row: PayrollScheduledRow & PaymentScheduledBatchRow) => {
            try {
                await downloadOriginalPayrollExcel(row.id);
            } catch (err) {
                surfaceError(err, "payment.payroll.download_failed");
            }
        },
        [surfaceError],
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
            setActionInFlight(true);
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
            } finally {
                setActionInFlight(false);
            }
        },
        [dialog, refreshList, surfaceError, t],
    );

    // Withdraw the current approval request — kebab "Delete" action.
    const handleWithdrawApproval = useCallback(async () => {
        if (!detailsView) return;
        setActionInFlight(true);
        try {
            await withdrawPayrollApproval(detailsView.row.id);
            setDetailsView(null);
            dialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("approval.action.delete_success"),
            });
            refreshList();
        } catch (err) {
            surfaceError(err, "approval.action.delete_failed");
        } finally {
            setActionInFlight(false);
        }
    }, [detailsView, dialog, refreshList, surfaceError, t]);

    // Save the picked approval line via the real change-approval-line
    // endpoint — kebab "Edit" → Save action.
    const handleEditSave = useCallback(async () => {
        if (!detailsView || !pickedLine) return;
        setSavingEdit(true);
        try {
            await changePayrollApprovalLine(detailsView.row.id, pickedLine.apprLineNo);
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

    const handleApprovalRefClick = useCallback(
        (row: PayrollScheduledRow & PaymentScheduledBatchRow): void => {
            if (!row.approvalRef) return;
            fetchPayrollPaymentDetail(row.id)
                .then((detail) =>
                    fetchApprovalBoxApprovers(detail.appr_seq_no)
                        .catch(() => [])
                        .then((chain) => {
                            setDetailsView({
                                row,
                                detail,
                                approvers: chainToDialogApprovers(chain),
                            });
                        }),
                )
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

    /* ── Request Approval: read-only withdrawal account ───────────── */
    // Mirrors Internal Transfer: the withdrawal account is chosen + saved
    // at payment-creation/upload time (SCDUL_PYMN_SUMR.OUT_BANK_CD /
    // WDRL_ACT_NO) and is not changed by the approval submit, so Request
    // Approval shows it read-only. A synchronous fallback (raw code from
    // the list row) paints immediately; an effect upgrades the label to
    // the resolved "{bankNm} {acctNo} ({type} {ccy})" form by matching
    // the batch's saved account against the enrolled-account list.
    const withdrawalFallback = useMemo(() => {
        const row = approvalRows?.[0];
        if (!row) return null;
        return {
            bankCd:  row.fromBank || undefined,
            acctNo:  row.fromAccount ?? "",
            ccyCd:   row.txnCurrency,
            display: `${[row.fromBank, row.fromAccount].filter(Boolean).join(" ")} (${row.txnCurrency})`,
        };
    }, [approvalRows]);

    const [withdrawalResolved, setWithdrawalResolved] = useState<{
        bankCd?: string; acctNo: string; ccyCd: string; display: string;
    } | null>(null);

    useEffect(() => {
        const row = approvalRows?.[0];
        if (!row) { setWithdrawalResolved(null); return; }
        let cancelled = false;
        loadPayrollAccounts()
            .then((accts) => {
                if (cancelled) return;
                const match = accts.find((a) => a.acctNo === row.fromAccount);
                if (!match) return; // keep the synchronous fallback
                const typeLabel =
                    match.acctTypeCd === "03" || match.acctTypeCd === "04" || match.acctTypeCd === "07"
                        ? "Current"
                        : "Savings";
                setWithdrawalResolved({
                    bankCd:  match.bankCd,
                    acctNo:  match.acctNo,
                    ccyCd:   match.ccyCd,
                    display: `${match.bankNm} ${match.acctNo} (${typeLabel} ${match.ccyCd})`,
                });
            })
            .catch(() => { /* keep the synchronous fallback */ });
        return () => { cancelled = true; };
    }, [approvalRows, loadPayrollAccounts]);

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

    // Live View Setting config (falls back to the V232-mirror until the
    // API resolves) — single source for the column widths the two
    // extra-column slots consume.
    const activeViewSettingItems = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;

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
                viewSettingItems={activeViewSettingItems}
                fieldIdMap={FIELD_ID_MAP}
                extraColumn={{
                    key:         "scheduleDate",
                    label:       t("payment.internal.col.schedule_date"),
                    // Width sourced from the live View Setting seed (V232:
                    // PAY_DATE = '150px'); falls back to the CSS var until
                    // the API resolves.
                    width:       widthForField(activeViewSettingItems, "PAY_DATE") ?? "var(--w-wb-st-schedule-date)",
                    sortFieldId: "PAY_DATE",
                    render: (row) => (
                        <span className="block truncate text-wb-13 font-medium text-wb-ink">
                            {row.scheduleDate || ""}
                        </span>
                    ),
                }}
                extraColumnAfterStatus={{
                    key:    "payrollType",
                    label:  t("payment.payroll.col.payroll_type"),
                    // Width from the V232 seed (APPR_FUND_TP = '150px').
                    width:  widthForField(activeViewSettingItems, "APPR_FUND_TP") ?? "150px",
                    // No sortFieldId — APPR_FUND_TP projects from
                    // EXPT_RESOL_MSTR (join), not sortable via the paged
                    // entity query (matches Approver's deferral).
                    render: (row) => (
                        <span className="block truncate text-wb-13 font-medium text-wb-ink">
                            {row.payrollType === "0"
                                ? t("payment.payroll.fund_type.salary")
                                : row.payrollType === "1"
                                    ? t("payment.payroll.fund_type.bonus")
                                    : ""}
                        </span>
                    ),
                }}
                loading={stickyInitialLoading}
                actionInFlight={stickyActionInFlight}
                onTransferRow={handleTransferRow}
                onDeleteRow={handleDeleteRow}
                onDownloadRow={handleDownloadRow}
                onRequestApproval={handleRequestApproval}
                emptyMessage={t("payment.payroll.scheduled_empty")}
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
                    documentNo={approvalRows[0]?.docNo || approvalRows[0]?.approvalRef || approvalRows[0]?.id}
                    // Read-only: the withdrawal account was chosen at payment
                    // creation / upload and saved on the batch; not re-selectable here.
                    fixedWithdrawalAccount={withdrawalResolved ?? withdrawalFallback ?? undefined}
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
                    kind="payroll"
                    title={detailsView.row.approvalTitle || detailsView.row.fileName}
                    status={detailStatusToOutcome(
                        detailsView.detail.appr_stts,
                        detailsView.row.status,
                    )}
                    documentNo={detailsView.detail.doc_no || detailsView.row.id}
                    scheduledDate={detailsView.row.scheduleDate}
                    // Resolve APPR_FUND_TP → label with full legacy
                    // comm_0195_001.ts:885-898 parity: 0→Salary, 1→Bonus,
                    // 9→Other, and withdrawal bank 11704088 →
                    // "Salary/Allowance/Bonus" (overrides the code). Both
                    // inputs already arrive on the Scheduled detail
                    // (row.payrollType = appr_fund_tp; detail.out_bank_cd).
                    payrollType={resolvePayrollTypeLabel(
                        detailsView.row.payrollType,
                        detailsView.detail.out_bank_cd,
                        t,
                    )}
                    totalAmount={formatAmount(
                        detailsView.detail.total_tran_amt,
                        detailsView.detail.ccy_cd,
                        true,
                    )}
                    withdrawalAccount={{
                        // Internal 8-char bank code — keys the
                        // blocked-chars tooltip on the Remarks header.
                        bankCd: detailsView.detail.out_bank_cd ?? undefined,
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
                                    void downloadOriginalPayrollExcel(detailsView.row.id);
                                },
                            }]
                            : []
                    }
                    /* Footer "Requested by {name}" = legacy comm_0195_001
                       `data.REG_NM` (the requester's NAME). Prefer the detail's
                       requestor (DRAFT_USER_NM), then the list row, blank when
                       absent. NEVER reg_id (login/email). */
                    requestedBy={detailsView.detail.requestor || detailsView.row.requestor || ""}
                    requestedAt={detailsView.row.dateTime.replace(/\n/g, " ")}
                    onClose={() => {
                        setDetailsView(null);
                        setEditMode(false);
                        setPickedLine(null);
                    }}
                    onApprove={
                        !isFinalApprovalState(detailsView.detail.appr_stts) &&
                        isCurrentUserActiveApprover(detailsView.approvers, userStorage.get()?.userId) &&
                        !editMode && !stickyActionInFlight
                            ? () => { void handleApprovalAction(detailsView.row.id, "APPROVE"); }
                            : undefined
                    }
                    onReject={
                        !isFinalApprovalState(detailsView.detail.appr_stts) &&
                        isCurrentUserActiveApprover(detailsView.approvers, userStorage.get()?.userId) &&
                        !editMode && !stickyActionInFlight
                            ? () => { void handleApprovalAction(detailsView.row.id, "REJECT"); }
                            : undefined
                    }
                    onMenuAction={
                        isFinalApprovalState(detailsView.detail.appr_stts) || editMode || stickyActionInFlight
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
                    editSaveDisabled={pickedLine == null || stickyActionInFlight}
                />
                );
            })()}
        </>
    );
}

function isFinalApprovalState(apprStts: string | null): boolean {
    return apprStts === "C" || apprStts === "A" || apprStts === "X" || apprStts === "R";
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

/**
 * Mirror of the V232 SYS_SCR_OPTION_WECMS seed for
 * `payment-payroll-payment-scheduled` / `default` — paint-time fallback
 * while the API resolves. The authoritative config comes from the
 * backend seed; this exists only to bridge first render and drive widths
 * until V232 is applied locally.
 *
 * Aligned with legacy `pymn_0005_001` PROD widths + FIELD_IDs (matches
 * the Internal Transfer V217 set, plus the Payroll-only APPR_FUND_TP
 * "Payroll Type" column at disp_ord 7): FILE_NM (File Name) is separate
 * from TITL (Approval Title); DRAFT_USER_NM replaces REG_ID; APPR_DOC_NO
 * replaces APPR_SEQ_NO; PAY_DATE (Scheduled Date), APPR_FUND_TP (Payroll
 * Type) + APPRVR_NM (Approver) are View-Setting-gated columns.
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "CHECKBOX",       field_nm: "Checkbox",              disp_ord: 0,  disp_yn: "Y", use_yn: "Y", size: "40px",  sort_yn: "N" },
    { field_id: "REG_DTM",        field_nm: "Date/Time",             disp_ord: 1,  disp_yn: "Y", use_yn: "Y", size: "105px", sort_yn: "Y" },
    { field_id: "FILE_NM",        field_nm: "File Name",             disp_ord: 2,  disp_yn: "Y", use_yn: "Y", size: "290px", sort_yn: "Y" },
    { field_id: "TOT_TRNS_CNT",   field_nm: "No. of Transactions",   disp_ord: 3,  disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "TOTAL_TRAN_AMT", field_nm: "Total Transfer Amount", disp_ord: 4,  disp_yn: "Y", use_yn: "Y", size: "200px", sort_yn: "Y" },
    { field_id: "PAY_DATE",       field_nm: "Scheduled Date",        disp_ord: 5,  disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "APPR_STTS",      field_nm: "Approval Status",       disp_ord: 6,  disp_yn: "Y", use_yn: "Y", size: "170px", sort_yn: "Y" },
    { field_id: "APPR_FUND_TP",   field_nm: "Payroll Type",          disp_ord: 7,  disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "DRAFT_USER_NM",  field_nm: "Requestor",             disp_ord: 8,  disp_yn: "Y", use_yn: "Y", size: "100px", sort_yn: "Y" },
    { field_id: "APPRVR_NM",      field_nm: "Approver",              disp_ord: 9,  disp_yn: "Y", use_yn: "Y", size: "175px", sort_yn: "Y" },
    { field_id: "APPR_DOC_NO",    field_nm: "Approval Ref.",         disp_ord: 10, disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "TITL",           field_nm: "Approval Title",        disp_ord: 11, disp_yn: "Y", use_yn: "Y", size: "250px", sort_yn: "Y" },
    { field_id: "ETC",            field_nm: "",                      disp_ord: 99, disp_yn: "N", use_yn: "Y", size: "150px", sort_yn: "N" },
];

/**
 * FIELD_ID aliases supplied to `<PaymentScheduledBatchListPage>` so the
 * shell maps each column slot to the legacy V232 FIELD_ID rather than the
 * V144 default (`TITL`=File Name, `REG_ID`=Requestor, `APPR_SEQ_NO`=
 * Approval Ref). Used for both visibility gating AND DB width lookup.
 * Mirrors Internal Transfer's FIELD_ID_MAP.
 */
const FIELD_ID_MAP = {
    fileName:      "FILE_NM",
    requestor:     "DRAFT_USER_NM",
    approver:      "APPRVR_NM",
    approvalRef:   "APPR_DOC_NO",
    approvalTitle: "TITL",
} as const;

/** Resolve a column's DB-driven width from the live View Setting items so
 *  the extra-column slots match every other column's width source.
 *  Returns undefined when the seed hasn't shipped a size for the field —
 *  caller falls back to a CSS var. */
function widthForField(items: ViewSettingItem[], fieldId: string): string | undefined {
    return items.find((it) => it.field_id === fieldId)?.size ?? undefined;
}

/** `yyyymmdd` → `dd-mm-yyyy` for the Scheduled Date column. Blank /
 *  malformed input → empty string. Mirrors Internal Transfer's
 *  `formatPayDate`. */
function formatPayDate(raw: string | null | undefined): string {
    if (!raw || raw.length !== 8) return "";
    return `${raw.slice(6, 8)}-${raw.slice(4, 6)}-${raw.slice(0, 4)}`;
}


/** G4: `yyyyMMddHHmmss` → `dd-MM-yyyy HH:mm:ss` for the approver-popup
 *  "acted at" datetime; null when not yet acted (popup renders "-").
 *  Mirrors Vendor / Expense / Internal Transfer's formatApprActedAt. */
function formatApprActedAt(dtm: string | null | undefined): string | null {
    if (!dtm || dtm.length !== 14) return null;
    return `${dtm.slice(6, 8)}-${dtm.slice(4, 6)}-${dtm.slice(0, 4)} ${dtm.slice(8, 10)}:${dtm.slice(10, 12)}:${dtm.slice(12, 14)}`;
}

const APPR_TYPE_OPTIONS = [
    { value: "",   labelKey: "payment.appr_stts.all" },
    { value: "00", labelKey: "payment.appr_stts.not_requested" },
    { value: "04", labelKey: "payment.appr_stts.pending" },
    { value: "03", labelKey: "payment.appr_stts.in_progress" },
    { value: "01", labelKey: "payment.appr_stts.approved" },
    { value: "02", labelKey: "payment.appr_stts.rejected" },
] as const;

/**
 * Per-column sort mapping → backend `PayrollPaymentSortField` FIELD_IDs
 * (V232-aligned). PAY_DATE sorts via the `extraColumn.sortFieldId` slot.
 *
 * APPRVR_NM (Approver) and APPR_FUND_TP (Payroll Type) are intentionally
 * absent: both project from `EXPT_RESOL_MSTR` / the approval-line join,
 * which the single-table paged query can't sort on — so their headers
 * render non-clickable (no glyph). Same deferral as Internal Transfer's
 * Approver column.
 */
const SORTABLE_COLUMNS: ScheduledBatchSortable = {
    DATE_TIME:      "REG_DTM",
    FILE_NAME:      "FILE_NM",
    TXN_COUNT:      "TOT_TRNS_CNT",
    TOTAL_AMOUNT:   "TOTAL_TRAN_AMT",
    STATUS:         "APPR_STTS",
    REQUESTOR:      "DRAFT_USER_NM",
    APPROVAL_REF:   "APPR_DOC_NO",
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
    /** Requestor display name (legacy EXPT_RESOL_MSTR.DRAFT_USER_NM); null →
     *  fall back to reg_id. */
    draft_user_nm?:    string | null;
    appr_stts:         string | null;
    trnf_yn:           string | null;
    ccy_cd:            string;
    out_bank_cd:       string;
    wdrl_act_no:       string | null;
    pay_date:          string | null;
    file_nm:           string | null;
    doc_no?:           string | null;
    appr_fund_tp:      string | null;
    // G4: Approver column wire fields (shared ApiScheduledTransferRow).
    approver?:         string | null;
    approver_count?:   number | null;
    approvers?:        { apprvr_nm: string | null; apprvr_stts: string | null; appr_dtm: string | null }[] | null;
}): PayrollScheduledRow & PaymentScheduledBatchRow {
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
        totalAmount:   String(api.total_tran_amt ?? "0"),
        status:        deriveStatus(api.appr_stts, api.trnf_yn, api.appr_seq_no),
        // Requestor = legacy EXPT_RESOL_MSTR.DRAFT_USER_NM (발의자명, the
        // requesting user's display name). Renders BLANK when null (draft —
        // no approval request yet), matching legacy `null2void(DRAFT_USER_NM)`.
        // We do NOT fall back to reg_id: reg_id is the creator LOGIN id (email),
        // which legacy never shows in this column.
        requestor:     api.draft_user_nm ?? "",
        // G4: Approver cell — first approver name + [N] badge + click popup.
        // approverCount/approvers stay undefined pre-approval so the badge hides
        // and the chevron is inert (mirrors Vendor / Expense / Internal Transfer).
        approver:      api.approver ?? "",
        approverCount: api.approver_count ?? undefined,
        approvers:     api.approvers && api.approvers.length > 0
            ? api.approvers.map((a) => ({
                  name:    a.apprvr_nm ?? "",
                  status:  a.apprvr_stts ?? "",
                  actedAt: formatApprActedAt(a.appr_dtm),
              }))
            : undefined,
        approvalRef:   api.appr_seq_no ?? "",
        docNo:         api.doc_no ?? null,
        approvalTitle: api.titl,
        scheduleDate:  formatPayDate(api.pay_date),
        // Raw APPR_FUND_TP code — label resolved at render time (locale-reactive).
        payrollType:   api.appr_fund_tp,
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
        // Server-resolved bank name. Empty when the lookup misses;
        // the cell renderer drops the " - " separator in that case.
        depositBankName:     line.tar_bank_nm ?? "",
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
