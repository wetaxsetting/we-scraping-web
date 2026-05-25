"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const OFFSET         = 4;
const VIEWPORT_PAD   = 8;
const DEFAULT_MAX_H  = 240;
const DEFAULT_MIN_W  = 0; // 0 ⇒ snap panel to trigger width

export type InlineDropdownOption = {
    value: string;
    /** Visible label inside the panel + trigger. Plain string keeps
     *  truncation + keyboard typeahead trivial. */
    label: string;
};

type InlineDropdownProps = {
    value: string;
    options: InlineDropdownOption[];
    onChange: (next: string) => void;
    /** ARIA label for the trigger button — required for screen-reader
     *  identification. */
    ariaLabel: string;
    /** Placeholder rendered inside the trigger when {@link value} is
     *  empty. Defaults to nothing (the trigger renders blank). */
    placeholder?: string;
    /** Width utility for the trigger button (e.g. {@code "w-full"} or
     *  {@code "w-[72px]"}). Defaults to {@code "w-full"}. */
    triggerClassName?: string;
    /** Minimum width for the dropdown panel (px). The panel always
     *  matches the trigger's width but never shrinks below this. Useful
     *  for very narrow triggers (Calc Rule's `+ / -` picker would
     *  otherwise produce an unreadably narrow panel). */
    panelMinWidthPx?: number;
    /** Cap for the panel's vertical size (px). Defaults to 240; pass a
     *  smaller value for compact pickers (Calc Rule, Status). */
    maxPanelHeightPx?: number;
    disabled?: boolean;
};

/**
 * Compact styled dropdown for inline Add / Edit row pickers (Chart of
 * Accounts: Parent Account, Calc Rule, Status). Replaces the native
 * {@code <select>} so:
 *
 * - the trigger renders the project's standard 32 px input chrome
 *   (`shadow-wb-outline` + focus ring + chevron on the right);
 * - the panel renders into {@code document.body} via
 *   {@link createPortal}, so it overflows the row's {@code <td>} clip
 *   rect AND the Settings modal's {@code overflow-hidden} scroll
 *   container without breaking the table layout;
 * - the panel uses {@code custom-scrollbar-y} per CLAUDE.md §6c — thin
 *   6 px track, no arrow buttons, matching the rest of the app;
 * - the panel sits at {@code z-[95]}, above the L1 Settings modal
 *   content ({@code z-50}) and below the system-feedback layer
 *   ({@code z-[100]}) — same precedent as
 *   {@code ParentPurposePicker.tsx}.
 *
 * <p>{@code pointer-events-auto} on the panel is load-bearing inside
 * any Radix Dialog ancestor — Radix locks
 * {@code body { pointer-events: none }} while a stacked dialog is
 * open, so a portalled child must opt back in or its clicks silently
 * pass through.
 *
 * <p>Keyboard: ArrowDown / ArrowUp to navigate options when the panel
 * is open, Home / End to jump to ends, Enter to commit, Esc to close
 * without committing. The trigger itself is a normal {@code <button>}
 * — Space / Enter opens the panel.
 */
