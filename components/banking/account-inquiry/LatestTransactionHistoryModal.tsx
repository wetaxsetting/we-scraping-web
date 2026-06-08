"use client";

import { useEffect, useMemo, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatDateChipNumeric } from "@/components/shared/DateField";
import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { ApiCallError, fetchTransactions } from "@/lib/api/banking";

/**
 * Latest Transaction History popup — real-data via per-account fetches
 * against {@code GET /api/v1/banking/accounts/{acctSeqNo}/transactions}
 * (refactor decision 4, 2026-05-28). Opens from the post-sync Credit /
 * Debit "View" links inside Bank Transaction Sync.
 *
 * <p>The parent dialog hands in one or more selected accounts; the
 * popup fans out to the existing per-account transactions endpoint
 * with {@code type=DEPOSIT} when {@link Props#type} is CREDIT and
 * {@code type=WITHDRAW} when DEBIT — the same backend filter Banking
 * Transaction History uses. Results are merged client-side, sorted by
 * {@code TRSC_DT}+{@code TRSC_TM} ascending, and rendered with the
 * existing four-column chrome.
 *
 * <p>Per CLAUDE.md modal-stack rules this dialog sits at L2 (it opens
 * on top of the L1 Bank Transaction Sync popup). Close affordance is
 * X-only per the spec ("Popup closes only by X button. Do not close
 * when clicking outside.").
 */
export type HistoryType = "CREDIT" | "DEBIT";

/** Minimal account identifier the popup needs to fetch transactions.
 *  Maps to the legacy synthetic {@code BANK_CD + "_" + ACCT_NO} the
 *  controller's {@code acctSeqNo} path param expects. */
export type LatestHistoryAccount = {
    bankCd: string;
    accountNo: string;
    /** Optional — drives amount formatting (VND no decimals, USD 2
     *  decimals, etc.). Defaults to "VND" when omitted. */
    currencyCd?: string;
};

type Props = {
    /** Which "View" link the user clicked — drives the rows shown,
     *  the Amount column sign + color, and the footer label. */
    type: HistoryType;
    /** Sync window seeded from the parent. Falls back to a reasonable
     *  default when omitted so the popup still renders standalone. */
    startIso?: string;
    endIso?:   string;
    /** Accounts to query. When omitted (or empty), the popup shows the
     *  empty state — never the mock data the earlier scaffold rendered. */
    accounts?: LatestHistoryAccount[];
    onClose: () => void;
};

type DisplayRow = {
    /** Pre-formatted display date — {@code "DD-MM-YYYY HH:mm:ss"}. */
    date:        string;
    /** Numeric amount as parsed from the wire (always positive — the
     *  sign + color come from {@link Props#type}). */
    amount:      number;
    /** Free-text transaction memo. */
    description: string;
};

/** Today as ISO {@code YYYY-MM-DD} in local time. */
function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Last 30 days" — same default the sync popup uses when no window is
 *  threaded through. */
