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
import Tooltip from "@/components/shared/Tooltip";
import { Checkbox } from "@/components/ui/checkbox";
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
    /** This account's last-successful-sync timestamp (the Account
     *  Inquiry "Last Update" value — `ACCT_BAL_LST_INQ_DTM`, compact
     *  `yyyyMMddHHmmss`). Seeds the popup's default Date Range start so a
     *  re-sync opens at the last sync, not a fixed 30-day window (legacy
     *  fnsh_0001_001 #acct_Reg parity). Empty / undefined when the
     *  account has never synced. */
    lastSync?: string;
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
                // Per-currency roll-up — each BANK ACCOUNTS ({ccy}) group
                // renders its own numbers from this map keyed by ccy code.
                const summaries: Record<string, CurrencySummaryView> = {};
                for (const s of res.currency_summaries ?? []) {
                    summaries[(s.ccy_cd ?? "").toUpperCase()] = {
                        success:     s.success_count ?? 0,
                        failed:      s.failed_count  ?? 0,
                        creditCount: s.credit_count  ?? 0,
                        debitCount:  s.debit_count   ?? 0,
                        creditTotal: Number(s.credit_total ?? "0"),
                        debitTotal:  Number(s.debit_total  ?? "0"),
                    };
                }
                setCurrencySummaries(summaries);
                showCompletionDialog(success, failed);
                if (autoClose) onClose();
                return;
            }
            case "QNA_REQUIRED":
                nxisasDebug("run2ndCert obj", {
                    challengeType: "QNA",
                    traceId: res.session_id,
                    bankName: selectedAccounts[0]?.bankName,
                    loginId: res.login_id,
                });
                setChallenge({
                    sessionId: res.session_id!,
                    kind: "QNA",
                    prompt: res.challenge_prompt ?? "",
                    qnaQuestions: res.qna_questions ?? [],
                    loginId: res.login_id ?? "",
                });
                return;
            case "OTP_REQUIRED":
                nxisasDebug("run2ndCert obj", {
                    challengeType: "OTP",
                    traceId: res.session_id,
                    bankName: selectedAccounts[0]?.bankName,
                });
                setChallenge({
                    sessionId: res.session_id!,
                    kind: "OTP",
                    prompt: res.challenge_prompt ?? "",
                });
                return;
            case "CAPTCHA_REQUIRED":
                nxisasDebug("run2ndCert obj", {
                    challengeType: "CAPTCHA",
                    traceId: res.session_id,
                    bankName: selectedAccounts[0]?.bankName,
                });
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
        // Capture the effective {from, to} window for the post-sync
        // Latest Transaction History popup. Under Auto the backend scrapes
        // each account from its own last-success; the displayed chips
        // (defaulted to the earliest last-success → today) are the closest
        // single-window representation, so the History dialog reads from
        // them in both modes. The History dialog reads `effectiveWindow`,
        // not live chip state (which may change between sync and open).
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
            from: auto ? undefined : startIso,
            to: auto ? undefined : endIso,
        });

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
                                className="inline-flex cursor-pointer"
                            >
                                <Info
                                    className="size-3.5 cursor-pointer text-wb-muted"
                                    aria-hidden
                                />
                            </Tooltip>
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
                    <div className="mt-4 h-8 w-full overflow-hidden rounded-md border border-wb-border-sidebar bg-[#f5f5f5]">
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
                        <div className="mt-4 flex items-center justify-center gap-2 text-wb-14 leading-4 text-wb-ink">
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
                                            <span className="text-wb-status-rejected-text">
                                                {t("account_inquiry.sync.tally_failed")}{" "}
                                                {summary?.failed ?? 0}
                                            </span>
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
                    setChallenge(null);
                    return runSyncStep(() =>
                        submitSyncQna(sessionId, {
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
                    // Legacy parity: close the OTP prompt immediately on
                    // Confirm; the sync progress UI covers the wait, and a
                    // bad OTP re-returns OTP_REQUIRED → handleResponse
                    // re-opens this dialog.
                    const sessionId = challenge.sessionId;
                    setChallenge(null);
                    return runSyncStep(() => submitSyncOtp(sessionId, value));
                }}
                onCancel={() => setChallenge(null)}
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
                    setChallenge(null);
                    return runSyncStep(() => submitSyncCaptcha(sessionId, value));
                }}
                onCancel={() => setChallenge(null)}
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
 * Default Date Range for the sync popup — start at the selected accounts'
 * last successful sync, end today (legacy fnsh_0001_001 #acct_Reg: each
 * account scrapes from its own last-success so a re-sync only pulls new
 * transactions). With one batch range we pick the EARLIEST last-success
 * across the selection so the displayed window covers every account
 * (under Auto the backend still scrapes each account from its own
 * last-success). Accounts that never synced fall back to last-30-days.
 */
function defaultSyncRange(accounts: SyncSelectedAccount[]): DefaultRange {
    const end = new Date();
    let earliest: string | null = null;
    for (const a of accounts) {
        const isoDate = lastSyncToIso(a.lastSync);
        if (isoDate && (earliest === null || isoDate < earliest)) {
            earliest = isoDate;
        }
    }
    if (earliest) {
        return { startIso: earliest, endIso: iso(end) };
    }
    // Never-synced fallback — last 30 days, local-date based.
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return { startIso: iso(start), endIso: iso(end) };
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
