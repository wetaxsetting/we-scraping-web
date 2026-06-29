"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import CommonApprovalDetailsDialog from "@/components/payment/shared/CommonApprovalDetailsDialog";
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
import { useHaengsungRefresh } from "@/hooks/useHaengsungRefresh";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import { ApiCallError } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import {
    deleteExpensePayment,
    dispatchExpensePayment,
    downloadOriginalExpenseExcel,
    fetchExpensePaymentDetail,
    fetchExpenseScheduledList,
    fetchExpenseWithdrawalAccounts,
    fetchNextExpenseDocNo,
} from "@/lib/api/expensePayment";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { formatDateLang, formatRegDtmDisplay } from "@/lib/datetime";
import { validateBankingTime } from "@/lib/payment/validateBankingTime";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import type {
    ApiScheduledTransferListResponse,
    ApiTransferLineDetail,
} from "@/lib/types/api";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import ExpensePaymentUploadDialog from "./ExpensePaymentUploadDialog";
import { type ExpenseScheduledRow } from "./types";

/**
 * Payment > Expense Payment > Scheduled Payment — Figma 25:7584.
 *
 * Mirrors the Internal Transfer baseline (CLAUDE.md §12a). Server-driven
 * for pagination, sort, period, search, and the approval-status filter;
 * the toolbar's list-view icon opens the shared `<ViewSettingPopover>`
 * keyed by `payment-vendor-payment-scheduled` (seeded by V143).
 *
 * Excel Upload + Request Approval route through the shared dialogs the
 * Internal Transfer page uses — only the Vendor endpoint wiring differs.
 */
