"use client";

import { useEffect, useState } from "react";

import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import SearchInput from "@/components/shared/SearchInput";
import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
    ApiPaymentLineMatchCandidateListResponse,
    ApiPaymentLineMatchCandidateRow,
    ApiPaymentLineMatchRequest,
    ApiPaymentLineMatchResultResponse,
} from "@/lib/types/api";

type Props = {
    /** Batch id (`SCDUL_PYMN_NO`) of the line being matched. */
    scdulPymnNo: string;
    /** Line id (`SCDUL_PYMN_DETL_NO`) being matched. */
    scdulPymnDetlNo: string;
    /** Currency rendered below each candidate amount (e.g. "VND"). */
    currency: string;
    /** Per-module candidate fetcher (Vendor / Expense client fn). */
    fetchCandidates: (
        scdulPymnNo: string,
        scdulPymnDetlNo: string,
        srchWd?: string,
    ) => Promise<ApiPaymentLineMatchCandidateListResponse>;
    /** Per-module match submitter (Vendor / Expense client fn). */
    submitMatch: (
        scdulPymnNo: string,
        scdulPymnDetlNo: string,
        request: ApiPaymentLineMatchRequest,
    ) => Promise<ApiPaymentLineMatchResultResponse>;
    onClose: () => void;
    /** Fires after a successful match so the caller refreshes the detail. */
    onMatched: () => void;
};

/**
 * Per-line banking-match popup shared by Vendor + Expense — refactor port of
 * legacy `comm_0197_001` (domestic-detail path). Per detail line, 1:1: one
 * payment line links to one bank transaction. Single-select candidate grid +
 * keyword search + optional memo; the Match button is disabled until a
 * candidate is selected. On success it calls `onMatched()` (parent re-fetches)
 * and closes.
 *
 * Distinct from the header-level `PayrollMatchDialog` and the bank-side
 * `SmartOrganizerDialog` (opposite direction). Candidate filtering (withdrawal
 * account + exact date + exact amount + TRAN_USAG remark) happens server-side;
 * only the keyword is user-driven here.
 */
