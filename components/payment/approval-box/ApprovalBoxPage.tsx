"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination, { PAGE_SIZE_OPTIONS } from "@/components/shared/Pagination";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    isSpecialViewSettingField,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import {
    approveApprovalBoxRow,
    changeApprovalBoxApprovalLine,
    rejectApprovalBoxRow,
    withdrawApprovalBoxRow,
} from "@/lib/api/approval-box";
import { ApiCallError } from "@/lib/api/banking";
import {
    changeCardApprovalLine,
    fetchCardTransactionsByApproval,
    withdrawCardApproval,
} from "@/lib/api/cardTransactions";
import { fetchExpensePaymentDetail } from "@/lib/api/expensePayment";
import { fetchScheduledTransferDetail } from "@/lib/api/internalTransfer";
import {
    approvalBoxCurrencyTotal,
    mapScheduledTransferDetail,
    type TransferLineDetail,
} from "@/lib/api/mappers";
import { fetchPayrollPaymentDetail } from "@/lib/api/payrollPayment";
import { fetchOverseasPaymentDetail, type ApiOverseasPaymentExcelDetailRow } from "@/lib/api/payment";
import { fetchVendorPaymentDetail } from "@/lib/api/vendorPayment";
import { useTranslation } from "@/lib/i18n";
import { escapeHtml, printReport } from "@/lib/print";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";
import { useExcelExport, type ExcelExportColumnConfig } from "@/hooks/useExcelExport";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import type { MappedApprovalBoxList } from "@/lib/api/mappers";

import ApprovalDetailsDialog, {
    type ApprovalDetailsApprover,
    type ApprovalOutcome,
} from "@/components/payment/shared/ApprovalDetailsDialog";
import type {
    RequestApprovalKind,
    RequestApprovalTransaction,
} from "@/components/payment/shared/RequestApprovalDialog";
import EditApprovalLinePicker, {
    type EditApprovalLinePreview,
} from "@/components/payment/corporate-card/EditApprovalLinePicker";
import { formatAmount, formatNumber } from "@/lib/currency";

import ApprovalTable, { APPROVAL_COLUMN_REGISTRY } from "./ApprovalTable";
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
        id:      a.userId,
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
    FILE_NM: "approval.col.file_name",
    CURRENCY: "approval.col.currency",
    TOT_PAY_AMT: "approval.col.amount",
    PAY_END_YN: "approval.col.status",
    PAY_DATE: "approval.col.scheduled",
    DRAFT_USER_NM: "approval.col.requestor",
    APPRER_NM: "approval.col.approver",
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
/**
 * Default column layout used until `useViewSetting` resolves the user's
 * persisted preferences. Mirrors the legacy `resl_0001_001` OSMC seed
 * (queried verbatim from JEX DEV `SYS_SCR_OPTION_WECMS` on 2026-05-27)
 * + the refactor's V207 reseed of `SYS_SCR_OPTION_WECMS` for
 * `approval-box`. Once the hook resolves, `vs.items` takes over.
 *
 * 11 columns in legacy order: Date · Type · Document No. · Title · File
 * Name · Currency · Transfer Amount · Approval Status · Scheduled Date ·
 * Requestor · Approver.
 */
const APPROVAL_FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "REG_DTM",       field_nm: "Date",              disp_ord: 1,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "90px"  },
    { field_id: "DOC_NM",        field_nm: "Type",              disp_ord: 2,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "170px" },
    { field_id: "DOC_NO",        field_nm: "Document No.",      disp_ord: 3,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "135px" },
    { field_id: "TITL",          field_nm: "Title",             disp_ord: 4,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "220px" },
    { field_id: "FILE_NM",       field_nm: "File Name",         disp_ord: 5,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "260px" },
    { field_id: "CURRENCY",      field_nm: "Transfer Currency", disp_ord: 6,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "150px" },
    { field_id: "TOT_PAY_AMT",   field_nm: "Transfer Amount",   disp_ord: 7,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "150px" },
    { field_id: "PAY_END_YN",    field_nm: "Approval Status",   disp_ord: 8,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "160px" },
    { field_id: "PAY_DATE",      field_nm: "Scheduled Date",    disp_ord: 9,  use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "145px" },
    { field_id: "DRAFT_USER_NM", field_nm: "Requestor",         disp_ord: 10, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "180px" },
    { field_id: "APPRER_NM",     field_nm: "Approver",          disp_ord: 11, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "180px" },
];

