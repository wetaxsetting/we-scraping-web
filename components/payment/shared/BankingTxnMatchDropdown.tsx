"use client";

import { Info } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Checkbox } from "@/components/ui/checkbox";
import Tooltip from "@/components/shared/Tooltip";
import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
    ApiPaymentLineMatchCandidateListResponse,
    ApiPaymentLineMatchCandidateRow,
    ApiPaymentLineMatchRequest,
    ApiPaymentLineMatchResultResponse,
} from "@/lib/types/api";

// Compact fixed width: wide enough for the header row ("Suggested N Bank
// Transaction" + checkbox + "Matching remarks" + info — ~370-400px across
// locales, so it never clips inside the panel's `overflow-hidden`), yet narrow
// enough to stay under the Banking-Transaction-ID column rather than sprawling.
const PANEL_WIDTH = 420;
const MAX_LIST_HEIGHT = 320;

type Props = {
    /** Batch id (`SCDUL_PYMN_NO` / `OVRS_PYMN_NO`) of the line being matched. */
    scdulPymnNo: string;
    /** Line id (`SCDUL_PYMN_DETL_NO` / `OVRS_PYMN_DETL_NO`) being matched. */
    scdulPymnDetlNo: string;
    /** Currency rendered below each candidate amount (e.g. "VND"). */
    currency: string;
    /** Bounding rect of the revealed "Type or pick from list…" search field —
     *  the dropdown anchors left-aligned directly beneath it
     *  (legacy `ShowBankingTransactionDropdownInCell` / Figma 9304:18838). */
    anchorRect: DOMRect;
    /** Live keyword typed into the cell's search field. Filters the already-
     *  fetched candidates CLIENT-SIDE (legacy `input.btid` handler — bank-txn id
     *  / remark contains). Empty → show all. Never a server round-trip. */
    keyword?: string;
    /** Per-module candidate fetcher (Internal Transfer / Vendor / Expense / Overseas).
     *  `matchRmrkYn` mirrors legacy `MATCH_RMRK_YN` — 'Y' filters candidates by the
     *  payment-line remark, 'N' widens the list to unmatched remarks. */
    fetchCandidates: (
        scdulPymnNo: string,
        scdulPymnDetlNo: string,
        srchWd?: string,
        matchRmrkYn?: string,
    ) => Promise<ApiPaymentLineMatchCandidateListResponse>;
    /** Per-module match submitter. */
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
 * Per-line banking-match **inline dropdown** — refactor port of legacy
 * `ShowBankingTransactionDropdownInCell` (`add_osmc.js:9204-9335`, triggered by
 * `pymn_0010_002.ts` / `pymn_0002_002.ts` / `pymn_0004_002.ts` /
 * `pymn_0008_002.ts`). The legacy picker is NOT a modal — it is a compact
 * dropdown appended directly under the clicked Banking-Transaction-ID cell.
 *
 * This reproduces the legacy layout (Figma 9304:19155): a header bar showing
 * "Suggested {N} Bank Transaction" on the left and a "Matching remarks"
 * checkbox + info icon on the right, followed by a scrollable list of compact
 * candidate rows (id · Transfer Amount + date · remark). **Clicking a candidate
 * row matches immediately** (no confirm step, no memo input — legacy parity).
 * Outside-click / ESC closes; only one is open at a time (the page holds a
 * single anchor+target).
 *
 * The **Matching remarks** checkbox (checked by default) re-fetches candidates
 * with `match_rmrk_yn='Y'|'N'` — it ONLY reloads the suggested list, it never
 * changes the popup layout (legacy `change.btrmrk` → `loadTransactions`).
 *
 * Backend-agnostic: reuses the same injected `fetchCandidates` / `submitMatch`
 * client fns and the same `ApiPaymentLineMatch*` DTOs across all four domestic
 * + overseas modules. UI-only — no API / matching-logic change.
 */
export default function BankingTxnMatchDropdown({
    scdulPymnNo,
    scdulPymnDetlNo,
    currency,
    anchorRect,
    keyword,
    fetchCandidates,
    submitMatch,
    onClose,
    onMatched,
}: Props) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const panelRef = useRef<HTMLDivElement>(null);

    // Matching-remarks toggle — legacy checkbox defaults to checked ('Y').
    const [matchRmrk, setMatchRmrk] = useState(true);
    const [candidates, setCandidates] = useState<ApiPaymentLineMatchCandidateRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Self-anchor to the REVEALED search field (the single `[data-match-field]`
    // in the DOM — only one row's match is open at a time). Measuring the field
    // here (rather than the cell writing its rect up through page state) removes
    // a setState-from-layout-effect re-anchor cycle, and lets the panel track
    // the field on scroll / resize. Falls back to the click anchor until the
    // field is measured (same paint, so no flash).
    const [measuredRect, setMeasuredRect] = useState<DOMRect | null>(null);
    useLayoutEffect(() => {
        const measure = () => {
            const el = document.querySelector("[data-match-field]");
            if (el instanceof HTMLElement) setMeasuredRect(el.getBoundingClientRect());
        };
        measure();
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => {
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, []);

    // Anchor beneath the input field. PREFER the panel's LEFT edge on the input's
    // left edge (legacy Bootstrap `dropdown-menu-start`). When a left-aligned
    // panel would overflow the viewport's right edge (the column is far right),
    // fall back to RIGHT-aligning the panel to the input's RIGHT edge — so the
    // panel sits under the Banking-Transaction-ID column and extends left, rather
    // than stretching to the viewport edge. A final clamp keeps it on-screen.
    const rect = measuredRect ?? anchorRect;
    const position = useMemo(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = Math.min(PANEL_WIDTH, vw - 16);
        let left = rect.left;                        // preferred: left edge under input left
        if (left + width > vw - 8) left = rect.right - width; // cramped: right edge under input right
        left = Math.max(8, Math.min(left, vw - width - 8));
        const top = rect.bottom + 4;
        const maxHeight = Math.max(160, Math.min(MAX_LIST_HEIGHT + 60, vh - top - 8));
        return { left, top, width, maxHeight };
    }, [rect]);

    // Load candidates on mount + whenever the Matching-remarks toggle changes.
    // Server-side filtering (account + exact date + exact amount + remark) is
    // unchanged; only the `match_rmrk_yn` flag is user-driven. Toggling the
    // checkbox reloads the list WITHOUT re-rendering the popup chrome.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchCandidates(scdulPymnNo, scdulPymnDetlNo, undefined, matchRmrk ? "Y" : "N")
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
    }, [scdulPymnNo, scdulPymnDetlNo, matchRmrk]);

    // Client-side keyword filter over the fetched candidates — legacy
    // `input.btid` handler (bank-txn id / remark / remark2 contains). No API
    // call; the count label tracks the filtered length (legacy parity).
    const shown = useMemo(() => {
        const kw = (keyword ?? "").trim().toLowerCase();
        if (!kw) return candidates;
        return candidates.filter((c) =>
            (c.bank_trns_short_id ?? "").toLowerCase().includes(kw) ||
            (c.rmrk ?? "").toLowerCase().includes(kw) ||
            (c.rmrk2 ?? "").toLowerCase().includes(kw),
        );
    }, [candidates, keyword]);

    // Outside-click + ESC close (only one dropdown open at a time). Clicks inside
    // the anchoring cell field (`[data-match-wrap]` — the revealed search input +
    // Match button) are NOT outside: typing / clearing keeps the popup open.
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                panelRef.current &&
                !panelRef.current.contains(target) &&
                !(target instanceof Element && target.closest("[data-match-wrap]"))
            ) {
                onClose();
            }
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("mousedown", onDown, true);
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("mousedown", onDown, true);
            document.removeEventListener("keydown", onKey, true);
        };
    }, [onClose]);

    const showError = (err: unknown) => {
        const e = err instanceof ApiCallError ? err : null;
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: e?.message ?? (err instanceof Error ? err.message : String(err)),
            errorCode: e?.code,
        });
    };

    // Legacy parity: clicking a candidate row matches immediately (no confirm,
    // no memo input in the picker).
    const handleSelect = async (c: ApiPaymentLineMatchCandidateRow) => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await submitMatch(scdulPymnNo, scdulPymnDetlNo, {
                acct_seq_no:        c.acct_seq_no,
                bank_trns_short_id: c.bank_trns_short_id ?? "",
                bank_trns_full_id:  c.bank_trns_full_id ?? "",
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

    return createPortal(
        <div
            ref={panelRef}
            role="dialog"
            className="fixed z-90 flex flex-col overflow-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
            style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }}
        >
            {/* Header bar — Figma 9304:19156.
                Left: "Suggested {N} Bank Transaction".
                Right: Matching remarks checkbox + info icon. */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-wb-ntrl-3 bg-wb-bg-card px-3 py-3">
                <span className="whitespace-nowrap text-wb-14 font-medium text-wb-ntrl-6">
                    {t("payment.match.suggested_count", { count: String(shown.length) })}
                </span>
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
                    <Checkbox
                        checked={matchRmrk}
                        onCheckedChange={(v) => setMatchRmrk(v === true)}
                    />
                    <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ntrl-8">
                        {t("payment.match.matching_remarks")}
                    </span>
                    <Tooltip content={t("payment.match.matching_remarks_hint")} className="inline-flex cursor-help">
                        <Info className="size-4 text-wb-ntrl-6" aria-hidden />
                    </Tooltip>
                </label>
            </div>

            {/* Candidate rows — Figma 9304:19162. Whole-row click = match. */}
            <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                    <div className="px-3 py-8 text-center text-wb-13 text-wb-muted">
                        {t("common.loading")}
                    </div>
                ) : shown.length === 0 ? (
                    <div className="px-3 py-8 text-center text-wb-13 text-wb-muted">
                        {t("payment.match.no_data")}
                    </div>
                ) : (
                    shown.map((c, idx) => (
                        <button
                            key={`${c.acct_seq_no}-${idx}`}
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSelect(c)}
                            className={cn(
                                "flex w-full flex-col gap-2 border-b border-wb-ntrl-3 p-3 text-left last:border-b-0",
                                "cursor-pointer hover:bg-black/2 disabled:cursor-not-allowed disabled:opacity-60",
                            )}
                        >
                            <div className="flex w-full flex-col gap-1">
                                <span className="text-wb-14 font-semibold leading-4.5 text-wb-dark">
                                    {c.bank_trns_short_id || "—"}
                                </span>
                                <span className="text-wb-12 font-medium leading-4 text-wb-ntrl-6">
                                    {t("payment.match.col.transfer_amount")}:{" "}
                                    <span className="font-bold">{formatAmount(c.trsc_amt ?? "0", c.ccy_cd || currency, false)}</span>
                                    {" "}{c.ccy_cd || currency}
                                    {(c.trsc_dt || c.trsc_tm) && (
                                        <> · {formatTrscDate(c.trsc_dt)} {formatTrscTime(c.trsc_tm)}</>
                                    )}
                                </span>
                            </div>
                            {(c.rmrk || c.rmrk2) && (
                                <span className="w-full whitespace-normal wrap-break-word text-wb-13 font-medium leading-4 text-wb-ntrl-6">
                                    {c.rmrk || c.rmrk2}
                                </span>
                            )}
                        </button>
                    ))
                )}
            </div>
        </div>,
        document.body,
    );
}

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** `yyyyMMdd` → `dd-MMM-yyyy`. */
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
