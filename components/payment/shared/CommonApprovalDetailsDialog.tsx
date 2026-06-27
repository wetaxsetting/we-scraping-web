"use client";

import { useEffect, useState } from "react";

import ApprovalDetailsDialog, {
    canActOnApproval,
    isFinalApprovalState,
    type ApprovalDetailsApprover,
    type ApprovalDetailsAttachment,
    type ApprovalDetailsEditPayload,
    type ApprovalOutcome,
} from "@/components/payment/shared/ApprovalDetailsDialog";
import EditApprovalLinePicker, {
    type EditApprovalLinePreview,
} from "@/components/payment/corporate-card/EditApprovalLinePicker";
import type { RequestApprovalKind, RequestApprovalTransaction } from "@/components/payment/shared/RequestApprovalDialog";
import { cardRowToApprovalTransaction } from "@/components/payment/corporate-card/cardTransactionMappers";
import { useDialog } from "@/components/shared/dialog";
import {
    ApprovalBoxApiError,
    approveApprovalBoxRow,
    downloadApprovalBoxAttachment,
    editApproval,
    fetchApprovalAttachments,
    fetchApprovalDetailMaster,
    fetchApprovalTransactionsByApproval,
    rejectApprovalBoxRow,
    withdrawApprovalBoxRow,
} from "@/lib/api/approvalBox";
import { ApiCallError } from "@/lib/api/banking";
import { formatAmount } from "@/lib/currency";
import {
    editCardApproval,
    fetchCardTransactionsByApproval,
    withdrawCardApproval,
} from "@/lib/api/cardTransactions";
import { useApiData } from "@/lib/api/useApiData";
import { userStorage } from "@/lib/auth/storage";
import { formatDateLang, formatUtcDtmByLanguage } from "@/lib/datetime";
import { useTranslation, type Locale } from "@/lib/i18n";
import { resolvePayrollTypeLabel } from "@/lib/payment/payrollType";
import type { ApiApprovalTransactionRow } from "@/lib/types/api";
import { formatFileSize } from "@/lib/utils";

/*
 * Common Approval Details popup — the single reusable data-loading wrapper
 * around the presentational <ApprovalDetailsDialog>. The refactor equivalent
 * of legacy `comm_0195_001.act`; openable from any entry point:
 *   - Notification bell (legacy `comm_0192_007 fn_readOneCommNoti`) — passes
 *     `postSeqNo` (+ `bltbCd`), the legacy-safe identity.
 *   - Approval Box / Card Approval-Ref — pass `apprSeqNo` directly.
 *
 * Identity resolution + the master read live behind `fetchApprovalDetailMaster`
 * (`GET /api/v1/payment/approval-box/detail`), which accepts either identity
 * and resolves `POST_SEQ_NO` → `APPR_SEQ_NO` server-side. The resolved
 * `appr_seq_no` from the master row then keys the transaction + attachment
 * loads and the Approve/Reject actions.
 *
 * It is a full-screen Radix dialog (portal-rendered) so it overlays whatever
 * page the user is on WITHOUT navigating — the active top menu never changes.
 */

/** Legacy `APPR_DV` digit → shared dialog `kind` (stable codes; the English
 *  label in NOTI_JSON is not authoritative). */
const APPR_DV_TO_KIND: Record<string, RequestApprovalKind> = {
    "21": "payroll",
    "31": "expense-payment",
    "32": "vendor-payment",
    "33": "card",
    "34": "overseas-payment",
    "35": "internal-transfer",
};

type Props = {
    /** Direct approval sequence — used by Approval Box / card entry points. */
    apprSeqNo?: string | null;
    /** Bulletin post sequence from a notification's `noti_json` (legacy-safe). */
    postSeqNo?: string | null;
    /** Bulletin board code from `noti_json`; backend defaults it when absent. */
    bltbCd?: string | null;
    onClose: () => void;
};

