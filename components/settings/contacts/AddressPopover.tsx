"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { formatDateLang } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Address card popover for the Contacts table cell.
 *
 * <p>Mirrors the Figma design — a small white card popup with a
 * title row ("Address(Current)" + "Default" badge) and the full
 * address text underneath. Hovering / focusing the trigger surfaces
 * the card; leaving / blurring closes it. Empty addresses render
 * children verbatim with no listeners (no portal, no card).
 *
 * <p><b>Architecture.</b> Mirrors {@code EllipsisTooltip} / {@code
 * Tooltip}:
 * <ul>
 *   <li>{@code createPortal} → {@code document.body} so the card is
 *       not clipped by the table's {@code overflow-auto} scroll
 *       container or the Settings modal's clipping bounds.</li>
 *   <li>Position computed in document coordinates against the
 *       trigger's {@link DOMRect}; recomputed on scroll / resize
 *       while open so the card stays anchored.</li>
 *   <li>Auto-flips above the trigger when there isn't room below;
 *       clamps to the viewport with an 8 px margin.</li>
 *   <li>{@code z-[100]} parks the card above the Settings modal
 *       ({@code z-[50]}) and any open popover layer — same z as the
 *       shared {@code Tooltip} primitive.</li>
 *   <li>{@code pointer-events: none} on the card itself so leaving
 *       the trigger reliably closes the popup. The card is a quick
 *       reference surface, not an interactive panel.</li>
 * </ul>
 *
 * <p>Open via {@code mouseenter}/{@code focus} on the trigger;
 * close via {@code mouseleave}/{@code blur} or {@code Escape}.
 */

type PreviousAddress = {
    /** Old / previous address text. */
    value: string;
    /** Raw legacy `yyyyMMdd` valid-till date. Formatted here per the
     *  active locale via {@code formatDateLang}; {@code null} hides
     *  the date row. */
    validDate: string | null;
};

type Props = {
    /** Current address text. Empty / whitespace AND no previous →
     *  component renders children only, no popup, no DOM weight. */
    current: string;
    /** Optional previous (`disp_ord = 2`) address with its valid-till
     *  date. When present, the popup renders a second section below
     *  the current address. */
    previous?: PreviousAddress | null;
    /** Trigger content (the cell's visible — usually-truncated —
     *  address span). Wrapped in a {@code <span>} that owns the
     *  hover / focus listeners. */
    children: ReactNode;
    /** Class names applied to the trigger {@code <span>}. Pages use
     *  this to slot the trigger into a flex row alongside the
     *  Address cell's {@code +N} badge ({@code min-w-0 flex-1}
     *  etc.). */
    className?: string;
};

/** Vertical gap between trigger and card — leaves room for a hairline
 *  drop shadow + breathing space. */
const POP_GAP = 8;

/** Min margin from the viewport edge before the card is clamped. */
const VIEWPORT_MARGIN = 8;

type Position = {
    top: number;
    left: number;
    side: "top" | "bottom";
};

/** Fixed popup width — matches the Figma frame. Single literal value
 *  (no `min` / `max`) so the card never shrinks for short content and
 *  never expands for long content; the body wraps inside this width. */
const POPOVER_WIDTH = 320;

