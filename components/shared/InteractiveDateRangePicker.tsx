"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
    /** Optional chip formatter forwarded to both {@link DateField}s.
     *  Default is the shared `DD MMM YYYY`. Pass
     *  {@link formatDateChipNumeric} on pages that mirror a legacy JEX
     *  popup whose chip rendered `DD-MM-YYYY`. */
    formatValue?: (iso: string) => string;
    /** Render every popup (both chip popovers and the dual-month range
     *  popover) into {@code document.body} via portals anchored to the
     *  chip / icon. Use this when the picker sits inside a container
     *  that clips overflow (e.g. shadcn {@code <DialogContent>}).
     *  Defaults to {@code false}. */
    portalled?: boolean;
    /** When true, every input is non-interactive and visually muted —
     *  matches the legacy JEX `AUTO_SET_YN` pattern where checking the
     *  Auto checkbox disables the date range filter. */
    disabled?: boolean;
    /** Glyph drawn between the start and end chip. Defaults to {@code "→"}
     *  to match the in-app filter rows. Pages that mirror a legacy JEX
     *  popup whose label rendered {@code yyyy ~ yyyy} (Bank Transaction
     *  Sync > History — Figma "Lastest Inquiry History") pass
     *  {@code "~"}. Render-only; the wire shape is unchanged. */
    separator?: string;
    /** Open the calendar icon's dual-month popover expanding RIGHT
     *  from the icon instead of the default right-aligned-under-icon
     *  layout. Forwarded verbatim to {@link DateRangePopover}; see its
     *  Javadoc for the placement contract. Default: {@code false}
     *  (preserves every existing consumer). */
    expandRight?: boolean;
};

export default function InteractiveDateRangePicker({
    startIso,
    endIso,
    onChange,
    formatValue,
    portalled = false,
    disabled = false,
    separator = "→",
    expandRight = false,
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

    /** Anchor element for the portalled range popover — the calendar
     *  icon's bounding rect, re-measured on each open + on window
     *  resize / scroll while the popover is visible. */
    const iconRef = useRef<HTMLDivElement>(null);
    /** Container ref — the flex row that wraps the chips + separator +
     *  calendar icon. Used as a secondary anchor when {@link expandRight}
     *  is on so the popover aligns to the **start chip's** left edge
     *  rather than the calendar icon's (which sits to the right of both
     *  chips). Without this, "expand right from the icon" still places
     *  the popover well to the right of the chips. */
    const containerRef = useRef<HTMLDivElement>(null);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

    useLayoutEffect(() => {
        if (!rangeOpen || !portalled || !iconRef.current) {
            setAnchorRect(null);
            setContainerRect(null);
            return;
        }
        const measure = () => {
            if (iconRef.current) setAnchorRect(iconRef.current.getBoundingClientRect());
            if (containerRef.current) setContainerRect(containerRef.current.getBoundingClientRect());
        };
        measure();
        window.addEventListener("scroll", measure, true);
        window.addEventListener("resize", measure);
        return () => {
            window.removeEventListener("scroll", measure, true);
            window.removeEventListener("resize", measure);
        };
    }, [rangeOpen, portalled]);

    // Force every popup shut the moment the picker is disabled (e.g. the
    // Auto checkbox flips on while the range popover is open).
    useEffect(() => {
        if (disabled) {
            setRangeOpen(false);
            setChipKey((k) => k + 1);
        }
    }, [disabled]);

    const closeAll = () => {
        setRangeOpen(false);
        setChipKey((k) => k + 1);
    };

    return (
        <div
            ref={containerRef}
            className={cnLocal(
                "relative flex items-center gap-2",
                disabled && "pointer-events-none opacity-50",
            )}
            aria-disabled={disabled || undefined}
        >
            <DateField
                key={`start-${chipKey}`}
                value={startIso}
                onChange={(iso) => {
                    if (disabled) return;
                    onChange({ start: iso, end: endIso });
                    setChipKey((k) => k + 1); // close chip popup
                }}
                formatValue={formatValue}
                hideCalendarIcon
                portalled={portalled}
            />
            <span aria-hidden className="text-wb-14-tight font-medium text-black">
                {separator}
            </span>
            <DateField
                key={`end-${chipKey}`}
                value={endIso}
                onChange={(iso) => {
                    if (disabled) return;
                    onChange({ start: startIso, end: iso });
                    setChipKey((k) => k + 1);
                }}
                formatValue={formatValue}
                hideCalendarIcon
                portalled={portalled}
            />
            <div ref={iconRef}>
                <CalendarIconButton
                    onClick={() => {
                        if (disabled) return;
                        setChipKey((k) => k + 1); // force-close any chip popup
                        setRangeOpen((o) => !o);
                    }}
                />
            </div>
            {rangeOpen && (
                <DateRangePopover
                    start={startIso}
                    end={endIso}
                    onApply={(range) => {
                        onChange(range);
                        closeAll();
                    }}
                    onClose={closeAll}
                    portalled={portalled}
                    anchorRect={anchorRect}
                    expandRight={expandRight}
                    expandRightFromRect={expandRight ? containerRect : null}
                />
            )}
        </div>
    );
}

/** Tiny local class-name combiner so we don't pull `cn` from `lib/utils`
 *  for a single conditional. Keeps this file dependency-light. */
function cnLocal(...parts: Array<string | false | null | undefined>): string {
    return parts.filter(Boolean).join(" ");
}
