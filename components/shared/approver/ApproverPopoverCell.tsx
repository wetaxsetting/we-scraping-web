"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import ApproverChainList from "./ApproverChainList";
import type { ApproverChainEntry } from "./types";

const POPUP_WIDTH = 360;
const OFFSET = 6;

type ApproverPopoverCellProps = {
    /** First approver's display name (the always-visible cell text). */
    name: string;
    /** Count chip text, e.g. `0/2`. Null hides the chip + chevron and the
     *  cell renders as plain, non-interactive text. */
    count: string | null;
    /** Full approval chain shown in the popover. Empty → the cell is still
     *  interactive (when `count` is set) and the popover shows the empty
     *  state, matching the Approval Box. */
    approvers: ApproverChainEntry[];
    className?: string;
};

/**
 * Shared Approver column cell — first-approver name + count chip + chevron
 * that opens the approver-chain popover ({@link ApproverChainList}).
 *
 * One implementation reused by the Payment Approval Box and every Scheduled
 * batch list (Internal Transfer, Vendor, Expense, Payroll, Overseas).
 *
 * The trigger background is transparent (only the count chip keeps its
 * background). The popover renders through a portal with fixed positioning
 * anchored to the trigger, so it is never clipped by the table's
 * `overflow-auto` scroll container. ESC, outside-click, and scroll all
 * dismiss it; opening one cell closes any other (each cell's outside-click
 * handler fires when another trigger is clicked).
 */
export default function ApproverPopoverCell({
    name,
    count,
    approvers,
    className,
}: ApproverPopoverCellProps) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const open = rect !== null;
    const interactive = count != null;

    function toggle() {
        if (open) {
            setRect(null);
            return;
        }
        const r = triggerRef.current?.getBoundingClientRect();
        if (r) setRect(r);
    }

    useEffect(() => {
        if (!open) return;
        const close = () => setRect(null);
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.stopPropagation();
                close();
            }
        }
        function handleMouseDown(e: MouseEvent) {
            const target = e.target as Node | null;
            if (!target) return;
            if (popoverRef.current?.contains(target)) return;
            if (triggerRef.current?.contains(target)) return;
            close();
        }
        document.addEventListener("keydown", handleKey, true);
        const id = window.setTimeout(() => {
            document.addEventListener("mousedown", handleMouseDown);
        }, 0);
        // Capture-phase scroll catches the inner table scroll container too,
        // so a fixed-positioned popover never drifts away from its trigger.
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
        return () => {
            window.clearTimeout(id);
            document.removeEventListener("keydown", handleKey, true);
            document.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
        };
    }, [open]);

    if (!interactive) {
        return (
            <span className={cn("truncate text-wb-13 font-medium text-wb-ink", className)}>
                {name}
            </span>
        );
    }

    let popoverStyle: React.CSSProperties = {};
    if (rect && typeof window !== "undefined") {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let left = rect.right - POPUP_WIDTH;
        if (left < 8) left = 8;
        if (left + POPUP_WIDTH > vw - 8) left = vw - POPUP_WIDTH - 8;
        // Open below the trigger; flip above when there is not enough room.
        const below = rect.bottom + OFFSET;
        const estimatedHeight = Math.min(approvers.length || 1, 6) * 64 + 8;
        if (below + estimatedHeight > vh - 8 && rect.top - OFFSET - estimatedHeight > 8) {
            popoverStyle = { position: "fixed", left, bottom: vh - (rect.top - OFFSET), width: POPUP_WIDTH };
        } else {
            popoverStyle = { position: "fixed", left, top: below, width: POPUP_WIDTH };
        }
    }

    return (
        <div className={cn("inline-flex", className)}>
            <button
                ref={triggerRef}
                type="button"
                // stopPropagation: don't trigger the row's detail navigation,
                // and don't let the document mousedown-close fire for our click.
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    toggle();
                }}
                aria-expanded={open}
                aria-haspopup="dialog"
                className="flex cursor-pointer items-center gap-1 text-left"
            >
                <span className="truncate text-wb-13 font-medium text-wb-ink">{name}</span>
                <span className="inline-flex items-center justify-center rounded-[4px] border border-wb-ntrl-4 bg-wb-ntrl-3 px-1 text-wb-10 font-medium uppercase text-black/70">
                    {count}
                </span>
                <ChevronDown
                    aria-hidden
                    className={cn(
                        "size-[18px] shrink-0 text-wb-ntrl-6 transition-transform",
                        open && "rotate-180",
                    )}
                    strokeWidth={1.8}
                />
            </button>
            {open &&
                createPortal(
                    <div
                        ref={popoverRef}
                        role="dialog"
                        onMouseDown={(e) => e.stopPropagation()}
                        style={popoverStyle}
                        className="z-[60] max-h-[60vh] overflow-auto rounded-lg bg-white shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),_0px_2px_4px_0px_rgba(0,0,0,0.08),_0px_4px_8px_0px_rgba(0,0,0,0.08)] custom-scrollbar-y"
                    >
                        <ApproverChainList approvers={approvers} />
                    </div>,
                    document.body,
                )}
        </div>
    );
}