function defaultStartIso(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Convert ISO {@code YYYY-MM-DD} to legacy {@code YYYYMMDD} — the wire
 *  format the existing {@code fetchTransactions} fetcher expects. */
function isoToCompact(iso: string): string {
    return iso.replace(/-/g, "");
}

/** Format a {@code (TRSC_DT, TRSC_TM)} pair from the wire as the legacy
 *  DD-MM-YYYY HH:mm:ss the popup renders. {@code TRSC_TM} may be blank
 *  for older rows — fall back to {@code 00:00:00}. */
function formatRowDate(trscDt: string, trscTm: string): string {
    const dt = (trscDt || "").padEnd(8, "0");
    const yy = dt.slice(0, 4);
    const mm = dt.slice(4, 6);
    const dd = dt.slice(6, 8);
    const tm = (trscTm || "").padEnd(6, "0");
    const hh = tm.slice(0, 2);
    const mi = tm.slice(2, 4);
    const ss = tm.slice(4, 6);
    return `${dd}-${mm}-${yy} ${hh}:${mi}:${ss}`;
}

export default function LatestTransactionHistoryModal({
    type,
    startIso: initialStartIso,
    endIso:   initialEndIso,
    accounts,
    onClose,
}: Props) {
    const { t } = useTranslation();

    const [startIso, setStartIso] = useState(initialStartIso ?? defaultStartIso());
    const [endIso,   setEndIso]   = useState(initialEndIso   ?? todayIso());

    /** Fetched rows from the API — merged across every account the
     *  caller passed in. {@code null} = first fetch in flight (loading
     *  spinner). Empty array = real empty-state from the backend. */
    const [rows, setRows] = useState<DisplayRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Stable account list — caller's array identity is not guaranteed
    // stable across re-renders. We key off the join so the effect only
    // re-fetches when the set of accounts actually changes.
    const accountsKey = useMemo(
        () => (accounts ?? []).map((a) => `${a.bankCd}_${a.accountNo}`).join("|"),
        [accounts],
    );

    // Currency for amount formatting — the popup is opened per
    // currency group, so taking the first selected account's currency
    // matches the parent's grouping. Defaults to VND.
    const currencyCd = useMemo(
        () => (accounts && accounts[0]?.currencyCd) || "VND",
        [accounts],
    );

    useEffect(() => {
        let cancelled = false;
        const list = accounts ?? [];
        if (list.length === 0) {
            setRows([]);
            setError(null);
            return;
        }
        setRows(null);
        setError(null);

        const fromCompact = isoToCompact(startIso);
        const toCompact   = isoToCompact(endIso);
        // Map the popup's CREDIT/DEBIT type to the backend's legacy
        // DEPOSIT/WITHDRAW filter — same mapping the BankTransactionSync
        // service uses when persisting INOUT_DV ("1"=deposit/credit,
        // "2"=withdraw/debit).
        const wireType = type === "CREDIT" ? "DEPOSIT" : "WITHDRAW";

        Promise.all(
            list.map((a) =>
                fetchTransactions(`${a.bankCd}_${a.accountNo}`, {
                    from: fromCompact,
                    to:   toCompact,
                    type: wireType,
                }),
            ),
        )
            .then((responses) => {
                if (cancelled) return;
                const merged: DisplayRow[] = [];
                for (const res of responses) {
                    for (const r of res.rows ?? []) {
                        const amt = parseFloat(
                            type === "CREDIT" ? r.deposit_amt : r.withdraw_amt,
                        );
                        merged.push({
                            date:        formatRowDate(r.trsc_dt, r.trsc_tm),
                            amount:      Number.isFinite(amt) ? Math.abs(amt) : 0,
                            description: r.rmrk ?? "",
                        });
                    }
                }
                // Chronological by display date — same DD-MM-YYYY format
                // sorts lexicographically per (year, month, day, time)
                // because we constructed it that way.
                merged.sort((a, b) => {
                    // Re-parse for proper ordering: YYYYMMDDHHmmss.
                    const ka = a.date.slice(6, 10) + a.date.slice(3, 5) + a.date.slice(0, 2) + a.date.slice(11).replace(/:/g, "");
                    const kb = b.date.slice(6, 10) + b.date.slice(3, 5) + b.date.slice(0, 2) + b.date.slice(11).replace(/:/g, "");
                    return ka.localeCompare(kb);
                });
                setRows(merged);
            })
            .catch((err) => {
                if (cancelled) return;
                const msg =
                    err instanceof ApiCallError
                        ? err.message
                        : err instanceof Error
                          ? err.message
                          : "Failed to load transactions.";
                setRows([]);
                setError(msg);
            });

        return () => { cancelled = true; };
    }, [accountsKey, startIso, endIso, type]);

    const loading = rows === null;
    const displayRows = rows ?? [];
    const isEmpty = !loading && displayRows.length === 0;
    const totalCount = displayRows.length;
    const totalAmount = displayRows.reduce((sum, r) => sum + r.amount, 0);

    // Credit vs. Debit drives the Type label, amount sign + color, and
    // footer label. Centralised here so the table body stays declarative.
    const typeLabel =
        type === "CREDIT"
            ? t("account_inquiry.sync.col.credit")
            : t("account_inquiry.sync.col.debit");
    const amountSign  = type === "CREDIT" ? "+" : "-";
    const amountColor =
        type === "CREDIT" ? "text-brand" : "text-wb-status-rejected-text";
    const footerLabel =
        type === "CREDIT"
            ? t("account_inquiry.sync.history_credit_label")
            : t("account_inquiry.sync.history_debit_label");

    return (
        <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent
                stackLevel={2}
                // 750 px on the wide breakpoint, max-w-[92vw] preserves
                // the small-screen responsiveness the Sync History
                // popup already established.
                className="w-[750px] max-w-[92vw] rounded-2xl p-0"
                // X is the only dismiss affordance per the static-UI
                // spec: clicking the dimmed parent must NOT close.
                closeOnOutsideClick={false}
                closeOnEscape={false}
            >
                <div className="flex w-full flex-col px-5 py-5">
                    {/* ── Title ───────────────────────────────────────── */}
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold leading-[18px] text-wb-dark">
                            {t("account_inquiry.sync.history_title")}
                        </h2>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {t("account_inquiry.sync.history_subtitle")}
                    </DialogDescription>

                    {/* ── Date range row — mirrors Bank Transaction Sync
                       chip styling (chip + ~ + chip + calendar icon). */}
                    <div className="mt-4">
                        <InteractiveDateRangePicker
                            startIso={startIso}
                            endIso={endIso}
                            onChange={({ start, end }) => {
                                setStartIso(start);
                                setEndIso(end);
                            }}
                            formatValue={formatDateChipNumeric}
                            separator="~"
                            expandRight
                            portalled
                        />
                    </div>

                    {/* ── Table — chrome mirrors SyncHistoryDialog
                       (bordered card + sticky header bg-wb-bg-sidebar +
                       wb-table-border dividers). 4 columns: Date / Type /
                       Description / Amount. */}
                    <div className="mt-4 h-[320px] overflow-hidden rounded-md border border-wb-table-border bg-white">
                        {loading ? (
                            <div className="flex h-full w-full items-center justify-center text-wb-13 font-medium text-wb-muted">
                                {/* Reuse the same key vocabulary the
                                   sync popup uses for in-flight chrome;
                                   no new locale key required. */}
                                {t("account_inquiry.sync.in_progress")}
                            </div>
                        ) : error ? (
                            <div className="flex h-full w-full items-center justify-center text-wb-13 font-medium text-wb-status-rejected-text">
                                {error}
                            </div>
                        ) : isEmpty ? (
                            <div className="flex h-full w-full items-center justify-center text-wb-13 font-medium text-wb-muted">
                                {t("account_inquiry.sync.history_empty")}
                            </div>
                        ) : (
                            <div className="custom-scrollbar h-full overflow-auto">
                                {/* {@code table-fixed} pins every {@code <col>}
                                   width so the flexible Description column
                                   can't expand the row when a transaction
                                   memo is long — the cell's intrinsic min-
                                   content would otherwise outweigh the
                                   colgroup hint under the default auto
                                   layout. Pairs with {@link EllipsisTooltip}'s
                                   single-line truncate inside the cell. */}
                                <table className="w-full table-fixed border-collapse">
                                    <colgroup>
                                        <col className="w-[180px]" />
                                        <col className="w-[80px]" />
                                        <col />
                                        <col className="w-[140px]" />
                                    </colgroup>
                                    <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                                        <tr className="border-b border-wb-table-border">
                                            <Th>{t("account_inquiry.sync.history_col.date")}</Th>
                                            <Th>{t("account_inquiry.sync.history_col.type")}</Th>
                                            <Th>{t("account_inquiry.sync.history_col.description")}</Th>
                                            <Th align="right">{t("account_inquiry.sync.history_col.amount")}</Th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayRows.map((r, i) => (
                                            <tr
                                                key={i}
                                                // Row chrome mirrors SyncHistoryDialog
                                                // ({@code h-[50px]} + hover tint +
                                                // wb-table-border divider). Fixed
                                                // height keeps row rhythm consistent
                                                // even when a description ellipses.
                                                className="h-[50px] border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                                            >
                                                <Td>{r.date}</Td>
                                                <Td>
                                                    <span className={`whitespace-nowrap ${amountColor}`}>
                                                        {typeLabel}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    {/* Single-line ellipsis + portal
                                                       tooltip on overflow. The shared
                                                       {@link EllipsisTooltip} handles
                                                       white-space:nowrap, overflow:hidden,
                                                       and text-overflow:ellipsis, surfacing
                                                       the full string in the common dark
                                                       tooltip only when the visible text
                                                       is actually truncated. The browser
                                                       default {@code title} is
                                                       intentionally NOT used. */}
                                                    <EllipsisTooltip
                                                        text={r.description || "—"}
                                                        className="font-medium text-wb-ink"
                                                    />
                                                </Td>
                                                <Td align="right">
                                                    <span className={`whitespace-nowrap ${amountColor}`}>
                                                        {amountSign}
                                                        {formatAmount(r.amount, currencyCd, true)}
                                                    </span>
                                                </Td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ── Footer summary — total count (selected type
                       only) + selected-type signed total. */}
                    <div className="mt-3 flex items-center gap-6 text-wb-13 font-medium text-wb-ink">
                        <span>
                            {t("account_inquiry.sync.history_total")}{" "}
                            <span className={`font-semibold ${isEmpty ? "text-wb-status-rejected-text" : "text-brand"}`}>
                                {totalCount}
                            </span>{" "}
                            {t("account_inquiry.sync.history_transactions")}
                        </span>
                        <span>
                            {footerLabel}{" "}
                            <span className="font-semibold">
                                {formatAmount(totalAmount, currencyCd, true)}
                            </span>
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/** Header cell — matches the Sync History dialog chrome. */
function Th({
    children,
    align = "left",
}: {
    children: React.ReactNode;
    align?: "left" | "right";
}) {
    return (
        <th
            className={`whitespace-nowrap bg-wb-bg-sidebar px-3 py-3 align-middle text-wb-13 font-semibold text-wb-dark ${
                align === "right" ? "text-right" : "text-left"
            }`}
        >
            {children}
        </th>
    );
}

/** Body cell — rhythm mirrors the SyncHistoryDialog row exactly
 *  ({@code whitespace-nowrap px-3 py-3 align-middle text-wb-13
 *  font-medium text-wb-ink}). The Description column overrides
 *  {@code whitespace-nowrap}/{@code overflow} inside {@link EllipsisTooltip}
 *  so long memos truncate instead of forcing the row taller. */
function Td({
    children,
    align = "left",
}: {
    children: React.ReactNode;
    align?: "left" | "right";
}) {
    return (
        <td
            className={`whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink ${
                align === "right" ? "text-right" : "text-left"
            }`}
        >
            {children}
        </td>
    );
}
