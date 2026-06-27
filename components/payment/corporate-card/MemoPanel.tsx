"use client";

import { Send, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import { createMemo, deleteMemo, fetchMemos } from "@/lib/api/cardTransactions";
import { ApiCallError } from "@/lib/api/banking";
import { useDialog } from "@/components/shared/dialog";
import { useApiData } from "@/lib/api/useApiData";
import { formatUtcDtmByLanguage } from "@/lib/datetime";
import { useTranslation, type Locale } from "@/lib/i18n";
import type { ApiMemoRow, MemoColor } from "@/lib/types/api";
import { cn } from "@/lib/utils";

/* ============================================================================
 *  Memo (note) side panel — right-edge drawer that slides in from the
 *  Card Transactions row's memo icon. Mirrors legacy
 *  `card_0001_001.ts:1242-1276` `getMemoPopup2` panel; Figma node
 *  5549:24184.
 *
 *  Animation: 250 ms cubic-bezier slide-in on mount + backdrop fade.
 *  On close, the panel slides back out and unmounts on transition end
 *  so the parent's `onClose` is called only after the visual is gone.
 *  ESC closes; outside-click does NOT (matches legacy memo drawer).
 * ========================================================================== */

const ANIM_MS = 250;

type MemoPanelProps = {
    /** {@code CARD_TRNS_HSTR.CARD_SEQ_NO} this memo thread attaches to. */
    cardSeqNo: string;
    onClose:   () => void;
};

/** Six color tags surfaced in the header. Mirrors the legacy
 *  {@code wabooks.enums.ColorCd} palette + uses the canonical PNG
 *  icon assets from the live JEX system
 *  ({@code assets_v2/images/wabooksTa/file*.png}) — copied verbatim
 *  to {@code public/assets/memo/} so the picker reads identically to
 *  the legacy memo drawer. */
const COLOR_OPTIONS: {
    value: MemoColor;
    label: string;
    /** PNG asset under {@code /assets/memo/}. The legacy single-letter
     *  suffix scheme: G=green, B=blue, Y=yellow, W=white/gray,
     *  R=red/pink, P=purple. */
    asset: string;
}[] = [
    { value: "green",  label: "Green",  asset: "/assets/memo/fileG.png" },
    { value: "blue",   label: "Indigo", asset: "/assets/memo/fileB.png" },
    { value: "yellow", label: "Amber",  asset: "/assets/memo/fileY.png" },
    { value: "gray",   label: "Gray",   asset: "/assets/memo/fileW.png" },
    { value: "red",    label: "Pink",   asset: "/assets/memo/fileR.png" },
    { value: "purple", label: "Purple", asset: "/assets/memo/fileP.png" },
];

/** Look up the PNG asset for a memo color tag. Returns {@code fileW}
 *  (neutral) when the value isn't one of the six surfaced colors. */
function assetFor(value: MemoColor | "white"): string {
    return COLOR_OPTIONS.find((o) => o.value === value)?.asset
        ?? "/assets/memo/fileW.png";
}

export default function MemoPanel({ cardSeqNo, onClose }: MemoPanelProps) {
    const { t } = useTranslation();
    const sysDialog = useDialog();

    /* ── Animation state ─────────────────────────────────────────── */
    // "entering" → just mounted, panel still off-screen.
    // "open"     → slid-in, interactive.
    // "exiting"  → slide-out triggered; unmount when transition ends.
    const [phase, setPhase] = useState<"entering" | "open" | "exiting">("entering");

    // Flip "entering" → "open" on next paint so the transition fires.
    useEffect(() => {
        const id = requestAnimationFrame(() => setPhase("open"));
        return () => cancelAnimationFrame(id);
    }, []);

    const requestClose = useCallback(() => {
        setPhase("exiting");
        // Unmount after the slide-out animation completes so the
        // panel doesn't pop out abruptly.
        window.setTimeout(onClose, ANIM_MS);
    }, [onClose]);

    /* ── Data + composer state ───────────────────────────────────── */
    const [draft,      setDraft]      = useState("");
    const [color,      setColor]      = useState<MemoColor>("white");
    const [submitting, setSubmitting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    const state = useApiData(
        () => fetchMemos(cardSeqNo),
        [cardSeqNo, refreshKey],
    );
    const memos = state.data?.rows ?? [];

    /* ── Body scroll lock + ESC ──────────────────────────────────── */
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") requestClose();
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener("keydown", onKey);
        };
    }, [requestClose]);

    /* ── Handlers ────────────────────────────────────────────────── */
    const submit = async () => {
        const text = draft.trim();
        if (!text) return;
        setSubmitting(true);
        try {
            await createMemo({
                ref_no: cardSeqNo,
                memo:   text,
                color:  color !== "white" ? color : undefined,
            });
            setDraft("");
            setColor("white");
            setRefreshKey((k) => k + 1);
            listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code    : "WBE9999";
            const msg  = err instanceof ApiCallError ? err.message : t("payment.card.memo.error.save_failed");
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: msg,
                errorCode:   code,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const requestDelete = (row: ApiMemoRow) => {
        sysDialog.open({
            type:        "confirmation",
            title:       t("dialog.confirmation"),
            description: t("payment.card.memo.confirm_delete"),
            confirmText: t("dialog.continue"),
            cancelText:  t("dialog.cancel"),
            onConfirm: async () => {
                try {
                    await deleteMemo(row.seq_no);
                    setRefreshKey((k) => k + 1);
                } catch (err) {
                    const code = err instanceof ApiCallError ? err.code    : "WBE9999";
                    const msg  = err instanceof ApiCallError ? err.message : t("payment.card.memo.error.delete_failed");
                    sysDialog.open({
                        type:        "error",
                        title:       t("dialog.error"),
                        description: msg,
                        errorCode:   code,
                    });
                }
            },
        });
    };

    const isVisible = phase === "open";

    if (typeof document === "undefined") return null;
    return createPortal(
        <>
            {/* Backdrop — opacity transitions in / out alongside the
                panel slide. Click on backdrop does NOT close (matches
                legacy memo drawer + avoids the system-dialog OK click
                bubbling through). */}
            <div
                aria-hidden
                className={cn(
                    "fixed inset-0 z-40 bg-black/45 transition-opacity duration-[250ms] ease-out",
                    isVisible ? "opacity-100" : "opacity-0",
                )}
            />
            {/* Drawer — slides in from the right via translateX. */}
            <aside
                role="dialog"
                aria-label={t("payment.card.memo.title")}
                className={cn(
                    "fixed right-0 top-0 z-50 flex h-screen w-[440px] max-w-[calc(100vw-32px)] flex-col bg-white shadow-2xl",
                    "transition-transform duration-[250ms] ease-out will-change-transform",
                    isVisible ? "translate-x-0" : "translate-x-full",
                )}
            >
                {/* Header — title left + color category icons + X right. */}
                <div className="flex items-center justify-between gap-3 border-b border-wb-table-border px-5 py-3.5">
                    <h2 className="text-wb-16 font-semibold text-wb-dark">
                        {t("payment.card.memo.title")}
                    </h2>
                    <div className="flex items-center gap-1">
                        {COLOR_OPTIONS.map((opt) => {
                            const active = color === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() =>
                                        setColor((c) => c === opt.value ? "white" : opt.value)
                                    }
                                    aria-label={opt.label}
                                    aria-pressed={active}
                                    className={cn(
                                        "flex size-10 cursor-pointer items-center justify-center rounded-xl transition-all duration-200 ease-out",
                                        active
                                            ? "bg-brand-soft scale-110"
                                            : "hover:bg-black/4",
                                    )}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={opt.asset}
                                        alt=""
                                        aria-hidden
                                        className={cn(
                                            "transition-all duration-200 ease-out",
                                            active ? "size-7" : "size-6",
                                        )}
                                    />
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={requestClose}
                            aria-label={t("dialog.close")}
                            className="ml-2 flex size-7 cursor-pointer items-center justify-center rounded-md text-wb-ink hover:bg-black/5"
                        >
                            <X className="size-4" strokeWidth={1.8} />
                        </button>
                    </div>
                </div>

                {/* List — newest first. Empty state when no memos yet. */}
                <div
                    ref={listRef}
                    className="custom-scrollbar-y flex-1 overflow-y-auto px-5 py-4"
                >
                    {state.loading && memos.length === 0 && (
                        <p className="px-1 py-6 text-center text-wb-13 text-wb-muted">
                            {t("common.loading")}
                        </p>
                    )}
                    {!state.loading && memos.length === 0 && (
                        <div className="flex h-full flex-col items-center justify-center gap-3 px-2 py-8 text-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/assets/memo/fileW.png"
                                alt=""
                                aria-hidden
                                className="size-12 opacity-60"
                            />
                            <p className="text-wb-13 text-wb-muted">
                                {t("payment.card.memo.empty")}
                            </p>
                        </div>
                    )}
                    <ul className="flex flex-col gap-2.5">
                        {memos.map((m) => (
                            <li key={m.seq_no}>
                                <MemoCard memo={m} onDelete={requestDelete} />
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Composer — Add comment input + send button. */}
                <div className="border-t border-wb-table-border px-5 py-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey && draft.trim()) {
                                    e.preventDefault();
                                    void submit();
                                }
                            }}
                            placeholder={t("payment.card.memo.placeholder")}
                            maxLength={200}
                            className="h-10 w-full rounded-full border border-wb-ntrl-4 bg-white px-4 text-wb-13 font-normal text-wb-ink transition-colors focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                        />
                        <button
                            type="button"
                            onClick={() => void submit()}
                            disabled={submitting || !draft.trim()}
                            aria-label={t("payment.card.memo.send")}
                            className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors",
                                submitting || !draft.trim()
                                    ? "cursor-not-allowed bg-wb-ntrl-4 text-white"
                                    : "cursor-pointer bg-brand text-white shadow-wb-brand-btn hover:bg-brand-hover",
                            )}
                        >
                            <Send className="size-4" strokeWidth={1.8} />
                        </button>
                    </div>
                </div>
            </aside>
        </>,
        document.body,
    );
}

