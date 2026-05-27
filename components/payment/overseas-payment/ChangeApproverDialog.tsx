"use client";

import { ChevronDown, ChevronUp, Paperclip, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchApprovalLines } from "@/lib/api/approvalLine";
import { changeOverseasApprovalLine } from "@/lib/api/payment";
import type { ApiApprovalLineRow } from "@/lib/types/api";
import type { ApiOverseasPaymentExcelDetailRow } from "@/lib/api/payment";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatAmount } from "@/lib/currency";
import { useDialog } from "@/components/shared/dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { userStorage } from "@/lib/auth/storage";

/* ============================================================================
 *  "Change Approver" dialog — shown when the requestor clicks Edit on a
 *  pending overseas payment from the Approval Details kebab menu.
 *
 *  Layout mirrors ApprovalDetailsDialog exactly:
 *  - Same General Information two-column grid
 *  - Approver row is editable (approval line dropdown + chips)
 *  - Transaction Details uses the same table columns as ApprovalDetailsDialog
 * ========================================================================== */

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

export type ChangeApproverDialogProps = {
    paymentId:        string;
    title:            string;
    documentNo?:      string;
    scheduledDate?:   string;
    totalAmount?:     number;
    ccyCd?:           string;
    withdrawalBank?:  string;
    withdrawalAcct?:  string;
    transactions?:    ApiOverseasPaymentExcelDetailRow[];
    requestedBy:      string;
    requestedAt:      string;
    initialApprovers?: Array<{ apprvr_id: string; apprvr_nm: string }>;
    onClose:          () => void;
    onSaved?:         () => void;
};

