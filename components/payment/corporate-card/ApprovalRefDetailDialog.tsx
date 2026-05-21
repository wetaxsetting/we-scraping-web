"use client";

import { useMemo, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import { userStorage } from "@/lib/auth/storage";
import ApprovalDetailsDialog from "@/components/payment/shared/ApprovalDetailsDialog";
import type {
    ApprovalDetailsApprover,
    ApprovalOutcome,
} from "@/components/payment/shared/ApprovalDetailsDialog";
import type { RequestApprovalTransaction } from "@/components/payment/shared/RequestApprovalDialog";
import {
    approveApprovalBoxRow,
    fetchApprovalBoxList,
    rejectApprovalBoxRow,
    ApprovalBoxApiError,
} from "@/lib/api/approval-box";
import {
    changeCardApprovalLine,
    withdrawCardApproval,
} from "@/lib/api/cardTransactions";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";

import EditApprovalLinePicker from "./EditApprovalLinePicker";
import type { EditApprovalLinePreview } from "./EditApprovalLinePicker";
import type { CardTransaction } from "./cardTransactionMappers";

type ApprovalRefDetailDialogProps = {
    open:       boolean;
    onClose:    () => void;
    /** {@code CARD_TRNS_HSTR.APPR_SEQ_NO} the cell was clicked on.
     *  Used to filter the Approval Box list endpoint down to the
     *  master row + filter the page's current card rows down to the
     *  transactions that share this apprSeqNo. */
    apprSeqNo:  string | null;
    /** The card rows currently rendered on the page — used to build
     *  the Transaction Details grid without an extra fetch. */
    rows:       CardTransaction[];
    /** Fires after a successful Approve or Reject action. The parent
     *  refreshes the ledger so the row's status / approval-requested
     *  tile reflect the new state. */
    onActed?:   () => void;
};

/** Wide date window — the Approval Box list endpoint requires a
 *  range, so we span the refactor's whole live period. */
const FROM_DT = "20200101";

/**
 * Approval Ref detail popup — opens when the user clicks the Approval
 * Ref cell on the Card Transactions table. Mirrors legacy
 * {@code card_0001_001.ts:191} (`approRefDetail` click handler) which
 * opens {@code comm_0195_001.act} with the picked {@code POST_SEQ_NO}.
 *
 * <p>Uses the **shared** {@link ApprovalDetailsDialog} with
 * {@code kind="card"} so the chrome reads identical to the Expense /
 * Vendor / Internal Transfer / Payroll / Overseas Approval Details
 * popups. Two data sources feed the dialog:
 *
 * <ul>
 *   <li>The Approval Box list endpoint filtered by {@code apprSeqNo}
 *       → title, status badge, approvers, requestor, total.</li>
 *   <li>The page's current card rows filtered by {@code apprSeqNo}
 *       → the per-card Transaction Details grid (no extra fetch).</li>
 * </ul>
 */
export default function ApprovalRefDetailDialog({
    open,
    onClose,
    apprSeqNo,
    rows,
    onActed,
}: ApprovalRefDetailDialogProps) {
    const { t } = useTranslation();
    const sysDialog = useDialog();
    const seq = apprSeqNo ?? "";
    const today = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    }, []);

    const state = useApiData(
        () =>
            !open || !seq
                ? Promise.resolve(null)
                : fetchApprovalBoxList({
                      fromDate:  FROM_DT,
                      toDate:    today,
                      srchWd:    seq,
                      page:      0,
                      size:      5,
                  }),
        [open, seq, today],
    );

    const apiRow = state.data?.list.find((r) => r.appr_seq_no === seq) ?? null;

    // Transaction Details — every card row from the current page that
    // shares this apprSeqNo. Avoids a second backend round-trip; the
    // page already has the data in memory.
    const transactions: RequestApprovalTransaction[] = useMemo(() => {
        if (!seq) return [];
        return rows
            .filter((r) => r.apprSeqNo === seq)
            .map<RequestApprovalTransaction>((r) => ({
                id:                  r.cardSeqNo,
                depositBankCode:     r.bankCd,
                depositBankName:     r.bankNm,
                depositBankCcyCd:    r.ccyCd,
                depositAccountNo:    r.cardNo,
                transferAmount:      r.trscAmt,
                // Legacy `comm_0195_001.ts:1511` renders MERCH_NM as the
                // Name column on the 4-column card read-only table.
                recipientName:       r.merchNm ?? "",
                // CARD_TRNS_USAGE_NM column @ legacy
                // `comm_0195_001.ts:1513`. Wire currently ships only
                // the code; render that until the backend adds the
                // resolved name (`card_trns_usage_nm` Phase B field).
                purpose:             r.cardTrnsUsageCode ?? "",
                description:         r.description ?? "",
                reportingAccount:    r.chartAcctCd ?? "",
            }));
    }, [rows, seq]);

    // All hooks MUST run before the early-return below — moving them
    // below the conditional changes hook order between renders (open →
    // closed), which violates the Rules of Hooks.
    const [editMode, setEditMode]         = useState(false);
    const [pickedLine, setPickedLine]     = useState<EditApprovalLinePreview | null>(null);
    const [savingEdit, setSavingEdit]     = useState(false);

    if (!open || !seq) return null;

    // Approval Box row resolved → use real data. Falls back to a
    // minimal "stub" view if the search comes back empty (e.g. the
    // approval was deleted or rolled out of the lookup window).
    const approvers: ApprovalDetailsApprover[] = apiRow
        ? apiRow.approvers.map((a) => ({
              seq:      a.apprvr_line_no,
              id:       a.apprvr_id, // drives the "(You)" suffix in the chip
              name:     a.apprvr_nm,
              outcome:  a.apprvr_stts, // raw legacy code accepted
              actedAt:  formatDtm14(a.appr_dtm),
          }))
        : [];

    const status: ApprovalOutcome = apiRow
        ? mapStatus(apiRow.appr_stts)
        : "pending";

    // Active approver = the one whose turn it currently is (status 'P').
    // Legacy `comm_0195_001.ts:928-931` shows Approve / Reject only when
    // the backend ships `APPR_YN == "Y"` — i.e. the current user IS the
    // active approver. Compute the same gate client-side from the
    // approver chain so non-approvers don't see actionable buttons.
    const currentUserId   = userStorage.get()?.userId ?? "";
    const activeApprover  = apiRow?.approvers.find((a) => a.apprvr_stts === "P") ?? null;
    const isActiveApprover = !!activeApprover && activeApprover.apprvr_id === currentUserId;
    const isInProgress    = apiRow != null
        && (apiRow.appr_stts === "P" || apiRow.appr_stts === "I");
    const canActOnApproval = isInProgress && isActiveApprover;

    /** Edit / Delete kebab actions — legacy `comm_0195_001.ts:915-920`
     *  requires (a) status is still Pending / In Progress and (b) the
     *  viewer is the original requestor (REG_ID == _user_id). The legacy
     *  also opens the menu for an `_isAdmin` user; the refactor has no
     *  admin override yet, so requestor-only is the conservative gate. */
    const isRequestor = apiRow != null
        && apiRow.draft_user_id === currentUserId;
    const isMutable = isInProgress && isRequestor;

    const handleMenuAction = (action: "edit" | "withdraw" | "resubmit") => {
        if (action === "edit") {
            setPickedLine(null);
            setEditMode(true);
            return;
        }
        if (action === "withdraw") {
            // Confirm before destructive op. Mirrors legacy
            // `comm_0195_001.ts:402-417` (`WBC1162` confirmation).
            sysDialog.open({
                type:        "confirmation",
                title:       t("dialog.confirmation"),
                description: t("payment.card.approval_detail.confirm_delete", {
                    defaultValue: "Are you sure you want to delete this approval request?",
                }),
                confirmText: t("dialog.continue"),
                cancelText:  t("dialog.cancel"),
                onConfirm:   handleWithdrawConfirmed,
            });
        }
    };

    const handleWithdrawConfirmed = async () => {
        if (!seq) return;
        try {
            await withdrawCardApproval(seq);
            sysDialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("payment.card.approval_detail.delete_success", {
                    defaultValue: "Approval request deleted.",
                }),
            });
            onActed?.();
            onClose();
        } catch (err) {
            const code    = err instanceof ApprovalBoxApiError ? err.code    : "WBE9999";
            const message = err instanceof ApprovalBoxApiError ? err.message : "Failed to delete";
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        }
    };

    const handleEditSave = async () => {
        if (!seq || !pickedLine) return;
        setSavingEdit(true);
        try {
            await changeCardApprovalLine(seq, pickedLine.apprLineNo);
            setEditMode(false);
            setPickedLine(null);
            sysDialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("payment.card.approval_detail.edit_success", {
                    defaultValue: "Approval line updated.",
                }),
            });
            onActed?.();
            onClose();
        } catch (err) {
            const code    = err instanceof ApprovalBoxApiError ? err.code    : "WBE9999";
            const message = err instanceof ApprovalBoxApiError ? err.message : "Failed to update approval line";
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        } finally {
            setSavingEdit(false);
        }
    };

    const handleEditCancel = () => {
        setEditMode(false);
        setPickedLine(null);
    };

    const handleApprove = async () => {
        if (!seq) return;
        try {
            await approveApprovalBoxRow(seq);
            sysDialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("approval.approved_success", {
                    defaultValue: "Approval submitted.",
                }),
            });
            onActed?.();
            onClose();
        } catch (err) {
            const code = err instanceof ApprovalBoxApiError ? err.code : "WBE9999";
            const message = err instanceof ApprovalBoxApiError ? err.message : "Failed to approve";
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        }
    };

    const handleReject = async () => {
        if (!seq) return;
        try {
            await rejectApprovalBoxRow(seq);
            sysDialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("approval.rejected_success", {
                    defaultValue: "Rejection submitted.",
                }),
            });
            onActed?.();
            onClose();
        } catch (err) {
            const code = err instanceof ApprovalBoxApiError ? err.code : "WBE9999";
            const message = err instanceof ApprovalBoxApiError ? err.message : "Failed to reject";
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        }
    };

    const title         = apiRow?.title || t("payment.card.approval_detail.title");
    const documentNo    = apiRow?.doc_no || seq;
    const scheduledDate = formatDate8(apiRow?.pay_date ?? null);
    const totalAmount   = apiRow
        ? `${Number(apiRow.tot_pay_amt).toLocaleString("vi-VN")} ${apiRow.currency}`
        : "";
    const requestedBy   = apiRow ? `${apiRow.draft_user_nm} (${apiRow.draft_user_id})` : "";
    const requestedAt   = formatDtm14(apiRow?.reg_dtm ?? null);

    // Edit mode — the Approver row swaps its chip list for the
    // inline "Select approval line" dropdown + a live preview of the
    // newly-picked chain. Mirrors Figma frame for the kebab → Edit
    // flow (no stacked dialog; the picker lives inside the popup).
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
            kind="card"
            title={title}
            status={status}
            documentNo={documentNo}
            scheduledDate={scheduledDate}
            totalAmount={totalAmount}
            content={apiRow?.cont ?? undefined}
            transactions={transactions}
            approvers={approvers}
            requestedBy={requestedBy}
            requestedAt={requestedAt}
            onClose={onClose}
            onApprove={canActOnApproval && !editMode ? handleApprove : undefined}
            onReject={canActOnApproval && !editMode ? handleReject : undefined}
            onMenuAction={isMutable && !editMode ? handleMenuAction : undefined}
            editMode={editMode}
            editApproverSlot={editApproverSlot}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
            editSaveDisabled={pickedLine == null || savingEdit}
        />
    );
}

/** Approval Box `appr_stts` → shared `ApprovalOutcome`. */
function mapStatus(s: "A" | "I" | "P" | "R" | "C" | "X"): ApprovalOutcome {
    switch (s) {
        case "A":
        case "C": return "approved";
        case "X":
        case "R": return "rejected";
        case "I": return "in_progress";
        case "P":
        default:  return "pending";
    }
}

/** {@code yyyyMMdd} → {@code DD-MM-YYYY}. Empty when null. */
function formatDate8(value: string | null): string {
    if (!value || value.length !== 8) return "";
    return `${value.slice(6, 8)}-${value.slice(4, 6)}-${value.slice(0, 4)}`;
}

/** {@code yyyyMMddHHmmss} → {@code DD-MM-YYYY HH:mm}. Empty when null. */
function formatDtm14(value: string | null): string {
    if (!value || value.length < 12) return "";
    const date = `${value.slice(6, 8)}-${value.slice(4, 6)}-${value.slice(0, 4)}`;
    const time = `${value.slice(8, 10)}:${value.slice(10, 12)}`;
    return `${date} ${time}`;
}
