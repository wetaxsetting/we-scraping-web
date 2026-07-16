"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { History as HistoryIcon } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import InfoIcon from "@/components/shared/InfoIcon";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import Tooltip from "@/components/shared/Tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { useDialog } from "@/components/shared/dialog";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { formatAmount } from "@/lib/currency";
import {
    ApiCallError,
    syncTransactions,
    fetchSyncStatus,
    submitSyncQna,
    submitSyncOtp,
    submitSyncCaptcha,
    cancelSync,
    cancelSyncChallenge,
} from "@/lib/api/banking";
import type { ApiSyncStatusResponse, ApiQnaQuestion } from "@/lib/types/api";
import { useTranslation } from "@/lib/i18n";
import { lookupScrapingResultMessage } from "@/lib/i18n/scrapingResultCodes";
import { nxisasDebug } from "@/lib/nxisas/nxisas-debug";
import { QnaDialog } from "@/app/(dashboard)/banking/credentials/QnaDialog";
import { OtpDialog } from "@/app/(dashboard)/banking/credentials/OtpDialog";
import { CaptchaDialog } from "@/app/(dashboard)/banking/credentials/CaptchaDialog";
import LatestTransactionHistoryModal, {
    type HistoryType,
} from "./LatestTransactionHistoryModal";
import SyncHistoryDialog from "./SyncHistoryDialog";

/**
 * One selected account passed into the popup from Account Inquiry. The
 * dialog needs enough to render the per-currency totals block + ship the
 * natural keys to the backend; `currencyCd` drives the per-currency
 * grouping (legacy WeCMS groups `Credit` / `Debit` lines by currency).
 */
export type SyncSelectedAccount = {
    id: string;
    bankCd: string;
    bankName: string;
    accountNo: string;
    currencyCd?: string;
    /** This account's transaction-last-success timestamp
     *  (`TRN_LST_SUC_DTM`, compact `yyyyMMddHHmmss`) — the window source
     *  legacy `nxisas_tranList.getInitStartDate()` reads. Seeds the popup's
     *  default Date Range start (earliest across the selection, floored to
     *  3 months back). NOTE: this is NOT the Account Inquiry "Last Update"
     *  column (`ACCT_BAL_LST_INQ_DTM`) — feeding that here produced a
     *  too-narrow window. Empty / undefined when the account has never
     *  completed a transaction scrape → the popup falls back to 3 months. */
    lastSync?: string;
};

/**
 * Status-poll interval (Phase 2). The frontend polls the backend
 * {@code /status} endpoint at this cadence for real per-account progress
 * (0 → 25 → 35 → 50 → 100) — no client-side timers simulate progress; the
 * bar reflects only backend-reported values. 750ms sits inside the
 * task-mandated 500–1000ms band. Polling is a guarded recursive timeout
 * (never overlapping requests).
 */
const POLL_INTERVAL_MS = 750;

type Props = {
    /** Selected rows from Account Inquiry — at least 1 by the time this opens. */
    selectedAccounts: SyncSelectedAccount[];
    /** Tenant's bank list (legacy `BANK_CD` + display name). Forwarded
     *  to the sync-history popup so its bank dropdown matches the
     *  Account Inquiry filter. When omitted, the popup renders only
     *  the "All Banks" option — usable but limits filtering. */
    availableBanks?: Array<{ bankCd: string; bankName: string }>;
    /** Currency scope of the parent Account Inquiry page — "VND" /
     *  "FCY" / a concrete code. Forwarded to the sync-history popup so
     *  it returns only rows matching the page's currency. Defaults to
     *  "ALL" when omitted. */
    currency?: string;
    /** Close the dialog (clears `open` on the parent). */
    onClose: () => void;
    /**
     * Fired after a successful sync — the parent refetches the list so the
     * "Last Update" column reflects the new timestamp.
     */
    onSyncComplete: () => void;
};

/**
 * Bank Transaction Sync popup — Account Inquiry "Update" button entry.
 * Layout mirrors the legacy WeCMS `fnsh_0001_001` popup (image 2 of the
 * design handoff): Settings / History buttons sit at the top-right above
 * a Date Range row with a red "required" dot on the label; the Selected
 * count is centered; bank accounts group by currency with a "BANK
 * ACCOUNTS ({ccy})" header followed by `Credit` / `Debit` total lines;
 * the Sync primary button is a full-width pill in the body; the
 * "Close popup automatically" checkbox sits below a separator with no
 * Cancel button (X is the only dismiss).
 *
 * <p><strong>R&D stub.</strong> The Sync button calls the refactor's
 * stub endpoint which only bumps the per-account audit timestamps
 * (`LST_LGN_SUC_DTM` + `ACCT_BAL_LST_INQ_DTM`). Per-currency
 * Credit / Debit totals render as `0 transaction(s) / 0đ` — they
 * become meaningful only when the real NXISAS pipeline lands
 * (out of refactor R&D scope per workspace CLAUDE.md).
 *
 * `stackLevel={1}` (root) — opens directly from Account Inquiry.
 */
