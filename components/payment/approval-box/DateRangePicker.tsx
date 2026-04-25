"use client";

import SharedDateRangePicker from "@/components/shared/DateRangePicker";

/**
 * Thin compatibility re-export — the actual implementation is now shared at
 * `components/shared/DateRangePicker.tsx` so Approval Box, Sales e-Invoices,
 * Transaction History, and Reports all render the same chrome.
 */

type DateRangePickerProps = {
    start: string;
    end: string;
    onChange?: (range: { start: string; end: string }) => void;
    className?: string;
};

export default function DateRangePicker(props: DateRangePickerProps) {
    return <SharedDateRangePicker {...props} />;
}