export default function VendorExpenseMatchDialog({
    scdulPymnNo,
    scdulPymnDetlNo,
    currency,
    fetchCandidates,
    submitMatch,
    onClose,
    onMatched,
}: Props) {
    const { t } = useTranslation();
    const dialog = useDialog();

    const [search, setSearch] = useState("");
    const [memo, setMemo] = useState("");
    const [candidates, setCandidates] = useState<ApiPaymentLineMatchCandidateRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<ApiPaymentLineMatchCandidateRow | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Load candidates on mount + whenever the keyword changes. The legacy
    // domestic-detail path filters on exact account/date/amount + TRAN_USAG
    // server-side; only the keyword is user-driven.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchCandidates(scdulPymnNo, scdulPymnDetlNo, search.trim() || undefined)
            .then((res) => {
                if (cancelled) return;
                setCandidates(res.candidates ?? []);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                setLoading(false);
                showError(err);
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scdulPymnNo, scdulPymnDetlNo, search]);

    const showError = (err: unknown) => {
        const e = err instanceof ApiCallError ? err : null;
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: e?.message ?? (err instanceof Error ? err.message : String(err)),
            errorCode: e?.code,
        });
    };

    const handleMatch = async () => {
        if (!selected) return;
        setSubmitting(true);
        try {
            await submitMatch(scdulPymnNo, scdulPymnDetlNo, {
                acct_seq_no:        selected.acct_seq_no,
                bank_trns_short_id: selected.bank_trns_short_id ?? "",
                bank_trns_full_id:  selected.bank_trns_full_id ?? "",
                memo:               memo.trim() || undefined,
            });
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("payment.match.match_success"),
            });
            onMatched();
            onClose();
        } catch (err) {
            showError(err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-[1080px]" aria-describedby={undefined}>
                <DialogHeader className="border-b border-wb-ntrl-4 pb-4">
                    <DialogTitle>{t("payment.match.title")}</DialogTitle>
                </DialogHeader>

                <DialogBody className="flex flex-col gap-5">
                    {/* Keyword search */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-wb-15 font-semibold tracking-wb-tight text-wb-dark">
                            {t("payment.match.candidates")}
                        </h3>
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder={t("payment.match.search_placeholder")}
                        />
                    </div>

                    {/* Candidate table — sticky header, scrollable body. */}
                    <div className="custom-scrollbar max-h-[360px] overflow-auto rounded-md border border-wb-table-border">
                        <table className="w-full table-fixed border-collapse">
                            <colgroup>
                                <col className="w-14" />
                                <col className="w-[200px]" />
                                <col className="w-[180px]" />
                                <col className="w-[170px]" />
                                <col />
                            </colgroup>
                            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                                <tr className="border-b border-wb-table-border">
                                    <th className="px-2.5 py-3 text-left" />
                                    <th className="px-2.5 py-3 text-left text-wb-13 font-semibold text-wb-dark">
                                        {t("payment.match.col.transaction_id")}
                                    </th>
                                    <th className="px-2.5 py-3 text-left text-wb-13 font-semibold text-wb-dark">
                                        {t("payment.match.col.transfer_dt")}
                                    </th>
                                    <th className="px-2.5 py-3 text-right text-wb-13 font-semibold text-wb-dark">
                                        {t("payment.match.col.transfer_amount")}
                                    </th>
                                    <th className="px-2.5 py-3 text-left text-wb-13 font-semibold text-wb-dark">
                                        {t("payment.match.col.remarks")}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-2.5 py-8 text-center text-wb-13 text-wb-muted">
                                            {t("common.loading")}
                                        </td>
                                    </tr>
                                ) : candidates.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="h-[200px] px-2.5 py-8 text-center align-middle text-wb-13 text-wb-muted">
                                            {t("payment.match.no_data")}
                                        </td>
                                    </tr>
                                ) : (
                                    candidates.map((c, idx) => {
                                        const sel = selected?.acct_seq_no === c.acct_seq_no;
                                        return (
                                            <tr
                                                key={`${c.acct_seq_no}-${idx}`}
                                                onClick={() => setSelected(c)}
                                                className={cn(
                                                    "cursor-pointer border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]",
                                                    sel && "bg-[#EBF5FF]",
                                                )}
                                            >
                                                <td className="px-2.5 py-4 align-top">
                                                    <input
                                                        type="radio"
                                                        name="paymentLineMatchCandidate"
                                                        checked={sel}
                                                        onChange={() => setSelected(c)}
                                                        className="mt-0.5 size-4 cursor-pointer accent-brand"
                                                    />
                                                </td>
                                                <td className="px-2.5 py-4 align-top text-wb-13 font-medium text-wb-ink">
                                                    {c.bank_trns_short_id || "—"}
                                                </td>
                                                <td className="px-2.5 py-4 align-top">
                                                    <div className="flex flex-col">
                                                        <span className="text-wb-13 text-wb-ink">
                                                            {formatTrscDate(c.trsc_dt)}
                                                        </span>
                                                        <span className="text-wb-13 text-wb-ntrl-6">
                                                            {formatTrscTime(c.trsc_tm)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-2.5 py-4 text-right align-top">
                                                    <div className="flex flex-col">
                                                        <span className="text-wb-13 font-medium text-wb-ink">
                                                            {formatNumber(c.trsc_amt ?? "0")}
                                                        </span>
                                                        <span className="text-wb-13 text-wb-ntrl-6">
                                                            {c.ccy_cd || currency}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-2.5 py-4 align-top text-wb-13 text-wb-ink">
                                                    <span className="block whitespace-normal break-words">
                                                        {c.rmrk || c.rmrk2 || ""}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Memo (legacy comm_0197_001 #comm_0197_001_memo) */}
                    <textarea
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        placeholder={t("payment.match.memo_placeholder")}
                        rows={3}
                        maxLength={500}
                        className="min-h-[80px] w-full resize-y rounded-md border border-wb-ntrl-4 bg-white px-3 py-2 text-wb-13 text-wb-ink outline-none placeholder:text-wb-ntrl-6 focus:border-brand"
                    />
                </DialogBody>

                <DialogFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t("dialog.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={handleMatch}
                        disabled={submitting || !selected}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-wb-ntrl-4 disabled:text-white"
                    >
                        {t("payment.match.match")}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** `yyyyMMdd` → `dd-MMM-yyyy` (e.g. `05-Jan-2026`). */
function formatTrscDate(dt: string | null): string {
    if (!dt || dt.length !== 8) return dt ?? "";
    const monthIdx = Number(dt.slice(4, 6)) - 1;
    const month = monthIdx >= 0 && monthIdx < MONTHS.length ? MONTHS[monthIdx] : dt.slice(4, 6);
    return `${dt.slice(6, 8)}-${month}-${dt.slice(0, 4)}`;
}

/** `HHmmss` → `HH:mm:ss` (falls back to `HH:mm`). */
function formatTrscTime(tm: string | null): string {
    if (!tm) return "";
    if (tm.length >= 6) return `${tm.slice(0, 2)}:${tm.slice(2, 4)}:${tm.slice(4, 6)}`;
    if (tm.length >= 4) return `${tm.slice(0, 2)}:${tm.slice(2, 4)}`;
    return tm;
}
