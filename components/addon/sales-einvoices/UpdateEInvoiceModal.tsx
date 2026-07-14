"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ApiCallError } from "@/lib/api/banking";
import { fetchEInvoiceHistory } from "@/lib/api/addon";
import { fetchLoginCredentials, fetchGdtScrapingCredential } from "@/lib/api/loginCredentials";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import EInvoiceHistoryDialog from "./EInvoiceHistoryDialog";
import EInvoiceDetailHistoryDialog from "./EInvoiceDetailHistoryDialog";
import { useEInvoiceScrape } from "./useEInvoiceScrape";

type Props = {
    /** Drives the card title + translation lookups so the same modal
     *  serves Sales and Expenses without forking the component. */
    variant: "SALES" | "EXPENSE";
    /** Close the dialog (clears `open` on the parent). */
    onClose: () => void;
    /** Fired after a successful scrape + intake so the parent list can
     *  refetch (bump its `refreshKey`). */
    onScraped?: () => void;
};

/**
 * Explicit modal state machine (legacy `nxisas_einvoice.js`
 * `_runningScrapping` / `_completedScrapping` flags, normalised).
 *
 * - `ready`     — pre-inquiry: Inquire visible, dates editable-when-Auto-off.
 * - `scraping`  — engine running: Inquire hidden, Stop visible, all inputs locked.
 * - `completed` — successful inquiry (incl. ZERO results): "Completed",
 *                 progress 100 (green), result card + View, buttons hidden.
 * - `failed`    — login / captcha / engine / network failure: Inquire hidden,
 *                 no View; only a reset/reopen restores `ready`.
 */
type Phase = "ready" | "scraping" | "completed" | "failed";

/**
 * Update e-Invoice Information popup — Add-on Service "Update" button
 * entry on both Sales e-Invoices and Expenses e-Invoices pages. Shared
 * component; `variant` is the only Sales/Expenses discriminator.
 *
 * <p>Legacy-parity behaviour (refactor port of `nxisas_einvoice.js` +
 * `nxisas_einvoice_view.jsp`), driven by the {@link Phase} state machine:
 * <ul>
 *   <li>Default range = last successful inquiry date → today, clamped to a
 *       30-day window; the un-inquired-period warning shows only when the
 *       last-success date is older than that window (start gets clamped).</li>
 *   <li>Auto (default checked) recomputes + locks the range; unchecking it
 *       enables the picker only while in `ready`.</li>
 *   <li>Two-phase local NXiSAS scrape → persist; on success the modal enters
 *       the persistent `completed` state (Completed label, 100% green bar,
 *       result count + amount, View), and hides the Inquire button.</li>
 *   <li>A Stop/Cancel button appears only while scraping; confirming it stops
 *       the engine and resets to `ready`. Closing mid-scrape runs the same
 *       confirm→stop flow.</li>
 *   <li>View opens the batch detail popup ({@link EInvoiceDetailHistoryDialog})
 *       keyed on the completed inquiry's `mod_dtm` — Sales AND Expenses.</li>
 * </ul>
 *
 * <p><b>Runtime caveat (OQ-S1):</b> the local engine is licensed per page
 * origin and is not licensed on `localhost`; the two-phase scrape is verified
 * end-to-end only on a licensed origin. The state machine, date logic, View,
 * and Stop flow are exercised independently.
 *
 * `stackLevel={1}` (root) — opens directly from the e-Invoices page.
 */
