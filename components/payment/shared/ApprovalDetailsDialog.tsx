"use client";

import { ChevronDown, ChevronUp, MoreVertical, X, Pencil, Trash2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import BlockedCharsTooltip from "@/components/shared/BlockedCharsTooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useBlockedChars } from "@/hooks/useBlockedChars";
import { userStorage } from "@/lib/auth/storage";
import { useTranslation } from "@/lib/i18n";
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
        seq:     a.apprvr_line_no,
        id:      a.apprvr_id,
        name:    a.apprvr_nm,
        outcome: a.apprvr_stts as ApproverStatusCode,
        actedAt: formatApproverActedAt(a.appr_dtm),
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

/** Format a UTC `yyyyMMddHHmmss` approver-act timestamp → `DD-MM-YYYY HH:mm`.
 *  Returns undefined for null/short input (pending/waiting rows have no
 *  `appr_dtm`), so the chip renders the verb without a date. Mirrors the
 *  Overseas approver-chip formatter. */
function formatApproverActedAt(raw: string | null): string | undefined {
    if (!raw || raw.length < 12) return undefined;
    return `${raw.slice(6, 8)}-${raw.slice(4, 6)}-${raw.slice(0, 4)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}`;
}

export type ApprovalDetailsAttachment = {
    id:        string;
    name:      string;
    size:      string;
    /** Optional download handler — left as a no-op for static UI. */
    onDownload?: () => void;
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
    /** Edit-mode Save handler — fires when the user commits the new
     *  approval line. */
    onEditSave?:    () => void | Promise<void>;
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

export default function ApprovalDetailsDialog({
    kind,
    title,
    status,
    documentNo,
    scheduledDate,
    totalAmount,
    withdrawalAccount,
    approvalLineName,
    content,
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
    onEditSave,
    onEditCancel,
    editSaveDisabled = false,
}: ApprovalDetailsDialogProps) {
    const { t } = useTranslation();

    /* ── Section collapse state ─────────────────────────────────── */
    const [showGeneral, setShowGeneral]     = useState(true);
    const [showContent, setShowContent]     = useState(true);
    const [showTransactions, setShowTxns]   = useState(true);
    const [menuOpen, setMenuOpen]           = useState(false);

    const needsAccount = kind !== "card";
    // Collapsed-by-default attachment list — keeps the footer tidy when
    // many files are attached. Mirrors the RequestApprovalDialog
    // pattern (`Attachments (N)` + chevron toggle).
    const [attachmentsOpen, setAttachmentsOpen] = useState(false);

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
                {/* Header bar */}
                <div className="flex shrink-0 items-center justify-between border-b border-wb-table-border px-6 py-3.5">
                    <span className="text-wb-16 font-semibold text-wb-dark">
                        {t("payment.approval_details.title")}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="rounded border border-wb-ntrl-4 bg-wb-bg-sidebar px-1.5 py-0.5 text-wb-11 font-medium text-wb-ntrl-6">
                            Esc
                        </span>
                        <button
                            type="button"
                            onClick={handleClose}
                            aria-label={t("dialog.close")}
                            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-wb-ink hover:bg-black/5"
                        >
                            <X className="size-4" strokeWidth={1.8} />
                        </button>
                    </div>
                </div>

                {/* Body — scrollable */}
                <div className="custom-scrollbar-y flex-1 overflow-y-auto px-6 py-5">
                    {/* Title row — big title + status badge + kebab */}
                    <div className="flex items-start justify-between gap-3 border-b border-wb-table-border pb-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <h2 className="truncate text-wb-24 font-semibold text-wb-dark">
                                {title}
                            </h2>
                            <StatusBadge outcome={status} />
                        </div>
                        {onMenuAction && (status === "pending" || status === "in_progress" || status === "rejected") && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setMenuOpen((v) => !v)}
                                    aria-label={t("dialog.more_actions")}
                                    className="flex size-7 cursor-pointer items-center justify-center rounded-md text-wb-ink hover:bg-black/5"
                                >
                                    <MoreVertical className="size-4" strokeWidth={1.8} />
                                </button>
                                {menuOpen && (
                                    <div className="absolute right-0 top-9 z-10 flex min-w-[160px] flex-col rounded-md border border-wb-ntrl-4 bg-white p-1 shadow-lg animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out">
                                        {(status === "rejected"
                                            ? (["edit", "resubmit"] as const)
                                            : (status === "pending" || status === "in_progress"
                                                ? (["edit", "withdraw"] as const)
                                                : ([] as const))
                                        ).map((action) => {
                                            const isDelete = action === "withdraw";
                                            return (
                                                <button
                                                    key={action}
                                                    type="button"
                                                    onClick={() => {
                                                        onMenuAction(action);
                                                        setMenuOpen(false);
                                                    }}
                                                    className={cn(
                                                        "flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-wb-13 font-medium hover:bg-wb-bg-sidebar",
                                                        isDelete ? "text-wb-status-rejected-text" : "text-wb-ink",
                                                    )}
                                                >
                                                    {action === "edit" && (
                                                        <Pencil className="size-3.5 text-wb-ntrl-6" strokeWidth={1.8} />
                                                    )}
                                                    {action === "withdraw" && (
                                                        <Trash2 className="size-3.5 text-wb-status-rejected-text" strokeWidth={1.8} />
                                                    )}
                                                    {action === "resubmit" && (
                                                        <RefreshCw className="size-3.5 text-wb-ntrl-6" strokeWidth={1.8} />
                                                    )}
                                                    {t(
                                                        action === "withdraw"
                                                            ? "payment.approval_details.menu.delete"
                                                            : `payment.approval_details.menu.${action}`,
                                                    )}
                                                </button>
                                            );
                                        })}
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
                        <div className="grid grid-cols-[1fr_1fr] gap-x-12 gap-y-4 pt-4">
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
                                        value={totalAmount}
                                    />
                                )}
                            </div>
                            {/* Right column */}
                            <div className="flex flex-col gap-3">
                                {needsAccount && withdrawalAccount && (
                                    <InfoRow
                                        icon="bank"
                                        label={t("payment.request_approval.row.withdrawal_bank")}
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
                                {(approvers.length > 0 || editMode) && (
                                    <InfoRow
                                        icon="check"
                                        label={t("payment.request_approval.row.approver", {
                                            current: String(
                                                approvers.filter((a) => toStatusCode(a.outcome) === "A").length,
                                            ),
                                            total: String(approvers.length),
                                        })}
                                    >
                                        <div className="flex flex-col gap-2">
                                            {editMode && editApproverSlot}
                                            {approvers.length > 0 && (
                                                <div className="flex flex-col gap-1.5">
                                                    {approvers.map((a) => (
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

                    {/* Approval Content section */}
                    {content !== undefined && (
                        <Section
                            title={t("payment.request_approval.section.content")}
                            open={showContent}
                            onToggle={() => setShowContent((v) => !v)}
                        >
                            <div className="pt-3 text-wb-13 font-normal text-wb-ink">
                                {content || (
                                    <span className="text-wb-ntrl-6">
                                        {t("payment.approval_details.no_content")}
                                    </span>
                                )}
                            </div>
                        </Section>
                    )}

                    {/* Transaction Details section — kind-conditional layout */}
                    <Section
                        title={t("payment.request_approval.section.transactions", {
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
                 *  left  → "Requested by {name} on {date}" + optional Attach /
                 *          Attachment count chip group (no-op when no files)
                 *          + Reject / Approve buttons (rendered only when the
                 *          caller wires the matching callbacks)
                 *  right → Close button (always rendered)                  */}
                <div className="flex shrink-0 flex-col gap-2 border-t border-wb-table-border px-6 py-3">
                    {attachments.length > 0 && (
                        <div className="flex flex-col gap-2">
                            {/* Toggle — `Attachments (N)` chevron. Same pattern
                             *  as `RequestApprovalDialog` so the popup looks
                             *  uncluttered when the user attached many files. */}
                            <button
                                type="button"
                                onClick={() => setAttachmentsOpen((v) => !v)}
                                className="inline-flex w-fit items-center gap-1 text-wb-13 font-medium text-brand hover:underline"
                            >
                                {t("payment.request_approval.attachment_count", {
                                    count: String(attachments.length),
                                })}
                                {attachmentsOpen ? (
                                    <ChevronUp className="size-3.5" strokeWidth={1.8} />
                                ) : (
                                    <ChevronDown className="size-3.5" strokeWidth={1.8} />
                                )}
                            </button>
                            {attachmentsOpen && (
                                <div className="flex flex-wrap items-center gap-2">
                                    {attachments.map((f) => (
                                        <AttachmentChip key={f.id} file={f} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {/* Legacy `comm_0195_001` lines 892-923: left zone
                     *  carries "Requested by..." followed by Reject +
                     *  Approve; right zone carries only Close. */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-wb-13 font-normal text-wb-ntrl-6">
                                {t("payment.approval_details.requested_by", {
                                    name: requestedBy,
                                    date: requestedAt,
                                })}
                            </span>
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
                                    onClick={onEditSave}
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
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ── Status badge — top of the body next to the title ─────────────── */

function StatusBadge({ outcome }: { outcome: ApprovalOutcome }) {
    const { t } = useTranslation();
    const cls = {
        approved:     "bg-wb-status-approved-bg text-wb-status-approved-text",
        rejected:     "bg-wb-status-rejected-bg text-wb-status-rejected-text",
        pending:      "bg-wb-status-pending-bg text-wb-status-pending-text",
        in_progress:  "bg-wb-status-progress-bg text-wb-status-progress-text",
    }[outcome];
    return (
        <span
            className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-wb-12 font-medium",
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
    open,
    onToggle,
    children,
}: {
    title: string;
    open:  boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="mt-6">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full cursor-pointer items-center justify-between border-b border-wb-table-border pb-2 text-left"
            >
                <span className="text-wb-15 font-semibold text-wb-dark">{title}</span>
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
        <div className="grid grid-cols-[180px_1fr] items-start gap-3">
            <div className="flex items-center gap-2 pt-1 text-wb-13 font-medium text-wb-ntrl-8">
                <RowIcon name={icon} />
                <span>{label}</span>
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
            return (
                <svg viewBox="0 0 16 16" fill="currentColor" className={common} aria-hidden>
                    <path d="M4 3h8v1H4V3zm0 2h8v1H4V5zm0 2h5v1H4V7zm0 2h5v1H4V9zm0 2h8v1H4v-1zm0 2h8v1H4v-1z" />
                </svg>
            );
        case "check":
            return (
                <svg viewBox="0 0 16 16" fill="currentColor" className={common} aria-hidden>
                    <path d="M14 4.5l-7 7-4-4 .708-.707L7 10.086l6.292-6.293L14 4.5z" />
                </svg>
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

    return (
        <span className="inline-flex max-w-fit items-center gap-1.5 rounded border border-wb-ntrl-4 bg-white px-2 py-1 text-wb-13 font-medium text-wb-ink">
            <span className="text-wb-ntrl-6">{approver.seq}</span>
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-wb-bg-sidebar text-wb-11">
                <ApproverGlyph code={code} />
            </span>
            <span className="uppercase">
                {cleanName(approver.name)}
                {approver.id === userStorage.get()?.userId && ` ${t("settings.users.you_suffix")}`}
            </span>
            <span className={cn("ml-1 text-wb-12 font-normal", display.verbClass)}>
                {showDate
                    ? t(display.verbKey, { date: approver.actedAt ?? "" })
                    : t(display.verbKey)}
            </span>
            <StatusGlyph code={code} />
        </span>
    );
}

/** Avatar circle glyph — silhouette inside the round chip background. */
function ApproverGlyph({ code }: { code: ApproverStatusCode }) {
    const tint = APPROVER_DISPLAY[code].verbClass;
    return (
        <svg viewBox="0 0 16 16" fill="currentColor" className={cn("size-3", tint)} aria-hidden>
            <circle cx="8" cy="6" r="2.5" />
            <path d="M3 13c0-2 2.5-3.5 5-3.5s5 1.5 5 3.5v1H3v-1z" />
        </svg>
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
            return (
                <svg viewBox="0 0 16 16" fill="currentColor" className={cn(common, "text-wb-status-rejected-text")} aria-hidden>
                    <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
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

function AttachmentChip({ file }: { file: ApprovalDetailsAttachment }) {
    const { t } = useTranslation();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const iconSrc = ext === "pdf"
        ? "/assets/common/ico-pdf.svg"
        : ext === "doc" || ext === "docx"
            ? "/assets/common/ico-word.svg"
            : "/assets/common/ico-excel.svg";
    return (
        <div className="flex items-center gap-2 rounded-md border border-wb-ntrl-4 bg-white px-3 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={iconSrc}
                alt=""
                aria-hidden
                onError={(e) => { (e.currentTarget.style.display = "none"); }}
                className="size-4 shrink-0"
            />
            <span className="text-wb-13 font-medium text-wb-ink">{file.name}</span>
            <span className="text-wb-12 font-normal text-wb-ntrl-6">{file.size}</span>
            <button
                type="button"
                onClick={file.onDownload}
                aria-label={t("common.download")}
                className="flex size-5 cursor-pointer items-center justify-center rounded-full bg-brand hover:bg-brand-hover"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/common/ico-download.svg"
                    alt=""
                    aria-hidden
                    className="size-4 brightness-0 invert"
                />
            </button>
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
        // Card grid per legacy `comm_0195_001.ts:968-1015`
        // (`CardDetails()` function) — each transaction is one card with:
        //   - Top:    list icon + reporting account name (or "N/A")
        //   - Body:   merchant name (bold) + description (read-only)
        //   - Footer: currency + amount (right-aligned)
        // Max 4 columns at xl (was 5) so each card reads ~25% wider.
        return (
            <div className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
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
        return (
            <div className="custom-scrollbar-x mt-3 overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse text-wb-13">
                    <thead className="border-b border-wb-table-border bg-wb-bg-sidebar text-wb-dark">
                        <tr>
                            <th className="px-2.5 py-2 text-left font-semibold">{t("payment.request_approval.col.deposit_bank")}</th>
                            <th className="px-2.5 py-2 text-right font-semibold">{t("payment.request_approval.col.transfer_amount")}</th>
                            <th className="px-2.5 py-2 text-left font-semibold">
                                <span className="inline-flex items-center gap-1">
                                    {t("payment.request_approval.col.recipient_name")}
                                    <BlockedCharsTooltip
                                        fieldCd="RCPT"
                                        fieldNameKey="payment.field.recipient_name"
                                        blockedChars={blockedChars}
                                    />
                                </span>
                            </th>
                            <th className="px-2.5 py-2 text-left font-semibold" style={{ minWidth: 212 }}>
                                <span className="inline-flex items-center gap-1">
                                    {t("payment.request_approval.col.remarks")}
                                    <BlockedCharsTooltip
                                        fieldCd="RMKS"
                                        fieldNameKey="payment.field.remarks"
                                        blockedChars={blockedChars}
                                    />
                                </span>
                            </th>
                            <th className="px-2.5 py-2 text-left font-semibold" style={{ minWidth: 156 }}>{t("payment.request_approval.col.reporting_account")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((txn) => (
                            <tr key={txn.id} className="border-b border-wb-table-border last:border-b-0">
                                <td className="px-2.5 py-2 font-medium text-wb-ink">
                                    <DepositBankReadCell txn={txn} />
                                </td>
                                <td className="px-2.5 py-2 text-right font-medium text-wb-ink">{txn.transferAmount}</td>
                                <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.recipientName ?? ""}</td>
                                <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.remarks ?? ""}</td>
                                <td className="px-2.5 py-2 font-medium text-wb-ink">
                                    <ReportingAccountReadCell txn={txn} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // Overseas tooltips key off the legacy beneficiary field codes
    // (BENA / MEMO) so block-character rules from TB_FIRM_BANK_CODE
    // resolve under the overseas registration.
    const recipientFieldCd = kind === "overseas-payment" ? "BENA" : "RCPT";
    const remarkFieldCd    = kind === "overseas-payment" ? "MEMO" : "RMKS";
    const recipientFieldNameKey = kind === "overseas-payment"
        ? "payment.field.beneficiary_name"
        : "payment.field.recipient_name";
    const remarkFieldNameKey = kind === "overseas-payment"
        ? "payment.field.memo"
        : "payment.field.remarks";
    return (
        <div className="custom-scrollbar-x mt-3 overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-wb-13">
                <thead className="border-b border-wb-table-border bg-wb-bg-sidebar text-wb-dark">
                    <tr>
                        <th className="px-2.5 py-2 text-left font-semibold">{t("payment.request_approval.col.deposit_bank")}</th>
                        <th className="px-2.5 py-2 text-right font-semibold">{t("payment.request_approval.col.transfer_amount")}</th>
                        <th className="px-2.5 py-2 text-left font-semibold">
                            <span className="inline-flex items-center gap-1">
                                {t("payment.request_approval.col.recipient_name")}
                                <BlockedCharsTooltip
                                    fieldCd={recipientFieldCd}
                                    fieldNameKey={recipientFieldNameKey}
                                    blockedChars={blockedChars}
                                />
                            </span>
                        </th>
                        <th className="px-2.5 py-2 text-left font-semibold" style={{ minWidth: 212 }}>
                            <span className="inline-flex items-center gap-1">
                                {t("payment.request_approval.col.remarks")}
                                <BlockedCharsTooltip
                                    fieldCd={remarkFieldCd}
                                    fieldNameKey={remarkFieldNameKey}
                                    blockedChars={blockedChars}
                                />
                            </span>
                        </th>
                        <th className="px-2.5 py-2 text-left font-semibold">{t("payment.request_approval.col.contact_name")}</th>
                        <th className="px-2.5 py-2 text-left font-semibold" style={{ minWidth: 212 }}>{t("payment.request_approval.col.description")}</th>
                        <th className="px-2.5 py-2 text-left font-semibold">{t("payment.request_approval.col.document_no")}</th>
                        <th className="px-2.5 py-2 text-left font-semibold" style={{ minWidth: 156 }}>{t("payment.request_approval.col.reporting_account")}</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((txn) => (
                        <tr key={txn.id} className="border-b border-wb-table-border last:border-b-0">
                            <td className="px-2.5 py-2 font-medium text-wb-ink">
                                <DepositBankReadCell txn={txn} />
                            </td>
                            <td className="px-2.5 py-2 text-right font-medium text-wb-ink">{txn.transferAmount}</td>
                            <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.recipientName ?? ""}</td>
                            <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.remarks ?? ""}</td>
                            <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.contactName ?? ""}</td>
                            <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.description ?? ""}</td>
                            <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.documentNo ?? ""}</td>
                            <td className="px-2.5 py-2 font-medium text-wb-ink">
                                <ReportingAccountReadCell txn={txn} />
                            </td>
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
            <span className="whitespace-nowrap">
                {txn.depositBankCode}
                {txn.depositBankName ? ` - ${txn.depositBankName}` : ""}
                {" "}
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
    return (
        <div className="flex flex-col gap-0.5">
            <span className="font-medium text-wb-ink">{txn.reportingAccount}</span>
            {txn.reportingBreadcrumb && (
                <span className="text-wb-12 font-normal text-wb-ntrl-6">{txn.reportingBreadcrumb}</span>
            )}
        </div>
    );
}

/* ── Read-only card cell — kind="card" (legacy comm_0195_001.ts:968-1015
 *  `CardDetails()`). Three-zone card:
 *    1. Top    — list icon + CHART_ACCT_NM or "N/A"  (bottom border)
 *    2. Middle — bold MERCH_NM + description block
 *    3. Footer — "VND"/ccy left + formatted amount right (top border)
 * ────────────────────────────────────────────────────────────── */
function ReadOnlyCardCell({ txn }: { txn: RequestApprovalTransaction }) {
    const reporting = txn.reportingAccount && txn.reportingAccount.trim() !== ""
        ? txn.reportingAccount
        : "N/A";
    return (
        <div className="flex flex-col overflow-hidden rounded-md border border-wb-table-border bg-white text-wb-13">
            {/* Top — list icon + reporting account */}
            <div className="flex items-center gap-2 border-b border-wb-table-border px-3 py-2">
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
                <span className="truncate font-medium text-wb-ink">{reporting}</span>
            </div>

            {/* Middle — merchant + description. `min-h-30` on the
                description block gives the card the +40% vertical room
                the legacy `textAreaUpdate` container reserves. */}
            <div className="flex flex-col gap-3 px-4 py-4">
                <span className="truncate text-wb-14 font-semibold text-wb-ink">
                    {txn.recipientName ?? ""}
                </span>
                {txn.description && txn.description.trim() !== "" ? (
                    <p className="min-h-30 whitespace-pre-line text-wb-13 font-normal text-wb-ntrl-8">
                        {txn.description}
                    </p>
                ) : (
                    <p className="min-h-30 text-wb-13 font-normal text-wb-ntrl-5">
                        Description (Max 200 characters)
                    </p>
                )}
            </div>

            {/* Footer — currency + amount */}
            <div className="flex items-center justify-between border-t border-wb-table-border px-3 py-2">
                <span className="font-medium text-wb-ink">{txn.depositBankCcyCd}</span>
                <span className="font-medium text-wb-ink">{txn.transferAmount}</span>
            </div>
        </div>
    );
}

