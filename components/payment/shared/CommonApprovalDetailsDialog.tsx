"use client";

import { useEffect } from "react";

import ApprovalDetailsDialog, {
    type ApprovalDetailsApprover,
    type ApprovalDetailsAttachment,
    type ApprovalOutcome,
} from "@/components/payment/shared/ApprovalDetailsDialog";
import type { RequestApprovalKind, RequestApprovalTransaction } from "@/components/payment/shared/RequestApprovalDialog";
import { cardRowToApprovalTransaction } from "@/components/payment/corporate-card/cardTransactionMappers";
import { useDialog } from "@/components/shared/dialog";
import {
    ApprovalBoxApiError,
    approveApprovalBoxRow,
    downloadApprovalBoxAttachment,
    fetchApprovalAttachments,
    fetchApprovalDetailMaster,
    fetchApprovalTransactionsByApproval,
    rejectApprovalBoxRow,
} from "@/lib/api/approval-box";
import { fetchCardTransactionsByApproval } from "@/lib/api/cardTransactions";
import { useApiData } from "@/lib/api/useApiData";
import { userStorage } from "@/lib/auth/storage";
import { useTranslation } from "@/lib/i18n";
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
    const { t } = useTranslation();
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
                rows.map(apiTxToRequestApprovalTransaction),
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

    if (!row || !resolvedApprSeqNo) return null;

    const status: ApprovalOutcome = mapStatus(row.appr_stts);
    const approvers: ApprovalDetailsApprover[] = row.approvers.map((a) => ({
        seq: a.apprvr_line_no,
        id: a.apprvr_id,
        name: a.apprvr_nm,
        outcome: a.apprvr_stts,
        actedAt: formatDtm14(a.appr_dtm),
    }));

    const attachments: ApprovalDetailsAttachment[] = (attState.data ?? []).map((a) => ({
        id: `${a.file_type ?? "EXPT_RESOL_FILE"}:${a.file_id}`,
        name: a.org_file_nm,
        size: a.file_size ? formatFileSize(a.file_size) : "",
        onDownload: () => {
            void downloadApprovalBoxAttachment(resolvedApprSeqNo, a.file_id, a.file_type);
        },
    }));

    // Approve / Reject gate — legacy `APPR_YN`: only the current ACTIVE
    // (first-pending) approver may act, and only while in progress.
    const currentUserId = userStorage.get()?.userId ?? "";
    const activeApprover = row.approvers.find((a) => a.apprvr_stts === "P") ?? null;
    const canAct =
        !!activeApprover &&
        activeApprover.apprvr_id === currentUserId &&
        (row.appr_stts === "P" || row.appr_stts === "I");

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

    return (
        <ApprovalDetailsDialog
            kind={kind ?? "internal-transfer"}
            title={row.title || t("payment.approval_details.title")}
            status={status}
            documentNo={row.doc_no}
            scheduledDate={formatDate8(row.pay_date)}
            totalAmount={`${Number(row.tot_pay_amt).toLocaleString("vi-VN")} ${row.currency}`}
            content={row.cont ?? undefined}
            transactions={txState.data ?? []}
            approvers={approvers}
            attachments={attachments}
            requestedBy={`${row.draft_user_nm} (${row.draft_user_id})`}
            requestedAt={formatDtm14(row.reg_dtm) ?? ""}
            onClose={onClose}
            onApprove={canAct ? handleApprove : undefined}
            onReject={canAct ? handleReject : undefined}
        />
    );
}

/** Wire `ApiApprovalTransactionRow` → shared `RequestApprovalTransaction`.
 *  Amount is formatted here (frontend owns locale/currency formatting,
 *  mirroring `cardRowToApprovalTransaction`). */
function apiTxToRequestApprovalTransaction(tx: ApiApprovalTransactionRow): RequestApprovalTransaction {
    return {
        id: tx.id,
        depositBankCode: tx.deposit_bank_code ?? "",
        depositBankName: tx.deposit_bank_name ?? tx.deposit_bank_code ?? "",
        depositBankCcyCd: tx.deposit_bank_ccy_cd ?? "",
        depositAccountNo: tx.deposit_account_no ?? "",
        transferAmount: tx.amount ? Number(tx.amount).toLocaleString("vi-VN") : "",
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

/** `yyyyMMdd` → `DD-MM-YYYY`; empty when null/short. */
function formatDate8(value: string | null): string {
    if (!value || value.length !== 8) return "";
    return `${value.slice(6, 8)}-${value.slice(4, 6)}-${value.slice(0, 4)}`;
}

/** `yyyyMMddHHmmss` → `DD-MM-YYYY HH:mm`; undefined when null/short. */
function formatDtm14(value: string | null): string | undefined {
    if (!value || value.length < 12) return undefined;
    const date = `${value.slice(6, 8)}-${value.slice(4, 6)}-${value.slice(0, 4)}`;
    const time = `${value.slice(8, 10)}:${value.slice(10, 12)}`;
    return `${date} ${time}`;
}
