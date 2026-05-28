"use client";

import { useMemo, useRef, useState } from "react";
import { Info, History as HistoryIcon } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatDateChipNumeric } from "@/components/shared/DateField";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import { useDialog } from "@/components/shared/dialog";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { formatAmount } from "@/lib/currency";
import {
    ApiCallError,
    syncTransactions,
    submitSyncQna,
    submitSyncOtp,
    submitSyncCaptcha,
} from "@/lib/api/banking";
import type { ApiTransactionsSyncResponse, ApiQnaQuestion } from "@/lib/types/api";
import { useTranslation } from "@/lib/i18n";
import { lookupScrapingResultMessage } from "@/lib/i18n/scrapingResultCodes";
import { QnaDialog } from "@/app/(dashboard)/banking/credentials/QnaDialog";
import { OtpDialog } from "@/app/(dashboard)/banking/credentials/OtpDialog";
import { CaptchaDialog } from "@/app/(dashboard)/banking/credentials/CaptchaDialog";
import LatestTransactionHistoryDialog from "./LatestTransactionHistoryDialog";
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
};

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

    // Last 30 days is the legacy default. Both chips now open the shared
    // DateField calendar so the user can change either end of the range.
    const defaultRange = useMemo(defaultLast30Days, []);
    const [startIso, setStartIso] = useState(defaultRange.startIso);
    const [endIso, setEndIso] = useState(defaultRange.endIso);

    const [auto, setAuto] = useState(true);
    const [autoClose, setAutoClose] = useState(false);
    const [pending, setPending] = useState(false);

    /* Sticky mirror of `pending` — keeps the Cancel / progress
     * chrome visible for the minimum-visibility window so a fast
     * sync resolution doesn't flicker Sync → Cancel → Sync in under
     * a perceptual frame. The functional guard (`pending`) inside
     * the handler still blocks duplicate `handleSync` calls before
     * the sticky flag flips. */
    const stickyPending = useStickyLoading(pending);

    /** Holds the in-flight cancel signal — clicking Cancel aborts the
     *  outstanding fetch. Coocon won't actually stop on the bank side;
     *  the frontend abort drops the response promise and resets UI
     *  (mirrors legacy "close progress widget" UX). */
    const abortRef = useRef<AbortController | null>(null);

    /** Latest-Transaction-History dialog state — opens AFTER the
     *  Information dialog's Close on the COMPLETED path. Shows scraped
     *  *transactions* per account. */
    const [historyOpen, setHistoryOpen] = useState(false);

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

    // Group selected accounts by currency. Legacy popup shows one
    // "BANK ACCOUNTS (CCY)" block per distinct currency. VND-only
    // selection collapses to a single block, matching the screenshot.
    const groups = useMemo(() => groupByCurrency(selectedAccounts), [selectedAccounts]);

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

    /** Single entry point that consumes a response from any of the
     *  sync endpoints (initial start + three resume variants). On
     *  COMPLETED it dismisses; on *_REQUIRED it opens the matching
     *  dialog; on ERROR it surfaces the standard error dialog. */
    function handleResponse(res: ApiTransactionsSyncResponse) {
        switch (res.status) {
            case "COMPLETED": {
                // Refresh the inquiry table behind the popup
                // (mirrors legacy fn_loadData). Then show the
                // Information dialog with the Success / Failed
                // tally per Figma. The tally is also stamped onto
                // the inline BANK ACCOUNTS header + per-row "View"
                // links so the popup itself reflects the just-
                // finished sync state even after the user dismisses
                // the Information dialog.
                setChallenge(null);
                onSyncComplete();
                const success = res.accounts_synced ?? 0;
                const failed  = Math.max(0, selectedAccounts.length - success);
                setCompletionTally({
                    success,
                    failed,
                    debitCount:  res.debit_count  ?? 0,
                    creditCount: res.credit_count ?? 0,
                    debitTotal:  Number(res.debit_total  ?? "0"),
                    creditTotal: Number(res.credit_total ?? "0"),
                });
                showCompletionDialog(success, failed);
                if (autoClose) onClose();
                return;
            }
            case "QNA_REQUIRED":
                setChallenge({
                    sessionId: res.session_id!,
                    kind: "QNA",
                    prompt: res.challenge_prompt ?? "",
                    qnaQuestions: res.qna_questions ?? [],
                });
                return;
            case "OTP_REQUIRED":
                setChallenge({
                    sessionId: res.session_id!,
                    kind: "OTP",
                    prompt: res.challenge_prompt ?? "",
                });
                return;
            case "CAPTCHA_REQUIRED":
                setChallenge({
                    sessionId: res.session_id!,
                    kind: "CAPTCHA",
                    prompt: res.challenge_prompt ?? "",
                    captchaImage: res.captcha_image ?? undefined,
                    captchaImageFormat: res.captcha_image_format ?? undefined,
                });
                return;
            case "ERROR":
            default: {
                setChallenge(null);
                // Prefer code-keyed i18n; gateway free-text is often
                // Korean and confuses non-KO users.
                const localized = lookupScrapingResultMessage(
                    res.error_code,
                    t,
                );
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description:
                        localized ??
                        res.error_message ??
                        t("dialog.error"),
                    errorCode: res.error_code ?? "ERROR",
                });
                return;
            }
        }
    }

    /** Wrap a sync API call so a thrown `ApiCallError` (e.g. network
     *  failure, 4xx envelope) surfaces through the same error dialog
     *  the ERROR-status branch uses. Also threads a fresh
     *  {@link AbortController} per call so {@link handleCancel} can
     *  abort the in-flight fetch. */
    async function runSyncStep(step: () => Promise<ApiTransactionsSyncResponse>) {
        const controller = new AbortController();
        abortRef.current = controller;
        setPending(true);
        try {
            const res = await step();
            // Discard the response if the user clicked Cancel mid-flight
            // — handleCancel already flipped pending off.
            if (controller.signal.aborted) return;
            handleResponse(res);
        } catch (err) {
            // Abort cleans up silently — no error dialog needed.
            if (controller.signal.aborted) return;
            const code = err instanceof ApiCallError ? err.code : "NETWORK";
            const msg =
                err instanceof ApiCallError
                    ? err.message
                    : err instanceof Error
                      ? err.message
                      : t("dialog.error");
            setChallenge(null);
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: msg,
                errorCode: code,
            });
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
            setPending(false);
        }
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
    function handleCancel() {
        abortRef.current?.abort();
        setPending(false);
        setChallenge(null);
    }

    /** Fire the actual sync POST. Separated so the {@link handleSync}
     *  pre-flight can await a user confirmation before calling. */
    async function runSync() {
        // Capture the effective {from, to} window the backend will
        // scrape so the post-sync Latest Transaction History popup
        // reads transactions from the same window. When Auto is on
        // the backend defaults to today-30..today; when Auto is off
        // the user-picked chip dates are authoritative. Either way
        // the History dialog reads from `effectiveWindow`, not the
        // chip state (which may have been edited between sync click
        // and History open).
        const todayIsoVal = todayIso();
        const thirtyDaysAgo = (() => {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })();
        setEffectiveWindow(
            auto
                ? { start: thirtyDaysAgo, end: todayIsoVal }
                : { start: startIso, end: endIso },
        );

        await runSyncStep(() =>
            syncTransactions({
                accounts: selectedAccounts.map((a) => ({
                    bank_cd: a.bankCd,
                    acct_no: a.accountNo,
                })),
                // When Auto is on the backend picks its own range
                // (mirrors legacy AUTO_SET_YN semantics — disabled date
                // inputs are not authoritative). Send the user-picked
                // range only when Auto is off.
                ...(auto ? {} : { from_dt: startIso, to_dt: endIso }),
                auto,
            }),
        );
    }

    /** Today as ISO {@code YYYY-MM-DD} in the user's local timezone —
     *  matches the chip rendering in {@link InteractiveDateRangePicker}. */
    function todayIso(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    async function handleSync() {
        if (pending || selectedAccounts.length === 0) return;

        // Legacy WBC1107 parity: when Auto is off AND the user picked
        // a start date earlier than today, prompt before scraping —
        // back-dated scrapes are expensive on the bank side (Coocon
        // re-fetches every transaction in the window) and the legacy
        // popup pops a confirm so the user doesn't trigger it by
        // accident. Skip when Auto is on (backend picks its own
        // window) or when start = today (no warning needed).
        if (!auto && startIso < todayIso()) {
            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("account_inquiry.sync.confirm_backdated", {
                    from: formatDateChipNumeric(startIso),
                    to:   formatDateChipNumeric(endIso),
                }),
                confirmText: t("dialog.continue"),
                cancelText:  t("dialog.cancel"),
                onConfirm: () => { void runSync(); },
            });
            return;
        }
        await runSync();
    }

    return (
        <>
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
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
                <div className="flex w-full flex-col p-5">
                    {/* ── Header ─────────────────────────────────────── */}
                    <div className="flex flex-col gap-0">
                        <DialogTitle asChild>
                            <h2 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
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
                            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                            aria-label={t("account_inquiry.sync.history")}
                        >
                            <HistoryIcon className="size-4" />
                            {t("account_inquiry.sync.history")}
                        </button>
                    </div>

                    {/* ── Date range row with red "required" dot + Auto ──── */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1 text-wb-13 font-medium text-wb-ink">
                            {t("account_inquiry.sync.date_range")}
                            <span className="text-wb-status-rejected-text" aria-hidden>
                                •
                            </span>
                        </span>
                        <InteractiveDateRangePicker
                            startIso={startIso}
                            endIso={endIso}
                            onChange={({ start, end }) => {
                                setStartIso(start);
                                setEndIso(end);
                            }}
                            formatValue={formatDateChipNumeric}
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
                            disabled={auto}
                        />
                        <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 text-wb-13 font-medium text-wb-ink">
                            <input
                                type="checkbox"
                                className="size-4 cursor-pointer accent-brand"
                                checked={auto}
                                onChange={(e) => setAuto(e.target.checked)}
                            />
                            <span>{t("account_inquiry.sync.auto")}</span>
                            {/* Native-hover tooltip ("If you select the auto
                               setting, date range would set from the last
                               inquired date to today. The maximum inquiry
                               period is 1 month at a time.") — same pattern
                               as the manual / disconnected checkbox tooltips
                               on the Account Inquiry table. `tabIndex={0}`
                               + `aria-label` so the message also surfaces to
                               screen readers and keyboard focus. */}
                            <span
                                tabIndex={0}
                                title={t("account_inquiry.sync.auto_tooltip")}
                                aria-label={t("account_inquiry.sync.auto_tooltip")}
                                className="inline-flex"
                            >
                                <Info
                                    className="size-3.5 cursor-help text-wb-muted"
                                    aria-hidden
                                />
                            </span>
                        </label>
                    </div>

                    {/* ── Progress bar slot — three visual states:
                       (1) idle       → inert grey;
                       (2) pending    → animated brand-blue stripe;
                       (3) completed  → solid olive-green fill
                                        (Figma "100% done" tone, distinct
                                        from the brand-blue stripe so the
                                        user reads "this finished" at a
                                        glance without checking the tally).
                       The olive-green hex matches the Figma asset —
                       there's no semantic match in the existing wb-status
                       tokens (approved-text is darker forest-green), so
                       this is an inline asset color, documented at the
                       top of the file. */}
                    <div className="mt-4 h-6 w-full overflow-hidden rounded-md bg-wb-bg-sidebar">
                        {stickyPending && (
                            <div
                                aria-hidden
                                className="animate-progress-slide h-full w-1/3 rounded-md"
                                style={{
                                    backgroundImage:
                                        "linear-gradient(90deg, transparent, var(--color-brand), transparent)",
                                }}
                            />
                        )}
                        {!stickyPending && completionTally && (
                            <div
                                aria-hidden
                                className="h-full w-full rounded-md"
                                style={{ backgroundColor: "#a3c419" }}
                            />
                        )}
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
                        <div className="mt-4 flex items-center justify-center gap-2 text-wb-13 text-wb-ink">
                            <span className="font-semibold">
                                {t("account_inquiry.sync.in_progress")}
                            </span>
                            <span className="font-medium text-wb-muted">
                                {t("account_inquiry.sync.progress_count", {
                                    done:  "0",
                                    total: String(selectedAccounts.length),
                                })}
                            </span>
                        </div>
                    ) : completionTally ? null : (
                        <div className="mt-4 flex items-center justify-center gap-2 text-wb-13 text-wb-ink">
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
                    <div className="mt-3 flex flex-col gap-3">
                        {groups.map((g) => (
                            <div
                                key={g.currency}
                                className="rounded-md border border-wb-border-sidebar bg-white"
                            >
                                {/* Header band */}
                                <div className="flex items-center justify-between border-b border-wb-border-sidebar bg-wb-bg-sidebar/60 px-4 py-2.5">
                                    <span className="text-wb-12 font-semibold tracking-wb-tight text-wb-muted">
                                        {t("account_inquiry.sync.accounts_heading_ccy", {
                                            ccy: g.currency,
                                        })}
                                    </span>
                                    {completionTally && (
                                        <span className="text-wb-12 font-medium text-wb-ink">
                                            {t("account_inquiry.sync.tally_success")}{" "}
                                            <span className="font-semibold">
                                                {completionTally.success}
                                            </span>{" "}
                                            <span className="text-wb-status-rejected-text">
                                                /{t("account_inquiry.sync.tally_failed")}
                                            </span>{" "}
                                            <span className="font-semibold">
                                                {completionTally.failed}
                                            </span>{" "}
                                            {t("account_inquiry.sync.tally_accounts")}
                                        </span>
                                    )}
                                </div>
                                {/* Credit row */}
                                <TotalsRow
                                    label={t("account_inquiry.sync.col.credit")}
                                    countLabel={t("account_inquiry.sync.transactions_count", {
                                        count: String(completionTally?.creditCount ?? 0),
                                    })}
                                    amount={formatAmount(completionTally?.creditTotal ?? 0, g.currency)}
                                    actionLabel={completionTally ? t("account_inquiry.sync.view") : undefined}
                                    onAction={completionTally ? () => setHistoryOpen(true) : undefined}
                                />
                                {/* Debit row */}
                                <TotalsRow
                                    label={t("account_inquiry.sync.col.debit")}
                                    countLabel={t("account_inquiry.sync.transactions_count", {
                                        count: String(completionTally?.debitCount ?? 0),
                                    })}
                                    amount={formatAmount(completionTally?.debitTotal ?? 0, g.currency)}
                                    actionLabel={completionTally ? t("account_inquiry.sync.view") : undefined}
                                    onAction={completionTally ? () => setHistoryOpen(true) : undefined}
                                    last
                                />
                            </div>
                        ))}
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
                            className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center rounded-md border border-wb-border-sidebar bg-white px-3 text-wb-16 font-semibold text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("account_inquiry.sync.cancel")}
                        </button>
                    ) : completionTally ? null : (
                        <button
                            type="button"
                            onClick={() => void handleSync()}
                            disabled={selectedAccounts.length === 0}
                            className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-16 font-semibold text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t("account_inquiry.sync.sync")}
                        </button>
                    )}

                    {/* ── Divider + auto-close checkbox below ────────── */}
                    <div className="mt-4 border-t border-wb-border-sidebar pt-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-wb-13 font-medium text-wb-ink">
                            <input
                                type="checkbox"
                                className="size-4 cursor-pointer accent-brand"
                                checked={autoClose}
                                onChange={(e) => setAutoClose(e.target.checked)}
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
                loginId={""}
                questions={challenge.qnaQuestions ?? []}
                onSubmit={(payload) =>
                    runSyncStep(() =>
                        submitSyncQna(challenge.sessionId, {
                            question:     payload.question,
                            hidden_value: payload.hidden_value,
                            answer:       payload.answer,
                        }),
                    )
                }
                onCancel={() => setChallenge(null)}
            />
        )}
        {challenge?.kind === "OTP" && (
            <OtpDialog
                prompt={challenge.prompt}
                onSubmit={(value) =>
                    runSyncStep(() => submitSyncOtp(challenge.sessionId, value))
                }
                onCancel={() => setChallenge(null)}
            />
        )}
        {challenge?.kind === "CAPTCHA" && (
            <CaptchaDialog
                image={challenge.captchaImage ?? ""}
                format={challenge.captchaImageFormat ?? "png"}
                onSubmit={(value) =>
                    runSyncStep(() => submitSyncCaptcha(challenge.sessionId, value))
                }
                onCancel={() => setChallenge(null)}
            />
        )}
        {historyOpen && (
            <LatestTransactionHistoryDialog
                accounts={selectedAccounts}
                startIso={effectiveWindow.start}
                endIso={effectiveWindow.end}
                onClose={() => setHistoryOpen(false)}
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
    last,
    actionLabel,
    onAction,
}: {
    label: string;
    countLabel: string;
    amount: string;
    last?: boolean;
    /** Optional inline action — shown as a blue text link at the row's
     *  right edge. When defined, post-sync the row gains a "View" link
     *  that opens the Latest Transaction History popup. */
    actionLabel?: string;
    onAction?: () => void;
}) {
    return (
        <div
            className={`flex items-center justify-between gap-3 px-4 py-3 ${
                last ? "" : "border-b border-wb-border-sidebar"
            }`}
        >
            <span className="w-20 shrink-0 text-wb-13 font-medium text-wb-ink">
                {label}
            </span>
            <span className="flex-1 text-wb-13 font-normal text-wb-ink">
                {countLabel}
            </span>
            <span className="text-wb-13 font-semibold text-wb-ink">{amount}</span>
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="shrink-0 cursor-pointer text-wb-13 font-medium text-brand underline-offset-2 hover:underline"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}

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

/** "Last 30 days" — local-date based. Chips render via formatDateChipNumeric. */
function defaultLast30Days(): DefaultRange {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
        startIso: iso(start),
        endIso: iso(end),
    };
}

function iso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