export default function ExpenseScheduledPaymentPage() {
    const { t, locale } = useTranslation();
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
        Array<ExpenseScheduledRow & PaymentScheduledBatchRow> | null
    >(null);
    // The shell owns the checkbox-selection set privately; it hands back a
    // `clearSelection` callback alongside the chosen rows. Stash it so the
    // dialog's close / cancel / submit handlers can clear the ticked rows
    // once the Request Approval flow ends.
    const clearScheduledSelection = useRef<(() => void) | null>(null);

    /* ── Approval Details dialog state ───────────────────────────────
     * Row currently being shown in the read-only Approval Details
     * dialog (legacy `comm_0195_001`). Set when the user clicks an
     * Approval Ref cell on a row that already has APPR_SEQ_NO; the
     * `detail` payload is fetched lazily before the dialog opens so
     * the General Information section can render the withdrawal
     * account + master totals from the persisted batch.
     */
    // APPR_SEQ_NO of the row opened in the SHARED CommonApprovalDetailsDialog
    // (the list row carries appr_seq_no as `approvalRef`). The shared dialog
    // self-fetches the normalized detail + approver chain and owns approve /
    // reject / edit / withdraw — the legacy one-popup architecture
    // (comm_0195_001), same as Approval Box / Internal Transfer / Vendor.
    const [commonApprSeqNo, setCommonApprSeqNo] = useState<string | null>(null);

    /* ── View Setting popover state ──────────────────────────────── */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_EXPENSE_PAYMENT_SCHEDULED,
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

    // HAENGSUNG (PRDT_TYPE='H') Oracle Refresh import — the toolbar Refresh
    // button (shown only for 'H' tenants) calls the backend import for the
    // current window, then reloads the list. Non-'H' tenants see Excel Upload
    // and never reach this. Shared across all four payment modules.
    const { refreshing, runRefresh } = useHaengsungRefresh({
        paymentType: "EXPENSE",
        getPeriodDate: () => (fromDate === toDate ? fromDate : `${fromDate}-${toDate}`),
        onSuccess: refreshList,
    });
    const state = useApiData(
        () => fetchExpenseScheduledList({
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

    /* Stable-data latch — preserves the previous response across
     * refetches so the table stays populated between filter / sort /
     * pagination changes and mutation refreshes. Mirrors the canonical
     * Account Inquiry / Approval Box pattern. */
    const [stableData, setStableData] = useState<ApiScheduledTransferListResponse | null>(state.data);
    const [prevData, setPrevData] = useState<ApiScheduledTransferListResponse | null>(state.data);
    if (state.data !== prevData) {
        setPrevData(state.data);
        if (state.data) setStableData(state.data);
    }

    const rows: Array<ExpenseScheduledRow & PaymentScheduledBatchRow> = useMemo(
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

    /* Sticky-wrapped initial-loading + mutation gates. */
    const stickyInitialLoading = useStickyLoading(state.loading && !stableData);
    const [actionInFlight, setActionInFlight] = useState(false);
    const stickyActionInFlight = useStickyLoading(actionInFlight);

    /* ── Print ───────────────────────────────────────────────────── */
    const handlePrint = useCallback(() => {
        const columns: PrintColumn<ExpenseScheduledRow & PaymentScheduledBatchRow>[] = [
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
            title: t("payment.expense.scheduled_title"),
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
        async (row: ExpenseScheduledRow & PaymentScheduledBatchRow) => {
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
                description: t("payment.expense.transfer_confirm_description", {
                    fileName: row.fileName,
                }),
                confirmText: t("dialog.continue"),
                cancelText:  t("dialog.cancel"),
                onConfirm: async () => {
                    setActionInFlight(true);
                    try {
                        await dispatchExpensePayment(row.id, { trnf_ccy_cd: row.txnCurrency });
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: row.txnCurrency === "VND"
                                ? t("payment.expense.transfer_success_vnd")
                                : t("payment.expense.transfer_success_fcy"),
                        });
                        refreshList();
                    } catch (err) {
                        surfaceError(err, "payment.expense.transfer_failed");
                    } finally {
                        setActionInFlight(false);
                    }
                },
            });
        },
        [dialog, refreshList, surfaceError, t],
    );

    const handleDeleteRow = useCallback(
        (row: ExpenseScheduledRow & PaymentScheduledBatchRow) => {
            if (row.approvalRef) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("payment.expense.delete_blocked_in_approval"),
                    errorCode: "WBE2062",
                });
                return;
            }
            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("payment.expense.delete_confirm_description", { fileName: row.fileName }),
                confirmText: t("dialog.continue"),
                cancelText:  t("dialog.cancel"),
                destructive: true,
                onConfirm: async () => {
                    setActionInFlight(true);
                    try {
                        await deleteExpensePayment(row.id);
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t("payment.expense.delete_success"),
                        });
                        refreshList();
                    } catch (err) {
                        surfaceError(err, "payment.expense.delete_failed");
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
        async (row: ExpenseScheduledRow & PaymentScheduledBatchRow) => {
            try {
                await downloadOriginalExpenseExcel(row.id);
            } catch (err) {
                surfaceError(err, "payment.expense.download_failed");
            }
        },
        [surfaceError],
    );

    const handleRequestApproval = useCallback(
        (
            chosen: Array<ExpenseScheduledRow & PaymentScheduledBatchRow>,
            clearSelection: () => void,
        ) => {
            // Remember how to clear the shell's checkboxes; only invoked
            // once the dialog actually closes/submits — a validation
            // failure below returns early and leaves the selection intact.
            clearScheduledSelection.current = clearSelection;
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

    // Approval-Ref-cell click — opens the SHARED Approval Details popup
    // (CommonApprovalDetailsDialog) keyed by APPR_SEQ_NO. The list row carries
    // appr_seq_no as `approvalRef`, so no detail fetch is needed here: the
    // shared dialog self-fetches the normalized detail + approver chain and
    // owns approve / reject / edit / withdraw (legacy comm_0195_001 single-popup
    // architecture, same as Approval Box / Internal Transfer / Vendor).
    const handleApprovalRefClick = useCallback(
        (row: ExpenseScheduledRow & PaymentScheduledBatchRow): void => {
            if (!row.approvalRef) return;
            setCommonApprSeqNo(row.approvalRef);
        },
        [],
    );

    /* ── Request Approval dialog loaders ─────────────────────────── */
    const loadVendorAccounts = useCallback(async (): Promise<RequestApprovalAccount[]> => {
        const list = await fetchExpenseWithdrawalAccounts();
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
                const detail = await fetchExpensePaymentDetail(row.id);
                (detail.rows ?? []).forEach((line, idx) => {
                    out.push(detailLineToApprovalTransaction(line, detail.ccy_cd, row.id, idx));
                });
            } catch {
                // Skip per-row failures so the dialog still opens.
            }
        }
        return out;
    }, [approvalRows]);

    /* ── Request Approval: read-only withdrawal account ───────────────
     * Expense Payment picks + saves the withdrawal account during Upload
     * (Upload Expense Payment step 3 → SCDUL_PYMN_SUMR.OUT_BANK_CD /
     * WDRL_ACT_NO); the approval submit does not change it. So Request
     * Approval shows it read-only (same concept as Internal Transfer /
     * Vendor) instead of an editable dropdown. A synchronous fallback (raw
     * code from the list row) paints immediately; an effect upgrades the
     * label to the resolved "{bankNm} {acctNo} ({type} {ccy})" form by
     * matching the batch's saved account against the enrolled list. */
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
        loadVendorAccounts()
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
    }, [approvalRows, loadVendorAccounts]);

    /* Preview the next VO_YYMMDD_NNN doc number on dialog open so drafts
     * (no saved doc_no yet) show the formatted business number instead of
     * "—". Read-only / non-reserving; soft-fails to null → dialog falls back
     * to "—". Mirrors Internal Transfer / Card. */
    const [approvalDocNo, setApprovalDocNo] = useState<string | null>(null);
    useEffect(() => {
        if (!approvalRows) { setApprovalDocNo(null); return; }
        let cancelled = false;
        fetchNextExpenseDocNo()
            .then((docNo) => { if (!cancelled) setApprovalDocNo(docNo); })
            .catch(() => { if (!cancelled) setApprovalDocNo(null); });
        return () => { cancelled = true; };
    }, [approvalRows]);

    return (
        <>
            <PaymentScheduledBatchListPage<ExpenseScheduledRow & PaymentScheduledBatchRow>
                title={t("payment.expense.scheduled_title")}
                rows={rows}
                rowDetailHref={(row) => `/payment/expense-payment/scheduled-payment/${row.id}`}
                onApprovalRefClick={handleApprovalRefClick}
                totals={totals}
                onExcelUpload={openUpload}
                onRefresh={runRefresh}
                refreshing={refreshing}
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
                fieldIdMap={FIELD_ID_MAP}
                loading={stickyInitialLoading}
                actionInFlight={stickyActionInFlight}
                extraColumn={{
                    key:         "scheduleDate",
                    label:       t("payment.internal.col.schedule_date"),
                    // Width sourced from the live View Setting seed (V225:
                    // PAY_DATE = '150px'). Falls back to the FALLBACK_COLUMNS
                    // PAY_DATE value when the API hasn't resolved or V225
                    // hasn't applied to the local DB yet.
                    width:       scheduledDateWidth(vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS) ?? "var(--w-wb-st-schedule-date)",
                    sortFieldId: "PAY_DATE",
                    render: (row) => (
                        <span className="block truncate text-wb-13 font-medium text-wb-ink">
                            {formatDateLang(row.scheduleDate, locale)}
                        </span>
                    ),
                }}
                onTransferRow={handleTransferRow}
                onDeleteRow={handleDeleteRow}
                onDownloadRow={handleDownloadRow}
                onRequestApproval={handleRequestApproval}
                emptyMessage={t("payment.expense.scheduled_empty")}
            />
            {uploadOpen && (
                <ExpensePaymentUploadDialog
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
                    kind="expense-payment"
                    selectedRows={approvalRows.map(toApprovalDialogRow)}
                    loadTransactions={loadVendorTransactions}
                    // Document No. priority: saved docNo (submitted) → approvalRef
                    // → preview VO_YYMMDD_NNN (drafts, via /next-doc-no) → "—".
                    // Never the raw internal scdul_pymn_no. Preview is read-only /
                    // non-reserving and soft-fails to "—" if unreachable.
                    documentNo={approvalRows[0]?.docNo || approvalRows[0]?.approvalRef || approvalDocNo || "—"}
                    // Read-only: the withdrawal account was chosen at Upload
                    // Expense Payment (step 3) and saved on the batch; not
                    // re-selectable here. Same concept as Internal Transfer / Vendor.
                    fixedWithdrawalAccount={withdrawalResolved ?? withdrawalFallback ?? undefined}
                    onClose={() => {
                        setApprovalRows(null);
                        clearScheduledSelection.current?.();
                    }}
                    onSubmitted={() => {
                        setApprovalRows(null);
                        clearScheduledSelection.current?.();
                        setPage(0);
                        refreshList();
                    }}
                />
            )}
            {/* Shared Approval Details popup — opened from the row's Approval
               Ref cell (legacy comm_0195_001 single-popup architecture, same as
               Approval Box / Internal Transfer / Vendor / Result pages). Keyed
               by APPR_SEQ_NO (the list row's `approvalRef`); self-fetches the
               normalized detail + approver chain and owns approve / reject /
               edit / withdraw. On close, refresh the list so a status change
               made inside the popup re-renders the row badge + totals. */}
            {commonApprSeqNo && (
                <CommonApprovalDetailsDialog
                    apprSeqNo={commonApprSeqNo}
                    onClose={() => {
                        setCommonApprSeqNo(null);
                        refreshList();
                    }}
                />
            )}
        </>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Constants
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Mirror of the V225 SYS_SCR_OPTION_WECMS seed for
 * `payment-expense-payment-scheduled` / `default`. Paint-time fallback
 * used while the API resolves.
 *
 * Aligned with legacy `pymn_0003_001` PROD widths + FIELD_IDs.
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "CHECKBOX",       field_nm: "Checkbox",              disp_ord: 0,  disp_yn: "Y", use_yn: "Y", size: "40px",  sort_yn: "N" },
    { field_id: "REG_DTM",        field_nm: "Date/Time",             disp_ord: 1,  disp_yn: "Y", use_yn: "Y", size: "105px", sort_yn: "Y" },
    { field_id: "FILE_NM",        field_nm: "File Name",             disp_ord: 2,  disp_yn: "Y", use_yn: "Y", size: "290px", sort_yn: "Y" },
    { field_id: "TOT_TRNS_CNT",   field_nm: "No. of Transactions",   disp_ord: 3,  disp_yn: "Y", use_yn: "Y", size: "180px", sort_yn: "Y" },
    { field_id: "TOTAL_TRAN_AMT", field_nm: "Total Transfer Amount", disp_ord: 4,  disp_yn: "Y", use_yn: "Y", size: "200px", sort_yn: "Y" },
    { field_id: "PAY_DATE",       field_nm: "Scheduled Date",        disp_ord: 5,  disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "APPR_STTS",      field_nm: "Approval Status",       disp_ord: 6,  disp_yn: "Y", use_yn: "Y", size: "155px", sort_yn: "Y" },
    { field_id: "DRAFT_USER_NM",  field_nm: "Requestor",             disp_ord: 7,  disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "APPRVR_NM",      field_nm: "Approver",              disp_ord: 8,  disp_yn: "Y", use_yn: "Y", size: "175px", sort_yn: "Y" },
    { field_id: "APPR_DOC_NO",    field_nm: "Approval Ref.",         disp_ord: 9,  disp_yn: "Y", use_yn: "Y", size: "160px", sort_yn: "Y" },
    { field_id: "TITL",           field_nm: "Approval Title",        disp_ord: 10, disp_yn: "Y", use_yn: "Y", size: "250px", sort_yn: "Y" },
    { field_id: "ETC",            field_nm: "",                      disp_ord: 99, disp_yn: "N", use_yn: "Y", size: "150px", sort_yn: "N" },
];

