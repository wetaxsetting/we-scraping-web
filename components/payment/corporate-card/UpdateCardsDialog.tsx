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
    submitCardSyncQna,
    submitCardSyncOtp,
    submitCardSyncCaptcha,
} from "@/lib/api/cardTransactions";
import type { ApiCardSyncSessionResponse, ApiQnaQuestion } from "@/lib/types/api";
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
 * Card Transactions &gt; Update — opens from the Update button.
 *
 * <p><b>Session/challenge flow (2026-06-19).</b> Reuses the shared NXISAS
 * scrape-session framework (the same one Account Inquiry &gt; Bank
 * Transaction Sync and Login Credentials use): the Update button starts a
 * session via {@code POST /sync-session}; if the bank returns a
 * QNA / OTP / CAPTCHA challenge (Shinhan 11704088 requires QNA) the dialog
 * opens the matching shared challenge dialog, the user answers, and the
 * session resumes via {@code /sync-session/{id}/qna|otp|captcha}; once the
 * login clears the backend runs {@code CARD_USING} per card and persists
 * into {@code CARD_TRNS_HSTR}. Replaces the old headless {@code /sync}
 * call which aborted QNA-gated banks.
 *
 * <h2>Auto mode</h2>
 *
 * <p>When Auto is checked the date chips disable and the request rides
 * with {@code auto: true} — the server derives the window from
 * {@code min(TRN_LST_SUC_DTM)} of the cards (falls back to today − 90 days
 * when none ever synced) and pins the end to today.
 */