export default function CommonApprovalDetailsDialog({ apprSeqNo, postSeqNo, bltbCd, onClose }: Props) {
    const { t, locale } = useTranslation();
    const sysDialog = useDialog();

    // Master row — resolved by apprSeqNo OR postSeqNo (+bltbCd). Throws
    // WBE_APPROVAL_DETAIL_NOT_FOUND for a missing / withdrawn approval.
    const state = useApiData(
        () => fetchApprovalDetailMaster({ apprSeqNo, postSeqNo, bltbCd }),
        [apprSeqNo, postSeqNo, bltbCd],
    );
    const row = state.data ?? null;
    const resolvedApprSeqNo = row?.appr_seq_no ?? null;
    const kind: RequestApprovalKind | null = row ? (APPR_DV_TO_KIND[row.appr_dv] ?? "internal-transfer") : null;

    // Transaction lines — card via the existing card-by-approval path; the
    // four scheduled kinds via the generic by-approval endpoint. Both degrade
    // to [] on error so the popup shows its empty state. Re-fires once the
    // master row resolves the kind.
    const txState = useApiData<RequestApprovalTransaction[]>(
        () => {
            if (!resolvedApprSeqNo || !kind) return Promise.resolve([]);
            if (kind === "card") {
                return fetchCardTransactionsByApproval(resolvedApprSeqNo).then((rows) =>
                    rows.map(cardRowToApprovalTransaction),
                );
            }
            return fetchApprovalTransactionsByApproval(resolvedApprSeqNo).then((rows) =>
                rows.map((tx) => apiTxToRequestApprovalTransaction(tx, row?.currency ?? "")),
            );
        },
        [resolvedApprSeqNo, row?.appr_dv],
    );

    const attState = useApiData(
        () => (resolvedApprSeqNo ? fetchApprovalAttachments(resolvedApprSeqNo) : Promise.resolve([])),
        [resolvedApprSeqNo],
    );

    // Master load failed (missing / withdrawn / other-tenant) → safe message
    // + close, never a redirect. Effect so it doesn't fire during render.
    useEffect(() => {
        if (state.loading) return;
        if (state.error) {
            sysDialog.open({
                type: "error",
                title: t("dialog.error"),
                description:
                    state.error instanceof ApprovalBoxApiError
                        ? state.error.message
                        : t("notification.approval_load_error"),
                errorCode: state.error instanceof ApprovalBoxApiError ? state.error.code : undefined,
            });
            onClose();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.loading, state.error]);

    // Edit-mode (Change Approval Line) + Withdraw — the kebab actions the
    // shared popup must support to fully replace the per-type inline renders.
    // Both route through the apprSeqNo-keyed approval-box endpoints (NON-CARD;
    // card keeps its dedicated card endpoints until its Phase 3 migration).
    const [editMode, setEditMode] = useState(false);
    const [pickedLine, setPickedLine] = useState<EditApprovalLinePreview | null>(null);
    const [acting, setActing] = useState(false);

    if (!row || !resolvedApprSeqNo) return null;

    const status: ApprovalOutcome = mapStatus(row.appr_stts);
    const approvers: ApprovalDetailsApprover[] = row.approvers.map((a) => ({
        seq: a.apprvr_line_no,
        id: a.apprvr_id,
        name: a.apprvr_nm,
        outcome: a.apprvr_stts,
        actedAt: formatDtm14(a.appr_dtm, locale),
    }));

    const attachments: ApprovalDetailsAttachment[] = (attState.data ?? []).map((a) => ({
        id: `${a.file_type ?? "EXPT_RESOL_FILE"}:${a.file_id}`,
        name: a.org_file_nm,
        size: a.file_size ? formatFileSize(a.file_size) : "",
        // file_id + file_type drive the legacy REC4 delete on edit-save.
        fileId: a.file_id,
        fileType: a.file_type ?? "EXPT_RESOL_FILE",
        onDownload: () => {
            void downloadApprovalBoxAttachment(resolvedApprSeqNo, a.file_id, a.file_type);
        },
    }));

    // Approve / Reject gate — legacy `APPR_YN`: shown only to the current
    // ACTIVE (first-pending) approver. Uses the shared `canActOnApproval`
    // helper (the single legacy-parity rule across all six payment types):
    // first-pending-approver match + defensive non-final guard.
    const storedUser = userStorage.get();
    const currentUserId = storedUser?.userId ?? "";
    const canAct = canActOnApproval(approvers, currentUserId, row.appr_stts);

    const handleApprove = async () => {
        try {
            await approveApprovalBoxRow(resolvedApprSeqNo);
            sysDialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("approval.approved_success"),
            });
            onClose();
        } catch (err) {
            sysDialog.open({
                type: "error",
                title: t("dialog.error"),
                description: err instanceof ApprovalBoxApiError ? err.message : t("notification.approval_load_error"),
                errorCode: err instanceof ApprovalBoxApiError ? err.code : undefined,
            });
        }
    };

    const handleReject = async () => {
        try {
            await rejectApprovalBoxRow(resolvedApprSeqNo);
            sysDialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("approval.rejected_success"),
            });
            onClose();
        } catch (err) {
            sysDialog.open({
                type: "error",
                title: t("dialog.error"),
                description: err instanceof ApprovalBoxApiError ? err.message : t("notification.approval_load_error"),
                errorCode: err instanceof ApprovalBoxApiError ? err.code : undefined,
            });
        }
    };

    // Withdraw the approval (kebab → Delete). Per-kind dispatch: CARD uses its
    // dedicated endpoint (which also un-stamps CARD_TRNS_HSTR — the one piece of
    // card-specific work the generic withdraw does NOT do); every other type
    // uses the generic apprSeqNo-keyed withdraw. Both delete the EXPT_RESOL
    // master + approver chain and clear the source-table stamp.
    const handleWithdraw = async () => {
        if (acting) return;
        setActing(true);
        try {
            if (kind === "card") {
                await withdrawCardApproval(resolvedApprSeqNo);
            } else {
                await withdrawApprovalBoxRow(resolvedApprSeqNo);
            }
            sysDialog.open({ type: "success", title: t("dialog.success"), description: t("approval.action.delete_success") });
            onClose();
        } catch (err) {
            sysDialog.open({
                type: "error",
                title: t("dialog.error"),
                description: err instanceof ApiCallError ? err.message : t("approval.action.delete_failed"),
                errorCode: err instanceof ApiCallError ? err.code : undefined,
            });
        } finally {
            setActing(false);
        }
    };

    // Edit-mode → Save (Continue). Mirrors legacy comm_0192_013_u002: one
    // multipart call persists title + content + added/removed attachments and —
    // when the user picked a new approval line — rotates the approver chain.
    // Per-kind dispatch: CARD uses its dedicated edit endpoint (card audit slug);
    // every other type uses the generic apprSeqNo-keyed Approval Box edit. The
    // edit surface is the shared EXPT_RESOL_* tables, so the payload is identical.
    const handleEditSave = async (payload: ApprovalDetailsEditPayload) => {
        if (acting) return;
        setActing(true);
        try {
            const body = {
                title: payload.title,
                cont: payload.content,
                appr_line_no: pickedLine ? pickedLine.apprLineNo : null,
                deleted_attachments: payload.removedAttachments.map((r) => ({
                    file_id: r.fileId,
                    file_type: r.fileType,
                })),
            };
            if (kind === "card") {
                await editCardApproval(resolvedApprSeqNo, body, payload.newFiles);
            } else {
                await editApproval(resolvedApprSeqNo, body, payload.newFiles);
            }
            sysDialog.open({ type: "success", title: t("dialog.success"), description: t("approval.action.edit_success") });
            onClose();
        } catch (err) {
            sysDialog.open({
                type: "error",
                title: t("dialog.error"),
                description: err instanceof ApiCallError ? err.message : t("approval.action.edit_failed"),
                errorCode: err instanceof ApiCallError ? err.code : undefined,
            });
        } finally {
            setActing(false);
        }
    };

    const handleMenuAction = (action: "edit" | "withdraw" | "resubmit") => {
        if (action === "edit") {
            setPickedLine(null);
            setEditMode(true);
            return;
        }
        if (action === "withdraw") {
            sysDialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("approval.action.confirm_delete"),
                confirmText: t("dialog.continue"),
                cancelText: t("dialog.cancel"),
                onConfirm: handleWithdraw,
            });
            return;
        }
        // resubmit-after-reject — follow-up (re-open upload + re-request); same
        // not-implemented notice the per-type pages show.
        sysDialog.open({ type: "warning", title: t("dialog.warning"), description: t("approval.action.resubmit_not_implemented") });
    };

    // Payroll Type (kind === payroll only) — resolved label from APPR_FUND_TP +
    // the BANK_CD 11704088 override, identical to Approval Box / Payroll Scheduled.
    const payrollType = kind === "payroll"
        ? resolvePayrollTypeLabel(row.appr_fund_tp, row.out_bank_cd, t)
        : undefined;

    // Kebab (Edit / Delete) — handler wiring is available for every type (card
    // included) when the approval is non-final and not mid-edit. Per-kind
    // dispatch inside handleWithdraw / handleEditSave routes card to its
    // dedicated endpoints. The DIALOG is the single visibility gate: it renders
    // the kebab ONLY while the master status is Pending (legacy comm_0195_001),
    // so In Progress / Approved / Rejected never expose Edit/Delete.
    //
    // Legacy requestor/admin gate (comm_0195_001.ts:913-926): non-admins see
    // Edit/Delete only when they are the requestor (REG_ID == _user_id);
    // admins (loginUser.isAdmin()) always see them. REG_ID maps to the wire's
    // draft_user_id; admin maps to StoredUser.role === "ADMIN". Same rule for
    // every type, Corporate Card included (no card-specific exception).
    const isAdmin = storedUser?.role === "ADMIN";
    const isRequestor = !!row.draft_user_id && row.draft_user_id === currentUserId;
    const canEdit =
        !isFinalApprovalState(row.appr_stts)
        && !editMode
        && !acting
        && (isAdmin || isRequestor);

    return (
        <ApprovalDetailsDialog
            kind={kind ?? "internal-transfer"}
            title={row.title || t("payment.approval_details.title")}
            status={status}
            documentNo={row.doc_no}
            scheduledDate={formatDateLang(row.pay_date, locale)}
            totalAmount={`${formatAmount(row.tot_pay_amt, row.currency, false)} ${row.currency}`}
            currency={row.currency}
            // Withdrawal Bank/Account No. — server-resolved from the sibling
            // SCDUL_PYMN_SUMR batch on the detail read, so this entry point
            // (Result page / notification / card-ref) shows the same row as the
            // per-type Scheduled detail. The dialog skips the row for card.
            withdrawalAccount={
                row.out_bank_cd || row.wdrl_act_no
                    ? {
                          bankCd: row.out_bank_cd ?? undefined,
                          bankNm: row.out_bank_nm || row.out_bank_cd || "",
                          acctNo: row.wdrl_act_no ?? "",
                          ccyCd:  row.wdrl_ccy_cd ?? row.currency,
                      }
                    : undefined
            }
            payrollType={payrollType}
            content={row.cont ?? undefined}
            transactions={txState.data ?? []}
            approvers={approvers}
            attachments={attachments}
            // Footer "Requested by {name} on {date}" — name only (DRAFT_USER_NM),
            // never the id/email, and the full yyyyMMddHHmmss timestamp with
            // seconds, matching the per-type Scheduled detail + legacy
            // comm_0195_001 footer.
            requestedBy={row.draft_user_nm}
            requestedAt={formatDtm14Seconds(row.reg_dtm, locale) ?? ""}
            onClose={onClose}
            onApprove={canAct && !editMode && !acting ? handleApprove : undefined}
            onReject={canAct && !editMode && !acting ? handleReject : undefined}
            // Kebab (Edit / Delete) — legacy comm_0195_001 exposes these on the
            // same shared popup for every type (card included). The dialog gates
            // the render to Pending only; this just supplies the handler.
            onMenuAction={canEdit ? handleMenuAction : undefined}
            editMode={editMode}
            editApproverSlot={
                <EditApprovalLinePicker
                    value={pickedLine?.apprLineNo ?? null}
                    onPick={setPickedLine}
                />
            }
            // Picked-line preview — the dialog swaps the approver chips + count
            // to this chain the moment a new line is chosen (legacy: a new line
            // resets the chain → first approver Pending, the rest Waiting).
            // Null until a line is picked, so the original chain shows first.
            editPreviewApprovers={
                pickedLine
                    ? pickedLine.approvers.map((a, i) => ({
                          seq:     i + 1,
                          id:      a.apprvrId,
                          name:    a.apprvrNm,
                          outcome: i === 0 ? "P" : "W",
                      }))
                    : null
            }
            onEditSave={handleEditSave}
            onEditCancel={() => { setEditMode(false); setPickedLine(null); }}
            // Continue is enabled whenever editing (title / content / attachments
            // are all editable now) — only blocked while a save is in flight.
            // Picking a new approval line is optional (legacy parity).
            editSaveDisabled={acting}
        />
    );
}

