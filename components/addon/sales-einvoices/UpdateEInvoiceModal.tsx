"use client";

import { useMemo, useState } from "react";
import { Info, History as HistoryIcon } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import Tooltip from "@/components/shared/Tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import PasswordConfirmationDialog from "@/components/shared/popups/PasswordConfirmationDialog";
import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { fetchLoginCredentials, revealLoginCredential } from "@/lib/api/loginCredentials";
import { userStorage } from "@/lib/auth/storage";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import EInvoiceHistoryDialog from "./EInvoiceHistoryDialog";
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
 * Update e-Invoice Information popup — Add-on Service "Update" button
 * entry on both Sales e-Invoices and Expenses e-Invoices pages.
 *
 * <p>Layout mirrors the Figma {@code 9183:25340} frame and reuses the
 * same modal pattern as the Banking > Bank Transaction Sync popup
 * (see {@link components/banking/account-inquiry/TransactionSyncDialog}):
 * Settings + History buttons sit at the top-right above a Date Range
 * row with a red required dot, the warning text and progress bar slot
 * below, the per-card "Sales e-Invoice" / "Expenses e-Invoice" summary
 * with `<row> <count> <amount>`, then the full-width primary "Real-Time
 * Online Inquire" CTA. A separator + "Close the popup automatically
 * after the update." checkbox finishes the dialog.
 *
 * <p><strong>Static UI only.</strong> No backend integration yet — the
 * dates, Auto / autoClose checkboxes, Settings / History buttons, and
 * the primary CTA are inert. Real-time progress, history listing, and
 * the GDT inquiry call land in follow-up MRs.
 *
 * `stackLevel={1}` (root) — opens directly from the e-Invoices page.
 */