export default function UpdateCardsDialog({
    onClose,
    onSuccess,
}: UpdateCardsDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    // Pre-fetch placeholder = last 90 days → today (the Auto fallback when
    // no card has ever synced). Overridden on mount by the real Auto range
    // computed from the cards' last successful update (see effect below).
    const [fromIso, setFromIso] = useState(() => isoSubtract(today(), 90, "days"));
    const [toIso,   setToIso]   = useState(today);
    const [auto,    setAuto]    = useState(true);

    const [inFlight, setInFlight] = useState(false);

    /** Seed the displayed Auto range from the cards' latest successful
     *  update — Start Date = min(CARD_MSTR.TRN_LST_SUC_DTM) across active
     *  cards, End Date = today; fallback today − 90 days when no card has
     *  ever synced. Mirrors Bank Transaction Sync, which seeds its range
     *  from each account's last sync. Runs once on open; the backend
     *  recomputes the same window server-side when Auto is checked, so the
     *  popup display always matches what will actually be scraped. After a
     *  successful scrape the backend advances TRN_LST_SUC_DTM, so the next
     *  time this popup opens it shows "latest updated date ~ today". */
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
                seededRef.current = true;
            } catch {
                // Non-fatal — keep the 90-day placeholder; the backend
                // still recomputes the real window in Auto mode.
            }
        })();
        return () => { cancelled = true; };
    }, []);

    /** The {yyyymmdd} window the in-flight scrape was started with —
     *  captured at submit so the COMPLETED branch can hand it to the
     *  parent (which widens its date filter to show inserted rows). */
    const submittedRange = useRef<{ fromDt: string; toDt: string }>({
        fromDt: isoToYyyymmdd(fromIso),
        toDt:   isoToYyyymmdd(toIso),
    });

    /** Active challenge requested by the backend; one of the shared
     *  QnaDialog / OtpDialog / CaptchaDialog renders when set. */
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

    /** Consume a response from any of the card-sync endpoints (start +
     *  three resume variants). COMPLETED → refresh + success dialog;
     *  *_REQUIRED → open the matching challenge dialog; ERROR → error
     *  dialog. */
    const handleResponse = useCallback((res: ApiCardSyncSessionResponse) => {
        switch (res.status) {
            case "COMPLETED":
                setChallenge(null);
                onSuccess?.(submittedRange.current);
                dialog.open({
                    type:        "success",
                    title:       t("dialog.success"),
                    description: t("payment.card.update_cards.inquiry_finished"),
                    onConfirm:   onClose,
                });
                return;
            case "QNA_REQUIRED":
                setChallenge({
                    sessionId:    res.session_id!,
                    kind:         "QNA",
                    prompt:       res.challenge_prompt ?? "",
                    qnaQuestions: res.qna_questions ?? [],
                    loginId:      res.login_id ?? "",
                    bankName:     res.bank_name ?? "",
                });
                return;
            case "OTP_REQUIRED":
                setChallenge({
                    sessionId: res.session_id!,
                    kind:      "OTP",
                    prompt:    res.challenge_prompt ?? "",
                });
                return;
            case "CAPTCHA_REQUIRED":
                setChallenge({
                    sessionId:          res.session_id!,
                    kind:               "CAPTCHA",
                    prompt:             res.challenge_prompt ?? "",
                    captchaImage:       res.captcha_image ?? undefined,
                    captchaImageFormat: res.captcha_image_format ?? undefined,
                });
                return;
            case "ERROR":
            default: {
                setChallenge(null);
                // Prefer code-keyed i18n; gateway free-text is often
                // Korean and confuses non-KO users.
                const localized = lookupScrapingResultMessage(res.error_code, t);
                dialog.open({
                    type:        "error",
                    title:       t("dialog.error"),
                    description: localized ?? res.error_message ?? t("payment.card.update_cards.error.failed"),
                    errorCode:   res.error_code ?? "ERROR",
                });
                return;
            }
        }
    }, [dialog, onClose, onSuccess, t]);

    /** Wrap a card-sync API call so a thrown ApiCallError surfaces through
     *  the same error dialog the ERROR-status branch uses. */
    const runStep = useCallback(async (step: () => Promise<ApiCardSyncSessionResponse>) => {
        setInFlight(true);
        try {
            handleResponse(await step());
        } catch (err) {
            setChallenge(null);
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
        } finally {
            setInFlight(false);
        }
    }, [dialog, handleResponse, t]);

    const handleFromChange = useCallback((iso: string) => {
        setFromIso(iso);
        if (iso > toIso) setToIso(iso);
    }, [toIso]);

    const handleToChange = useCallback((iso: string) => {
        setToIso(iso);
        if (iso < fromIso) setFromIso(iso);
    }, [fromIso]);

    const handleUpdate = useCallback(() => {
        if (inFlight) return;
        const fromYyyymmdd = isoToYyyymmdd(fromIso);
        const toYyyymmdd   = isoToYyyymmdd(toIso);
        submittedRange.current = { fromDt: fromYyyymmdd, toDt: toYyyymmdd };
        nxisasDebug("nxisasObj", {
            flowType: "CARD_UPDATE_TRANSACTIONS",
            auto,
            from: auto ? undefined : fromYyyymmdd,
            to:   auto ? undefined : toYyyymmdd,
        });
        void runStep(() =>
            startCardSyncSession({
                from_date: fromYyyymmdd,
                to_date:   toYyyymmdd,
                auto,
            }),
        );
    }, [auto, fromIso, inFlight, runStep, toIso]);

    return (
        <>
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next && !inFlight) onClose();
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
                                auto && "pointer-events-none opacity-60",
                            )}
                            aria-disabled={auto}
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
                            className="inline-flex cursor-pointer items-center gap-1.5 text-wb-14 font-medium leading-4 text-wb-ink"
                        >
                            <Checkbox
                                id="update-cards-auto"
                                checked={auto}
                                onCheckedChange={(v) => setAuto(v === true)}
                                disabled={inFlight}
                            />
                            <span>{t("payment.card.update_cards.auto")}</span>
                        </label>
                    </div>

                    {/* Blue helper text — legacy "auto setting" hint. */}
                    <p className="text-wb-13 font-medium leading-4 text-brand">
                        {t("payment.card.update_cards.helper")}
                    </p>

                    {/* Idle / progress bar — indeterminate while scraping. */}
                    <ProgressBar inFlight={inFlight} />

                    {/* Footer — Cancel + Update right-aligned. */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={inFlight}
                            className="flex h-9 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={handleUpdate}
                            disabled={inFlight}
                            className={cn(
                                "flex h-9 cursor-pointer items-center justify-center rounded-md px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn",
                                inFlight
                                    ? "cursor-not-allowed bg-wb-ntrl-4 shadow-none"
                                    : "bg-brand hover:bg-brand-hover",
                            )}
                        >
                            {inFlight
                                ? t("payment.card.update_cards.updating")
                                : t("payment.card.update_cards.update")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* ── Challenge dialogs — the same components Login Credentials /
            Bank Transaction Sync use. On submit each resumes the card
            session; the response loops back through handleResponse. ── */}
        {challenge?.kind === "QNA" && (
            <QnaDialog
                bankName={challenge.bankName ?? ""}
                loginId={challenge.loginId ?? ""}
                questions={challenge.qnaQuestions ?? []}
                onSubmit={(payload) => {
                    const sessionId = challenge.sessionId;
                    setChallenge(null);
                    return runStep(() =>
                        submitCardSyncQna(sessionId, {
                            question:     payload.question,
                            hidden_value: payload.hidden_value,
                            answer:       payload.answer,
                        }),
                    );
                }}
                onCancel={() => setChallenge(null)}
            />
        )}
        {challenge?.kind === "OTP" && (
            <OtpDialog
                prompt={challenge.prompt}
                onSubmit={(value) => {
                    const sessionId = challenge.sessionId;
                    setChallenge(null);
                    return runStep(() => submitCardSyncOtp(sessionId, value));
                }}
                onCancel={() => setChallenge(null)}
            />
        )}
        {challenge?.kind === "CAPTCHA" && (
            <CaptchaDialog
                image={challenge.captchaImage ?? ""}
                format={challenge.captchaImageFormat ?? "png"}
                onSubmit={(value) => {
                    const sessionId = challenge.sessionId;
                    setChallenge(null);
                    return runStep(() => submitCardSyncCaptcha(sessionId, value));
                }}
                onCancel={() => setChallenge(null)}
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

/** Idle progress strip — flips to an indeterminate pulse while inFlight. */
function ProgressBar({ inFlight }: { inFlight: boolean }) {
    return (
        <div className="h-8 w-full overflow-hidden rounded-md border border-wb-border-sidebar bg-[#f5f5f5]">
            {inFlight && (
                <div className="h-full w-1/3 animate-pulse rounded-md bg-brand/60" />
            )}
        </div>
    );
}

/* --------------------------------------------------------------------
 *  Pure helpers
 * ------------------------------------------------------------------ */

/**
 * Default Auto Date Range for the Update Cards popup — Start = the
 * EARLIEST {@code TRN_LST_SUC_DTM} across the active cards (so one batch
 * window covers every card; matches the backend's
 * {@code min(TRN_LST_SUC_DTM)} Auto computation), End = today. When no
 * card has ever synced, fall back to today − 90 days (the backend's
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
