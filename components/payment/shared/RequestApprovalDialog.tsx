"use client";

import { ChevronDown, ChevronUp, Pin, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import BlockedCharsTooltip from "@/components/shared/BlockedCharsTooltip";
import DateField, { todayIso } from "@/components/shared/DateField";
import { useDialog } from "@/components/shared/dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useBlockedChars } from "@/hooks/useBlockedChars";
import { fetchApprovalLines } from "@/lib/api/approvalLine";
import type { PymnType } from "@/lib/api/blockedChars";
import { putCardTransactionReportingAccount } from "@/lib/api/cardTransactions";
import { fetchChartOfAccountsTree } from "@/lib/api/chartOfAccounts";
import { useApiData } from "@/lib/api/useApiData";
import type { ApiChartOfAccountTreeNode } from "@/lib/types/api";
import { ApiCallError } from "@/lib/api/banking";
import {
    submitInternalTransferApproval,
} from "@/lib/api/internalTransfer";
import { requestVendorApproval } from "@/lib/api/vendorPayment";
import { requestExpenseApproval } from "@/lib/api/expensePayment";
import { requestPayrollApproval } from "@/lib/api/payrollPayment";
import type {
    ApiApprovalLineRow,
    ApiRequestApprovalRequest,
} from "@/lib/types/api";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ============================================================================
 *  Shared "Request Approval" dialog — Figma frames 7480:50257 (Vendor /
 *  Expense / Internal Transfer), 7503:46899 (Payroll), 7503:47745 (Card).
 *
 *  One component, `kind`-driven, all three Transaction-Details variants
 *  live in this file. Mirrors legacy `comm_0194_001_view.jsp` +
 *  `comm_0194_001.ts:1295-1497` (functionCreateApproval).
 * ========================================================================== */

export type RequestApprovalKind =
    | "internal-transfer"   // legacy APPR_DV = 35
    | "vendor-payment"      // legacy APPR_DV = 32
    | "expense-payment"     // legacy APPR_DV = 31
    | "payroll"             // legacy APPR_DV = 21
    | "overseas-payment"    // legacy APPR_DV = 34
    | "card";               // legacy APPR_DV = 33

/** One batch the user has selected to submit for approval. */
export type RequestApprovalRow = {
    id:          string;
    fileName:    string;
    ccyCd:       string;
    /** Pre-formatted display amount. */
    totalAmount: string;
    txnCount:    number;
};

/** One per-line transaction shown inside the Transaction Details table.
 *  Vendor/Expense/Internal Transfer use 8 columns; Payroll uses 5;
 *  Card renders a grid of compact cards. Each variant pulls only the
 *  fields it needs — unused fields stay optional. */
export type RequestApprovalTransaction = {
    id:                 string;
    depositBankCode:    string;   // e.g. "970457"
    depositBankName:    string;   // e.g. "WooriBank"
    depositBankCcyCd:   string;   // e.g. "VND"
    depositAccountNo:   string;   // e.g. "00010000056912"
    transferAmount:     string;   // pre-formatted, e.g. "2.000.000đ"
    /** Recipient/Beneficiary name (Vendor/Expense/Internal Transfer/Payroll). */
    recipientName?:     string;
    /** Free-text remark (Vendor/Expense/Internal Transfer/Payroll). */
    remarks?:           string;
    /** Contact name (Vendor/Expense/Internal Transfer only). */
    contactName?:       string;
    /** Description (Vendor/Expense/Internal Transfer only). */
    description?:       string;
    /** Document number (Vendor/Expense/Internal Transfer only). */
    documentNo?:        string;
    /** Reporting account label (all kinds). e.g. "2001019 - Payables". */
    reportingAccount?:  string;
    /** Reporting account breadcrumb (all kinds). e.g. "Revenue > Sales". */
    reportingBreadcrumb?: string;
    feePayer?:         string; // For overseas: "OUR", "SHA", "BEN"
    /** Card purpose — `CARD_TRNS_USAGE_NM` for card kind. Only used by
     *  the read-only Approval Details popup's card 4-column table
     *  (matches legacy `comm_0195_001.ts:1513`). */
    purpose?:          string;
};

export type RequestApprovalAccount = {
    bankCd:     string;
    bankNm:     string;
    acctNo:     string;
    ccyCd:      string;
    acctTypeCd: string;
    acctNickNm: string | null;
};

export type RequestApprovalDialogProps = {
    kind:          RequestApprovalKind;
    /** Batches the user checked on the list page. */
    selectedRows:  RequestApprovalRow[];
    /** Per-line transactions for the Transaction Details table.
     *  Vendor/Expense/Internal Transfer/Payroll use this; Card uses
     *  the same shape but renders as a card grid. Pages with a real
     *  per-batch detail endpoint should pass `loadTransactions`
     *  instead so the dialog renders live upload data — the static
     *  prop is the immediate-paint fallback. */
    transactions?: RequestApprovalTransaction[];
    /** Async loader for the per-line transactions. When provided the
     *  dialog calls this on mount and renders the resolved list once
     *  it lands; the synchronous `transactions` prop becomes the
     *  pre-load placeholder. Mirrors the pattern of
     *  `loadWithdrawalAccounts` so both async data sources share one
     *  rhythm. */
    loadTransactions?: () => Promise<RequestApprovalTransaction[]>;
    /** Document number to display in the "Document No." field. Falls
     *  back to the first selectedRow id when omitted. */
    documentNo?:   string;
    /** Async loader for the withdrawal-account dropdown. Skipped for
     *  `kind === "card"` (Card payment has no withdrawal account), and
     *  ignored when {@link fixedWithdrawalAccount} is supplied. */
    loadWithdrawalAccounts?: () => Promise<RequestApprovalAccount[]>;
    /** Read-only withdrawal account. When provided, the Withdrawal Bank
     *  row renders this as plain text (no dropdown) and uses it for the
     *  submit `bank_cd` / `acct_no` / `ccy_cd` and the Request-button
     *  gating. Use this when the account was already chosen upstream
     *  (e.g. Internal Transfer picks it at Excel-upload time and saves
     *  it on the batch — re-selecting it at approval time has no effect).
     *  Takes precedence over {@link loadWithdrawalAccounts}. */
    fixedWithdrawalAccount?: {
        /** Internal bank code — drives the Remarks blocked-chars tooltip
         *  and the submit `bank_cd`. Optional. */
        bankCd?: string;
        acctNo:  string;
        ccyCd:   string;
        /** Pre-formatted label, e.g. "Shinhan VN 700071155641 (Current VND)". */
        display: string;
    };
    onClose:       () => void;
    onSubmitted?:  (apprSeqNo: string) => void;
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
 * PR7: Payroll Type selector value → legacy {@code APPR_FUND_TP} code
 * ({@code "0"}=Salary, {@code "1"}=Bonus, {@code "9"}=Other). Sent on the
 * Payroll Request Approval payload so the Scheduled/Result lists can render
 * the Payroll Type column. The dialog only offers Salary/Bonus today; "other"
 * is mapped defensively in case the option set grows.
 */
const PAYROLL_TYPE_CODE: Record<string, string> = {
    salary: "0",
    bonus:  "1",
    other:  "9",
};

/**
 * Map the user-facing dialog kind onto the backend
 * {@code BLOCKED_CHARS_RULE.PYMN_TPYE} code so {@link useBlockedChars}
 * can look up the bank-specific tooltip ruleset. Returns {@code null}
 * for the {@code card} kind — Corporate Card doesn't ship its own
 * blocked-chars rules, so the Remarks header degrades to the static
 * info glyph.
 *
 * <p>Exported so {@link ApprovalDetailsDialog} (the read-only sibling)
 * can use the same mapping — one source of truth for the kind ↔
 * PymnType pairing across both popups.
 */
export function kindToPymnType(kind: RequestApprovalKind): PymnType | null {
    switch (kind) {
        case "internal-transfer": return "INTR";
        case "vendor-payment":    return "VEND";
        case "expense-payment":   return "EXPN";
        case "payroll":           return "PAYR";
        case "overseas-payment":  return "OVER";
        case "card":              return null;
    }
}

export default function RequestApprovalDialog({
    kind,
    selectedRows,
    transactions = [],
    loadTransactions,
    documentNo,
    loadWithdrawalAccounts,
    fixedWithdrawalAccount,
    onClose,
    onSubmitted,
}: RequestApprovalDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

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

    /* ── Form state ─────────────────────────────────────────────── */
    const [title, setTitle]                 = useState("");
    // Default to today (ISO `YYYY-MM-DD`) so the picker boots with a sane
    // value and Submit doesn't trip an empty-date validation. Mirrors
    // legacy `comm_0194_001.ts` which sets `#PAY_DATE` to the system date
    // on dialog open.
    const [scheduledDate, setSchedDate]     = useState(todayIso());
    const [description, setDescription]     = useState("");
    const [payrollType, setPayrollType]     = useState("salary");
    const [files, setFiles]                 = useState<File[]>([]);
    const [attachmentsOpen, setAttachOpen]  = useState(false);
    const [submitting, setSubmitting]       = useState(false);

    /* ── Section collapse state ─────────────────────────────────── */
    const [showGeneral, setShowGeneral]     = useState(true);
    const [showContent, setShowContent]     = useState(true);
    const [showTransactions, setShowTxns]   = useState(true);

    /* ── Per-line transactions (live fetch) ─────────────────────── */
    // When `loadTransactions` is provided the dialog fetches the real
    // per-line rows on mount and renders them once they land. The
    // synchronous `transactions` prop becomes the pre-load placeholder
    // (mostly used by static pages that don't have a backend detail
    // endpoint yet). Mirrors the `loadWithdrawalAccounts` pattern below.
    const [loadedTxns, setLoadedTxns] = useState<RequestApprovalTransaction[] | null>(null);
    const [loadingTxns, setLoadingTxns] = useState<boolean>(Boolean(loadTransactions));

    useEffect(() => {
        if (!loadTransactions) return;
        let cancelled = false;
        setLoadingTxns(true);
        loadTransactions()
            .then((list) => { if (!cancelled) setLoadedTxns(list); })
            .catch(() => { if (!cancelled) setLoadedTxns([]); })
            .finally(() => { if (!cancelled) setLoadingTxns(false); });
        return () => { cancelled = true; };
    }, [loadTransactions]);

    const visibleTransactions: RequestApprovalTransaction[] =
        loadTransactions ? (loadedTxns ?? []) : transactions;

    /* ── Withdrawal accounts ────────────────────────────────────── */
    const [accounts, setAccounts] = useState<RequestApprovalAccount[]>([]);
    const [selectedAccountKey, setSelectedAccountKey] = useState<string>("");
    const needsAccount = kind !== "card";

    useEffect(() => {
        if (!needsAccount || !loadWithdrawalAccounts) return;
        let cancelled = false;
        loadWithdrawalAccounts()
            .then((list) => {
                if (cancelled) return;
                setAccounts(list);
                if (list.length > 0) setSelectedAccountKey(accountKey(list[0]));
            })
            .catch(() => { /* silent — picker stays empty */ });
        return () => { cancelled = true; };
    }, [needsAccount, loadWithdrawalAccounts]);

    const selectedAccount = useMemo(
        () => accounts.find((a) => accountKey(a) === selectedAccountKey) ?? null,
        [accounts, selectedAccountKey],
    );

    // Read-only mode wins: when the caller passes a fixed withdrawal
    // account (chosen upstream — e.g. at Internal Transfer Excel upload),
    // the dialog renders it as text and uses it for submit + gating +
    // the blocked-chars tooltip. Otherwise it falls back to the
    // editable dropdown's `selectedAccount`. `effBankCd`/`effAcctNo`/
    // `effCcyCd` are the single source the submit + gating read, so
    // neither path needs to special-case the other below.
    const fixedAccountMode = !!fixedWithdrawalAccount;
    const effBankCd = fixedWithdrawalAccount?.bankCd ?? selectedAccount?.bankCd;
    const effAcctNo = fixedWithdrawalAccount?.acctNo ?? selectedAccount?.acctNo;
    const effCcyCd  = fixedWithdrawalAccount?.ccyCd  ?? selectedAccount?.ccyCd;
    // Whether a withdrawal account is resolved (for the Request gating).
    // In fixed mode it's always present; otherwise it depends on the
    // dropdown selection.
    const hasWithdrawalAccount = fixedAccountMode || !!selectedAccount;

    // Bank-specific blocked-chars tooltip — drives the Remarks ⓘ
    // glyph in the Transaction Details table header. Keys on the
    // effective withdrawal bank (`effBankCd`) and the dialog `kind`
    // mapped to PymnType. Card kind returns null PymnType → we
    // short-circuit by passing a null bankCd to the hook, which returns
    // an empty map without firing the request. Hook re-fires when the
    // user picks a different withdrawal account (editable mode).
    const pymnType = useMemo(() => kindToPymnType(kind), [kind]);
    const blockedChars = useBlockedChars(
        pymnType ? (effBankCd ?? null) : null,
        pymnType ?? "INTR",  // fallback is unused when bankCd is null
    );

    /* ── Approval lines (real backend) ──────────────────────────── */
    const [apprLines, setApprLines] = useState<ApiApprovalLineRow[]>([]);
    const [selectedApprLineNo, setSelectedApprLineNo] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchApprovalLines()
            .then((res) => {
                if (cancelled) return;
                const lines = res.approval_lines ?? [];
                setApprLines(lines);
                if (lines.length > 0) setSelectedApprLineNo(lines[0].appr_line_no);
            })
            .catch(() => { /* silent fallback */ });
        return () => { cancelled = true; };
    }, []);

    const selectedApprLine = useMemo(
        () => apprLines.find((l) => l.appr_line_no === selectedApprLineNo) ?? null,
        [apprLines, selectedApprLineNo],
    );

    /* ── Computed totals ────────────────────────────────────────── */
    const totalTransferDisplay = useMemo(() => {
        if (selectedRows.length === 0) return "0";
        // Sum across rows assuming all share one currency. When mixed
        // currencies present (rare), show the first row's currency +
        // a sum-of-numerics. The numeric strip handles "1,234.56" / "1.234,56"
        // by removing every non-digit, non-comma, non-period and then
        // collapsing thousand separators.
        const ccyCd = selectedRows[0].ccyCd;
        const sum = selectedRows.reduce((acc, r) => {
            // Coerce to string defensively — Spring Boot's Jackson
            // serializes BigDecimal as a JSON number, so `totalAmount`
            // can arrive as a number despite the wire type saying
            // `string`. Without this, `.replace` throws "is not a
            // function" on the number.
            const raw = String(r.totalAmount ?? "");
            const cleaned = raw
                .replace(/[^\d.,-]/g, "")
                .replace(/[,.](?=\d{3}\b)/g, "");
            const n = Number(cleaned.replace(",", "."));
            return acc + (Number.isFinite(n) ? n : 0);
        }, 0);
        return `${sum.toLocaleString("vi-VN")}${ccyCd === "VND" ? "đ" : ` ${ccyCd}`}`;
    }, [selectedRows]);

    const displayDocumentNo = documentNo ?? selectedRows[0]?.id ?? "";

    /* ── Submit handler ─────────────────────────────────────────── */
    async function handleSubmit() {
        if (!title.trim()) {
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: t("payment.request_approval.error.title_required"),
                errorCode:   "WBE6021",
            });
            return;
        }
        if (needsAccount && !hasWithdrawalAccount) {
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: t("payment.request_approval.error.account_required"),
                errorCode:   "WBE6021",
            });
            return;
        }
        if (!selectedApprLine) {
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: t("payment.request_approval.error.approval_line_required"),
                errorCode:   "WBE1147",
            });
            return;
        }
        if (selectedRows.length === 0) {
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: t("payment.request_approval.error.no_rows"),
                errorCode:   "WBE_VALIDATION",
            });
            return;
        }

        // The backend stub posts to one batch at a time (one
        // SCDUL_PYMN_NO per call). When multiple rows are selected we
        // submit them sequentially — same legacy contract.
        setSubmitting(true);
        try {
            let lastApprSeqNo = "";
            for (const row of selectedRows) {
                const body: ApiRequestApprovalRequest = {
                    post_title:   title.trim(),
                    post_cont:    description.trim() || undefined,
                    bank_cd:      effBankCd ?? "",
                    acct_no:      effAcctNo ?? "",
                    ccy_cd:       effCcyCd ?? row.ccyCd,
                    pay_date:     scheduledDate ? scheduledDate.replace(/-/g, "") : undefined,
                    // PR7: Payroll Type (legacy APPR_FUND_TP) — sent only for the
                    // Payroll kind so the Scheduled/Result lists can render it.
                    // Other kinds omit it (no Payroll Type → backend stores null).
                    appr_fund_tp: kind === "payroll"
                        ? (PAYROLL_TYPE_CODE[payrollType] ?? undefined)
                        : undefined,
                    appr_line_no: selectedApprLine.appr_line_no,
                    approvers:    selectedApprLine.approvers.map((a) => ({
                        apprvr_id: a.apprvr_id,
                        apprvr_nm: a.apprvr_nm,
                    })),
                };
                // Internal Transfer is the only kind wired to a real
                // backend endpoint today. Other kinds (Vendor / Expense
                // / Payroll / Overseas / Card) surface a "coming soon"
                // warning until their backend endpoints land — the
                // submit call still validates the form first so the
                // user sees missing fields immediately.
                if (kind === "internal-transfer") {
                    // Pass the user-picked attachments so they round-trip
                    // through the multipart submit → EXPT_RESOL_FILE
                    // (V208) → Approval Details popup chain.
                    const res = await submitInternalTransferApproval(row.id, body, files);
                    lastApprSeqNo = res.appr_seq_no;
                } else if (kind === "vendor-payment") {
                    const res = await requestVendorApproval(row.id, body);
                    lastApprSeqNo = res.appr_seq_no;
                } else if (kind === "expense-payment") {
                    const res = await requestExpenseApproval(row.id, body);
                    lastApprSeqNo = res.appr_seq_no;
                } else if (kind === "payroll") {
                    const res = await requestPayrollApproval(row.id, body);
                    lastApprSeqNo = res.appr_seq_no;
                } else if (kind === "overseas-payment") {
                    // Import dynamically or ensure it's in the lib/api/payment
                    const { requestOverseasApproval } = await import("@/lib/api/payment");
                    const res = await requestOverseasApproval(row.id, body);
                    lastApprSeqNo = res.appr_seq_no;
                } else if (kind === "card") {
                    // Card transactions ship every selected row id (the
                    // `CARD_SEQ_NO` PK) in a single batch call — the
                    // backend stamps APPR_SEQ_NO on all of them in one
                    // transaction. Mirrors legacy
                    // `card_0001_001.ts:661-676` (`.RequestApproval`
                    // click → `comm_0194_001.act` with `APPR_DV='33'`).
                    // We collapse the outer per-row loop on the first
                    // iteration since the card call is naturally
                    // batched.
                    if (row.id !== selectedRows[0]?.id) continue;
                    const { requestCardApproval } = await import("@/lib/api/cardTransactions");
                    const res = await requestCardApproval({
                        card_seq_nos: selectedRows.map((r) => r.id),
                        appr_line_no: selectedApprLine.appr_line_no,
                        post_title:   title.trim(),
                        post_cont:    description.trim() || undefined,
                        pay_date:     scheduledDate ? scheduledDate.replace(/-/g, "") : undefined,
                    });
                    lastApprSeqNo = res.appr_seq_no;
                } else {
                    dialog.open({
                        type:        "warning",
                        title:       t("dialog.warning"),
                        description: t("payment.request_approval.coming_soon"),
                    });
                    setSubmitting(false);
                    return;
                }
            }
            dialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("payment.request_approval.success"),
            });
            onSubmitted?.(lastApprSeqNo);
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError
                ? err.message
                : t("payment.request_approval.error.submit_failed");
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        } finally {
            setSubmitting(false);
        }
    }

    /* ── Render ─────────────────────────────────────────────────── */
    // shadcn <Dialog> wraps the existing full-card shell so Radix
    // Presence drives both open and close animations (fade-in +
    // zoom-in on mount, fade-out + zoom-out on dismiss). Sizing /
    // chrome (header bar, Esc/X, body scroll, attachment footer)
    // matches the legacy `.layerCont.approval_details` shape.
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
            <DialogContent
                hideClose
                aria-describedby={undefined}
                // Full-screen popup — fills the viewport edge-to-edge so
                // the long Request Approval form (General Info + Approval
                // Content + Transaction Details + attachments) never
                // scrolls horizontally on the inner tables. Overrides the
                // shadcn `<DialogContent>` defaults (`max-w-[500px]` cap
                // + `max-h-[calc(100vh-32px)]` margin) and drops the
                // rounded corners since the dialog now touches every edge.
                className="flex h-screen w-screen max-h-none max-w-none flex-col overflow-hidden rounded-none p-0"
            >
                <DialogTitle className="sr-only">
                    {t("payment.request_approval.title")}
                </DialogTitle>
                {/* Header bar — matches the read-only twin's modern shell
                 *  (Figma 7503:48965 header: h-48, px-16). */}
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-wb-table-border px-4">
                    <span className="text-wb-15 font-semibold text-wb-ink">
                        {t("payment.request_approval.title")}
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
                    {/* Big title input — the required-marker is a single
                     *  pointer-events-none overlay ("Title*") shown only
                     *  while empty, so the red asterisk flows naturally
                     *  after the label text instead of a magic-number
                     *  offset. The input itself carries no placeholder. */}
                    <div className="relative">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            aria-label={t("payment.request_approval.form.title_label")}
                            className="w-full border-0 border-b border-wb-table-border bg-transparent pb-2 text-wb-24 font-semibold text-wb-ink focus:outline-none"
                        />
                        {!title && (
                            <span
                                aria-hidden
                                className="pointer-events-none absolute left-0 top-0 text-wb-24 font-semibold text-wb-ntrl-5"
                            >
                                {t("payment.request_approval.form.title_label")}
                                <span className="text-wb-status-rejected-text">*</span>
                            </span>
                        )}
                    </div>

                    {/* General Information section */}
                    <Section
                        title={t("payment.request_approval.section.general")}
                        open={showGeneral}
                        onToggle={() => setShowGeneral((v) => !v)}
                    >
                        {/* Two content-width groups sitting adjacent (not a
                         *  grid with a `1fr` right track that pushed the right
                         *  group far across) so the Info block stays compact
                         *  and left-aligned, matching Figma 7503:48965 and the
                         *  Approval Details twin. Stacks to one column below md. */}
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
                                    value={displayDocumentNo}
                                />
                                {kind === "payroll" && (
                                    <InfoRow
                                        icon="bank"
                                        label={t("payment.request_approval.row.payroll_type")}
                                    >
                                        <ChipSelect
                                            value={payrollType}
                                            onChange={setPayrollType}
                                            options={[
                                                { value: "salary", label: t("payment.request_approval.payroll.salary") },
                                                { value: "bonus",  label: t("payment.request_approval.payroll.bonus") },
                                            ]}
                                            widthClass="w-[220px]"
                                        />
                                    </InfoRow>
                                )}
                                <InfoRow
                                    icon="calendar"
                                    label={t("payment.request_approval.row.scheduled_date")}
                                >
                                    <DateField
                                        value={scheduledDate}
                                        onChange={setSchedDate}
                                        formatValue={formatDDMMYYYY}
                                    />
                                </InfoRow>
                                <InfoRow
                                    icon="circle"
                                    label={t("payment.request_approval.row.total_transfer")}
                                >
                                    <span className="inline-flex h-7 items-center rounded-md border border-wb-ntrl-4 bg-wb-bg-sidebar px-2 text-wb-13 font-medium text-wb-ink">
                                        {totalTransferDisplay}
                                    </span>
                                </InfoRow>
                            </div>
                            {/* Right column */}
                            <div className="flex flex-col gap-3">
                                {needsAccount && (
                                    <InfoRow
                                        icon="bank"
                                        label={t("payment.request_approval.row.withdrawal_bank")}
                                    >
                                        {fixedAccountMode ? (
                                            // Read-only: the account was chosen
                                            // upstream (e.g. at Excel upload) and
                                            // saved on the batch — not editable here.
                                            <span className="text-wb-13 font-medium text-wb-ink">
                                                {fixedWithdrawalAccount.display}
                                            </span>
                                        ) : (
                                            <ChipSelect
                                                value={selectedAccountKey}
                                                onChange={setSelectedAccountKey}
                                                options={accounts.map((a) => ({
                                                    value: accountKey(a),
                                                    label: `${a.bankNm} ${a.acctNo} (${acctTypeLabel(a.acctTypeCd)} ${a.ccyCd})`,
                                                }))}
                                                disabled={accounts.length === 0}
                                                placeholder={t("payment.request_approval.form.no_accounts")}
                                                widthClass="w-full"
                                            />
                                        )}
                                    </InfoRow>
                                )}
                                <InfoRow
                                    icon="check"
                                    label={t("payment.request_approval.row.approval_line")}
                                >
                                    <ChipSelect
                                        value={selectedApprLineNo == null ? "" : String(selectedApprLineNo)}
                                        onChange={(v) =>
                                            setSelectedApprLineNo(v === "" ? null : Number(v))
                                        }
                                        options={apprLines.map((l) => ({
                                            value: String(l.appr_line_no),
                                            label: l.appr_line_nm,
                                        }))}
                                        disabled={apprLines.length === 0}
                                        placeholder={t("payment.request_approval.form.no_approval_lines")}
                                        widthClass="w-[220px]"
                                    />
                                </InfoRow>
                                {/* Approver row is ALWAYS visible — shows
                                 *  "Approver (0/5)" before an approval line is
                                 *  picked and "Approver (N/5)" once one is, with
                                 *  the chips. Denominator is the system max-
                                 *  approvers cap (5), matching Figma 7503:48965
                                 *  and legacy `comm_0194_001` ("Approver (#{n}/5)").
                                 *  Presentation only — the Request button gating
                                 *  (title + account + approval line) is unchanged. */}
                                <InfoRow
                                    icon="check"
                                    label={t("payment.request_approval.row.approver", {
                                        current: String(selectedApprLine?.approvers.length ?? 0),
                                        total:   "5",
                                    })}
                                >
                                    {selectedApprLine && (
                                        <div className="flex flex-wrap gap-2">
                                            {selectedApprLine.approvers.map((a, idx) => (
                                                <ApproverChip
                                                    key={a.apprvr_id}
                                                    seq={idx + 1}
                                                    name={a.apprvr_nm}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </InfoRow>
                            </div>
                        </div>
                    </Section>

                    {/* Approval Content section */}
                    <Section
                        title={t("payment.request_approval.section.content")}
                        open={showContent}
                        onToggle={() => setShowContent((v) => !v)}
                    >
                        {/* Borderless content field — matches Figma 7503:48965
                         *  (plain text + bottom-right resize grip, no box) and
                         *  the legacy contenteditable `#approval_input`. */}
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t("payment.request_approval.form.description_placeholder")}
                            rows={4}
                            className="mt-3 w-full resize-y bg-transparent text-wb-13 font-normal text-wb-ink placeholder:text-wb-ntrl-5 focus:outline-none"
                        />
                    </Section>

                    {/* Transaction Details section — kind-conditional layout */}
                    <Section
                        title={t("payment.request_approval.section.transactions", {
                            count: String(
                                loadingTxns
                                    ? "…"
                                    : visibleTransactions.length || selectedRows.length,
                            ),
                        })}
                        open={showTransactions}
                        onToggle={() => setShowTxns((v) => !v)}
                    >
                        {loadingTxns && visibleTransactions.length === 0 ? (
                            <div className="pt-6 text-center text-wb-13 text-wb-ntrl-6">
                                {t("payment.request_approval.loading_transactions")}
                            </div>
                        ) : (
                            <TransactionDetails
                                kind={kind}
                                transactions={visibleTransactions}
                                blockedChars={blockedChars}
                            />
                        )}
                    </Section>
                </div>

                {/* Footer — Attach / Attachment counter + Request button.
                 *  `min-h-12` keeps the Figma 48px height while letting the
                 *  expandable attachment-chip row grow without clipping. */}
                <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-t border-wb-table-border px-4 py-2">
                    <div className="flex items-center gap-3">
                        <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]">
                            {/* Pushpin glyph (Figma `ico_pin`) — replaces the
                             *  previous paperclip. Kept as the lucide `Pin`
                             *  (a pushpin/tack), the correct glyph, to stay
                             *  localized to this popup without a shared asset. */}
                            <Pin className="size-3.5" strokeWidth={1.8} />
                            {t("payment.request_approval.attach")}
                            <input
                                type="file"
                                multiple
                                hidden
                                onChange={(e) => {
                                    const list = Array.from(e.target.files ?? []);
                                    if (list.length > 0) setFiles((prev) => [...prev, ...list]);
                                    e.target.value = "";
                                }}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => setAttachOpen((v) => !v)}
                            className="inline-flex items-center gap-1 text-wb-14-tight font-medium text-brand hover:underline"
                        >
                            {t("payment.request_approval.attachment_count", {
                                count: String(files.length),
                            })}
                            {attachmentsOpen ? (
                                <ChevronUp className="size-3.5" strokeWidth={1.8} />
                            ) : (
                                <ChevronDown className="size-3.5" strokeWidth={1.8} />
                            )}
                        </button>
                        {attachmentsOpen && files.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {files.map((f, i) => (
                                    <span
                                        key={`${f.name}-${i}`}
                                        className="inline-flex items-center gap-1 rounded border border-wb-ntrl-4 bg-wb-bg-sidebar px-2 py-0.5 text-wb-12 font-medium text-wb-ink"
                                    >
                                        {f.name}
                                        <button
                                            type="button"
                                            onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                            aria-label={t("dialog.close")}
                                        >
                                            <X className="size-3" strokeWidth={2} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || !title.trim() || (needsAccount && !hasWithdrawalAccount) || !selectedApprLine}
                        className={cn(
                            "flex h-8 cursor-pointer items-center justify-center rounded-md px-4 text-wb-14-tight font-medium",
                            submitting || !title.trim() || (needsAccount && !hasWithdrawalAccount) || !selectedApprLine
                                ? "cursor-not-allowed bg-wb-ntrl-4 text-white"
                                : "bg-brand text-white shadow-wb-brand-btn hover:bg-brand-hover",
                        )}
                    >
                        {t("payment.request_approval.submit")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
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
        <div className="mt-6 first:mt-4">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full cursor-pointer items-center gap-2 border-b border-wb-table-border pb-2 text-left"
            >
                <span className="text-wb-14 font-semibold text-wb-ink">{title}</span>
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
    icon:   "document" | "hash" | "calendar" | "circle" | "bank" | "check";
    label:  string;
    value?: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-[180px_1fr] items-center gap-3">
            <div className="flex items-center gap-2 text-wb-13 font-medium text-wb-ntrl-8">
                <RowIcon name={icon} />
                <span>{label}</span>
            </div>
            <div className="flex items-center text-wb-13 font-medium text-wb-ink">
                {children ?? value}
            </div>
        </div>
    );
}

/** General-Information row icons — the exact Figma assets (node
 *  7503:46512), extracted to `public/assets/payment/` (plus the shared
 *  `ico-building.svg`). Rendered via `<img>` at 16px / 50% opacity; the
 *  SVGs carry the Figma `#171717` glyph fill so the 50% opacity yields
 *  the dark-glyph-at-50% tone Figma specifies. No inline glyph
 *  approximations. */
const ROW_ICON_SRC: Record<string, string> = {
    document: "/assets/payment/ico-doc.svg",
    hash:     "/assets/payment/ico-hash.svg",
    calendar: "/assets/payment/ico-calendar.svg",
    circle:   "/assets/payment/ico-circle.svg",
    bank:     "/assets/table/ico-building.svg",
    check:    "/assets/payment/ico-check.svg",
};

function RowIcon({ name }: { name: string }) {
    const src = ROW_ICON_SRC[name];
    if (!src) return null;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden className="size-4 shrink-0 opacity-50" />
    );
}

/* ── Approver chip with numbered prefix ─────────────────────────── */

function ApproverChip({ seq, name }: { seq: number; name: string }) {
    // Mirrors the read-only twin's approver chip (Figma 7503:48965):
    // rounded-lg, ntrl-02 fill, numbered prefix with a dashed vertical
    // divider, neutral avatar circle, 14px name (no uppercase). The
    // Request preview shows no outcome verb / status glyph — the chain
    // is just a preview of the selected approval line.
    return (
        <span className="inline-flex max-w-fit items-stretch overflow-hidden rounded-lg border border-wb-ntrl-4 bg-wb-bg-sidebar text-wb-14-tight font-medium text-wb-ink">
            <span className="flex w-7 shrink-0 items-center justify-center border-r border-dashed border-wb-ntrl-4 px-1">
                {seq}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1">
                <span className="inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-wb-ntrl-4 bg-white">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="size-3 text-wb-ntrl-6" aria-hidden>
                        <circle cx="8" cy="6" r="2.5" />
                        <path d="M3 13c0-2 2.5-3.5 5-3.5s5 1.5 5 3.5v1H3v-1z" />
                    </svg>
                </span>
                <span className="whitespace-nowrap">{name}</span>
            </span>
        </span>
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
        // Card payment renders a grid of compact cards (Figma 7503:47745).
        return <CardTransactionGrid transactions={transactions} />;
    }

    if (transactions.length === 0) {
        return (
            <div className="pt-6 text-center text-wb-13 text-wb-ntrl-6">
                {t("payment.request_approval.no_transactions")}
            </div>
        );
    }

    if (kind === "payroll") {
        // Payroll renders the 5-column variant (no Contact Name /
        // Description / Document No.). Min-widths from Figma note
        // 7503:47210: Remarks 212px, Reporting Account 156px.
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
                                    <DepositBankCell txn={txn} />
                                </td>
                                <td className="px-2.5 py-2 text-right font-medium text-wb-ink">{txn.transferAmount}</td>
                                <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.recipientName ?? ""}</td>
                                <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.remarks ?? ""}</td>
                                <td className="px-2.5 py-2 font-medium text-wb-ink">
                                    <ReportingAccountCell txn={txn} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // Vendor / Expense / Internal Transfer / Overseas — 7 columns
    // (Contact Name was dropped per the latest Figma frame). Min-widths
    // from Figma note 7497:58527: Remarks 212, Description 212,
    // Reporting Account 156.
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
            <table className="w-full min-w-[1080px] border-collapse text-wb-13">
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
                        <th className="px-2.5 py-2 text-left font-semibold" style={{ minWidth: 212 }}>{t("payment.request_approval.col.description")}</th>
                        <th className="px-2.5 py-2 text-left font-semibold">{t("payment.request_approval.col.document_no")}</th>
                        <th className="px-2.5 py-2 text-left font-semibold" style={{ minWidth: 156 }}>{t("payment.request_approval.col.reporting_account")}</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((txn) => (
                        <tr key={txn.id} className="border-b border-wb-table-border last:border-b-0">
                            <td className="px-2.5 py-2 font-medium text-wb-ink">
                                <DepositBankCell txn={txn} />
                            </td>
                            <td className="px-2.5 py-2 text-right font-medium text-wb-ink">{txn.transferAmount}</td>
                            {kind === "overseas-payment" && (
                                <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.feePayer ?? ""}</td>
                            )}
                            <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.recipientName ?? ""}</td>
                            <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.remarks ?? ""}</td>
                            <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.description ?? ""}</td>
                            <td className="px-2.5 py-2 font-medium text-wb-ink">{txn.documentNo ?? ""}</td>
                            <td className="px-2.5 py-2 font-medium text-wb-ink">
                                <ReportingAccountCell txn={txn} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function DepositBankCell({ txn }: { txn: RequestApprovalTransaction }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span>{txn.depositBankCode} - {txn.depositBankName}</span>
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

function ReportingAccountCell({ txn }: { txn: RequestApprovalTransaction }) {
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

/**
 * One per-card cell inside the Card variant of the Transaction
 * Details section (Figma 7503:47745).
 *
 * <p>Layout (top → bottom):
 * <ol>
 *   <li>Reporting-Account chip-select + Save button row.</li>
 *   <li>Merchant name (bold).</li>
 *   <li>Description textarea, 200-char cap with live counter.</li>
 *   <li>Divider.</li>
 *   <li>Currency (left) + amount (right) footer.</li>
 * </ol>
 *
 * <p>State is local — each card holds its own description draft + a
 * pending reporting-account selection. Clicking Save commits the
 * picked account via {@code PUT /api/v1/payment/card-transactions/{id}/reporting-account}
 * (same endpoint the inline ReportingAccountPickerPopover uses).
 */
function CardTransactionGrid({ transactions }: { transactions: RequestApprovalTransaction[] }) {
    const { t } = useTranslation();
    const treeState = useApiData(() => fetchChartOfAccountsTree(), []);

    const accounts: ApiChartOfAccountTreeNode[] = (treeState.data?.nodes ?? [])
            .filter((n) => !n.restricted);

    if (transactions.length === 0) {
        return (
            <div className="pt-6 text-center text-wb-13 text-wb-ntrl-6">
                {t("payment.request_approval.no_transactions")}
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 md:grid-cols-3">
            {transactions.map((txn) => (
                <CardTransactionCell key={txn.id} txn={txn} accounts={accounts} />
            ))}
        </div>
    );
}

function CardTransactionCell({
    txn,
    accounts,
}: {
    txn:      RequestApprovalTransaction;
    accounts: ApiChartOfAccountTreeNode[];
}) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [account, setAccount] = useState<string>("");
    const [description, setDescription] = useState<string>(txn.description ?? "");
    const [saving, setSaving] = useState(false);
    const [savedCd, setSavedCd] = useState<string | null>(null);

    const MAX_DESC = 200;

    const handleSave = async () => {
        const node = accounts.find((a) => String(a.chart_acct_seq_no) === account);
        if (!node || saving) return;
        setSaving(true);
        try {
            await putCardTransactionReportingAccount(txn.id, {
                chart_acct_seq_no: node.chart_acct_seq_no,
                chart_acct_cd:     node.chart_acct_cd,
            });
            setSavedCd(node.chart_acct_cd);
            dialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("payment.card.toast.saved"),
            });
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : t("payment.card.dialog.reporting_account.save_failed");
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="group flex w-full flex-col overflow-hidden rounded-md border border-wb-ntrl-4 bg-white transition-shadow hover:shadow-wb-card">
            {/* Body — content-sized: short row of select+save, a
                bold merchant name, and a fixed-height description
                textarea. The card no longer forces aspect-square so
                the cell stays compact regardless of grid width. */}
            <div className="flex flex-col gap-3 p-4">
                {/* Row 1 — Reporting Account select + Save. Both
                    chips at the same compact height; Save sized
                    just wide enough for the label. */}
                <div className="flex items-center gap-1.5">
                    <AccountDropdown
                        value={account}
                        onChange={setAccount}
                        accounts={accounts}
                        disabled={saving || accounts.length === 0}
                    />
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !account}
                        className="h-8 shrink-0 rounded-md bg-brand px-2.5 text-wb-12 font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? t("common.loading") : "Save"}
                    </button>
                </div>
                {savedCd && (
                    <span className="text-wb-11 font-medium text-wb-status-approved-text">
                        ✓ {savedCd}
                    </span>
                )}

                {/* Row 2 — Merchant name */}
                <p
                    className="truncate text-wb-13 font-semibold text-wb-dark"
                    title={txn.recipientName ?? ""}
                >
                    {txn.recipientName ?? ""}
                </p>

                {/* Row 3 — Description textarea (fixed compact
                    height so the cell stays small) + counter pinned
                    bottom-right. */}
                <div className="relative">
                    <textarea
                        value={description}
                        onChange={(e) => {
                            const next = e.target.value.slice(0, MAX_DESC);
                            setDescription(next);
                        }}
                        placeholder={`Description (Max ${MAX_DESC} characters)`}
                        className="block h-30 w-full resize-none rounded-md border border-wb-ntrl-4 bg-white px-3 pb-5 pt-2 text-wb-13 font-normal leading-5 text-wb-ink placeholder:text-wb-ntrl-5 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                    />
                    <span className="pointer-events-none absolute bottom-1.5 right-2.5 text-wb-11 font-medium text-wb-ntrl-5">
                        {description.length}/{MAX_DESC}
                    </span>
                </div>
            </div>

            {/* Footer — currency on left, amount right-aligned. */}
            <div className="flex shrink-0 items-baseline justify-between border-t border-wb-border-sidebar bg-wb-bg-card px-4 py-2.5">
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

/**
 * Per-card Reporting-Account dropdown. Custom popover (not the native
 * &lt;select&gt; which can't render multi-line items or breadcrumb
 * subtitles) — same visual language as the standalone
 * {@code ReportingAccountPickerPopover} but rendered inline so the
 * trigger stays inside the card cell.
 *
 * <p>Click the trigger to open a popup that holds:
 * <ul>
 *   <li>Sticky search input ({@code Account Code, Account Name})</li>
 *   <li>Scrollable list — each item shows {@code {code} - {name}}
 *       (semibold) + {@code breadcrumb} subtitle (muted 11px).</li>
 * </ul>
 *
 * <p>ESC + outside-click dismiss without committing. Clicking an
 * item commits the selection and closes the popup.
 */
function AccountDropdown({
    value,
    onChange,
    accounts,
    disabled,
}: {
    value:    string;
    onChange: (next: string) => void;
    accounts: ApiChartOfAccountTreeNode[];
    disabled?: boolean;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef   = useRef<HTMLInputElement>(null);

    const selected = accounts.find((a) => String(a.chart_acct_seq_no) === value);
    const triggerLabel = selected
            ? `${selected.chart_acct_cd} - ${selected.chart_acct_nm_en}`
            : "Select";

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return accounts;
        return accounts.filter((a) =>
            (`${a.chart_acct_cd} ${a.chart_acct_nm_en} ${a.breadcrumb}`)
                .toLowerCase()
                .includes(q),
        );
    }, [accounts, search]);

    // Outside-click + ESC dismiss. Mirrors the
    // ReportingAccountPickerPopover defer-mousedown pattern so the
    // SAME click that opens the popup doesn't immediately close it.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        const onClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (wrapperRef.current && !wrapperRef.current.contains(target)) {
                setOpen(false);
            }
        };
        document.addEventListener("keydown", onKey);
        const id = setTimeout(() => {
            document.addEventListener("mousedown", onClick);
        }, 0);
        return () => {
            clearTimeout(id);
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onClick);
        };
    }, [open]);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    return (
        <div ref={wrapperRef} className="relative flex-1">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={cn(
                    "flex h-8 w-full items-center justify-between gap-1 rounded-md border border-wb-ntrl-4 bg-white pl-2.5 pr-1.5 text-left text-wb-13 font-medium",
                    "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    selected ? "text-wb-ink" : "text-wb-ntrl-6",
                )}
            >
                <span className="truncate">{triggerLabel}</span>
                <ChevronDown
                    aria-hidden
                    className="size-3.5 shrink-0 text-wb-ntrl-6"
                    strokeWidth={1.8}
                />
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 flex max-h-[280px] flex-col overflow-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out">
                    {/* Sticky search input */}
                    <div className="relative shrink-0 border-b border-wb-table-border bg-white p-1.5">
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-wb-ntrl-6"
                            strokeWidth={1.8}
                        />
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t("payment.card.dialog.reporting_account.placeholder")}
                            className="h-7 w-full rounded-md border border-wb-ntrl-4 bg-white pl-7 pr-2 text-wb-12 font-normal text-wb-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                        />
                    </div>

                    {/* Scrollable list */}
                    <div className="custom-scrollbar-y flex-1 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <p className="px-3 py-2 text-wb-12 font-medium text-wb-muted">
                                {t("payment.card.dialog.reporting_account.empty")}
                            </p>
                        ) : (
                            <ul role="listbox">
                                {filtered.map((a) => {
                                    const isSel = String(a.chart_acct_seq_no) === value;
                                    return (
                                        <li key={a.chart_acct_seq_no}>
                                            <button
                                                type="button"
                                                role="option"
                                                aria-selected={isSel}
                                                onClick={() => {
                                                    onChange(String(a.chart_acct_seq_no));
                                                    setOpen(false);
                                                }}
                                                className={cn(
                                                    "block w-full cursor-pointer px-3 py-1.5 text-left",
                                                    "border-b border-wb-table-border last:border-b-0",
                                                    isSel ? "bg-brand/5" : "hover:bg-neutral-50",
                                                )}
                                            >
                                                <span className="block truncate text-wb-13 font-semibold text-wb-ink">
                                                    {a.chart_acct_cd} - {a.chart_acct_nm_en}
                                                </span>
                                                {a.breadcrumb && (
                                                    <span className="block truncate text-wb-11 font-medium text-wb-muted">
                                                        {a.breadcrumb}
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function accountKey(a: RequestApprovalAccount): string {
    return `${a.bankCd}|${a.acctNo}`;
}

function acctTypeLabel(code: string): string {
    // Mirrors the ACCT_TYPE_LABEL map on InternalTransferUploadDialog.
    switch (code) {
        case "03": case "04": case "07": return "Current";
        case "05": case "06": case "08": return "Savings";
        default: return "Savings";
    }
}

/** ISO `YYYY-MM-DD` → display `DD-MM-YYYY` (matches Figma date chip). */
function formatDDMMYYYY(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return `${m[3]}-${m[2]}-${m[1]}`;
}

/* ── Chip-style select — shared between Payroll Type, Withdrawal
 *   Bank, and Approval Line. Mirrors the visual rhythm of the
 *   shared `<DateField>` chip (white background, `shadow-wb-btn`,
 *   chevron-down affordance) so all three controls inside the
 *   General Information section read as one family. The dropdown
 *   list reuses the WB365 popover tokens from `<DateField>`. */
function ChipSelect({
    value,
    onChange,
    options,
    disabled,
    placeholder,
    widthClass,
}: {
    value: string;
    onChange: (next: string) => void;
    options: ReadonlyArray<{ label: string; value: string }>;
    disabled?: boolean;
    placeholder?: string;
    widthClass?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onClick);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onClick);
        };
    }, [open]);

    const selected = options.find((o) => o.value === value);
    const display  = selected?.label ?? placeholder ?? "";

    return (
        <div ref={ref} className={cn("relative inline-block", widthClass)}>
            <button
                type="button"
                onClick={() => { if (!disabled) setOpen((o) => !o); }}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={cn(
                    "flex h-[var(--h-wb-filter-btn)] w-full cursor-pointer items-center justify-between gap-2 overflow-clip rounded-md border-0 bg-white px-3 shadow-wb-btn",
                    disabled && "cursor-not-allowed opacity-60",
                )}
            >
                <span
                    className={cn(
                        "truncate text-wb-13 font-medium",
                        selected ? "text-wb-ink" : "text-wb-ntrl-5",
                    )}
                >
                    {display}
                </span>
                <ChevronDown className="size-4 shrink-0 text-wb-ntrl-6" strokeWidth={1.8} />
            </button>
            {open && options.length > 0 && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 top-full z-30 mt-1 max-h-60 w-full min-w-full overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
                >
                    {options.map((opt) => (
                        <li
                            key={opt.value}
                            role="option"
                            aria-selected={opt.value === value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={cn(
                                "cursor-pointer px-3 py-2 text-wb-13 font-medium text-wb-ink hover:bg-neutral-100",
                                opt.value === value && "bg-brand-soft text-brand",
                            )}
                        >
                            {opt.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
