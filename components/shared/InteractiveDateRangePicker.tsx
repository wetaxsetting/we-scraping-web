"use client";

import { useState } from "react";

import CalendarIconButton from "@/components/shared/CalendarIconButton";
import DateField from "@/components/shared/DateField";
import DateRangePopover from "@/components/shared/DateRangePopover";

/**
 * Wired date-range picker — three interactions:
 *
 * <ul>
 *   <li>Click the <b>start chip</b> → small single-date popover
 *       (Figma 77:12230, owned by {@link DateField}). Picking a day
 *       commits to {@code start} and closes the popup.</li>
 *   <li>Click the <b>end chip</b> → same single-date popover bound to
 *       {@code end}.</li>
 *   <li>Click the <b>calendar icon</b> → large dual-month range
 *       popover (Figma 123:4630, owned by {@link DateRangePopover}) with
 *       quick-pick chips and Cancel / Apply.</li>
 * </ul>
 *
 * <p>Only one popover may be open at a time — opening the icon popover
 * force-closes any chip popover via a controlled-rerender (the chip
 * popups are uncontrolled internally; remounting via {@code key} bump
 * is the simplest cross-cutting "close" signal).
 *
 * <p>Wire format: ISO {@code YYYY-MM-DD} on both sides of the boundary.
 * Pages that need a different on-the-wire format (e.g. {@code YYYYMMDD}
 * for the Phase 2 backend's {@code from_date}/{@code to_date} params)
 * normalise at their own boundary — this component does not.
 *
 * <p>This is the canonical reuse target for any page that needs the
 * "click-input → single popup, click-icon → range popup" pattern from
 * Sales e-Invoices (the original implementation site). Do not duplicate
 * the chip + icon + popover wiring per page; consume this component
 * instead. The static {@code <DateRangePicker>} remains the read-only
 * display variant for pages that aren't yet wired.
 */

type InteractiveDateRangePickerProps = {
    /** ISO `YYYY-MM-DD` start date. */
    startIso: string;
    /** ISO `YYYY-MM-DD` end date. */
    endIso: string;
    /** Fires when either end is updated. Always emits both ends so the
     *  parent can react with one state update. */
    onChange: (range: { start: string; end: string }) => void;
};

export default function InteractiveDateRangePicker({
    startIso,
    endIso,
    onChange,
}: InteractiveDateRangePickerProps) {
    /** When true, the dual-month range popover is open. Mounting it
     *  this way also force-closes any chip-popup via the controlled-
     *  rerender trick on the chips' `key`. */
    const [rangeOpen, setRangeOpen] = useState(false);

    /** Bumped to force-close a chip popup when the user opens the
     *  range popover or commits via the chip itself. {@link DateField}
     *  is uncontrolled internally, so unmounting via key bump is the
     *  simplest cross-cutting "close" signal. */
    const [chipKey, setChipKey] = useState(0);

    const closeAll = () => {
        setRangeOpen(false);
        setChipKey((k) => k + 1);
    };

    return (
        <div className="relative flex items-center gap-2">
            <DateField
                key={`start-${chipKey}`}
                value={startIso}
                onChange={(iso) => {
                    onChange({ start: iso, end: endIso });
                    setChipKey((k) => k + 1); // close chip popup
                }}
                hideCalendarIcon
            />
            <span aria-hidden className="text-wb-14-tight font-medium text-black">
                →
            </span>
            <DateField
                key={`end-${chipKey}`}
                value={endIso}
                onChange={(iso) => {
                    onChange({ start: startIso, end: iso });
                    setChipKey((k) => k + 1);
                }}
                hideCalendarIcon
            />
            <CalendarIconButton
                onClick={() => {
                    setChipKey((k) => k + 1); // force-close any chip popup
                    setRangeOpen((o) => !o);
                }}
            />
            {rangeOpen && (
                <DateRangePopover
                    start={startIso}
                    end={endIso}
                    onApply={(range) => {
                        onChange(range);
                        closeAll();
                    }}
                    onClose={closeAll}
                />
            )}
        </div>
    );
}
