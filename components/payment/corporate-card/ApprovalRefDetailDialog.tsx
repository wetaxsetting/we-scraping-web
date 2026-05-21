"use client";

import { useMemo } from "react";

import ApprovalDetailsDialog from "@/components/payment/shared/ApprovalDetailsDialog";
import type {
    ApprovalDetailsApprover,
    ApprovalOutcome,
} from "@/components/payment/shared/ApprovalDetailsDialog";
import type { RequestApprovalTransaction } from "@/components/payment/shared/RequestApprovalDialog";
import { fetchApprovalBoxList } from "@/lib/api/approval-box";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";

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
}: ApprovalRefDetailDialogProps) {
    const { t } = useTranslation();
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

    if (!open || !seq) return null;

    // Approval Box row resolved → use real data. Falls back to a
    // minimal "stub" view if the search comes back empty (e.g. the
    // approval was deleted or rolled out of the lookup window).
    const approvers: ApprovalDetailsApprover[] = apiRow
        ? apiRow.approvers.map((a) => ({
              seq:      a.apprvr_line_no,
              name:     a.apprvr_nm,
              outcome:  a.apprvr_stts, // raw legacy code accepted
              actedAt:  formatDtm14(a.appr_dtm),
          }))
        : [];

    const status: ApprovalOutcome = apiRow
        ? mapStatus(apiRow.appr_stts)
        : "pending";

    const title         = apiRow?.title || t("payment.card.approval_detail.title");
    const documentNo    = apiRow?.doc_no || seq;
    const scheduledDate = formatDate8(apiRow?.pay_date ?? null);
    const totalAmount   = apiRow
        ? `${Number(apiRow.tot_pay_amt).toLocaleString("vi-VN")} ${apiRow.currency}`
        : "";
    const requestedBy   = apiRow ? `${apiRow.draft_user_nm} (${apiRow.draft_user_id})` : "";
    const requestedAt   = formatDtm14(apiRow?.reg_dtm ?? null);

    return (
        <ApprovalDetailsDialog
            kind="card"
            title={title}
            status={status}
            documentNo={documentNo}
            scheduledDate={scheduledDate}
            totalAmount={totalAmount}
            transactions={transactions}
            approvers={approvers}
            requestedBy={requestedBy}
            requestedAt={requestedAt}
            onClose={onClose}
        />
    );
}

/** Approval Box `appr_stts` → shared `ApprovalOutcome`. */
function mapStatus(s: "P" | "I" | "C" | "R"): ApprovalOutcome {
    switch (s) {
        case "C": return "approved";
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
