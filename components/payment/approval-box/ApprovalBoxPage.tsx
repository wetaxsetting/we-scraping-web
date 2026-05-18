"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import {
    approveApprovalBoxRow,
    rejectApprovalBoxRow,
} from "@/lib/api/approval-box";
import { ApiCallError } from "@/lib/api/banking";
import { fetchExpensePaymentDetail } from "@/lib/api/expensePayment";
import { fetchScheduledTransferDetail } from "@/lib/api/internalTransfer";
import {
    approvalBoxCurrencyTotal,
    mapScheduledTransferDetail,
    type TransferLineDetail,
} from "@/lib/api/mappers";
import { fetchPayrollPaymentDetail } from "@/lib/api/payrollPayment";
import { fetchVendorPaymentDetail } from "@/lib/api/vendorPayment";
import { useTranslation } from "@/lib/i18n";
import { escapeHtml, printReport } from "@/lib/print";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";
import { useExcelExport, type ExcelExportColumnConfig } from "@/hooks/useExcelExport";

import ApprovalDetailsDialog, {
    type ApprovalDetailsApprover,
    type ApprovalOutcome,
} from "@/components/payment/shared/ApprovalDetailsDialog";
import type {
    RequestApprovalKind,
    RequestApprovalTransaction,
} from "@/components/payment/shared/RequestApprovalDialog";

import ApprovalTable from "./ApprovalTable";
import ApprovalTableFooter from "./ApprovalTableFooter";
import ApprovalTabs from "./ApprovalTabs";
import FilterBar from "./FilterBar";
import { useApprovalBoxList } from "./useApprovalBoxList";
import type {
    ApprovalApprover,
    ApprovalRow,
    ApprovalStatus,
    ApprovalType,
} from "./types";

/** Map the row's `typeKey` to the canonical `RequestApprovalKind` the
 *  shared Approval Details dialog uses. Defaults to internal-transfer
 *  when the row carries no type (legacy fallback path). */
const TYPE_KEY_TO_KIND: Record<ApprovalType, RequestApprovalKind> = {
    payroll:           "payroll",
    vendor:            "vendor-payment",
    expense:           "expense-payment",
    corporate_card:    "card",
    overseas:          "overseas-payment",
    internal_transfer: "internal-transfer",
};

function rowKind(row: ApprovalRow): RequestApprovalKind {
    return row.typeKey ? TYPE_KEY_TO_KIND[row.typeKey] : "internal-transfer";
}

/** Drop "draft" onto the narrower batch outcome vocab. */
function statusToOutcome(status: ApprovalStatus): ApprovalOutcome {
    switch (status) {
        case "approved":    return "approved";
        case "rejected":    return "rejected";
        case "in_progress": return "in_progress";
        default:            return "pending";
    }
}
// Deploy v2
/** Project the row's `approvers[]` onto the dialog's `ApprovalDetailsApprover[]`
 *  shape. Pass the legacy `APPRVR_STTS` code through verbatim — the dialog
 *  understands both the narrow ApprovalOutcome and the wider ApproverStatusCode
 *  vocabulary. */
function toDialogApprovers(approvers: ApprovalApprover[]): ApprovalDetailsApprover[] {
    return approvers.map((a) => ({
        seq:     a.lineNo,
        name:    a.userName,
        outcome: a.status,
        actedAt: a.actedAt ?? undefined,
    }));
}

/** Maps the View Setting `FIELD_ID` seeded in V84 to the i18n header
 *  key the page already uses for the table column. Used by the popover
 *  so the row label reads "Date" / "Type" / … instead of the raw DB
 *  identifier. */
const FIELD_ID_TO_LABEL_KEY: Record<string, string> = {
    REG_DTM: "approval.col.date",
    DOC_NM: "approval.col.type",
    DOC_NO: "approval.col.document_no",
    TITL: "approval.col.title",
    TOT_PAY_AMT: "approval.col.amount",
    PAY_END_YN: "approval.col.status",
    PAY_DATE: "approval.col.scheduled",
    DRAFT_USER_NM: "approval.col.requestor",
    APPRER_NM: "approval.col.approver",
    CURRENCY: "approval.col.currency",
};

/**
 * Excel export config — one entry per FIELD_ID the backend
 * `ApprovalBoxExportProvider` knows how to project. CHECKBOX / ETC
 * are admin-only and filtered by the shared hook regardless.
 * `widthChars` follows the CLAUDE.md §13b guidance:
 *   text (short)            → 16–20
 *   text (composite)        → 32–40
 *   amount (VND-scale)      → 22
 *   datetime / scheduled    → 22
 */