/**
 * Excel export column set — matches the legacy `resl_0001_001_osmc`
 * `makeGrid_excel` (lines 1180-1202). 10 columns in legacy order;
 * Approver is intentionally excluded from the workbook (the multi-line
 * "name + count + chevron" cell does not flatten to a meaningful
 * spreadsheet column — legacy hardcodes the same exclusion at line
 * 1186-1188). The backend's `ALLOWED_FIELD_IDS` mirror this list.
 */
const APPROVAL_BOX_EXPORT_COLUMNS: Record<string, ExcelExportColumnConfig> = {
    REG_DTM:       { headerKey: "approval.col.date",        widthChars: 22 },
    DOC_NM:        { headerKey: "approval.col.type",        widthChars: 20 },
    DOC_NO:        { headerKey: "approval.col.document_no", widthChars: 24 },
    TITL:          { headerKey: "approval.col.title",       widthChars: 40 },
    FILE_NM:       { headerKey: "approval.col.file_name",   widthChars: 40 },
    CURRENCY:      { headerKey: "approval.col.currency",    widthChars: 10 },
    TOT_PAY_AMT:   { headerKey: "approval.col.amount",      widthChars: 22, format: "amount", align: "right" },
    PAY_END_YN:    { headerKey: "approval.col.status",      widthChars: 18 },
    PAY_DATE:      { headerKey: "approval.col.scheduled",   widthChars: 14 },
    DRAFT_USER_NM: { headerKey: "approval.col.requestor",   widthChars: 22 },
};

