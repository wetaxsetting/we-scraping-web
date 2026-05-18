"use client";

import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { fetchDailyFinancialTransactions } from "@/lib/api/banking";
import { mapDailyFinancialTransactionsResponse } from "@/lib/api/mappers";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

import type { CurrentAccountRow, TxHistoryResponse } from "./types";

/** Format `yyyyMMdd` → `yyyy-MM-dd` for the As-of header chip. Falls back
 *  to the raw value when the shape doesn't match. */
function formatAsOf(iso: string): string {
    // Accept both ISO YYYY-MM-DD and yyyyMMdd; the parent passes the ISO
    // value (`asOfIsoDate`), so the dash form is the common case.
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(iso);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : iso;
}

/** Format `HHmmss` (legacy wire) → `HH:mm:ss` for the Time column. */
function formatTime(raw: string): string {
    if (!raw) return "";
    if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
    const m = /^(\d{2})(\d{2})(\d{2})$/.exec(raw);
    return m ? `${m[1]}:${m[2]}:${m[3]}` : raw;
}

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100] as const;

type Props = {
    /** The clicked account row — provides bank, account number, nickname,
     *  currency, and the bank/account identifiers the backend needs. */
    account: CurrentAccountRow;
    /** ISO `YYYY-MM-DD` — the date selected on the parent page. */
    asOfIsoDate: string;
    /** Flows through from the parent "Include internal transfers" toggle. */
    includeInternalTransfers: boolean;
    onClose: () => void;
};

/**
 * Daily Financial > "Transaction History Details" popup. Mirrors legacy
 * `rept_0015_002` — opens when the user clicks Bank / Account No. /
 * Account Nickname on the parent ledger.
 *
 * <p>Header shows As-of date, bank + account number, currency. Body is a
 * 5-column transaction table (Time · Debit · Credit · Balance · Remarks).
 * Footer shows total count + total debit + total credit + closing balance.
 * Page size dropdown is anchored bottom-left; page nav (when wired) sits
 * to its right.
 */
