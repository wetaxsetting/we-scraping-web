"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

const OFFSET = 4;
const VIEWPORT_PAD = 8;
const MAX_HEIGHT = 240;

type ParentOption = {
    code: string;
    name: string;
};

type ParentPurposePickerProps = {
    /** Anchor bounding rect captured from the trigger input. The
     *  picker's left edge aligns with `anchorRect.left`; width defaults
     *  to `max(anchorRect.width, MIN_WIDTH)` so short inputs still
     *  render readable rows. */
    anchorRect: DOMRect;
    /** Pre-filtered to level-1 codes only — OQ-FE-Frontend-1 (decided
     *  2026-05-12) bans level-2 rows from this picker. The caller
     *  (PurposeFormRow) is responsible for the filter. */
    options: ParentOption[];
    /** Current query — drives substring filter on `code` and `name`. */
    query: string;
    /** Currently-selected `code` value (`""` for none). Highlights the
     *  matching row when present. */
    selected: string;
    /** Fires when the user clicks a row or presses Enter on it. The
     *  caller commits the code to the form input and closes the picker. */
    onSelect: (option: ParentOption) => void;
    /** Fires on outside-click or ESC. */
    onClose: () => void;
};

/**
 * Parent-purpose searchable dropdown — Figma 9542:20102.
 *
 * Renders into `document.body` via `createPortal` so the dropdown can
 * overflow the parent form row's `<td>` clip rect and the Settings
 * modal's `overflow-hidden` scroll container. Position is computed
 * once from the trigger's bounding rect at open time (passed by the
 * host) — auto-flips above the trigger when the natural "below" slot
 * would push past the viewport bottom.
 *
 * <h2>Stacking</h2>
 *
 * `z-[95]` sits above the L2 Settings modal content (`z-[61]`) and
 * below the system-feedback surface (`z-[100]`). `pointer-events-auto`
 * is load-bearing — Radix Dialog locks `body { pointer-events: none }`
 * while a stacked dialog is open, so a portalled child must opt back
 * in or its clicks fall through silently.
 *
 * <h2>Search</h2>
 *
 * Substring match (case-insensitive) on `code` + `name` against
 * `query`. The host owns the query state (it's the value the user
 * types into the input) — this component just consumes it.
 *
 * <h2>Selection</h2>
 *
 * Single-select. Click a row → `onSelect` → host commits + closes.
 * Currently-selected code (if present in the filtered set) gets the
 * `bg-brand-soft` highlight; row hover gets `bg-wb-bg-sidebar` per the
 * Figma frame's default-item state.
 *
 * <h2>Item shape</h2>
 *
 * `{code}  -  {name}` rendered as three inline spans separated by
 * `gap-[2px]` per Figma 9542:20253. The dash is a literal `-`
 * character, not a separator glyph.
 *
 * <h2>Keyboard</h2>
 *
 * ESC closes the picker (host handles the dismiss event). The host's
 * input retains text-input focus while the picker is open so
 * arrow-key navigation lives in a future iteration — Figma frame
 * doesn't show a highlighted-row focus state, and the legacy
 * `comm_0187_001.ts` parent picker is mouse-only.
 */
export default function ParentPurposePicker({
    anchorRect,
    options,
    query,
    selected,
    onSelect,
    onClose,
}: ParentPurposePickerProps) {
    const popoverRef = useRef<HTMLDivElement>(null);

    /* Filter options by query — case-insensitive substring on either
     * the user-visible code or the display name. Empty query shows
     * every eligible parent so the user can browse the full list on
     * first focus. */
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return options;
        return options.filter(
            (o) =>
                o.code.toLowerCase().includes(needle) ||
                o.name.toLowerCase().includes(needle),
        );
    }, [options, query]);

    /* ESC + outside-click dismiss. Outside-click subscription wrapped
     * in a 0 ms timeout so the same focus event that mounted the
     * picker doesn't immediately close it. */
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        }
        function handleMouseDown(e: MouseEvent) {
            const target = e.target as Node | null;
            if (!target) return;
            if (popoverRef.current?.contains(target)) return;
            onClose();
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
    }, [onClose]);

    /* Position — anchored to the trigger input. Natural placement is
     * BELOW the input; if the panel would push past the viewport
     * bottom it flips ABOVE. Width matches the input exactly — the
     * panel never grows beyond the trigger so the dropdown reads as
     * a continuation of the input chrome (per spec). */
    const style = useMemo<React.CSSProperties>(() => {
        if (typeof window === "undefined") return {};
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = anchorRect.width;

        let left = anchorRect.left;
        if (left + width > vw - VIEWPORT_PAD) {
            left = Math.max(VIEWPORT_PAD, vw - width - VIEWPORT_PAD);
        }
        if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

        const belowTop = anchorRect.bottom + OFFSET;
        const aboveBottom = anchorRect.top - OFFSET;
        // Estimated height for the flip decision: actual height is
        // bounded by MAX_HEIGHT + container padding; using MAX_HEIGHT
        // as the estimate yields a stable choice.
        const estHeight = MAX_HEIGHT;
        if (belowTop + estHeight <= vh - VIEWPORT_PAD) {
            return { position: "fixed", top: belowTop, left, width };
        }
        return {
            position: "fixed",
            bottom: vh - aboveBottom,
            left,
            width,
        };
    }, [anchorRect]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            ref={popoverRef}
            role="listbox"
            aria-label="Parent purpose options"
            style={style}
            className={cn(
                // Figma 9542:20102 container: white card with the
                // WB365 popup shadow (1 px hairline + 2 px crisp +
                // 6/10 px diffuse).
                "pointer-events-auto z-[95] flex flex-col rounded-md bg-white p-1",
                "shadow-[0_1px_1px_0_rgba(0,0,0,0.1),_0_0_2px_0_rgba(0,0,0,0.1),_0_6px_10px_0_rgba(0,0,0,0.1)]",
            )}
        >
            {filtered.length === 0 ? (
                <div className="px-2 py-3 text-wb-13 font-normal text-wb-ntrl-6">
                    No matches
                </div>
            ) : (
                <ul
                    className="custom-scrollbar-y flex flex-col overflow-y-auto"
                    style={{ maxHeight: MAX_HEIGHT }}
                >
                    {filtered.map((opt) => {
                        const isSelected = opt.code === selected;
                        return (
                            <li key={opt.code}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onMouseDown={(e) => {
                                        // Prevent the trigger input
                                        // from losing focus before
                                        // onClick fires — mousedown
                                        // moves focus, which would
                                        // race against the click
                                        // commit.
                                        e.preventDefault();
                                    }}
                                    onClick={() => onSelect(opt)}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center gap-[2px] rounded-[4px] px-2 py-2 text-left",
                                        // Row text matches the Purpose
                                        // Name table cells + the input
                                        // chrome itself (`text-wb-13`)
                                        // so the dropdown reads as one
                                        // continuous typographic
                                        // surface with the input.
                                        "text-wb-13 font-medium text-wb-ntrl-8",
                                        "hover:bg-wb-bg-sidebar",
                                        isSelected && "bg-brand-soft text-brand-active",
                                    )}
                                >
                                    <span className="truncate">{opt.code}</span>
                                    <span aria-hidden>-</span>
                                    <span className="truncate">{opt.name}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>,
        document.body,
    );
}