/** Wire `ApiApprovalTransactionRow` → shared `RequestApprovalTransaction`.
 *  Amount is formatted here (frontend owns locale/currency formatting,
 *  mirroring `cardRowToApprovalTransaction`). */
function apiTxToRequestApprovalTransaction(tx: ApiApprovalTransactionRow, batchCcy: string): RequestApprovalTransaction {
    return {
        id: tx.id,
        depositBankCode: tx.deposit_bank_code ?? "",
        depositBankName: tx.deposit_bank_name ?? tx.deposit_bank_code ?? "",
        depositBankCcyCd: tx.deposit_bank_ccy_cd ?? "",
        depositAccountNo: tx.deposit_account_no ?? "",
        transferAmount: tx.amount ? formatAmount(tx.amount, batchCcy, false) : "",
        recipientName: tx.recipient_name ?? undefined,
        remarks: tx.remarks ?? undefined,
        contactName: tx.contact_name ?? undefined,
        description: tx.description ?? undefined,
        documentNo: tx.document_no ?? undefined,
        reportingAccount: tx.reporting_account ?? undefined,
        reportingBreadcrumb: tx.reporting_breadcrumb ?? undefined,
    };
}

/** Approval Box `appr_stts` → shared `ApprovalOutcome`. */
function mapStatus(s: "P" | "I" | "C" | "R" | "A" | "X"): ApprovalOutcome {
    switch (s) {
        case "A":
        case "C":
            return "approved";
        case "X":
        case "R":
            return "rejected";
        case "I":
            return "in_progress";
        case "P":
        default:
            return "pending";
    }
}


/**
 * `yyyyMMddHHmmss` (UTC) → `<localized date> HH:mm:ss`; undefined when
 * null/short. APPR_DTM is stored UTC (`OffsetDateTime.now(ZoneOffset.UTC)`
 * in ApprovalBoxService), so it is converted to Vietnam local AND formatted
 * per active language (EN dd-MMM-yyyy / KO yyyy-MM-dd / VI dd-MM-yyyy).
 */
function formatDtm14(value: string | null, locale: Locale): string | undefined {
    if (!value || value.length < 12) return undefined;
    const { date, time } = formatUtcDtmByLanguage(value, locale);
    return date ? `${date} ${time}` : undefined;
}

/** Same as {@link formatDtm14} — REG_DTM is also UTC. Retained as a separate
 *  name for the "Requested by … on …" footer call site; both now render the
 *  full localized timestamp with seconds. */
function formatDtm14Seconds(value: string | null, locale: Locale): string | undefined {
    return formatDtm14(value, locale);
}
