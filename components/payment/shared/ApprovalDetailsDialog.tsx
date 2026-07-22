"use client";

import {
    ChevronDown, ChevronUp, MoreHorizontal, X, Paperclip, Printer,
    FileSpreadsheet, FileText, FileImage, FileArchive, Presentation, File as FileIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import DeleteIcon from "@/components/shared/icons/DeleteIcon";
import EditIcon from "@/components/shared/icons/EditIcon";
import BlockedCharsTooltip from "@/components/shared/BlockedCharsTooltip";
import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import UserAvatar from "@/components/shared/UserAvatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useBlockedChars } from "@/hooks/useBlockedChars";
import { avatarColorFor } from "@/lib/avatar";
import { userStorage } from "@/lib/auth/storage";
import { formatActedAt } from "@/lib/api/mappers";
import { useTranslation } from "@/lib/i18n";
import { printApprovalForm, type ApprovalPrintColumn } from "@/lib/print";
import { cn } from "@/lib/utils";
import type { ApiApprovalBoxApprover } from "@/lib/types/api";

import {
    kindToPymnType,
    type RequestApprovalKind,
    type RequestApprovalTransaction,
} from "./RequestApprovalDialog";

/* ============================================================================
 *  Shared "Approval Details" dialog — Figma frames 7480:50301 (Vendor
 *  Rejected), 7503:46944 (Payroll Rejected), 9999:50090 (Internal Transfer
 *  Rejected — same shape as Vendor), 7503:47793 (Card Rejected).
 *
 *  Read-only twin of `<RequestApprovalDialog>`. One component, `kind`-driven,
 *  all three Transaction-Details variants live in this file. Renders the
 *  same 3-section General Information / Approval Content / Transaction
 *  Details shell, plus a status badge, per-approver outcome chips with
 *  date stamps, file-cards with download glyphs, and a "Requested by …"
 *  footer.
 *
 *  Legacy mirror: `comm_0194_001_view.jsp` lines 240-360 (the "approval
 *  details" panel shown when `apprSeqNo` is set on the batch).
 * ========================================================================== */

/**
 * Per-approver outcome codes — mirrors legacy `APPRVR_STTS` vocabulary
 * (`comm_0195_001.ts:1416-1431` `getApprover()`):
 *
 *   P → "is pending"                       (current approver, awaiting action)
 *   A → "has approved on {date}"           (approver acted ✓)
 *   R → "has rejected on {date}"           (approver acted ✗)
 *   W → "is not the approval order yet."   (future approver in chain)
 *   S → "is unable to approve"             (locked out — admin override)
 *   C / I → "In Progress"                  (active branch in parallel routing)
 *
 * The page-level *batch* status (status badge next to the title) uses
 * the narrower {@link ApprovalOutcome} set — approved/rejected/pending/in_progress.
 * Per-approver chips use the richer code so the legacy color + verb
 * mapping survives intact.
 */
const cleanName = (nm: string) => {
    if (!nm) return "";
    let prev = "";
    let curr = nm;
    while (curr !== prev) {
        prev = curr;
        curr = curr
            .replace(/\s*\(\s*(You|나|B\u1EA1n)\s*\)/gi, "")
            .replace(/\s*\(\s*\)/g, "")
            .trim();
    }
    return curr;
};

export type ApprovalOutcome = "approved" | "rejected" | "pending" | "in_progress";

export type ApproverStatusCode = "P" | "A" | "R" | "W" | "S" | "C" | "I";

export type ApprovalDetailsApprover = {
    seq:        number;
    /** Approver user ID — used by the page to determine if the current user
     *  is in the approval chain (to show the Approve/Reject buttons). */
    id?:        string;
    name:       string;
    /** Per-approver outcome — drives the chip colour + glyph + verb.
     *  Accepts either the narrower batch-status vocabulary
     *  ({@link ApprovalOutcome}) for backward compatibility or the
     *  full legacy `APPRVR_STTS` code ({@link ApproverStatusCode}). */
    outcome:    ApprovalOutcome | ApproverStatusCode;
    /** Display-formatted date the approver acted on (or due-by, for pending).
     *  e.g. "07-12-2024 10:30". Empty string hides the date row. */
    actedAt?:   string;
    /** Shared, non-admin avatar URL (`/api/v1/users/{id}/image`) or null
     *  when the approver has no stored image — drives the shared
     *  `<UserAvatar>` photo / initials fallback. */
    userImgUrl?: string | null;
};

/** Map the REAL approver chain (`EXPT_RESOL_APPRVR_INFM`, from
 *  `GET /api/v1/payment/approval-box/{apprSeqNo}/approvers`) onto the dialog's
 *  approver shape. Carries the verbatim `APPRVR_STTS` so the chips render the
 *  legacy P/A/R/W/S verbs, and the `id` so the "(You)" marker + the active-
 *  approver gate work. Used by the payment Scheduled detail pages in place of
 *  the old synthesised "bridge" chain. */
export function chainToDialogApprovers(
    chain: ApiApprovalBoxApprover[],
): ApprovalDetailsApprover[] {
    return chain.map((a) => ({
        seq:        a.apprvr_line_no,
        id:         a.apprvr_id,
        name:       a.apprvr_nm,
        outcome:    a.apprvr_stts as ApproverStatusCode,
        actedAt:    formatApproverActedAt(a.appr_dtm),
        userImgUrl: a.user_img_url,
    }));
}

/** The id of the current ACTIVE approver — the first row (by line order) whose
 *  status is PENDING. `undefined` when the chain has no pending row. */
export function firstPendingApproverId(
    approvers: ApprovalDetailsApprover[],
): string | undefined {
    return approvers.find((a) => a.outcome === "P")?.id;
}

/** Legacy `APPR_YN` parity: Approve/Reject are visible ONLY to the current
 *  active (first-pending) approver. False for waiting approvers, the
 *  requester, non-approvers, and when no user is resolved. */
export function isCurrentUserActiveApprover(
    approvers: ApprovalDetailsApprover[],
    currentUserId: string | null | undefined,
): boolean {
    if (!currentUserId) return false;
    return firstPendingApproverId(approvers) === currentUserId;
}

/** Final approval states — the document is fully approved (`A` / `C` / `01`)
 *  or rejected (`X` / `R` / `02`), so no further approve / reject is
 *  possible. Mirrors the backend WBE2081 idempotency guard. Covers BOTH the
 *  letter codes (detail `appr_stts` from `wb_get_appr_stts`) and the numeric
 *  proc codes (`01`/`02`) some list projections carry, so ONE definition is
 *  correct for every payment type. NON-final codes — `P`/`04` (pending),
 *  `I`/`03` (in-progress) — are actionable. This is intentionally the full
 *  superset, never a per-type allowlist (the retired Overseas `P || 04`
 *  allowlist was exactly that bug — it omitted `I` and hid the buttons on an
 *  in-progress document). */
export function isFinalApprovalState(apprStts: string | null | undefined): boolean {
    return apprStts === "C" || apprStts === "A" || apprStts === "01"
        || apprStts === "X" || apprStts === "R" || apprStts === "02";
}

/** THE single Approve/Reject visibility rule shared by every payment type
 *  (Internal Transfer / Vendor / Expense / Payroll / Overseas / Card).
 *
 *  Legacy parity: the JEX approval-detail read (`EXPT_RESOL_MSTR_R007..R010`,
 *  identical across all types) computes `APPR_YN = 'Y'` IFF the current user
 *  is the FIRST pending approver (`EXPT_RESOL_APPRVR_INFM.APPRVR_STTS = 'P'`,
 *  lowest `APPRVR_LINE_NO`), and `comm_0195_001.ts:928-931` renders the
 *  buttons only when `APPR_YN === 'Y'`. The document-level `appr_stts` is NOT
 *  part of the legacy rule — {@link isCurrentUserActiveApprover} reproduces
 *  `APPR_YN` exactly, and IS the primary business rule.
 *
 *  {@link isFinalApprovalState} is layered on ONLY as a defensive UI
 *  safeguard so a finalized document can never paint the buttons. It is
 *  redundant in practice (a finalized document has no first-pending approver)
 *  but guards against stale / inconsistent data; it must never become a
 *  type-specific status allowlist. Callers add their own UI-only guards
 *  (`!editMode`, `!actionInFlight`) on top — those are presentation state,
 *  not the business rule. */
export function canActOnApproval(
    approvers: ApprovalDetailsApprover[],
    currentUserId: string | null | undefined,
    apprStts: string | null | undefined,
): boolean {
    return !isFinalApprovalState(apprStts) && isCurrentUserActiveApprover(approvers, currentUserId);
}

/** Format a UTC `yyyyMMddHHmmss` approver-act timestamp → `DD-MM-YYYY HH:mm:ss`.
 *  Delegates to the shared `formatActedAt` (lib/api/mappers) so every entry
 *  point renders the approver timestamp identically — the Approval Box path
 *  already formats its inline approvers through the same helper, so Scheduled
 *  Payment chips now match it (with seconds) instead of dropping them.
 *  Returns undefined for null/short input (pending/waiting rows have no
 *  `appr_dtm`) so the chip renders the verb without a date. */
function formatApproverActedAt(raw: string | null): string | undefined {
    return formatActedAt(raw) ?? undefined;
}

export type ApprovalDetailsAttachment = {
    id:        string;
    name:      string;
    size:      string;
    /** Source file id (legacy FILE_ID / EVID_FILE_ID) — drives delete on edit. */
    fileId?:   string;
    /** Source table discriminator — EXPT_RESOL_FILE | EXPT_RESOL_PAY_EVID_FILE. */
    fileType?: string;
    /** Optional download handler — left as a no-op for static UI. */
    onDownload?: () => void;
};

/** Edit-mode save payload handed up from the (presentational) dialog to the
 *  data-owning wrapper. The wrapper merges the picked approval line and calls
 *  the multipart edit endpoint. Mirrors legacy `comm_0192_013_u002` inputs:
 *  POST_TITLE / POST_CONT / REC3 (new files) / REC4 (removed files). */
export type ApprovalDetailsEditPayload = {
    title:   string;
    content: string;
    /** Newly-added files (legacy REC3). */
    newFiles: File[];
    /** Existing attachments the user removed (legacy REC4). */
    removedAttachments: { fileId: string; fileType: string }[];
};

export type ApprovalDetailsDialogProps = {
    kind:        RequestApprovalKind;
    /** Big payment title shown at the top of the body. */
    title:       string;
    /** Overall request status — drives the badge variant. */
    status:      ApprovalOutcome;
    /** Document number for the General Information section. */
    documentNo?: string;
    /** Scheduled-payment date (yyyy-MM-dd or pre-formatted string). */
    scheduledDate?: string;
    /** Pre-formatted total transfer amount (e.g. "9.000.000đ"). */
    totalAmount?: string;
    /** Document currency code (e.g. "VND") — used to build the legacy print
     *  summary "VND: Total N transaction(s) / amount". */
    currency?:   string;
    /** Withdrawal Bank / Account No. row. Skipped for `kind === "card"`. */
    withdrawalAccount?: {
        /** Internal 8-char bank code (e.g. {@code "11704020"}) — keys
         *  the bank-specific {@code BLOCKED_CHARS_RULE} lookup that
         *  drives the Remarks header tooltip. Optional for backward
         *  compat with callers that don't yet supply it; without it
         *  the tooltip falls back to the static info glyph. */
        bankCd?: string;
        bankNm:  string;
        acctNo:  string;
        ccyCd:   string;
    };
    /** Approval line name (for the "Approval Line" row). */
    approvalLineName?: string;
    /** Pre-resolved Payroll Type label (e.g. "Salary"). Rendered only
     *  when `kind === "payroll"`, in the left group after Document No.
     *  (legacy `comm_0195_001` `#payroll_type`). The caller resolves the
     *  `APPR_FUND_TP` code → label so the dialog stays presentational. */
    payrollType?: string | null;
    /** Free-text approval content / note from the requestor. */
    content?:    string;
    /** Per-line transactions for the Transaction Details table. */
    transactions?: RequestApprovalTransaction[];
    /** Per-approver outcomes shown as numbered chips in the Approver row. */
    approvers:   ApprovalDetailsApprover[];
    /** Files attached to the request — rendered as download cards. */
    attachments?: ApprovalDetailsAttachment[];
    /** Requestor display name + date for the footer. */
    requestedBy: string;
    requestedAt: string;
    onClose:     () => void;
    /** Kebab menu action — Edit / Withdraw / Re-submit. Optional. */
    onMenuAction?: (action: "edit" | "withdraw" | "resubmit") => void;
    /** When supplied, the dialog renders the "Reject" + "Approve" pair
     *  in the footer (mirrors legacy `comm_0195_001` lines 916-919).
     *  Use these to wire the per-tenant approve / reject endpoints. The
     *  Close button is rendered unconditionally. */
    onApprove?:  () => void;
    onReject?:   () => void;
    /** When true, the Approver row hides the {@link approvers} chips and
     *  renders {@link editApproverSlot} instead — an inline "Select
     *  approval line" dropdown the parent provides. Footer also swaps:
     *  Reject / Approve disappear, Cancel + Save take their place. */
    editMode?:      boolean;
    /** Custom content rendered inside the Approver row when
     *  {@link editMode} is true (typically a dropdown trigger + the
     *  newly-picked approver chain preview). */
    editApproverSlot?: React.ReactNode;
    /** While editing, the approver chips + count preview the PICKED approval
     *  line's chain (legacy: changing the line resets the chain). Null/undefined
     *  before a line is picked → the original {@link approvers} chain shows. */
    editPreviewApprovers?: ApprovalDetailsApprover[] | null;
    /** Edit-mode Save handler — fires when the user commits the edit. Receives
     *  the edited title / content / added / removed attachments; the wrapper
     *  merges the picked approval line and persists. */
    onEditSave?:    (payload: ApprovalDetailsEditPayload) => void | Promise<void>;
    /** Edit-mode Cancel handler — fires when the user discards. */
    onEditCancel?:  () => void;
    /** Disable the edit-mode Save button (e.g. nothing picked yet). */
    editSaveDisabled?: boolean;
};

const KIND_LABEL_KEY: Record<RequestApprovalKind, string> = {
    "internal-transfer": "payment.request_approval.type.internal_transfer",
    "vendor-payment":    "payment.request_approval.type.vendor",
    "expense-payment":   "payment.request_approval.type.expense",
    payroll:             "payment.request_approval.type.payroll",
    "overseas-payment":  "payment.request_approval.type.overseas",
    card:                "payment.request_approval.type.card",
};

/**
 * Per-kind transaction-table columns for the printed approval form — mirrors
 * the on-screen Transaction Details column sets (and legacy
 * `comm_0195_001.ts setUpDataForPrint` per-APPR_DV tables). Reuses the same
 * `payment.request_approval.col.*` header keys as the on-screen table so the
 * print headers and the screen headers stay in lockstep.
 */
function buildApprovalPrintColumns(
    kind: RequestApprovalKind,
    t: (key: string) => string,
): ApprovalPrintColumn<RequestApprovalTransaction>[] {
    // Deposit Bank — name only (legacy print shows the bank name; the account
    // number + currency are separate columns on the payroll table).
    const bank: ApprovalPrintColumn<RequestApprovalTransaction> = {
        header: t("payment.request_approval.col.deposit_bank"),
        render: (r) => r.depositBankName || r.depositBankCode || "",
    };
    const accountNo: ApprovalPrintColumn<RequestApprovalTransaction> = {
        header: t("payment.approval_details.print.deposit_account_no"),
        render: (r) => r.depositAccountNo ?? "",
    };
    const currencyCol: ApprovalPrintColumn<RequestApprovalTransaction> = {
        header: t("payment.approval_details.print.currency"),
        render: (r) => r.depositBankCcyCd ?? "",
    };
    const amount: ApprovalPrintColumn<RequestApprovalTransaction> = {
        header: t("payment.request_approval.col.transfer_amount"),
        align:  "right",
        render: (r) => r.transferAmount ?? "",
    };
    const recipient: ApprovalPrintColumn<RequestApprovalTransaction> = {
        header: t("payment.request_approval.col.recipient_name"),
        render: (r) => r.recipientName ?? "",
    };
    const remarks: ApprovalPrintColumn<RequestApprovalTransaction> = {
        header: t("payment.request_approval.col.remarks"),
        render: (r) => r.remarks ?? "",
    };
    const contact: ApprovalPrintColumn<RequestApprovalTransaction> = {
        header: t("payment.request_approval.col.contact_name"),
        render: (r) => r.contactName ?? "",
    };
    const description: ApprovalPrintColumn<RequestApprovalTransaction> = {
        header: t("payment.request_approval.col.description"),
        render: (r) => r.description ?? "",
    };
    const documentNo: ApprovalPrintColumn<RequestApprovalTransaction> = {
        header: t("payment.request_approval.col.document_no"),
        render: (r) => r.documentNo ?? "",
    };
    const reporting: ApprovalPrintColumn<RequestApprovalTransaction> = {
        header: t("payment.request_approval.col.reporting_account"),
        render: (r) =>
            r.reportingAccount
                ? r.reportingBreadcrumb
                    ? `${r.reportingAccount} (${r.reportingBreadcrumb})`
                    : r.reportingAccount
                : "",
    };

    switch (kind) {
        case "card":
            // legacy: Name · Amount · Purpose · Description (REC4)
            return [
                recipient,
                amount,
                { header: t("payment.approval_details.card.usage"), render: (r) => r.purpose ?? "" },
                description,
            ];
        case "payroll":
            // legacy: Deposit Bank · Deposit Account No. · Currency · Transfer
            // Amount · Reporting Account · Recipient Name · Remarks
            return [bank, accountNo, currencyCol, amount, reporting, recipient, remarks];
        case "overseas-payment":
            return [bank, amount, recipient, remarks, description, documentNo, reporting];
        default:
            // internal-transfer / vendor / expense
            return [bank, amount, recipient, remarks, contact, description, documentNo, reporting];
    }
}

export default function ApprovalDetailsDialog({
    kind,
    title,
    status,
    documentNo,
    scheduledDate,
    totalAmount,
    withdrawalAccount,
    approvalLineName,
    payrollType,
    content,
    currency,
    transactions = [],
    approvers,
    attachments = [],
    requestedBy,
    requestedAt,
    onClose,
    onMenuAction,
    onApprove,
    onReject,
    editMode = false,
    editApproverSlot,
    editPreviewApprovers,
    onEditSave,
    onEditCancel,
    editSaveDisabled = false,
}: ApprovalDetailsDialogProps) {
    const { t } = useTranslation();

    /* ── Section collapse state ─────────────────────────────────── */
    // On open only General Information is expanded; Approval Content and
    // Transaction Details start collapsed (header-only) so the popup opens
    // compact — the user expands them on demand. The <Section> chevron
    // renders up when open / down when collapsed, so the icon state follows
    // automatically.
    const [showGeneral, setShowGeneral]     = useState(true);
    const [showContent, setShowContent]     = useState(false);
    const [showTransactions, setShowTxns]   = useState(false);
    const [menuOpen, setMenuOpen]           = useState(false);

    /* ── Edit-mode form state ───────────────────────────────────── */
    // Title / content / attachments become editable while editMode is on
    // (legacy comm_0195_001 contenteditable title + content + attach UI).
    // Seeded from the read-only props each time edit mode is (re)entered, and
    // discarded on cancel because the inputs unmount when editMode flips off.
    const [editTitle, setEditTitle]     = useState(title);
    const [editContent, setEditContent] = useState(content ?? "");
    const [newFiles, setNewFiles]       = useState<File[]>([]);
    const [removedIds, setRemovedIds]   = useState<Set<string>>(() => new Set<string>());
    // Footer "Attachment (N)" expand toggle — mirrors RequestApprovalDialog.
    const [attachmentsOpen, setAttachmentsOpen] = useState(false);
    // Seed the edit form from the read-only props on the read→edit transition
    // (React's "adjust state when a prop changes during render" pattern — not an
    // effect, so no cascading-render lint). Re-seeding only on the false→true
    // edge keeps the user's in-progress edits stable across re-renders.
    const [wasEditing, setWasEditing] = useState(editMode);
    if (editMode !== wasEditing) {
        setWasEditing(editMode);
        if (editMode) {
            setEditTitle(title);
            setEditContent(content ?? "");
            setNewFiles([]);
            setRemovedIds(new Set<string>());
            setAttachmentsOpen(false);
        }
    }

    const visibleAttachments = editMode
        ? attachments.filter((f) => !removedIds.has(f.id))
        : attachments;
    // Edit-mode footer "Attachment (N)" count — existing (not removed) + new.
    const editAttachmentCount = visibleAttachments.length + newFiles.length;

    // Approver row source — while editing AND a new line is picked, the chips +
    // "Approver (X/Y)" count preview the PICKED line's chain (legacy: changing
    // the approval line resets the chain). Otherwise the original chain shows.
    const displayApprovers = editMode && editPreviewApprovers
        ? editPreviewApprovers
        : approvers;

    // Kebab menu visibility (legacy comm_0195_001.ts:164-177):
    //  - Pending  → Edit + Delete (requestor/admin only — the wrapper gates
    //    that by supplying onMenuAction).
    //  - In Progress / Approved / Rejected → Print only (any viewer; no
    //    requestor/admin gate, mirrors legacy which shows .btnPrint there).
    //  - Edit mode hides the kebab entirely (legacy hides the etc button).
    const canShowEditMenu  = !!onMenuAction && status === "pending" && !editMode;
    const canShowPrintMenu = !editMode
        && (status === "in_progress" || status === "approved" || status === "rejected");

    // Print → refactor of legacy `printed_approval_form01`
    // (comm_0195_001.ts setUpDataForPrint). Builds the approval document from
    // the SAME in-memory props the popup already shows (no fresh fetch) and
    // prints it via the shared hidden-iframe path in lib/print.ts.
    const handlePrint = () => {
        const count = transactions.length;
        // Strip a trailing " {currency}" from the formatted total so the summary
        // reads "VND: Total 1 transaction(s) / 550.000" (legacy format) instead
        // of doubling the currency code.
        const cleanAmount = currency && totalAmount?.endsWith(` ${currency}`)
            ? totalAmount.slice(0, -(currency.length + 1))
            : (totalAmount ?? "");
        printApprovalForm<RequestApprovalTransaction>({
            formTitle: `${t("payment.approval_details.title")} (${t(KIND_LABEL_KEY[kind])})`,
            documentNoLabel:    t("payment.request_approval.row.document_no"),
            documentNo,
            requestorLabel:     t("payment.approval_details.print.requestor"),
            requestor:          requestedBy,
            subjectLabel:       t("payment.approval_details.print.subject"),
            subject:            title,
            requestedDateLabel: t("payment.approval_details.print.requested_date"),
            requestedDate:      requestedAt,
            scheduledDateLabel: t("payment.request_approval.row.scheduled_date"),
            scheduledDate,
            descriptionLabel:   t("payment.request_approval.col.description"),
            content,
            summary: t("payment.approval_details.print.total_summary", {
                currency: currency ?? "",
                count:    String(count),
                amount:   cleanAmount,
            }),
            transactionsFooter: t("payment.approval_details.print.transaction_count", {
                count: String(count),
            }),
            // Approver stamp boxes — split the verb (cell 2) from the date
            // (cell 3), matching legacy `apprv_payroll`. The verb keys for
            // approved/rejected carry a `{date}` placeholder; resolving it with
            // an empty date yields the verb alone, with the date in its own cell.
            approvers: approvers.map((a) => {
                const display = APPROVER_DISPLAY[toStatusCode(a.outcome)];
                return {
                    name:       cleanName(a.name),
                    statusText: t(display.verbKey, { date: "" }).trim(),
                    actedAt:    display.showDate ? (a.actedAt ?? "") : "",
                };
            }),
            columns: buildApprovalPrintColumns(kind, t),
            rows:    transactions,
        });
    };

    const needsAccount = kind !== "card";

    // Bank-specific blocked-chars tooltip — drives the Remarks ⓘ glyph
    // in the Transaction Details table header. Keys on the withdrawal
    // bank code + the dialog `kind` mapped to PymnType. Card kind
    // returns null PymnType → short-circuited by passing null bankCd
    // to the hook (returns empty map without firing the request).
    const pymnType = kindToPymnType(kind);
    const blockedChars = useBlockedChars(
        pymnType ? (withdrawalAccount?.bankCd ?? null) : null,
        pymnType ?? "INTR",  // fallback is unused when bankCd is null
    );

    /* ── Open/close animation state ─────────────────────────────── */
    // Mount closed → flip to open on next tick so Radix sees a
    // closed→open transition and animates in. On close, flip to
    // closed first, let the animate-out run (~200ms), THEN fire the
    // parent's onClose so the parent unmount doesn't yank the
    // dialog out mid-animation.
    const [open, setOpen] = useState(false);
    useEffect(() => { setOpen(true); }, []);
    const handleClose = () => {
        setOpen(false);
        setTimeout(() => onClose(), 200);
    };


    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
            <DialogContent
                hideClose
                aria-describedby={undefined}
                // Full-screen popup — fills the viewport edge-to-edge so
                // the read-only Approval Details (General Info + per-line
                // table + per-approver chips + attachments) never scrolls
                // horizontally on the inner table. Overrides shadcn
                // `<DialogContent>` defaults (`max-w-[500px]` cap +
                // `max-h-[calc(100vh-32px)]` margin) and drops the
                // rounded corners since the dialog touches every edge.
                className="flex h-screen w-screen max-h-none max-w-none flex-col overflow-hidden rounded-none p-0"
            >
                <DialogTitle className="sr-only">
                    {t("payment.approval_details.title")}
                </DialogTitle>
                {/* Header bar — Figma 7503:48576 (h-48, px-16). */}
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-wb-table-border px-4">
                    <span className="text-wb-15 font-semibold text-wb-ink">
                        {t("payment.approval_details.title")}
                    </span>
                    <div className="flex items-center gap-1">
                        <span className="rounded bg-wb-ntrl-3 px-1 py-px text-wb-13 font-medium text-wb-ink opacity-40">
                            Esc
                        </span>
                        <button
                            type="button"
                            onClick={handleClose}
                            aria-label={t("dialog.close")}
                            className="flex size-6 cursor-pointer items-center justify-center rounded-md text-wb-ink opacity-50 hover:bg-black/5 hover:opacity-100"
                        >
                            <X className="size-4" strokeWidth={1.8} />
                        </button>
                    </div>
                </div>

                {/* Body — scrollable */}
                <div className="custom-scrollbar-y flex-1 overflow-y-auto px-6 py-5">
                    {/* Title row — big title + status badge + kebab (Figma
                     *  7503:48589 — no divider under the title row). */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            {editMode ? (
                                /* Borderless title — mirrors RequestApprovalDialog's
                                 *  big title field (underline only, no box). */
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    maxLength={200}
                                    aria-label={t("payment.approval_details.title")}
                                    className="min-w-0 flex-1 border-0 border-b border-wb-table-border bg-transparent pb-2 text-wb-24 font-semibold text-wb-ink focus:outline-none"
                                />
                            ) : (
                                <h2 className="truncate text-wb-24 font-semibold text-wb-ink">
                                    {title}
                                </h2>
                            )}
                            <StatusBadge outcome={status} />
                        </div>
                        {/* Legacy `comm_0195_001.ts:164-177` menu rule:
                         *   Pending (00)                  → Edit + Delete
                         *   In Progress (03) / Approved (01) / Rejected (02) → Print
                         *  Edit + Delete are requestor/admin-gated (the wrapper
                         *  supplies onMenuAction only then); Print has no such gate.
                         *  Same rule for every type incl. Corporate Card. The kebab
                         *  is hidden while editing (legacy hides the etc button). */}
                        {(canShowEditMenu || canShowPrintMenu) && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setMenuOpen((v) => !v)}
                                    aria-label={t("dialog.more_actions")}
                                    className="flex size-7 cursor-pointer items-center justify-center rounded-md text-wb-ink hover:bg-black/5"
                                >
                                    <MoreHorizontal className="size-5" strokeWidth={1.8} />
                                </button>
                                {menuOpen && (
                                    <div className="absolute right-0 top-9 z-10 flex min-w-[160px] flex-col rounded-md border border-wb-ntrl-4 bg-white p-1 shadow-lg animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out">
                                        {canShowEditMenu && (["edit", "withdraw"] as const).map((action) => {
                                            const isDelete = action === "withdraw";
                                            return (
                                                <button
                                                    key={action}
                                                    type="button"
                                                    onClick={() => {
                                                        onMenuAction?.(action);
                                                        setMenuOpen(false);
                                                    }}
                                                    className={cn(
                                                        "flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-wb-13 font-medium hover:bg-wb-bg-sidebar",
                                                        isDelete ? "text-wb-status-rejected-text" : "text-wb-ink",
                                                    )}
                                                >
                                                    {action === "edit" && (
                                                        <EditIcon className="size-3.5 text-wb-ntrl-6" />
                                                    )}
                                                    {action === "withdraw" && (
                                                        <DeleteIcon className="size-3.5 text-wb-status-rejected-text" />
                                                    )}
                                                    {t(
                                                        action === "withdraw"
                                                            ? "payment.approval_details.menu.delete"
                                                            : `payment.approval_details.menu.${action}`,
                                                    )}
                                                </button>
                                            );
                                        })}
                                        {canShowPrintMenu && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handlePrint();
                                                    setMenuOpen(false);
                                                }}
                                                className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-sidebar"
                                            >
                                                <Printer className="size-3.5 text-wb-ntrl-6" strokeWidth={1.8} />
                                                {t("payment.approval_details.menu.print")}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* General Information section */}
                    <Section
                        title={t("payment.request_approval.section.general")}
                        open={showGeneral}
                        onToggle={() => setShowGeneral((v) => !v)}
                    >
                        {/* Two content-width groups sitting adjacent (not a
                         *  50/50 grid) so the Info block stays compact and
                         *  left-aligned, matching Figma — the old
                         *  `grid-cols-[1fr_1fr]` stretched the right group
                         *  across the whole popup with large far-right
                         *  whitespace. Stacks to one column below md. */}
                        <div className="flex flex-col gap-y-4 pt-4 md:flex-row md:items-start md:gap-x-12">
                            {/* Left column */}
                            <div className="flex flex-col gap-3">
                                <InfoRow
                                    icon="document"
                                    label={t("payment.request_approval.row.type")}
                                    value={t(KIND_LABEL_KEY[kind])}
                                />
                                <InfoRow
                                    icon="hash"
                                    label={t("payment.request_approval.row.document_no")}
                                    value={documentNo ?? ""}
                                />
                                {kind === "payroll" && (
                                    <InfoRow
                                        icon="bank"
                                        label={t("payment.request_approval.row.payroll_type")}
                                        value={payrollType ?? ""}
                                    />
                                )}
                                {scheduledDate && (
                                    <InfoRow
                                        icon="calendar"
                                        label={t("payment.request_approval.row.scheduled_date")}
                                        value={scheduledDate}
                                    />
                                )}
                                {totalAmount && (
                                    <InfoRow
                                        icon="coins"
                                        label={t("payment.request_approval.row.total_transfer")}
                                    >
                                        <span className="inline-flex h-7 items-center rounded-md border border-wb-ntrl-4 bg-white px-2 text-wb-13 font-medium text-wb-ink">
                                            {totalAmount}
                                        </span>
                                    </InfoRow>
                                )}
                            </div>
                            {/* Right column */}
                            <div className="flex flex-col gap-3">
                                {needsAccount && withdrawalAccount && (
                                    <InfoRow
                                        icon="bank"
                                        label={t("payment.request_approval.row.withdrawal_bank_acct")}
                                        value={`${withdrawalAccount.bankNm} ${withdrawalAccount.acctNo} (${withdrawalAccount.ccyCd})`}
                                    />
                                )}
                                {approvalLineName && (
                                    <InfoRow
                                        icon="approval-line"
                                        label={t("payment.request_approval.row.approval_line")}
                                        value={approvalLineName}
                                    />
                                )}
                                {(displayApprovers.length > 0 || editMode) && (
                                    <InfoRow
                                        icon="check"
                                        label={t("payment.request_approval.row.approver", {
                                            current: String(
                                                displayApprovers.filter((a) => toStatusCode(a.outcome) === "A").length,
                                            ),
                                            total: String(displayApprovers.length),
                                        })}
                                    >
                                        <div className="flex flex-col gap-2">
                                            {editMode && editApproverSlot}
                                            {displayApprovers.length > 0 && (
                                                <div className="flex flex-col gap-1.5">
                                                    {displayApprovers.map((a) => (
                                                        <ApproverOutcomeChip key={a.seq} approver={a} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </InfoRow>
                                )}
                            </div>
                        </div>
                    </Section>

                    {/* Approval Content section — ALWAYS rendered for EVERY
                     *  approval type (Internal Transfer / Vendor / Expense /
                     *  Payroll / Overseas / Card) so the popup keeps a
                     *  consistent 3-section shape. It is no longer gated on
                     *  `content` being present — Overseas (which passes no
                     *  content) previously lost the section entirely.
                     *
                     *  Collapsed by default (the wrapping <Section> renders only
                     *  the header until opened). When expanded the body keeps a
                     *  `min-height: 110px` floor (height: auto) so short content
                     *  still reads as a block while long content grows naturally
                     *  past 110px — never a fixed height. `.trim()` drops the
                     *  leading/trailing blank lines the legacy CONT carries; an
                     *  empty/absent note renders an EMPTY 110px body (NO
                     *  placeholder text), matching the legacy empty CONT
                     *  textarea. Inline attachment cards (Figma 7503:48965)
                     *  render below the body when present. */}
                    <Section
                        title={t("payment.request_approval.section.content")}
                        open={showContent}
                        onToggle={() => setShowContent((v) => !v)}
                    >
                        {editMode ? (
                            /* Borderless content — mirrors RequestApprovalDialog's
                             *  note field (plain transparent text, no box). */
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={4}
                                placeholder={t("payment.request_approval.form.description_placeholder")}
                                aria-label={t("payment.request_approval.section.content")}
                                className="mt-3 min-h-[110px] w-full resize-y bg-transparent text-wb-13 font-normal text-wb-ink placeholder:text-wb-ntrl-5 focus:outline-none"
                            />
                        ) : (
                            <div className="min-h-[110px] whitespace-pre-line pt-3 text-wb-13 font-normal text-wb-ink">
                                {(content ?? "").trim()}
                            </div>
                        )}
                        {/* Read mode — attachments render as download cards in
                         *  the content section (legacy parity). In EDIT mode the
                         *  attachment list moves to the footer's collapsible
                         *  "Attachment (N)" box (existing + newly-added). */}
                        {!editMode && attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-3">
                                {attachments.map((f) => (
                                    <AttachmentChip key={f.id} file={f} />
                                ))}
                            </div>
                        )}
                    </Section>

                    {/* Transaction Details section — kind-conditional layout */}
                    <Section
                        title={t("payment.approval_details.section.transactions")}
                        count={t("payment.approval_details.section.transaction_count", {
                            count: String(transactions.length),
                        })}
                        open={showTransactions}
                        onToggle={() => setShowTxns((v) => !v)}
                    >
                        <TransactionDetails
                            kind={kind}
                            transactions={transactions}
                            blockedChars={blockedChars}
                        />
                    </Section>
                </div>

                {/* Footer — mirrors legacy `comm_0195_001` lines 891-924:
                 *  left  → "Requested by {name} on {date}", then Reject / Approve
                 *          (read mode) or the Attach + "Attachment (N)" group
                 *          (edit mode — same shape + placement as
                 *          RequestApprovalDialog's footer, legacy image 2).
                 *  right → Close (read mode) or Cancel + Continue (edit mode).
                 *  `min-h-12` keeps the 48px height while letting the expandable
                 *  attachment-chip row grow without clipping.                */}
                <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-t border-wb-table-border px-4 py-2">
                    {/* Legacy `comm_0195_001` lines 892-923: left zone
                     *  carries "Requested by..." followed by Reject +
                     *  Approve; right zone carries only Close. */}
                        <div className="flex items-center gap-3">
                            <span className="text-wb-13 font-medium text-wb-ntrl-8">
                                {t("payment.approval_details.requested_by", {
                                    name: requestedBy,
                                    date: requestedAt,
                                })}
                            </span>
                            {/* Attach + "Attachment (N)" — edit mode only. Same
                             *  components + styling as RequestApprovalDialog's
                             *  footer; new files ride the multipart `attachments`
                             *  parts → EXPT_RESOL_FILE (REC3). */}
                            {editMode && (
                                <>
                                    <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]">
                                        <Paperclip className="size-3.5" strokeWidth={1.8} />
                                        {t("payment.request_approval.attach")}
                                        <input
                                            type="file"
                                            multiple
                                            hidden
                                            onChange={(e) => {
                                                const list = Array.from(e.target.files ?? []);
                                                if (list.length > 0) setNewFiles((prev) => [...prev, ...list]);
                                                e.target.value = "";
                                            }}
                                        />
                                    </label>
                                    {/* "Attachment (N)" — collapsed by default; expands into
                                     *  a floating box above the footer listing every
                                     *  attachment (existing + newly-added) with a remove
                                     *  control. Mirrors the legacy comm_0195_001 collapsible
                                     *  attachment dropdown. Reuses the RequestApprovalDialog
                                     *  toggle pattern (setAttachmentsOpen + count + chevron). */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setAttachmentsOpen((v) => !v)}
                                            className="inline-flex items-center gap-1 text-wb-14-tight font-medium text-brand hover:underline"
                                        >
                                            {t("payment.request_approval.attachment_count", {
                                                count: String(editAttachmentCount),
                                            })}
                                            {attachmentsOpen ? (
                                                <ChevronUp className="size-3.5" strokeWidth={1.8} />
                                            ) : (
                                                <ChevronDown className="size-3.5" strokeWidth={1.8} />
                                            )}
                                        </button>
                                        {attachmentsOpen && editAttachmentCount > 0 && (
                                            <div className="custom-scrollbar-y absolute bottom-full left-0 z-10 mb-2 flex max-h-60 min-w-[260px] flex-col gap-1 overflow-y-auto rounded-md border border-wb-ntrl-4 bg-white p-2 shadow-lg">
                                                {/* Existing attachments — remove marks them for
                                                 *  deletion (legacy REC4) on Save. */}
                                                {visibleAttachments.map((f) => (
                                                    <div
                                                        key={f.id}
                                                        className="flex items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-wb-bg-sidebar"
                                                    >
                                                        <span className="flex min-w-0 items-center gap-1.5 text-wb-13 font-medium text-wb-ink">
                                                            <FileTypeIcon name={f.name} className="size-4" />
                                                            <span className="truncate">{f.name}</span>
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setRemovedIds((prev) => {
                                                                    const next = new Set(prev);
                                                                    next.add(f.id);
                                                                    return next;
                                                                })
                                                            }
                                                            aria-label={t("dialog.close")}
                                                            className="shrink-0 cursor-pointer text-wb-status-rejected-text hover:opacity-80"
                                                        >
                                                            <DeleteIcon className="size-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {/* Newly-added files — remove drops them from the
                                                 *  upload set (legacy REC3). */}
                                                {newFiles.map((f, i) => (
                                                    <div
                                                        key={`${f.name}-${i}`}
                                                        className="flex items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-wb-bg-sidebar"
                                                    >
                                                        <span className="flex min-w-0 items-center gap-1.5 text-wb-13 font-medium text-wb-ink">
                                                            <FileTypeIcon name={f.name} className="size-4" />
                                                            <span className="truncate">{f.name}</span>
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setNewFiles((prev) => prev.filter((_, idx) => idx !== i))
                                                            }
                                                            aria-label={t("dialog.close")}
                                                            className="shrink-0 cursor-pointer text-wb-status-rejected-text hover:opacity-80"
                                                        >
                                                            <DeleteIcon className="size-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                            {!editMode && onReject && (
                                <button
                                    type="button"
                                    onClick={onReject}
                                    className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-wb-ntrl-4 bg-white px-4 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                                >
                                    {t("payment.approval_details.reject")}
                                </button>
                            )}
                            {!editMode && onApprove && (
                                <button
                                    type="button"
                                    onClick={onApprove}
                                    className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-4 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                                >
                                    {t("payment.approval_details.approve")}
                                </button>
                            )}
                        </div>
                        {editMode ? (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onEditCancel}
                                    className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-wb-ntrl-4 bg-white px-4 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                                >
                                    {t("dialog.cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onEditSave?.({
                                            title: editTitle,
                                            content: editContent,
                                            newFiles,
                                            removedAttachments: attachments
                                                .filter((f) => removedIds.has(f.id) && f.fileId)
                                                .map((f) => ({
                                                    fileId: f.fileId as string,
                                                    fileType: f.fileType ?? "EXPT_RESOL_FILE",
                                                })),
                                        })
                                    }
                                    disabled={editSaveDisabled}
                                    className={cn(
                                        "flex h-8 items-center justify-center rounded-md px-4 text-wb-14-tight font-medium",
                                        editSaveDisabled
                                            ? "cursor-not-allowed bg-wb-ntrl-4 text-white"
                                            : "cursor-pointer bg-brand text-white shadow-wb-brand-btn hover:bg-brand-hover",
                                    )}
                                >
                                    {t("dialog.continue")}
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={handleClose}
                                className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-wb-ntrl-4 bg-white px-4 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                            >
                                {t("dialog.close")}
                            </button>
                        )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ── Status badge — top of the body next to the title ─────────────── */

function StatusBadge({ outcome }: { outcome: ApprovalOutcome }) {
    const { t } = useTranslation();
    const cls = {
        approved:     "border-wb-status-approved-text/20 bg-wb-status-approved-bg text-wb-status-approved-text",
        rejected:     "border-wb-status-rejected-text/20 bg-wb-status-rejected-bg text-wb-status-rejected-text",
        pending:      "border-wb-status-pending-text/20 bg-wb-status-pending-bg text-wb-status-pending-text",
        in_progress:  "border-wb-status-progress-text/20 bg-wb-status-progress-bg text-wb-status-progress-text",
    }[outcome];
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-wb-14-tight font-medium",
                cls,
            )}
        >
            {t(`payment.status.${outcome}`)}
        </span>
    );
}

/* ── Section wrapper ───────────────────────────────────────────── */

function Section({
    title,
    count,
    open,
    onToggle,
    children,
}: {
    title: string;
    /** Optional muted count rendered after the bold title (legacy
     *  "Transaction Details 1 transaction(s)" — the count is greyed). */
    count?: React.ReactNode;
    open:  boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="mt-6">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full cursor-pointer items-center gap-2 border-b border-wb-table-border pb-2 text-left"
            >
                <span className="text-wb-14 font-semibold text-wb-ink">{title}</span>
                {count != null && (
                    <span className="text-wb-13 font-normal text-wb-ntrl-6">{count}</span>
                )}
                {open ? (
                    <ChevronUp className="size-4 text-wb-ntrl-6" strokeWidth={1.8} />
                ) : (
                    <ChevronDown className="size-4 text-wb-ntrl-6" strokeWidth={1.8} />
                )}
            </button>
            {open && <div className="pt-1">{children}</div>}
        </div>
    );
}

/* ── Generic info row with icon + label + value/control ────────── */

function InfoRow({
    icon,
    label,
    value,
    children,
}: {
    icon:   "document" | "hash" | "calendar" | "coins" | "bank" | "approval-line" | "check";
    label:  string;
    value?: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-[220px_1fr] items-start gap-3">
            <div className="flex items-center gap-2 pt-1 text-wb-13 font-medium text-wb-ntrl-8">
                <RowIcon name={icon} />
                {/* nowrap + the 220px track keep the longest label
                 *  ("Withdrawal Bank/Account No." / its KO + VI forms)
                 *  on a single line instead of wrapping to two. */}
                <span className="whitespace-nowrap">{label}</span>
            </div>
            <div className="flex items-center text-wb-13 font-medium text-wb-ink">
                {children ?? value}
            </div>
        </div>
    );
}

function RowIcon({ name }: { name: string }) {
    const common = "size-4 shrink-0 text-wb-ntrl-6 opacity-60";
    switch (name) {
        case "document":
            return (
                <svg viewBox="0 0 16 16" fill="currentColor" className={common} aria-hidden>
                    <path d="M5 4h6v1H5V4zm0 2h6v1H5V6zm0 2h3v1H5V8zm-2-5.5C3 1.67 3.67 1 4.5 1h7c.83 0 1.5.67 1.5 1.5v11c0 .83-.67 1.5-1.5 1.5h-7C3.67 15 3 14.33 3 13.5v-11zm1.5-.5a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h7a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5h-7z" />
                </svg>
            );
        case "hash":
            return (
                <svg viewBox="0 0 16 16" fill="currentColor" className={common} aria-hidden>
                    <path d="M6.5 3.5l-.5 3H3v1.5h2.75l-.5 3H3V12h2.083l-.333 2h1.5l.333-2h2.917l-.333 2h1.5l.333-2H13v-1H10.25l.5-3H13V6h-2.083l.333-2h-1.5L9.417 6H6.5l.333-2h-1.5l-.333 2H4.917V4H6.5V3.5zm2.667 4H6.25l-.5 3h2.917l.5-3z" />
                </svg>
            );
        case "calendar":
            return (
                <svg viewBox="0 0 16 16" fill="currentColor" className={common} aria-hidden>
                    <path d="M4 2h1v1H4V2zm7 0h1v1h-1V2zM3 4h10v1H3V4zm0 2h10v8H3V6zm2 2v1h2V8H5zm3 0v1h2V8H8zm-3 2v1h2v-1H5zm3 0v1h2v-1H8z" />
                </svg>
            );
        case "coins":
            return (
                <svg viewBox="0 0 16 16" fill="currentColor" className={common} aria-hidden>
                    <circle cx="6" cy="8" r="3.5" fill="none" stroke="currentColor" />
                    <circle cx="10" cy="8" r="3.5" fill="none" stroke="currentColor" />
                </svg>
            );
        case "bank":
            return (
                <svg viewBox="0 0 16 16" fill="currentColor" className={common} aria-hidden>
                    <path d="M8 1L2 4v1h12V4L8 1zM3 6h2v6H3V6zm3.5 0h2v6h-2V6zM10 6h2v6h-2V6zM2 13h12v1H2v-1z" />
                </svg>
            );
        case "approval-line":
        case "check":
            // Approval Line + Approver — reuse the EXACT Request Approval icon
            // (RequestApprovalDialog RowIcon `check` → /assets/payment/ico-check.svg
            // at size-4 / opacity-50), not an inline tick, so both dialogs match.
            return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src="/assets/payment/ico-check.svg"
                    alt=""
                    aria-hidden
                    className="size-4 shrink-0 opacity-50"
                />
            );
        default:
            return null;
    }
}

/* ── Approver outcome chip — numbered prefix + outcome verb + date ───── */
//
// Mirrors legacy `comm_0195_001.ts:1416-1431` `getApprover()` —
// colored verb text per APPRVR_STTS code, optional date inline after
// the verb. The chip itself stays white; only the verb text is colored.
// The numbered prefix + avatar circle render unconditionally so even a
// "Waiting" approver shows their order in the chain.

type ApproverDisplay = {
    /** Tailwind class for the inline verb text. */
    verbClass: string;
    /** i18n key for the verb (resolved at render time with `{date}` for A/R only). */
    verbKey:   string;
    /** Should the chip render a date after the verb (only when actedAt is set). */
    showDate:  boolean;
};

const APPROVER_DISPLAY: Record<ApproverStatusCode, ApproverDisplay> = {
    P: { verbClass: "text-wb-status-pending-text",  verbKey: "payment.approval_details.outcome.pending",        showDate: false },
    A: { verbClass: "text-wb-status-approved-text", verbKey: "payment.approval_details.outcome.approved_on",    showDate: true  },
    R: { verbClass: "text-wb-status-rejected-text", verbKey: "payment.approval_details.outcome.rejected_on",    showDate: true  },
    W: { verbClass: "text-wb-status-pending-text",  verbKey: "payment.approval_details.outcome.not_order_yet",  showDate: false },
    S: { verbClass: "text-wb-status-pending-text",  verbKey: "payment.approval_details.outcome.unable",         showDate: false },
    C: { verbClass: "text-wb-status-progress-text", verbKey: "payment.approval_details.outcome.in_progress",    showDate: false },
    I: { verbClass: "text-wb-status-progress-text", verbKey: "payment.approval_details.outcome.in_progress",    showDate: false },
};

/** Resolve either the narrower batch-status vocabulary or the legacy
 *  APPRVR_STTS code into an {@link ApproverStatusCode}. Lets callers
 *  pass `"approved"` / `"in_progress"` from the same enum the batch
 *  status uses while the chip applies the richer verb mapping. */
function toStatusCode(
    outcome: ApprovalOutcome | ApproverStatusCode,
): ApproverStatusCode {
    switch (outcome) {
        case "approved":     return "A";
        case "rejected":     return "R";
        case "pending":      return "P";
        case "in_progress":  return "I";
        default:             return outcome;  // already a legacy code
    }
}

function ApproverOutcomeChip({ approver }: { approver: ApprovalDetailsApprover }) {
    const { t } = useTranslation();
    const code = toStatusCode(approver.outcome);
    const display = APPROVER_DISPLAY[code];
    const showDate = display.showDate && !!approver.actedAt;

    const isYou = approver.id === userStorage.get()?.userId;
    return (
        <span className="inline-flex max-w-fit items-stretch overflow-hidden rounded-lg border border-wb-ntrl-4 bg-wb-bg-sidebar text-wb-14-tight font-medium text-wb-ink">
            {/* Numbered prefix — dashed vertical divider, full height */}
            <span className="flex w-7 shrink-0 items-center justify-center border-r border-dashed border-wb-ntrl-4 px-1">
                {approver.seq}
            </span>
            {/* Avatar + name + outcome verb + status glyph. The avatar is
               the shared User Management <UserAvatar> — the approver's
               uploaded photo when present, otherwise the identity-stable
               pastel initials disc, exactly like Settings > Users. 20px
               to fit the inline chip. */}
            <span className="flex items-center gap-1.5 px-2.5 py-1">
                <UserAvatar
                    name={approver.name}
                    userId={approver.id}
                    imageUrl={approver.userImgUrl}
                    color={avatarColorFor(approver.id ?? approver.name)}
                    className="size-5 text-wb-10"
                />
                <span className="whitespace-nowrap">
                    {cleanName(approver.name)}
                    {isYou && ` ${t("settings.users.you_suffix")}`}
                </span>
                <span className={cn("whitespace-nowrap", display.verbClass)}>
                    {showDate
                        ? t(display.verbKey, { date: approver.actedAt ?? "" })
                        : t(display.verbKey)}
                </span>
                <StatusGlyph code={code} />
            </span>
        </span>
    );
}

/** Status-icon glyph rendered AFTER the verb text — matches legacy
 *  `getApproverStatusImg()` (hourglass for pending / in-progress,
 *  warning triangle for waiting / unable, check for approved, cross
 *  for rejected). Inline SVG so the dialog has no extra image dep. */
function StatusGlyph({ code }: { code: ApproverStatusCode }) {
    const common = "size-3.5 shrink-0";
    switch (code) {
        case "A":
            return (
                <svg viewBox="0 0 16 16" fill="currentColor" className={cn(common, "text-wb-status-approved-text")} aria-hidden>
                    <path d="M14 4.5l-7 7-4-4 .708-.707L7 10.086l6.292-6.293L14 4.5z" />
                </svg>
            );
        case "R":
            // "No-entry" sign (circle + diagonal slash) — matches the
            // Figma "No Sign Icon" used on a rejected approver chip.
            return (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cn(common, "text-wb-status-rejected-text")} aria-hidden>
                    <circle cx="8" cy="8" r="6" />
                    <line x1="3.9" y1="3.9" x2="12.1" y2="12.1" />
                </svg>
            );
        case "P":
        case "C":
        case "I":
            // Hourglass — current / in-progress approver.
            return (
                <svg viewBox="0 0 16 16" fill="currentColor" className={cn(common, "text-wb-status-pending-text")} aria-hidden>
                    <path d="M4 2h8v1h-1v2c0 1.1-.6 2.2-1.5 2.8L8.7 8l.8.6c.9.6 1.5 1.7 1.5 2.8v2h1v1H4v-1h1v-2c0-1.1.6-2.2 1.5-2.8L7.3 8l-.8-.6C5.6 6.8 5 5.7 5 4.6V3H4V2zm2 1v1.6c0 .7.4 1.4 1 1.8L8 7l1-.6c.6-.4 1-1.1 1-1.8V3H6zm0 10h4v-1.6c0-.7-.4-1.4-1-1.8L8 9l-1 .6c-.6.4-1 1.1-1 1.8V13z" />
                </svg>
            );
        case "W":
        case "S":
            // Warning triangle with exclamation — waiting / unable.
            return (
                <svg viewBox="0 0 16 16" fill="currentColor" className={cn(common, "text-wb-status-pending-text")} aria-hidden>
                    <path d="M8 1.5L15 14H1L8 1.5zm0 2.5L3 13h10L8 4zm-.5 4h1v3h-1V8.5zm0 4h1v1h-1v-1z" />
                </svg>
            );
    }
}

/* ── Attachment chip — file name + size + download glyph ───────────── */

/** File-type icon by extension (legacy parity) — shared by the read-mode
 *  download chip and the edit-mode attachment list so both render the same
 *  per-type glyph. Uses the project's lucide icon set (the only shipped file
 *  asset is `ico-excel.svg`, so there is no per-type SVG to reuse); brand
 *  colours are standard Tailwind utilities since no `wb` tokens exist for them. */
function FileTypeIcon({ name, className }: { name: string; className?: string }) {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const base = cn("shrink-0", className);
    if (ext === "xls" || ext === "xlsx" || ext === "csv")
        return <FileSpreadsheet className={cn(base, "text-green-600")} strokeWidth={1.8} />;
    if (ext === "doc" || ext === "docx")
        return <FileText className={cn(base, "text-blue-600")} strokeWidth={1.8} />;
    if (ext === "pdf")
        return <FileText className={cn(base, "text-red-600")} strokeWidth={1.8} />;
    if (ext === "ppt" || ext === "pptx")
        return <Presentation className={cn(base, "text-orange-500")} strokeWidth={1.8} />;
    if (["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp"].includes(ext))
        return <FileImage className={cn(base, "text-sky-500")} strokeWidth={1.8} />;
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext))
        return <FileArchive className={cn(base, "text-wb-ntrl-6")} strokeWidth={1.8} />;
    // txt + unknown → generic / text glyph.
    if (ext === "txt")
        return <FileText className={cn(base, "text-wb-ntrl-6")} strokeWidth={1.8} />;
    return <FileIcon className={cn(base, "text-wb-ntrl-6")} strokeWidth={1.8} />;
}

function AttachmentChip({
    file,
    removable = false,
    onRemove,
}: {
    file: ApprovalDetailsAttachment;
    /** Edit mode — render a remove (✕) control instead of the download glyph. */
    removable?: boolean;
    onRemove?: () => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex min-w-48.5 max-w-100.5 flex-1 items-center overflow-hidden rounded-md border border-wb-ntrl-4 bg-white">
            {/* File-type icon — bordered cell on the left (Figma 7503:48771). */}
            <div className="flex shrink-0 items-center self-stretch border-r border-wb-ntrl-4 bg-wb-bg-sidebar p-3.5">
                <FileTypeIcon name={file.name} className="size-5" />
            </div>
            {/* Name + size */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 py-2">
                <span className="truncate text-wb-13 font-medium text-wb-ink">{file.name}</span>
                <span className="text-wb-11 font-medium text-wb-ntrl-6">{file.size}</span>
            </div>
            {removable ? (
                /* Edit mode — remove (legacy REC4 delete) instead of download. */
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={t("dialog.close")}
                    className="mr-3.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-wb-status-rejected-bg text-wb-status-rejected-text hover:bg-wb-status-rejected-bg/80"
                >
                    <X className="size-3.5" strokeWidth={2} />
                </button>
            ) : (
                /* Download — blue circle button (CLAUDE.md §6b: size-5 wrapper / size-4 icon). */
                <button
                    type="button"
                    onClick={file.onDownload}
                    aria-label={t("common.download")}
                    className="mr-3.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand hover:bg-brand-hover"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-download.svg"
                        alt=""
                        aria-hidden
                        className="size-4 brightness-0 invert"
                    />
                </button>
            )}
        </div>
    );
}

/* ── Transaction Details table — kind-conditional layout ────────── */

function TransactionDetails({
    kind,
    transactions,
    blockedChars,
}: {
    kind: RequestApprovalKind;
    transactions: RequestApprovalTransaction[];
    /** Per-field blocked-chars map keyed off the current withdrawal
     *  bank. Drives the {@code BlockedCharsTooltip} on the Remarks
     *  header. Pass an empty object to disable the tooltip. */
    blockedChars: import("@/lib/api/blockedChars").BlockedCharsMap;
}) {
    const { t } = useTranslation();

    if (kind === "card") {
        if (transactions.length === 0) {
            return (
                <div className="pt-6 text-center text-wb-13 text-wb-ntrl-6">
                    {t("payment.request_approval.no_transactions")}
                </div>
            );
        }
        // Card grid — read-only twin of the Request Approval
        // `CardTransactionGrid` (Figma 7503:47745 / 7503:47793). Fixed-size
        // 340×325 cards wrap in a flex grid, identical chrome to the create
        // dialog: reporting-account header, merchant, description, currency +
        // amount footer. (No metadata grid — the design / legacy card has none.)
        return (
            <div className="flex flex-wrap items-start gap-4 pt-4">
                {transactions.map((txn) => (
                    <ReadOnlyCardCell key={txn.id} txn={txn} />
                ))}
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="pt-6 text-center text-wb-13 text-wb-ntrl-6">
                {t("payment.request_approval.no_transactions")}
            </div>
        );
    }

    if (kind === "payroll") {
        // Payroll — 5 columns (no Contact Name / Description / Document No.).
        // Order preserved exactly: Deposit Bank · Transfer Amount · Recipient
        // Name · Remarks · Reporting Account.
        const columns: TxnColumn[] = [
            { id: "deposit_bank", labelKey: "payment.request_approval.col.deposit_bank", render: (txn) => <DepositBankReadCell txn={txn} /> },
            { id: "transfer_amount", labelKey: "payment.request_approval.col.transfer_amount", align: "right", render: (txn) => txn.transferAmount },
            { id: "recipient_name", labelKey: "payment.request_approval.col.recipient_name", tooltip: { fieldCd: "RCPT", fieldNameKey: "payment.field.recipient_name" }, render: (txn) => <EllipsisTooltip lines={2} text={txn.recipientName ?? ""} /> },
            { id: "remarks", labelKey: "payment.request_approval.col.remarks", minWidth: 212, tooltip: { fieldCd: "RMKS", fieldNameKey: "payment.field.remarks" }, render: (txn) => <EllipsisTooltip lines={2} text={txn.remarks ?? ""} /> },
            { id: "reporting_account", labelKey: "payment.request_approval.col.reporting_account", minWidth: 156, render: (txn) => <ReportingAccountReadCell txn={txn} /> },
        ];
        return (
            <TxnTable
                columns={columns}
                transactions={transactions}
                blockedChars={blockedChars}
                minWidth={800}
            />
        );
    }

    // Internal Transfer — legacy `resl_0001_001.act` renders a 7-column table
    // with NO Contact Name column, and Reporting Account sitting right after
    // Remarks (before Description / Document No.). Like Payroll and the generic
    // Vendor / Expense / Overseas branch it renders through the shared
    // `<TxnTable>` (identical header bg, border, height, padding, typography,
    // row height); only the column set + order differ. (Card uses its own grid
    // layout, not a table.)
    if (kind === "internal-transfer") {
        const columns: TxnColumn[] = [
            { id: "deposit_bank", labelKey: "payment.request_approval.col.deposit_bank", render: (txn) => <DepositBankReadCell txn={txn} /> },
            { id: "transfer_amount", labelKey: "payment.request_approval.col.transfer_amount", align: "right", render: (txn) => txn.transferAmount },
            { id: "recipient_name", labelKey: "payment.request_approval.col.recipient_name", tooltip: { fieldCd: "RCPT", fieldNameKey: "payment.field.recipient_name" }, render: (txn) => <EllipsisTooltip lines={2} text={txn.recipientName ?? ""} /> },
            { id: "remarks", labelKey: "payment.request_approval.col.remarks", minWidth: 212, tooltip: { fieldCd: "RMKS", fieldNameKey: "payment.field.remarks" }, render: (txn) => <EllipsisTooltip lines={2} text={txn.remarks ?? ""} /> },
            { id: "reporting_account", labelKey: "payment.request_approval.col.reporting_account", minWidth: 156, render: (txn) => <ReportingAccountReadCell txn={txn} /> },
            { id: "description", labelKey: "payment.request_approval.col.description", minWidth: 212, render: (txn) => <EllipsisTooltip lines={2} text={txn.description ?? ""} /> },
            { id: "document_no", labelKey: "payment.request_approval.col.document_no", render: (txn) => <EllipsisTooltip lines={2} text={txn.documentNo ?? ""} /> },
        ];
        return (
            <TxnTable
                columns={columns}
                transactions={transactions}
                blockedChars={blockedChars}
                minWidth={1058}
            />
        );
    }

    if (kind === "overseas-payment") {
        // Dedicated overseas beneficiary table (legacy comm_0195_001
        // APPR_DV=34) — mirrors the Request Approval dialog's overseas
        // table. Town Name sits between Beneficiary Address and Transfer
        // Amount. Beneficiary Name / Memo carry the blocked-chars tooltip
        // under the legacy BENA / MEMO field codes.
        const columns: TxnColumn[] = [
            { id: "beneficiary_name", labelKey: "payment.overseas.col.beneficiary_name", tooltip: { fieldCd: "BENA", fieldNameKey: "payment.field.beneficiary_name" }, render: (txn) => <EllipsisTooltip lines={2} text={txn.recipientName ?? ""} /> },
            { id: "beneficiary_bank_name", labelKey: "payment.overseas.col.beneficiary_bank_name", minWidth: 180, render: (txn) => <EllipsisTooltip lines={2} text={txn.depositBankName ?? ""} /> },
            { id: "beneficiary_account_no", labelKey: "payment.overseas.col.beneficiary_account_no", minWidth: 180, render: (txn) => <EllipsisTooltip lines={2} text={txn.depositAccountNo ?? ""} /> },
            { id: "beneficiary_address", labelKey: "payment.overseas.col.beneficiary_address", minWidth: 240, tooltip: { fieldCd: "BEAD", fieldNameKey: "payment.field.beneficiary_address" }, render: (txn) => <EllipsisTooltip lines={2} text={txn.beneficiaryAddress ?? ""} /> },
            { id: "town_name", labelKey: "payment.overseas.col.town_name", render: (txn) => <EllipsisTooltip lines={2} text={txn.townName ?? ""} /> },
            { id: "transfer_amount", labelKey: "payment.overseas.col.transfer_amount", align: "right", render: (txn) => txn.transferAmount },
            { id: "fee_payer", labelKey: "payment.overseas.col.fee_payer", render: (txn) => txn.feePayer ?? "" },
            { id: "memo", labelKey: "payment.overseas.col.memo", minWidth: 160, tooltip: { fieldCd: "MEMO", fieldNameKey: "payment.field.memo" }, render: (txn) => <EllipsisTooltip lines={2} text={txn.remarks ?? ""} /> },
            { id: "reporting_account", labelKey: "payment.overseas.col.reporting_account", minWidth: 156, render: (txn) => <ReportingAccountReadCell txn={txn} /> },
        ];
        return (
            <TxnTable
                columns={columns}
                transactions={transactions}
                blockedChars={blockedChars}
                minWidth={1440}
            />
        );
    }

    // Generic Vendor / Expense — 8 columns. Order preserved exactly:
    // Deposit Bank · Transfer Amount · Recipient Name · Remarks ·
    // Contact Name · Description · Document No. · Reporting Account.
    // (Overseas now renders its own beneficiary table above.)
    const recipientFieldCd = "RCPT";
    const remarkFieldCd    = "RMKS";
    const recipientFieldNameKey = "payment.field.recipient_name";
    const remarkFieldNameKey = "payment.field.remarks";
    const columns: TxnColumn[] = [
        { id: "deposit_bank", labelKey: "payment.request_approval.col.deposit_bank", render: (txn) => <DepositBankReadCell txn={txn} /> },
        { id: "transfer_amount", labelKey: "payment.request_approval.col.transfer_amount", align: "right", render: (txn) => txn.transferAmount },
        { id: "recipient_name", labelKey: "payment.request_approval.col.recipient_name", tooltip: { fieldCd: recipientFieldCd, fieldNameKey: recipientFieldNameKey }, render: (txn) => <EllipsisTooltip lines={2} text={txn.recipientName ?? ""} /> },
        { id: "remarks", labelKey: "payment.request_approval.col.remarks", minWidth: 212, tooltip: { fieldCd: remarkFieldCd, fieldNameKey: remarkFieldNameKey }, render: (txn) => <EllipsisTooltip lines={2} text={txn.remarks ?? ""} /> },
        { id: "contact_name", labelKey: "payment.request_approval.col.contact_name", render: (txn) => <EllipsisTooltip lines={2} text={txn.contactName ?? ""} /> },
        { id: "description", labelKey: "payment.request_approval.col.description", minWidth: 212, render: (txn) => <EllipsisTooltip lines={2} text={txn.description ?? ""} /> },
        { id: "document_no", labelKey: "payment.request_approval.col.document_no", render: (txn) => <EllipsisTooltip lines={2} text={txn.documentNo ?? ""} /> },
        { id: "reporting_account", labelKey: "payment.request_approval.col.reporting_account", minWidth: 156, render: (txn) => <ReportingAccountReadCell txn={txn} /> },
    ];
    return (
        <TxnTable
            columns={columns}
            transactions={transactions}
            blockedChars={blockedChars}
            minWidth={1180}
        />
    );
}

/* ── Column-driven transaction table ───────────────────────────────
 *  Shared chrome for the read-only Transaction Details table: identical
 *  scroll wrapper, header background (`bg-wb-bg-sidebar`), borders
 *  (`border-wb-table-border` on the header <tr> + fixed `--h-wb-table-head`
 *  height so the body never crowds the header), cell padding (`px-3 py-3`,
 *  matching the standard ERP Transaction History table), typography
 *  (`text-wb-13`, header `font-semibold` / body `font-medium text-wb-ink`)
 *  and row height as every other Approval Details table. Callers supply
 *  only the column definitions — header label key, alignment, optional
 *  min-width + blocked-chars tooltip, and a per-cell `render`. Used by every
 *  table kind (Internal Transfer, Payroll, and the generic Vendor / Expense /
 *  Overseas branch) so all share one provably-identical header/body structure
 *  — only the columns differ. Card uses its own grid layout, not this table. */
type TxnColumn = {
    id:        string;
    labelKey:  string;
    align?:    "left" | "right";
    minWidth?: number;
    tooltip?:  { fieldCd: import("@/lib/api/blockedChars").FieldCd; fieldNameKey: string };
    render:    (txn: RequestApprovalTransaction) => React.ReactNode;
};

function TxnTable({
    columns,
    transactions,
    blockedChars,
    minWidth,
}: {
    columns: TxnColumn[];
    transactions: RequestApprovalTransaction[];
    blockedChars: import("@/lib/api/blockedChars").BlockedCharsMap;
    minWidth: number;
}) {
    const { t } = useTranslation();
    return (
        <div className="custom-scrollbar-x mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-wb-13" style={{ minWidth }}>
                {/* Header chrome mirrors the standard ERP Transaction History
                 *  table: the bottom border + fixed row height live on the
                 *  header <tr> (NOT the <thead> — a row-group border renders
                 *  unreliably under border-collapse, which let the first body
                 *  row crowd the header). `bg-wb-bg-sidebar` on <thead> covers
                 *  the full header row; `py-3 align-middle` matches the
                 *  reference header height/padding. */}
                <thead className="bg-wb-bg-sidebar text-wb-dark">
                    <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                        {columns.map((col) => (
                            <th
                                key={col.id}
                                className={cn(
                                    "whitespace-nowrap px-3 py-3 align-middle font-semibold",
                                    col.align === "right" ? "text-right" : "text-left",
                                )}
                                style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                            >
                                {col.tooltip ? (
                                    <span className="inline-flex items-center gap-1">
                                        {t(col.labelKey)}
                                        <BlockedCharsTooltip
                                            fieldCd={col.tooltip.fieldCd}
                                            fieldNameKey={col.tooltip.fieldNameKey}
                                            blockedChars={blockedChars}
                                        />
                                    </span>
                                ) : (
                                    t(col.labelKey)
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((txn) => (
                        <tr key={txn.id} className="border-b border-wb-table-border last:border-b-0">
                            {columns.map((col) => (
                                <td
                                    key={col.id}
                                    className={cn(
                                        "px-3 py-3 align-top font-medium text-wb-ink",
                                        col.align === "right" && "text-right",
                                    )}
                                >
                                    {col.render(txn)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function DepositBankReadCell({ txn }: { txn: RequestApprovalTransaction }) {
    // Skip the "- {bankName}" separator when the resolver returned a
    // blank name — otherwise the cell renders "616 - " (trailing dash)
    // when the legacy `wb_get_napas_bank_nm_or_citad_bank_nm` lookup
    // misses for a CITAD-format bank code.
    return (
        <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span>
                    {txn.depositBankCode}
                    {txn.depositBankName ? ` - ${txn.depositBankName}` : ""}
                </span>
                <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5 shrink-0 text-wb-ntrl-6" aria-hidden>
                    <path d="M8 1L2 4v1h12V4L8 1zM3 6h2v6H3V6zm3.5 0h2v6h-2V6zM10 6h2v6h-2V6zM2 13h12v1H2v-1z" />
                </svg>
                <span className="text-wb-ntrl-6">{txn.depositBankCcyCd}</span>
            </span>
            {txn.depositAccountNo && (
                <span className="text-wb-12 font-normal text-wb-ntrl-6">{txn.depositAccountNo}</span>
            )}
        </div>
    );
}

function ReportingAccountReadCell({ txn }: { txn: RequestApprovalTransaction }) {
    if (!txn.reportingAccount) return null;
    // Two stacked lines (name + breadcrumb); each truncates to a single line
    // with a hover tooltip so the cell stays at most 2 lines tall.
    return (
        <div className="flex flex-col gap-0.5">
            <EllipsisTooltip
                text={txn.reportingAccount}
                className="font-medium text-wb-ink"
            />
            {txn.reportingBreadcrumb && (
                <EllipsisTooltip
                    text={txn.reportingBreadcrumb}
                    className="text-wb-12 font-normal text-wb-ntrl-6"
                />
            )}
        </div>
    );
}

/* ── Read-only card cell — kind="card". Read-only twin of the Request
 *  Approval `CardTransactionCell` (Figma 7503:47745 / 7503:47793): a fixed
 *  340×325 card with the SAME chrome as the create dialog, minus the editable
 *  dropdown / Save / textarea. Three zones:
 *    1. Header — list icon + reporting account name (or "N/A")
 *    2. Body   — merchant name (bold, 2-line clamp) + read-only description
 *    3. Footer — currency (left) + amount (right), pinned to the bottom
 *  No metadata grid — the design / legacy card does not show one. */
function ReadOnlyCardCell({ txn }: { txn: RequestApprovalTransaction }) {
    const reporting = txn.reportingAccount && txn.reportingAccount.trim() !== ""
        ? txn.reportingAccount
        : "N/A";
    return (
        <div className="flex h-[325px] max-h-[325px] min-h-[325px] w-[340px] max-w-[340px] min-w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border border-wb-ntrl-4 bg-white shadow-wb-card">
            {/* Body — grows to fill so the footer pins to the bottom and every
                card in a row shares one height (mirrors CardTransactionCell). */}
            <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
                {/* Header — Reporting Account (read-only): list icon + name. */}
                <div className="flex items-center gap-2">
                    <svg
                        aria-hidden
                        width="18"
                        height="18"
                        viewBox="0 0 21 21"
                        className="shrink-0 text-wb-ink"
                    >
                        <path
                            fill="currentColor"
                            d="M4.17 7.66c-.59 0-1.07-.48-1.07-1.07s.48-1.07 1.07-1.07 1.07.48 1.07 1.07-.48 1.07-1.07 1.07Zm3.44-.32c-.42 0-.75-.33-.75-.75s.33-.75.75-.75h9.54c.42 0 .75.33.75.75s-.33.75-.75.75H7.61ZM4.17 12.04c-.59 0-1.07-.48-1.07-1.07s.48-1.07 1.07-1.07 1.07.48 1.07 1.07-.48 1.07-1.07 1.07Zm3.44-.32c-.42 0-.75-.33-.75-.75s.33-.75.75-.75h9.54c.42 0 .75.33.75.75s-.33.75-.75.75H7.61ZM4.17 16.42c-.59 0-1.07-.48-1.07-1.07s.48-1.07 1.07-1.07 1.07.49 1.07 1.07-.48 1.07-1.07 1.07Zm3.44-.32c-.42 0-.75-.33-.75-.75s.33-.75.75-.75h9.54c.42 0 .75.33.75.75s-.33.75-.75.75H7.61Z"
                        />
                    </svg>
                    <span className="truncate text-wb-13 font-medium text-wb-ink">{reporting}</span>
                </div>

                {/* Merchant name — wraps to two lines like the design. */}
                <p
                    className="line-clamp-2 text-wb-13 font-semibold leading-5 text-wb-dark"
                    title={txn.recipientName ?? ""}
                >
                    {txn.recipientName ?? ""}
                </p>

                {/* Description (read-only) — expands into the remaining height;
                    scrolls in place when longer than the card. */}
                <p className="custom-scrollbar-y min-h-16 flex-1 overflow-auto whitespace-pre-line text-wb-13 font-normal leading-5 text-wb-ink">
                    {txn.description ?? ""}
                </p>
            </div>

            {/* Footer — pinned to the card bottom; currency left, amount right. */}
            <div className="flex shrink-0 items-center justify-between border-t border-wb-border-sidebar bg-wb-bg-card px-4 py-3">
                <span className="text-wb-12 font-medium uppercase tracking-wide text-wb-ntrl-6">
                    {txn.depositBankCcyCd}
                </span>
                <span className="text-wb-14 font-semibold text-wb-dark">
                    {txn.transferAmount}
                </span>
            </div>
        </div>
    );
}

