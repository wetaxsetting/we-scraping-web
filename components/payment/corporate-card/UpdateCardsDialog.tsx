"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import DateField from "@/components/shared/DateField";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { ApiCallError } from "@/lib/api/banking";
import {
    fetchActiveCards,
    startCardSyncSession,
    fetchCardSyncStatus,
    cancelCardSync,
    submitCardSyncQna,
    submitCardSyncOtp,
    submitCardSyncCaptcha,
} from "@/lib/api/cardTransactions";
import type { ApiCardSyncStatusResponse, ApiQnaQuestion } from "@/lib/types/api";
import { QnaDialog } from "@/app/(dashboard)/banking/credentials/QnaDialog";
import { OtpDialog } from "@/app/(dashboard)/banking/credentials/OtpDialog";
import { CaptchaDialog } from "@/app/(dashboard)/banking/credentials/CaptchaDialog";
import { lookupScrapingResultMessage } from "@/lib/i18n/scrapingResultCodes";
import { nxisasDebug } from "@/lib/nxisas/nxisas-debug";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type UpdateCardsDialogProps = {
    /** Closes the dialog. */
    onClose:   () => void;
    /** Fired after the scrape completes — parent (Card Transactions
     *  page) bumps its refresh-key so the ledger re-fetches with the
     *  freshly-scraped data. The {@code range} carries the
     *  {@code yyyymmdd} window the scrape pulled so the parent can widen
     *  its date filter to cover inserted rows. */
    onSuccess?: (range: { fromDt: string; toDt: string }) => void;
};

/**
 * Status-poll interval (Phase 2). The popup polls the backend
 * {@code /sync-session/{id}/status} endpoint at this cadence for real
 * per-card progress (0 → 50 → 100 per card) + the live completed-card
 * counter — no client-side timer simulates progress. 750ms sits inside the
 * task-mandated 500–1000ms band. Polling is a guarded recursive timeout
 * (never overlapping requests).
 */
const POLL_INTERVAL_MS = 750;

/**
 * Explicit modal phase (mirrors the Update e-Invoice Information modal):
 *  - `ready`     — pre-scrape: Update enabled, dates editable-when-Auto-off.
 *  - `scraping`  — worker running: bar advances, "In Progress ( x / N )",
 *                  Update disabled, Cancel confirms + stops the scrape.
 *  - `completed` — every card processed: full blue bar, "Completed".
 *  - `failed`    — login / gateway / network failure: red bar, "Failed".
 */
type Phase = "ready" | "scraping" | "completed" | "failed";

/**
 * Card Transactions &gt; Update — opens from the Update button.
 *
 * <p><b>Async scrape + status polling (Phase 2, 2026-07-17).</b> The Update
 * button starts a session via {@code POST /sync-session}; the backend returns
 * a RUNNING snapshot immediately and drives the per-card
 * {@code LOGIN → (QNA/OTP/CAPTCHA?) → CARD_USING → persist} chain on a
 * background worker. The popup polls {@code /sync-session/{id}/status} to
 * render a determinate progress bar + a live "In Progress ( x / N )" counter,
 * shows "Completed" on the terminal COMPLETED snapshot, and offers a real
 * Cancel (confirm → {@code /sync-session/{id}/cancel} → the worker stops before
 * the next card). This mirrors the Bank Transaction Sync popup's Phase-2
 * behaviour and the Update e-Invoice Information progress pattern; the card
 * popup deliberately keeps its simpler UI (no per-currency result/amount card).
 *
 * <h2>Auto mode</h2>
 *
 * <p>When Auto is checked the date chips disable and the request rides
 * with {@code auto: true} — the server derives the window from
 * {@code min(TRN_LST_SUC_DTM)} of the cards (falls back to today − 90 days
 * when none ever synced) and pins the end to today.
 *
 * <p><b>Runtime caveat (OQ-S1):</b> the Coocon engine is licensed per page
 * origin + VPN-gated, so a live end-to-end scrape cannot run in R&D; the
 * polling state machine + progress + cancel are covered by unit tests only.
 */
