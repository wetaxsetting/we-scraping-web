"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * Shared truncated-text tooltip — Figma node 9198:8036
 * (Sandbox WeCMS / Tooltip).
 *
 * <p>Renders {@link text} as a single-line truncated span (`overflow:
 * hidden` + `text-overflow: ellipsis` + `white-space: nowrap`). When
 * the user hovers (or focuses) the trigger AND the text is actually
 * truncated, a portal-mounted dark tooltip surfaces the full string.
 * When the text fits inside its container, no tooltip renders — same
 * UX contract as the Figma frame.
 *
 * <p><b>Visual style.</b> Tracks the Figma frame:
 * <ul>
 *   <li>Background — workspace token {@code bg-wb-ink} (#1b1b1b),
 *       the closest match to Figma's {@code #262626 tag-bg-ntl-heavy}.</li>
 *   <li>Foreground — {@code text-white}, matching Figma's {@code #f9fafb}.</li>
 *   <li>Padding — {@code px-2 py-1.5} (8 px × 6 px). Slightly more
 *       generous than Figma's single-line {@code 6 × 4} pair so wrapped
 *       multi-line text breathes; the visual difference is invisible
 *       on single-line tooltips and improves readability when the
 *       string spans 2-4 lines.</li>
 *   <li>Wrapping — {@code whitespace-normal break-words} with a
 *       {@code maxWidth: 320 px} cap so long strings wrap into 2-4
 *       lines instead of stretching across the viewport.</li>
 *   <li>Radius — {@code rounded-lg} (8 px), matches Figma's {@code wlds-radius-8}.</li>
 *   <li>Shadow — {@code shadow-[0px_2px_5px_rgba(0,0,0,0.15)]}, exact
 *       Figma drop shadow.</li>
 *   <li>Typography — {@code text-wb-14 font-medium tracking-wb-tight} —
 *       workspace tokens (no raw px / family / weight).</li>
 *   <li>Notch — 12 × 6 px triangle below or above the box per
 *       placement; same fill as the box.</li>
 * </ul>
 *
 * <p><b>Architecture.</b> The trigger is a `<span>` so the component
 * drops cleanly into any inline context (table cells, popover value
 * columns, badges). Accessibility:
 *
 * <ul>
 *   <li>{@code aria-label} carries the full string when truncated, so
 *       screen readers announce it even though the visible text is
 *       elided.</li>
 *   <li>The trigger becomes {@code tabIndex=0} only when truncated, so
 *       keyboard users can focus the truncated cell (and the tooltip
 *       appears on focus alongside hover).</li>
 *   <li>{@code role="img"} is intentionally NOT used — the trigger is
 *       prose, not an image. The plain `<span>` + `aria-label` is the
 *       canonical pattern for elided text.</li>
 *   <li>{@code Escape} dismisses the tooltip when focused.</li>
 * </ul>
 *
 * <p><b>Truncation detection.</b> Uses {@code el.scrollWidth >
 * el.clientWidth + 1} (the {@code +1} absorbs sub-pixel rounding on
 * fractional-DPI displays). Recomputed on every hover/focus enter
 * and on viewport resize so dynamic font-loading + container resizing
 * don't strand a stale "is truncated" flag. When detection
 * mis-reports (e.g. a future browser changes scroll-width semantics),
 * the fallback is conservative — the tooltip never shows, which is
 * preferable to showing tooltips on non-truncated cells.
 *
 * <p>Browser-default tooltip is intentionally NOT rendered ({@code
 * title} is omitted) — the user's request explicitly forbids it.
 */

type EllipsisTooltipProps = {
    /**
     * The full text. Always rendered into the trigger; CSS truncates
     * the visible portion when it overflows. The same string is shown
     * verbatim inside the tooltip when truncation is detected.
     */
    text: string;
    /** Optional className applied to the trigger `<span>`. The trigger
     *  always carries {@code block truncate} so typography tokens
     *  passed in here drive the visible text style. */
    className?: string;
    /** Optional placement preference. Defaults to {@code "auto"} which
     *  picks {@code "bottom"} when there's room below the trigger and
     *  flips to {@code "top"} otherwise. Manual values are only
     *  preferences — viewport clamping still applies. */
    placement?: "top" | "bottom" | "auto";
};

/** Vertical gap between the tooltip box and the trigger — leaves room
 *  for the 6-px notch + a hair of breathing space. */
const NOTCH_GAP = 6;

/** Tooltip box minimum margin from the viewport edge. */
const VIEWPORT_MARGIN = 8;

export default function EllipsisTooltip({
    text,
    className,
    placement = "auto",
}: EllipsisTooltipProps) {
    const triggerRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [isTruncated, setIsTruncated] = useState(false);
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{
        top: number;
        left: number;
        side: "top" | "bottom";
        /** X-offset of the arrow's left edge inside the tooltip box. The
         *  arrow is decoupled from the box's centre so that when the box is
         *  clamped to a viewport edge, the arrow still points at the
         *  trigger rather than at the box's geometric centre. */
        arrowOffset: number;
    } | null>(null);

    // Recompute "is truncated" on mount, on text change, and on
    // viewport resize. Cheap (one DOM read per recompute); cheaper
    // than recomputing on every render.
    useEffect(() => {
        const el = triggerRef.current;
        if (!el) return;
        const recompute = () => {
            // +1 absorbs sub-pixel rounding on fractional-DPI displays.
            // Without it, a span at 100% zoom on a 1.5x screen
            // sometimes reports scrollWidth = clientWidth + 0.5 even
            // when nothing is hidden.
            setIsTruncated(el.scrollWidth > el.clientWidth + 1);
        };
        recompute();
        const ro = new ResizeObserver(recompute);
        ro.observe(el);
        return () => ro.disconnect();
    }, [text]);

    // Position the floating tooltip relative to the trigger. Recomputes
    // on every show, on scroll/resize while open. The position is
    // expressed in document coordinates (not client coordinates) so
    // page scroll doesn't strand the tooltip.
    useEffect(() => {
        if (!open) return;
        const compute = () => {
            const trigger = triggerRef.current;
            const tooltip = tooltipRef.current;
            if (!trigger || !tooltip) return;
            const tr = trigger.getBoundingClientRect();
            const tw = tooltip.offsetWidth;
            const th = tooltip.offsetHeight;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            // Decide side. "auto" → below if there's room, else flip up.
            const fitsBelow = tr.bottom + NOTCH_GAP + th + VIEWPORT_MARGIN <= vh;
            const fitsAbove = tr.top - NOTCH_GAP - th - VIEWPORT_MARGIN >= 0;
            const side: "top" | "bottom" =
                placement === "top"
                    ? "top"
                    : placement === "bottom"
                        ? "bottom"
                        : fitsBelow || !fitsAbove
                            ? "bottom"
                            : "top";

            const top =
                side === "bottom"
                    ? tr.bottom + NOTCH_GAP + window.scrollY
                    : tr.top - th - NOTCH_GAP + window.scrollY;

            // Horizontally center on the trigger; clamp to viewport.
            const triggerCenter = tr.left + tr.width / 2 + window.scrollX;
            const halfWidth = tw / 2;
            const minLeft = window.scrollX + VIEWPORT_MARGIN;
            const maxLeft = window.scrollX + vw - tw - VIEWPORT_MARGIN;
            const rawLeft = triggerCenter - halfWidth;
            const left = Math.min(Math.max(rawLeft, minLeft), maxLeft);

            // Arrow offset inside the box. The arrow's visual point should land
            // on the trigger's horizontal centre. When the box is clamped to
            // a viewport edge, this keeps the arrow pointing at the value
            // instead of drifting to the box's geometric centre. Clamped to
            // the box's rounded corners (8 px inset on each side) so the arrow
            // never pokes out of the radius.
            const ARROW_W = 12;
            const ARROW_INSET = 8;
            const rawArrow = triggerCenter - left - ARROW_W / 2;
            const arrowOffset = Math.min(
                Math.max(rawArrow, ARROW_INSET),
                Math.max(ARROW_INSET, tw - ARROW_INSET - ARROW_W),
            );

            setPosition({ top, left, side, arrowOffset });
        };
        compute();
        // Tooltip's own size is determined after first paint — recompute
        // once the layout settles so the centering math sees the right
        // width.
        const raf = window.requestAnimationFrame(compute);
        const onScrollOrResize = () => compute();
        window.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize);
        return () => {
            window.cancelAnimationFrame(raf);
            window.removeEventListener("scroll", onScrollOrResize, true);
            window.removeEventListener("resize", onScrollOrResize);
        };
    }, [open, placement, text]);

    // Close on Escape — only matters when the trigger is focused, but
    // the listener is on document so it works whether keyboard focus
    // landed via Tab or the browser's caret.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    const showTooltip = () => {
        if (!isTruncated) return;
        setOpen(true);
    };
    const hideTooltip = () => setOpen(false);

    // Two-phase render: the portal mounts as soon as `open` is true,
    // even before `position` is known, so `tooltipRef.current` becomes
    // a real DOM node and the position-compute effect can read its
    // size. While `position` is null, the tooltip is parked off-screen
    // with `visibility: hidden` (preserves layout for offsetWidth /
    // offsetHeight reads, unlike `display: none`) so nothing flashes.
    // Once `compute()` calls `setPosition(...)`, React re-renders with
    // real coords + visibility: visible.
    //
    // The previous version short-circuited on `open && position`,
    // which created a chicken-and-egg deadlock: no tooltip in DOM →
    // tooltipRef null → compute() early-returns → position never set
    // → tooltip never rendered.
    //
    // `z-[100]` parks the tooltip above every popover / modal layer
    // the workspace currently uses (Settings modal sits at z-[50],
    // detail popover at z-[60], shadcn Dialog peaks at z-[61]). Tooltip
    // belongs above all of them per the user's request.
    const tooltipNode = open && typeof document !== "undefined" ? (
        createPortal(
            <div
                ref={tooltipRef}
                role="tooltip"
                style={{
                    position: "absolute",
                    top: position?.top ?? -9999,
                    left: position?.left ?? -9999,
                    visibility: position ? "visible" : "hidden",
                    pointerEvents: "none",
                    // Bounded width forces long strings to wrap into 2-4
                    // lines instead of stretching the box across the
                    // viewport. 320 px matches the Figma frame; once
                    // wrapped, the box's offsetWidth feeds the centring
                    // math so the arrow still lands on the trigger.
                    maxWidth: 320,
                }}
                className="z-[100] rounded-lg bg-wb-ink px-2 py-1.5 shadow-[0px_2px_5px_rgba(0,0,0,0.15)]"
            >
                <span className="block whitespace-normal break-words text-wb-14 font-medium tracking-wb-tight text-white">
                    {text}
                </span>
                {/* Arrow — absolutely positioned inside the box so it
                    stays glued to the box's edge, then nudged horizontally
                    by `arrowOffset` so its visual tip lines up with the
                    trigger's centre even after viewport clamping shifts
                    the box sideways. */}
                <span
                    aria-hidden
                    style={{
                        position: "absolute",
                        left: position?.arrowOffset ?? 0,
                        width: 12,
                        height: 6,
                        backgroundColor: "var(--color-wb-ink)",
                        ...((position?.side ?? "bottom") === "bottom"
                            ? { top: -6, clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }
                            : { bottom: -6, clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)" }),
                    }}
                />
            </div>,
            document.body,
        )
    ) : null;

    return (
        <>
            <span
                ref={triggerRef}
                className={cn("block truncate", className)}
                // aria-label only when truncated — when the visible
                // text equals the full text, the SR reads it directly
                // and the label would be redundant.
                aria-label={isTruncated ? text : undefined}
                tabIndex={isTruncated ? 0 : -1}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
            >
                {text}
            </span>
            {tooltipNode}
        </>
    );
}
