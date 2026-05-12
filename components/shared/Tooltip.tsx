"use client";

import {
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * Shared dark tooltip — Figma node 9198:8036 (Sandbox WeCMS / Tooltip).
 *
 * <p>Reusable across upload preview cells, validation hover messages,
 * and any other UI surface that needs a portal-mounted dark tooltip
 * with a notch. Same visual language as {@link EllipsisTooltip} —
 * extracted here so callers can opt into the tooltip independent of
 * the ellipsis-truncation trigger.
 *
 * <p>Differs from {@link EllipsisTooltip}:
 * <ul>
 *   <li>Always shows {@code content} on hover/focus — never gated on
 *       truncation detection. Pass {@code content=undefined} (or empty
 *       string) to disable the tooltip; children render with no
 *       wrapping element and no listeners.</li>
 *   <li>Wraps children in a {@code <span>} trigger. Pass
 *       {@code className} to control how the wrapper fills its
 *       parent (e.g. {@code "block h-full w-full"} to make an entire
 *       table cell hoverable).</li>
 * </ul>
 *
 * <p>Visual contract (matches Figma node 9198:8036):
 * <ul>
 *   <li>Background — {@code bg-wb-ink} (#1b1b1b)</li>
 *   <li>Foreground — {@code text-white}</li>
 *   <li>Padding — {@code px-2 py-1.5}</li>
 *   <li>Radius — {@code rounded-lg} (8 px)</li>
 *   <li>Shadow — {@code 0px 2px 5px rgba(0,0,0,0.15)}</li>
 *   <li>Typography — {@code text-wb-14 font-medium tracking-wb-tight}</li>
 *   <li>Wrapping — {@code maxWidth: 320 px}, {@code break-words}</li>
 *   <li>Notch — 12 × 6 px triangle, same fill as the box</li>
 *   <li>z-index — {@code z-[100]} — above every modal / popover layer</li>
 * </ul>
 *
 * <p>Browser-default {@code title} attribute is intentionally NOT
 * rendered — the UI contract requires a custom-styled tooltip.
 */

type TooltipProps = {
    /**
     * The tooltip body text. When {@code undefined}, {@code null}, or
     * empty, the tooltip is disabled and children render with no
     * wrapping element and no event listeners.
     */
    content?: string | null;
    /**
     * Trigger content. Rendered inside a {@code <span>} that owns the
     * hover/focus listeners.
     */
    children: ReactNode;
    /**
     * Class names applied to the wrapping {@code <span>}. Use this to
     * make the trigger fill a table cell ({@code "block h-full w-full"}),
     * stretch across a flex parent, etc.
     */
    className?: string;
    /**
     * Placement preference. {@code "auto"} (default) picks
     * {@code "bottom"} when there's room below the trigger and flips
     * to {@code "top"} otherwise. Manual values are preferences only —
     * viewport clamping still applies.
     */
    placement?: "top" | "bottom" | "auto";
};

const NOTCH_GAP = 6;
const VIEWPORT_MARGIN = 8;

type Position = {
    top: number;
    left: number;
    side: "top" | "bottom";
    arrowOffset: number;
};

export default function Tooltip({
    content,
    children,
    className,
    placement = "auto",
}: TooltipProps) {
    const triggerRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<Position | null>(null);

    const enabled = !!content;

    // Recompute position whenever the tooltip becomes visible, on
    // scroll, or on resize. Keeps the arrow's visual point on the
    // trigger's centre even when viewport clamping shifts the box
    // sideways.
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

            const triggerCenter = tr.left + tr.width / 2 + window.scrollX;
            const halfWidth = tw / 2;
            const minLeft = window.scrollX + VIEWPORT_MARGIN;
            const maxLeft = window.scrollX + vw - tw - VIEWPORT_MARGIN;
            const rawLeft = triggerCenter - halfWidth;
            const left = Math.min(Math.max(rawLeft, minLeft), maxLeft);

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
        const raf = window.requestAnimationFrame(compute);
        const onScrollOrResize = () => compute();
        window.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize);
        return () => {
            window.cancelAnimationFrame(raf);
            window.removeEventListener("scroll", onScrollOrResize, true);
            window.removeEventListener("resize", onScrollOrResize);
        };
    }, [open, placement, content]);

    // ESC dismisses when focused.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    // Disabled state — render children with no wrapper, no listeners,
    // no DOM weight. Lets callers pass `content={undefined}` to opt
    // out cleanly.
    if (!enabled) {
        return <>{children}</>;
    }

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
                    maxWidth: 320,
                }}
                className="z-[100] rounded-lg bg-wb-ink px-2 py-1.5 shadow-[0px_2px_5px_rgba(0,0,0,0.15)]"
            >
                <span className="block whitespace-normal break-words text-center text-wb-14 font-medium tracking-wb-tight text-white">
                    {content}
                </span>
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
                className={className ? cn(className) : undefined}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                tabIndex={0}
                aria-label={content ?? undefined}
            >
                {children}
            </span>
            {tooltipNode}
        </>
    );
}