const APPROVAL_BOX_EXPORT_COLUMNS: Record<string, ExcelExportColumnConfig> = {
    REG_DTM:       { headerKey: "approval.col.date",        widthChars: 22 },
    DOC_NM:        { headerKey: "approval.col.type",        widthChars: 20 },
    DOC_NO:        { headerKey: "approval.col.document_no", widthChars: 24 },
    TITL:          { headerKey: "approval.col.title",       widthChars: 40 },
    CURRENCY:      { headerKey: "approval.col.currency",    widthChars: 10 },
    TOT_PAY_AMT:   { headerKey: "approval.col.amount",      widthChars: 22, format: "amount", align: "right" },
    PAY_END_YN:    { headerKey: "approval.col.status",      widthChars: 18 },
    PAY_DATE:      { headerKey: "approval.col.scheduled",   widthChars: 14 },
    DRAFT_USER_NM: { headerKey: "approval.col.requestor",   widthChars: 22 },
    APPRER_NM:     { headerKey: "approval.col.approver",    widthChars: 22 },
};

export default function ApprovalBoxPage() {
    const { t } = useTranslation();
    const sysDialog = useDialog();
    const list = useApprovalBoxList();
    const viewSetting = useViewSetting(SCREEN_IDS.PAYMENT_APPROVAL_BOX);

    /** Row whose Document No. cell was clicked — opens the read-only
     *  Approval Details dialog. Null when closed. */
    const [detailsRow, setDetailsRow] = useState<ApprovalRow | null>(null);
    /** Per-line transactions fetched for the open Approval Details
     *  dialog. Loaded lazily when {@link detailsRow} flips to a row;
     *  cleared on close. The page reuses each module's existing detail
     *  endpoint (legacy mirror: `comm_0195_001.act` per-row fetch). */
    const [detailsTxns, setDetailsTxns] = useState<RequestApprovalTransaction[]>([]);

    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[]>([]);

    const data = list.data;
    const rows = useMemo(() => data?.rows ?? [], [data]);
    const tabCounts = data?.tabCounts ?? {
        all: 0,
        draft: 0,
        pending: 0,
        in_progress: 0,
        approved: 0,
        rejected: 0,
    };
    const totalCount = data?.totalCount ?? 0;
    const totalPages = data?.totalPages ?? 0;

    const displayRows = useMemo<ApprovalRow[]>(
        () =>
            rows.map((r) => ({
                ...r,
                type: r.typeKey ? t(`approval.type.${r.typeKey}`) : r.documentNo,
            })),
        [rows, t],
    );

    const currencyTotals = useMemo(
        () => approvalBoxCurrencyTotal(displayRows),
        [displayRows],
    );

    const openDocumentDetails = useCallback((row: ApprovalRow) => {
        setDetailsRow(row);
        setDetailsTxns([]);
    }, []);
    const closeDocumentDetails = useCallback(() => {
        setDetailsRow(null);
        setDetailsTxns([]);
    }, []);

    /** Approve the currently-open Approval Details row. Calls
     *  POST /api/v1/payment/approval-box/{apprSeqNo}/approve, refreshes
     *  the list, and closes the dialog. Errors surface via the shared
     *  system dialog so the user sees the WBE code. */
    const handleApprove = useCallback(async () => {
        if (!detailsRow) return;
        try {
            await approveApprovalBoxRow(detailsRow.apprSeqNo);
            sysDialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("approval.action.approve_success"),
            });
            closeDocumentDetails();
            void list.refetch();
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : t("approval.action.approve_failed");
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        }
    }, [detailsRow, sysDialog, t, closeDocumentDetails, list]);

    /** Reject the currently-open Approval Details row. Same wiring as
     *  {@link handleApprove}. Per the backend contract the rejection
     *  also cascades downstream waiting peers to STOPPED — no extra
     *  client-side handling needed. */
    const handleReject = useCallback(async () => {
        if (!detailsRow) return;
        try {
            await rejectApprovalBoxRow(detailsRow.apprSeqNo);
            sysDialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("approval.action.reject_success"),
            });
            closeDocumentDetails();
            void list.refetch();
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : t("approval.action.reject_failed");
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        }
    }, [detailsRow, sysDialog, t, closeDocumentDetails, list]);

    // Fetch per-line transactions when the user opens the dialog. Each
    // Payment module already exposes a `/detail/{id}` endpoint that
    // returns the same `TransferLineDetail[]`-shaped rows — we dispatch
    // to the right client based on the row's `typeKey`. Cancellation is
    // handled by the standard "ignore if state moved on" pattern so a
    // rapid open-close-open sequence doesn't leak a stale set.
    useEffect(() => {
        if (!detailsRow || !detailsRow.documentNo) return;
        const targetId = detailsRow.documentNo;
        let cancelled = false;

        const loader = pickDetailLoader(detailsRow.typeKey);
        if (!loader) {
            // Overseas / card detail loaders not wired yet — leave the
            // dialog with an empty transactions list ("No transactions
            // to display") rather than throwing.
            return;
        }

        loader(targetId)
            .then((rows) => {
                if (cancelled) return;
                setDetailsTxns(rows.map(toApprovalTxn));
            })
            .catch((err) => {
                if (cancelled) return;
                const code = err instanceof ApiCallError ? err.code : "WBE9999";
                const message = err instanceof ApiCallError ? err.message : "Failed to load transactions";
                sysDialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: message,
                    errorCode: code,
                });
            });

        return () => {
            cancelled = true;
        };
    }, [detailsRow, sysDialog, t]);

    const listError = list.error;
    useEffect(() => {
        if (!listError) return;
        sysDialog.open({
            type: "error",
            title: t("dialog.error"),
            description: listError.message,
            errorCode: listError.code,
            uuid: listError.traceId,
        });
    }, [listError, sysDialog, t]);

    const openViewSetting = useCallback(
        (anchor: DOMRect) => {
            setVsDraft(viewSetting.items as ViewSettingItem[]);
            setVsAnchor(anchor);
        },
        [viewSetting.items],
    );
    const closeViewSetting = useCallback(() => setVsAnchor(null), []);

    /** Mirrors the legacy `resl_0001_001_osmc.ts setUpDataForPrintImpl`
     *  flow — print the page's current filtered rows (NOT just the page
     *  slice) via the shared `printReport` helper. Columns reflect the
     *  on-screen 10-column set (no checkbox, no row-action cell —
     *  CLAUDE.md §6d "Columns must match the on-screen table"). */
    const handlePrint = useCallback(() => {
        const summary = t("approval.pagination_label", {
            shown: displayRows.length,
            total: totalCount,
        });
        printReport({
            title: t("approval.title"),
            summary,
            columns: [
                { header: t("approval.col.date"), render: (r) => escapeHtml(r.date) },
                { header: t("approval.col.type"), render: (r) => escapeHtml(r.type ?? r.documentNo) },
                { header: t("approval.col.document_no"), render: (r) => escapeHtml(r.documentNo) },
                { header: t("approval.col.title"), render: (r) => escapeHtml(r.title) },
                { header: t("approval.col.currency"), render: (r) => escapeHtml(r.currency) },
                { header: t("approval.col.amount"), align: "right", render: (r) => escapeHtml(r.amount) },
                { header: t("approval.col.status"), render: (r) => escapeHtml(t(`approval.tab.${r.status}`)) },
                { header: t("approval.col.scheduled"), render: (r) => escapeHtml(r.scheduledDate ?? t("approval.scheduled_empty")) },
                { header: t("approval.col.requestor"), render: (r) => escapeHtml(r.requestor) },
                {
                    header: t("approval.col.approver"),
                    render: (r) => {
                        const name = escapeHtml(r.approver);
                        if (r.approverCount == null) return name;
                        return `${name} <span class="muted small">(${r.approverCount})</span>`;
                    },
                },
            ],
            rows: displayRows,
        });
    }, [displayRows, totalCount, t]);

    /** Excel export — routes through the shared `useExcelExport` hook
     *  + the backend's `POST /api/v1/payment/approval-box/export`
     *  endpoint. Column visibility / order honours the user's live
     *  View Setting; filter + sort context travel with the request
     *  (CLAUDE.md §13b "Excel export"). */
    const exportXlsx = useExcelExport();
    const handleExportExcel = useCallback(async () => {
        try {
            await exportXlsx({
                endpoint:     "/api/v1/payment/approval-box/export",
                screenId:     SCREEN_IDS.PAYMENT_APPROVAL_BOX,
                dymAreaId:    DEFAULT_AREA_ID,
                fileName:     t("approval.export_filename"),
                title:        t("approval.title"),
                items:        viewSetting.items,
                columnConfig: APPROVAL_BOX_EXPORT_COLUMNS,
                t,
                filters: {
                    fromDate:  list.fromDateIso.replace(/-/g, ""),
                    toDate:    list.toDateIso.replace(/-/g, ""),
                    apprType:  list.tab,
                    keyword:   list.search.trim(),
                },
                sort: list.sortField && list.sortDirection
                    ? { field: list.sortField, direction: list.sortDirection }
                    : null,
            });
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const message = err instanceof ApiCallError
                ? err.message
                : t("approval.export_failed");
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        }
    }, [
        exportXlsx,
        viewSetting.items,
        list.fromDateIso,
        list.toDateIso,
        list.tab,
        list.search,
        list.sortField,
        list.sortDirection,
        sysDialog,
        t,
    ]);

    return (
        <PageLayout>
            <PageHeader title={t("approval.title")}>
                <PageActionButtons
                    showList
                    showPrint
                    showExcel
                    onList={openViewSetting}
                    onPrint={handlePrint}
                    onExport={handleExportExcel}
                />
            </PageHeader>

            <ApprovalTabs
                active={list.tab}
                counts={tabCounts}
                onChange={list.setTab}
            />

            <FilterBar
                period={list.period}
                onPeriodChange={list.setPeriod}
                manualRange={list.manualRange}
                onManualRangeChange={list.setManualRange}
                startDateIso={list.fromDateIso}
                endDateIso={list.toDateIso}
                search={list.search}
                onSearchChange={list.setSearch}
            />

            <DataTableShell
                footerMode="paginationWithTotals"
                table={
                    <ApprovalTable
                        rows={displayRows}
                        onDocumentNoClick={openDocumentDetails}
                    />
                }
                footer={
                    <ApprovalTableFooter
                        documentCount={totalCount}
                        totals={currencyTotals}
                        className="mt-auto"
                    />
                }
                pagination={
                    <Pagination
                        page={list.page + 1}
                        pageCount={Math.max(totalPages, 1)}
                        pageSize={list.pageSize}
                        totalLabel={t("approval.pagination_label", {
                            shown: displayRows.length,
                            total: totalCount,
                        })}
                        className="shrink-0"
                        onPageChange={(p: number) => list.setPage(Math.max(0, p - 1))}
                        onPageSizeChange={(s: number) => list.setPageSize(s)}
                        pageSizeOptions={[15, 20, 50, 100]}
                    />
                }
            />

            {detailsRow && (
                <ApprovalDetailsDialog
                    kind={rowKind(detailsRow)}
                    title={detailsRow.title || detailsRow.fileName}
                    status={statusToOutcome(detailsRow.status)}
                    documentNo={detailsRow.documentNo}
                    scheduledDate={detailsRow.scheduledDate}
                    totalAmount={detailsRow.amount}
                    approvers={toDialogApprovers(detailsRow.approvers)}
                    transactions={detailsTxns}
                    requestedBy={detailsRow.requestor}
                    requestedAt={detailsRow.date}
                    onClose={closeDocumentDetails}
                    onApprove={detailsRow.actionable ? handleApprove : undefined}
                    onReject={detailsRow.actionable ? handleReject : undefined}
                />
            )}

            {vsAnchor && (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={setVsDraft}
                    getLabel={(item) => {
                        const key = FIELD_ID_TO_LABEL_KEY[item.field_id];
                        return key ? t(key) : item.field_nm;
                    }}
                    onSave={async () => {
                        await viewSetting.save(vsDraft);
                        closeViewSetting();
                    }}
                    onReset={async () => {
                        const fresh = await viewSetting.reset();
                        setVsDraft(fresh as ViewSettingItem[]);
                    }}
                    onClose={closeViewSetting}
                />
            )}
        </PageLayout>
    );
}