export default function UpdateCardsDialog({
    onClose,
    onSuccess,
}: UpdateCardsDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    // Pre-fetch placeholder = last 90 days → today (the Auto fallback when
    // no card has ever synced). Overridden on mount by the real Auto range.
    const [fromIso, setFromIso] = useState(() => isoSubtract(today(), 90, "days"));
    const [toIso,   setToIso]   = useState(today);
    const [auto,    setAuto]    = useState(true);

    const [phase, setPhase] = useState<Phase>("ready");
    /** Determinate progress-bar value (0–100). Driven entirely by the backend
     *  status poll — real per-card milestones, applied monotonically. */
    const [progress, setProgress] = useState(0);
    /** Live processed / total card counts from the backend status — drive the
     *  "In Progress ( done / total )" row. `totalCards` is seeded from the
     *  active-cards fetch so the counter reads "0 / N" before the first poll. */
    const [completedCards, setCompletedCards] = useState(0);
    const [totalCards, setTotalCards] = useState(0);

    const scraping = phase === "scraping";

    // ── Poll / lifecycle refs ─────────────────────────────────────────
    const sessionIdRef = useRef<string | null>(null);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    /** True while a cancel / close confirmation is open — pauses polling so a
     *  background terminal can't replace the confirmation. */
    const cancelConfirmOpenRef = useRef(false);
    /** Set the moment a terminal outcome is accepted — fires the terminal
     *  dialog exactly once and blocks a late/stale response re-opening it. */
    const terminalHandledRef = useRef(false);
    /** Monotonic run token — bumped on every fresh start AND on cancel so an
     *  in-flight start/resume promise from a superseded run can't apply. */
    const runGenerationRef = useRef(0);

    /** Seed the displayed Auto range from the cards' latest successful update,
     *  and seed the total-card count for the "0 / N" counter. Runs once on
     *  open; the backend recomputes the same window when Auto is checked. */
    const seededRef = useRef(false);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetchActiveCards();
                if (cancelled || seededRef.current) return;
                const range = defaultAutoRange(res.cards ?? []);
                setFromIso(range.startIso);
                setToIso(range.endIso);
                setTotalCards((res.cards ?? []).length);
                seededRef.current = true;
            } catch {
                // Non-fatal — keep the 90-day placeholder; the backend still
                // recomputes the real window in Auto mode, and the poll snapshot
                // carries the authoritative total_cards.
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Mounted flag + poll-timer cleanup.
    useEffect(() => {
        const timer = pollTimerRef;
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timer.current !== null) {
                clearTimeout(timer.current);
                timer.current = null;
            }
        };
    }, []);

    /** The {yyyymmdd} window the in-flight scrape was started with. */
    const submittedRange = useRef<{ fromDt: string; toDt: string }>({
        fromDt: isoToYyyymmdd(fromIso),
        toDt:   isoToYyyymmdd(toIso),
    });

    /** Active challenge requested by the backend. */
    const [challenge, setChallenge] = useState<{
        sessionId: string;
        kind: "QNA" | "OTP" | "CAPTCHA";
        prompt: string;
        qnaQuestions?: ApiQnaQuestion[];
        captchaImage?: string;
        captchaImageFormat?: string;
        loginId?: string;
        bankName?: string;
    } | null>(null);

    // ── Poll loop ──────────────────────────────────────────────────────
    const stopPolling = useCallback(() => {
        if (pollTimerRef.current !== null) {
            clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }, []);

    /**
     * Apply a backend status snapshot to the UI. Progress is monotonic.
     * COMPLETED → refresh + success dialog + close; `*_REQUIRED` → open the
     * matching challenge dialog (polling pauses until submit); FAILED → error
     * dialog; CANCELLED → reset to ready.
     */
    const applyStatus = useCallback((res: ApiCardSyncStatusResponse) => {
        if (res.session_id) sessionIdRef.current = res.session_id;
        if (typeof res.progress === "number") {
            const next = res.progress;
            setProgress((p) => (next > p ? next : p));
        }
        setCompletedCards(res.completed_cards ?? 0);
        if (typeof res.total_cards === "number" && res.total_cards > 0) {
            setTotalCards(res.total_cards);
        }

        switch (res.status) {
            case "RUNNING":
                setChallenge(null);
                setPhase("scraping");
                return;
            case "OTP_REQUIRED":
            case "QNA_REQUIRED":
            case "CAPTCHA_REQUIRED": {
                const kind =
                    res.status === "OTP_REQUIRED" ? "OTP"
                    : res.status === "QNA_REQUIRED" ? "QNA" : "CAPTCHA";
                const ch = res.challenge;
                setPhase("scraping");
                setChallenge({
                    sessionId:          res.session_id ?? sessionIdRef.current ?? "",
                    kind,
                    prompt:             ch?.prompt ?? "",
                    qnaQuestions:       ch?.qna_questions ?? undefined,
                    captchaImage:       ch?.captcha_image ?? undefined,
                    captchaImageFormat: ch?.captcha_image_format ?? undefined,
                    loginId:            ch?.login_id ?? "",
                    bankName:           ch?.bank_name ?? "",
                });
                return;
            }
            case "COMPLETED": {
                if (terminalHandledRef.current) return;
                terminalHandledRef.current = true;
                stopPolling();
                setChallenge(null);
                setProgress(100);
                setPhase("completed");
                onSuccess?.(submittedRange.current);
                dialog.open({
                    type:        "success",
                    title:       t("dialog.success"),
                    description: t("payment.card.update_cards.inquiry_finished"),
                    onConfirm:   onClose,
                });
                return;
            }
            case "FAILED": {
                if (terminalHandledRef.current) return;
                terminalHandledRef.current = true;
                stopPolling();
                setChallenge(null);
                setProgress(100);
                setPhase("failed");
                const localized = lookupScrapingResultMessage(res.error_code, t);
                dialog.open({
                    type:        "error",
                    title:       t("dialog.error"),
                    description: localized ?? res.error_message ?? t("payment.card.update_cards.error.failed"),
                    errorCode:   res.error_code ?? "ERROR",
                });
                return;
            }
            case "CANCELLED":
                if (terminalHandledRef.current) return;
                terminalHandledRef.current = true;
                // Inline reset (keeps applyStatus's deps to stable values only).
                stopPolling();
                setChallenge(null);
                setPhase("ready");
                setProgress(0);
                setCompletedCards(0);
                sessionIdRef.current = null;
                return;
        }
    }, [dialog, onClose, onSuccess, stopPolling, t]);

    const scheduleNextPoll = useCallback(() => {
        stopPolling();
        pollTimerRef.current = setTimeout(() => void pollOnce(), POLL_INTERVAL_MS);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stopPolling]);

    /** One poll: fetch status, ignore stale / post-unmount responses, apply,
     *  and re-arm only while RUNNING. */
    const pollOnce = useCallback(async () => {
        pollTimerRef.current = null;
        const sid = sessionIdRef.current;
        if (!sid || !mountedRef.current) return;
        if (cancelConfirmOpenRef.current || terminalHandledRef.current) return;
        let res: ApiCardSyncStatusResponse;
        try {
            res = await fetchCardSyncStatus(sid);
        } catch (err) {
            if (!mountedRef.current || cancelConfirmOpenRef.current || terminalHandledRef.current) return;
            terminalHandledRef.current = true;
            setPhase("failed");
            setProgress(100);
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const msg =
                err instanceof ApiCallError ? err.message
                : err instanceof Error ? err.message
                : t("payment.card.update_cards.error.failed");
            dialog.open({ type: "error", title: t("dialog.error"), description: msg, errorCode: code });
            return;
        }
        if (!mountedRef.current || res.session_id !== sessionIdRef.current) return;
        if (cancelConfirmOpenRef.current || terminalHandledRef.current) return;
        applyStatus(res);
        if (res.status === "RUNNING") scheduleNextPoll();
    }, [applyStatus, dialog, scheduleNextPoll, t]);

    /** Consume a challenge-resume response: apply it, then resume polling if the
     *  backend went back to RUNNING. */
    const resumeChallenge = useCallback((promise: Promise<ApiCardSyncStatusResponse>) => {
        const gen = runGenerationRef.current;
        setChallenge(null);
        return promise
            .then((res) => {
                if (!mountedRef.current || gen !== runGenerationRef.current) return;
                if (terminalHandledRef.current) return;
                applyStatus(res);
                if (res.status === "RUNNING") scheduleNextPoll();
            })
            .catch((err) => {
                if (!mountedRef.current || gen !== runGenerationRef.current) return;
                if (terminalHandledRef.current) return;
                terminalHandledRef.current = true;
                setPhase("failed");
                setProgress(100);
                const code = err instanceof ApiCallError ? err.code : "WBE9999";
                const msg =
                    err instanceof ApiCallError ? err.message
                    : err instanceof Error ? err.message
                    : t("payment.card.update_cards.error.failed");
                dialog.open({ type: "error", title: t("dialog.error"), description: msg, errorCode: code });
            });
    }, [applyStatus, dialog, scheduleNextPoll, t]);

    // ── Reset ──────────────────────────────────────────────────────────
    function resetToReady() {
        stopPolling();
        setChallenge(null);
        setPhase("ready");
        setProgress(0);
        setCompletedCards(0);
        sessionIdRef.current = null;
    }

    // ── Cancel (confirm → server /cancel → reset) ──────────────────────
    /** Open a cancel/close confirmation. Polling pauses while it is open so a
     *  background terminal can't replace it. On "Yes" the session is cancelled
     *  server-side + reset; `afterReset` runs (e.g. close for the X path). */
    function openCancelConfirm(descriptionKey: string, afterReset?: () => void) {
        cancelConfirmOpenRef.current = true;
        stopPolling();
        dialog.open({
            type:        "confirmation",
            title:       t("dialog.confirmation"),
            description: t(descriptionKey),
            confirmText: t("dialog.yes"),
            cancelText:  t("dialog.no"),
            onConfirm: () => {
                cancelConfirmOpenRef.current = false;
                doCancel(afterReset);
            },
            onCancel: () => {
                // "No" — keep scraping. Resume polling only when safe.
                cancelConfirmOpenRef.current = false;
                if (!mountedRef.current || terminalHandledRef.current) return;
                if (!sessionIdRef.current || challenge) return;
                scheduleNextPoll();
            },
        });
    }

    function doCancel(afterReset?: () => void) {
        cancelConfirmOpenRef.current = false;
        if (terminalHandledRef.current) return; // a real terminal already won
        terminalHandledRef.current = true;
        runGenerationRef.current += 1; // invalidate any in-flight start/resume
        stopPolling();
        const sid = sessionIdRef.current;
        if (sid) {
            // Best-effort server-side cancel — the local teardown always runs.
            void cancelCardSync(sid).catch(() => {});
        }
        resetToReady();
        afterReset?.();
    }

    function handleCancel() {
        if (scraping) {
            openCancelConfirm("payment.card.update_cards.cancel_confirm");
            return;
        }
        onClose();
    }

    /** Close (X / outside): mid-scrape → confirm, then cancel + close. */
    function handleRequestClose() {
        if (scraping) {
            openCancelConfirm("payment.card.update_cards.close_confirm", onClose);
            return;
        }
        onClose();
    }

    // ── Start ──────────────────────────────────────────────────────────
    const handleUpdate = useCallback(() => {
        if (scraping) return;
        const fromYyyymmdd = isoToYyyymmdd(fromIso);
        const toYyyymmdd   = isoToYyyymmdd(toIso);
        submittedRange.current = { fromDt: fromYyyymmdd, toDt: toYyyymmdd };

        // Fresh run — reset the bar + guards, take a new run token.
        stopPolling();
        cancelConfirmOpenRef.current = false;
        terminalHandledRef.current = false;
        const gen = (runGenerationRef.current += 1);
        setProgress(0);
        setCompletedCards(0);
        setChallenge(null);
        setPhase("scraping");
        sessionIdRef.current = null;

        nxisasDebug("nxisasObj", {
            flowType: "CARD_UPDATE_TRANSACTIONS",
            auto,
            from: auto ? undefined : fromYyyymmdd,
            to:   auto ? undefined : toYyyymmdd,
        });

        void (async () => {
            try {
                const res = await startCardSyncSession({
                    from_date: fromYyyymmdd,
                    to_date:   toYyyymmdd,
                    auto,
                });
                if (!mountedRef.current || gen !== runGenerationRef.current || terminalHandledRef.current) return;
                applyStatus(res);
                if (res.status === "RUNNING") scheduleNextPoll();
            } catch (err) {
                if (!mountedRef.current || gen !== runGenerationRef.current || terminalHandledRef.current) return;
                terminalHandledRef.current = true;
                setPhase("failed");
                setProgress(100);
                const code = err instanceof ApiCallError ? err.code : "WBE9999";
                const message = err instanceof ApiCallError
                    ? err.message
                    : t("payment.card.update_cards.error.failed");
                dialog.open({
                    type:        "error",
                    title:       t("dialog.error"),
                    description: message,
                    errorCode:   code,
                });
            }
        })();
    }, [applyStatus, auto, dialog, fromIso, scheduleNextPoll, scraping, stopPolling, t, toIso]);

    const handleFromChange = useCallback((iso: string) => {
        setFromIso(iso);
        if (iso > toIso) setToIso(iso);
    }, [toIso]);

    const handleToChange = useCallback((iso: string) => {
        setToIso(iso);
        if (iso < fromIso) setFromIso(iso);
    }, [fromIso]);

    // ── Status text (In Progress ( x / N ) / Completed / Failed) ───────
    const statusText =
        phase === "scraping"
            ? t("payment.card.update_cards.in_progress_count", {
                  done:  String(completedCards),
                  total: String(totalCards || completedCards),
              })
            : phase === "completed"
              ? t("payment.card.update_cards.completed")
              : phase === "failed"
                ? t("payment.card.update_cards.failed")
                : "";

    const datesDisabled = auto || phase !== "ready";

    return (
        <>
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) handleRequestClose();
            }}
        >
            <DialogContent
                stackLevel={2}
                aria-describedby={undefined}
                // Outside-click dismissal OFF: the portalled DateField
                // calendar renders into document.body so a click on a day
                // cell counts as "outside" to Radix and would dismiss the
                // modal. Same precedent as TransactionSyncDialog.
                closeOnOutsideClick={false}
                className="max-w-[640px] gap-0 rounded-2xl p-0"
            >
                <div className="flex w-full flex-col gap-5 px-5 py-6">
                    {/* Header */}
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold leading-[18px] text-wb-dark">
                            {t("payment.card.update_cards.title")}
                        </h2>
                    </DialogTitle>

                    {/* Date-range row — Start Date · ~ · End Date · Auto. */}
                    <div className="flex flex-nowrap items-center gap-3">
                        <div
                            className={cn(
                                "flex flex-nowrap items-center gap-3",
                                datesDisabled && "pointer-events-none opacity-60",
                            )}
                            aria-disabled={datesDisabled}
                        >
                            <FieldLabel>
                                {t("payment.card.update_cards.start_date")}
                            </FieldLabel>
                            <div className="w-[140px]">
                                <DateField
                                    value={fromIso}
                                    onChange={handleFromChange}
                                    iconInside
                                    portalled
                                    ariaLabelKey="payment.card.update_cards.start_date"
                                />
                            </div>

                            <span
                                aria-hidden
                                className="text-wb-14-tight font-medium text-wb-ntrl-8"
                            >
                                ~
                            </span>

                            <FieldLabel>
                                {t("payment.card.update_cards.end_date")}
                            </FieldLabel>
                            <div className="w-[140px]">
                                <DateField
                                    value={toIso}
                                    onChange={handleToChange}
                                    iconInside
                                    portalled
                                    ariaLabelKey="payment.card.update_cards.end_date"
                                />
                            </div>
                        </div>

                        <label
                            htmlFor="update-cards-auto"
                            className={cn(
                                "inline-flex items-center gap-1.5 text-wb-14 font-medium leading-4 text-wb-ink",
                                phase !== "ready" ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                            )}
                        >
                            <Checkbox
                                id="update-cards-auto"
                                checked={auto}
                                onCheckedChange={(v) => setAuto(v === true)}
                                disabled={phase !== "ready"}
                            />
                            <span>{t("payment.card.update_cards.auto")}</span>
                        </label>
                    </div>

                    {/* Blue helper text — legacy "auto setting" hint. */}
                    <p className="text-wb-13 font-medium leading-4 text-brand">
                        {t("payment.card.update_cards.helper")}
                    </p>

                    {/* Progress bar — determinate, single brand-blue fill driven
                       by the numeric `progress` state (Update e-Invoice pattern):
                       solid brand-blue for scraping AND completion, red only on
                       failure, over a #f5f5f5 track. No indeterminate pulse. */}
                    <div className="h-8 w-full overflow-hidden rounded-md border border-wb-border-sidebar bg-[#f5f5f5]">
                        <div
                            data-testid="card-sync-progress-fill"
                            aria-hidden
                            className={cn(
                                "h-full transition-[width] duration-300",
                                phase === "failed" ? "bg-wb-status-rejected-text" : "bg-brand",
                            )}
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Status text (In Progress ( x / N ) / Completed / Failed). */}
                    {statusText && (
                        <p
                            className={cn(
                                "-mt-2 text-center text-wb-13 font-semibold",
                                phase === "completed"
                                    ? "text-brand"
                                    : phase === "failed"
                                      ? "text-wb-status-rejected-text"
                                      : "text-wb-ink",
                            )}
                        >
                            {statusText}
                        </p>
                    )}

                    {/* Footer — Cancel + Update right-aligned. Cancel stops the
                       scrape (confirm) while running, else closes; Update is
                       disabled + relabelled while scraping. */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="flex h-9 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={handleUpdate}
                            disabled={scraping}
                            className={cn(
                                "flex h-9 cursor-pointer items-center justify-center rounded-md px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn",
                                scraping
                                    ? "cursor-not-allowed bg-wb-ntrl-4 shadow-none"
                                    : "bg-brand hover:bg-brand-hover",
                            )}
                        >
                            {scraping
                                ? t("payment.card.update_cards.updating")
                                : t("payment.card.update_cards.update")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* ── Challenge dialogs — the same components Login Credentials /
            Bank Transaction Sync use. On submit each resumes the card
            session; the response loops back through applyStatus. ── */}
        {challenge?.kind === "QNA" && (
            <QnaDialog
                bankName={challenge.bankName ?? ""}
                loginId={challenge.loginId ?? ""}
                questions={challenge.qnaQuestions ?? []}
                onSubmit={(payload) => {
                    const sessionId = challenge.sessionId;
                    return resumeChallenge(
                        submitCardSyncQna(sessionId, {
                            question:     payload.question,
                            hidden_value: payload.hidden_value,
                            answer:       payload.answer,
                        }),
                    );
                }}
                onCancel={() => openCancelConfirm("payment.card.update_cards.cancel_confirm")}
            />
        )}
        {challenge?.kind === "OTP" && (
            <OtpDialog
                prompt={challenge.prompt}
                onSubmit={(value) => {
                    const sessionId = challenge.sessionId;
                    return resumeChallenge(submitCardSyncOtp(sessionId, value));
                }}
                onCancel={() => openCancelConfirm("payment.card.update_cards.cancel_confirm")}
            />
        )}
        {challenge?.kind === "CAPTCHA" && (
            <CaptchaDialog
                image={challenge.captchaImage ?? ""}
                format={challenge.captchaImageFormat ?? "png"}
                onSubmit={(value) => {
                    const sessionId = challenge.sessionId;
                    return resumeChallenge(submitCardSyncCaptcha(sessionId, value));
                }}
                onCancel={() => openCancelConfirm("payment.card.update_cards.cancel_confirm")}
            />
        )}
        </>
    );
}