export default function AddressPopover({
    current,
    previous,
    children,
    className,
}: Props) {
    const { t, locale } = useTranslation();
    const triggerRef = useRef<HTMLSpanElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<Position | null>(null);

    const hasCurrent = current.trim().length > 0;
    const hasPrevious = !!previous && previous.value.trim().length > 0;
    const enabled = hasCurrent || hasPrevious;
    const previousDateLabel =
        hasPrevious && previous?.validDate
            ? formatDateLang(previous.validDate, locale)
            : "";

    useEffect(() => {
        if (!open) return;
        const compute = () => {
            const trigger = triggerRef.current;
            const pop = popoverRef.current;
            if (!trigger || !pop) return;
            const tr = trigger.getBoundingClientRect();
            const pw = pop.offsetWidth;
            const ph = pop.offsetHeight;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            // Auto-flip top/bottom — bottom first if there's room
            // below, otherwise above.
            const fitsBelow = tr.bottom + POP_GAP + ph + VIEWPORT_MARGIN <= vh;
            const fitsAbove = tr.top - POP_GAP - ph - VIEWPORT_MARGIN >= 0;
            const side: "top" | "bottom" =
                fitsBelow || !fitsAbove ? "bottom" : "top";

            const top =
                side === "bottom"
                    ? tr.bottom + POP_GAP + window.scrollY
                    : tr.top - ph - POP_GAP + window.scrollY;

            // Align the card's left edge to the trigger's left edge,
            // clamped to the viewport. Reading order matches a
            // labelled-card UI — never centred on the cell because
            // the card is wider than the cell and the centred
            // variant pushes the title off to the left of the
            // trigger.
            const minLeft = window.scrollX + VIEWPORT_MARGIN;
            const maxLeft = window.scrollX + vw - pw - VIEWPORT_MARGIN;
            const rawLeft = tr.left + window.scrollX;
            const left = Math.min(Math.max(rawLeft, minLeft), maxLeft);

            setPosition({ top, left, side });
        };
        compute();
        const raf = window.requestAnimationFrame(compute);
        const onScrollOrResize = () => compute();
        window.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize);
        return () => {
            window.cancelAnimationFrame(raf);
            window.removeEventListener("scroll", onScrollOrResize, true);
            window.removeEventListener("resize", onScrollOrResize);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    if (!enabled) {
        return <>{children}</>;
    }

    const popNode = open && typeof document !== "undefined" ? (
        createPortal(
            <div
                ref={popoverRef}
                role="dialog"
                aria-label={t("settings.contacts.address_popover.title_current")}
                style={{
                    position: "absolute",
                    top: position?.top ?? -9999,
                    left: position?.left ?? -9999,
                    visibility: position ? "visible" : "hidden",
                    pointerEvents: "none",
                    // Fixed width — see POPOVER_WIDTH. Card width never
                    // depends on content length, so a 5-char address
                    // and a 60-char address produce identical chrome.
                    width: POPOVER_WIDTH,
                }}
                className="z-[100] rounded-md border border-wb-ntrl-3 bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
            >
                {/* Current section — title + "Default" badge + value. */}
                {hasCurrent && (
                    <div className={cn(hasPrevious && "pb-3")}>
                        <div className="flex items-center justify-between gap-2 pb-1.5">
                            <span className="text-wb-13 font-semibold text-wb-dark">
                                {t("settings.contacts.address_popover.title_current")}
                            </span>
                            <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-wb-ntrl-3 px-1.5 text-wb-12 font-medium text-wb-ntrl-8">
                                {t("settings.contacts.address_popover.badge_default")}
                            </span>
                        </div>
                        <p className="break-words text-wb-13 font-normal leading-5 text-wb-ink">
                            {current}
                        </p>
                    </div>
                )}
                {/* Previous (Old) section — title only (no "Default"
                   badge), value, optional valid-till date below. */}
                {hasPrevious && (
                    <div>
                        <div className="pb-1.5">
                            <span className="text-wb-13 font-semibold text-wb-dark">
                                {t("settings.contacts.address_popover.title_old")}
                            </span>
                        </div>
                        <p className="break-words text-wb-13 font-normal leading-5 text-wb-ink">
                            {previous?.value}
                        </p>
                        {previousDateLabel && (
                            <p className="mt-1 text-wb-13 font-normal leading-5 text-wb-ntrl-6">
                                {previousDateLabel}
                            </p>
                        )}
                    </div>
                )}
            </div>,
            document.body,
        )
    ) : null;

    return (
        <>
            <span
                ref={triggerRef}
                className={className ? cn(className) : undefined}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                tabIndex={0}
            >
                {children}
            </span>
            {popNode}
        </>
    );
}
