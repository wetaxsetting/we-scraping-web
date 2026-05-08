"use client";

import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";

/**
 * Sales / Bill e-Invoices date-range filter control. Thin alias around
 * the shared {@link InteractiveDateRangePicker}: same three interactions
 * (start chip → small popup, end chip → small popup, calendar icon →
 * full range popover with presets + Apply / Cancel).
 *
 * <p>This wrapper is kept for historical traceability — the shared
 * component originated here. New pages should import
 * {@link InteractiveDateRangePicker} directly; this re-export will be
 * removed in a future cleanup.
 */

type EInvoiceDateRangeControlProps = {
    /** ISO `YYYY-MM-DD` start date. */
    startIso: string;
    /** ISO `YYYY-MM-DD` end date. */
    endIso: string;
    /** Fires when either end is updated. Always emits both ends so
     *  the parent can react with one state update. */
    onChange: (range: { start: string; end: string }) => void;
};

export default function EInvoiceDateRangeControl({
    startIso,
    endIso,
    onChange,
}: EInvoiceDateRangeControlProps) {
    return (
        <InteractiveDateRangePicker
            startIso={startIso}
            endIso={endIso}
            onChange={onChange}
        />
    );
}
