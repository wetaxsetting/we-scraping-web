"use client";

import { useEffect, useMemo, useState } from "react";

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
import Tooltip from "@/components/shared/Tooltip";
import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import {
    ApiCallError,
    createMatch,
    fetchMatchCandidates,
    undoMatch,
} from "@/lib/api/banking";
import { useDialog } from "@/components/shared/dialog";
import { mapMatchCandidateRow } from "@/lib/api/mappers";
import { formatAmount } from "@/lib/currency";
import { useTranslation, type Locale } from "@/lib/i18n";
import { formatDateLang, formatUtcDtmByLanguage } from "@/lib/datetime";
import { cn } from "@/lib/utils";

import type { MatchCandidate, TransactionRow } from "./types";

type Props = {
    /** Backend `acct_seq_no` for the URL path (page-level value). */
    accountAcctSeqNo: string;
    /** The bank transaction the user is matching from. */
    row: TransactionRow;
    /** Currency code from the page account — formats summary amounts. */
    currency: string;
    /** Account label shown in the Withdrawal Bank summary field
     *  (line 1 — e.g. {@code "Woori VN - Current (VND)"}). */
    bankLabel?: string;
    /** Account number shown in the Withdrawal Bank summary field
     *  (line 2 — e.g. {@code "100001018048"}). */
    bankAccountNo?: string;
    onClose: () => void;
    /** Fires after a successful match or undo so the caller can refresh
     *  the transaction list. */
    onMatched: () => void;
};

/**
 * Smart Organizer popup — refactor port of legacy `comm_0196_001`.
 * Two-section layout:
 *   1. Header summary  — read-only view of the bank transaction.
 *   2. Candidate table — domestic scheduled payments the user can pick.
 *
 * Single-select via radio button per row. The Match button is disabled
 * until a row is selected and an optional memo can be attached. On
 * successful match, calls `onMatched` (parent re-fetches), shows a
 * success dialog, and closes.
 *
 * If the row is already matched (`row.linkMatchYn === 'Y'`), the popup
 * opens in "matched" mode — no candidate table, instead an Undo CTA.
 */
