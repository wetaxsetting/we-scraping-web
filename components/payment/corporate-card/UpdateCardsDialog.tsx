"use client";

import { useCallback, useEffect, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import DateField, { formatDateChipNumeric } from "@/components/shared/DateField";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { fetchActiveCards } from "@/lib/api/cardTransactions";
import {
    _nxisas_cardTranList,
    configureRuntime,
    type NxisasCardOrgItem,
    type ShowMessageOptions,
} from "@/lib/nxisas/nxisas_cardTranList";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type UpdateCardsDialogProps = {
    /** Closes the dialog. */
    onClose:   () => void;
    /** Fired after the scrape completes — parent (Card Transactions
     *  page) bumps its refresh-key so the ledger re-fetches with the
     *  freshly-scraped data. The {@code range} carries the
     *  {@code yyyymmdd} window the scrape actually pulled (always
     *  populated; the dialog's local state at click time) so the
     *  parent page can widen its date filter to cover the inserted
     *  rows — without this, rows older than the parent's default
     *  30-day window would land in the DB but never appear in the
     *  table. */
    onSuccess?: (range: { fromDt: string; toDt: string }) => void;
};

/**
 * Card Transactions &gt; Update — opens from the Update button.
 * Mirrors legacy {@code nxisas_cardTranList_view.jsp} ("Real-Time
 * Online Inquire" popup) with the refactor's collapsed single-request
 * shape.
 *
 * <h2>Layout</h2>
 *
 * <p>One horizontal row holding the two date chips bracketed by an
 * {@code ~} separator and followed by the Auto checkbox; helper text
 * in blue below; idle / progress bar; footer with Cancel + Update on
 * the right.
 *
 * <h2>Auto mode</h2>
 *
 * <p>When the Auto checkbox is checked, the two date chips disable and
 * the request rides through with {@code auto: true} — the server
 * derives the date range from {@code min(TRN_LST_SUC_DTM)} of the
 * cards being synced (falls back to today − 90 days when no card has
 * ever been synced) and pins the end to today. Mirrors legacy parity.
 */
export default function UpdateCardsDialog({
    onClose,
    onSuccess,
}: UpdateCardsDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    // Default range — last 3 months → today (legacy parity).
    const [fromIso, setFromIso] = useState(() => isoSubtract(today(), 3, "months"));
    const [toIso,   setToIso]   = useState(today);
    const [auto,    setAuto]    = useState(true);

    const [inFlight, setInFlight] = useState(false);

    // Mirrors legacy nxisas_cardTranList.ts:57-66 `onload`. The
    // parent JSP (card_0001_001) used to load the visible card
    // list and pass it as `dataJson`; the refactor doesn't have
    // a parent-side card list yet, so the dialog fetches it
    // through the existing `/cards` endpoint and feeds the nxisas
    // module so `orgObj` console block can show cert-grouped
    // detail.
    useEffect(() => {
        let cancelled = false;

        // Wire the legacy-shape runtime: `_v2common.app.showMessage`
        // routes through `useDialog`, `closeLayerPopup` calls our
        // dialog's onClose, `card_0001_001.loadData(...)` calls
        // onSuccess. This way the cloned module's
        // `_v2common.app.showMessage("WBI1131", ...)` /
        // `WBI1122` / `WBI1123` / `WBC1153` ride through verbatim.
        configureRuntime({
            showMessage: (code, opts?: ShowMessageOptions) => {
                if (code === "WBI1131") {
                    // "The inquiry has been finished."
                    dialog.open({
                        type:        "success",
                        title:       t("dialog.success"),
                        description: t("payment.card.update_cards.inquiry_finished"),
                        onConfirm:   () => {
                            if (opts?.onResult) opts.onResult(true);
                            else onClose();
                        },
                    });
                } else if (code === "WBI1122") {
                    // "The selected date range exceeds the maximum {MAX_PERIOD} {MAX_PERIOD_TYPE}."
                    const maxPeriod     = String(opts?.dataObj?.MAX_PERIOD     ?? "");
                    const maxPeriodType = String(opts?.dataObj?.MAX_PERIOD_TYPE ?? "");
                    dialog.open({
                        type:        "warning",
                        title:       t("dialog.warning"),
                        description: t("payment.card.update_cards.range_out_of_limit", {
                            max_period:      maxPeriod,
                            max_period_type: maxPeriodType,
                        }),
                    });
                } else if (code === "WBI1123") {
                    // "Inquiry cancelled" — legacy stopAllNxisas flow.
                    dialog.open({
                        type:        "warning",
                        title:       t("dialog.warning"),
                        description: t("payment.card.update_cards.cancelled"),
                        onConfirm:   () => {
                            if (opts?.onResult) opts.onResult(true);
                        },
                    });
                } else if (code === "WBC1153") {
                    // "An inquiry is in progress — cancel?" — legacy
                    // close-during-scrape confirm.
                    dialog.open({
                        type:        "confirmation",
                        title:       t("dialog.confirmation"),
                        description: t("payment.card.update_cards.cancel_confirm"),
                        confirmText: t("dialog.yes"),
                        cancelText:  t("dialog.no"),
                        onConfirm:   () => { if (opts?.onResult) opts.onResult(true); },
                    });
                } else {
                    // Generic error pass-through.
                    dialog.open({
                        type:        "error",
                        title:       t("dialog.error"),
                        description: String(code),
                        errorCode:   code,
                    });
                }
            },
            closeLayerPopup: (callback?: () => void) => {
                onClose();
                if (callback) callback();
            },
            parentLoadData: () => {
                // Legacy fired this on WBI1131 OK-click. The refactor
                // now triggers `onSuccess(range)` directly in
                // `handleUpdate` after `runUpdate` resolves (so the
                // parent's date filter widens before the user sees
                // the refreshed table). This branch is a no-op to
                // avoid a redundant refresh.
            },
        });

        (async () => {
            try {
                const res = await fetchActiveCards();
                if (cancelled) return;
                const orgData: NxisasCardOrgItem[] = (res.cards ?? []).map((c) => ({
                    BANK_CD:         c.bank_cd,
                    BANK_NM:         c.bank_nm,
                    ACCT_NO:         c.card_no,
                    BANK_CERT_SEQ:   "",
                    ACCT_TYPE_CD:    null,
                    TRN_LST_SUC_DTM: null,
                }));
                await _nxisas_cardTranList.onload({ orgData, ccyCd: "VND" });
            } catch {
                // Non-fatal — the backend orchestrator does its own
                // card lookup. The module state stays at defaults
                // and the `orgObj` console block reads as `[]`
                // instead of the cert-grouped detail.
            }
        })();
        return () => { cancelled = true; };
    }, [dialog, onClose, onSuccess, t]);

    const handleFromChange = useCallback((iso: string) => {
        setFromIso(iso);
        if (iso > toIso) setToIso(iso);
    }, [toIso]);

    const handleToChange = useCallback((iso: string) => {
        setToIso(iso);
        if (iso < fromIso) setFromIso(iso);
    }, [fromIso]);

    const handleUpdate = useCallback(async () => {
        if (inFlight) return;
        setInFlight(true);

        const fromYyyymmdd = isoToYyyymmdd(fromIso);
        const toYyyymmdd   = isoToYyyymmdd(toIso);

        try {
            // Dispatch via the cloned nxisas_cardTranList module —
            // the click body is line-for-line equivalent to legacy
            // `$(_ui).on("click", "#btn_update_card", function () { ... })`.
            // WBI1122 (range guard) and WBI1131 (success) popups are
            // fired by the module itself via `_v2common.app.showMessage`,
            // which we wired to `useDialog` in the configureRuntime
            // call inside the mount effect.
            const result = await _nxisas_cardTranList.runUpdate({
                startDate: fromYyyymmdd,
                endDate:   toYyyymmdd,
                auto,
            });
            if (result.ok && !result.rangeError) {
                // Hand the scrape window back to the parent so it
                // can widen its date filter to cover any inserted
                // rows that fall outside the default 30-day display
                // window. Fires AFTER the WBI1131 popup is shown
                // but BEFORE the user clicks OK, so the parent
                // refresh is already done by the time the dialog
                // closes — the freshly-scraped rows appear
                // immediately.
                onSuccess?.({ fromDt: fromYyyymmdd, toDt: toYyyymmdd });
            }
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : t("payment.card.update_cards.error.failed");
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        } finally {
            setInFlight(false);
        }
    }, [auto, dialog, fromIso, inFlight, t, toIso]);

    return (
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
                // calendar renders into document.body so a click on a
                // day cell counts as "outside this DialogContent" to
                // Radix, which would otherwise dismiss the Update Cards
                // modal — collapsing the calendar before the day-cell
                // onClick runs. Same precedent as TransactionSyncDialog
                // (CLAUDE.md §"Modal stack — interaction & close
                // behaviour" rule 3). ESC still dismisses so the user
                // can cancel mid-edit.
                closeOnOutsideClick={false}
                className="max-w-[640px] gap-0 rounded-2xl p-0"
            >
                <div className="flex flex-col gap-5 px-6 py-5">
                    {/* Header */}
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold text-wb-dark">
                            {t("payment.card.update_cards.title")}
                        </h2>
                    </DialogTitle>

                    {/* Date-range row — Start Date · ~ · End Date · Auto.
                       flex-nowrap keeps the Auto chip pinned next to
                       the dates. When Auto is checked the chip cluster
                       greys out + ignores pointer events. */}
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
                                    formatValue={formatDateChipNumeric}
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
                                    formatValue={formatDateChipNumeric}
                                    iconInside
                                    portalled
                                    ariaLabelKey="payment.card.update_cards.end_date"
                                />
                            </div>
                        </div>

                        <AutoCheckbox
                            checked={auto}
                            onChange={setAuto}
                            label={t("payment.card.update_cards.auto")}
                        />
                    </div>

                    {/* Blue helper text — legacy comm_0218 popup
                       "auto setting" hint. */}
                    <p className="text-wb-13 font-medium leading-snug text-brand">
                        {t("payment.card.update_cards.helper")}
                    </p>

                    {/* Idle / progress bar — flips to an indeterminate
                       animation while the scrape is in flight.
                       Completion is signalled by the WBI1131 success
                       popup (`The inquiry has been finished.`). */}
                    <ProgressBar inFlight={inFlight} />

                    {/* Footer — Cancel + Update right-aligned. */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={inFlight}
                            className="flex h-9 cursor-pointer items-center justify-center rounded-md bg-white px-4 text-wb-14-tight font-medium text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={handleUpdate}
                            disabled={inFlight}
                            className={cn(
                                "flex h-9 cursor-pointer items-center justify-center rounded-md px-4 text-wb-14-tight font-medium text-white shadow-wb-brand-btn",
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
    );
}

/* --------------------------------------------------------------------
 *  Small sub-components
 * ------------------------------------------------------------------ */

/** Field label with the required-asterisk dot styled per the screenshot. */
function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <span className="flex items-center gap-1 text-wb-14-tight font-medium text-wb-dark">
            {children}
            <span aria-hidden className="text-wb-status-rejected-text">•</span>
        </span>
    );
}

/** Auto checkbox — same visual as the system checkbox primitive
 *  (square 18px, brand-blue when checked). */
function AutoCheckbox({
    checked, onChange, label,
}: {
    checked:  boolean;
    onChange: (next: boolean) => void;
    label:    string;
}) {
    return (
        <label className="flex cursor-pointer select-none items-center gap-2 text-wb-14-tight font-medium text-wb-dark">
            <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onChange(!checked)}
                className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded border transition-colors",
                    checked
                        ? "border-brand bg-brand text-white"
                        : "border-wb-ntrl-4 bg-white hover:border-wb-ntrl-6",
                )}
            >
                {checked && (
                    <svg
                        aria-hidden
                        className="size-3"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M2 6.5L5 9.5L10 3.5" />
                    </svg>
                )}
            </button>
            <span>{label}</span>
        </label>
    );
}

/** Idle gray bar that flips to an indeterminate animation while
 *  {@code inFlight}. Mirrors legacy {@code .process-bar > progress}
 *  — height tuned to match the live JEX popup's progress strip. */
function ProgressBar({ inFlight }: { inFlight: boolean }) {
    return (
        <div className="h-7 w-full overflow-hidden rounded-md bg-wb-ntrl-3">
            {inFlight && (
                <div className="h-full w-1/3 animate-pulse rounded-md bg-brand/60" />
            )}
        </div>
    );
}

/* --------------------------------------------------------------------
 *  Pure helpers
 * ------------------------------------------------------------------ */

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