export default function TransactionHistoryDialog({
    account,
    asOfIsoDate,
    includeInternalTransfers,
    onClose,
}: Props) {
    const { t } = useTranslation();
    const [data, setData] = useState<TxHistoryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [pageSize, setPageSize] = useState<number>(15);
    const [page, setPage] = useState(1);

    /* Backend expects yyyyMMdd. */
    const asOfWire = asOfIsoDate.replaceAll("-", "");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const wire = await fetchDailyFinancialTransactions({
                    asOf: asOfWire,
                    bankCd: account.bankCd,
                    acctNo: account.accountNo,
                    includeInternalTransfers,
                    page,
                    size: pageSize,
                });
                if (cancelled) return;
                setData(mapDailyFinancialTransactionsResponse(wire));
            } catch {
                if (!cancelled) {
                    setData({
                        totalCount: 0,
                        totalIn: "0",
                        totalOut: "0",
                        closingBalance: "0",
                        pageNo: page,
                        pageSize,
                        rows: [],
                    });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [asOfWire, account.bankCd, account.accountNo, includeInternalTransfers, page, pageSize]);

    const totalCount = data?.totalCount ?? 0;
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

    return (
        <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent
                stackLevel={2}
                className="max-w-[1024px] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col">
                    {/* Title bar */}
                    <div className="flex items-center justify-between border-b border-wb-border-sidebar px-6 py-4">
                        <DialogTitle asChild>
                            <h2 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                                {t("report.daily_financial.tx_dialog.title")}
                            </h2>
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            {t("report.daily_financial.tx_dialog.title")}
                        </DialogDescription>
                    </div>

                    {/* Header chips — As of / Bank+Account No. / Currency */}
                    <div className="flex flex-wrap items-center gap-6 bg-wb-bg-sidebar/40 px-6 py-3 text-wb-13">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-wb-muted">
                                {t("report.as_of")}
                            </span>
                            <span className="font-semibold text-wb-ink">
                                {formatAsOf(asOfIsoDate)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-wb-muted">
                                {t("report.daily_financial.tx_dialog.bank_account")}
                            </span>
                            <span className="font-semibold text-wb-ink">
                                {account.bank} / {account.accountNo}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-wb-muted">
                                {t("report.daily_financial.col.currency")}
                            </span>
                            <span className="font-semibold text-wb-ink">
                                {account.currency}
                            </span>
                        </div>
                    </div>

                    {/* Body — transactions table */}
                    <div className="custom-scrollbar min-h-[300px] max-h-[420px] overflow-auto">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                                <tr className="text-left">
                                    <th className="px-3 py-2.5 text-wb-13 font-semibold text-wb-dark">
                                        {t("report.daily_financial.tx_dialog.col.time")}
                                    </th>
                                    <th className="px-3 py-2.5 text-right text-wb-13 font-semibold text-wb-dark">
                                        {t("report.daily_financial.tx_dialog.col.debit")}
                                    </th>
                                    <th className="px-3 py-2.5 text-right text-wb-13 font-semibold text-wb-dark">
                                        {t("report.daily_financial.tx_dialog.col.credit")}
                                    </th>
                                    <th className="px-3 py-2.5 text-right text-wb-13 font-semibold text-wb-dark">
                                        {t("report.daily_financial.tx_dialog.col.balance")}
                                    </th>
                                    <th className="px-3 py-2.5 text-wb-13 font-semibold text-wb-dark">
                                        {t("report.daily_financial.tx_dialog.col.remarks")}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-3 py-12 text-center text-wb-13 text-wb-muted"
                                        >
                                            {t("common.loading")}
                                        </td>
                                    </tr>
                                ) : (data?.rows ?? []).length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-3 py-12 text-center text-wb-13 text-wb-muted"
                                        >
                                            {t("report.daily_financial.tx_dialog.empty")}
                                        </td>
                                    </tr>
                                ) : (
                                    (data?.rows ?? []).map((r, i) => {
                                        const isDebit = r.inOutDiv === "2";
                                        const isCredit = r.inOutDiv === "1";
                                        return (
                                            <tr
                                                key={`${r.transactionTime}-${i}`}
                                                className="border-t border-wb-border-sidebar"
                                            >
                                                <td className="px-3 py-2.5 text-wb-13 font-medium text-wb-ink">
                                                    {formatTime(r.transactionTime)}
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-wb-13 font-medium text-wb-ink">
                                                    {isDebit
                                                        ? formatAmount(r.amount, account.currency, false)
                                                        : ""}
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-wb-13 font-medium text-wb-ink">
                                                    {isCredit
                                                        ? formatAmount(r.amount, account.currency, false)
                                                        : ""}
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-wb-13 font-medium text-wb-ink">
                                                    {formatAmount(r.balanceAfter, account.currency, false)}
                                                </td>
                                                <td className="px-3 py-2.5 text-wb-13 font-medium text-wb-ink">
                                                    {r.remark || ""}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer — totals summary + page-size dropdown */}
                    <div className="flex items-center justify-between border-t border-wb-border-sidebar px-6 py-3">
                        <div className="flex items-center gap-2">
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="h-7 cursor-pointer rounded-md border border-wb-border-sidebar bg-white px-2 text-wb-13 font-medium text-wb-ink"
                            >
                                {PAGE_SIZE_OPTIONS.map((n) => (
                                    <option key={n} value={n}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                            {pageCount > 1 && (
                                <div className="flex items-center gap-1 text-wb-13 font-medium text-wb-muted">
                                    <button
                                        type="button"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        className="rounded-md px-2 py-1 hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        ‹
                                    </button>
                                    <span>
                                        {page} / {pageCount}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={page >= pageCount}
                                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                                        className="rounded-md px-2 py-1 hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        ›
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="text-wb-13 font-medium text-wb-ink">
                            {t("report.daily_financial.tx_dialog.summary", {
                                count: String(totalCount),
                                debit: formatAmount(data?.totalOut ?? "0", account.currency, true),
                                credit: formatAmount(data?.totalIn ?? "0", account.currency, true),
                                balance: formatAmount(data?.closingBalance ?? "0", account.currency, true),
                            })}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