export default function SmartOrganizerDialog({
    accountAcctSeqNo,
    row,
    currency,
    bankLabel,
    bankAccountNo,
    onClose,
    onMatched,
}: Props) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();

    const isMatched = row.linkMatchYn === "Y";

    const initialRange = useMemo(defaultDateRange, []);
    const [startDate, setStartDate] = useState(initialRange.start);
    const [endDate, setEndDate] = useState(initialRange.end);
    const [search, setSearch] = useState("");
    const [memo, setMemo] = useState("");
    // Legacy `comm_0196_001_v017` Matching remarks toggle. Default ON.
    // Today this is UI-only — when the popup gains a "search by remark
    // substring" backend filter the value will travel as a query param.
    const [matchingRemarks, setMatchingRemarks] = useState(true);
    const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedPayTrnsId, setSelectedPayTrnsId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Fetch candidates on mount + whenever filters change (debounced
    // implicitly by the user driving the inputs — no rapid-fire needed
    // since the table is bounded by tenant volume).
    useEffect(() => {
        if (isMatched) return;
        let cancelled = false;
        setLoading(true);
        fetchMatchCandidates(accountAcctSeqNo, row.trnsSeqNo ?? "", {
            from: toWireDate(startDate),
            to: toWireDate(endDate),
            keyword: search.trim() || undefined,
            // Legacy MATCH_RMRK_YN — checkbox ON is the default (omit); OFF sends
            // 'N' so the backend skips the effective-remark containment filter.
            matchRmrkYn: matchingRemarks ? undefined : "N",
        })
            .then((res) => {
                if (!cancelled) {
                    setCandidates((res.rows ?? []).map(mapMatchCandidateRow));
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (cancelled) return;
                setLoading(false);
                showErrorDialog(err);
            });
        return () => { cancelled = true; };
    }, [accountAcctSeqNo, row.trnsSeqNo, startDate, endDate, search, matchingRemarks, isMatched]);

    const showErrorDialog = (err: unknown) => {
        const e = err instanceof ApiCallError ? err : null;
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: e?.message ?? (err instanceof Error ? err.message : String(err)),
            errorCode: e?.code,
        });
    };

    const handleMatch = async () => {
        if (!selectedPayTrnsId || !row.trnsSeqNo) return;
        // P4 — send the selected candidate's own pay_type_cd ('S' domestic/payroll
        // or 'O' overseas) so the backend routes to the correct write path.
        const selected = candidates.find((c) => c.payTrnsId === selectedPayTrnsId);
        setSubmitting(true);
        try {
            await createMatch(accountAcctSeqNo, row.trnsSeqNo, {
                pay_trns_id: selectedPayTrnsId,
                pay_type_cd: selected?.payTypeCd ?? "S",
                memo: memo.trim() || undefined,
            });
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("smart_organizer.match_success"),
            });
            onMatched();
            onClose();
        } catch (err) {
            showErrorDialog(err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUndo = async () => {
        if (!row.trnsSeqNo) return;
        setSubmitting(true);
        try {
            await undoMatch(accountAcctSeqNo, row.trnsSeqNo);
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("smart_organizer.undo_success"),
            });
            onMatched();
            onClose();
        } catch (err) {
            showErrorDialog(err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent
                className={cn(
                    // Width is the dialog's own `max-w-[1184px]` (reverted from the
                    // wider Settings card). Candidate list keeps the fixed Settings
                    // height (`--w-wb-settings-card-h`) so — with `DialogContent`'s
                    // built-in `flex flex-col overflow-hidden max-h-[calc(100vh-32px)]`
                    // — the header/summary/filter/memo/footer stay put and only the
                    // table body scrolls (no resize on search / matching-remarks /
                    // loading). Matched mode is a compact confirmation, content-sized.
                    "max-w-[1184px]",
                    !isMatched && "h-[var(--w-wb-settings-card-h)]",
                )}
                aria-describedby={undefined}
            >
                <DialogHeader>
                    <DialogTitle>{t("smart_organizer.title")}</DialogTitle>
                </DialogHeader>

                <DialogBody className="flex min-h-0 flex-1 flex-col gap-5">
                    {/* Section 1 — bank transaction summary (read-only).
                       Legacy `comm_0196_001` uses a 5-field single-row
                       layout with a soft-grey card background. */}
                    <section className="shrink-0 rounded-md bg-wb-bg-sidebar px-5 py-4">
                        {/* Legacy comm_0196_001 packs the five summary fields to
                           their content width (Remarks takes the remainder), not
                           five equal fifths — `grid-cols-5` spread each short
                           field across 1/5 of the dialog, producing the large
                           blank gaps. Content-sized columns + a fixed gap match
                           the legacy spacing without touching field order/style. */}
                        <div className="grid grid-cols-[auto_auto_auto_auto_minmax(0,1fr)] gap-x-10">
                            <SummaryField
                                label={t("smart_organizer.transaction_id")}
                                value={row.transactionId ?? row.trnsSeqNo ?? "—"}
                            />
                            <SummaryField
                                label={t("smart_organizer.transfer_dt")}
                                multi
                                lines={[row.dateRaw ? formatDateLang(row.dateRaw, locale) : row.date, row.time]}
                            />
                            <SummaryField
                                label={t("smart_organizer.withdrawal_bank")}
                                multi
                                lines={[
                                    bankLabel ?? "",
                                    bankAccountNo ?? "",
                                ]}
                            />
                            <SummaryField
                                label={t("smart_organizer.withdrawal_amount")}
                                value={`${formatAmount(row.withdraw ?? row.deposit, currency, false)} ${currency}`}
                            />
                            <SummaryField
                                label={t("txn_history.col.remarks")}
                                value={row.remarks || "—"}
                            />
                        </div>
                    </section>

                    {/* Section 2 — matched mode OR candidate list */}
                    {isMatched ? (
                        <section className="rounded-md border border-wb-table-border p-4 text-wb-13 text-wb-ink">
                            {t("smart_organizer.already_matched")}
                        </section>
                    ) : (
                        <>
                            {/* Section heading — legacy `comm_0196_001_v007` */}
                            <h3 className="shrink-0 text-wb-15 font-semibold tracking-wb-tight text-wb-dark">
                                {t("smart_organizer.payment_transactions")}
                            </h3>

                            {/* Filter row */}
                            <div className="flex shrink-0 flex-wrap items-center gap-3">
                                <InteractiveDateRangePicker
                                    startIso={startDate}
                                    endIso={endDate}
                                    onChange={(r) => {
                                        setStartDate(r.start);
                                        setEndDate(r.end);
                                    }}
                                />
                                <SearchInput
                                    value={search}
                                    onChange={setSearch}
                                    placeholder={t("smart_organizer.search_placeholder")}
                                />
                                {/* Matching remarks checkbox + info tooltip
                                   (Figma 9222:18373 / legacy `comm_0196_001_v017`).
                                   Toggling re-runs the candidate fetch via the
                                   `matchingRemarks` state — data only, layout fixed. */}
                                <div className="ml-auto flex items-center gap-1.5">
                                    <label className="flex cursor-pointer items-center gap-1.5 text-wb-13 font-medium text-wb-ink">
                                        <input
                                            type="checkbox"
                                            checked={matchingRemarks}
                                            onChange={(e) => setMatchingRemarks(e.target.checked)}
                                            className="size-4 cursor-pointer accent-brand"
                                        />
                                        {t("smart_organizer.matching_remarks")}
                                    </label>
                                    {/* Filled WeCMS "information" glyph (Figma
                                       9223:18750) on the shared `<Tooltip>` primitive.
                                       Tooltip behaviour + text unchanged. */}
                                    <Tooltip
                                        content={t("smart_organizer.matching_remarks_hint")}
                                        placement="top"
                                        className="inline-flex"
                                    >
                                        <img
                                            src="/assets/common/ico-info.svg"
                                            alt=""
                                            aria-hidden
                                            className="size-4 shrink-0 cursor-help"
                                        />
                                    </Tooltip>
                                </div>
                            </div>

                            {/* Candidate table — FLEXES to fill the remaining space
                               in the fixed-height (Settings-card) modal (`min-h-0
                               flex-1`), so the pane is a constant size across
                               loading / empty / few-rows / many-rows states and
                               scrolls internally when rows exceed it. The summary,
                               filter, and memo siblings are `shrink-0`, so only this
                               table body absorbs the slack — the dialog never resizes
                               on search / matching-remarks / loading. */}
                            <div className="custom-scrollbar relative min-h-0 flex-1 overflow-auto rounded-md border border-wb-table-border">
                                <table className="w-full border-collapse">
                                    <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                                        <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                                            <th className="w-10 px-2.5 py-2 text-left" />
                                            <th className="px-2.5 py-2 text-left text-wb-13 font-semibold text-wb-dark">
                                                {t("smart_organizer.col.transfer_dt")}
                                            </th>
                                            <th className="px-2.5 py-2 text-left text-wb-13 font-semibold text-wb-dark">
                                                {t("smart_organizer.col.deposit_bank")}
                                            </th>
                                            <th className="px-2.5 py-2 text-right text-wb-13 font-semibold text-wb-dark">
                                                {t("smart_organizer.col.transfer_amount")}
                                            </th>
                                            <th className="px-2.5 py-2 text-left text-wb-13 font-semibold text-wb-dark">
                                                {t("smart_organizer.col.recipient")}
                                            </th>
                                            <th className="px-2.5 py-2 text-left text-wb-13 font-semibold text-wb-dark">
                                                {t("smart_organizer.col.remarks")}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!loading && candidates.map((c) => {
                                                const sel = c.payTrnsId === selectedPayTrnsId;
                                                // Two-line cells per Figma 9222:18373 — date/time,
                                                // bank(+acct), and amount(+ccy) split across two rows.
                                                const dtm = trnfDtmParts(c.trnfDtm, c.trnfDt, locale);
                                                const bankLabel = [c.bnfcBankCd, c.bnfcBankNm]
                                                    .filter(Boolean).join(" - ");
                                                return (
                                                    <tr
                                                        key={c.payTrnsId}
                                                        onClick={() => setSelectedPayTrnsId(c.payTrnsId)}
                                                        className={cn(
                                                            "h-[var(--h-wb-table-row)] cursor-pointer border-b border-wb-table-border hover:bg-black/[0.02]",
                                                            sel && "bg-[#EBF5FF]",
                                                        )}
                                                    >
                                                        <td className="px-2.5 py-2 align-middle">
                                                            <input
                                                                type="radio"
                                                                name="smartOrganizerCandidate"
                                                                checked={sel}
                                                                onChange={() => setSelectedPayTrnsId(c.payTrnsId)}
                                                                className="size-4 cursor-pointer accent-brand"
                                                            />
                                                        </td>
                                                        <td className="px-2.5 py-2 align-middle">
                                                            <div className="flex flex-col">
                                                                <span className="text-wb-13 text-wb-ink">{dtm.date || "—"}</span>
                                                                {dtm.time && (
                                                                    <span className="text-wb-13 text-wb-muted">{dtm.time}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-2.5 py-2 align-middle">
                                                            <div className="flex flex-col">
                                                                <span className="flex items-center gap-1 text-wb-13 text-wb-ink">
                                                                    <span>{bankLabel || "—"}</span>
                                                                    {c.trnfCcyCd && (
                                                                        <>
                                                                            <img
                                                                                src="/assets/table/ico-building.svg"
                                                                                alt=""
                                                                                aria-hidden
                                                                                className="size-3.5 shrink-0 opacity-50"
                                                                            />
                                                                            <span className="text-wb-muted">{c.trnfCcyCd}</span>
                                                                        </>
                                                                    )}
                                                                </span>
                                                                {c.bnfcAcctNo && (
                                                                    <span className="text-wb-13 text-wb-muted">{c.bnfcAcctNo}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-2.5 py-2 text-right align-middle">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-wb-13 font-medium text-wb-ink">
                                                                    {formatAmount(c.tranAmt, c.trnfCcyCd, false)}
                                                                </span>
                                                                {c.trnfCcyCd && (
                                                                    <span className="text-wb-13 text-wb-muted">{c.trnfCcyCd}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-2.5 py-2 align-middle text-wb-13 text-wb-ink">
                                                            {c.rcptNm || "—"}
                                                        </td>
                                                        <td className="px-2.5 py-2 align-middle">
                                                            <EllipsisTooltip
                                                                text={c.tranUsag ?? c.titl ?? ""}
                                                                lines={2}
                                                                className="text-wb-13 text-wb-muted"
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                                {/* Loading / empty state — centered both axes in the
                                   body region (below the sticky 40px header) via an
                                   absolute overlay, so "No Data Found." sits in the
                                   true middle of the fixed-height pane regardless of
                                   header height / row count. */}
                                {(loading || candidates.length === 0) && (
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[var(--h-wb-table-head)] flex items-center justify-center text-wb-13 text-wb-muted">
                                        {loading ? t("common.loading") : t("smart_organizer.no_data_found")}
                                    </div>
                                )}
                            </div>

                            {/* Memo */}
                            <textarea
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                                placeholder={t("smart_organizer.memo_placeholder")}
                                rows={3}
                                className="w-full shrink-0 rounded-md border border-wb-ntrl-4 bg-white px-3 py-2 text-wb-13 text-wb-ink outline-none focus:border-brand"
                            />
                        </>
                    )}
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
                    {isMatched ? (
                        <button
                            type="button"
                            onClick={handleUndo}
                            disabled={submitting}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {t("smart_organizer.unmatch")}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleMatch}
                            disabled={submitting || !selectedPayTrnsId}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-wb-ntrl-4"
                        >
                            {t("smart_organizer.match")}
                        </button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type SummaryFieldProps =
    | { label: string; value: string; multi?: false; lines?: never }
    | { label: string; multi: true; lines: string[]; value?: never };

function SummaryField(props: SummaryFieldProps) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-wb-12 font-medium text-wb-ntrl-6">{props.label}</span>
            {props.multi ? (
                <div className="flex flex-col">
                    {props.lines.map((line, idx) => (
                        <span key={idx} className="text-wb-13 font-medium text-wb-ink">
                            {line || (idx === 0 ? "—" : "")}
                        </span>
                    ))}
                </div>
            ) : (
                <span className="text-wb-13 font-medium text-wb-ink">{props.value}</span>
            )}
        </div>
    );
}

function defaultDateRange(): { start: string; end: string } {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    return { start: toIso(start), end: toIso(today) };
}

function toIso(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function toWireDate(iso: string): string {
    return iso.replaceAll("-", "");
}

/** Candidate Transfer Date/Time, split into `{ date, time }` for the two-line
 *  cell (Figma 9222:18373). `TRNF_DTM` is the dispatch timestamp written
 *  `OffsetDateTime.now(UTC)` (a UTC instant) → convert UTC→Vietnam-local and
 *  format the date per active locale + `HH:mm:ss`. `TRNF_DT` is a zone-free
 *  date-only fallback → format per locale, never shifted (no time line). */
function trnfDtmParts(
    dtm: string | null,
    dt: string | null,
    locale: Locale,
): { date: string; time: string } {
    if (dtm && dtm.length >= 12) {
        // Pad a seconds-less `yyyyMMddHHmm` to 14 chars so the UTC helper parses it.
        const full = dtm.length >= 14 ? dtm.slice(0, 14) : `${dtm.slice(0, 12)}00`;
        const { date, time } = formatUtcDtmByLanguage(full, locale);
        if (date) return { date, time: time ?? "" };
    }
    if (dt && dt.length >= 8) {
        return { date: formatDateLang(dt, locale), time: "" };
    }
    return { date: dt ?? "", time: "" };
}