/* ── One memo card in the list ──────────────────────────────────── */

function MemoCard({
    memo,
    onDelete,
}: {
    memo:     ApiMemoRow;
    onDelete: (m: ApiMemoRow) => void;
}) {
    const { t, locale } = useTranslation();
    const hasTag = memo.color && memo.color !== "white";
    return (
        <div className="relative rounded-md border border-wb-ntrl-4 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    {hasTag && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={assetFor(memo.color)}
                            alt=""
                            aria-hidden
                            className="size-4 shrink-0"
                        />
                    )}
                    <span className="truncate text-wb-13 font-semibold text-wb-ink">
                        {memo.reg_nm}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-wb-11 font-normal text-wb-muted">
                        {formatDtm14(memo.reg_dtm, locale)}
                    </span>
                    {memo.can_edit && (
                        <button
                            type="button"
                            onClick={() => onDelete(memo)}
                            aria-label={t("payment.card.memo.delete")}
                            className="flex size-5 cursor-pointer items-center justify-center rounded text-wb-ntrl-6 transition-colors hover:bg-black/5 hover:text-wb-status-rejected-text"
                        >
                            <Trash2 className="size-3.5" strokeWidth={1.6} />
                        </button>
                    )}
                </div>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-wb-13 font-normal text-wb-ink">
                {memo.memo}
            </p>
        </div>
    );
}

/**
 * yyyyMMddHHmmss (UTC) → `<localized date> HH:mm:ss`. Memo REG_DTM is stored
 * UTC (`CardTransactionsService.nowDtm14() = OffsetDateTime.now(ZoneOffset.UTC)`),
 * so convert to Vietnam local and format per active language.
 */
function formatDtm14(value: string, locale: Locale): string {
    if (!value || value.length < 12) return "";
    const { date, time } = formatUtcDtmByLanguage(value, locale);
    return date ? `${date} ${time}` : "";
}