export default function UpdateEInvoiceModal({ variant, onClose, onScraped }: Props) {
    const { t } = useTranslation();
    const dialog = useDialog();

    // ── State machine + form state ────────────────────────────────────
    const [phase, setPhase] = useState<Phase>("ready");

    // Last successful inquiry end date (ISO) for this variant — the anchor
    // for the Auto default range. Null until the history probe resolves (or
    // when the tenant has never inquired).
    const lastSuccessEndRef = useRef<string | null>(null);

    const initialRange = useMemo(() => computeAutoRange(null), []);
    const [startIso, setStartIso] = useState(initialRange.startIso);
    const [endIso, setEndIso] = useState(initialRange.endIso);
    const [warningVisible, setWarningVisible] = useState(initialRange.warning);

    const [auto, setAuto] = useState(true);
    const [autoClose, setAutoClose] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);

    // ── Scrape (local NXiSAS engine) flow ─────────────────────────────
    const scrape = useEInvoiceScrape(true);
    const [progress, setProgress] = useState(0);
    const [resultCount, setResultCount] = useState(0);
    const [resultAmount, setResultAmount] = useState(0);

    // Completed batch identity — drives the View detail popup. Captured on a
    // successful completion so it survives later date edits.
    const [batch, setBatch] = useState<{
        modDtm: string;
        startIso: string;
        endIso: string;
    } | null>(null);

    // Set true when the user stops/cancels mid-scrape so the in-flight
    // run()'s late resolution is ignored (best-effort abort — the engine
    // promise itself isn't cancellable). Reset before each run.
    const cancelledRef = useRef(false);

    const fromDt = startIso.replace(/-/g, "");
    const toDt = endIso.replace(/-/g, "");

    // Derived UI gates — one source of truth per control, keyed on `phase`.
    const showInquire = phase === "ready";
    const showStop = phase === "scraping";
    const datesLocked = auto || phase !== "ready";
    const autoLocked = phase !== "ready";

    // ── Auto default-range recompute ───────────────────────────────────
    const applyAutoRange = useCallback(() => {
        const r = computeAutoRange(lastSuccessEndRef.current);
        setStartIso(r.startIso);
        setEndIso(r.endIso);
        setWarningVisible(r.warning);
    }, []);

    // Probe the most recent SUCCESSFUL inquiry for this variant, then (if
    // still Auto + ready) recompute the default range from it. Legacy
    // derives the start from the last successful sync date (TRN_LST_SUC_DTM);
    // the refactor reads it back from EXT_TRAN_CALL_HIS via the history API.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetchEInvoiceHistory({
                    type: variant,
                    from: "20000101",
                    to: todayYmd(),
                    status: "success",
                });
                if (cancelled) return;
                const latest = res.rows[0]; // backend returns REG_DTM DESC
                lastSuccessEndRef.current = latest ? ymdToIso(latest.end_date) : null;
            } catch {
                if (!cancelled) lastSuccessEndRef.current = null;
            }
            // Only own the dates while Auto is on and we're pre-inquiry.
            if (!cancelled && auto && phase === "ready") applyAutoRange();
        })();
        return () => {
            cancelled = true;
        };
        // Probe once per variant on mount; the guard inside protects against
        // clobbering a user who has already unchecked Auto / started a scrape.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variant]);

    // ── Reset to the initial `ready` state (Stop, post-cancel) ─────────
    const resetToReady = useCallback(() => {
        cancelledRef.current = false;
        setPhase("ready");
        setProgress(0);
        setResultCount(0);
        setResultAmount(0);
        setBatch(null);
        setAuto(true);
        applyAutoRange();
    }, [applyAutoRange]);

    // ── Auto checkbox toggle ───────────────────────────────────────────
    const onToggleAuto = (checked: boolean) => {
        if (phase !== "ready") return; // locked once scraping/completed
        setAuto(checked);
        // Re-checking Auto recomputes + resets the range (+ warning); unchecking
        // simply unlocks the picker, leaving the current range editable.
        if (checked) applyAutoRange();
    };

    // ── Stop / Cancel (confirm → stop engine → reset) ──────────────────
    const stopScrape = useCallback(() => {
        cancelledRef.current = true;
        // Best-effort engine abort (legacy `_v2nxisas.stopAllNxisas`); the
        // engine promise isn't truly cancellable, so `cancelledRef` guards
        // the late resolution from mutating state after reset.
        try {
            (window as unknown as {
                _v2nxisas?: { stopAllNxisas?: (cb: () => void) => void };
            })._v2nxisas?.stopAllNxisas?.(() => {});
        } catch {
            /* engine not present (localhost / OQ-S1) — reset regardless */
        }
        resetToReady();
    }, [resetToReady]);

    const confirmStop = () => {
        dialog.open({
            type: "confirmation",
            title: t("dialog.confirmation"),
            description: t("einvoice_update.stop_confirm"),
            confirmText: t("dialog.yes"),
            cancelText: t("dialog.no"),
            onConfirm: stopScrape,
        });
    };

    // ── Close handling (mid-scrape → confirm+stop, else close) ─────────
    const handleRequestClose = () => {
        if (phase === "scraping") {
            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("einvoice_update.close_confirm"),
                confirmText: t("dialog.yes"),
                cancelText: t("dialog.no"),
                onConfirm: () => {
                    stopScrape();
                    onClose();
                },
            });
            return;
        }
        onClose();
    };

    // ── Real-Time Online Inquire ───────────────────────────────────────
    // Silent GDT credential fetch (legacy getCertInfo / gdtc_0001_001_r001 —
    // NO password re-entry) then the two-phase local-engine scrape.
    const handleInquire = async () => {
        if (phase === "scraping") return;

        // Legacy max date-range guard (nxisas_einvoice.js:275 → WBI1122).
        if (daysBetween(startIso, endIso) > MAX_RANGE_DAYS) {
            dialog.open({
                type: "warning",
                title: t("dialog.warning"),
                description: t("einvoice_update.max_one_month"),
            });
            return;
        }

        if (scrape.engineStatus !== "ready") {
            const key =
                scrape.engineStatus === "not_installed" ||
                scrape.engineStatus === "unsupported_os"
                    ? "einvoice_update.engine_not_installed"
                    : "einvoice_update.engine_error";
            dialog.open({
                type: "warning",
                title: t("dialog.warning"),
                description: t(key),
            });
            return;
        }

        cancelledRef.current = false;
        const inquiredStart = startIso;
        const inquiredEnd = endIso;

        try {
            const list = await fetchLoginCredentials();
            const gdtGroup = list.items.find((g) => g.type === "GDT");
            const acct = gdtGroup?.accounts?.[0];
            if (!acct) {
                dialog.open({
                    type: "warning",
                    title: t("dialog.warning"),
                    description: t("einvoice_update.no_credential"),
                });
                return;
            }

            // Enter the scraping state — hides Inquire, shows Stop, locks
            // dates / calendar / Auto. The bar stays at 0% until the engine's
            // first milestone (25%). The former refactor-only 15%
            // credential-fetch step was removed (2026-07-14) so the milestones
            // match legacy exactly: 0 → 25 → 35 → 50 → 100.
            setPhase("scraping");

            const cred = await fetchGdtScrapingCredential(acct.seq_no);

            const { outcome, saved, detailSaved, captchaExceeded } = await scrape.run({
                cert: {
                    seqNo: acct.seq_no,
                    loginId: cred.login_id ?? acct.login_id ?? "",
                    password: cred.password ?? "",
                },
                type: variant,
                fromDt,
                toDt,
                onProgress: (pct) => {
                    if (!cancelledRef.current) setProgress(pct);
                },
            });

            // Stopped mid-flight — the reset already ran; ignore the result.
            if (cancelledRef.current) return;

            // GDT captcha wrong 3+ times — legacy WBE6121 (failed state).
            if (captchaExceeded) {
                enterFailed(
                    "error",
                    t("einvoice_update.captcha_exceeded"),
                    "WBE6121",
                );
                return;
            }

            // Login / 2nd-cert failure — no save performed (legacy parity).
            if (outcome.loginFailed || !saved) {
                enterFailed(
                    "error",
                    outcome.rsltMsg || t("einvoice_update.login_failed"),
                    outcome.rsltCd || "NXISAS",
                );
                return;
            }

            // ── Success (incl. ZERO results — treated as a normal
            // completed inquiry, NOT a warning). ──
            setResultCount(saved.saved_count + saved.updated_count);
            setResultAmount(
                outcome.invoices.reduce(
                    (sum, r) => sum + (Number(r.total_amt) || 0),
                    0,
                ),
            );
            // Batch id — the phase-1 mod_dtm (preserved through phase 2 by
            // the backend), keyed for the View detail popup.
            setBatch({
                modDtm: saved.mod_dtm || detailSaved?.mod_dtm || "",
                startIso: inquiredStart,
                endIso: inquiredEnd,
            });
            setProgress(100);
            setPhase("completed");
            onScraped?.();

            // Tax-authority partial warning stays informational — the modal
            // still shows the completed state underneath.
            if (outcome.rsltCd !== "00000000") {
                dialog.open({
                    type: "warning",
                    title: t("dialog.warning"),
                    description: outcome.rsltMsg || t("einvoice_update.partial"),
                });
            }

            if (autoClose) onClose();
        } catch (err) {
            if (cancelledRef.current) return;
            const code = err instanceof ApiCallError ? err.code : "NETWORK";
            const message =
                err instanceof ApiCallError
                    ? err.message
                    : t("einvoice_update.engine_error");
            enterFailed("error", message, code);
        }
    };

    const enterFailed = (
        _type: "error",
        description: string,
        errorCode: string,
    ) => {
        setProgress(100);
        setPhase("failed");
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description,
            errorCode,
        });
    };

    const cardTitle =
        variant === "SALES"
            ? t("einvoice_update.card.sales_title")
            : t("einvoice_update.card.expenses_title");
    const rowLabel =
        variant === "SALES"
            ? t("einvoice_update.row.sales")
            : t("einvoice_update.row.expenses");

    const statusText =
        phase === "scraping"
            ? t("einvoice_update.in_progress")
            : phase === "completed"
              ? t("einvoice_update.completed")
              : phase === "failed"
                ? t("einvoice_update.failed")
                : "";

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
                    closeOnOutsideClick={false}
                    closeOnEscape
                >
                    <div className="flex w-full flex-col px-5 py-6">
                        {/* ── Header ─────────────────────────────────────── */}
                        <div className="flex flex-col gap-0">
                            <DialogTitle asChild>
                                <h2 className="text-wb-16 font-semibold leading-[18px] text-wb-dark">
                                    {t("einvoice_update.title")}
                                </h2>
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                {t("einvoice_update.subtitle")}
                            </DialogDescription>
                        </div>

                        {/* ── History — top-right (no admin-only Setting
                           button: GDT credentials live under Settings →
                           Login Credentials, not this modal). */}
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setHistoryOpen(true)}
                                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                                aria-label={t("einvoice_update.history")}
                            >
                                <HistoryIcon className="size-4" />
                                {t("einvoice_update.history")}
                            </button>
                        </div>

                        {/* ── Date range row with red "required" dot + Auto ──── */}
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1 text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                                {t("einvoice_update.dates")}
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
                                separator="~"
                                expandRight
                                portalled
                                disabled={datesLocked}
                            />
                            <label
                                htmlFor="einvoice-update-auto"
                                className={cn(
                                    "ml-2 inline-flex items-center gap-1.5 text-wb-14 font-medium leading-4 text-wb-ink",
                                    autoLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                                )}
                            >
                                <Checkbox
                                    id="einvoice-update-auto"
                                    checked={auto}
                                    disabled={autoLocked}
                                    onCheckedChange={(v) => onToggleAuto(v === true)}
                                />
                                <span>{t("einvoice_update.auto")}</span>
                                <Tooltip
                                    content={t("einvoice_update.auto_tooltip")}
                                    placement="top"
                                    className="inline-flex"
                                >
                                    <InfoIcon />
                                </Tooltip>
                            </label>
                        </div>

                        {/* ── Warning — only when the range was clamped ──── */}
                        {warningVisible && (
                            <p className="mt-3 text-wb-13 font-medium leading-4 text-wb-status-rejected-text">
                                {t("einvoice_update.warning")}
                            </p>
                        )}

                        {/* ── Progress bar ────────────────────────────────
                           INTENTIONAL refactor design (NOT legacy parity):
                           the fill is a single brand-blue for Ready / Scraping
                           / Completed — the refactor deliberately keeps its own
                           blue design and does NOT adopt the legacy olive-green
                           (#B5CC18), and does NOT switch color on completion.
                           Only the failed state diverges to red (the approved
                           refactor failure style, preserved). Track stays
                           #f5f5f5. See update-einvoice-progressbar-final.md. */}
                        <div className="mt-4 h-8 w-full overflow-hidden rounded-md border border-wb-border-sidebar bg-[#f5f5f5]">
                            <div
                                data-testid="einvoice-progress-fill"
                                className={cn(
                                    "h-full transition-[width] duration-300",
                                    phase === "failed" ? "bg-wb-status-rejected-text" : "bg-brand",
                                )}
                                style={{ width: `${progress}%` }}
                                aria-hidden
                            />
                        </div>

                        {/* ── Status text (In Progress / Completed / Failed) ──
                           Completed uses brand-blue to match the bar (no green);
                           failed stays red. */}
                        {statusText && (
                            <p
                                className={cn(
                                    "mt-2 text-center text-wb-13 font-semibold",
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

                        {/* ── Summary card ───────────────────────────────── */}
                        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-wb-ntrl-4 bg-white p-3">
                            <div className="flex items-center justify-between">
                                <span className="text-wb-16 font-semibold leading-6 text-wb-dark">
                                    {cardTitle}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1 border-b border-wb-ntrl-4 pb-2">
                                <div className="flex items-center justify-between py-1 text-wb-14 font-medium">
                                    <div className="flex items-center gap-4 text-wb-ink">
                                        <span className="w-[104px] shrink-0 leading-6 opacity-70">
                                            {rowLabel}
                                        </span>
                                        <span className="w-[132px] shrink-0">
                                            {t("einvoice_update.result_count", {
                                                count: String(resultCount),
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="w-[112px] shrink-0 text-right text-wb-ink">
                                            {formatAmount(resultAmount, "VND")}
                                        </span>
                                        {/* View — shown only after a successful
                                           completion (incl. zero results), keyed
                                           on the batch mod_dtm. Never on failure. */}
                                        <span className="w-[44px] shrink-0 text-right">
                                            {phase === "completed" && batch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setViewOpen(true)}
                                                    className="cursor-pointer text-wb-14 font-medium text-brand hover:underline"
                                                >
                                                    {t("einvoice_update.view")}
                                                </button>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Primary CTA — Inquire (ready) / Stop (scraping).
                           Hidden in completed + failed (legacy parity). ── */}
                        {showInquire && (
                            <button
                                type="button"
                                onClick={handleInquire}
                                className="mt-5 flex h-9 w-full cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                            >
                                {t("einvoice_update.inquire")}
                            </button>
                        )}
                        {showStop && (
                            <button
                                type="button"
                                onClick={confirmStop}
                                className="mt-5 flex h-9 w-full cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-status-rejected-text shadow-wb-btn hover:bg-black/[0.03]"
                            >
                                {t("einvoice_update.stop")}
                            </button>
                        )}

                        {/* ── Divider + auto-close checkbox below ────────── */}
                        <div className="mt-5 border-t border-wb-border-sidebar pt-3">
                            <label
                                htmlFor="einvoice-update-auto-close"
                                className="inline-flex cursor-pointer items-center gap-1.5 text-wb-14 font-medium leading-4 text-wb-ink"
                            >
                                <Checkbox
                                    id="einvoice-update-auto-close"
                                    checked={autoClose}
                                    onCheckedChange={(v) => setAutoClose(v === true)}
                                />
                                <span>{t("einvoice_update.auto_close")}</span>
                            </label>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            {historyOpen && (
                <EInvoiceHistoryDialog
                    variant={variant}
                    startIso={startIso}
                    endIso={endIso}
                    onClose={() => setHistoryOpen(false)}
                />
            )}
            {viewOpen && batch && (
                <EInvoiceDetailHistoryDialog
                    variant={variant}
                    modDtm={batch.modDtm}
                    startIso={batch.startIso}
                    endIso={batch.endIso}
                    onClose={() => setViewOpen(false)}
                />
            )}
        </>
    );
}

/** Legacy max scrape range — 1 month (nxisas_einvoice.js:275). The task
 *  pins the cap at 30 days; both the inquire-time guard and the Auto clamp
 *  boundary use it. */
const MAX_RANGE_DAYS = 30;

/** Whole-day distance between two `YYYY-MM-DD` ISO dates (end − start). */
function daysBetween(startIso: string, endIso: string): number {
    const start = Date.parse(`${startIso}T00:00:00Z`);
    const end = Date.parse(`${endIso}T00:00:00Z`);
    if (Number.isNaN(start) || Number.isNaN(end)) return 0;
    return Math.round((end - start) / 86_400_000);
}

type AutoRange = {
    startIso: string;
    endIso: string;
    /** True when the last-success date was older than the 30-day window and
     *  the start had to be clamped — surfaces the un-inquired-period note. */
    warning: boolean;
};

/**
 * Compute the Auto default range (legacy `getInitStartDate`):
 * start = last successful inquiry date, end = today, clamped to a 30-day
 * window. When there is no last-success date (never inquired) → plain
 * last-30-days, no warning. When the last-success date is older than the
 * window → clamp the start to the boundary + raise the warning.
 */
function computeAutoRange(lastSuccessEndIso: string | null): AutoRange {
    const end = new Date();
    const endIso = iso(end);
    const floor = new Date();
    floor.setDate(end.getDate() - MAX_RANGE_DAYS);
    const floorIso = iso(floor);

    if (!lastSuccessEndIso) {
        return { startIso: floorIso, endIso, warning: false };
    }
    if (lastSuccessEndIso < floorIso) {
        // Un-inquired gap older than the window — clamp + warn.
        return { startIso: floorIso, endIso, warning: true };
    }
    if (lastSuccessEndIso > endIso) {
        // Defensive: a future/garbage date — fall back to the window.
        return { startIso: floorIso, endIso, warning: false };
    }
    return { startIso: lastSuccessEndIso, endIso, warning: false };
}

function iso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/** Today as `YYYYMMDD` (wire form for the history probe). */
function todayYmd(): string {
    return iso(new Date()).replace(/-/g, "");
}

/** `YYYYMMDD` → ISO `YYYY-MM-DD`; blank / malformed → null-safe empty. */
function ymdToIso(ymd: string | null | undefined): string | null {
    if (!ymd) return null;
    const v = ymd.trim();
    if (!/^\d{8}$/.test(v)) return null;
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}
