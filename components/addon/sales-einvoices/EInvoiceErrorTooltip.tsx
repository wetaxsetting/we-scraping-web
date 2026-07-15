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
 * e-Invoice "Partially Failed" / "Fail" error popover — a dedicated light
 * box for the Update e-Invoice Information modal, NOT the shared dark
 * {@link Tooltip}. Reproduces the legacy `.ticker-layer-infor` panel
 * (`nxisas_einvoice_view.jsp` — white card, left-aligned, one error per
 * line, scrollable past ~300 px): each `_failList` entry
 * (`"[symbol-no] message (code)"` or `"message (code)"`) is rendered on
 * its own row.
 *
 * <p>Opens on hover / focus of the red status label; a portal keeps it
 * above the modal's own stacking context (`z-[100]`, matching the shared
 * tooltip layer). When {@link errors} is empty the trigger renders bare
 * with no listeners — a "Fail" label with no per-item detail simply shows
 * the label.
 */
type Props = {
    /** The `_failList` lines to show, one per row. Empty ⇒ no popover. */
    errors: string[];
    /** The status label the popover anchors to (e.g. "Partially Failed"). */
    children: ReactNode;
    /** Class names for the wrapping trigger `<span>`. */
    className?: string;
};

const GAP = 6;
const VIEWPORT_MARGIN = 8;

type Position = { top: number; left: number };

export default function EInvoiceErrorTooltip({ errors, children, className }: Props) {
    const triggerRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<Position | null>(null);

    const enabled = errors.length > 0;

    // Anchor the panel below the label (flip above when there's no room),
    // right-aligned to the label's right edge — matching the legacy box that
    // drops from the "Partially Failed" tag — then clamp into the viewport.
    useEffect(() => {
        if (!open) return;
        const compute = () => {
            const trigger = triggerRef.current;
            const panel = panelRef.current;
            if (!trigger || !panel) return;
            const tr = trigger.getBoundingClientRect();
            const pw = panel.offsetWidth;
            const ph = panel.offsetHeight;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            const fitsBelow = tr.bottom + GAP + ph + VIEWPORT_MARGIN <= vh;
            const top =
                (fitsBelow ? tr.bottom + GAP : tr.top - ph - GAP) + window.scrollY;

            const rawLeft = tr.right - pw + window.scrollX;
            const minLeft = window.scrollX + VIEWPORT_MARGIN;
            const maxLeft = window.scrollX + vw - pw - VIEWPORT_MARGIN;
            const left = Math.min(Math.max(rawLeft, minLeft), maxLeft);

            setPosition({ top, left });
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

    // ESC dismisses when focused.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    if (!enabled) {
        return <span className={className ? cn(className) : undefined}>{children}</span>;
    }

    const panel = open && typeof document !== "undefined"
        ? createPortal(
              <div
                  ref={panelRef}
                  role="tooltip"
                  style={{
                      position: "absolute",
                      top: position?.top ?? -9999,
                      left: position?.left ?? -9999,
                      visibility: position ? "visible" : "hidden",
                  }}
                  className="custom-scrollbar-y z-[100] max-h-[300px] min-w-[240px] max-w-[360px] overflow-y-auto rounded-lg border border-wb-ntrl-4 bg-white px-3 py-2 shadow-wb-card"
              >
                  {errors.map((err, i) => (
                      <span
                          key={i}
                          className="block break-words text-left text-wb-13 font-medium leading-5 text-wb-ink"
                      >
                          {err}
                      </span>
                  ))}
              </div>,
              document.body,
          )
        : null;

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
            {panel}
        </>
    );
}
