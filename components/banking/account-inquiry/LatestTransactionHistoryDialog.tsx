"use client";

import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatDateChipNumeric } from "@/components/shared/DateField";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import { fetchTransactions } from "@/lib/api/banking";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

import type { SyncSelectedAccount } from "./TransactionSyncDialog";

/** Format the raw wire {@code TRSC_DT} ({@code yyyyMMdd}, e.g.
 *  {@code 20260515}) as {@code yyyy-MM-dd} (e.g. {@code 2026-05-15})
 *  for the date column. Returns the input verbatim when the shape
 *  doesn't match so a malformed value is still visible. */
function formatTrscDt(raw: string): string {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
    if (!m) return raw;
    return `${m[1]}-${m[2]}-${m[3]}`;
}

type Props = {
    /** Accounts the user just synced — these drive the per-account
     *  transaction fetches that populate the table. */
    accounts: SyncSelectedAccount[];
    /** ISO {@code YYYY-MM-DD} start date the sync used. */
    startIso: string;
    /** ISO {@code YYYY-MM-DD} end date. */
    endIso: string;
    onClose: () => void;
};

/**
 * Latest Transaction History popup — auto-opens after the user clicks
 * Close on the post-sync Information dialog. Shows the transactions
 * scraped for the selected accounts within the sync date window.
 *
 * <p>For each selected account, calls
 * {@code GET /api/v1/banking/accounts/{acctSeqNo}/transactions} with
 * the sync window, then merges + sorts by date desc. Empty result
 * renders the "No transaction found." empty state from the Figma.
 *
 * <p>Per CLAUDE.md modal stack rules: this dialog sits at L2 because
 * it opens on top of the Sync popup (L1). Outside-click and ESC are
 * permitted (legacy behaviour — a side popup that's safe to dismiss).
 */
type Row = {
    date: string;
    desc: string;
    amount: string;
    inout: "IN" | "OUT";
    currency: string;
};