/**
 * FIELD_ID aliases supplied to `<PaymentScheduledBatchListPage>` so the
 * shell maps each column slot to the legacy V225 FIELD_ID rather than
 * the V143 default (`TITL` for File Name, `REG_ID` for Requestor, …).
 */
const FIELD_ID_MAP = {
    fileName:      "FILE_NM",
    requestor:     "DRAFT_USER_NM",
    approver:      "APPRVR_NM",
    approvalRef:   "APPR_DOC_NO",
    approvalTitle: "TITL",
} as const;

/** Resolve PAY_DATE's DB-driven width for the shell's `extraColumn`
 *  slot so the Scheduled Date column matches every other column's
 *  width source. */
function scheduledDateWidth(items: ViewSettingItem[]): string | undefined {
    return items.find((it) => it.field_id === "PAY_DATE")?.size ?? undefined;
}

/** Approval-status filter options (same shape as Internal Transfer). The
 *  backend's `appr_type` param is forwarded but silently ignored today —
 *  the real filter binding lands with the EXPT_RESOL_* join. */
const APPR_TYPE_OPTIONS = [
    { value: "",   labelKey: "payment.appr_stts.all" },
    { value: "00", labelKey: "payment.appr_stts.not_requested" },
    { value: "04", labelKey: "payment.appr_stts.pending" },
    { value: "03", labelKey: "payment.appr_stts.in_progress" },
    { value: "01", labelKey: "payment.appr_stts.approved" },
    { value: "02", labelKey: "payment.appr_stts.rejected" },
] as const;