export default function ApprovalBoxPage() {
    const { t } = useTranslation();
    const sysDialog = useDialog();
    const list = useApprovalBoxList();
    const viewSetting = useViewSetting(SCREEN_IDS.PAYMENT_APPROVAL_BOX);

    /* Shared table-sort cycle (default → ASC → DESC → default) per
     * CLAUDE.md §13a. The hook owns the cycle state; sync into the
     * list hook so the API request gets `sortField` / `sortDirection`
     * and the backend ORDER BY follows. Mirrors the Account Inquiry
     * pattern (`AccountInquiryClient` → `AccountService.list`). */
    const sort = useTableSort();
    const { setSort: setListSort } = list;
    useEffect(() => {
        setListSort(sort.sortField, sort.sortDirection);
    }, [sort.sortField, sort.sortDirection, setListSort]);

    /** Row whose Document No. cell was clicked — opens the read-only
     *  Approval Details dialog. Null when closed. */
    const [detailsRow, setDetailsRow] = useState<ApprovalRow | null>(null);
    /** Per-line transactions fetched for the open Approval Details
     *  dialog. Loaded lazily when {@link detailsRow} flips to a row;
     *  cleared on close. The page reuses each module's existing detail
     *  endpoint (legacy mirror: `comm_0195_001.act` per-row fetch). */
    const [detailsTxns, setDetailsTxns] = useState<RequestApprovalTransaction[]>([]);
    /** Withdrawal Bank / Account / Currency for the open Approval Details
     *  dialog — populated only for Internal Transfer rows (reused from the
     *  detail response; legacy `comm_0195_001` parity). Null for the other
     *  kinds and when the dialog is closed. */
    const [detailsWithdrawal, setDetailsWithdrawal] = useState<ApprovalDetailWithdrawal | null>(null);

    /* Deep-link (notification click → `?appr_seq_no=…`). `deepLinkApprSeqNo`
     * is captured once from the URL on mount; `highlightApprSeqNo` tints the
     * matched row; `deepLinkHandledRef` guarantees the auto-open fires exactly
     * once even though the list effect re-runs on every filter / refetch. */
    const [deepLinkApprSeqNo, setDeepLinkApprSeqNo] = useState<string | null>(null);
    const [highlightApprSeqNo, setHighlightApprSeqNo] = useState<string | null>(null);
    const deepLinkHandledRef = useRef(false);

    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[]>([]);

    /** Approval Details edit-mode state — mirrors the Card Transactions
     *  `ApprovalRefDetailDialog` pattern. Flipping `editMode` swaps the
     *  approver chip list for the inline `<EditApprovalLinePicker>`;
     *  Save commits the picked line via the per-kind change-line endpoint;
     *  Cancel discards the draft and returns to the read-only view. */
    const [editMode, setEditMode] = useState(false);
    const [pickedLine, setPickedLine] = useState<EditApprovalLinePreview | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);

    /* Stable-data latch — preserves the previous response across
     * refetches (tab switch, search debounce, pagination, mutation
     * refetch) so the table doesn't flash empty between requests.
     * Mirrors the Account Inquiry / Operation Status pattern. */
    const [stableData, setStableData] = useState<MappedApprovalBoxList | null>(list.data);
    const [prevData, setPrevData] = useState<MappedApprovalBoxList | null>(list.data);
    if (list.data !== prevData) {
        setPrevData(list.data);
        if (list.data) setStableData(list.data);
    }

    const data = stableData;
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

    /* Sticky-wrapped initial-loading gate — true only while the very
     * first fetch is in flight (no response latched yet). Keeps the
     * "Loading…" centered message visible ≥ 400 ms even when the API
     * responds in <50 ms so the user notices something happened
     * before rows pop in. Subsequent refetches keep the previous rows
     * visible via {@link stableData} and never trip this gate. */
    const stickyInitialLoading = useStickyLoading(list.loading && !stableData);

    /* Mutation-in-flight gate — wraps every approve / reject / withdraw /
     * edit-save flow so action buttons stay visibly disabled across the
     * minimum-visibility window even on a snappy network round-trip.
     * The functional duplicate-click guard still lives inside each
     * handler. */
    const [actionInFlight, setActionInFlight] = useState(false);
    const stickyActionInFlight = useStickyLoading(actionInFlight || savingEdit);

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

    /**
     * Resolve the live View Setting items into the columns the table
     * should actually render — filtered to USE_YN === "Y", dropping
     * special (CHECKBOX / ETC) + admin-hidden (DISP_YN === "N") rows,
     * dropping columns the registry doesn't know how to render, then
     * sorted by DISP_ORD. Falls back to {@link APPROVAL_FALLBACK_COLUMNS}
     * until the API resolves so the table doesn't flash empty.
     */
    /**
     * Detect the "V207 not yet applied" state — backend still returns
     * the V109 seed (no FILE_NM, CURRENCY at disp_ord=10). When that's
     * the case fall back to the canonical legacy order from
     * {@link APPROVAL_FALLBACK_COLUMNS} so the table + popover render
     * Transfer Currency before Transfer Amount + show File Name
     * regardless of whether the backend's reseed migration has run on
     * the dev's local DB. Once V207 lands, backend items take over.
     */
    const orderedItems = useMemo<ViewSettingItem[]>(() => {
        const backendHasNewOrder =
            viewSetting.items.length > 0 &&
            viewSetting.items.some((it) => it.field_id === "FILE_NM");
        return backendHasNewOrder ? viewSetting.items : APPROVAL_FALLBACK_COLUMNS;
    }, [viewSetting.items]);

    const visibleColumns = useMemo<ViewSettingItem[]>(() => {
        return orderedItems
            .filter(
                (it) =>
                    !isSpecialViewSettingField(it.field_id) &&
                    it.disp_yn !== "N" &&
                    it.use_yn === "Y" &&
                    APPROVAL_COLUMN_REGISTRY[it.field_id] !== undefined,
            )
            .slice()
            .sort((a, b) => a.disp_ord - b.disp_ord);
    }, [orderedItems]);

    const openDocumentDetails = useCallback((row: ApprovalRow) => {
        setDetailsRow(row);
        setDetailsTxns([]);
        setDetailsWithdrawal(null);
        setEditMode(false);
        setPickedLine(null);
    }, []);
    const closeDocumentDetails = useCallback(() => {
        setDetailsRow(null);
        setDetailsTxns([]);
        setDetailsWithdrawal(null);
        setEditMode(false);
        setPickedLine(null);
        setSavingEdit(false);
    }, []);

    /* Capture the deep-link target once from the URL on mount. Read via
     * window.location (not useSearchParams) so the page stays prerenderable
     * without a Suspense boundary; the value is client-only anyway. */
    useEffect(() => {
        if (typeof window === "undefined") return;
        const raw = new URLSearchParams(window.location.search).get("appr_seq_no");
        const trimmed = raw?.trim();
        if (trimmed) setDeepLinkApprSeqNo(trimmed);
    }, []);

    /* Resolve the deep-link after the list has loaded: locate the matching
     * row, highlight it, and open the read-only Approval Details dialog.
     * Runs exactly once (deepLinkHandledRef) so closing the dialog or
     * changing a filter never re-opens it. A target outside the current
     * list (wrong tab / page / date window, or already gone) surfaces a
     * single non-blocking warning rather than failing silently. */
    useEffect(() => {
        if (deepLinkHandledRef.current || !deepLinkApprSeqNo) return;
        // Wait for the first fetch to settle. On error, leave it unhandled
        // so a later successful refetch can still resolve the deep link.
        if (list.loading) return;
        if (list.error) return;
        deepLinkHandledRef.current = true;
        const match = rows.find((r) => r.apprSeqNo === deepLinkApprSeqNo);
        if (match) {
            setHighlightApprSeqNo(deepLinkApprSeqNo);
            openDocumentDetails(match);
        } else {
            sysDialog.open({
                type: "warning",
                title: t("dialog.warning"),
                description: t("approval.deeplink.not_found"),
            });
        }
    }, [
        deepLinkApprSeqNo,
        list.loading,
        list.error,
        rows,
        openDocumentDetails,
        sysDialog,
        t,
    ]);

    /** Approve the currently-open Approval Details row. Calls
     *  POST /api/v1/payment/approval-box/{apprSeqNo}/approve, refreshes
     *  the list, and closes the dialog. Errors surface via the shared
     *  system dialog so the user sees the WBE code. */
    const handleApprove = useCallback(async () => {
        if (!detailsRow || actionInFlight) return;
        setActionInFlight(true);
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
        } finally {
            setActionInFlight(false);
        }
    }, [detailsRow, actionInFlight, sysDialog, t, closeDocumentDetails, list]);

    /** Confirmed Delete handler — fires the per-kind withdraw endpoint
     *  and refreshes the list. Mirrors the Card Transactions
     *  `ApprovalRefDetailDialog` flow. */
    const handleWithdrawConfirmed = useCallback(async () => {
        if (!detailsRow || actionInFlight) return;
        // Per-kind dispatch — card has a dedicated endpoint
        // (`/api/v1/payment/card-transactions/by-approval/{seq}`) that
        // also unstamps CARD_TRNS_HSTR. Every other payment type routes
        // to the generic Approval Box withdraw
        // (`DELETE /api/v1/payment/approval-box/{seq}/withdraw`), which
        // clears the SCDUL/OVRS source stamp. Both delete the approval
        // master + approver chain and surface WBE codes via ApiCallError.
        setActionInFlight(true);
        try {
            if (detailsRow.typeKey === "corporate_card") {
                await withdrawCardApproval(detailsRow.apprSeqNo);
            } else {
                await withdrawApprovalBoxRow(detailsRow.apprSeqNo);
            }
            sysDialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("approval.action.delete_success"),
            });
            closeDocumentDetails();
            void list.refetch();
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : t("approval.action.delete_failed");
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        } finally {
            setActionInFlight(false);
        }
    }, [detailsRow, actionInFlight, sysDialog, t, closeDocumentDetails, list]);

    /** Kebab menu handler — Edit / Delete (Withdraw) / Re-submit. Mirrors
     *  the Card Transactions `ApprovalRefDetailDialog` pattern:
     *  - Edit flips the dialog into edit-mode and swaps the approver
     *    chip list for an inline `<EditApprovalLinePicker>`.
     *  - Delete opens a confirmation dialog; on confirm, fires the
     *    per-kind withdraw endpoint via {@link handleWithdrawConfirmed}.
     *  - Re-submit (for rejected rows) is a placeholder until the
     *    backend resubmit endpoint lands. */
    const handleMenuAction = useCallback(
        (action: "edit" | "withdraw" | "resubmit") => {
            if (action === "edit") {
                setPickedLine(null);
                setEditMode(true);
                return;
            }
            if (action === "withdraw") {
                sysDialog.open({
                    type:        "confirmation",
                    title:       t("dialog.confirmation"),
                    description: t("approval.action.confirm_delete"),
                    confirmText: t("dialog.continue"),
                    cancelText:  t("dialog.cancel"),
                    onConfirm:   handleWithdrawConfirmed,
                });
                return;
            }
            // action === "resubmit"
            sysDialog.open({
                type:        "warning",
                title:       t("dialog.warning"),
                description: t("approval.action.resubmit_not_implemented"),
            });
        },
        [sysDialog, t, handleWithdrawConfirmed],
    );

    /** Edit-mode Save — commits the picked approval line via the
     *  per-kind change-line endpoint. */
    const handleEditSave = useCallback(async () => {
        if (!detailsRow || !pickedLine) return;
        // Per-kind dispatch — card uses its dedicated change-approval-line
        // endpoint; every other payment type routes to the generic
        // Approval Box endpoint
        // (`PUT /api/v1/payment/approval-box/{seq}/approval-line`). Both
        // replace the approver chain and reset the master to Pending.
        setSavingEdit(true);
        try {
            if (detailsRow.typeKey === "corporate_card") {
                await changeCardApprovalLine(detailsRow.apprSeqNo, pickedLine.apprLineNo);
            } else {
                await changeApprovalBoxApprovalLine(detailsRow.apprSeqNo, pickedLine.apprLineNo);
            }
            sysDialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("approval.action.edit_success"),
            });
            closeDocumentDetails();
            void list.refetch();
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : t("approval.action.edit_failed");
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        } finally {
            setSavingEdit(false);
        }
    }, [detailsRow, pickedLine, sysDialog, t, closeDocumentDetails, list]);

    /** Edit-mode Cancel — discards the picker state and returns to read-only. */
    const handleEditCancel = useCallback(() => {
        setEditMode(false);
        setPickedLine(null);
    }, []);

    /** Reject the currently-open Approval Details row. Same wiring as
     *  {@link handleApprove}. Per the backend contract the rejection
     *  also cascades downstream waiting peers to STOPPED — no extra
     *  client-side handling needed. */
    const handleReject = useCallback(async () => {
        if (!detailsRow || actionInFlight) return;
        setActionInFlight(true);
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
        } finally {
            setActionInFlight(false);
        }
    }, [detailsRow, actionInFlight, sysDialog, t, closeDocumentDetails, list]);

    // Fetch per-line transactions when the user opens the dialog. Each
    // Payment module already exposes a `/detail/{id}` endpoint that
    // returns the same `TransferLineDetail[]`-shaped rows — we dispatch
    // to the right client based on the row's `typeKey`. Cancellation is
    // handled by the standard "ignore if state moved on" pattern so a
    // rapid open-close-open sequence doesn't leak a stale set.
    useEffect(() => {
        if (!detailsRow) return;
        // Card rows look themselves up by APPR_SEQ_NO (no batch
        // documentNo equivalent — card transactions don't have a
        // SCDUL parent). All other modules look up by documentNo.
        const targetId = detailsRow.typeKey === "corporate_card"
            ? detailsRow.apprSeqNo
            : detailsRow.documentNo;
        if (!targetId) return;
        let cancelled = false;

        const loader = pickDetailLoader(detailsRow.typeKey);
        if (!loader) {
            // Overseas detail loader not wired yet — leave the
            // dialog with an empty transactions list ("No transactions
            // to display") rather than throwing.
            return;
        }

        loader(targetId)
            .then((result) => {
                if (cancelled) return;
                setDetailsTxns(result.rows);
                setDetailsWithdrawal(result.withdrawalAccount ?? null);
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
            // Use the same canonical-vs-backend resolution as the table —
            // if the backend hasn't shipped the V207 reseed yet, seed the
            // popover from APPROVAL_FALLBACK_COLUMNS so the row order
            // matches what the user sees in the table (Transfer Currency
            // before Transfer Amount, File Name in position 5).
            setVsDraft(orderedItems as ViewSettingItem[]);
            setVsAnchor(anchor);
        },
        [orderedItems],
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
                { header: t("approval.col.file_name"), render: (r) => escapeHtml(r.fileName) },
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
                // Use `orderedItems` (same source the table + popover read
                // from) so the Excel column order stays canonical
                // regardless of whether V207's reseed has applied to the
                // local backend. Without this, the export would inherit
                // the V109 column order whenever the api hasn't been
                // restarted yet.
                items:        orderedItems,
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
        orderedItems,
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
                footerMode="paginationWithStickyFooter"
                table={
                    <>
                        <ApprovalTable
                            rows={displayRows}
                            items={visibleColumns}
                            onDocumentNoClick={openDocumentDetails}
                            sortField={sort.sortField}
                            sortDirection={sort.sortDirection}
                            onSort={sort.toggleSort}
                            highlightApprSeqNo={highlightApprSeqNo}
                        />
                        {/* Page-specific empty-state — rendered below
                           the header when the current page has no rows.
                           Same `text-wb-13 font-medium text-wb-ntrl-6`
                           token chain as the Account Inquiry baseline.
                           While the initial fetch is in flight (sticky-
                           wrapped, ≥ 400 ms minimum visibility) the
                           message reads `t("common.loading")` so a fast
                           cached response doesn't flash empty → loading
                           → table on first paint. Subsequent refetches
                           keep the previous rows visible via the
                           stable-data latch and never trip this gate. */}
                        {displayRows.length === 0 && (
                            <div className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6">
                                {stickyInitialLoading
                                    ? t("common.loading")
                                    : t("approval.empty")}
                            </div>
                        )}
                    </>
                }
                footer={
                    <ApprovalTableFooter
                        documentCount={totalCount}
                        totals={currencyTotals}
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
                        pageSizeOptions={PAGE_SIZE_OPTIONS}
                    />
                }
            />

            {detailsRow && (() => {
                const detailStatus = statusToOutcome(detailsRow.status);
                // Kebab visibility mirrors the Card Transactions
                // `ApprovalRefDetailDialog` rule — only show Edit/Delete
                // while the request is still mutable (pending or
                // in-progress). Approved / rejected rows are read-only.
                const isMutable =
                    detailStatus === "pending" || detailStatus === "in_progress";
                // Edit picker — same inline UX as the Card Transactions
                // detail popup. The dropdown lives inside the dialog;
                // there is no stacked picker modal.
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
                        kind={rowKind(detailsRow)}
                        title={detailsRow.title || detailsRow.fileName}
                        status={detailStatus}
                        documentNo={detailsRow.documentNo}
                        content={detailsRow.cont ?? ""}
                        scheduledDate={detailsRow.scheduledDate}
                        totalAmount={formatAmount(detailsRow.amount, detailsRow.currency, true)}
                        withdrawalAccount={detailsWithdrawal ?? undefined}
                        approvers={toDialogApprovers(detailsRow.approvers)}
                        transactions={detailsTxns}
                        requestedBy={detailsRow.requestor}
                        requestedAt={detailsRow.date}
                        onClose={closeDocumentDetails}
                        onApprove={detailsRow.actionable && !editMode && !stickyActionInFlight ? handleApprove : undefined}
                        onReject={detailsRow.actionable && !editMode && !stickyActionInFlight ? handleReject : undefined}
                        onMenuAction={isMutable && !editMode && !stickyActionInFlight ? handleMenuAction : undefined}
                        editMode={editMode}
                        editApproverSlot={editApproverSlot}
                        onEditSave={handleEditSave}
                        onEditCancel={handleEditCancel}
                        editSaveDisabled={pickedLine == null || stickyActionInFlight}
                    />
                );
            })()}

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

/** Withdrawal Bank / Account / Currency for the Approval Details popup —
 *  matches `ApprovalDetailsDialog`'s `withdrawalAccount` prop shape.
 *  Populated for every non-card kind (reused from each kind's detail
 *  response); the dialog renders the "Withdrawal Bank/Account No." row. */
type ApprovalDetailWithdrawal = {
    bankCd?: string;
    bankNm:  string;
    acctNo:  string;
    ccyCd:   string;
};

/** Build the withdrawal account from a shared scheduled-transfer detail
 *  (camelCase mapper output) — used by the IT / Vendor / Expense / Payroll
 *  loader branches, which all route through `mapScheduledTransferDetail`. */
function scheduledWithdrawal(
    d: ReturnType<typeof mapScheduledTransferDetail>,
): ApprovalDetailWithdrawal {
    return {
        bankCd: d.outBankCd || undefined,
        bankNm: d.outBankNm ?? d.outBankCd,
        acctNo: d.wdrlActNo,
        ccyCd:  d.wdrlCcyCd ?? d.ccyCd,
    };
}

/** What a per-module detail loader resolves to: the projected transaction
 *  rows plus an optional withdrawal account (Internal Transfer only). */
type ApprovalDetailLoad = {
    rows: RequestApprovalTransaction[];
    withdrawalAccount?: ApprovalDetailWithdrawal;
};

/** Pick the per-module detail loader matching the row's `typeKey`.
 *  Each loader returns an {@link ApprovalDetailLoad} (rows + optional
 *  withdrawal account) — the module-specific projection happens inside the
 *  loader, so the Approval Box useEffect stays uniform across kinds.
 *
 *  Card transactions use a different parent identifier (`apprSeqNo`
 *  instead of `scdulPymnNo`) — the caller passes `apprSeqNo` for the
 *  card case (resolved upstream from {@code detailsRow.apprSeqNo}). */
function pickDetailLoader(
    typeKey: ApprovalType | null,
): ((id: string) => Promise<ApprovalDetailLoad>) | null {
    switch (typeKey) {
        case "internal_transfer":
            // Internal Transfer uses the enriched mapper so the Approval
            // Box popup renders the same resolved bank name / formatted
            // amount / "code - seq" reporting account + breadcrumb as the
            // Internal Transfer Scheduled Payment popup. Vendor / Expense /
            // Payroll stay on the lean mapper below (deferred — out of the
            // current Internal-Transfer-only scope).
            return (id) =>
                fetchScheduledTransferDetail(id)
                    .then(mapScheduledTransferDetail)
                    .then((d) => ({
                        rows: d.rows.map(toApprovalTxnFromTransferLineRich),
                        // Withdrawal Bank / Account / Currency — reused from
                        // the same detail response (no new API field). Mirrors
                        // the Scheduled Payment popup and restores legacy
                        // `comm_0195_001` parity (the `.bank_delt` row at ts:878).
                        withdrawalAccount: scheduledWithdrawal(d),
                    }));
        case "vendor":
            return (id) =>
                fetchVendorPaymentDetail(id)
                    .then(mapScheduledTransferDetail)
                    .then((d) => ({ rows: d.rows.map(toApprovalTxnFromTransferLine), withdrawalAccount: scheduledWithdrawal(d) }));
        case "expense":
            return (id) =>
                fetchExpensePaymentDetail(id)
                    .then(mapScheduledTransferDetail)
                    .then((d) => ({ rows: d.rows.map(toApprovalTxnFromTransferLine), withdrawalAccount: scheduledWithdrawal(d) }));
        case "payroll":
            return (id) =>
                fetchPayrollPaymentDetail(id)
                    .then(mapScheduledTransferDetail)
                    .then((d) => ({ rows: d.rows.map(toApprovalTxnFromTransferLine), withdrawalAccount: scheduledWithdrawal(d) }));
        case "overseas":
            // detailsRow.documentNo == OVRS_PYMN_NO (set via mstr.setDocNo in OverseasPaymentService)
            return (id) =>
                fetchOverseasPaymentDetail(id)
                    .then((detail) => ({
                        rows: detail.rows.map(toApprovalTxnFromOverseas),
                        // Overseas detail carries the withdrawal fields in
                        // snake_case (no shared camel mapper); it has no
                        // resolved bank name, so the code stands in — same
                        // as the Overseas Scheduled Payment detail popup.
                        withdrawalAccount: {
                            bankCd: detail.out_bank_cd || undefined,
                            bankNm: detail.out_bank_cd ?? "",
                            acctNo: detail.wdrl_act_no ?? "",
                            ccyCd:  detail.wdrl_ccy_cd ?? detail.ccy_cd ?? "",
                        },
                    }));
        case "corporate_card":
            return (apprSeqNo) =>
                fetchCardTransactionsByApproval(apprSeqNo)
                    .then((rows) => ({ rows: rows.map(toApprovalTxnFromCardRow) }));
        default:
            return null;
    }
}

/** Project a `TransferLineDetail` onto the dialog's
 *  `RequestApprovalTransaction` shape. The detail wire does NOT carry
 *  bank names, so the deposit-bank fields fall back to the raw code —
 *  if the backend joins bank names into the detail response later, the
 *  mapper picks them up without further frontend changes. */
function toApprovalTxnFromTransferLine(line: TransferLineDetail): RequestApprovalTransaction {
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

/** Internal-Transfer-only enriched projection — mirrors the Internal
 *  Transfer Scheduled Payment popup's `detailLineToApprovalTransaction`
 *  so the same approval document renders identically from both entry
 *  points: server-resolved bank name (`tarBankNm`), formatted transfer
 *  amount, `"<code> - <seq>"` reporting account, and the chart-account
 *  breadcrumb sub-line. Used only by the `internal_transfer` loader
 *  branch; Vendor / Expense / Payroll keep {@link toApprovalTxnFromTransferLine}
 *  until they're brought into scope. */
function toApprovalTxnFromTransferLineRich(line: TransferLineDetail): RequestApprovalTransaction {
    const reportingAccount = line.chartAcctCd
        ? (line.chartAcctSeqNo
            ? `${line.chartAcctCd} - ${line.chartAcctSeqNo}`
            : line.chartAcctCd)
        : undefined;
    return {
        id:                  line.scdulPymnDetlNo,
        depositBankCode:     line.tarBankCd ?? "",
        depositBankName:     line.tarBankNm ?? line.tarBankCd ?? "",
        depositBankCcyCd:    line.depoCcyCd ?? line.ccyCd ?? "",
        depositAccountNo:    line.fincMdaNo ?? "",
        transferAmount:      formatNumber(line.tranAmt),
        recipientName:       line.rcptNm ?? undefined,
        remarks:             line.note ?? undefined,
        description:         line.tranUsag ?? undefined,
        documentNo:          line.docNo ?? undefined,
        reportingAccount,
        reportingBreadcrumb: line.chartAcctBreadcrumb ?? undefined,
    };
}

/** Project an `ApiOverseasPaymentExcelDetailRow` (beneficiary line from
 *  `OVRS_PYMN_SUMR_DETL`) onto the dialog's `RequestApprovalTransaction`
 *  shape so the same Transaction Details table renders overseas rows. */
function toApprovalTxnFromOverseas(line: ApiOverseasPaymentExcelDetailRow): RequestApprovalTransaction {
    return {
        id:               String(line.trn_seq),
        depositBankCode:  line.bic_cd ?? "",
        depositBankName:  line.bnfc_bank_nm ?? "",
        depositBankCcyCd: line.ccy_cd ?? "",
        depositAccountNo: line.bnfc_acct_no ?? "",
        transferAmount:   String(line.trnf_amt ?? ""),
        recipientName:    line.bnfc_nm ?? undefined,
        remarks:          line.memo ?? undefined,
        reportingAccount: line.rprt_acct_cd ?? undefined,
        feePayer:         line.fee_payer_cd ?? undefined,
    };
}

/** Project an `ApiCardTransactionRow` onto the dialog's
 *  `RequestApprovalTransaction` shape — matches legacy
 *  `comm_0195_001.ts:CardDetails(data.REC4)` field mapping:
 *  MERCH_NM → recipientName, CONT → description,
 *  CHART_ACCT_CD → reportingAccount, formatted TRSC_AMT → transferAmount. */
function toApprovalTxnFromCardRow(
    row: import("@/lib/types/api").ApiCardTransactionRow,
): RequestApprovalTransaction {
    return {
        id:               row.card_seq_no,
        depositBankCode:  row.bank_cd,
        depositBankName:  row.bank_nm ?? row.bank_cd,
        depositBankCcyCd: row.ccy_cd,
        depositAccountNo: row.card_no,
        // Wire is raw decimal — format using the shared currency helper
        // so the dialog footer renders identically to the Card
        // Transactions page (no symbol; Currency column carries CCY_CD).
        transferAmount:   row.trsc_amt
            ? Number(row.trsc_amt).toLocaleString("vi-VN")
            : "",
        recipientName:    row.merch_nm ?? undefined,
        description:      row.cont ?? undefined,
        reportingAccount: row.chart_acct_cd ?? undefined,
    };
}
