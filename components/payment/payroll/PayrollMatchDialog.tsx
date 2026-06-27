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
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import SearchInput from "@/components/shared/SearchInput";
import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import {
    fetchPayrollMatchCandidates,
    matchPayrollBatch,
} from "@/lib/api/payrollPayment";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ApiPayrollMatchCandidateRow } from "@/lib/types/api";

type PayrollMatchSummary = {
    /** Transfer date — `dd-MMM-yyyy` (line 1). */
    transferDate: string;
    /** Transfer time — `HH:mm:ss` (line 2, muted). */
    transferTime: string;
    /** Withdrawal bank display name (line 1). */
    withdrawalBankName: string;
    /** Withdrawal account number (line 2, muted). */
    withdrawalAccountNo: string;
    /** Withdrawal amount, pre-formatted with currency symbol. */
    withdrawalAmount: string;
    /** Uploaded file name. */
    fileName: string;
};

type Props = {
    /** Batch id (`SCDUL_PYMN_NO`) being matched. */
    scdulPymnNo: string;
    /** Read-only batch summary rendered in the popup header section. */
    summary: PayrollMatchSummary;
    /** Batch currency — renders below each candidate amount (e.g. "VND"). */
    currency: string;
    onClose: () => void;
    /** Fires after a successful match so the caller refreshes the detail. */
    onMatched: () => void;
};

/**
 * Payroll banking-match popup — refactor port of legacy `comm_0197_001`
 * (batch path), styled to Figma 8410:13209. Header-level / batch-level:
 * one Payroll batch links to one bank transaction (1:1). Two sections:
 *   1. Read-only batch summary (Transaction Type / Transfer Date-Time /
 *      Withdrawal Bank+Account / Withdrawal Amount / File Name).
 *   2. Candidate bank-transaction grid (single-select radio) + keyword
 *      search + optional memo.
 *
 * The Match button is disabled until a candidate is selected; on success it
 * calls `onMatched()` (parent re-fetches), shows a success dialog, and closes.
 * Separate from the bank-side Smart Organizer popup (`comm_0196_001`).
 */