/**
 * Per-column FIELD_ID map (aligned with V225 legacy FIELD_IDs).
 *
 * Sortable today (entity column directly available on `ScdulPymnSumr`):
 *   DATE_TIME / FILE_NAME / TXN_COUNT / TOTAL_AMOUNT / STATUS /
 *   REQUESTOR / APPROVAL_REF / APPROVAL_TITLE.
 *
 * Sortable via the `extraColumn` slot: PAY_DATE.
 *
 * Deferred (no whitelist entry; header glyph renders but backend
 * silently falls back to default ORDER BY):
 *   APPROVER (APPRVR_NM) — requires the EXPT_RESOL_APPRVR_INFM join.
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
    /** Requestor display name (legacy EXPT_RESOL_MSTR.DRAFT_USER_NM); null →
     *  fall back to reg_id. */
    draft_user_nm?:    string | null;
    appr_stts:         string | null;
    trnf_yn:           string | null;
    ccy_cd:            string;
    out_bank_cd:       string;
    wdrl_act_no:       string | null;
    file_nm:           string | null;
    pay_date?:         string | null;
    doc_no?:           string | null;
    // G4: Approver column wire fields (shared ApiScheduledTransferRow).
    approver?:         string | null;
    approver_count?:   number | null;
    approvers?:        { apprvr_nm: string | null; apprvr_stts: string | null; appr_dtm: string | null }[] | null;
}): ExpenseScheduledRow & PaymentScheduledBatchRow {
    const isApproved =
        api.appr_stts === "C" || api.appr_stts === "A" || api.appr_stts === "01" || api.trnf_yn === "Y";
    let action: "transfer" | "complete" | undefined;
    if (isApproved && api.trnf_yn === "Y") {
        action = "complete";
    } else if (isApproved && api.trnf_yn !== "Y" && api.appr_seq_no) {
        action = "transfer";
    }

    // Approval Status + progress count — mirrors legacy `pymn_0003_001`
    // `fn_apprStt`: "Approved" and "In Progress" append
    // `APPRVR_APPR_TOT_CNT/APPRVR_TOT_CNT` ("Approved 1/1", "In Progress
    // 1/5"); the legacy guard `if (APPRVR_TOT_CNT && APPRVR_APPR_TOT_CNT)`
    // shows the count only when both are non-zero. Pending / Rejected never
    // show a count.
    //   total    = APPRVR_TOT_CNT       = approver-chain length
    //   approved = APPRVR_APPR_TOT_CNT  = approvers with APPRVR_STTS = 'A'
    const status = deriveStatus(api.appr_stts, api.trnf_yn, api.appr_seq_no);
    const totalApprovers = api.approver_count ?? (api.approvers?.length ?? 0);
    const approvedApprovers = (api.approvers ?? []).filter((a) => a.apprvr_stts === "A").length;
    const statusStep =
        (status === "approved" || status === "in_progress") &&
        totalApprovers > 0 &&
        approvedApprovers > 0
            ? `${approvedApprovers}/${totalApprovers}`
            : undefined;

    return {
        id:            api.scdul_pymn_no,
        dateTime:      formatRegDtm(api.reg_dtm),
        dateTimeRaw:   api.reg_dtm ?? undefined,
        fileName:      api.file_nm ?? api.titl,
        txnCount:      Number(api.tot_trns_cnt ?? "0") || 0,
        txnCurrency:   api.ccy_cd,
        // Raw wire decimal — shell re-formats via formatAmount.
        totalAmount:   String(api.total_tran_amt ?? "0"),
        status,
        // Approval progress count ("1/5") appended by the shared
        // <StatusBadge> for Approved / In Progress (legacy fn_apprStt).
        statusStep,
        // Requestor = legacy EXPT_RESOL_MSTR.DRAFT_USER_NM (발의자명, the
        // requesting user's display name). Renders BLANK when null (draft —
        // no approval request yet), matching legacy `null2void(DRAFT_USER_NM)`.
        // We do NOT fall back to reg_id: reg_id is the creator LOGIN id (email),
        // which legacy never shows in this column.
        requestor:     api.draft_user_nm ?? "",
        // G4: Approver cell — first approver name + [N] badge + click popup.
        // approverCount/approvers stay undefined pre-approval so the badge hides
        // and the chevron is inert (mirrors Internal Transfer's ScheduledTransferPage).
        approver:      api.approver ?? "",
        approverCount: api.approver_count ?? undefined,
        approvers:     api.approvers && api.approvers.length > 0
            ? api.approvers.map((a) => ({
                  name:    a.apprvr_nm ?? "",
                  status:  a.apprvr_stts ?? "",
                  actedAt: formatApprActedAt(a.appr_dtm),
                  actedAtRaw: a.appr_dtm ?? null,
              }))
            : undefined,
        approvalRef:   api.appr_seq_no ?? "",
        docNo:         api.doc_no ?? null,
        // Approval Title = legacy EXPT_RESOL_MSTR.TITL, NULL until the batch
        // is submitted (LEFT JOIN on APPR_SEQ_NO in SCDUL_PYMN_SUMR_R002).
        // Blank for not-yet-requested rows to match legacy pymn_0003_001;
        // the refactor's `titl` source is always populated, so gate it.
        approvalTitle: api.appr_seq_no ? api.titl : "",
        action,
        rowHighlight:  api.appr_seq_no ? undefined : "warning",
        fromBank:      api.out_bank_cd,
        fromAccount:   api.wdrl_act_no ?? undefined,
        canDelete:     !api.appr_seq_no,
        canDownloadFile: Boolean(api.file_nm),
        // Scheduled Date — `yyyymmdd` from the wire → `dd-mm-yyyy` for
        // the shell's `extraColumn` slot. Legacy mirror: pymn_0003_001.
        // Store RAW yyyyMMdd PAY_DATE — formatted locale-aware at render
        // (date-only → no timezone shift).
        scheduleDate:  api.pay_date ?? "",
    };
}

