"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import SearchInput from "@/components/shared/SearchInput";
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

const PANEL_WIDTH = 460;
const MAX_LIST_HEIGHT = 320;

type Props = {
    /** Batch id (`SCDUL_PYMN_NO` / `OVRS_PYMN_NO`) of the line being matched. */
    scdulPymnNo: string;
    /** Line id (`SCDUL_PYMN_DETL_NO` / `OVRS_PYMN_DETL_NO`) being matched. */
    scdulPymnDetlNo: string;
    /** Currency rendered below each candidate amount (e.g. "VND"). */
    currency: string;
    /** Bounding rect of the clicked Banking-Transaction-ID Match button —
     *  the dropdown anchors beneath it (legacy `ShowBankingTransactionDropdownInCell`). */
    anchorRect: DOMRect;
    /** Per-module candidate fetcher (Internal Transfer / Vendor / Expense). */
    fetchCandidates: (
        scdulPymnNo: string,
        scdulPymnDetlNo: string,
        srchWd?: string,
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
 * `ShowBankingTransactionDropdownInCell` (`add_osmc.js:9072-9306`, triggered by
 * `pymn_0010_002.ts` / `pymn_0002_002.ts` / `pymn_0004_002.ts`). The legacy
 * picker is NOT a modal — it is a Bootstrap `.dropdown` appended directly under
 * the clicked Banking-Transaction-ID cell. This component reproduces that:
 * a search field, a "Suggested matches / N bank transactions" header, and a
 * scrollable candidate list anchored to the clicked cell. **Clicking a
 * candidate row matches immediately** (no confirm step, no memo input —
 * legacy parity). Outside-click / ESC closes; only one is open at a time
 * (the page holds a single anchor+target).
 *
 * Backend-agnostic: reuses the same injected `fetchCandidates` / `submitMatch`
 * client fns and the same `ApiPaymentLineMatch*` DTOs as the (now-retired for
 * these screens) `VendorExpenseMatchDialog`. UI-only — no API / matching-logic
 * change. Figma 8538:13779 (search) + 8689:7811 (header) + 8689:7814 (rows).
 */
export default function BankingTxnMatchDropdown({
    scdulPymnNo,
    scdulPymnDetlNo,
    currency,
    anchorRect,
    fetchCandidates,
    submitMatch,
    onClose,
    onMatched,
}: Props) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const panelRef = useRef<HTMLDivElement>(null);

    const [search, setSearch] = useState("");
    const [candidates, setCandidates] = useState<ApiPaymentLineMatchCandidateRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Anchor beneath the clicked cell, right-edge aligned (the Banking
    // Transaction ID column is far right) and clamped to the viewport.
    const position = useMemo(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const left = Math.min(
            Math.max(anchorRect.right - PANEL_WIDTH, 8),
            Math.max(vw - PANEL_WIDTH - 8, 8),
        );
        const top = anchorRect.bottom + 4;
        const maxHeight = Math.max(160, Math.min(MAX_LIST_HEIGHT + 110, vh - top - 8));
        return { left, top, maxHeight };
    }, [anchorRect]);

    // Load candidates on mount + whenever the keyword changes. Server-side
    // filtering (account + exact date + exact amount + remark) is unchanged;
    // only the keyword is user-driven.
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

    // Outside-click + ESC close (only one dropdown open at a time).
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
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
            style={{ left: position.left, top: position.top, width: PANEL_WIDTH, maxHeight: position.maxHeight }}
        >
            {/* Search field — Figma 8538:13779 */}
            <div className="flex shrink-0 items-center gap-1.5 border-b border-wb-ntrl-4 p-2.5">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder={t("payment.match.dropdown_placeholder")}
                />
            </div>

            {/* "Suggested matches / N bank transactions" — Figma 8689:7811 */}
            <div className="flex shrink-0 items-center justify-between gap-2.5 border-b border-wb-ntrl-3 bg-wb-bg-card px-3 py-3 text-wb-14 font-medium text-wb-ntrl-6">
                <span>{t("payment.match.suggested")}</span>
                <span>{t("payment.match.count_label", { count: String(candidates.length) })}</span>
            </div>

            {/* Candidate rows — Figma 8689:7814. Whole-row click = match. */}
            <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                    <div className="px-3 py-8 text-center text-wb-13 text-wb-muted">
                        {t("common.loading")}
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="px-3 py-8 text-center text-wb-13 text-wb-muted">
                        {t("payment.match.no_data")}
                    </div>
                ) : (
                    candidates.map((c, idx) => (
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