export default function PayrollMatchDialog({
    scdulPymnNo,
    summary,
    currency,
    onClose,
    onMatched,
}: Props) {
    const { t } = useTranslation();
    const dialog = useDialog();

    const [search, setSearch] = useState("");
    const [memo, setMemo] = useState("");
    const [candidates, setCandidates] = useState<ApiPayrollMatchCandidateRow[]>([]);
    // Start in the loading state so the first paint shows the spinner row, not
    // a one-frame "No Data Found" flash — keeps the open transition smooth.
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<ApiPayrollMatchCandidateRow | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Date range (ISO `YYYY-MM-DD`), defaulted to [today − 1 month, today] —
    // the same default window legacy `comm_0197_001` seeds. Legacy parity: the
    // picker is clickable (legacy uses jQuery datepickers) but the candidate
    // set is pinned server-side to the batch's exact PAY_TRAN_DT + total
    // amount, so the range is NON-filtering and is never sent to the API.
    const [startIso, setStartIso] = useState<string>(defaultStartIso);
    const [endIso, setEndIso] = useState<string>(defaultEndIso);

    // Load candidates on mount + whenever the keyword changes. Legacy pins
    // account + INOUT_DV='2' + LINK_MATCH_YN='N' + exact pay date + exact total
    // amount server-side; only the keyword is user-driven.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchPayrollMatchCandidates(scdulPymnNo, search.trim() || undefined)
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
    }, [scdulPymnNo, search]);

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
            await matchPayrollBatch(scdulPymnNo, {
                acct_seq_no:        selected.acct_seq_no,
                bank_trns_short_id: selected.bank_trns_short_id ?? "",
                bank_trns_full_id:  selected.bank_trns_full_id ?? "",
                memo:               memo.trim() || undefined,
            });
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("payment.payroll.match.match_success"),
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
            <DialogContent className="max-w-[1280px]" aria-describedby={undefined}>
                <DialogHeader className="border-b border-wb-ntrl-4 pb-4">
                    <DialogTitle>{t("payment.payroll.match.title")}</DialogTitle>
                </DialogHeader>

                <DialogBody className="flex flex-col gap-5">
                    {/* Section 1 — batch summary (read-only). Full-bleed grey band
                       flush under the header, mirroring Figma. */}
                    <section className="-mx-6 -mt-4 bg-wb-bg-sidebar px-8 py-5">
                        <div className="flex flex-wrap items-stretch gap-x-10 gap-y-4">
                            <SummaryField
                                label={t("payment.payroll.match.transaction_type")}
                                lines={[t("payment.payroll.match.type_payroll")]}
                            />
                            <SummaryField
                                label={t("payment.payroll.match.transfer_dt")}
                                lines={[summary.transferDate, summary.transferTime]}
                            />
                            <SummaryField
                                label={t("payment.detail.withdrawal_bank")}
                                lines={[summary.withdrawalBankName, summary.withdrawalAccountNo]}
                            />
                            <div className="w-px self-stretch bg-wb-ntrl-4" aria-hidden />
                            <SummaryField
                                label={t("payment.payroll.match.withdrawal_amount")}
                                lines={[summary.withdrawalAmount]}
                            />
                            <SummaryField
                                label={t("payment.payroll.match.file_name")}
                                lines={[summary.fileName]}
                            />
                        </div>
                    </section>

                    {/* Section 2 — candidate list */}
                    <h3 className="text-wb-15 font-semibold tracking-wb-tight text-wb-dark">
                        {t("payment.payroll.match.candidates")}
                    </h3>

                    {/* Filter row — interactive date range + keyword search,
                       matching Figma 8410:13313. Clicking a chip opens a
                       single-date popover; the calendar icon opens the
                       dual-month range popover. `portalled` renders the popups
                       into document.body so they escape the dialog's overflow
                       clip. Both the range and keyword re-query candidates. */}
                    <div className="flex flex-wrap items-center gap-4">
                        <InteractiveDateRangePicker
                            portalled
                            startIso={startIso}
                            endIso={endIso}
                            onChange={({ start, end }) => {
                                setStartIso(start);
                                setEndIso(end);
                            }}
                        />
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder={t("payment.payroll.match.search_placeholder")}
                        />
                    </div>

                    {/* Candidate table — sticky header, scrollable body. */}
                    <div className="custom-scrollbar h-[360px] overflow-auto rounded-md border border-wb-table-border">
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
                                        {t("payment.payroll.match.col.transaction_id")}
                                    </th>
                                    <th className="px-2.5 py-3 text-left text-wb-13 font-semibold text-wb-dark">
                                        {t("payment.payroll.match.col.transfer_dt")}
                                    </th>
                                    <th className="px-2.5 py-3 text-right text-wb-13 font-semibold text-wb-dark">
                                        {t("payment.payroll.match.col.transfer_amount")}
                                    </th>
                                    <th className="px-2.5 py-3 text-left text-wb-13 font-semibold text-wb-dark">
                                        {t("payment.payroll.match.col.remarks")}
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
                                            {t("payment.payroll.match.no_data")}
                                        </td>
                                    </tr>
                                ) : (
                                    candidates.map((c, idx) => {
                                        const sel = selected?.acct_seq_no === c.acct_seq_no;
                                        return (
                                            <tr
                                                // acct_seq_no is the candidate PK but the
                                                // mock/legacy data can repeat it across rows;
                                                // index keeps the key unique for render.
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
                                                        name="payrollMatchCandidate"
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
                                                            {formatAmount(c.trsc_amt ?? "0", currency, false)}
                                                        </span>
                                                        <span className="text-wb-13 text-wb-ntrl-6">
                                                            {currency}
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
                        placeholder={t("payment.payroll.match.memo_placeholder")}
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
                        {t("payment.payroll.match.match")}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SummaryField({ label, lines }: { label: string; lines: string[] }) {
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-wb-13 font-normal text-wb-ntrl-6">{label}</span>
            <div className="flex flex-col">
                {lines.map((line, idx) => (
                    <span
                        key={idx}
                        className={cn(
                            idx === 0
                                ? "text-wb-14 font-medium text-wb-ink"
                                : "text-wb-13 font-normal text-wb-ntrl-6",
                        )}
                    >
                        {line || (idx === 0 ? "—" : "")}
                    </span>
                ))}
            </div>
        </div>
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

/** `Date` → ISO `YYYY-MM-DD` (local). */
function toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Default range end = today; start = today − 1 month (legacy default window). */
function defaultEndIso(): string {
    return toIso(new Date());
}
function defaultStartIso(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return toIso(d);
}

// The date-range picker chip now formats locale-aware via the shared
// <DateField> default (formatIsoDateByLanguage) — the old English-only
// `formatChipDate` was removed so the chip follows EN/KO/VI like every
// other Payment date picker.