export default function LatestTransactionHistoryDialog({
    accounts,
    startIso: initialStartIso,
    endIso:   initialEndIso,
    onClose,
}: Props) {
    const { t } = useTranslation();
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);

    // Mirror the incoming props as internal state so the user can
    // refilter the displayed transactions by changing the date range
    // without leaving the dialog. The fetch effect below re-runs on
    // every change → table refreshes automatically.
    const [startIso, setStartIso] = useState(initialStartIso);
    const [endIso,   setEndIso]   = useState(initialEndIso);

    useEffect(() => {
        let cancelled = false;
        const from = startIso.replaceAll("-", "");
        const to   = endIso.replaceAll("-", "");

        (async () => {
            try {
                const results = await Promise.all(
                    accounts.map((a) =>
                        fetchTransactions(a.id, { from, to }).catch(
                            () => ({ ROWS: [] as Array<Record<string, unknown>> }),
                        ),
                    ),
                );
                if (cancelled) return;
                const merged: Row[] = [];
                for (const r of results) {
                    const rows = (r as { ROWS?: Array<Record<string, unknown>> }).ROWS ?? [];
                    for (const tx of rows) {
                        // Wire shape (ApiTransactionRow, UPPER_SNAKE holdover):
                        // INOUT_DV = "1" → IN (deposit), uses DEPOSIT_AMT;
                        // INOUT_DV = "2" → OUT (withdraw), uses WITHDRAW_AMT.
                        // RMRK is the only remark field on the list-row shape
                        // (RMRK2 lives on the detail endpoint only).
                        const inout: "IN" | "OUT" = String(tx.INOUT_DV) === "1" ? "IN" : "OUT";
                        const rawAmt = inout === "IN" ? tx.DEPOSIT_AMT : tx.WITHDRAW_AMT;
                        merged.push({
                            date:     String(tx.TRSC_DT ?? ""),
                            desc:     String(tx.RMRK ?? ""),
                            amount:   String(rawAmt ?? "0"),
                            inout,
                            // List rows don't carry CCY_CD per row — fall
                            // back to the (uniform per account) currency
                            // the caller already knows from selectedAccounts.
                            currency: String(tx.CCY_CD ?? accounts[0]?.currencyCd ?? "VND"),
                        });
                    }
                }
                // Most-recent first (date desc; tiebreaker by insertion).
                merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
                setRows(merged);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [accounts, startIso, endIso]);

    const totalCount = rows.length;
    const totalCredit = rows
        .filter((r) => r.inout === "IN")
        .reduce((s, r) => s + Number(r.amount || "0"), 0);

    return (
        <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent
                stackLevel={2}
                className="max-w-[680px] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col p-5">
                    <DialogTitle asChild>
                        <h2 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                            {t("account_inquiry.sync.history_title")}
                        </h2>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {t("account_inquiry.sync.history_subtitle")}
                    </DialogDescription>

                    {/* Date range row — interactive. Seeded from the
                       sync window the parent passed in; user can change
                       either end and the table refetches on the new
                       window (see the fetch effect above which depends
                       on `startIso` / `endIso`). */}
                    <div className="mt-4">
                        <InteractiveDateRangePicker
                            startIso={startIso}
                            endIso={endIso}
                            onChange={({ start, end }) => {
                                setStartIso(start);
                                setEndIso(end);
                                setLoading(true);
                            }}
                            formatValue={formatDateChipNumeric}
                            portalled
                        />
                    </div>

                    {/* Body — table or empty state. */}
                    <div className="custom-scrollbar mt-4 min-h-[300px] max-h-[400px] overflow-auto rounded-md border border-wb-border-sidebar bg-wb-bg-sidebar/30">
                        {loading ? (
                            <div className="flex h-full min-h-[300px] items-center justify-center text-wb-13 text-wb-muted">
                                {t("common.loading")}
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="flex h-full min-h-[300px] items-center justify-center text-wb-13 font-medium text-wb-status-rejected-text">
                                {t("account_inquiry.sync.history_empty")}
                            </div>
                        ) : (
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                                    <tr className="text-left">
                                        <th className="px-3 py-2.5 text-wb-13 font-semibold text-wb-dark">
                                            {t("account_inquiry.sync.history_col.date")}
                                        </th>
                                        <th className="px-3 py-2.5 text-wb-13 font-semibold text-wb-dark">
                                            {t("account_inquiry.sync.history_col.description")}
                                        </th>
                                        <th className="px-3 py-2.5 text-right text-wb-13 font-semibold text-wb-dark">
                                            {t("account_inquiry.sync.history_col.amount")}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <tr key={i} className="border-t border-wb-border-sidebar">
                                            <td className="px-3 py-2.5 text-wb-13 font-medium text-wb-ink">
                                                {formatTrscDt(r.date)}
                                            </td>
                                            <td className="px-3 py-2.5 text-wb-13 font-medium text-wb-ink">
                                                {r.desc || "—"}
                                            </td>
                                            <td className={`px-3 py-2.5 text-right text-wb-13 font-semibold ${
                                                r.inout === "IN" ? "text-brand" : "text-wb-status-rejected-text"
                                            }`}>
                                                {r.inout === "IN" ? "+" : "-"}
                                                {formatAmount(Number(r.amount), r.currency, false)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Footer — totals row matches Figma. */}
                    <div className="mt-3 flex items-center justify-between text-wb-13">
                        <span className="font-medium text-wb-ink">
                            {t("account_inquiry.sync.history_total")}{" "}
                            <span className="font-semibold text-brand">{totalCount}</span>{" "}
                            {t("account_inquiry.sync.history_transactions")}
                        </span>
                        <span className="font-medium text-wb-ink">
                            {t("account_inquiry.sync.history_credit_label")}{" "}
                            <span className="font-semibold">
                                {formatAmount(totalCredit, accounts[0]?.currencyCd ?? "VND", true)}
                            </span>
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