export default function ChangeApproverDialog({
    paymentId,
    title,
    documentNo,
    scheduledDate,
    totalAmount,
    ccyCd,
    withdrawalBank,
    withdrawalAcct,
    transactions = [],
    requestedBy,
    requestedAt,
    initialApprovers = [],
    onClose,
    onSaved,
}: ChangeApproverDialogProps) {
    const { t }  = useTranslation();
    const dialog = useDialog();

    /* ── Open/close animation state ─────────────────────────────── */
    // Mount closed → flip to open on next tick so Radix sees a
    // closed→open transition and animates in. On close, flip to
    // closed first, let the animate-out run (~200ms), THEN fire the
    // parent's onClose so the parent unmount doesn't yank the
    // dialog out mid-animation.
    const [open, setOpen] = useState(false);
    useEffect(() => { setOpen(true); }, []);
    const handleClose = useCallback(() => {
        setOpen(false);
        setTimeout(() => onClose(), 200);
    }, [onClose]);

    const [showGeneral, setShowGeneral] = useState(true);
    const [showTxns, setShowTxns]       = useState(true);

    /* ── Approval-line list ────────────────────────────────────────── */
    const [lines, setLines]             = useState<ApiApprovalLineRow[]>([]);
    const [selectedLineNo, setSelected] = useState<number | null>(null);
    const [dropdownOpen, setDropdown]   = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchApprovalLines().then((r) => setLines(r.approval_lines)).catch(() => {});
    }, []);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
                setDropdown(false);
            }
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selectedLine     = lines.find((l) => l.appr_line_no === selectedLineNo) ?? null;
    const displayApprovers = selectedLine ? (selectedLine.approvers ?? []) : initialApprovers;

    /* ── Attachments ───────────────────────────────────────────────── */
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAttach = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length > 0) setAttachments((prev) => [...prev, ...files]);
        e.target.value = "";
    }, []);

    /* ── Save ──────────────────────────────────────────────────────── */
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState<string | null>(null);

    const handleSave = useCallback(async () => {
        if (!selectedLine) {
            setError(t("payment.request_approval.error.approval_line_required"));
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await changeOverseasApprovalLine(paymentId, {
                appr_line_no: selectedLine.appr_line_no,
                approvers: selectedLine.approvers.map((a) => ({
                    apprvr_id: a.apprvr_id,
                    apprvr_nm: a.apprvr_nm,
                })),
            });
            handleClose();
            dialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("payment.overseas.change_approver_success"),
                confirmText: t("dialog.ok"),
                onConfirm:   () => onSaved?.(),
            });
        } catch (err: unknown) {
            setError((err as { message?: string })?.message ?? "Failed to save.");
        } finally {
            setSaving(false);
        }
    }, [paymentId, selectedLine, dialog, onSaved, handleClose, t]);

    const amountStr = totalAmount != null ? formatAmount(totalAmount, ccyCd ?? "VND") : undefined;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
            <DialogContent
                hideClose
                aria-describedby={undefined}
                className="flex h-[90vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-md p-0 shadow-2xl"
            >
                <DialogTitle className="sr-only">
                    {t("payment.approval_details.title")}
                </DialogTitle>
                {/* ── Header ─────────────────────────────────────────── */}
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

                {/* ── Scrollable body ─────────────────────────────────── */}
                <div className="custom-scrollbar-y flex-1 overflow-y-auto px-6 py-5">

                    {/* Title + Pending badge */}
                    <div className="flex items-start gap-3 border-b border-wb-table-border pb-3">
                        <h2 className="truncate text-wb-24 font-semibold text-wb-dark">{title}</h2>
                        <span className="inline-flex shrink-0 items-center rounded px-2 py-0.5 text-wb-12 font-medium bg-wb-status-pending-bg text-wb-status-pending-text">
                            {t("payment.status.pending")}
                        </span>
                    </div>

                    {/* ── General Information ──────────────────────────── */}
                    <Section
                        title={t("payment.request_approval.section.general")}
                        open={showGeneral}
                        onToggle={() => setShowGeneral((v) => !v)}
                    >
                        <div className="grid grid-cols-[1fr_1fr] gap-x-12 gap-y-4 pt-4">
                            {/* Left column */}
                            <div className="flex flex-col gap-3">
                                <InfoRow icon="document" label={t("payment.request_approval.row.type")} value={t("payment.request_approval.type.overseas")} />
                                {documentNo && (
                                    <InfoRow icon="hash" label={t("payment.request_approval.row.document_no")} value={documentNo} />
                                )}
                                {scheduledDate && (
                                    <InfoRow icon="calendar" label={t("payment.request_approval.row.scheduled_date")} value={scheduledDate} />
                                )}
                                {amountStr && (
                                    <InfoRow icon="coins" label={t("payment.request_approval.row.total_transfer")}>
                                        <span className="rounded border border-wb-ntrl-4 bg-wb-bg-sidebar px-1.5 py-0.5 text-wb-13 font-semibold text-wb-ink">
                                            {amountStr}
                                        </span>
                                    </InfoRow>
                                )}
                            </div>

                            {/* Right column */}
                            <div className="flex flex-col gap-3">
                                {(withdrawalBank || withdrawalAcct) && (
                                    <InfoRow
                                        icon="bank"
                                        label={t("payment.request_approval.row.withdrawal_bank_acct")}
                                        value={[withdrawalBank, withdrawalAcct, ccyCd ? `(Current ${ccyCd})` : ""].filter(Boolean).join(" ")}
                                    />
                                )}

                                {/* Approver row — editable */}
                                <div className="grid grid-cols-[140px_1fr] items-start gap-3">
                                    <div className="flex items-center gap-2 pt-2 text-wb-13 font-medium text-wb-ntrl-8">
                                        <CheckIconSvg />
                                        <span>
                                            {t("payment.request_approval.row.approver", {
                                                current: "0",
                                                total: String(displayApprovers.length),
                                            })}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex flex-col gap-2">
                                        {/* Dropdown */}
                                        <div ref={dropRef} className="relative w-48 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setDropdown((v) => !v)}
                                                className="flex h-8 w-full cursor-pointer items-center justify-between gap-1 rounded border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium shadow-sm hover:border-brand"
                                            >
                                                <span className={cn("min-w-0 truncate", selectedLine ? "text-wb-ink" : "text-wb-ntrl-5")}>
                                                    {selectedLine
                                                        ? selectedLine.appr_line_nm
                                                        : t("payment.request_approval.form.approval_line")}
                                                </span>
                                                <ChevronDown className="size-3.5 shrink-0 text-wb-ntrl-6" />
                                            </button>
                                            {dropdownOpen && (
                                                <div className="absolute left-0 top-9 z-20 max-h-56 w-full overflow-y-auto rounded-md border border-wb-ntrl-4 bg-white shadow-lg animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out">
                                                    {lines.length === 0 ? (
                                                        <div className="px-3 py-2 text-wb-13 text-wb-ntrl-6">
                                                            {t("payment.request_approval.form.no_approval_lines")}
                                                        </div>
                                                    ) : lines.map((line) => (
                                                        <button
                                                            key={line.appr_line_no}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelected(line.appr_line_no);
                                                                setDropdown(false);
                                                                setError(null);
                                                            }}
                                                            className={cn(
                                                                "flex w-full cursor-pointer items-center px-3 py-2 text-left text-wb-13 font-medium hover:bg-wb-bg-sidebar",
                                                                selectedLineNo === line.appr_line_no ? "text-wb-blue" : "text-wb-ink",
                                                            )}
                                                        >
                                                            {line.appr_line_nm}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                                        {/* Approver chips — vertical list (one per row) */}
                                        {displayApprovers.length > 0 && (
                                            <div className="flex flex-col gap-1.5">
                                                {displayApprovers.map((a, i) => (
                                                    <span
                                                        key={a.apprvr_id}
                                                        className="inline-flex max-w-fit items-center gap-1.5 rounded border border-wb-ntrl-4 bg-white px-2 py-1 text-wb-13 font-medium text-wb-ink"
                                                    >
                                                        <span className="text-wb-ntrl-6">{i + 1}</span>
                                                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-wb-bg-sidebar">
                                                            <svg viewBox="0 0 16 16" fill="currentColor" className="size-3 text-wb-status-pending-text" aria-hidden>
                                                                <circle cx="8" cy="6" r="2.5" />
                                                                <path d="M3 13c0-2 2.5-3.5 5-3.5s5 1.5 5 3.5v1H3v-1z" />
                                                            </svg>
                                                        </span>
                                                        <span className="uppercase">
                                                            {cleanName(a.apprvr_nm)}
                                                            {a.apprvr_id === userStorage.get()?.userId && ` ${t("settings.users.you_suffix")}`}
                                                        </span>
                                                        {i === 0 ? (
                                                            <>
                                                                <span className="ml-1 text-wb-12 font-normal text-wb-status-pending-text">
                                                                    {t("payment.approval_details.outcome.pending")}
                                                                </span>
                                                                <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5 shrink-0 text-wb-status-pending-text" aria-hidden>
                                                                    <path d="M4 2h8v1h-1v2c0 1.1-.6 2.2-1.5 2.8L8.7 8l.8.6c.9.6 1.5 1.7 1.5 2.8v2h1v1H4v-1h1v-2c0-1.1.6-2.2 1.5-2.8L7.3 8l-.8-.6C5.6 6.8 5 5.7 5 4.6V3H4V2zm2 1v1.6c0 .7.4 1.4 1 1.8L8 7l1-.6c.6-.4 1-1.1 1-1.8V3H6zm0 10h4v-1.6c0-.7-.4-1.4-1-1.8L8 9l-1 .6c-.6.4-1 1.1-1 1.8V13z" />
                                                                </svg>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="ml-1 text-wb-12 font-normal text-wb-status-pending-text">
                                                                    {t("payment.approval_details.outcome.not_order_yet")}
                                                                </span>
                                                                <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5 shrink-0 text-wb-status-pending-text" aria-hidden>
                                                                    <path d="M8 1.5L15 14H1L8 1.5zm0 2.5L3 13h10L8 4zm-.5 4h1v3h-1V8.5zm0 4h1v1h-1v-1z" />
                                                                </svg>
                                                            </>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </Section>

                    {/* ── Transaction Details ──────────────────────────── */}
                    <Section
                        title={`${t("payment.request_approval.section.transactions").split(" (")[0]} ${t("payment.transaction_count", { count: transactions.length })}`}
                        open={showTxns}
                        onToggle={() => setShowTxns((v) => !v)}
                    >
                        {transactions.length === 0 ? (
                            <div className="pt-6 text-center text-wb-13 text-wb-ntrl-6">
                                {t("payment.request_approval.no_transactions")}
                            </div>
                        ) : (
                            <div className="custom-scrollbar-x mt-3 overflow-x-auto">
                                <table className="w-full min-w-[1180px] border-collapse text-wb-13">
                                    <thead className="border-b border-wb-table-border bg-wb-bg-sidebar text-wb-dark">
                                        <tr>
                                            <th className="px-2.5 py-2 text-left font-semibold">{t("payment.overseas.col.beneficiary_name")}</th>
                                            <th className="px-2.5 py-2 text-left font-semibold">{t("payment.overseas.col.beneficiary_bank_name")}</th>
                                            <th className="px-2.5 py-2 text-left font-semibold">{t("payment.overseas.col.beneficiary_account_no")}</th>
                                            <th className="px-2.5 py-2 text-left font-semibold">{t("payment.overseas.col.beneficiary_address")}</th>
                                            <th className="px-2.5 py-2 text-right font-semibold">{t("payment.overseas.col.transfer_amount")}</th>
                                            <th className="px-2.5 py-2 text-left font-semibold">{t("payment.overseas.col.fee_payer")}</th>
                                            <th className="px-2.5 py-2 text-left font-semibold" style={{ minWidth: 212 }}>{t("payment.overseas.col.memo")}</th>
                                            <th className="px-2.5 py-2 text-left font-semibold" style={{ minWidth: 156 }}>{t("payment.request_approval.col.reporting_account")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map((row) => (
                                            <tr key={row.trn_seq} className="border-b border-wb-table-border last:border-b-0">
                                                {/* Beneficiary Name */}
                                                <td className="px-2.5 py-2 font-medium text-wb-ink">{row.bnfc_nm || ""}</td>
                                                {/* Beneficiary Bank Name + BIC */}
                                                <td className="px-2.5 py-2 font-medium text-wb-ink">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span>{row.bnfc_bank_nm || ""}</span>
                                                        {row.bic_cd && (
                                                            <span className="text-wb-12 font-normal text-wb-ntrl-6">{row.bic_cd}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                {/* Beneficiary Account No. */}
                                                <td className="px-2.5 py-2 font-medium text-wb-ink">{row.bnfc_acct_no || ""}</td>
                                                {/* Beneficiary Address */}
                                                <td className="px-2.5 py-2 font-medium text-wb-ink">{row.bnfc_addr || ""}</td>
                                                {/* Transfer Amount */}
                                                <td className="px-2.5 py-2 text-right font-medium text-wb-ink">
                                                    {formatAmount(row.trnf_amt, row.ccy_cd || ccyCd || "VND")}
                                                </td>
                                                {/* Fee Payer */}
                                                <td className="px-2.5 py-2 font-medium text-wb-ink">{row.fee_payer_cd || ""}</td>
                                                {/* Memo */}
                                                <td className="px-2.5 py-2 font-medium text-wb-ink">{row.memo || ""}</td>
                                                {/* Reporting Account */}
                                                <td className="px-2.5 py-2 font-medium text-wb-ink">{row.rprt_acct_cd || ""}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Section>
                </div>

                {/* ── Footer ─────────────────────────────────────────── */}
                <div className="flex shrink-0 items-center justify-between border-t border-wb-table-border px-6 py-3">
                    {/* Left: requested-by + attach + attachment count + save */}
                    <div className="flex items-center gap-3">
                        <span className="text-wb-13 font-normal text-wb-ntrl-6">
                            {t("payment.approval_details.requested_by", {
                                name: requestedBy,
                                date: requestedAt,
                            })}
                        </span>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleAttach}
                        />

                        {/* Attach button */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            <Paperclip className="size-3.5 shrink-0" strokeWidth={1.8} />
                            {t("payment.request_approval.attach")}
                        </button>

                        {/* Attachment count chip */}
                        <button
                            type="button"
                            className="flex h-8 cursor-pointer items-center rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium text-wb-blue shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("payment.request_approval.attachment_count", {
                                count: String(attachments.length),
                            })}
                        </button>

                        {error && (
                            <span className="text-wb-13 text-wb-status-rejected-text">{error}</span>
                        )}

                        {/* Save */}
                        <button
                            type="button"
                            disabled={saving || !selectedLine}
                            onClick={handleSave}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-5 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? "…" : t("dialog.save")}
                        </button>
                    </div>

                    {/* Right: Close */}
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-wb-ntrl-4 bg-white px-4 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                    >
                        {t("dialog.close")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ── Section wrapper — identical to ApprovalDetailsDialog ─────────────── */

function Section({
    title,
    open,
    onToggle,
    children,
}: {
    title:    string;
    open:     boolean;
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
                {open
                    ? <ChevronUp   className="size-4 text-wb-ntrl-6" strokeWidth={1.8} />
                    : <ChevronDown className="size-4 text-wb-ntrl-6" strokeWidth={1.8} />
                }
            </button>
            {open && <div className="pt-1">{children}</div>}
        </div>
    );
}

/* ── InfoRow — identical to ApprovalDetailsDialog ─────────────────────── */

function InfoRow({
    icon,
    label,
    value,
    children,
}: {
    icon:     "document" | "hash" | "calendar" | "coins" | "bank";
    label:    string;
    value?:   React.ReactNode;
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

function CheckIconSvg() {
    return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="size-4 shrink-0 text-wb-ntrl-6 opacity-60" aria-hidden>
            <path d="M14 4.5l-7 7-4-4 .708-.707L7 10.086l6.292-6.293L14 4.5z" />
        </svg>
    );
}

function RowIcon({ name }: { name: string }) {
    const cls = "size-4 shrink-0 text-wb-ntrl-6 opacity-60";
    switch (name) {
        case "document":
            return <svg viewBox="0 0 16 16" fill="currentColor" className={cls} aria-hidden><path d="M5 4h6v1H5V4zm0 2h6v1H5V6zm0 2h3v1H5V8zm-2-5.5C3 1.67 3.67 1 4.5 1h7c.83 0 1.5.67 1.5 1.5v11c0 .83-.67 1.5-1.5 1.5h-7C3.67 15 3 14.33 3 13.5v-11zm1.5-.5a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h7a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5h-7z" /></svg>;
        case "hash":
            return <svg viewBox="0 0 16 16" fill="currentColor" className={cls} aria-hidden><path d="M6.5 3.5l-.5 3H3v1.5h2.75l-.5 3H3V12h2.083l-.333 2h1.5l.333-2h2.917l-.333 2h1.5l.333-2H13v-1H10.25l.5-3H13V6h-2.083l.333-2h-1.5L9.417 6H6.5l.333-2h-1.5l-.333 2H4.917V4H6.5V3.5zm2.667 4H6.25l-.5 3h2.917l.5-3z" /></svg>;
        case "calendar":
            return <svg viewBox="0 0 16 16" fill="currentColor" className={cls} aria-hidden><path d="M4 2h1v1H4V2zm7 0h1v1h-1V2zM3 4h10v1H3V4zm0 2h10v8H3V6zm2 2v1h2V8H5zm3 0v1h2V8H8zm-3 2v1h2v-1H5zm3 0v1h2v-1H8z" /></svg>;
        case "coins":
            return <svg viewBox="0 0 16 16" fill="currentColor" className={cls} aria-hidden><circle cx="6" cy="8" r="3.5" fill="none" stroke="currentColor" /><circle cx="10" cy="8" r="3.5" fill="none" stroke="currentColor" /></svg>;
        case "bank":
            return <svg viewBox="0 0 16 16" fill="currentColor" className={cls} aria-hidden><path d="M8 1L2 4v1h12V4L8 1zM3 6h2v6H3V6zm3.5 0h2v6h-2V6zM10 6h2v6h-2V6zM2 13h12v1H2v-1z" /></svg>;
        default:
            return null;
    }
}
