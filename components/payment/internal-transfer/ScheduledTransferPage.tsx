"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import PaymentScheduledBatchListPage, {
    type PaymentScheduledBatchRow,
    type PeriodKey,
    type ScheduledBatchSortable,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import ApprovalDetailsDialog, {
    chainToDialogApprovers,
    isCurrentUserActiveApprover,
    type ApprovalDetailsApprover,
    type ApprovalOutcome,
} from "@/components/payment/shared/ApprovalDetailsDialog";
import { fetchApprovalBoxApprovers } from "@/lib/api/approval-box";
import { userStorage } from "@/lib/auth/storage";
import RequestApprovalDialog, {
    type RequestApprovalAccount,
    type RequestApprovalRow as ApprovalRow,
    type RequestApprovalTransaction,
} from "@/components/payment/shared/RequestApprovalDialog";
import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import {
    actOnInternalTransferApproval,
    changeInternalTransferApprovalLine,
    deleteScheduledTransfer,
    dispatchScheduledTransfer,
    downloadApprovalAttachment,
    downloadOriginalExcel,
    fetchNextInternalTransferDocNo,
    fetchScheduledTransferDetail,
    fetchScheduledTransferList,
    fetchWithdrawalAccounts,
    withdrawInternalTransferApproval,
} from "@/lib/api/internalTransfer";
import EditApprovalLinePicker, {
    type EditApprovalLinePreview,
} from "@/components/payment/corporate-card/EditApprovalLinePicker";
import type {
    ApiApprovalLineRow,
    ApiScheduledTransferDetailResponse,
    ApiTransferLineDetail,
} from "@/lib/types/api";
import {
    mapScheduledTransferList,
    type ScheduledTransferList,
    type ScheduledTransferRow,
} from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { formatAmount, formatNumber } from "@/lib/currency";
import { useTableSort } from "@/hooks/useTableSort";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTranslation } from "@/lib/i18n";
import { formatRegDtmDisplay } from "@/lib/datetime";
import { validateBankingTime } from "@/lib/payment/validateBankingTime";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import InternalTransferUploadDialog from "./InternalTransferUploadDialog";
import { type InternalScheduledRow } from "./types";

/**
 * STATIC action-permission layer for `internal-transfer-scheduled` —
 * actions R / D / T.
 *
 * Legacy `pymn_0009_001` hides the toolbar Request Approval CTA and the
 * per-row Delete / Transfer chips based on the user's action permissions
 * (R = Request Approval, D = Delete, T = Transfer), sourced from
 * `USER_MENU_ACTION_AUTH_INFM` via `WbUser.actionPermJson()`. The refactor
 * has no action-permission API yet — neither `/auth/me` nor `/navigation`
 * carry R/D/T (see the internal-transfer-scheduled permission audit). This
 * is a static stand-in so the UI structure is ready now; every flag is
 * `true`, so behaviour is identical to today for every user.
 *
 * TODO: replace this static object with a real action-permission map
 * resolved from auth/navigation once the backend exposes a
 * `USER_MENU_ACTION_AUTH_INFM` equivalent. The three `can*` helpers derived
 * from it inside the component are the only seam — swapping the source
 * (static object → per-user hook) is a localized change here. Slug, not the
 * legacy WSVC id: `internal-transfer-scheduled`.
 */
const internalTransferActionPerms = {
    R: true,
    D: true,
    T: true,
} as const;

/**
 * Payment > Internal Transfer > Scheduled Transfer — Figma 1:9972.
 *
 * Composes the shared `<PaymentScheduledBatchListPage>` — the canonical
 * batch-file Scheduled list (CLAUDE.md §12a). Server-driven for
 * pagination, sort, and the period dropdown.
 *
 * <p>Default state: page 0 × 10 rows, period "Last 30 Days", default
 * ORDER BY (`reg_dtm DESC, scdul_pymn_no DESC`). The toolbar's period
 * dropdown lets the user widen to 7 / 30 / 90 days; each click resets
 * the page to 0 so the user never lands on an out-of-range page.
 */
