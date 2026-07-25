"use client";

import { useEffect, useMemo, useState } from "react";

import { ApiCallError } from "@/lib/api/banking";
import { putCardTransactionReportingAccount } from "@/lib/api/cardTransactions";
import { fetchChartOfAccountsTree } from "@/lib/api/chartOfAccounts";
import { useDialog } from "@/components/shared/dialog";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ApiChartOfAccountTreeNode } from "@/lib/types/api";

import type { CardTransaction } from "./cardTransactionMappers";

type ReportingAccountPickerDialogProps = {
    row:        CardTransaction | null;
    onClose:    () => void;
    onSaved:    () => void;
};

/**
 * Reporting-account picker for a Card Transactions row. Consumes the
 * existing `GET /api/v1/settings/chart-of-accounts/tree` projection
 * (OQ-4 default — feature spec §11) and posts the chosen
 * `(chart_acct_seq_no, chart_acct_cd)` pair via
 * `PUT /api/v1/payment/card-transactions/{cardSeqNo}/reporting-account`.
 *
 * <p>Sprint 0 renders the tree as a flat searchable list keyed by code
 * + name (the tree projection ships `breadcrumb` pre-rendered, so we
 * can show the hierarchy without rebuilding it client-side). Restricted
 * roots (`ACC-01` / `ACC-02` / `ACC-03`) are excluded from the picker
 * because the legacy reporting-account flow only assigns leaves /
 * sub-leaves — same precedent as TransactionService's CHART_ACCT
 * validation.
 */
export default function ReportingAccountPickerDialog({
    row,
    onClose,
    onSaved,
}: ReportingAccountPickerDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    const treeState = useApiData(() => fetchChartOfAccountsTree(), []);

    const [search, setSearch] = useState("");
    const [selection, setSelection] = useState<ApiChartOfAccountTreeNode | null>(null);
    const [saving, setSaving] = useState(false);

    // Reset local state every time a new row opens the picker.
    useEffect(() => {
        setSearch("");
        setSelection(null);
    }, [row?.cardSeqNo]);

    const nodes: ApiChartOfAccountTreeNode[] = useMemo(() => {
        const all = treeState.data?.nodes ?? [];
        // Only level 2 and deeper are selectable — level-1 root categories
        // (restricted ACC-0x + any user-created root) are non-postable
        // headers, not reporting accounts (2026-07-24 requirement).
        return all.filter((n) => n.chart_acct_level >= 2);
    }, [treeState.data]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return nodes;
        return nodes.filter((n) =>
            (`${n.chart_acct_cd} ${n.chart_acct_nm_en} ${n.breadcrumb}`)
                .toLowerCase()
                .includes(q),
        );
    }, [nodes, search]);

    if (!row) return null;

    async function handleSave() {
        if (!row || !selection) return;
        setSaving(true);
        try {
            await putCardTransactionReportingAccount(row.cardSeqNo, {
                chart_acct_seq_no: selection.chart_acct_seq_no,
                chart_acct_cd:     selection.chart_acct_cd,
            });
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("payment.card.toast.saved"),
            });
            onSaved();
            onClose();
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : t("payment.card.dialog.reporting_account.save_failed");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-[640px]">
                <DialogHeader>
                    <DialogTitle>
                        {t("payment.card.dialog.reporting_account.title")}
                    </DialogTitle>
                    <DialogDescription>
                        {row.cardNo} · {row.merchNm ?? ""} · {row.trscAmt}
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("payment.card.dialog.reporting_account.placeholder")}
                        className={cn(
                            "mb-3 w-full rounded-md border border-wb-ntrl-4 bg-white px-3",
                            "h-[var(--h-wb-filter-btn)] text-wb-13 font-normal text-wb-ink",
                            "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40",
                        )}
                    />
                    <div
                        className={cn(
                            "custom-scrollbar-y h-[320px] overflow-y-auto rounded-md border border-wb-ntrl-4",
                        )}
                    >
                        {treeState.loading ? (
                            <p className="p-4 text-wb-13 font-medium text-wb-muted">
                                {t("common.loading")}
                            </p>
                        ) : filtered.length === 0 ? (
                            <p className="p-4 text-wb-13 font-medium text-wb-muted">
                                {t("payment.card.dialog.reporting_account.empty")}
                            </p>
                        ) : (
                            <ul role="listbox" aria-label={t("payment.card.dialog.reporting_account.title")}>
                                {filtered.map((n) => {
                                    const active =
                                        selection?.chart_acct_seq_no === n.chart_acct_seq_no;
                                    return (
                                        <li key={n.chart_acct_seq_no}>
                                            <button
                                                type="button"
                                                role="option"
                                                aria-selected={active}
                                                onClick={() => setSelection(n)}
                                                className={cn(
                                                    "block w-full cursor-pointer px-3 py-2 text-left",
                                                    "border-b border-wb-table-border last:border-b-0",
                                                    active
                                                        ? "bg-brand/10"
                                                        : "hover:bg-neutral-50",
                                                )}
                                            >
                                                <span className="block text-wb-13 font-semibold text-wb-ink">
                                                    {n.chart_acct_cd} — {n.chart_acct_nm_en}
                                                </span>
                                                <span className="block truncate text-wb-12 font-medium text-wb-muted">
                                                    {n.breadcrumb}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </DialogBody>
                <DialogFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="inline-flex h-[var(--h-wb-filter-btn)] items-center rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium text-wb-ntrl-8 shadow-wb-btn hover:bg-neutral-50 disabled:opacity-50"
                    >
                        {t("dialog.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !selection}
                        className="inline-flex h-[var(--h-wb-filter-btn)] items-center rounded-md bg-brand px-4 text-wb-13 font-semibold text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:opacity-50"
                    >
                        {t("dialog.save")}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