/* --------------------------------------------------------------------
 *  Small sub-components
 * ------------------------------------------------------------------ */

/** Field label with the required-dot. */
function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <span className="flex items-center gap-1 text-wb-14 font-medium leading-4 text-wb-ntrl-8">
            {children}
            <span aria-hidden className="text-wb-status-rejected-text">•</span>
        </span>
    );
}

/* --------------------------------------------------------------------
 *  Pure helpers
 * ------------------------------------------------------------------ */

/**
 * Default Auto Date Range for the Update Cards popup — Start = the
 * EARLIEST {@code TRN_LST_SUC_DTM} across the active cards, End = today.
 * When no card has ever synced, fall back to today − 90 days (the backend's
 * never-synced default). Mirrors Bank Transaction Sync's
 * {@code defaultSyncRange}.
 */
function defaultAutoRange(
    cards: ReadonlyArray<{ trn_lst_suc_dtm: string | null }>,
): { startIso: string; endIso: string } {
    const end = today();
    let earliest: string | null = null;
    for (const c of cards) {
        const iso = lastSyncToIso(c.trn_lst_suc_dtm);
        if (iso && (earliest === null || iso < earliest)) earliest = iso;
    }
    return earliest
        ? { startIso: earliest, endIso: end }
        : { startIso: isoSubtract(end, 90, "days"), endIso: end };
}

/** Convert a compact {@code yyyyMMddHHmmss} (or {@code yyyyMMdd})
 *  last-success marker to an ISO {@code yyyy-MM-dd} date, or null when
 *  absent / malformed. */
function lastSyncToIso(raw: string | null): string | null {
    if (!raw) return null;
    const head = raw.slice(0, 8);
    if (!/^\d{8}$/.test(head)) return null;
    return `${head.slice(0, 4)}-${head.slice(4, 6)}-${head.slice(6, 8)}`;
}

/** ISO {@code YYYY-MM-DD} for the current local date. */
function today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Subtract {@code count} {@code months|days} from an ISO date. */
function isoSubtract(iso: string, count: number, unit: "months" | "days"): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (unit === "months") d.setMonth(d.getMonth() - count);
    else                   d.setDate(d.getDate() - count);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isoToYyyymmdd(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? `${m[1]}${m[2]}${m[3]}` : iso;
}

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}