export default function InlineDropdown({
    value,
    options,
    onChange,
    ariaLabel,
    placeholder,
    triggerClassName = "w-full",
    panelMinWidthPx = DEFAULT_MIN_W,
    maxPanelHeightPx = DEFAULT_MAX_H,
    disabled = false,
}: InlineDropdownProps) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef   = useRef<HTMLDivElement>(null);

    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    /** Highlighted option index — drives ArrowUp / ArrowDown without
     *  committing. -1 keeps the panel's initial state empty so the
     *  first ArrowDown lands on index 0. */
    const [activeIndex, setActiveIndex] = useState<number>(-1);

    const isOpen = anchorRect !== null;

    const open = useCallback(() => {
        if (disabled) return;
        if (triggerRef.current) {
            setAnchorRect(triggerRef.current.getBoundingClientRect());
            // Seed the highlight on the currently-selected option so
            // ArrowDown picks up where the user left off.
            const idx = options.findIndex((o) => o.value === value);
            setActiveIndex(idx >= 0 ? idx : 0);
        }
    }, [disabled, options, value]);

    const close = useCallback(() => {
        setAnchorRect(null);
        setActiveIndex(-1);
        // Return focus to the trigger so Tab order is preserved after
        // an Esc-dismiss.
        triggerRef.current?.focus();
    }, []);

    function commit(next: string) {
        onChange(next);
        // Same focus-return as close() — the trigger needs to regain
        // focus so subsequent Tab moves to Save / Cancel.
        setAnchorRect(null);
        setActiveIndex(-1);
        triggerRef.current?.focus();
    }

    /* ESC + outside-click dismiss. Outside-click subscription wrapped
     * in a 0 ms timeout so the same focus event that opened the
     * picker doesn't immediately close it. Mirrors the
     * ParentPurposePicker precedent. */
    useEffect(() => {
        if (!isOpen) return;
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.stopPropagation();
                close();
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(options.length - 1, i + 1));
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(0, i - 1));
                return;
            }
            if (e.key === "Home") {
                e.preventDefault();
                setActiveIndex(0);
                return;
            }
            if (e.key === "End") {
                e.preventDefault();
                setActiveIndex(options.length - 1);
                return;
            }
            if (e.key === "Enter") {
                e.preventDefault();
                const opt = options[activeIndex];
                if (opt) commit(opt.value);
            }
        }
        function handleMouseDown(e: MouseEvent) {
            const target = e.target as Node | null;
            if (!target) return;
            if (panelRef.current?.contains(target))   return;
            if (triggerRef.current?.contains(target)) return;
            close();
        }
        document.addEventListener("keydown", handleKey, true);
        const id = window.setTimeout(() => {
            document.addEventListener("mousedown", handleMouseDown);
        }, 0);
        return () => {
            window.clearTimeout(id);
            document.removeEventListener("keydown", handleKey, true);
            document.removeEventListener("mousedown", handleMouseDown);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, activeIndex, options]);

    /* Re-measure the anchor on every resize / scroll while open. The
     * dropdown is fixed-positioned so the user scrolling the table
     * body would otherwise leave a stale panel hovering over the wrong
     * row. */
    useEffect(() => {
        if (!isOpen) return;
        function reanchor() {
            if (triggerRef.current) {
                setAnchorRect(triggerRef.current.getBoundingClientRect());
            }
        }
        window.addEventListener("resize", reanchor);
        // capture:true catches scroll inside any ancestor (modal +
        // table body). passive:true keeps the handler off the perf
        // critical path.
        window.addEventListener("scroll", reanchor, { capture: true, passive: true });
        return () => {
            window.removeEventListener("resize", reanchor);
            window.removeEventListener("scroll", reanchor, { capture: true });
        };
    }, [isOpen]);

    const panelStyle = useMemo<React.CSSProperties>(() => {
        if (!anchorRect || typeof window === "undefined") return {};
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const width = Math.max(anchorRect.width, panelMinWidthPx);
        let left = anchorRect.left;
        if (left + width > vw - VIEWPORT_PAD) {
            left = Math.max(VIEWPORT_PAD, vw - width - VIEWPORT_PAD);
        }
        if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

        const belowTop    = anchorRect.bottom + OFFSET;
        const aboveBottom = anchorRect.top - OFFSET;
        // Estimated panel height: the inner list caps at maxPanelHeightPx;
        // add 8 px for the surrounding card padding (p-1 = 4 px ×2).
        const estHeight = Math.min(maxPanelHeightPx, options.length * 32) + 8;

        if (belowTop + estHeight <= vh - VIEWPORT_PAD) {
            return { position: "fixed", top: belowTop, left, width };
        }
        return {
            position: "fixed",
            bottom: vh - aboveBottom,
            left,
            width,
        };
    }, [anchorRect, panelMinWidthPx, maxPanelHeightPx, options.length]);

    const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                disabled={disabled}
                onClick={() => (isOpen ? close() : open())}
                className={cn(
                    "flex h-8 cursor-pointer items-center justify-between gap-1 rounded-md bg-white pl-2 pr-1.5 text-left text-wb-13 font-medium leading-4 text-wb-ink",
                    "shadow-wb-outline outline-none",
                    "focus-visible:shadow-[0px_0px_0px_1px_var(--color-brand)]",
                    isOpen && "shadow-[0px_0px_0px_1px_var(--color-brand)]",
                    disabled && "cursor-not-allowed bg-wb-bg-card text-wb-ntrl-6",
                    triggerClassName,
                )}
            >
                <span className={cn(
                    "block min-w-0 flex-1 truncate",
                    !selectedLabel && "text-wb-ntrl-5",
                )}>
                    {selectedLabel || placeholder || ""}
                </span>
                <ChevronDown
                    className="size-3.5 shrink-0 text-wb-ntrl-6"
                    strokeWidth={1.8}
                    aria-hidden
                />
            </button>

            {isOpen && typeof document !== "undefined" && createPortal(
                <div
                    ref={panelRef}
                    role="listbox"
                    aria-label={ariaLabel}
                    style={panelStyle}
                    className={cn(
                        "pointer-events-auto z-[95] flex flex-col rounded-md bg-white p-1",
                        "shadow-[0_1px_1px_0_rgba(0,0,0,0.1),_0_0_2px_0_rgba(0,0,0,0.1),_0_6px_10px_0_rgba(0,0,0,0.1)]",
                    )}
                >
                    {options.length === 0 ? (
                        <div className="px-2 py-3 text-wb-13 font-normal text-wb-ntrl-6">
                            —
                        </div>
                    ) : (
                        <ul
                            className="custom-scrollbar-y flex flex-col overflow-y-auto"
                            style={{ maxHeight: maxPanelHeightPx }}
                        >
                            {options.map((opt, idx) => {
                                const isSelected = opt.value === value;
                                const isActive   = idx === activeIndex;
                                return (
                                    <li key={opt.value || `__empty_${idx}`}>
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            onMouseDown={(e) => {
                                                // Prevent the trigger
                                                // from losing focus before
                                                // onClick fires — mousedown
                                                // moves focus and would
                                                // race against the click
                                                // commit.
                                                e.preventDefault();
                                            }}
                                            onClick={() => commit(opt.value)}
                                            onMouseEnter={() => setActiveIndex(idx)}
                                            className={cn(
                                                "flex w-full cursor-pointer items-center rounded-[4px] px-2 py-2 text-left",
                                                "text-wb-13 font-medium text-wb-ntrl-8",
                                                "hover:bg-wb-bg-sidebar",
                                                isActive && !isSelected && "bg-wb-bg-sidebar",
                                                isSelected && "bg-brand-soft text-brand-active",
                                            )}
                                        >
                                            <span className="truncate">{opt.label}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>,
                document.body,
            )}
        </>
    );
}
