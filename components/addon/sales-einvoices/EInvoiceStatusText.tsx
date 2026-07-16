"use client";

import { matchInvoiceStatus, type LogicalInvoiceStatus } from "@/lib/api/einvoiceStatus";
import { cn } from "@/lib/utils";

type EInvoiceStatusTextProps = {
    /** Raw {@code EINV_INVOICESTATUS} from the wire (the stored Vietnamese
     *  string in the refactor — Phase 2 returns it verbatim per IR-4). Used
     *  ONLY to resolve the logical state for the colour token; the regex
     *  matcher recognises the same state across vi / en / ko forms. */
    value: string;
    /** Localised display label (e.g. "Original") resolved by the caller from
     *  {@link matchInvoiceStatus} + the page's `filter.status.*` i18n keys, so
     *  the cell reads translated like legacy `wb_get_invoice_status(...)` —
     *  not the raw stored Vietnamese. Falls back to {@code value} when omitted. */
    label?: string;
    align?: "left" | "right";
    className?: string;
};

/**
 * Regex-coloured invoice-status text. Mirrors the legacy
 * {@code einv_0001_001.ts.loadTextColorInvBillOut} mapping —
 * {@code original} renders blue, {@code replacement} / {@code replaced}
 * / {@code adjustment} / {@code adjusted} render green, {@code cancelled}
 * renders red, and any unrecognised string falls through to the standard
 * ink colour.
 *
 * <p>Frontend MR B chose plain coloured text over a pill so the badge
 * doesn't clash with the existing on-screen sub-line styling under the
 * Invoice No. column (which already uses {@code text-brand-hover}). A
 * future MR can swap this for a full pill if the design lands one.
 */
export default function EInvoiceStatusText({
    value,
    label,
    align = "left",
    className,
}: EInvoiceStatusTextProps) {
    const logical = matchInvoiceStatus(value);
    return (
        <span
            className={cn(
                "block truncate text-wb-13 font-medium",
                align === "right" && "text-right",
                COLOR_CLASS[logical],
                className,
            )}
        >
            {label ?? value}
        </span>
    );
}

const COLOR_CLASS: Record<LogicalInvoiceStatus, string> = {
    // Map mirrors legacy `cBlue` / `cGreen` / `cRed` via WB365 status
    // tokens (see app/globals.css `--color-wb-status-*-text`).
    original:    "text-wb-status-progress-text",
    replacement: "text-wb-status-pending-text",
    adjustment:  "text-wb-status-pending-text",
    replaced:    "text-wb-status-pending-text",
    adjusted:    "text-wb-status-pending-text",
    cancelled:   "text-wb-status-rejected-text",
    // Fallback for unrecognised values — the on-screen body-cell ink
    // colour, identical to other text cells in the table.
    other:       "text-wb-ink",
};
