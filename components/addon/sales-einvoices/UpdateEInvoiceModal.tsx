"use client";

import { useMemo, useState } from "react";
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
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

type Props = {
    /** Drives the card title + translation lookups so the same modal
     *  serves Sales and Expenses without forking the component. */
    variant: "SALES" | "EXPENSE";
    /** Close the dialog (clears `open` on the parent). */
    onClose: () => void;
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
export default function UpdateEInvoiceModal({ variant, onClose }: Props) {
    const { t } = useTranslation();

    const defaultRange = useMemo(defaultLast30Days, []);
    const [startIso, setStartIso] = useState(defaultRange.startIso);
    const [endIso, setEndIso] = useState(defaultRange.endIso);

    const [auto, setAuto] = useState(true);
    const [autoClose, setAutoClose] = useState(false);

    const cardTitle =
        variant === "SALES"
            ? t("einvoice_update.card.sales_title")
            : t("einvoice_update.card.expenses_title");
    const rowLabel =
        variant === "SALES"
            ? t("einvoice_update.row.sales")
            : t("einvoice_update.row.expenses");

    return (
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
                            // Static — History hookup deferred to the
                            // wired MR.
                            onClick={() => { /* TODO: open History popup */ }}
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
                            formatValue={formatDateChipNumeric}
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

                    {/* ── Progress bar slot — empty/idle static state. */}
                    <div className="mt-4 h-8 w-full overflow-hidden rounded-md border border-wb-border-sidebar bg-white" />

                    {/* ── Summary card ─────────────────────────────────
                       Mirrors the Banking popup's BANK ACCOUNTS block:
                       header band + a single totals row with
                       <label> · <count> · <amount>. Typography matches
                       Settings table convention: 14px / medium body,
                       14px / semibold header. */}
                    <div className="mt-4 rounded-md border border-wb-border-sidebar bg-white">
                        <div className="flex items-center justify-between border-b border-wb-border-sidebar bg-wb-bg-sidebar/60 px-4 py-2.5">
                            <span className="text-wb-14 font-semibold leading-4 text-wb-ink">
                                {cardTitle}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                            <span className="w-20 shrink-0 text-wb-14 font-medium leading-4 text-wb-ink">
                                {rowLabel}
                            </span>
                            <span className="flex-1 text-wb-14 font-normal leading-4 text-wb-ink">
                                {t("einvoice_update.result_count", { count: "0" })}
                            </span>
                            <span className="text-wb-14 font-semibold leading-4 text-wb-ink">
                                {formatAmount(0, "VND")}
                            </span>
                        </div>
                    </div>

                    {/* ── Primary CTA — full-width pill, Settings
                       primary chrome (h-9 / text-wb-14-tight / 500 /
                       rounded-md / shadow-wb-brand-btn). */}
                    <button
                        type="button"
                        // Static — Real-Time Online Inquire is wired in
                        // the API-integration MR.
                        onClick={() => { /* TODO: trigger inquiry */ }}
                        className="mt-5 flex h-9 w-full cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
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
    );
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