/** G4: `yyyyMMddHHmmss` → `dd-MM-yyyy HH:mm:ss` for the approver-popup
 *  "acted at" datetime; null when not yet acted (popup renders "-").
 *  Mirrors `mappers.ts formatActedAt` used by Internal Transfer. */
function formatApprActedAt(dtm: string | null | undefined): string | null {
    if (!dtm || dtm.length !== 14) return null;
    return `${dtm.slice(6, 8)}-${dtm.slice(4, 6)}-${dtm.slice(0, 4)} ${dtm.slice(8, 10)}:${dtm.slice(10, 12)}:${dtm.slice(12, 14)}`;
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
    row: ExpenseScheduledRow & PaymentScheduledBatchRow,
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
        // Server-resolved bank name. Empty when the lookup misses;
        // the cell renderer drops the " - " separator in that case.
        depositBankName:     line.tar_bank_nm ?? "",
        depositBankCcyCd:    line.depo_ccy_cd ?? line.ccy_cd ?? batchCcy,
        depositAccountNo:    line.finc_mda_no ?? "",
        transferAmount:      formatAmount(line.tran_amt, line.ccy_cd ?? batchCcy, false),
        recipientName:       line.rcpt_nm ?? undefined,
        remarks:             line.note ?? undefined,
        description:         line.tran_usag ?? undefined,
        documentNo:          line.doc_no ?? undefined,
        reportingAccount,
        // Chart-account ancestor chain — preserved so the reporting-account
        // breadcrumb matches the Approval Box entry for the same document.
        reportingBreadcrumb: line.chart_acct_breadcrumb ?? undefined,
    };
}