/** Pick the per-module detail loader matching the row's `typeKey`.
 *  Each module already ships a `/detail/{id}` endpoint returning the
 *  same `{ rows: TransferLineDetail[] }` shape. Returns null for
 *  modules whose detail client isn't wired yet (overseas / card). */
function pickDetailLoader(
    typeKey: ApprovalType | null,
): ((id: string) => Promise<TransferLineDetail[]>) | null {
    switch (typeKey) {
        case "internal_transfer":
            return (id) =>
                fetchScheduledTransferDetail(id)
                    .then(mapScheduledTransferDetail)
                    .then((d) => d.rows);
        case "vendor":
            return (id) =>
                fetchVendorPaymentDetail(id)
                    .then(mapScheduledTransferDetail)
                    .then((d) => d.rows);
        case "expense":
            return (id) =>
                fetchExpensePaymentDetail(id)
                    .then(mapScheduledTransferDetail)
                    .then((d) => d.rows);
        case "payroll":
            return (id) =>
                fetchPayrollPaymentDetail(id)
                    .then(mapScheduledTransferDetail)
                    .then((d) => d.rows);
        case "overseas":
        case "corporate_card":
        default:
            return null;
    }
}

/** Project a `TransferLineDetail` onto the dialog's
 *  `RequestApprovalTransaction` shape. The detail wire does NOT carry
 *  bank names, so the deposit-bank fields fall back to the raw code —
 *  if the backend joins bank names into the detail response later, the
 *  mapper picks them up without further frontend changes. */
function toApprovalTxn(line: TransferLineDetail): RequestApprovalTransaction {
    return {
        id:               line.scdulPymnDetlNo,
        depositBankCode:  line.tarBankCd ?? "",
        depositBankName:  line.tarBankCd ?? "",
        depositBankCcyCd: line.ccyCd ?? "",
        depositAccountNo: line.fincMdaNo ?? "",
        transferAmount:   line.tranAmt ?? "",
        recipientName:    line.rcptNm ?? undefined,
        remarks:          line.tranUsag ?? undefined,
        description:      line.note ?? undefined,
        documentNo:       line.docNo ?? undefined,
        reportingAccount: line.chartAcctCd ?? undefined,
    };
}