export default function UpdateEInvoiceModal({ variant, onClose, onScraped }: Props) {
    const { t } = useTranslation();
    const dialog = useDialog();

    const defaultRange = useMemo(() => defaultLast30Days(), []);
    const [startIso, setStartIso] = useState(defaultRange.startIso);
    const [endIso, setEndIso] = useState(defaultRange.endIso);

    const [auto, setAuto] = useState(true);
    const [autoClose, setAutoClose] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);

    // ── Scrape (local NXiSAS engine) flow ─────────────────────────────
    // Loads the engine bundle + probes install while the modal is open.
    const scrape = useEInvoiceScrape(true);
    const [progress, setProgress] = useState(0);
    const [resultCount, setResultCount] = useState(0);
    const [resultAmount, setResultAmount] = useState(0);
    // GDT credential picked for the re-auth → reveal → engine login chain.
    const [gdt, setGdt] = useState<{ seqNo: number; loginId: string } | null>(null);
    const [pwOpen, setPwOpen] = useState(false);
    const [pw, setPw] = useState("");

    const user = userStorage.get();
    const fromDt = startIso.replace(/-/g, "");
    const toDt = endIso.replace(/-/g, "");
    const running = scrape.scraping;

    // Step 1 — engine + credential gating, then open the re-auth popup.
    const handleInquire = async () => {
        if (running) return;

        // Legacy 1-month max date-range guard (nxisas_einvoice.js:275 →
        // WBI1122 "max 1 month"). The range is inclusive; > 31 calendar
        // days between start and end is rejected.
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
            setGdt({ seqNo: acct.seq_no, loginId: acct.login_id ?? "" });
            setPw("");
            setPwOpen(true);
        } catch (err) {
            showApiError(err);
        }
    };

    // Step 2 — re-auth confirmed → reveal GDT password → run the engine
    // scrape → POST results → refetch.
    const handleReauthSave = async () => {
        if (!gdt || running) return;
        setPwOpen(false);
        setProgress(15);
        try {
            const revealed = await revealLoginCredential("gdt", gdt.seqNo, {
                user_password: pw,
            });
            // Two-phase scrape: INVOICE_LIST → save, then INVOICE_DETAIL
            // → save. Progress is driven by the hook's onProgress
            // (25 list result → 35 list save → 50 detail → 100 done),
            // mirroring legacy nxisas_einvoice.js process-bar steps.
            const { outcome, saved, captchaExceeded } = await scrape.run({
                cert: {
                    seqNo: gdt.seqNo,
                    loginId: revealed.login_id ?? gdt.loginId,
                    password: revealed.password ?? "",
                },
                type: variant,
                fromDt,
                toDt,
                onProgress: setProgress,
            });

            // GDT captcha entered wrong 3+ times — legacy WBE6121.
            if (captchaExceeded) {
                setProgress(0);
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("einvoice_update.captcha_exceeded"),
                    errorCode: "WBE6121",
                });
                return;
            }

            // Login / 2nd-cert failure — no save performed (legacy parity).
            if (outcome.loginFailed || !saved) {
                setProgress(0);
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: outcome.rsltMsg || t("einvoice_update.login_failed"),
                    errorCode: outcome.rsltCd || "NXISAS",
                });
                return;
            }

            setResultCount(saved.saved_count + saved.updated_count);
            setResultAmount(
                outcome.invoices.reduce(
                    (sum, r) => sum + (Number(r.total_amt) || 0),
                    0,
                ),
            );
            onScraped?.();

            if (outcome.invoices.length === 0) {
                // No GDT invoices in range — informational (legacy shows
                // "0 result(s)" + Completed, not an error).
                dialog.open({
                    type: "warning",
                    title: t("dialog.warning"),
                    description: t("einvoice_update.no_data"),
                });
            } else if (outcome.rsltCd !== "00000000") {
                dialog.open({
                    type: "warning",
                    title: t("dialog.warning"),
                    description: outcome.rsltMsg || t("einvoice_update.partial"),
                });
            } else {
                dialog.open({
                    type: "success",
                    title: t("dialog.success"),
                    description: t("einvoice_update.success"),
                });
                if (autoClose) onClose();
            }
        } catch (err) {
            setProgress(0);
            showApiError(err);
        }
    };

    const showApiError = (err: unknown) => {
        const code = err instanceof ApiCallError ? err.code : "NETWORK";
        const message =
            err instanceof ApiCallError ? err.message : t("einvoice_update.engine_error");
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: message,
            errorCode: code,
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

                    {/* ── History — top-right above filter row.
                       Chrome matches Settings-popup small action button:
                       h-8, text-wb-14-tight / 500, rounded-md, shadow-wb-btn. */}
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
                            // `expandRight` anchors the dual-month
                            // popover to the **start chip's** left edge
                            // (via the picker's internal containerRect
                            // override) so the popover sits cleanly
                            // below the date row and extends rightward —
                            // mirroring the legacy WeCMS layout. The
                            // popover is portalled to document.body so
                            // its 700px width visually extends past the
                            // 540px modal's right edge without being
                            // clipped.
                            expandRight
                            portalled
                            disabled={auto}
                        />
                        <label
                            htmlFor="einvoice-update-auto"
                            className="ml-2 inline-flex cursor-pointer items-center gap-1.5 text-wb-14 font-medium leading-4 text-wb-ink"
                        >
                            <Checkbox
                                id="einvoice-update-auto"
                                checked={auto}
                                onCheckedChange={(v) => setAuto(v === true)}
                            />
                            <span>{t("einvoice_update.auto")}</span>
                            <Tooltip
                                content={t("einvoice_update.auto_tooltip")}
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

                    {/* ── Warning message — matches Figma red helper text */}
                    <p className="mt-3 text-wb-13 font-medium leading-4 text-wb-status-rejected-text">
                        {t("einvoice_update.warning")}
                    </p>

                    {/* ── Progress bar — driven by the scrape flow
                       (0 idle → 20 reveal → 40 engine → 100 done). */}
                    <div className="mt-4 h-8 w-full overflow-hidden rounded-md border border-wb-border-sidebar bg-[#f5f5f5]">
                        <div
                            className="h-full bg-brand transition-[width] duration-300"
                            style={{ width: `${progress}%` }}
                            aria-hidden
                        />
                    </div>

                    {/* ── Summary card ─────────────────────────────────
                       Mirrors the Bank Transaction Sync "Bank Accounts"
                       card (Figma 9183:25377): padded card with a
                       16/24 semibold title row and a row block wrapped
                       in border-b + pb-2. Single source of visual truth
                       across both popups. */}
                    <div className="mt-4 flex flex-col gap-2 rounded-lg border border-wb-ntrl-4 bg-white p-3">
                        {/* Header row */}
                        <div className="flex items-center justify-between">
                            <span className="text-wb-16 font-semibold leading-6 text-wb-dark">
                                {cardTitle}
                            </span>
                        </div>
                        {/* Result row block — single row today; the
                           wrapping border-b + pb-2 mirrors the Credit/
                           Debit block so adding a sibling row later
                           drops in without restructuring. */}
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
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Primary CTA — full-width pill, Settings
                       primary chrome (h-9 / text-wb-14-tight / 500 /
                       rounded-md / shadow-wb-brand-btn). */}
                    <button
                        type="button"
                        onClick={handleInquire}
                        disabled={running}
                        aria-busy={running || undefined}
                        className={cn(
                            "mt-5 flex h-9 w-full items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover",
                            running ? "cursor-wait opacity-60" : "cursor-pointer",
                        )}
                    >
                        {t("einvoice_update.inquire")}
                    </button>

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
        {pwOpen && (
            <PasswordConfirmationDialog
                accessibleTitle={t("einvoice_update.title")}
                companyName={user?.companyName ?? ""}
                userEmail={user?.userId ?? ""}
                value={pw}
                onChange={setPw}
                onClose={() => setPwOpen(false)}
                onSave={handleReauthSave}
                saveDisabled={pw.trim().length === 0}
                passwordAriaLabel={t("einvoice_update.password_aria")}
                stackLevel={3}
            />
        )}
        </>
    );
}

/** Legacy max scrape range — 1 month (nxisas_einvoice.js:275 rejects a
 *  range whose start is more than 30 days before the end). Inclusive
 *  ranges up to 31 calendar days pass. */
const MAX_RANGE_DAYS = 31;

/** Whole-day distance between two `YYYY-MM-DD` ISO dates (end − start). */
function daysBetween(startIso: string, endIso: string): number {
    const start = Date.parse(`${startIso}T00:00:00Z`);
    const end = Date.parse(`${endIso}T00:00:00Z`);
    if (Number.isNaN(start) || Number.isNaN(end)) return 0;
    return Math.round((end - start) / 86_400_000);
}

type DefaultRange = {
    startIso: string;
    endIso: string;
};

/** "Last 30 days" — local-date based. Chips render locale-aware via the
 *  shared DateField default (EN DD-MMM-YYYY / KO YYYY-MM-DD / VI DD-MM-YYYY). */
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
