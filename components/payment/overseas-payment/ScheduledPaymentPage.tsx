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
import { useStickyLoading } from "@/hooks/useStickyLoading";
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
    dispatchOverseasPayment,
    type ApiOverseasScheduledRow,
    type ApiOverseasScheduledListResponse,
    type ApiOverseasApprover,
    type ApiOverseasPaymentExcelDetailRow,
    type ApiOverseasPaymentDetailResponse,
} from "@/lib/api/payment";
import { ApiCallError } from "@/lib/api/banking";
import { formatAmount } from "@/lib/currency";
import { useApiData } from "@/lib/api/useApiData";
import { useDialog } from "@/components/shared/dialog";
import RequestApprovalDialog, {
    type RequestApprovalRow,
    type RequestApprovalTransaction,
    type RequestApprovalAccount,
} from "../shared/RequestApprovalDialog";
import ApprovalDetailsDialog, {
    isCurrentUserActiveApprover,
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

    // Approver cell — map the chain the backend already ships (api.approvers)
    // into the shared shell's `approver` / `approverCount` / `approvers` props
    // (mirrors Payroll / Vendor / Expense). Overseas has no flat `api.approver`,
    // so the first name is derived from approvers[0]. Stays undefined when the
    // chain is empty so the badge hides and the chevron is inert.
    const fmtActedAt = (raw: string | null): string | null => {
        if (!raw || raw.length < 12) return null;
        return `${raw.slice(6, 8)}-${raw.slice(4, 6)}-${raw.slice(0, 4)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}`;
    };
    const approverList = api.approvers && api.approvers.length > 0
        ? api.approvers.map((a) => ({
              name:    a.apprvr_nm ?? "",
              status:  a.apprvr_stts ?? "",
              actedAt: (a.apprvr_stts === "A" || a.apprvr_stts === "R")
                  ? fmtActedAt(a.mod_dtm)
                  : null,
          }))
        : undefined;

    return {
        id:            api.ovrs_pymn_no,
        dateTime:      formatRegDtm(api.reg_dtm),
        fileName:      api.file_nm || api.bnfc_nm || "-",
        txnCount:      Number(api.tot_trns_cnt) || 0,
        txnCurrency:   api.ccy_cd,
        totalAmount:   api.total_tran_amt?.toString() ?? "0",
        status,
        statusStep,
        // Requestor = legacy EXPT_RESOL_MSTR.DRAFT_USER_NM (발의자명). Renders
        // BLANK when null (draft — no approval request yet), matching legacy
        // pymn_0007_001 `null2void(DRAFT_USER_NM)`. Do NOT fall back to reg_id:
        // reg_id is the creator LOGIN id (email), which legacy never shows in
        // this column (the SUMR-branch DRAFT_USER_NM comes from the
        // EXPT_RESOL_MSTR LEFT JOIN — null for un-submitted batches).
        requestor:     api.draft_user_nm || "",
        // Approver cell — first approver name + "[N]" count badge. Legacy
        // pymn_0007_001 `createApproverCell` renders an EMPTY cell when there is
        // no approval line (REC_1 empty → draft); the name + count appear ONLY
        // when approvers exist. So: blank name (NOT "-") when none, and suppress
        // the count when it is 0/absent. `apprvr_tot_cnt` is a COUNT(*) subquery
        // that returns 0 for a draft (appr_seq_no null), and `0 ?? …` keeps 0 —
        // the `|| undefined` coerces 0 → undefined so the badge + chevron hide,
        // matching legacy and the four sibling modules.
        approver:      api.approvers?.[0]?.apprvr_nm ?? "",
        approverCount: (api.apprvr_tot_cnt ?? api.approvers?.length) || undefined,
        approvers:     approverList,
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
    { value: "",   labelKey: "payment.appr_stts.all" },
    { value: "00", labelKey: "payment.appr_stts.not_requested" },
    { value: "04", labelKey: "payment.appr_stts.pending" },
    { value: "03", labelKey: "payment.appr_stts.in_progress" },
    { value: "01", labelKey: "payment.appr_stts.approved" },
    { value: "02", labelKey: "payment.appr_stts.rejected" },
] as const;

/**
 * Per-column FIELD_ID map for the shared `<PaymentScheduledBatchListPage>`.
 * Sort keys mirror the V232 legacy-aligned FIELD_IDs from `pymn_0007_001`.
 *
 * `APPROVAL_REF` + `APPROVAL_TITLE` keys are omitted because legacy
 * pymn_0007_001 doesn't surface those columns on the Overseas
 * Scheduled list (the headers are not in the seed). `APPROVER` is
 * intentionally `SORT_YN='N'` per V232.
 */
const SORTABLE_COLUMNS: ScheduledBatchSortable = {
    DATE_TIME:    "TRNF_DT",
    TOTAL_AMOUNT: "TRNF_AMT",
    STATUS:       "APPR_STTS",
    REQUESTOR:    "USER_NM",
};

/**
 * FIELD_ID aliases supplied to `<PaymentScheduledBatchListPage>` so the
 * shell maps each canonical column slot to the legacy V232 FIELD_ID
 * rather than the V131 default. The remaining per-transaction legacy
 * columns (DBT_ACCT_NO, DBT_CCY_CD, BNFC_BANK_NM, BNFC_ACCT_NO,
 * BNFC_ADDR, CHART_ACCT_CD, TRNF_CCY_CD, FEE_PAYER_CD, MEMO) don't
 * have batch-list slots — they ride through the seed for popover
 * visibility but render only after the page architecture switches
 * to per-transaction rows.
 */
const FIELD_ID_MAP = {
    dateTime:    "TRNF_DT",
    fileName:    "BNFC_NM",
    totalAmount: "TRNF_AMT",
    status:      "APPR_STTS",
    requestor:   "USER_NM",
    approver:    "APPRVR_ID",
} as const;

/**
 * Paint-time fallback — mirrors the V232 sys_scr_option_wecms seed
 * (legacy pymn_0007_001 column set). Used when the API hasn't
 * returned view-setting items yet so the popover paints with the
 * canonical 16 user FIELD_IDs + CHECKBOX + ETC.
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "CHECKBOX",      field_nm: "",                          disp_ord: 0,  use_yn: "Y", disp_yn: "Y", sort_yn: "N", size: "40px"  },
    { field_id: "TRNF_DT",       field_nm: "Transfer Date",             disp_ord: 1,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "120px" },
    { field_id: "DBT_ACCT_NO",   field_nm: "Debit Account No.",         disp_ord: 2,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "155px" },
    { field_id: "DBT_CCY_CD",    field_nm: "Debit Currency",            disp_ord: 3,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "155px" },
    { field_id: "BNFC_NM",       field_nm: "Beneficiary",               disp_ord: 4,  use_yn: "Y", disp_yn: "Y", sort_yn: "N", size: "170px" },
    { field_id: "BNFC_BANK_NM",  field_nm: "Beneficiary Bank Name",     disp_ord: 5,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "170px" },
    { field_id: "BNFC_ACCT_NO",  field_nm: "Beneficiary Account Number",disp_ord: 6,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "210px" },
    { field_id: "BNFC_ADDR",     field_nm: "Beneficiary Address",       disp_ord: 7,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "230px" },
    { field_id: "CHART_ACCT_CD", field_nm: "Reporting Account",         disp_ord: 8,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "240px" },
    { field_id: "TRNF_CCY_CD",   field_nm: "Transfer Currency",         disp_ord: 9,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "155px" },
    { field_id: "TRNF_AMT",      field_nm: "Transfer Amount",           disp_ord: 10, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "155px" },
    { field_id: "FEE_PAYER_CD",  field_nm: "Fee Payer",                 disp_ord: 11, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "155px" },
    { field_id: "MEMO",          field_nm: "Memo/Description",          disp_ord: 12, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "155px" },
    { field_id: "APPR_STTS",     field_nm: "Approval Status",           disp_ord: 13, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "155px" },
    { field_id: "USER_NM",       field_nm: "Requestor",                 disp_ord: 14, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "155px" },
    { field_id: "APPRVR_ID",     field_nm: "Approver",                  disp_ord: 15, use_yn: "Y", disp_yn: "Y", sort_yn: "N", size: "190px" },
    { field_id: "ETC",           field_nm: "",                          disp_ord: 99, use_yn: "Y", disp_yn: "Y", sort_yn: "N", size: "130px" },
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

    const handleTransferRow = useCallback(
        async (row: OverseasScheduledRow & PaymentScheduledBatchRow) => {
            if (row.action !== "transfer") return;

            // Cut-off-time pre-flight is skipped on Overseas — SWIFT
            // rails don't share the domestic NAPAS / CITAD cut-off
            // window the SCDUL_PYMN dispatcher gates on.
            dialog.open({
                type:        "confirmation",
                title:       t("dialog.confirmation"),
                description: t("payment.overseas.transfer_confirm_description", {
                    fileName: row.fileName,
                }),
                confirmText: t("dialog.continue"),
                cancelText:  t("dialog.cancel"),
                onConfirm: async () => {
                    setActionInFlight(true);
                    try {
                        await dispatchOverseasPayment(row.id);
                        dialog.open({
                            type:        "success",
                            title:       t("dialog.success"),
                            description: t("payment.overseas.transfer_success"),
                        });
                        refreshList();
                    } catch (err) {
                        const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
                        const message = err instanceof ApiCallError
                            ? err.message
                            : t("payment.overseas.transfer_failed");
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
            });
        },
        [dialog, refreshList, t],
    );

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
                    setActionInFlight(true);
                    try {
                        await deleteOverseasDraftBatch(row.id);
                        refreshList();
                    } catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        dialog.open({ type: "error", title: t("dialog.error"), description: message });
                    } finally {
                        setActionInFlight(false);
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
                        setActionInFlight(true);
                        try {
                            await removeOverseasApprovalLine(row.id);
                            refreshList();
                        } catch (err) {
                            const message = err instanceof Error ? err.message : String(err);
                            dialog.open({ type: "error", title: t("dialog.error"), description: message });
                        } finally {
                            setActionInFlight(false);
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
        setActionInFlight(true);
        try {
            await actOnOverseasApproval(id, { action: "APPROVE" });
            refreshList();
            dialog.open({ type: "success", title: t("dialog.success"), description: t("payment.overseas.approve_success") });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            dialog.open({ type: "error", title: t("dialog.error"), description: message });
        } finally {
            setActionInFlight(false);
        }
    }, [detailsView, dialog, refreshList, t]);

    const handleReject = useCallback(async () => {
        if (!detailsView) return;
        const id = detailsView.row.id;
        setDetailsView(null);
        setActionInFlight(true);
        try {
            await actOnOverseasApproval(id, { action: "REJECT" });
            refreshList();
            dialog.open({ type: "success", title: t("dialog.success"), description: t("payment.overseas.reject_success") });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            dialog.open({ type: "error", title: t("dialog.error"), description: message });
        } finally {
            setActionInFlight(false);
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

    /* Stable-data latch — preserves the previous response across
     * refetches so the table doesn't flash empty between filter / sort
     * / pagination / refresh changes. Mirrors the canonical pattern. */
    const [stableData, setStableData] = useState<ApiOverseasScheduledListResponse | null>(state.data);
    const [prevData, setPrevData] = useState<ApiOverseasScheduledListResponse | null>(state.data);
    if (state.data !== prevData) {
        setPrevData(state.data);
        if (state.data) setStableData(state.data);
    }

    const rows = useMemo(
        (): Array<OverseasScheduledRow & PaymentScheduledBatchRow> =>
            (stableData?.rows ?? []).map(mapApiRow),
        [stableData],
    );

    // Per-currency totals — backend wire doesn't yet ship a
    // `currency_totals` aggregate for Overseas Payment (Phase A
    // omitted from `ApiOverseasScheduledPaymentListResponse`), so
    // sum the visible page rows client-side. Sticky footer's merge
    // logic anchors USD + VND defaults; the KRW entry below ensures
    // the bar always shows three currencies even when the page has
    // no KRW rows. Real per-currency aggregates ship later via the
    // backend's `currency_totals` field — at that point swap the
    // client-side reduce for `state.data.currency_totals`.
    const totals = useMemo<{ currency: string; amount: string }[]>(() => {
        const sumByCcy = new Map<string, number>();
        for (const r of rows) {
            const n = Number(r.totalAmount);
            if (!Number.isFinite(n)) continue;
            sumByCcy.set(r.txnCurrency, (sumByCcy.get(r.txnCurrency) ?? 0) + n);
        }
        // Always include KRW (the page's third always-show currency)
        // — defaults to 0 when no KRW rows are present.
        if (!sumByCcy.has("KRW")) sumByCcy.set("KRW", 0);
        return Array.from(sumByCcy.entries()).map(([ccy, sum]) => ({
            currency: ccy,
            amount:   formatAmount(String(sum), ccy, true),
        }));
    }, [rows]);
    const totalCount = stableData?.total_count ?? 0;

    /* Sticky-wrapped initial-loading + mutation gates. Mutations don't
     * track a `savingEdit` boolean for Overseas (the page uses
     * `ChangeApproverDialog` instead of inline editing), so just wrap
     * `actionInFlight` directly. */
    const stickyInitialLoading = useStickyLoading(state.loading && !stableData);
    const [actionInFlight, setActionInFlight] = useState(false);
    const stickyActionInFlight = useStickyLoading(actionInFlight);

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
                fieldIdMap={FIELD_ID_MAP}
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
                onTransferRow={handleTransferRow}
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
                emptyMessage={t("payment.overseas.scheduled_empty")}
                loading={stickyInitialLoading}
                actionInFlight={stickyActionInFlight}
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
                    /* Total Transfer Amount — legacy comm_0195_001:879
                       `_osmc.ui.formatAmount(parseFloat(TOTAL_TRAN_AMT), CCY_CD)`.
                       Must be currency-formatted (USD → "$10.00" / VND → "10₫" /
                       KRW → "₩10"), NOT the raw number. Mirrors the four sibling
                       modules' `formatAmount(detail.total_tran_amt, detail.ccy_cd,
                       true)` and the page's own footer totals. */
                    totalAmount={formatAmount(
                        detailsView.detail.total_tran_amt,
                        detailsView.detail.ccy_cd,
                        true,
                    )}
                    withdrawalAccount={{
                        // Internal 8-char bank code — keys the
                        // blocked-chars tooltip on the Remarks header.
                        bankCd:  detailsView.detail.out_bank_cd ?? undefined,
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
                    /* Footer "Requested by {name}" = legacy comm_0195_001
                       `data.REG_NM` (the requester's NAME). The Overseas detail
                       DTO carries no name field — only reg_id (login/email) —
                       so use the list row's requestor (DRAFT_USER_NM), blank
                       when absent. NEVER reg_id: legacy never shows the email. */
                    requestedBy={detailsView.row.requestor || ""}
                    requestedAt={detailsView.row.dateTime.replace(/\n/g, " ")}
                    onClose={() => setDetailsView(null)}
                    onMenuAction={stickyActionInFlight ? undefined : handleDetailsMenuAction}
                    onApprove={
                        (detailsView.detail.appr_stts === "P" || detailsView.detail.appr_stts === "04") &&
                        isCurrentUserActiveApprover(detailsView.approvers, userStorage.get()?.userId) &&
                        !stickyActionInFlight
                            ? handleApprove
                            : undefined
                    }
                    onReject={
                        (detailsView.detail.appr_stts === "P" || detailsView.detail.appr_stts === "04") &&
                        isCurrentUserActiveApprover(detailsView.approvers, userStorage.get()?.userId) &&
                        !stickyActionInFlight
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
                    /* Requester NAME (legacy REG_NM), blank when absent. The
                       Overseas detail DTO has no name field — use the row's
                       requestor (DRAFT_USER_NM). Never reg_id (login/email). */
                    requestedBy={changeApproverTarget.row.requestor || ""}
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