export default function ScheduledTransferPage() {
    // Static R/D/T gates for this page (see `internalTransferActionPerms`).
    // These three booleans are the ONLY consumers of the static object —
    // when the real action-permission API lands, replace the right-hand
    // side with the resolved per-user values (e.g. a `useActionPerms(
    // "internal-transfer-scheduled")` hook) and nothing else changes.
    const canRequestApproval           = internalTransferActionPerms.R;
    const canDeleteScheduledTransfer   = internalTransferActionPerms.D;
    const canDispatchScheduledTransfer = internalTransferActionPerms.T;
    const { t } = useTranslation();
    const dialog = useDialog();
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadKey, setUploadKey] = useState(0);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [period, setPeriod] = useState<PeriodKey>("30d");
    const [manualRange, setManualRange] = useState<{ fromDate: string; toDate: string } | undefined>(undefined);
    const [apprType, setApprType] = useState<string>("");      // "" = All
    const [search, setSearch] = useState<string>("");
    // Bumped after a successful upload so the list refetches and the new
    // batch row appears at the top without a manual page reload. Same
    // pattern as the legacy `fn_loadData()` re-call in `pymn_0009_002`.
    const [refreshKey, setRefreshKey] = useState(0);
    // Selected rows currently up for "Request Approval" — null = dialog
    // closed. The shell hands the chosen rows back via `onRequestApproval`;
    // when this is non-null the shared `<RequestApprovalDialog>` mounts.
    const [approvalRows, setApprovalRows] = useState<
        Array<InternalScheduledRow & PaymentScheduledBatchRow> | null
    >(null);
    // Preview of the next VO_YYMMDD_NNN doc number for the Request
    // Approval dialog. Fetched on dialog open so the read-only
    // "Document No." field renders the same friendly format as Card
    // Transactions instead of falling back to the raw SCDUL_PYMN_NO.
    // Authoritative value is stamped server-side at submit.
    const [approvalDocNo, setApprovalDocNo] = useState<string | null>(null);
    // Row currently being shown in the read-only Approval Details
    // dialog. Set when the user clicks a row that already has an
    // Approval Ref (the batch has been submitted for approval — mirrors
    // legacy `comm_0194_001` "approval details" panel). Null = dialog
    // closed; the `detail` payload is fetched lazily from
    // `GET /api/v1/payment/internal-transfer/{id}` before the dialog
    // opens so the General Information section can render the
    // withdrawal account + total amount from the persisted master.
    const [detailsView, setDetailsView] = useState<{
        row:       InternalScheduledRow & PaymentScheduledBatchRow;
        detail:    ApiScheduledTransferDetailResponse;
        /** Per-approver chips shown in the General Information section.
         *  Phase A bridge: the wire's `ApiScheduledTransferDetailResponse`
         *  doesn't yet ship the per-approver outcome list (legacy `REC2`),
         *  so we fall back to the user's first approval line as the
         *  approver chain. Approver[0] is the "current" pending approver,
         *  the rest are "waiting" (legacy `APPRVR_STTS=W`). When the
         *  backend grows the real EXPT_RESOL_MSTR / BLTB_POST_INFM join,
         *  swap this source — the dialog rendering is already in place. */
        approvers: ApprovalDetailsApprover[];
    } | null>(null);
    // Approval Details edit-mode state — mirrors the Approval Box pattern
    // (components/payment/approval-box/ApprovalBoxPage.tsx). When true,
    // the dialog swaps the read-only approver chips for an inline
    // `<EditApprovalLinePicker>`; Save calls the real change-approval-line
    // endpoint and closes the dialog.
    const [editMode, setEditMode]       = useState(false);
    const [pickedLine, setPickedLine]   = useState<EditApprovalLinePreview | null>(null);
    const [savingEdit, setSavingEdit]   = useState(false);
    const sort = useTableSort();

    // View Setting state — mirrors the canonical Account Inquiry pattern
    // (CLAUDE.md §13). The hook loads `vs.items` keyed by the seeded
    // FIELD_IDs in V85 for `payment-internal-transfer-scheduled`; the
    // shell's `viewSettingItems` prop gates each column's <col>/<th>/<td>
    // by `USE_YN === "Y"`. Reorder is not yet wired on the shell — the
    // popover persists DISP_ORD and Save round-trips it cleanly, but
    // the visible column order stays in the legacy hardcoded sequence
    // until a follow-up MR refactors the shell to drive ordering
    // dynamically.
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_SCHEDULED,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    function openUpload() {
        setUploadKey((k) => k + 1);
        setUploadOpen(true);
    }

    // Reset to page 0 whenever the filter / sort / size changes so the
    // user doesn't land on a now-out-of-range page after the result
    // count shrinks. Mirrors the legacy `fn_loadData(option=true)`
    // reset documented in wecms-web CLAUDE.md §4.
    function changePeriod(next: PeriodKey) {
        setPeriod(next);
        setPage(0);
    }
    function changePageSize(next: number) {
        setPageSize(next);
        setPage(0);
    }
    function handleSort(fieldId: string) {
        sort.toggleSort(fieldId);
        setPage(0);
    }
    function changeApprType(next: string) {
        setApprType(next);
        setPage(0);
    }
    function changeSearch(next: string) {
        setSearch(next);
        setPage(0);
    }

    const { fromDate, toDate } = useMemo(
        () => periodToWindow(period, manualRange),
        [period, manualRange],
    );
    const state = useApiData(
        () =>
            fetchScheduledTransferList({
                fromDate,
                toDate,
                srchWd: search.trim() || undefined,
                apprType: apprType || undefined,
                page,
                size: pageSize,
                sortField: sort.sortParams?.sortField,
                sortDirection: sort.sortParams?.sortDirection,
            }).then(mapScheduledTransferList),
        [
            fromDate,
            toDate,
            search,
            apprType,
            page,
            pageSize,
            sort.sortField,
            sort.sortDirection,
            refreshKey,
        ],
    );

    /* Stable-data latch — preserves the previous response across
     * refetches (filter / sort / pagination / mutation refresh) so the
     * table doesn't flash empty between requests. Mirrors the canonical
     * Account Inquiry / Operation Status / Approval Box pattern. */
    const [stableData, setStableData] = useState<ScheduledTransferList | null>(state.data);
    const [prevData, setPrevData] = useState<ScheduledTransferList | null>(state.data);
    if (state.data !== prevData) {
        setPrevData(state.data);
        if (state.data) setStableData(state.data);
    }

    const rows: Array<InternalScheduledRow & PaymentScheduledBatchRow> =
        (stableData?.rows ?? []).map(toListRow);
    const totals = (stableData?.currencyTotals ?? []).map((c) => ({
        currency: c.ccyCd,
        amount: formatAmount(c.totalAmount, c.ccyCd, true),
    }));
    const totalCount = stableData?.totalCount ?? 0;

    /* Sticky-wrapped initial-loading gate — keeps the centered Loading…
     * message visible ≥ 400 ms on first paint even when the API
     * responds in <50 ms. Subsequent refetches keep the previous rows
     * visible via {@link stableData} and never trip this gate. */
    const stickyInitialLoading = useStickyLoading(state.loading && !stableData);

    /* Sticky mirror of mutation in-flight (transfer / delete / withdraw
     * / edit-save). Held alongside each handler's own try/finally so
     * action buttons stay visibly disabled across the minimum-
     * visibility window even when the API round-trip is sub-perceptible. */
    const [actionInFlight, setActionInFlight] = useState(false);
    const stickyActionInFlight = useStickyLoading(actionInFlight || savingEdit);

    // Print → opens a clean popup with the 11 visible columns rendered
    // from the current `rows` (already filtered + sorted by the backend
    // for the active page). Calls `printReport` from lib/print.ts per
    // CLAUDE.md §6d — never calls window.print() on the live DOM.
    const handlePrint = useCallback(() => {
        const columns: PrintColumn<InternalScheduledRow & PaymentScheduledBatchRow>[] = [
            {
                header: t("payment.internal.col.date_time"),
                render: (r) => escapeHtml(r.dateTime.replace(/\n/g, " ")),
            },
            { header: t("payment.internal.col.file_name"), render: (r) => escapeHtml(r.fileName) },
            {
                header: t("payment.internal.col.txn_count"),
                align: "right",
                render: (r) =>
                    escapeHtml(
                        t("payment.internal.txn_count_with_currency", {
                            count: String(r.txnCount),
                            currency: r.txnCurrency,
                        }),
                    ),
            },
            {
                header: t("payment.internal.col.total_transfer"),
                align: "right",
                render: (r) => escapeHtml(r.totalAmount),
            },
            {
                header: t("approval.col.status"),
                render: (r) => (r.status ? escapeHtml(t(`payment.status.${r.status}`)) : ""),
            },
            { header: t("payment.col.requestor"), render: (r) => escapeHtml(r.requestor) },
            { header: t("payment.col.approver"), render: (r) => escapeHtml(r.approver) },
            { header: t("payment.internal.col.approval_ref"), render: (r) => escapeHtml(r.docNo ?? r.approvalRef) },
            { header: t("payment.internal.col.approval_title"), render: (r) => escapeHtml(r.approvalTitle) },
        ];
        const summary = t("common.showing_of", {
            shown: String(rows.length),
            total: String(totalCount),
        });
        printReport({
            title: t("payment.internal.scheduled_title"),
            summary,
            columns,
            rows,
        });
    }, [rows, totalCount, t]);

    // List-icon → open View Setting popover anchored to the trigger.
    // Snapshot `vs.items` into a local draft so checkbox / reorder
    // edits stay reversible until Save. Mirrors the canonical Account
    // Inquiry reference (CLAUDE.md §13).
    const handleListView = useCallback(
        (anchorRect: DOMRect) => {
            const seed = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
            setVsDraft(seed.map((it) => ({ ...it })));
            setVsAnchor(anchorRect);
        },
        [vs.items],
    );

    const closeViewSetting = useCallback(() => {
        setVsAnchor(null);
        setVsDraft(null);
    }, []);

    // ──────────────────────── Row actions ────────────────────────
    // Three callbacks the shell threads into the per-row trio:
    // Transfer / Delete / Download Excel. Each opens its own
    // confirmation flow + surfaces a typed `ApiCallError` through
    // `useDialog()` per CLAUDE.md §"Dialog variant".

    /** Refresh after a successful row mutation. Mirrors the upload
     *  success path so the changed row reflects immediately. */
    const refreshList = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    const handleTransferRow = useCallback(
        async (row: InternalScheduledRow & PaymentScheduledBatchRow) => {
            // Legacy `pymn_0009_001.ts:472` short-circuits when the
            // Transfer chip has the `disable` class — same idea here:
            // if the row's `pay_date` is still in the future the chip
            // is greyed out, but defence-in-depth check matches.
            if (row.action !== "transfer") return;

            // Pre-flight cut-off-time check — mirrors the legacy
            // `_v2common.app.validateBankingTime(...)` call in
            // `pymn_0009_001.ts:#btn_transfer`. Returns false (and
            // shows a warning dialog itself) when the call is outside
            // the bank's NAPAS/CITAD/SWIFT window. Backend
            // `CutoffValidator` still has the final word — this is a
            // UX speed-up so the user doesn't wait for a round-trip
            // to learn the window is closed.
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
                description: t("payment.internal.transfer_confirm_description", {
                    fileName: row.fileName,
                }),
                confirmText: t("dialog.continue"),
                cancelText: t("dialog.cancel"),
                onConfirm: async () => {
                    setActionInFlight(true);
                    try {
                        // Legacy `fnCreateTransfer` posts
                        // {SCDUL_PYMN_NO, PYMN_TYPE, TRNF_CCY_CD} to
                        // `pymn_0009_001_c001`. The refactor wire only
                        // needs `trnf_ccy_cd` — backend pulls PYMN_TYPE
                        // from the persisted batch.
                        await dispatchScheduledTransfer(row.id, {
                            trnf_ccy_cd: row.txnCurrency,
                        });
                        // Legacy uses different success messages by
                        // currency: WBI1160 for VND, WBI1161 otherwise.
                        // Mirror that split for parity.
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description:
                                row.txnCurrency === "VND"
                                    ? t("payment.internal.transfer_success_vnd")
                                    : t("payment.internal.transfer_success_fcy"),
                        });
                        refreshList();
                    } catch (err) {
                        const code =
                            err instanceof ApiCallError ? err.code : "WBE9999";
                        const message =
                            err instanceof ApiCallError
                                ? err.message
                                : t("payment.internal.transfer_failed");
                        dialog.open({
                            type: "error",
                            title: t("dialog.error"),
                            description: message,
                            errorCode: code,
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
        (row: InternalScheduledRow & PaymentScheduledBatchRow) => {
            // Legacy `pymn_0009_001.ts:632` double-check: if the row has
            // an approval ref the user has already submitted for
            // approval — surface WBE1063 and short-circuit before the
            // confirmation dialog. The shell already gates rendering on
            // `canDelete`, but a row may go stale between fetch and
            // click; this is the same defence-in-depth the legacy ships.
            if (row.approvalRef) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("payment.internal.delete_blocked_in_approval"),
                    errorCode: "WBE1063",
                });
                return;
            }
            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("payment.internal.delete_confirm_description", {
                    fileName: row.fileName,
                }),
                confirmText: t("dialog.continue"),
                cancelText: t("dialog.cancel"),
                destructive: true,
                onConfirm: async () => {
                    setActionInFlight(true);
                    try {
                        await deleteScheduledTransfer(row.id);
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t("payment.internal.delete_success"),
                        });
                        refreshList();
                    } catch (err) {
                        const code =
                            err instanceof ApiCallError ? err.code : "WBE9999";
                        const message =
                            err instanceof ApiCallError
                                ? err.message
                                : t("payment.internal.delete_failed");
                        dialog.open({
                            type: "error",
                            title: t("dialog.error"),
                            description: message,
                            errorCode: code,
                        });
                    } finally {
                        setActionInFlight(false);
                    }
                },
            });
        },
        [dialog, refreshList, t],
    );

    const handleDownloadRow = useCallback(
        async (row: InternalScheduledRow & PaymentScheduledBatchRow) => {
            try {
                await downloadOriginalExcel(row.id);
            } catch (err) {
                const code =
                    err instanceof ApiCallError ? err.code : "WBE9999";
                const message =
                    err instanceof ApiCallError
                        ? err.message
                        : t("payment.internal.download_failed");
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: message,
                    errorCode: code,
                });
            }
        },
        [dialog, t],
    );

    // — Request Approval ————————————————————————————————————————
    // Fires when the user clicks the toolbar's "Request Approval"
    // CTA. The shell hands us the currently-checked rows; we guard
    // the empty selection with a warning and otherwise open the
    // shared `<RequestApprovalDialog>` with `kind=internal-transfer`.
    const handleRequestApproval = useCallback(
        (chosen: Array<InternalScheduledRow & PaymentScheduledBatchRow>) => {
            if (chosen.length === 0) {
                dialog.open({
                    type:        "warning",
                    title:       t("dialog.warning"),
                    description: t("payment.request_approval.no_rows_selected"),
                });
                return;
            }
            // Legacy parity: a single approval request covers exactly one
            // uploaded batch. `pymn_0009_001.ts:688-711` short-circuits with
            // a "select only one item" modal before opening the dialog. The
            // refactor list permits multi-select for delete/visibility, so
            // we re-impose the one-batch rule here — otherwise the dialog
            // would flatten lines from every checked batch under a single
            // batch's withdrawal account + document number (a cross-batch
            // mix the backend submit was never designed for).
            if (chosen.length > 1) {
                dialog.open({
                    type:        "warning",
                    title:       t("dialog.warning"),
                    description: t("payment.request_approval.single_only"),
                });
                return;
            }
            // A batch is "already submitted" once its `approvalRef`
            // (master.appr_seq_no) is set — the user previously
            // clicked Request Approval on it. Re-submitting would
            // double-stamp the master and confuse the approval
            // chain; the backend's `WBE2062` guard catches this as
            // defence-in-depth, but the UI refuses up-front so the
            // user can simply uncheck the offending row and retry.
            // Legacy parity: `comm_0194_001.ts` short-circuits on
            // the same `APPR_SEQ_NO` flag before opening the dialog.
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

    // Loader the shared dialog uses to populate the Withdrawal
    // Bank/Account dropdown. Reuses the existing firm-banking-aware
    // endpoint so the picker shows only enrolled accounts.
    const loadInternalTransferAccounts =
        useCallback(async (): Promise<RequestApprovalAccount[]> => {
            const rows = await fetchWithdrawalAccounts();
            return rows.map((r) => ({
                bankCd:     r.bank_cd,
                bankNm:     r.bank_nm,
                acctNo:     r.acct_no,
                ccyCd:      r.ccy_cd,
                acctTypeCd: r.acct_type_cd,
                acctNickNm: r.acct_nick_nm,
            }));
        }, []);

    /* ── Request Approval: read-only withdrawal account ───────────── */
    // The withdrawal account is chosen + saved at Excel-upload time
    // (createDraft → SCDUL_PYMN_SUMR.OUT_BANK_CD / WDRL_ACT_NO); the
    // approval submit does not change it. So Request Approval shows it
    // read-only rather than as an editable dropdown. A synchronous
    // fallback (raw code from the list row) paints immediately; an
    // effect then upgrades the label to the resolved
    // "{bankNm} {acctNo} ({type} {ccy})" form by matching the batch's
    // saved account against the enrolled-account list.
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
        loadInternalTransferAccounts()
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
    }, [approvalRows, loadInternalTransferAccounts]);

    // Approve / Reject — fires the
    // `POST /api/v1/payment/internal-transfer/{id}/approval-action`
    // endpoint behind the dialog's footer buttons. On success the
    // dialog closes, the list refetches (so the row's status badge
    // flips immediately), and a success toast surfaces. Errors route
    // through the global system-error dialog with the server-supplied
    // code so the user can quote WBE2080 / WBE2081 to support.
    const handleApprovalAction = useCallback(
        async (scdulPymnNo: string, action: "APPROVE" | "REJECT"): Promise<void> => {
            setActionInFlight(true);
            try {
                await actOnInternalTransferApproval(scdulPymnNo, { action });
                setDetailsView(null);
                dialog.open({
                    type:        "success",
                    title:       t("dialog.success"),
                    description: action === "APPROVE"
                        ? t("payment.approval_details.approve_success")
                        : t("payment.approval_details.reject_success"),
                });
                setRefreshKey((k) => k + 1);
            } catch (err) {
                const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
                const message = err instanceof ApiCallError
                    ? err.message
                    : t("payment.approval_details.action_failed");
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
        [dialog, t],
    );

    // Withdraw the current approval request — kebab "Delete" action on
    // the Approval Details popup. Mirrors the Approval Box +
    // Card Transactions pattern (the same shared
    // `ApprovalBoxFanoutService.withdrawApproval` backs all three on
    // the api side). On success the dialog closes and the list
    // refetches so the batch's status badge flips back to Draft and
    // the row-level Delete icon becomes available again.
    const handleWithdrawApproval = useCallback(async () => {
        if (!detailsView) return;
        setActionInFlight(true);
        try {
            await withdrawInternalTransferApproval(detailsView.row.id);
            setDetailsView(null);
            dialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("approval.action.delete_success"),
            });
            setRefreshKey((k) => k + 1);
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError
                ? err.message
                : t("approval.action.delete_failed");
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        } finally {
            setActionInFlight(false);
        }
    }, [detailsView, dialog, t]);

    // Save the picked approval line via the real change-approval-line
    // endpoint. Replaces the per-approver chain on EXPT_RESOL_APPRVR_INFM
    // and resets the master back to Pending — exact same backend logic
    // Card Transactions uses (shared `ApprovalBoxFanoutService`).
    const handleEditSave = useCallback(async () => {
        if (!detailsView || !pickedLine) return;
        setSavingEdit(true);
        try {
            await changeInternalTransferApprovalLine(
                detailsView.row.id,
                pickedLine.apprLineNo,
            );
            dialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("approval.action.edit_success"),
            });
            setDetailsView(null);
            setEditMode(false);
            setPickedLine(null);
            setRefreshKey((k) => k + 1);
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError
                ? err.message
                : t("approval.action.edit_failed");
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        } finally {
            setSavingEdit(false);
        }
    }, [detailsView, pickedLine, dialog, t]);

    // Discard the edit-mode picker draft and return to read-only.
    const handleEditCancel = useCallback(() => {
        setEditMode(false);
        setPickedLine(null);
    }, []);

    // Approval-Ref-cell click handler — mirrors legacy `comm_0195_001`
    // UX where the Approval Ref value is the ONLY cell that opens the
    // read-only Approval Details dialog. The rest of the row stays a
    // detail-page link (default `<PaymentScheduledBatchListPage>` row
    // behaviour). Returning nothing — propagation is already stopped at
    // the cell level by the shared list so navigation doesn't fire.
    const handleApprovalRefClick = useCallback(
        (row: InternalScheduledRow & PaymentScheduledBatchRow): void => {
            if (!row.approvalRef) return;
            // Load the master detail, then the REAL approver chain
            // (EXPT_RESOL_APPRVR_INFM) by APPR_SEQ_NO — so the dialog renders
            // the true per-approver statuses (P/A/R/W/S) and gates
            // Approve/Reject on the current pending approver (legacy
            // comm_0195_001 / APPR_YN parity). The chain fetch is best-effort
            // (empty list on failure); errors on the master detail still
            // surface through the global error dialog.
            fetchScheduledTransferDetail(row.id)
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

    // Loader the shared dialog uses to populate the Transaction
    // Details table. Fetches the real per-batch detail (master + lines)
    // for each selected row and flattens the line rows into the dialog
    // shape. Mirrors what `pymn_0009_003_r001` returns on the legacy
    // side — the rows are exactly the lines the user uploaded via
    // Excel. When the backend returns an empty `rows[]` (Phase A POI
    // parsing still stubbed) the dialog renders the empty-state copy.
    const loadInternalTransferTransactions = useCallback(async (): Promise<
        RequestApprovalTransaction[]
    > => {
        if (!approvalRows || approvalRows.length === 0) return [];
        const out: RequestApprovalTransaction[] = [];
        for (const row of approvalRows) {
            try {
                const detail = await fetchScheduledTransferDetail(row.id);
                detail.rows.forEach((line, idx) => {
                    out.push(detailLineToApprovalTransaction(line, detail.ccy_cd, row.id, idx));
                });
            } catch {
                // Skip this batch silently — the dialog surfaces an
                // empty-state if every fetch fails. Per-row errors
                // shouldn't block the whole dialog from opening.
            }
        }
        return out;
    }, [approvalRows]);

    // Preview the next VO_YYMMDD_NNN when the Request Approval dialog
    // opens. Soft-fail to null if the endpoint is unreachable — the
    // dialog falls back to the raw scdul_pymn_no so submission still
    // works; the authoritative value is stamped at submit.
    useEffect(() => {
        if (!approvalRows) {
            setApprovalDocNo(null);
            return;
        }
        let cancelled = false;
        fetchNextInternalTransferDocNo()
            .then((docNo) => { if (!cancelled) setApprovalDocNo(docNo); })
            .catch(() => { if (!cancelled) setApprovalDocNo(null); });
        return () => { cancelled = true; };
    }, [approvalRows]);

    return (
        <>
            <PaymentScheduledBatchListPage<InternalScheduledRow & PaymentScheduledBatchRow>
                title={t("payment.internal.scheduled_title")}
                rows={rows}
                rowDetailHref={(row) =>
                    `/payment/internal-transfer/scheduled-transfer/${row.id}`
                }
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
                sort={{
                    field: sort.sortField,
                    direction: sort.sortDirection,
                }}
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
                    // Width comes from the live View Setting seed (V217:
                    // PAY_DATE = '150px'). When the API hasn't resolved
                    // yet, fall back to FALLBACK_COLUMNS' PAY_DATE size
                    // (also 150px) so the column never flashes at a
                    // different width on first paint.
                    width:       scheduledDateWidth(vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS) ?? "var(--w-wb-st-schedule-date)",
                    sortFieldId: "PAY_DATE",
                    render: (row) => (
                        <span className="block truncate text-wb-13 font-medium text-wb-ink">
                            {row.scheduleDate || ""}
                        </span>
                    ),
                }}
                onTransferRow={handleTransferRow}
                onDeleteRow={handleDeleteRow}
                onDownloadRow={handleDownloadRow}
                onRequestApproval={handleRequestApproval}
                // Static R/D/T action-permission gates (all true today →
                // unchanged visibility). Hides the CTA / Delete / Transfer
                // affordance when the matching flag is false. See
                // `internalTransferActionPerms` + the TODO above it.
                canRequestApprovalAction={canRequestApproval}
                canDeleteAction={canDeleteScheduledTransfer}
                canTransferAction={canDispatchScheduledTransfer}
                emptyMessage={t("payment.internal.scheduled_empty")}
            />
            {uploadOpen && (
                <InternalTransferUploadDialog
                    key={uploadKey}
                    onClose={() => setUploadOpen(false)}
                    onSaved={() => {
                        // Reset to page 0 so the freshly-uploaded batch
                        // is in view, then bump the refresh key so
                        // `useApiData` re-fires and the new row appears
                        // without a manual reload.
                        setPage(0);
                        setRefreshKey((k) => k + 1);
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
                        try {
                            await vs.save(vsDraft);
                        } finally {
                            closeViewSetting();
                        }
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
                    kind="internal-transfer"
                    selectedRows={approvalRows.map(toApprovalDialogRow)}
                    loadTransactions={loadInternalTransferTransactions}
                    // Preview comes from /next-doc-no so the dialog renders
                    // the friendly VO_YYMMDD_NNN format used by Card
                    // Transactions. Falls back to the batch's existing
                    // doc_no / approvalRef / SCDUL_PYMN_NO when the
                    // preview endpoint is unreachable.
                    documentNo={approvalDocNo ?? approvalRows[0]?.docNo ?? approvalRows[0]?.approvalRef ?? approvalRows[0]?.id ?? "—"}
                    // Read-only: the withdrawal account was chosen at Excel
                    // upload and saved on the batch; not re-selectable here.
                    fixedWithdrawalAccount={withdrawalResolved ?? withdrawalFallback ?? undefined}
                    onClose={() => setApprovalRows(null)}
                    onSubmitted={() => {
                        // Backend endpoint not yet ported — dialog
                        // currently surfaces a "coming soon" warning
                        // on submit, so this callback is reserved for
                        // when the real POST lands. Bumping the
                        // refresh key is correct either way.
                        setApprovalRows(null);
                        setPage(0);
                        setRefreshKey((k) => k + 1);
                    }}
                />
            )}
            {detailsView && (() => {
                // Edit-mode approver slot — mirrors the Approval Box pattern.
                // When the user clicks Edit, the dialog swaps the read-only
                // approver chips for an inline approval-line picker. Save
                // calls the real change-approval-line endpoint; Cancel
                // discards the draft and returns to read-only.
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
                    kind="internal-transfer"
                    title={detailsView.row.approvalTitle || detailsView.row.fileName}
                    status={detailStatusToOutcome(
                        detailsView.detail.appr_stts,
                        detailsView.row.status,
                    )}
                    documentNo={detailsView.detail.doc_no || detailsView.row.id}
                    // Scheduled execution date (PAY_DATE, pre-formatted
                    // `dd-mm-yyyy` on the list row) — mirrors the Approval
                    // Box popup which already shows it, so both entry points
                    // render the same General Information rows.
                    scheduledDate={detailsView.row.scheduleDate}
                    totalAmount={formatAmount(
                        detailsView.detail.total_tran_amt,
                        detailsView.detail.ccy_cd,
                        true,
                    )}
                    withdrawalAccount={{
                        // Internal 8-char bank code — keys the
                        // blocked-chars tooltip on the Remarks header.
                        bankCd: detailsView.detail.out_bank_cd ?? undefined,
                        // Prefer the server-resolved `out_bank_nm` —
                        // populated via the same shared BankCdResolver /
                        // V86 NAPAS-CITAD fallback the per-line deposit
                        // bank cell uses. Falls back to the list-row
                        // `fromBank` (e.g. when an older API build is
                        // serving the request) and finally to the raw
                        // code, so the popup never renders empty.
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
                    // Phase A bridge — see `bridgeApprovers()` below.
                    // The chips render the user's first approval line
                    // with the current approver marked "P" (pending)
                    // and the rest marked "W" (waiting). When the
                    // backend ships the real EXPT_RESOL_MSTR join,
                    // swap the source in `handleApprovalRefClick` — the
                    // dialog rendering is already in place.
                    content={detailsView.detail.cont ?? ""}
                    approvers={detailsView.approvers}
                    attachments={
                        // User-supplied attachments persisted at Request
                        // Approval submit time (V208 + multipart endpoint).
                        // Each chip streams its own binary via the per-file
                        // download endpoint. Empty when the batch has no
                        // approval submission yet or was submitted with zero
                        // files.
                        //
                        // The batch's source Excel (`org_file_nm`) is
                        // intentionally NOT shown here — it is the file the
                        // requestor uploaded to create the transfer, not an
                        // approval attachment. It belongs to the Scheduled
                        // Transfer detail File card, not the Approval Content
                        // attachment list (legacy `comm_0195_001` + Figma
                        // 7503:48575 parity).
                        (detailsView.detail.attachments ?? []).map((a) => ({
                            id:   `attachment-${a.file_id}`,
                            name: a.org_file_nm,
                            size: a.file_size ? formatFileSize(a.file_size) : "",
                            onDownload: () => {
                                if (!detailsView.detail.appr_seq_no) return;
                                void downloadApprovalAttachment(
                                    detailsView.row.id,
                                    detailsView.detail.appr_seq_no,
                                    a.file_id,
                                );
                            },
                        }))
                    }
                    /* Footer "Requested by {name}" = legacy comm_0195_001
                       `data.REG_NM` (the requester's NAME). Prefer the detail's
                       requestor (DRAFT_USER_NM), then the list row's requestor,
                       blank when absent. NEVER reg_id (login/email) — legacy
                       never shows the email here. */
                    requestedBy={detailsView.detail.requestor || detailsView.row.requestor || ""}
                    requestedAt={detailsView.row.dateTime.replace(/\n/g, " ")}
                    onClose={() => {
                        setDetailsView(null);
                        setEditMode(false);
                        setPickedLine(null);
                    }}
                    // Kebab menu (Edit / Delete) — real handlers backed
                    // by the shared `ApprovalBoxFanoutService.withdrawApproval`
                    // + `changeApprovalLine` on the api side. Card
                    // Transactions and Internal Transfer route through
                    // the same shared methods; future Vendor / Expense /
                    // Payroll / Overseas adopt the same pattern. Hidden
                    // while a closed state is active or the user is
                    // already in edit-mode (the footer swaps to Cancel
                    // + Save then).
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
                                  // action === "resubmit" — Internal
                                  // Transfer's resubmit-after-reject is a
                                  // follow-up (re-open upload dialog +
                                  // re-request approval).
                                  dialog.open({
                                      type:        "warning",
                                      title:       t("dialog.warning"),
                                      description: t("approval.action.resubmit_not_implemented"),
                                  });
                              }
                    }
                    // Approve / Reject hide on closed states AND while
                    // in edit-mode (the footer swaps to Cancel + Save).
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

/** Map a list-row {@link ApprovalStatus} onto the dialog's narrower
 *  {@link ApprovalOutcome} vocabulary. `draft` and unknown states
 *  fold into `pending` so the status badge always has a valid token.
 */
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

/** True when the batch's approval is in a final state ("C" approved
 *  or "X" rejected) and further approve / reject actions should be
 *  suppressed. Mirrors the backend's WBE2081 idempotency guard. */
function isFinalApprovalState(apprStts: string | null): boolean {
    return apprStts === "C" || apprStts === "A" || apprStts === "01" || apprStts === "X" || apprStts === "R" || apprStts === "02";
}

/** Resolve the dialog's status badge variant from the master's
 *  freshly-fetched {@code appr_stts} when available, falling back to
 *  the list row's stale projection. Mirrors `deriveStatus` priority
 *  order. */
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
 *  "x.xx KB" / "x.xx MB" suffix that matches the rest of the legacy
 *  WeCMS file-card chrome. Returns the raw value when parsing fails so
 *  the dialog never displays "NaN KB". */
function formatFileSize(bytesStr: string): string {
    const n = Number(bytesStr);
    if (!Number.isFinite(n) || n <= 0) return bytesStr;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Mirror of the V217 SYS_SCR_OPTION_WECMS seed for
 * `payment-internal-transfer-scheduled` / `default`. Used as the
 * paint-time fallback while the API resolves so the table doesn't
 * flash empty. The authoritative config still comes from the
 * backend; this exists only to bridge first-render and to drive
 * column widths until V217 has been applied to the local DB.
 *
 * Aligned with legacy `pymn_0009_001` PROD widths + FIELD_IDs:
 *   FILE_NM (File Name) is a separate column from TITL (Approval
 *   Title); DRAFT_USER_NM replaces REG_ID for the Requestor column;
 *   APPR_DOC_NO replaces APPR_SEQ_NO for the Approval Ref column;
 *   PAY_DATE (Scheduled Date) + APPRVR_NM (Approver) are now
 *   View-Setting-gated rather than always-on.
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "CHECKBOX",       field_nm: "Checkbox",              disp_ord: 0,  disp_yn: "Y", use_yn: "Y", fix_yn: "Y", size: "40px",  sort_yn: "N" },
    { field_id: "REG_DTM",        field_nm: "Date/Time",             disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "105px", sort_yn: "Y" },
    { field_id: "FILE_NM",        field_nm: "File Name",             disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "290px", sort_yn: "Y" },
    { field_id: "TOT_TRNS_CNT",   field_nm: "No. of Transactions",   disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "150px", sort_yn: "Y" },
    { field_id: "TOTAL_TRAN_AMT", field_nm: "Total Transfer Amount", disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "PAY_DATE",       field_nm: "Scheduled Date",        disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "150px", sort_yn: "Y" },
    { field_id: "APPR_STTS",      field_nm: "Approval Status",       disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "170px", sort_yn: "Y" },
    { field_id: "DRAFT_USER_NM",  field_nm: "Requestor",             disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "100px", sort_yn: "Y" },
    { field_id: "APPRVR_NM",      field_nm: "Approver",              disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "175px", sort_yn: "Y" },
    { field_id: "APPR_DOC_NO",    field_nm: "Approval Ref.",         disp_ord: 9,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "150px", sort_yn: "Y" },
    { field_id: "TITL",           field_nm: "Approval Title",        disp_ord: 10, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "250px", sort_yn: "Y" },
    { field_id: "ETC",            field_nm: "",                      disp_ord: 99, disp_yn: "N", use_yn: "Y", fix_yn: "Y", size: "150px", sort_yn: "N" },
];

/**
 * FIELD_ID aliases supplied to `<PaymentScheduledBatchListPage>` so the
 * shell maps each column slot to the legacy V217 FIELD_ID rather than
 * the V131 default (`TITL` for File Name, `REG_ID` for Requestor, …).
 * The shell uses these for both visibility gating AND DB width lookup.
 */
const FIELD_ID_MAP = {
    fileName:      "FILE_NM",
    requestor:     "DRAFT_USER_NM",
    approver:      "APPRVR_NM",
    approvalRef:   "APPR_DOC_NO",
    approvalTitle: "TITL",
} as const;

/** Resolve the PAY_DATE column's DB-driven width from the live View
 *  Setting items so the extraColumn slot matches every other column's
 *  width source. Returns undefined when the seed hasn't shipped a size
 *  value for PAY_DATE — caller falls back to the CSS var. */
function scheduledDateWidth(items: ViewSettingItem[]): string | undefined {
    return items.find((it) => it.field_id === "PAY_DATE")?.size ?? undefined;
}

/**
 * Approval-status filter options. `value` is the legacy `APPR_TYPE_CD`
 * shipped on the wire as `appr_type` (empty = All). Labels are i18n
 * keys resolved by the shared shell at render time. Codes mirror
 * `wabooks.enums.ApprSts` placeholders documented in OQ-1 / feature
 * spec § 7.2 — final code → label mapping is pending PO confirmation.
 */
const APPR_TYPE_OPTIONS = [
    { value: "",   labelKey: "payment.appr_stts.all" },
    { value: "00", labelKey: "payment.appr_stts.not_requested" },
    { value: "04", labelKey: "payment.appr_stts.pending" },
    { value: "03", labelKey: "payment.appr_stts.in_progress" },
    { value: "01", labelKey: "payment.appr_stts.approved" },
    { value: "02", labelKey: "payment.appr_stts.rejected" },
] as const;

/**
 * Per-column FIELD_ID map. Keys are the stable column identifiers the
 * shared shell understands; values are the backend
 * `InternalTransferSortField` enum names (aligned with V217 legacy
 * FIELD_IDs).
 *
 * Sortable today (entity column directly available):
 *   DATE_TIME      → REG_DTM       (ScdulPymnSumr.regDtm)
 *   FILE_NAME      → FILE_NM       (ScdulPymnSumr.orgFileNm)
 *   TXN_COUNT      → TOT_TRNS_CNT  (ScdulPymnSumr.totTrnsCnt)
 *   TOTAL_AMOUNT   → TOTAL_TRAN_AMT(ScdulPymnSumr.totalTranAmt)
 *   STATUS         → APPR_STTS     (ScdulPymnSumr.apprStts, V120 column)
 *   REQUESTOR      → DRAFT_USER_NM (mapped to entity.regId on the wire)
 *   APPROVAL_REF   → APPR_DOC_NO   (mapped to entity.erpFileNum; the
 *                                  resolved doc_no on the wire pulls
 *                                  from a join map — sorting against
 *                                  the entity-side property is the
 *                                  closest single-table path)
 *   APPROVAL_TITLE → TITL          (ScdulPymnSumr.titl)
 *
 * Sortable via the `extraColumn` slot (Scheduled Date):
 *   PAY_DATE → ScdulPymnSumr.payTranDt
 *
 * Deferred (no whitelist entry — header glyph still renders per the
 * seed's sort_yn='Y', but the backend silently falls back to the
 * default ORDER BY):
 *   APPROVER (APPRVR_NM) — requires join to EXPT_RESOL_APPRVR_INFM
 *   for the first-approver display name, same blocker as the Approval
 *   Box module's APPRER_NM.
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

/* ----------------------------------------------------------------------------
 *  Wire row → list-page row adapter
 *
 *  Backend Phase A populates only a subset of the rich Figma mock:
 *  `appr_stts` / `appr_stts_key` / `trnf_stts` / approver are null
 *  until EXPT_RESOL_MSTR + approval-line join land in a follow-up
 *  (backend doc §15.6). Until then those columns render empty, which
 *  matches Figma's "warning row" treatment.
 * -------------------------------------------------------------------------- */

function toListRow(
    api: ScheduledTransferRow,
): InternalScheduledRow & PaymentScheduledBatchRow {
    // Action gating mirrors legacy `pymn_0009_001.createActionButton`
    // (lines 224-264): the Transfer button and the green Check icon are
    // BOTH gated on `APPR_STTS === 'C' || 'A'` (approved). On the
    // refactor wire `appr_stts` may be null until the Phase B EXPT_RESOL
    // join lands — in that interim we accept `trnfYn === 'Y'` as a
    // sufficient proxy for "approved + dispatched" (it can only be 'Y'
    // after approval) and require `apprSeqNo` for the Transfer chip
    // (the row was at least submitted for approval).
    const isApproved =
        api.apprStts === "C" || api.apprStts === "A" || api.apprStts === "01" || api.trnfYn === "Y";
    let action: "transfer" | "complete" | undefined;
    if (isApproved && api.trnfYn === "Y") {
        action = "complete";
    } else if (isApproved && api.trnfYn !== "Y" && api.apprSeqNo) {
        action = "transfer";
    } else {
        action = undefined;
    }

    return {
        id:            api.scdulPymnNo,
        dateTime:      formatRegDtm(api.regDtm),
        fileName:      api.fileNm ?? api.titl,
        txnCount:      Number(api.totTrnsCnt ?? "0") || 0,
        txnCurrency:   api.ccyCd,
        // Ship the raw wire decimal — the shell re-formats via
        // `formatAmount(row.totalAmount, row.txnCurrency, false)` and
        // re-parses with `parseFloat`. Double-formatting through
        // `formatNumber` (vi-VN, `.` thousand sep) caused `100000` to
        // emit `"100.000"` which `parseFloat` then mis-read as `100`,
        // so the row displayed 1000x too small while the footer
        // (single-format from the wire's `total_amount`) showed the
        // correct number.
        totalAmount:   String(api.totalTranAmt ?? "0"),
        // `appr_stts` and the i18n key are null until Phase B — leave
        // status undefined so the shared shell renders the "warning"
        // (no badge) treatment. When the backend ships the resolved
        // status we'll switch on `apprSttsKey` here.
        status:        deriveStatus(api),
        // Requestor = legacy EXPT_RESOL_MSTR.DRAFT_USER_NM (발의자명, the
        // requesting user's display name). Renders BLANK when null — i.e. the
        // batch has no approval request yet (draft) — to match legacy
        // pymn_0009_001 `null2void(DRAFT_USER_NM)`. We do NOT fall back to
        // regId: regId is the creator LOGIN id (email), which legacy never
        // shows in this column.
        requestor:     api.draftUserNm ?? "",
        // First approver's name (legacy APPRVR_NM) — surfaced by the backend
        // from the EXPT_RESOL_APPRVR_INFM chain; blank when the batch has no
        // approval request yet.
        approver:      api.approver ?? "",
        // Total approver count → legacy "[N]" badge + dropdown chevron.
        // The shared shell renders both only when this is non-null, so leave
        // it undefined (not 0) for batches without an approval request.
        approverCount: api.approverCount ?? undefined,
        // Phase 2 — full approval chain (name + status + datetime) for the
        // click popup. The shared shell renders the popup only when this has
        // entries, so siblings (no array) keep the inert chevron.
        approvers:     api.approvers.length > 0 ? api.approvers : undefined,
        approvalRef:   api.apprSeqNo ?? "",
        docNo:         api.docNo ?? null,
        approvalTitle: api.titl,
        action,
        // Drafts (no approval ref) get the amber/warning row tint so
        // they read as "actionable — needs to be submitted for
        // approval". Same `rowHighlight === "warning"` token the
        // shared list shell already understands. Mirrors legacy
        // `pymn_0009_001` mock row 3 + Figma 1:9972 amber treatment.
        rowHighlight:  api.apprSeqNo ? undefined : "warning",
        fromBank:      api.outBankCd,
        fromAccount:   api.wdrlActNo,
        // Row-action flags — legacy `pymn_0009_001.createActionCell`:
        // Delete is gated on `!APPR_SEQ_NO` (not yet submitted for
        // approval). The legacy `PRDT_TYPE !== 'H'` and Delete-permission
        // gates are pending (no product-type wired on the wire yet;
        // permission gate lands with the auth/permission MR).
        canDelete:        !api.apprSeqNo,
        // Download always shows when the batch has an uploaded file.
        canDownloadFile:  Boolean(api.fileNm),
        // Transfer disables when the scheduled pay date is in the
        // future — same yyyyMMdd string compare the legacy uses
        // (`pymn_0009_001.ts:248`).
        transferDisabled: isPayDateInFuture(api.payDate),
        // Schedule Date column — legacy mirror `pymn_0009_001.ts:1162`.
        scheduleDate: formatPayDate(api.payDate),
    };
}

/** `yyyymmdd` → `dd-mm-yyyy` for the Schedule Date column. Blank /
 *  malformed input → empty string so the cell renders cleanly. */
function formatPayDate(raw: string | null | undefined): string {
    if (!raw || raw.length !== 8) return "";
    return `${raw.slice(6, 8)}-${raw.slice(4, 6)}-${raw.slice(0, 4)}`;
}

/**
 * Returns true when `payDate` (yyyyMMdd) is strictly after today's
 * yyyyMMdd. Mirrors legacy `pymn_0009_001.ts:248` — Transfer button
 * grays out until the scheduled date arrives.
 */
function isPayDateInFuture(payDate: string | null | undefined): boolean {
    if (!payDate || payDate.length !== 8) return false;
    const today = (() => {
        const d = new Date();
        return (
            d.getFullYear().toString().padStart(4, "0") +
            (d.getMonth() + 1).toString().padStart(2, "0") +
            d.getDate().toString().padStart(2, "0")
        );
    })();
    return payDate > today;
}

/**
 * `yyyyMMddHHmmss` (14 chars, UTC) → two-line `"DD-MM-YYYY\nHH:mm:ss"`.
 * Matches the mock-row formatting so the shared table cell renders
 * byte-for-byte regardless of source. Falls back to the raw string
 * when the wire value isn't the expected length so we never throw.
 */
function formatRegDtm(raw: string | null | undefined): string {
    return formatRegDtmDisplay(raw);
}

/**
 * Map the wire row's approval state into the list-page badge variant.
 *
 * <p>Priority order:
 * <ol>
 *   <li>{@code apprStts} (server-stamped final outcome from the
 *       approval-action endpoint) — {@code "C"} → approved,
 *       {@code "X"} → rejected, {@code "P"}/{@code "I"} → in progress.</li>
 *   <li>{@code trnfYn === "Y"} — dispatched batch implies the
 *       approval chain finished approved (defence in depth for rows
 *       written before V120 added the APPR_STTS column).</li>
 *   <li>{@code apprSeqNo} non-null — batch was submitted for approval
 *       but no final outcome yet → in progress.</li>
 *   <li>Otherwise undefined (draft) → no badge.</li>
 * </ol>
 */
function deriveStatus(api: ScheduledTransferRow): ApprovalStatus | undefined {
    switch (api.apprStts) {
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
        // Falls through to legacy fallbacks below when apprStts is null
        // (pre-V120 row or a row that hasn't been acted on yet).
    }
    if (api.trnfYn === "Y") return "approved";
    // Legacy / null-apprStts fallback: an apprSeqNo without an explicit
    // APPR_STTS means the batch was submitted but no approver has acted
    // yet — safer to render as Pending than In Progress. Refactor
    // backend now stamps apprStts='P' on Request Approval (see
    // InternalTransferService.stampApproval); this fallback covers
    // legacy rows + pre-V120 imports.
    if (api.apprSeqNo) return "pending";
    return undefined;
}

/**
 * Map a {@link PeriodKey} (+ optional manual range) to the backend
 * {@code from_date / to_date} window. Always ends today for the
 * day-back presets; "manual" returns the page-supplied window verbatim
 * so the user's own choice flows straight to the API. Output format is
 * {@code yyyyMMdd} per the controller's `@RequestParam` contract.
 */
function periodToWindow(
    period: PeriodKey,
    manualRange?: { fromDate: string; toDate: string },
): { fromDate: string; toDate: string } {
    if (period === "manual" && manualRange) {
        return manualRange;
    }
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

/**
 * Map an in-memory list row to the minimal payload the shared
 * `<RequestApprovalDialog>` consumes. The dialog only renders the
 * file name + transaction count + total amount in its details
 * table; everything else (approval line, account, scheduled date)
 * comes from the dialog's own form state.
 */
function toApprovalDialogRow(
    row: InternalScheduledRow & PaymentScheduledBatchRow,
): ApprovalRow {
    return {
        id:          row.id,
        fileName:    row.fileName,
        ccyCd:       row.txnCurrency,
        totalAmount: row.totalAmount,
        txnCount:    row.txnCount,
    };
}

/**
 * Map one wire {@link ApiTransferLineDetail} (real per-line row
 * persisted from the user's Excel upload) onto the shape the shared
 * `<RequestApprovalDialog>` renders.
 *
 * The wire ships a code-only target bank (`tar_bank_cd`) — bank-name
 * resolution lives in a separate Bank table not yet ported, so the
 * "Deposit Bank" cell renders the code with the bank name omitted.
 * When the deposit-leg currency (`depo_ccy_cd`) is null we fall
 * back to the batch's own currency, which is the legacy
 * `pymn_0009_003.ts` rendering rule.
 *
 * The "Reporting Account" cell shows the chart-account code +
 * sequence pair; the human-readable breadcrumb (e.g. "Revenue >
 * Sales") would require a lookup against `CHART_ACCT_INFM` which
 * isn't ported locally yet — left undefined so the muted sub-line
 * doesn't render.
 */
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
        // Bank name now resolved server-side via `BankCdResolver` (see
        // backend `TransferLineDetailMapper`). Falls back to the bank
        // code when the resolver couldn't match the code.
        depositBankName:     line.tar_bank_nm ?? "",
        depositBankCcyCd:    line.depo_ccy_cd ?? line.ccy_cd ?? batchCcy,
        depositAccountNo:    line.finc_mda_no ?? "",
        transferAmount:      formatNumber(line.tran_amt),
        recipientName:       line.rcpt_nm ?? undefined,
        remarks:             line.note ?? undefined,
        description:         line.tran_usag ?? undefined,
        documentNo:          line.doc_no ?? undefined,
        reportingAccount,
        // Ancestor chain (e.g. "EXPENSES > PAYMENT") resolved server-
        // side from `CHART_ACCT_INFM`. The dialog renders it as the
        // muted sub-line under the chart-account code.
        reportingBreadcrumb: line.chart_acct_breadcrumb ?? undefined,
    };
}

/**
 * Phase A bridge from approval-line approvers → dialog chip list.
 *
 * The wire's `ApiScheduledTransferDetailResponse` doesn't yet ship the
 * per-approver outcome list (legacy `REC2` shape with `APPRVR_STTS`
 * per row, populated from the EXPT_RESOL_APPRVR_INFM join). Until
 * that lands, we approximate the chain by reading the user's first
 * approval line and projecting the master's batch-level `appr_stts`
 * onto the first approver:
 *   - master apprStts === "C" → approver[0] = A (approved), rest = W
 *   - master apprStts === "X" → approver[0] = R (rejected), rest = W
 *   - master apprStts null   → approver[0] = P (pending), rest = W
 *
 * This is honest as a Phase A demo: the names + order are real (they
 * come from the user's approval-line config) and the first approver's
 * outcome matches the actual batch state, so a re-opened dialog after
 * Approve / Reject reflects the action. The remaining approvers stay
 * "W" — the legacy intermediate-state chain ("approver 1 has approved,
 * approver 2 is pending") is the part that needs the EXPT_RESOL join
 * to be faithful, so we don't simulate it.
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
    // Only A / R chips render a date — when the first approver acted,
    // the master's modDtm reflects that timestamp. Pending / Waiting
    // chips leave actedAt undefined so the locale verb renders without
    // the date suffix.
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
