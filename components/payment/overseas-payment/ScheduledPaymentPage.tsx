"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
    fetchOverseasPaymentDetail,
    fetchOverseasWithdrawalAccounts,
    fetchNextOverseasDocNo,
    downloadOverseasPaymentFile,
    deleteOverseasDraftBatch,
    dispatchOverseasPayment,
    type ApiOverseasScheduledRow,
    type ApiOverseasScheduledListResponse,
    type ApiOverseasPaymentExcelDetailRow,
} from "@/lib/api/payment";
import { ApiCallError } from "@/lib/api/banking";
import { formatAmount } from "@/lib/currency";
import { useApiData } from "@/lib/api/useApiData";
import { useDialog } from "@/components/shared/dialog";
import RequestApprovalDialog, {
    type RequestApprovalRow,
    type RequestApprovalTransaction,
} from "../shared/RequestApprovalDialog";
import CommonApprovalDetailsDialog from "@/components/payment/shared/CommonApprovalDetailsDialog";
import { useTranslation } from "@/lib/i18n";
import { formatDateLang, formatRegDtmDisplay } from "@/lib/datetime";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";

import OverseasExcelUploadModal from "./OverseasExcelUploadModal";
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
              // MOD_DTM is stored UTC — raw value drives the locale +
              // timezone-aware chip (acted rows only, matching `actedAt`).
              actedAtRaw: (a.apprvr_stts === "A" || a.apprvr_stts === "R")
                  ? (a.mod_dtm ?? null)
                  : null,
          }))
        : undefined;

    return {
        id:            api.ovrs_pymn_no,
        dateTime:      formatRegDtm(api.reg_dtm),
        dateTimeRaw:   api.reg_dtm ?? undefined,
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
        // Approval Title = legacy EXPT_RESOL_MSTR.TITL, NULL until the batch is
        // submitted (LEFT JOIN on APPR_SEQ_NO). Blank for not-yet-requested rows
        // to match legacy pymn_0007_001 + the four sibling modules — never the
        // upload title, never a "-" placeholder.
        approvalTitle: api.appr_seq_no ? api.titl : "",
        action,
        rowHighlight:    api.appr_seq_no ? undefined : "warning",
        canDelete:       !api.appr_seq_no,
        canDownloadFile: Boolean(api.file_nm),
        fromBank:        api.out_bank_nm || "-",
        fromAccount:     api.wdrl_act_no ?? undefined,
        // Store RAW yyyyMMdd PAY_DATE — formatted locale-aware at render/print
        // (date-only → no timezone shift).
        scheduleDate:    api.pay_date ?? "",
        rawApprovers:    api.approvers ?? [],
    };
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Constants
 * ───────────────────────────────────────────────────────────────────────── */

