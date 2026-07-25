"use client";

import {
    ChevronDown, ChevronUp, Paperclip, Search, X,
    FileSpreadsheet, FileText, FileImage, FileArchive, Presentation, File as FileIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import DeleteIcon from "@/components/shared/icons/DeleteIcon";
import BlockedCharsTooltip from "@/components/shared/BlockedCharsTooltip";
import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
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
import { formatAmount } from "@/lib/currency";
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
    /** Beneficiary address (Overseas only) — its own column in the
     *  overseas beneficiary table (legacy comm_0194_001 APPR_DV=34). */
    beneficiaryAddress?: string;
    /** Beneficiary town/city (Overseas only) — auto-filled from the
     *  contact's SWIFT directory entry, saved to
     *  OVRS_PYMN_SUMR_DETL.BNFC_TOWN_NM. Its own column in the overseas
     *  beneficiary table. */
    townName?:         string;
    /** Card purpose — `CARD_TRNS_USAGE_NM` for card kind. Only used by
     *  the read-only Approval Details popup's card 4-column table
     *  (matches legacy `comm_0195_001.ts:1513`). */
    purpose?:          string;
    /* ---- Card-only legacy detail fields (GAP-CARD-FIELDS) — rendered by
     * `ReadOnlyCardCell` in the read-only Approval Details popup so the
     * card grid reaches legacy `CARD_TRNS_HSTR_R002` parity. All optional;
     * non-card kinds leave them undefined. `depositAccountNo` already
     * carries the card number; `recipientName` the merchant. */
    cardName?:        string;   // CARD_NM
    txnDate?:         string;   // TRSC_DT (yyyyMMdd)
    txnTime?:         string;   // TRSC_TM (HHmmss)
    usingType?:       string;   // USING_TYPE
    purchaseStatus?:  string;   // PRCH_STTS
    authCode?:        string;   // AUTH_CODE
    city?:            string;   // CITY
    note?:            string;   // NOTE (distinct from description/CONT)
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

/** Live per-card draft collected from each Transaction Details card
 *  (card kind only) so Submit can ship the reporting account + description
 *  inline, mirroring legacy `REC3`. All fields optional/empty until the
 *  user picks an account or types a description. */
type CardDraft = {
    chartAcctSeqNo: string;
    chartAcctCd:    string;
    description:    string;
};

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

    // Card-only: collect each transaction card's LIVE per-card fields
    // (selected reporting account + description textarea) so Submit can
    // ship them inline as legacy `REC3` did — without forcing the user to
    // click the inline Save first. Held in a ref (not state) so typing in
    // a card's description never re-renders the parent; the submit handler
    // reads the latest snapshot. Keyed by card_seq_no (= txn.id). The
    // inline Save button keeps its own PUT path unchanged.
    const cardDraftsRef = useRef<Map<string, CardDraft>>(new Map());
    const registerCardDraft = useCallback((id: string, draft: CardDraft) => {
        cardDraftsRef.current.set(id, draft);
    }, []);

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
        return `${formatAmount(String(sum), ccyCd, false)}${ccyCd === "VND" ? "đ" : ` ${ccyCd}`}`;
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
                // All six kinds are wired to live backend endpoints. Internal
                // Transfer uses a multipart submit (it carries file attachments
                // today); the other five (Vendor / Expense / Payroll / Overseas
                // / Card) post JSON. The trailing `else` "coming soon" branch is
                // an unreachable guard for an unrecognised `kind`, kept so a
                // future variant fails loud instead of silently no-op'ing.
                // (Backend file-attachment persistence for the JSON kinds —
                // gap M-1 — is a tracked follow-up; the dialog already collects
                // files but only Internal Transfer ships them today.)
                if (kind === "internal-transfer") {
                    // Pass the user-picked attachments so they round-trip
                    // through the multipart submit → EXPT_RESOL_FILE
                    // (V208) → Approval Details popup chain.
                    const res = await submitInternalTransferApproval(row.id, body, files);
                    lastApprSeqNo = res.appr_seq_no;
                } else if (kind === "vendor-payment") {
                    const res = await requestVendorApproval(row.id, body, files);
                    lastApprSeqNo = res.appr_seq_no;
                } else if (kind === "expense-payment") {
                    const res = await requestExpenseApproval(row.id, body, files);
                    lastApprSeqNo = res.appr_seq_no;
                } else if (kind === "payroll") {
                    const res = await requestPayrollApproval(row.id, body, files);
                    lastApprSeqNo = res.appr_seq_no;
                } else if (kind === "overseas-payment") {
                    // Import dynamically or ensure it's in the lib/api/payment
                    const { requestOverseasApproval } = await import("@/lib/api/payment");
                    const res = await requestOverseasApproval(row.id, body, files);
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
                    // Backend expects `cards: [{ card_seq_no, chart_acct_cd?,
                    // chart_acct_seq_no?, busa_usag_cd?, memo? }]`
                    // (@NotEmpty List<CardApprovalItem>) — the modern
                    // equivalent of legacy REC3. selectedRows drives the set
                    // (so the array is never empty); each row is enriched
                    // with its live card-cell draft (picked reporting
                    // account + description) and the transaction's purpose.
                    // Only card_seq_no is required; every other field is
                    // omitted when empty (legacy/backend don't require them),
                    // so an unsaved reporting account never blocks submit.
                    const txnById = new Map(
                        visibleTransactions.map((tx) => [tx.id, tx]),
                    );
                    const cards = selectedRows.map((r) => {
                        const tx    = txnById.get(r.id);
                        const draft = cardDraftsRef.current.get(r.id);
                        const chartAcctCd =
                            (draft?.chartAcctCd || tx?.reportingAccount || "").trim();
                        const chartAcctSeqNo = (draft?.chartAcctSeqNo || "").trim();
                        const busaUsagCd     = (tx?.purpose || "").trim();
                        const memo = (draft?.description ?? tx?.description ?? "").trim();
                        return {
                            card_seq_no: r.id,
                            ...(chartAcctCd    ? { chart_acct_cd:     chartAcctCd }    : {}),
                            ...(chartAcctSeqNo ? { chart_acct_seq_no: chartAcctSeqNo } : {}),
                            ...(busaUsagCd     ? { busa_usag_cd:      busaUsagCd }     : {}),
                            ...(memo           ? { memo }                             : {}),
                        };
                    });
                    const res = await requestCardApproval({
                        cards,
                        appr_line_no: selectedApprLine.appr_line_no,
                        post_title:   title.trim(),
                        post_cont:    description.trim() || undefined,
                        pay_date:     scheduledDate ? scheduledDate.replace(/-/g, "") : undefined,
                    }, files);
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
                // Outside-click close is DISABLED for every payment kind. The
                // system error dialog (useDialog) renders in a separate z-[100]
                // portal OUTSIDE this Radix content tree, so clicking its OK
                // button registers as a pointer-down "outside" — Radix would
                // otherwise dismiss this whole Request Approval modal when the
                // user merely acknowledges a failed-submit error (closing it
                // discards the form the user needs to fix). This is also a
                // full-screen dialog with no visible backdrop to click, so
                // outside-click close is meaningless. ESC + the X button remain
                // the real close paths; the modal otherwise only closes after a
                // successful submit (onSubmitted) or explicit cancel. Previously
                // this was scoped to `kind === "card"` only, which left
                // Overseas / Vendor / Expense / Payroll / Internal Transfer
                // closing on the error-dialog OK click.
                closeOnOutsideClick={false}
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
                                    icon="approval-line"
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
                            rows={3}
                            className="mt-3 max-h-[200px] min-h-[76px] w-full resize-y overflow-y-auto bg-transparent text-wb-13 font-normal text-wb-ink placeholder:text-wb-ntrl-5 focus:outline-none"
                        />
                    </Section>

                    {/* Transaction Details section — kind-conditional layout */}
                    <Section
                        title={
                            /* Legacy inline format: "Transaction Details" as the
                             *  main label + a lighter secondary count
                             *  "N Transaction(s)" (legacy comm_0194_001 /
                             *  pymn_0001_001). Rendered for every kind (incl. Card)
                             *  since this shared Section wraps the kind-conditional
                             *  TransactionDetails below. The expand/collapse chevron
                             *  stays beside the title (owned by <Section>). */
                            <span className="inline-flex items-baseline gap-1.5">
                                <span>{t("payment.request_approval.section.transactions")}</span>
                                <span className="text-wb-13 font-normal text-wb-ntrl-6">
                                    {t("payment.request_approval.section.transactions_count", {
                                        count: String(
                                            loadingTxns
                                                ? "…"
                                                : visibleTransactions.length || selectedRows.length,
                                        ),
                                    })}
                                </span>
                            </span>
                        }
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
                                onCardDraftChange={registerCardDraft}
                            />
                        )}
                    </Section>
                </div>

                {/* Footer — Attach / Attachment counter + Request button.
                 *  `min-h-12` keeps the Figma 48px height while letting the
                 *  expandable attachment-chip row grow without clipping. */}
                <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-t border-wb-table-border px-4 py-2">
                    <div className="flex items-center gap-3">
                        {/* Attach button — identical to the Approval Details footer
                         *  (lucide `Paperclip`, size-3.5; same h-8 / border / radius /
                         *  font / hover). */}
                        <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]">
                            <Paperclip className="size-3.5" strokeWidth={1.8} />
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
                        {/* "Attachment (N)" — collapsible toggle that expands into a
                         *  floating list above the footer. Markup mirrors the Approval
                         *  Details footer attachment list exactly (file-type icon +
                         *  name + Trash2 remove) so both dialogs read identically.
                         *  Behaviour unchanged: toggle + per-file remove. */}
                        <div className="relative">
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
                                <div className="custom-scrollbar-y absolute bottom-full left-0 z-10 mb-2 flex max-h-60 min-w-[260px] flex-col gap-1 overflow-y-auto rounded-md border border-wb-ntrl-4 bg-white p-2 shadow-lg">
                                    {files.map((f, i) => (
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
                                                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
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
    title: React.ReactNode;
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
    icon:   "document" | "hash" | "calendar" | "circle" | "bank" | "approval-line" | "check";
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
    // Approval Line — list/approval-line glyph (legacy `comm_0194_001`),
    // distinct from the Approver check icon. Reuses the shared toolbar list
    // asset so no new SVG is introduced.
    "approval-line": "/assets/common/ico-list.svg",
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
    onCardDraftChange,
}: {
    kind: RequestApprovalKind;
    transactions: RequestApprovalTransaction[];
    /** Per-field blocked-chars map keyed off the current withdrawal
     *  bank. Drives the {@code BlockedCharsTooltip} on the Remarks
     *  header. Pass an empty object to disable the tooltip. */
    blockedChars: import("@/lib/api/blockedChars").BlockedCharsMap;
    /** Card-only: reports each card's live reporting-account + description
     *  draft up to the submit handler. Unused for the other kinds. */
    onCardDraftChange?: (id: string, draft: CardDraft) => void;
}) {
    const { t } = useTranslation();

    if (kind === "card") {
        // Card payment renders a grid of compact cards (Figma 7503:47745).
        return (
            <CardTransactionGrid
                transactions={transactions}
                onCardDraftChange={onCardDraftChange}
            />
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
        // Payroll renders the 5-column variant (no Contact Name /
        // Description / Document No.). Min-widths from Figma note
        // 7503:47210: Remarks 212px, Reporting Account 156px.
        return (
            <div className="custom-scrollbar-x mt-3 overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse text-wb-13">
                    <thead className="bg-wb-bg-sidebar text-wb-dark">
                        <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold">{t("payment.request_approval.col.deposit_bank")}</th>
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-right font-semibold">{t("payment.request_approval.col.transfer_amount")}</th>
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold">
                                <span className="inline-flex items-center gap-1">
                                    {t("payment.request_approval.col.recipient_name")}
                                    <BlockedCharsTooltip
                                        fieldCd="RCPT"
                                        fieldNameKey="payment.field.recipient_name"
                                        blockedChars={blockedChars}
                                    />
                                </span>
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 212 }}>
                                <span className="inline-flex items-center gap-1">
                                    {t("payment.request_approval.col.remarks")}
                                    <BlockedCharsTooltip
                                        fieldCd="RMKS"
                                        fieldNameKey="payment.field.remarks"
                                        blockedChars={blockedChars}
                                    />
                                </span>
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 156 }}>{t("payment.request_approval.col.reporting_account")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((txn) => (
                            <tr key={txn.id} className="border-b border-wb-table-border last:border-b-0">
                                <td className="px-3 py-3 align-top font-medium text-wb-ink">
                                    <DepositBankCell txn={txn} />
                                </td>
                                <td className="px-3 py-3 align-top text-right font-medium text-wb-ink">{txn.transferAmount}</td>
                                <td className="px-3 py-3 align-top font-medium text-wb-ink"><EllipsisTooltip text={txn.recipientName ?? ""} lines={2} /></td>
                                <td className="px-3 py-3 align-top font-medium text-wb-ink"><EllipsisTooltip text={txn.remarks ?? ""} lines={2} /></td>
                                <td className="px-3 py-3 align-top font-medium text-wb-ink">
                                    <ReportingAccountCell txn={txn} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    if (kind === "overseas-payment") {
        // Overseas — dedicated 9-column beneficiary table (legacy
        // comm_0194_001 APPR_DV=34). Town Name sits between Beneficiary
        // Address and Transfer Amount, matching the legacy grid + the
        // Excel-upload preview. Beneficiary Name / Memo carry the
        // blocked-chars tooltip under the legacy BENA / MEMO field codes.
        return (
            <div className="custom-scrollbar-x mt-3 overflow-x-auto">
                <table className="w-full min-w-[1440px] border-collapse text-wb-13">
                    <thead className="bg-wb-bg-sidebar text-wb-dark">
                        <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 170 }}>
                                <span className="inline-flex items-center gap-1">
                                    {t("payment.overseas.col.beneficiary_name")}
                                    <BlockedCharsTooltip
                                        fieldCd="BENA"
                                        fieldNameKey="payment.field.beneficiary_name"
                                        blockedChars={blockedChars}
                                    />
                                </span>
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 180 }}>{t("payment.overseas.col.beneficiary_bank_name")}</th>
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 180 }}>{t("payment.overseas.col.beneficiary_account_no")}</th>
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 240 }}>
                                <span className="inline-flex items-center gap-1">
                                    {t("payment.overseas.col.beneficiary_address")}
                                    <BlockedCharsTooltip
                                        fieldCd="BEAD"
                                        fieldNameKey="payment.field.beneficiary_address"
                                        blockedChars={blockedChars}
                                    />
                                </span>
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 120 }}>{t("payment.overseas.col.town_name")}</th>
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-right font-semibold" style={{ minWidth: 130 }}>{t("payment.overseas.col.transfer_amount")}</th>
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 110 }}>{t("payment.overseas.col.fee_payer")}</th>
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 160 }}>
                                <span className="inline-flex items-center gap-1">
                                    {t("payment.overseas.col.memo")}
                                    <BlockedCharsTooltip
                                        fieldCd="MEMO"
                                        fieldNameKey="payment.field.memo"
                                        blockedChars={blockedChars}
                                    />
                                </span>
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 156 }}>{t("payment.overseas.col.reporting_account")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((txn) => (
                            <tr key={txn.id} className="border-b border-wb-table-border last:border-b-0">
                                <td className="px-3 py-3 align-top font-medium text-wb-ink"><EllipsisTooltip text={txn.recipientName ?? ""} lines={2} /></td>
                                <td className="px-3 py-3 align-top font-medium text-wb-ink"><EllipsisTooltip text={txn.depositBankName ?? ""} lines={2} /></td>
                                <td className="px-3 py-3 align-top font-medium text-wb-ink"><EllipsisTooltip text={txn.depositAccountNo ?? ""} lines={2} /></td>
                                <td className="px-3 py-3 align-top font-medium text-wb-ink"><EllipsisTooltip text={txn.beneficiaryAddress ?? ""} lines={2} /></td>
                                <td className="px-3 py-3 align-top font-medium text-wb-ink"><EllipsisTooltip text={txn.townName ?? ""} lines={2} /></td>
                                <td className="px-3 py-3 align-top text-right font-medium text-wb-ink">{txn.transferAmount}</td>
                                <td className="px-3 py-3 align-top font-medium text-wb-ink">{txn.feePayer ?? ""}</td>
                                <td className="px-3 py-3 align-top font-medium text-wb-ink"><EllipsisTooltip text={txn.remarks ?? ""} lines={2} /></td>
                                <td className="px-3 py-3 align-top font-medium text-wb-ink">
                                    <ReportingAccountCell txn={txn} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // Vendor / Expense / Internal Transfer — 7 columns
    // (Contact Name was dropped per the latest Figma frame). Min-widths
    // from Figma note 7497:58527: Remarks 212, Description 212,
    // Reporting Account 156.
    // (Overseas now renders its own beneficiary table above, so only
    // vendor / expense / internal-transfer reach here — RCPT / RMKS.)
    const recipientFieldCd = "RCPT";
    const remarkFieldCd    = "RMKS";
    const recipientFieldNameKey = "payment.field.recipient_name";
    const remarkFieldNameKey = "payment.field.remarks";
    return (
        <div className="custom-scrollbar-x mt-3 overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-wb-13">
                <thead className="bg-wb-bg-sidebar text-wb-dark">
                    <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                        <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold">{t("payment.request_approval.col.deposit_bank")}</th>
                        <th className="whitespace-nowrap px-3 py-3 align-middle text-right font-semibold">{t("payment.request_approval.col.transfer_amount")}</th>
                        <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold">
                            <span className="inline-flex items-center gap-1">
                                {t("payment.request_approval.col.recipient_name")}
                                <BlockedCharsTooltip
                                    fieldCd={recipientFieldCd}
                                    fieldNameKey={recipientFieldNameKey}
                                    blockedChars={blockedChars}
                                />
                            </span>
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 212 }}>
                            <span className="inline-flex items-center gap-1">
                                {t("payment.request_approval.col.remarks")}
                                <BlockedCharsTooltip
                                    fieldCd={remarkFieldCd}
                                    fieldNameKey={remarkFieldNameKey}
                                    blockedChars={blockedChars}
                                />
                            </span>
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 212 }}>{t("payment.request_approval.col.description")}</th>
                        <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold">{t("payment.request_approval.col.document_no")}</th>
                        <th className="whitespace-nowrap px-3 py-3 align-middle text-left font-semibold" style={{ minWidth: 156 }}>{t("payment.request_approval.col.reporting_account")}</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((txn) => (
                        <tr key={txn.id} className="border-b border-wb-table-border last:border-b-0">
                            <td className="px-3 py-3 align-top font-medium text-wb-ink">
                                <DepositBankCell txn={txn} />
                            </td>
                            <td className="px-3 py-3 align-top text-right font-medium text-wb-ink">{txn.transferAmount}</td>
                            <td className="px-3 py-3 align-top font-medium text-wb-ink"><EllipsisTooltip text={txn.recipientName ?? ""} lines={2} /></td>
                            <td className="px-3 py-3 align-top font-medium text-wb-ink"><EllipsisTooltip text={txn.remarks ?? ""} lines={2} /></td>
                            <td className="px-3 py-3 align-top font-medium text-wb-ink"><EllipsisTooltip text={txn.description ?? ""} lines={2} /></td>
                            <td className="px-3 py-3 align-top font-medium text-wb-ink"><EllipsisTooltip text={txn.documentNo ?? ""} lines={2} /></td>
                            <td className="px-3 py-3 align-top font-medium text-wb-ink">
                                <ReportingAccountCell txn={txn} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ── File-type icon — mirrors the Approval Details popup's FileTypeIcon
 *  (same lucide glyphs + colors, by extension) so the shared attachment
 *  list renders identically across both dialogs. Kept as a local copy to
 *  keep this change scoped to RequestApprovalDialog — ApprovalDetailsDialog
 *  is intentionally not modified. A future MR can lift both copies into one
 *  shared component consumed by both dialogs. */
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
    if (ext === "txt")
        return <FileText className={cn(base, "text-wb-ntrl-6")} strokeWidth={1.8} />;
    return <FileIcon className={cn(base, "text-wb-ntrl-6")} strokeWidth={1.8} />;
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
            <EllipsisTooltip text={txn.reportingAccount} lines={2} className="font-medium text-wb-ink" />
            {txn.reportingBreadcrumb && (
                <EllipsisTooltip
                    text={txn.reportingBreadcrumb}
                    lines={2}
                    className="text-wb-12 font-normal text-wb-ntrl-6"
                />
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
function CardTransactionGrid({
    transactions,
    onCardDraftChange,
}: {
    transactions: RequestApprovalTransaction[];
    onCardDraftChange?: (id: string, draft: CardDraft) => void;
}) {
    const { t } = useTranslation();
    const treeState = useApiData(() => fetchChartOfAccountsTree(), []);

    // Only level 2 and deeper are selectable — level-1 root categories
    // (restricted ACC-0x + any user-created root) are non-postable
    // headers, not reporting accounts (2026-07-24 requirement).
    const accounts: ApiChartOfAccountTreeNode[] = (treeState.data?.nodes ?? [])
            .filter((n) => n.chart_acct_level >= 2);

    if (transactions.length === 0) {
        return (
            <div className="pt-6 text-center text-wb-13 text-wb-ntrl-6">
                {t("payment.request_approval.no_transactions")}
            </div>
        );
    }
    return (
        <div className="flex flex-wrap items-start gap-4 pt-4">
            {transactions.map((txn) => (
                <CardTransactionCell
                    key={txn.id}
                    txn={txn}
                    accounts={accounts}
                    onDraftChange={onCardDraftChange}
                />
            ))}
        </div>
    );
}

function CardTransactionCell({
    txn,
    accounts,
    onDraftChange,
}: {
    txn:      RequestApprovalTransaction;
    accounts: ApiChartOfAccountTreeNode[];
    /** Reports this card's live reporting-account + description up to the
     *  submit handler so the values ship inline (legacy REC3 parity) even
     *  if the user never clicks the inline Save button. */
    onDraftChange?: (id: string, draft: CardDraft) => void;
}) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [account, setAccount] = useState<string>("");
    const [description, setDescription] = useState<string>(txn.description ?? "");
    const [saving, setSaving] = useState(false);
    const [savedCd, setSavedCd] = useState<string | null>(null);

    const MAX_DESC = 200;

    // Push the live draft up whenever the picked account or the
    // description changes (and once accounts resolve, so chart_acct_cd
    // can be looked up). The inline Save button's PUT path is unaffected.
    useEffect(() => {
        const node = accounts.find((a) => String(a.chart_acct_seq_no) === account);
        onDraftChange?.(txn.id, {
            chartAcctSeqNo: account ? String(node?.chart_acct_seq_no ?? account) : "",
            chartAcctCd:    node?.chart_acct_cd ?? "",
            description,
        });
    }, [account, description, accounts, txn.id, onDraftChange]);

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
        <div className="group flex h-[325px] max-h-[325px] min-h-[325px] w-[340px] max-w-[340px] min-w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border border-wb-ntrl-4 bg-white shadow-wb-card transition-shadow">
            {/* Body — grows to fill the grid cell (flex-1) so the
                footer always sits at the bottom and every card in a
                row shares one height. Holds the select+save header,
                the wrapping merchant name, and a borderless
                description area that expands into the free space. */}
            <div className="flex flex-1 flex-col gap-3 p-4">
                {/* Header — Reporting Account select (left) + Save
                    (right), vertically centered at one compact
                    height. */}
                <div className="flex items-center gap-2">
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
                        className="h-8 shrink-0 rounded-md bg-brand px-3 text-wb-12 font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? t("common.loading") : "Save"}
                    </button>
                </div>
                {savedCd && (
                    <span className="text-wb-11 font-medium text-wb-status-approved-text">
                        ✓ {savedCd}
                    </span>
                )}

                {/* Merchant name — wraps to two lines like the design
                    instead of truncating. */}
                <p
                    className="line-clamp-2 text-wb-13 font-semibold leading-5 text-wb-dark"
                    title={txn.recipientName ?? ""}
                >
                    {txn.recipientName ?? ""}
                </p>

                {/* Description — borderless textarea that expands into
                    the remaining card height, with the character
                    counter beneath it. */}
                <div className="flex flex-1 flex-col">
                    <textarea
                        value={description}
                        onChange={(e) => {
                            const next = e.target.value.slice(0, MAX_DESC);
                            setDescription(next);
                        }}
                        placeholder={`Description (Max. ${MAX_DESC} characters)`}
                        className="block min-h-16 w-full flex-1 resize-none border-0 bg-transparent p-0 text-wb-13 font-normal leading-5 text-wb-ink placeholder:text-wb-ntrl-5 focus:outline-none"
                    />
                    <span className="mt-2 shrink-0 text-wb-11 font-medium text-wb-ntrl-5">
                        {description.length}/{MAX_DESC}
                    </span>
                </div>
            </div>

            {/* Footer — pinned to the card bottom with a divider
                above; currency on the left, amount right-aligned. */}
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