export default function TransactionSyncDialog({
    selectedAccounts,
    availableBanks = [],
    currency = "ALL",
    onClose,
    onSyncComplete,
}: Props) {
    const { t } = useTranslation();
    const dialog = useDialog();

    // Default Date Range = the selected accounts' last successful sync →
    // today (legacy fnsh_0001_001 #acct_Reg: each account scrapes from its
    // own last-success, so a re-sync only pulls new transactions). With a
    // single batch range we use the EARLIEST last-success across the
    // selection so the window covers every account; accounts that never
    // synced fall back to the last-30-days window. Both chips open the
    // shared DateField calendar so the user can still override either end.
    const defaultRange = useMemo(
        () => defaultSyncRange(selectedAccounts),
        [selectedAccounts],
    );
    const [startIso, setStartIso] = useState(defaultRange.startIso);
    const [endIso, setEndIso] = useState(defaultRange.endIso);

    const [auto, setAuto] = useState(true);
    const [autoClose, setAutoClose] = useState(false);
    const [pending, setPending] = useState(false);

    /** Determinate progress-bar value (0–100). Driven entirely by the
     *  backend status poll (Phase 2) — real per-account milestones
     *  0 → 25 → 35 → 50 → 100, never a client-side timer. Monotonic:
     *  {@link applyStatus} never lets it decrease. */
    const [progress, setProgress] = useState(0);

    /** True when the last sync attempt ended in ERROR / network failure —
     *  flips the determinate fill to the red token (e-Invoice parity).
     *  Reset when a fresh sync starts or the user cancels. */
    const [syncFailed, setSyncFailed] = useState(false);

    /** Live processed / total account counts from the backend status —
     *  drive the "{done}/{total} Accounts" row (never a hardcoded 0). A
     *  failed account increments {@code completedAccounts} once it is fully
     *  processed. */
    const [completedAccounts, setCompletedAccounts] = useState(0);
    const [totalAccounts, setTotalAccounts] = useState(selectedAccounts.length);

    /* Sticky mirror of `pending` — keeps the Cancel / progress
     * chrome visible for the minimum-visibility window so a fast
     * sync resolution doesn't flicker Sync → Cancel → Sync in under
     * a perceptual frame. The functional guard (`pending`) inside
     * the handler still blocks duplicate `handleSync` calls before
     * the sticky flag flips. */
    const stickyPending = useStickyLoading(pending);

    /** Latest server-issued sync session id — set from the immediate start
     *  response (Phase 2) and used by every poll / resume / cancel call.
     *  The poll loop ignores any status whose {@code session_id} ≠ this
     *  (stale response / reopened dialog). Reset on each fresh run + cancel. */
    const sessionIdRef = useRef<string | null>(null);

    /** Guarded recursive poll timer + mounted flag — guarantees no overlapping
     *  status requests and no timers / state updates after unmount. */
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    /** True while a cancel / close confirmation dialog is open. Polling is
     *  paused for the whole time it is open, and any in-flight poll response
     *  that resolves meanwhile is ignored — so a background COMPLETED / FAILED
     *  can never replace the open confirmation with a completion / error dialog
     *  (the cancel-vs-completion race, audit D2). Cleared on Yes and on No. */
    const cancelConfirmOpenRef = useRef(false);

    /** Set the moment a terminal outcome (COMPLETED / FAILED / CANCELLED, or a
     *  user-confirmed cancel) is accepted. Guarantees the terminal dialog fires
     *  exactly once, blocks a late/stale response from re-opening it, and
     *  prevents a confirmed cancel from being undone by an in-flight terminal.
     *  Reset only by a fresh {@link runSync}. */
    const terminalHandledRef = useRef(false);

    /** Monotonic run token. Bumped on every fresh start AND on cancel so an
     *  in-flight start / resume promise from a superseded (or cancelled) run
     *  cannot apply its response once it finally resolves — the poll loop's own
     *  guard is the session-id compare, but the start / resume legs have no
     *  session id yet, so they compare this generation instead. */
    const syncGenerationRef = useRef(0);

    /** Latest-Transaction-History modal state — opens from the
     *  per-row "View" link inside the BANK ACCOUNTS block after a
     *  successful sync. {@code selectedHistoryType} captures which
     *  link was clicked (Credit vs. Debit) so the popup can render the
     *  matching list + footer label. */
    const [latestHistoryOpen, setLatestHistoryOpen] = useState(false);
    const [selectedHistoryType, setSelectedHistoryType] =
        useState<HistoryType>("CREDIT");
    /** Currency-group the user clicked View on. Passed to the modal so
     *  it queries only the matching accounts (a multi-currency batch
     *  has one View link per group; mixing groups would put USD totals
     *  under a VND footer). */
    const [selectedHistoryGroup, setSelectedHistoryGroup] =
        useState<string | null>(null);

    /** Sync-history-audit dialog state — opens from the top-right
     *  "History" button. Shows past *scrape attempts* (one row per
     *  inquiry call) sourced from {@code EXT_TRAN_CALL_HIS}. Distinct
     *  surface from {@link historyOpen} which lists transactions. */
    const [syncHistoryOpen, setSyncHistoryOpen] = useState(false);

    /** The actual {from, to} window the backend scraped — captured at
     *  request time so the History dialog reflects what was scraped,
     *  not what the (possibly disabled) chip shows. When Auto is on
     *  the chip is read-only and may not match the backend's 30-day
     *  default; this state is the authoritative window. */
    const [effectiveWindow, setEffectiveWindow] = useState<{
        start: string;
        end:   string;
    }>({ start: defaultRange.startIso, end: defaultRange.endIso });

    /** Per-sync success tally — drives the inline "Success N / Failed M
     *  Accounts" header AND the per-row Credit/Debit count + amount
     *  rendered inside the BANK ACCOUNTS block after a COMPLETED sync.
     *  {@code null} = no completed run yet. Single-currency aggregate
     *  (the backend sends one debit_total / credit_total across the
     *  batch; multi-currency batches are an edge case that would need
     *  a richer per-currency wire shape, deferred). */
    const [completionTally, setCompletionTally] = useState<{
        success:     number;
        failed:      number;
        debitCount:  number;
        creditCount: number;
        debitTotal:  number;
        creditTotal: number;
    } | null>(null);

    /** Per-currency result roll-up keyed by uppercase currency code
     *  ("USD" / "KRW" / "VND"). Sourced from the backend's
     *  `currency_summaries` on COMPLETED so each BANK ACCOUNTS ({ccy})
     *  group renders its OWN account tally + Credit / Debit counts and
     *  totals — never the batch aggregate restated under every currency.
     *  Empty until a sync completes; a currency absent from the map
     *  renders as 0 / 0. */
    const [currencySummaries, setCurrencySummaries] = useState<
        Record<string, CurrencySummaryView>
    >({});

    /** Whether the tenant's auto-match gate (biz-env 00079) is on — read from
     *  the COMPLETED response. Drives whether each BANK ACCOUNTS ({ccy}) group
     *  renders the "Debit Matched" row (legacy `_autoMatchEnv !== "N"` guard).
     *  A 0 `debitMatched` alone can't distinguish "disabled" from "nothing
     *  matched", so the flag gates the row's visibility. */
    const [autoMatchEnabled, setAutoMatchEnabled] = useState(false);

    /** Per-account failures that did NOT abort the batch (LOGIN_CAN
     *  challenge-cancels) — sourced from the COMPLETED response's
     *  `failed_account_details`. Drives the per-currency "Failed M" hover
     *  tooltip ("[bank acct] {localized message} (LOGIN_CAN)"). Empty until a
     *  batch with a cancelled login completes. */
    const [failedAccountDetails, setFailedAccountDetails] = useState<
        FailedAccountDetailView[]
    >([]);

    // Group selected accounts by currency. Legacy popup shows one
    // "BANK ACCOUNTS (CCY)" block per distinct currency. VND-only
    // selection collapses to a single block, matching the screenshot.
    const groups = useMemo(() => groupByCurrency(selectedAccounts), [selectedAccounts]);

    /** Date Range area is locked from the moment a sync starts and
     *  stays locked after it completes — the result tally is anchored
     *  to the scraped window, so allowing the user to change the dates
     *  afterwards would desync the "Success N / Failed M Accounts"
     *  summary from the data it describes. Combined with the existing
     *  Auto-checkbox rule (Auto = backend picks the window) at the
     *  control-level disabled prop. */
    const dateRangeLocked = stickyPending || completionTally !== null;

    /** Active challenge requested by the backend. `null` means no
     *  challenge is in flight; one of the {@link QnaDialog} /
     *  {@link OtpDialog} / {@link CaptchaDialog} renders when it's set. */
    const [challenge, setChallenge] = useState<{
        sessionId: string;
        kind: "QNA" | "OTP" | "CAPTCHA";
        prompt: string;
        qnaQuestions?: ApiQnaQuestion[];
        captchaImage?: string;
        captchaImageFormat?: string;
        /** Registered bank Login ID, echoed back by the backend on
         *  QNA_REQUIRED so the Security Question popup can display it
         *  next to the bank name. Empty string when the backend omitted
         *  the field (defensive — should not happen for QNA today). */
        loginId?: string;
    } | null>(null);

    /** Bank display name for the active challenge — sourced from the
     *  selected accounts so the QNA dialog header reads "Shinhan VN"
     *  instead of a code. */
    const challengeBankName = useMemo(() => {
        // The sync orchestrator processes the queue head first; if a
        // challenge fires, it belongs to whichever account's bank is
        // currently being scraped. The dialog list is small (1-N) so
        // a linear scan is fine.
        if (!challenge) return "";
        return selectedAccounts[0]?.bankName ?? "";
    }, [challenge, selectedAccounts]);

    // Mounted flag + poll-timer cleanup — no state updates or timers survive
    // unmount (dialog closed, parent re-keyed on reopen). The timer clear is
    // inlined (not via stopPolling) so the effect references only refs that
    // are already declared above it.
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

    /**
     * Apply a backend status snapshot to the UI (Phase 2). Progress is
     * monotonic (never rewinds). Branches on `status`: RUNNING keeps the poll
     * loop going; `*_REQUIRED` opens the matching challenge dialog (polling
     * pauses until the user submits); COMPLETED / FAILED / CANCELLED are
     * terminal. Shared by the start response, the poll loop, and each resume
     * response — the single place status turns into UI.
     */
    function applyStatus(res: ApiSyncStatusResponse) {
        if (res.session_id) sessionIdRef.current = res.session_id;
        // Progress + counters come straight from the backend; never decrease
        // the displayed progress (guards out-of-order polls / resume).
        if (typeof res.progress === "number") {
            const next = res.progress;
            setProgress((p) => (next > p ? next : p));
        }
        setCompletedAccounts(res.completed_accounts ?? 0);
        if (typeof res.total_accounts === "number" && res.total_accounts > 0) {
            setTotalAccounts(res.total_accounts);
        }

        switch (res.status) {
            case "RUNNING":
                setChallenge(null);
                return;
            case "OTP_REQUIRED":
            case "QNA_REQUIRED":
            case "CAPTCHA_REQUIRED": {
                const kind =
                    res.status === "OTP_REQUIRED" ? "OTP"
                    : res.status === "QNA_REQUIRED" ? "QNA" : "CAPTCHA";
                const ch = res.challenge;
                nxisasDebug("run2ndCert obj", {
                    challengeType: kind,
                    traceId: res.session_id,
                    bankName: selectedAccounts[0]?.bankName,
                });
                setChallenge({
                    sessionId: res.session_id ?? sessionIdRef.current ?? "",
                    kind,
                    prompt: ch?.prompt ?? "",
                    qnaQuestions: ch?.qna_questions ?? undefined,
                    captchaImage: ch?.captcha_image ?? undefined,
                    captchaImageFormat: ch?.captcha_image_format ?? undefined,
                    loginId: ch?.login_id ?? "",
                });
                return;
            }
            case "COMPLETED": {
                if (terminalHandledRef.current) return; // terminal already handled — show once
                terminalHandledRef.current = true;
                setChallenge(null);
                setProgress(100);
                onSyncComplete(); // refresh the inquiry list behind the popup
                const success = res.accounts_synced ?? res.success_accounts ?? 0;
                const failed = res.failed_accounts ?? 0;
                setCompletionTally({
                    success,
                    failed,
                    debitCount:  res.debit_count  ?? 0,
                    creditCount: res.credit_count ?? 0,
                    debitTotal:  Number(res.debit_total  ?? "0"),
                    creditTotal: Number(res.credit_total ?? "0"),
                });
                const summaries: Record<string, CurrencySummaryView> = {};
                for (const s of res.currency_summaries ?? []) {
                    summaries[(s.ccy_cd ?? "").toUpperCase()] = {
                        success:     s.success_count ?? 0,
                        failed:      s.failed_count  ?? 0,
                        creditCount: s.credit_count  ?? 0,
                        debitCount:  s.debit_count   ?? 0,
                        creditTotal: Number(s.credit_total ?? "0"),
                        debitTotal:  Number(s.debit_total  ?? "0"),
                        debitMatched: s.auto_matched_count ?? 0,
                    };
                }
                setCurrencySummaries(summaries);
                setFailedAccountDetails(
                    (res.failed_account_details ?? []).map((d) => ({
                        bankCd:       d.bank_cd,
                        acctNo:       d.acct_no,
                        currency:     (d.ccy_cd ?? "").toUpperCase(),
                        errorCode:    d.error_code ?? "",
                        errorMessage: d.error_message ?? "",
                    })),
                );
                setAutoMatchEnabled(res.auto_match_enabled === true);
                setPending(false);
                showCompletionDialog(success, failed);
                if (autoClose) onClose();
                return;
            }
            case "FAILED": {
                if (terminalHandledRef.current) return; // terminal already handled — show once
                terminalHandledRef.current = true;
                setChallenge(null);
                setSyncFailed(true);   // red bar
                setProgress(100);
                setPending(false);
                const localized = lookupScrapingResultMessage(res.error_code, t);
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: localized ?? res.error_message ?? t("dialog.error"),
                    errorCode: res.error_code ?? "ERROR",
                });
                return;
            }
            case "CANCELLED":
                if (terminalHandledRef.current) return; // already handled — no double reset
                terminalHandledRef.current = true;
                resetAfterCancel();
                return;
        }
    }

    /** Stop the poll loop (idempotent). */
    function stopPolling() {
        if (pollTimerRef.current !== null) {
            clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }

    /** Schedule the next guarded poll (no overlap — always cleared first). */
    function scheduleNextPoll() {
        stopPolling();
        pollTimerRef.current = setTimeout(() => void pollOnce(), POLL_INTERVAL_MS);
    }

    /** One poll: fetch status, ignore stale / post-unmount responses, apply,
     *  and re-arm only while RUNNING (challenge / terminal stop the loop). */
    async function pollOnce() {
        pollTimerRef.current = null;
        const sid = sessionIdRef.current;
        if (!sid || !mountedRef.current) return;
        // Paused for an open cancel confirmation, or a terminal already handled —
        // don't fetch, don't apply, don't reschedule.
        if (cancelConfirmOpenRef.current || terminalHandledRef.current) return;
        let res: ApiSyncStatusResponse;
        try {
            res = await fetchSyncStatus(sid);
        } catch (err) {
            // A confirmation opened (or a terminal was applied) while this poll
            // was in flight — swallow so a network error can't replace either.
            if (!mountedRef.current || cancelConfirmOpenRef.current || terminalHandledRef.current) return;
            terminalHandledRef.current = true;
            setSyncFailed(true);
            setProgress(100);
            setPending(false);
            const code = err instanceof ApiCallError ? err.code : "NETWORK";
            const msg =
                err instanceof ApiCallError ? err.message
                : err instanceof Error ? err.message
                : t("dialog.error");
            dialog.open({ type: "error", title: t("dialog.error"), description: msg, errorCode: code });
            return;
        }
        // Stale-response guard: a newer session started or the dialog moved on.
        if (!mountedRef.current || res.session_id !== sessionIdRef.current) return;
        // A confirmation opened, or a terminal was applied, while this poll was in
        // flight — ignore this snapshot so it can't override either.
        if (cancelConfirmOpenRef.current || terminalHandledRef.current) return;
        applyStatus(res);
        if (res.status === "RUNNING") scheduleNextPoll();
    }

    /** Consume a challenge-resume response: apply it, then resume polling if
     *  the backend went back to RUNNING. Clears the challenge dialog first. */
    function resumeChallenge(promise: Promise<ApiSyncStatusResponse>) {
        // Capture the run token so a resume that resolves after a cancel /
        // supersede is ignored (the resume leg has no session id to compare yet).
        const gen = syncGenerationRef.current;
        setChallenge(null);
        return promise
            .then((res) => {
                if (!mountedRef.current || gen !== syncGenerationRef.current) return;
                if (terminalHandledRef.current) return;
                applyStatus(res);
                if (res.status === "RUNNING") scheduleNextPoll();
            })
            .catch((err) => {
                if (!mountedRef.current || gen !== syncGenerationRef.current) return;
                if (terminalHandledRef.current) return;
                terminalHandledRef.current = true;
                setSyncFailed(true);
                setProgress(100);
                setPending(false);
                const code = err instanceof ApiCallError ? err.code : "NETWORK";
                const msg =
                    err instanceof ApiCallError ? err.message
                    : err instanceof Error ? err.message
                    : t("dialog.error");
                dialog.open({ type: "error", title: t("dialog.error"), description: msg, errorCode: code });
            });
    }

    /** Information dialog after a COMPLETED sync (Figma "Information /
     *  The synchronization has been finished. Success N / Failed M
     *  account(s)."). Routes through {@code useDialog} as a "success"
     *  variant — the icon is a blue check, which matches the Figma's
     *  blue ⓘ closely enough to stay inside the four sanctioned dialog
     *  types per CLAUDE.md. Close dismisses the dialog; the per-row
     *  "View" link on the BANK ACCOUNTS block is now the canonical
     *  entry to the Latest Transaction History popup. */
    function showCompletionDialog(success: number, failed: number) {
        dialog.open({
            type: "success",
            title: t("account_inquiry.sync.completion_title"),
            description: t("account_inquiry.sync.completion_message", {
                success: String(success),
                failed:  String(failed),
            }),
            confirmText: t("dialog.close"),
        });
    }

    /** Cancel button — abort the in-flight fetch + reset progress.
     *  Note: this does NOT stop the bank-side Coocon scrape (the
     *  gateway call is already in flight server-side); it only drops
     *  the frontend's wait. Mirrors the legacy progress-widget Cancel
     *  which also only closes the local UI. */
    /**
     * Open a cancel / close confirmation. Shared by the main-popup Cancel, the
     * main-popup X (while scraping), and all three challenge (QNA/OTP/CAPTCHA)
     * Cancel/X paths — one flow, no duplicated cancellation logic.
     *
     * Polling is PAUSED for the whole time the confirmation is open (audit D2):
     * `cancelConfirmOpenRef` blocks the poll loop from applying a background
     * COMPLETED/FAILED, so the completion/error dialog can never replace this
     * confirmation. On "No" polling resumes only if the run is still live +
     * current + not on a challenge + not already terminal. On "Yes" the whole
     * sync session is cancelled via {@link doCancel} and `onConfirmed` runs
     * (e.g. close the popup for the X path).
     */
    function openCancelConfirm(descriptionKey: string, afterReset?: () => void) {
        cancelConfirmOpenRef.current = true;
        stopPolling();
        dialog.open({
            type: "confirmation",
            title: t("dialog.confirmation"),
            description: t(descriptionKey),
            confirmText: t("dialog.yes"),
            cancelText: t("dialog.no"),
            onConfirm: () => {
                cancelConfirmOpenRef.current = false;
                doCancel(afterReset);
            },
            onCancel: () => {
                // "No" — keep scraping. Resume the poll loop only when it is safe:
                // still mounted, no terminal already applied, a live session id,
                // and NOT sitting on a challenge (challenge state pauses polling
                // until the user answers, so we must not re-arm it here).
                cancelConfirmOpenRef.current = false;
                if (!mountedRef.current || terminalHandledRef.current) return;
                if (!sessionIdRef.current || challenge) return;
                scheduleNextPoll();
            },
        });
    }

    /** Main-popup Cancel button — confirm (legacy WBC1153), then cancel the
     *  WHOLE session and show the "The inquiry has been canceled." Information
     *  dialog; on OK reset to READY. */
    function handleCancel() {
        openCancelConfirm("account_inquiry.sync.cancel_confirm");
    }

    /**
     * Cancel / X from a QNA, OTP, or CAPTCHA challenge popup.
     *
     * <p><strong>Legacy parity (§15 Case 2):</strong> this is an ACCOUNT-LEVEL
     * cancel — it fails ONLY the current account's bank login ({@code LOGIN_CAN})
     * and the batch CONTINUES with the remaining accounts, finishing normally
     * with a "Success X / Failed Y" summary. It is <b>NOT</b> a whole-session
     * cancel — it never calls {@link doCancel} / the {@code /cancel} endpoint.
     * The confirmation is the legacy WBC1152 "quit the inquiry for {bank}?"; on
     * "No" the challenge dialog stays open to answer; on "Yes" the backend
     * account-level {@code /challenge-cancel} runs and polling resumes.
     */
    function handleChallengeCancel() {
        // Pause polling while the confirmation is open (during a challenge it is
        // already parked; stopPolling is a safe no-op). This is NOT a
        // whole-session cancel, so cancelConfirmOpenRef is left alone — the
        // challenge dialog stays open behind the confirmation.
        stopPolling();
        dialog.open({
            type: "confirmation",
            title: t("dialog.confirmation"),
            description: t("account_inquiry.sync.challenge_cancel_confirm", {
                bank: challengeBankName || t("account_inquiry.sync.this_bank"),
            }),
            confirmText: t("dialog.yes"),
            cancelText: t("dialog.no"),
            onConfirm: doChallengeCancel,
            // "No" → keep the challenge popup open to answer (no-op).
        });
    }

    /** Perform the account-level challenge cancel: fail the current bank login
     *  ({@code LOGIN_CAN}) on the backend and resume polling so the batch
     *  finishes. Reuses {@link resumeChallenge} (clears the challenge dialog,
     *  applies the RUNNING snapshot, re-arms polling) — the backend never marks
     *  the session CANCELLED, so this continues, it does not reset. */
    function doChallengeCancel() {
        const sid = challenge?.sessionId ?? sessionIdRef.current;
        if (!sid) {
            setChallenge(null);
            return;
        }
        void resumeChallenge(cancelSyncChallenge(sid));
    }

    /** Perform the cancel: best-effort server `/cancel` (only reachable once
     *  the backend has handed us a session id — challenge round-trips in the
     *  synchronous flow; every request once Phase 2 lands), then abort the
     *  client fetch + reset. Server errors are swallowed so the local
     *  teardown always succeeds and the user is never stuck on a running
     *  popup. */
    function doCancel(afterReset?: () => void) {
        cancelConfirmOpenRef.current = false;
        // If a real terminal (COMPLETED/FAILED) was already accepted before the
        // user confirmed, do NOT reset the UI as though cancellation won — the
        // terminal result stands (audit precedence).
        if (terminalHandledRef.current) return;
        terminalHandledRef.current = true;
        // Invalidate any in-flight start / resume promise so it can't resurrect
        // the popup after we tear it down.
        syncGenerationRef.current += 1;
        stopPolling(); // stop the poll loop immediately
        const sid = sessionIdRef.current;
        if (sid) {
            // Universal in Phase 2 — the session id is known from the start
            // response. Best-effort: the local teardown below always runs.
            void cancelSync(sid).catch(() => {});
        }
        // Legacy WBI1123: after the whole-session cancel, show the "The inquiry
        // has been canceled." Information dialog; on OK reset to READY (and, for
        // the X path, close). NOT the completion "Success/Failed" summary.
        // Deferred to a microtask so this dialog is opened AFTER the confirmation
        // dialog's own dismissal — `useDialog` shows one dialog at a time and the
        // confirmation's onConfirm runs before its dismiss, which would otherwise
        // clobber the dialog we open here.
        queueMicrotask(() => {
            if (!mountedRef.current) return;
            dialog.open({
                type: "success",
                title: t("account_inquiry.sync.completion_title"),
                description: t("account_inquiry.sync.cancel_success"),
                confirmText: t("dialog.close"),
                onConfirm: () => {
                    resetAfterCancel();
                    afterReset?.();
                },
            });
        });
    }

    /** Tear down to the idle state after a cancel (or a server CANCELLED
     *  status). Mirrors the e-Invoice modal's `resetToReady`. */
    function resetAfterCancel() {
        stopPolling();
        setPending(false);
        setChallenge(null);
        setProgress(0);        // reset the determinate bar to the empty track
        setSyncFailed(false);
        setCompletedAccounts(0);
        sessionIdRef.current = null;
    }

    /** Close (X) handling: mid-scrape → confirm, then cancel + close;
     *  otherwise close immediately. Mirrors the e-Invoice modal's
     *  close-while-scraping confirm. */
    function handleRequestClose() {
        if (stickyPending) {
            // Same paused-polling whole-session cancel + WBI1123 acknowledgement
            // as Cancel; after the user closes the Information dialog, close the
            // popup AND refresh the parent Account Inquiry list (legacy X reloads
            // the parent grid). On No keep scraping (polling resumes).
            openCancelConfirm("account_inquiry.sync.close_confirm", () => {
                onSyncComplete();
                onClose();
            });
            return;
        }
        onClose();
    }

    /** Fire the start POST (async) and begin polling. Returns immediately
     *  after the RUNNING snapshot; the poll loop drives progress to terminal. */
    async function runSync() {
        // Fresh run — reset the determinate bar + counters + cancel/terminal
        // guards before start, and take a new run token so any stale in-flight
        // promise from a prior (cancelled / superseded) run is ignored.
        stopPolling();
        cancelConfirmOpenRef.current = false;
        terminalHandledRef.current = false;
        const gen = (syncGenerationRef.current += 1);
        setSyncFailed(false);
        setProgress(0);
        setCompletedAccounts(0);
        setTotalAccounts(selectedAccounts.length);
        setCompletionTally(null);
        setFailedAccountDetails([]);
        sessionIdRef.current = null;
        setPending(true);

        // Capture the effective {from, to} window for the post-sync Latest
        // Transaction History popup. This is the SAME single batch window
        // the scrape uses (sent verbatim below and applied to every account
        // by the backend), so the Credit/Debit counts and the history list
        // always describe the same window — legacy parity
        // (nxisas_tranHistory.js:80-81 seeds its dates from the scrape
        // popup's own date fields). The History dialog reads
        // `effectiveWindow`, not live chip state (which may change between
        // sync and open).
        setEffectiveWindow({ start: startIso, end: endIso });

        // Legacy `nxisas_api.js` parity — log the business-layer request
        // object (orgObj) and the transformed scrape object (nxisasObj)
        // before dispatch. Masked + gated by NEXT_PUBLIC_NXISAS_DEBUG.
        nxisasDebug("orgObj", selectedAccounts.map((a) => ({
            bankCd: a.bankCd,
            bankName: a.bankName,
            acctNo: a.accountNo,
            currencyCd: a.currencyCd,
        })));
        nxisasDebug("nxisasObj", {
            flowType: "SYNC",
            accounts: selectedAccounts.length,
            auto,
            from: startIso,
            to: endIso,
        });

        try {
            const res = await syncTransactions({
                accounts: selectedAccounts.map((a) => ({
                    bank_cd: a.bankCd,
                    acct_no: a.accountNo,
                })),
                // Legacy parity: the popup ALWAYS sends a concrete window
                // (nxisas_tranList scrapes `.setDate`/`.setDate1` for every
                // account). "Auto" only locks the chips to the computed
                // default window — it never means "let the backend pick its
                // own per-account window". Sending the window here makes the
                // backend use ONE batch window for all accounts, so the
                // completion counts and the Latest Transaction History list
                // always agree.
                from_dt: startIso,
                to_dt: endIso,
                auto,
            });
            // Ignore if unmounted, superseded, cancelled mid-start, or a terminal
            // was already applied — never resurrect a torn-down popup.
            if (!mountedRef.current || gen !== syncGenerationRef.current || terminalHandledRef.current) return;
            // Start returns a RUNNING snapshot immediately; apply it, then poll.
            applyStatus(res);
            if (res.status === "RUNNING") scheduleNextPoll();
        } catch (err) {
            if (!mountedRef.current || gen !== syncGenerationRef.current || terminalHandledRef.current) return;
            terminalHandledRef.current = true;
            setSyncFailed(true);
            setProgress(100);
            setPending(false);
            const code = err instanceof ApiCallError ? err.code : "NETWORK";
            const msg =
                err instanceof ApiCallError ? err.message
                : err instanceof Error ? err.message
                : t("dialog.error");
            dialog.open({ type: "error", title: t("dialog.error"), description: msg, errorCode: code });
        }
    }

    async function handleSync() {
        if (pending || selectedAccounts.length === 0) return;

        // Legacy 92-day cap (nxisas_tranList.js line 220 parity). Auto
        // hands the window to the backend so the check only applies
        // when the user picked the range. Backend revalidates regardless
        // — this is a UX fast-path, not the security boundary.
        if (!auto && daysBetween(startIso, endIso) > 92) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("account_inquiry.sync.range_too_long"),
                errorCode: "WBE_VALIDATION",
            });
            return;
        }

        // No back-dated confirmation. The live legacy fnsh_0001_001
        // #acct_Reg flow scrapes directly with no such prompt — the
        // WBC1107 confirm lived only in the disabled `// stop use`
        // .select_acct handler (fnsh_0001_001.ts:380-469, returns at :382),
        // so it never ran. A back-dated start is the normal case here
        // (re-sync from the last-success date), not an accident to guard.
        await runSync();
    }

    return (
        <>
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) handleRequestClose();
            }}
        >
            <DialogContent
                stackLevel={1}
                className="max-w-[540px] rounded-2xl p-0"
                // The user is in control of dismissal — only the X
                // button or the auto-close checkbox can close this
                // popup. Outside-click and ESC dismissal are off so a
                // stacked system success / challenge dialog can't
                // bubble pointer events back here and inadvertently
                // close the parent (CLAUDE.md §"Modal stack —
                // interaction & close behaviour" rule 3).
                closeOnOutsideClick={false}
                closeOnEscape={false}
            >
                <div className="flex w-full flex-col px-5 py-6">
                    {/* ── Header ─────────────────────────────────────── */}
                    <div className="flex flex-col gap-0">
                        <DialogTitle asChild>
                            <h2 className="text-wb-16 font-semibold leading-[18px] text-wb-dark">
                                {t("account_inquiry.sync.title")}
                            </h2>
                        </DialogTitle>
                        {/* Subtitle hidden in legacy layout — keep an
                           a11y-only DialogDescription so Radix doesn't
                           warn about missing description. */}
                        <DialogDescription className="sr-only">
                            {t("account_inquiry.sync.subtitle")}
                        </DialogDescription>
                    </div>

                    {/* ── History — top-right above filter row.
                       Settings button retired: the only setting on
                       the legacy popup was the auto-close checkbox,
                       which already lives at the bottom of this
                       dialog, so a separate Settings surface is
                       redundant.
                       History opens the shared LatestTransactionHistory
                       popup against the current chip date range so
                       users can review transactions without running a
                       fresh sync. The post-sync auto-open from the
                       success-dialog flow still works the same way —
                       both paths route through the same dialog. */}
                    <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setSyncHistoryOpen(true)}
                            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                            aria-label={t("account_inquiry.sync.history")}
                        >
                            <HistoryIcon className="size-4" />
                            {t("account_inquiry.sync.history")}
                        </button>
                    </div>

                    {/* ── Date range row with red "required" dot + Auto ──── */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1 text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                            {t("account_inquiry.sync.date_range")}
                            <span className="text-wb-status-rejected-text" aria-hidden>
                                •
                            </span>
                        </span>
                        {/* Lock the Date Range chips, calendar popover,
                           and Auto checkbox the moment the sync starts —
                           and keep them locked after it completes — so
                           the user can't change the scrape window
                           between "Sync ran with X" and "View transactions
                           for X". Pre-existing rule: Auto-on already
                           disables the chips, since the backend picks
                           its own 30-day window. */}
                        <InteractiveDateRangePicker
                            startIso={startIso}
                            endIso={endIso}
                            onChange={({ start, end }) => {
                                setStartIso(start);
                                setEndIso(end);
                            }}
                            // Chip display: omit `formatValue` so the shared
                            // DateField default (`formatIsoDateByLanguage`)
                            // renders the picked date per active locale
                            // (EN DD-MMM-YYYY / KO YYYY-MM-DD / VI DD-MM-YYYY).
                            // Match the legacy WeCMS popup chrome: `~`
                            // between chips and the dual-month popover
                            // extends rightward from the start chip,
                            // mirroring Sync History. Without
                            // `expandRight` the popover would
                            // right-align under the calendar icon (icon
                            // sits in the dialog's left half here, so
                            // the popover would overflow to the left).
                            separator="~"
                            expandRight
                            portalled
                            disabled={auto || dateRangeLocked}
                        />
                        <label
                            className={`ml-2 inline-flex items-center gap-1.5 text-wb-14 font-medium leading-4 text-wb-ink ${
                                dateRangeLocked
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                            }`}
                        >
                            <Checkbox
                                checked={auto}
                                onCheckedChange={(v) => setAuto(v === true)}
                                disabled={dateRangeLocked}
                            />
                            <span>{t("account_inquiry.sync.auto")}</span>
                            <Tooltip
                                content={t("account_inquiry.sync.auto_tooltip")}
                                placement="top"
                                className="inline-flex"
                            >
                                <InfoIcon />
                            </Tooltip>
                        </label>
                    </div>

                    {/* ── Progress bar — determinate, single brand-blue fill
                       driven by the numeric `progress` state, mirroring the
                       Update e-Invoice Information modal
                       (UpdateEInvoiceModal.tsx). One fill element: solid
                       brand-blue for scraping AND completion (no olive-green
                       completion state, no color switch), turning red only on
                       failure. No sliding gradient / `w-1/3` / indeterminate
                       animation. The empty track stays #f5f5f5.

                       Phase 2: `progress` is REAL backend progress from the
                       `/status` poll (per-account 0 → 25 → 35 → 50 → 100),
                       applied monotonically — no client-side timer simulates
                       it. */}
                    <div className="mt-4 h-8 w-full overflow-hidden rounded-md border border-wb-border-sidebar bg-[#f5f5f5]">
                        <div
                            data-testid="sync-progress-fill"
                            aria-hidden
                            className={`h-full transition-[width] duration-300 ${
                                syncFailed
                                    ? "bg-wb-status-rejected-text"
                                    : "bg-brand"
                            }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* ── Status row — three visual states:
                       (1) idle       → "Selected N Account(s)";
                       (2) pending    → "In Progress 0/N Accounts";
                       (3) completed  → hidden (Figma's completed
                                        layout drops the status row;
                                        the tally + view links on the
                                        BANK ACCOUNTS header carry the
                                        post-sync state). */}
                    {stickyPending ? (
                        <div className="mt-4 flex items-center justify-center gap-2 text-wb-14 leading-4 text-wb-ink">
                            <span className="font-semibold">
                                {t("account_inquiry.sync.in_progress")}
                            </span>
                            <span className="font-medium text-wb-muted">
                                {t("account_inquiry.sync.progress_count", {
                                    done:  String(completedAccounts),
                                    total: String(totalAccounts || selectedAccounts.length),
                                })}
                            </span>
                        </div>
                    ) : completionTally ? null : (
                        <div className="mt-4 flex items-center justify-center gap-2 text-wb-14 leading-4 text-wb-ink">
                            <span className="font-medium">
                                {t("account_inquiry.sync.selected_label")}
                            </span>
                            <span className="font-semibold">
                                {t("account_inquiry.sync.selected_count", {
                                    count: String(selectedAccounts.length),
                                })}
                            </span>
                        </div>
                    )}

                    {/* ── Per-currency totals block ─────────────────────
                       Post-sync the header shows "BANK ACCOUNTS (VND)  ...
                       Success N / Failed M Accounts" (right-aligned) and
                       each Credit / Debit row gains a blue "View" link
                       that opens the Latest Transaction History popup
                       scoped to the just-scraped window. */}
                    <div className="mt-4 flex flex-col gap-3">
                        {groups.map((g) => {
                            // This currency group's OWN result — never the
                            // batch aggregate. Absent (no scrape for this
                            // ccy) → 0/0 so a group still renders cleanly.
                            const summary = currencySummaries[g.currency];
                            // Per-account failed detail for this currency → the
                            // "Failed M" hover tooltip. Each entry renders as
                            // "[Bank Account] {localized message} (LOGIN_CAN)";
                            // null when nothing failed (Tooltip is then inert).
                            const failedTooltip = buildFailedTooltip(
                                failedAccountDetails.filter((d) => d.currency === g.currency),
                                selectedAccounts,
                                t,
                            );
                            return (
                            <div
                                key={g.currency}
                                className="flex flex-col gap-2 rounded-lg border border-wb-ntrl-4 bg-white p-3"
                            >
                                {/* Header row — Figma 9183:25378 */}
                                <div className="flex items-center justify-between">
                                    <span className="text-wb-16 font-semibold leading-6 text-wb-dark">
                                        {t("account_inquiry.sync.accounts_heading_ccy", {
                                            ccy: g.currency,
                                        })}
                                    </span>
                                    {completionTally && (
                                        <span className="flex items-center gap-1 text-wb-13 font-medium leading-4">
                                            <span className="text-wb-ink">
                                                {t("account_inquiry.sync.tally_success")}{" "}
                                                {summary?.success ?? 0} /
                                            </span>
                                            <Tooltip
                                                content={failedTooltip}
                                                placement="top"
                                                className="inline-flex"
                                            >
                                                <span
                                                    className={`text-wb-status-rejected-text ${
                                                        failedTooltip
                                                            ? "cursor-help underline decoration-dotted underline-offset-2"
                                                            : ""
                                                    }`}
                                                >
                                                    {t("account_inquiry.sync.tally_failed")}{" "}
                                                    {summary?.failed ?? 0}
                                                </span>
                                            </Tooltip>
                                            <span className="text-wb-ink">
                                                {t("account_inquiry.sync.tally_accounts")}
                                            </span>
                                        </span>
                                    )}
                                </div>
                                {/* Credit + Debit block — Figma 9183:25384.
                                   Wrapped in border-b + pb so the divider sits
                                   below Debit, not between Credit and Debit. */}
                                <div className="flex flex-col gap-1 border-b border-wb-ntrl-4 pb-2">
                                    {/* Credit row */}
                                    <TotalsRow
                                        label={t("account_inquiry.sync.col.credit")}
                                        countLabel={t("account_inquiry.sync.transactions_count", {
                                            count: String(summary?.creditCount ?? 0),
                                        })}
                                        amount={formatAmount(summary?.creditTotal ?? 0, g.currency)}
                                        actionLabel={completionTally ? t("account_inquiry.sync.view") : undefined}
                                        onAction={completionTally ? () => {
                                            setSelectedHistoryType("CREDIT");
                                            setSelectedHistoryGroup(g.currency);
                                            setLatestHistoryOpen(true);
                                        } : undefined}
                                    />
                                    {/* Debit row */}
                                    <TotalsRow
                                        label={t("account_inquiry.sync.col.debit")}
                                        countLabel={t("account_inquiry.sync.transactions_count", {
                                            count: String(summary?.debitCount ?? 0),
                                        })}
                                        amount={formatAmount(summary?.debitTotal ?? 0, g.currency)}
                                        actionLabel={completionTally ? t("account_inquiry.sync.view") : undefined}
                                        onAction={completionTally ? () => {
                                            setSelectedHistoryType("DEBIT");
                                            setSelectedHistoryGroup(g.currency);
                                            setLatestHistoryOpen(true);
                                        } : undefined}
                                    />
                                    {/* Debit Matched row — legacy nxisas_tranList
                                       "Debit Matched {matched}/{debit} Transaction(s)"
                                       (nxisas_tranList_osmc.js:528-534). Rendered only
                                       after a completed sync, when this currency has
                                       debits AND the tenant's auto-match gate (00079)
                                       is on. Count only — no amount column, no View
                                       link (legacy row has neither). */}
                                    {completionTally
                                        && autoMatchEnabled
                                        && (summary?.debitCount ?? 0) > 0 && (
                                        <TotalsRow
                                            label={t("account_inquiry.sync.col.debit_matched")}
                                            countLabel={t("account_inquiry.sync.debit_matched_count", {
                                                matched: String(summary?.debitMatched ?? 0),
                                                total:   String(summary?.debitCount ?? 0),
                                            })}
                                            amount=""
                                        />
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>

                    {/* ── Sync (idle) / Cancel (running) — full-width pill.
                       Hidden in the completed state: the BANK ACCOUNTS
                       block's tally + per-row View links carry the
                       post-sync surface, and re-running the sync is
                       deliberately gated behind closing + reopening
                       the popup so the user doesn't accidentally
                       double-fire a 30-day scrape.
                       Cancel aborts the in-flight fetch; the bank-side
                       Coocon scrape doesn't actually stop (the gateway
                       call is in flight), but the frontend tears down
                       and resets UI. */}
                    {stickyPending ? (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="mt-5 flex h-9 w-full cursor-pointer items-center justify-center rounded-md border border-wb-border-sidebar bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("account_inquiry.sync.cancel")}
                        </button>
                    ) : completionTally ? null : (
                        <button
                            type="button"
                            onClick={() => void handleSync()}
                            disabled={selectedAccounts.length === 0}
                            className="mt-5 flex h-9 w-full cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t("account_inquiry.sync.sync")}
                        </button>
                    )}

                    {/* ── Divider + auto-close checkbox below ────────── */}
                    <div className="mt-5 border-t border-wb-border-sidebar pt-3">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-wb-14 font-medium leading-4 text-wb-ink">
                            <Checkbox
                                checked={autoClose}
                                onCheckedChange={(v) => setAutoClose(v === true)}
                            />
                            <span>{t("account_inquiry.sync.auto_close")}</span>
                        </label>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* ── Challenge dialogs ───────────────────────────────────
            Rendered as siblings of the sync popup. The same dialog
            components Login Credentials Setup uses — single source
            of truth for QNA / OTP / CAPTCHA chrome. On submit each
            dialog calls the matching resume endpoint and the
            response loops back through `handleResponse`.            */}
        {challenge?.kind === "QNA" && (
            <QnaDialog
                bankName={challengeBankName}
                loginId={challenge.loginId ?? ""}
                questions={challenge.qnaQuestions ?? []}
                onSubmit={(payload) => {
                    // Legacy parity: the security-question popup is an
                    // input prompt, NOT a progress dialog. Close it the
                    // moment Confirm is pressed — capture sessionId first
                    // so the closure survives the setChallenge(null). The
                    // sync dialog's own progress bar + "In Progress" row
                    // cover the bank-side wait; a wrong answer re-returns
                    // QNA_REQUIRED and handleResponse re-opens the popup.
                    const sessionId = challenge.sessionId;
                    // Resume the async session on the backend, then resume
                    // polling (resumeChallenge clears the dialog + preserves
                    // progress + counters). A wrong answer re-returns
                    // *_REQUIRED via the next poll and the dialog re-opens.
                    return resumeChallenge(
                        submitSyncQna(sessionId, {
                            question:     payload.question,
                            hidden_value: payload.hidden_value,
                            answer:       payload.answer,
                        }),
                    );
                }}
                onCancel={handleChallengeCancel}
            />
        )}
        {challenge?.kind === "OTP" && (
            <OtpDialog
                prompt={challenge.prompt}
                onSubmit={(value) => {
                    // Legacy parity: close the OTP prompt immediately on
                    // Confirm; the sync progress UI covers the wait, and a
                    // bad OTP re-returns OTP_REQUIRED → handleResponse
                    // re-opens this dialog.
                    const sessionId = challenge.sessionId;
                    return resumeChallenge(submitSyncOtp(sessionId, value));
                }}
                onCancel={handleChallengeCancel}
            />
        )}
        {challenge?.kind === "CAPTCHA" && (
            <CaptchaDialog
                image={challenge.captchaImage ?? ""}
                format={challenge.captchaImageFormat ?? "png"}
                onSubmit={(value) => {
                    // Legacy parity: close the CAPTCHA prompt immediately
                    // on Confirm; the sync progress UI covers the wait, and
                    // a wrong CAPTCHA re-returns CAPTCHA_REQUIRED →
                    // handleResponse re-opens this dialog.
                    const sessionId = challenge.sessionId;
                    return resumeChallenge(submitSyncCaptcha(sessionId, value));
                }}
                onCancel={handleChallengeCancel}
            />
        )}
        {latestHistoryOpen && (
            <LatestTransactionHistoryModal
                type={selectedHistoryType}
                startIso={effectiveWindow.start}
                endIso={effectiveWindow.end}
                // Pass only the accounts that match the currency group
                // the user clicked. The post-sync View link is per
                // currency group (BANK ACCOUNTS (VND), BANK ACCOUNTS
                // (USD), …) so passing the full selection would mix
                // currencies in the totals footer.
                accounts={selectedAccounts
                    .filter((a) =>
                        // When a currency group was captured at click
                        // time, scope the modal to that group. Otherwise
                        // (defensive) fall through with the full set.
                        selectedHistoryGroup == null
                            ? true
                            : (a.currencyCd ?? "VND").toUpperCase() === selectedHistoryGroup,
                    )
                    .map((a) => ({
                        bankCd:     a.bankCd,
                        accountNo:  a.accountNo,
                        currencyCd: a.currencyCd,
                    }))}
                onClose={() => setLatestHistoryOpen(false)}
            />
        )}
        {syncHistoryOpen && (
            <SyncHistoryDialog
                availableBanks={availableBanks}
                currency={currency}
                startIso={startIso}
                endIso={endIso}
                onClose={() => setSyncHistoryOpen(false)}
            />
        )}
        </>
    );
}

function TotalsRow({
    label,
    countLabel,
    amount,
    actionLabel,
    onAction,
}: {
    label: string;
    countLabel: string;
    amount: string;
    /** Optional inline action — shown as a blue text link at the row's
     *  right edge. When defined, post-sync the row gains a "View" link
     *  that opens the Latest Transaction History popup. */
    actionLabel?: string;
    onAction?: () => void;
}) {
    // Figma 9183:25385 / 9183:25392 — fixed column widths so Credit and
    // Debit (and any future row) align byte-for-byte. Per Figma, the
    // label uses opacity-70 to read as the muted column header inside
    // the same text color family as the count.
    return (
        <div className="flex items-center justify-between py-1 text-wb-14 font-medium">
            <div className="flex items-center gap-4 text-wb-ink">
                <span className="w-[104px] shrink-0 leading-6 opacity-70">
                    {label}
                </span>
                <span className="w-[132px] shrink-0">
                    {countLabel}
                </span>
            </div>
            <div className="flex items-center gap-4">
                <span className="w-[112px] shrink-0 text-right text-wb-ink">
                    {amount}
                </span>
                {actionLabel && onAction && (
                    <button
                        type="button"
                        onClick={onAction}
                        className="shrink-0 cursor-pointer text-brand underline underline-offset-2"
                    >
                        {actionLabel}
                    </button>
                )}
            </div>
        </div>
    );
}

/** In-memory view of one `ApiFailedAccountDetail` — an account that failed
 *  without aborting the batch (a LOGIN_CAN challenge-cancel). */
type FailedAccountDetailView = {
    bankCd: string;
    acctNo: string;
    /** Uppercase currency code, used to bucket the tooltip per BANK ACCOUNTS group. */
    currency: string;
    errorCode: string;
    errorMessage: string;
};

/**
 * Build the per-currency "Failed M" hover tooltip string. Each failed account
 * renders as "[Bank name Account no] {localized message} (CODE)". The bank name
 * comes from the selected-accounts list (falling back to the bank code); the
 * message from the shared scraping-result-code map (LOGIN_CAN →
 * "You have canceled the operation"), falling back to the backend message and
 * then a localized generic — so it NEVER renders JavaScript `undefined`.
 * Returns `null` when nothing failed (the Tooltip is then inert).
 */
function buildFailedTooltip(
    items: FailedAccountDetailView[],
    accounts: SyncSelectedAccount[],
    t: (key: string, vars?: Record<string, string | number>) => string,
): string | null {
    if (items.length === 0) return null;
    return items
        .map((d) => {
            const acct = accounts.find(
                (a) => a.bankCd === d.bankCd && a.accountNo === d.acctNo,
            );
            const bankName = acct?.bankName || d.bankCd;
            const code = d.errorCode || "LOGIN_CAN";
            const message =
                lookupScrapingResultMessage(d.errorCode, t)
                ?? (d.errorMessage.trim() || t("account_inquiry.sync.login_cancelled_fallback"));
            return `[${bankName} ${d.acctNo}] ${message} (${code})`;
        })
        .join(" · ");
}

/** In-memory view of one `ApiCurrencySummary` wire entry — the snake_case
 *  wire fields translated to the dialog's camelCase shape at the boundary
 *  (in `handleResponse`). `success` / `failed` count accounts;
 *  `creditCount` / `debitCount` count transactions; totals are numbers. */
type CurrencySummaryView = {
    success:     number;
    failed:      number;
    creditCount: number;
    debitCount:  number;
    creditTotal: number;
    debitTotal:  number;
    /** Numerator of the "Debit Matched {matched}/{debitCount}" row — this
     *  currency's debits the P1 auto-matcher linked this batch. */
    debitMatched: number;
};

type CurrencyGroup = {
    currency: string;
    accounts: SyncSelectedAccount[];
};

function groupByCurrency(accounts: SyncSelectedAccount[]): CurrencyGroup[] {
    const byCcy = new Map<string, SyncSelectedAccount[]>();
    for (const a of accounts) {
        const ccy = (a.currencyCd ?? "VND").toUpperCase();
        const arr = byCcy.get(ccy);
        if (arr) arr.push(a);
        else byCcy.set(ccy, [a]);
    }
    return Array.from(byCcy.entries()).map(([currency, accs]) => ({
        currency,
        accounts: accs,
    }));
}

type DefaultRange = {
    startIso: string;
    endIso: string;
};

/**
 * Default Date Range for the sync popup — ONE batch window used for every
 * selected account, computed exactly like legacy
 * {@code nxisas_tranList.getInitStartDate()} + {@code initData()}:
 *
 *   start = max( earliest TRN_LST_SUC_DTM across the selection, today − 3 months )
 *   end   = today
 *
 * i.e. the window opens at the earliest transaction-last-success date, but
 * is floored to 3 months back; accounts that have never completed a
 * transaction scrape (no {@code lastSync}) fall through to the 3-month
 * floor. This single window is what the popup sends to the backend (for
 * ALL accounts) AND what the Latest Transaction History popup queries, so
 * the Credit/Debit counts and the history list can never describe
 * different windows (legacy parity — see nxisas_tranList.js:448-463 +
 * nxisas_tranHistory.js:80-81).
 *
 * NOTE: {@code lastSync} carries {@code TRN_LST_SUC_DTM}, NOT the balance
 * "Last Update" ({@code ACCT_BAL_LST_INQ_DTM}) — feeding the balance
 * timestamp here was the bug that produced a too-narrow (often 1-day)
 * window whose history query returned nothing.
 */
function defaultSyncRange(accounts: SyncSelectedAccount[]): DefaultRange {
    const end = new Date();
    const endIso = iso(end);

    // 3-month floor (legacy `moment().subtract(3, 'months')`).
    const floor = new Date();
    floor.setMonth(floor.getMonth() - 3);
    const floorIso = iso(floor);

    let earliest: string | null = null;
    for (const a of accounts) {
        const isoDate = lastSyncToIso(a.lastSync);
        if (isoDate && (earliest === null || isoDate < earliest)) {
            earliest = isoDate;
        }
    }

    // start = max(earliest last-success, today − 3 months). Falls to the
    // floor when never-synced (earliest === null) or when the earliest
    // last-success predates the 3-month window.
    const startIso = earliest && earliest > floorIso ? earliest : floorIso;
    return { startIso, endIso };
}

/** Convert a compact `yyyyMMddHHmmss` (or `yyyyMMdd`) last-sync marker to
 *  an ISO `yyyy-MM-dd` date, or null when absent / malformed. */
function lastSyncToIso(raw?: string): string | null {
    if (!raw) return null;
    const head = raw.slice(0, 8);
    if (!/^\d{8}$/.test(head)) return null;
    return `${head.slice(0, 4)}-${head.slice(4, 6)}-${head.slice(6, 8)}`;
}

function iso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/** Inclusive day count between two `YYYY-MM-DD` ISO dates. Calendar-day
 *  delta — no timezone arithmetic — so it matches what the user sees on
 *  the chips. Returns 0 when end < start. */
function daysBetween(startIso: string, endIso: string): number {
    const s = Date.parse(startIso + "T00:00:00Z");
    const e = Date.parse(endIso   + "T00:00:00Z");
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
    return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
}