// Legacy parity (pymn_0007_001_view.jsp status dropdown + pymn_0007_001.js:273-300):
// "04" is the UI marker for Not Requested → EXPT_RESOL_MSTR.APPR_TYPE_CD IS NULL
// (no approval doc). "00" is the real stored "requesting" code, which the backend
// CASE maps to status 'P' (Pending). The two were previously swapped.
const APPR_TYPE_OPTIONS = [
    { value: "",   labelKey: "payment.appr_stts.all" },
    { value: "04", labelKey: "payment.appr_stts.not_requested" },
    { value: "00", labelKey: "payment.appr_stts.pending" },
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
    const { t, locale } = useTranslation();
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
    // The shell owns the checkbox-selection set privately; it hands back a
    // `clearSelection` callback alongside the chosen rows. Stash it so the
    // dialog's close / cancel / submit handlers can clear the ticked rows
    // once the Request Approval flow ends.
    const clearScheduledSelection = useRef<(() => void) | null>(null);

    /* ── Approval Details dialog state ─────────────────────────────── */
    // APPR_SEQ_NO of the row opened in the SHARED CommonApprovalDetailsDialog
    // (the list row carries appr_seq_no as `approvalRef`). The shared dialog
    // self-fetches the normalized detail + the REAL EXPT_RESOL_APPRVR_INFM
    // approver chain (replacing the local list-row `bridgeApprovers` mapping),
    // serves overseas E-mode transaction lines + withdrawal, and owns approve /
    // reject / edit / withdraw — legacy one-popup architecture (comm_0195_001),
    // same as Approval Box / Internal Transfer / Vendor / Expense / Payroll.
    const [commonApprSeqNo, setCommonApprSeqNo] = useState<string | null>(null);

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
        (
            chosen: Array<OverseasScheduledRow & PaymentScheduledBatchRow>,
            clearSelection: () => void,
        ) => {
            // Remember how to clear the shell's checkboxes; only invoked
            // once the dialog actually closes/submits — a validation
            // failure below returns early and leaves the selection intact.
            clearScheduledSelection.current = clearSelection;
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

    // Approval-Ref-cell click — opens the SHARED Approval Details popup
    // (CommonApprovalDetailsDialog) keyed by APPR_SEQ_NO. The list row carries
    // appr_seq_no as `approvalRef`, so no detail/by-id fetch is needed here: the
    // shared dialog self-fetches the normalized detail + the real approver chain
    // and owns approve / reject / edit / withdraw (legacy comm_0195_001
    // single-popup architecture, same as the other payment types).
    const handleApprovalRefClick = useCallback(
        (row: OverseasScheduledRow & PaymentScheduledBatchRow): void => {
            if (!row.approvalRef) return;
            setCommonApprSeqNo(row.approvalRef);
        },
        [],
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

    // Per-currency totals — sourced from the API `totals` aggregate, which is
    // computed server-side (OverseasPaymentRepository.sumByCurrency) over the
    // FULL filtered set, NOT just the current page. Legacy parity:
    // IDO.OVRS_PYMN_SUMR_R003 sums TOTAL_TRAN_AMT GROUP BY CCY_CD across all
    // matching rows regardless of pagination. The KRW entry below keeps the
    // footer bar showing three currencies even when no KRW rows are present.
    const totals = useMemo<{ currency: string; amount: string }[]>(() => {
        const sumByCcy = new Map<string, number>();
        for (const t of stableData?.totals ?? []) {
            const n = Number(t.totl_amt);
            sumByCcy.set(t.ccy_cd, Number.isFinite(n) ? n : 0);
        }
        // Always include KRW (the page's third always-show currency)
        // — defaults to 0 when no KRW rows are present.
        if (!sumByCcy.has("KRW")) sumByCcy.set("KRW", 0);
        return Array.from(sumByCcy.entries()).map(([ccy, sum]) => ({
            currency: ccy,
            amount:   formatAmount(String(sum), ccy, true),
        }));
    }, [stableData]);
    const totalCount = stableData?.total_count ?? 0;

    /* Sticky-wrapped initial-loading + mutation gates. Approve / reject /
     * edit / withdraw now live inside the shared CommonApprovalDetailsDialog,
     * so this page's `actionInFlight` only tracks the row-level transfer /
     * delete mutations. */
    const stickyInitialLoading = useStickyLoading(state.loading && !stableData);
    const [actionInFlight, setActionInFlight] = useState(false);
    const stickyActionInFlight = useStickyLoading(actionInFlight);

    const handlePrint = useCallback(() => {
        type ScheduledRow = OverseasScheduledRow & PaymentScheduledBatchRow;
        const columns: PrintColumn<ScheduledRow>[] = [
            { header: t("payment.col.date_time"),                render: (r) => escapeHtml(r.dateTime.replace(/\n/g, " ")) },
            { header: t("payment.overseas.col.file_name"),       render: (r) => escapeHtml(r.fileName) },
            { header: t("payment.overseas.col.txn_count"),       align: "right", render: (r) => escapeHtml(`${r.txnCount} Transaction (${r.txnCurrency})`) },
            { header: t("payment.col.scheduled_date"),           render: (r) => escapeHtml(formatDateLang((r as OverseasScheduledRow).scheduleDate, locale) || "-") },
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
    }, [rows, fromYmd, toYmd, t, locale]);

    /* ── Request Approval: read-only withdrawal account ───────────────
     * Overseas Payment picks + saves the withdrawal account during the
     * Excel upload (→ OVRS_PYMN_SUMR.OUT_BANK_CD / WDRL_ACT_NO); the
     * approval submit does not change it. So Request Approval shows it
     * read-only (same concept as Internal Transfer / Vendor / Expense)
     * instead of an editable dropdown.
     *
     * NOTE: the Overseas list row exposes the bank NAME (out_bank_nm) as
     * `fromBank`, not a code — so the synchronous fallback uses it for
     * display only and leaves bankCd undefined; the effect fills the real
     * code by matching the saved account number against the enrolled list. */
    const loadOverseasAccounts = useCallback(async () => {
        const list = await fetchOverseasWithdrawalAccounts();
        return list.map((r) => ({
            bankCd:     r.bank_cd,
            bankNm:     r.bank_nm,
            acctNo:     r.acct_no,
            ccyCd:      r.ccy_cd,
            acctTypeCd: r.acct_type_cd,
            acctNickNm: r.acct_nick_nm,
        }));
    }, []);

    const withdrawalFallback = useMemo(() => {
        const row = approvalRows?.[0];
        if (!row) return null;
        const namePart = row.fromBank && row.fromBank !== "-" ? row.fromBank : "";
        return {
            acctNo:  row.fromAccount ?? "",
            ccyCd:   row.txnCurrency,
            display: `${[namePart, row.fromAccount].filter(Boolean).join(" ")} (${row.txnCurrency})`,
        };
    }, [approvalRows]);

    const [withdrawalResolved, setWithdrawalResolved] = useState<{
        bankCd?: string; acctNo: string; ccyCd: string; display: string;
    } | null>(null);

    useEffect(() => {
        const row = approvalRows?.[0];
        if (!row) { setWithdrawalResolved(null); return; }
        let cancelled = false;
        loadOverseasAccounts()
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
    }, [approvalRows, loadOverseasAccounts]);

    /* Preview the next VO_YYMMDD_NNN doc number on dialog open so drafts
     * (no saved doc_no yet) show the formatted business number instead of
     * the raw internal ovrs_pymn_no. Read-only / non-reserving; soft-fails
     * to null → dialog falls back to "—". Mirrors Internal Transfer / Card /
     * Vendor / Expense / Payroll. */
    const [approvalDocNo, setApprovalDocNo] = useState<string | null>(null);
    useEffect(() => {
        if (!approvalRows) { setApprovalDocNo(null); return; }
        let cancelled = false;
        fetchNextOverseasDocNo()
            .then((docNo) => { if (!cancelled) setApprovalDocNo(docNo); })
            .catch(() => { if (!cancelled) setApprovalDocNo(null); });
        return () => { cancelled = true; };
    }, [approvalRows]);

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
                fieldIdMap={FIELD_ID_MAP}
                onListView={handleListView}
                extraColumn={{
                    key:         "scheduleDate",
                    label:       t("payment.internal.col.schedule_date"),
                    width:       "var(--w-wb-st-schedule-date)",
                    sortFieldId: "PAY_DATE",
                    render: (row) => (
                        <span className="block truncate text-wb-13 font-medium text-wb-ink">
                            {formatDateLang(row.scheduleDate, locale)}
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
                onRefresh={refreshList}
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
                    // Document No. priority: saved docNo (submitted) → approvalRef
                    // → preview VO_YYMMDD_NNN (drafts, via /next-doc-no) → "—".
                    // Never the raw internal ovrs_pymn_no. Preview is read-only /
                    // non-reserving and soft-fails to "—" if unreachable.
                    documentNo={approvalRows[0]?.docNo || approvalRows[0]?.approvalRef || approvalDocNo || "—"}
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
                    // Read-only: the withdrawal account was chosen at the
                    // Overseas Excel upload and saved on the batch; not
                    // re-selectable here. Same concept as Internal Transfer /
                    // Vendor / Expense.
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

            {/* Shared Approval Details popup — opened from the row's Approval
               Ref cell (legacy comm_0195_001 single-popup architecture, same as
               every other payment type). Keyed by APPR_SEQ_NO (the list row's
               `approvalRef`); self-fetches the normalized detail + the real
               EXPT_RESOL_APPRVR_INFM approver chain, serves overseas E-mode
               transaction lines + withdrawal, and owns approve / reject / edit /
               withdraw. On close, refresh the list so a status change made
               inside the popup re-renders the row badge + totals.

               Note: the Scheduled list only surfaces E-mode batches (it reads
               OVRS_PYMN_SUMR), so the shared dialog's generic withdraw / edit /
               approve route to the same backend behavior as the former
               overseas-specific functions (verified). The previous separate
               ChangeApproverDialog edit-modal is replaced by the shared dialog's
               inline Edit Approval Line. */}
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

