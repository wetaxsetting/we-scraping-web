"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { ApproverRow } from "./approverMockData";

const POPOVER_WIDTH = 260;
const OFFSET = 4;
const VIEWPORT_PAD = 8;

type AddApproverPopoverProps = {
    /**
     * Bounding rect of the "+ Add Approver" trigger captured at click
     * time. Anchored right-edge-to-right-edge so the popup extends LEFT
     * (matches the user's spec mock + Figma popup width of 260 px).
     */
    anchorRect: DOMRect;
    /**
     * Directory of approvers the user can pick from. Already-added rows
     * are filtered out by the host so the user can't double-add the same
     * person.
     */
    available: ApproverRow[];
    /**
     * Maximum number of new approvers the host can accept, equal to
     * `MAX_APPROVERS - approvers.length`. The popover does NOT enforce
     * this internally — selection is unbounded — but the "Add N Approver"
     * button label uses `Math.min(selected.size, capacity)` so the host
     * sees an honest count if any future hard cap kicks in.
     */
    capacity: number;
    /** Fired when ESC, outside-click, or the X close affordance dismisses
     *  the popover without committing. */
    onClose: () => void;
    /** Fired when the Add button commits — receives the selected pool
     *  rows in selection order. The host appends them to the chain. */
    onAdd: (rows: ApproverRow[]) => void;
};

/**
 * Add Approver popover — Figma 9196:12153 (initial), 9196:12218
 * (assigned state), 9196:12296 (empty search state).
 *
 * Compact 260 px floating dropdown, anchored to the "+ Add Approver"
 * button inside the Add Approval Line dialog. Renders into
 * `document.body` via `createPortal` so the dialog's overflow / focus
 * trap don't clip it; `pointer-events-auto` + `z-[95]` overcome Radix
 * Dialog's `body { pointer-events: none }` lock and stay above the
 * dialog content (z-[61]) without colliding with the system feedback
 * surface (z-[100]).
 *
 * Layout per Figma:
 *   - Container: `bg-white rounded-md shadow-[0_1px_1px,_0_0_2px,_0_6px_20px]`,
 *                fixed 260 px width.
 *   - Search:    `bg-white border-b #e5e5e5 py-1`, input with leading
 *                `Search` glyph + `text-wb-14` placeholder.
 *   - Count row: `bg-wb-bg-footer border-b #e5e5e5 px-2.5 py-1`, "{n} of {N}
 *                selected" left + brand-hover "Clear all" link right.
 *                Always visible (matches the user-supplied spec mock).
 *   - List:      flex-col of rows, each `border-b #f5f5f5 p-2.5` with
 *                row name on the left + Radix `<Checkbox>` (size-4) on
 *                the right. Selected row paints `bg-[#ebf7ff]`.
 *   - Empty:     when filtered list is empty, render the Figma 9196:12296
 *                "No matching approvers" placeholder (40 px search glyph,
 *                title + helper).
 *   - Footer:    `bg-wb-bg-footer border-t #e5e5e5 px-2.5 py-4`, full-width
 *                Add button. Disabled (grey) at 0 selected; brand-blue
 *                ("Add N Approver") at 1+.
 *
 * Behaviour:
 *   - ESC dismisses the popover only (parent dialog stays open).
 *   - Outside-click dismisses the popover only — clicks landing INSIDE
 *     the parent dialog still close just the popover, since the popover
 *     owns the listener and Radix Dialog at stackLevel=2 defaults to
 *     `closeOnOutsideClick={false}`.
 *   - Search filters by case-insensitive substring on `name`.
 *   - Clear all resets the local selection set without dismissing.
 *   - Add commits the selected rows (in directory order) to the host.
 */
export default function AddApproverPopover({
    anchorRect,
    available,
    capacity,
    onClose,
    onAdd,
}: AddApproverPopoverProps) {
    const { t } = useTranslation();
    const popoverRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [query, setQuery] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        () => new Set(),
    );

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return available;
        return available.filter((row) =>
            row.name.toLowerCase().includes(needle),
        );
    }, [available, query]);

    /** ESC + outside-click dismiss. Wrap the outside-click subscription
     *  in a 0 ms timeout so the same click that opened the popover
     *  doesn't immediately close it. Stop propagation on ESC so the
     *  parent Radix Dialog's escape handler doesn't also fire. */
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

    /** Autofocus the search input on mount so keyboard users land in
     *  the field directly — matches Figma 9196:12296 where the cursor
     *  visibly sits inside the search input on open. */
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    /** Right-edge anchor: popover right edge aligns with the trigger's
     *  right edge so the popup extends LEFT into the dialog body. Pinned
     *  just below the trigger; falls back to "above" when the bottom
     *  would push past the viewport. */
    const style = useMemo<React.CSSProperties>(() => {
        if (typeof window === "undefined") return {};
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const estHeight = 360;

        let left = anchorRect.right - POPOVER_WIDTH;
        if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
        if (left + POPOVER_WIDTH > vw - VIEWPORT_PAD) {
            left = vw - POPOVER_WIDTH - VIEWPORT_PAD;
        }

        const belowTop = anchorRect.bottom + OFFSET;
        const aboveBottom = anchorRect.top - OFFSET;
        if (belowTop + estHeight < vh - VIEWPORT_PAD) {
            return {
                position: "fixed",
                top: belowTop,
                left,
                width: POPOVER_WIDTH,
            };
        }
        return {
            position: "fixed",
            bottom: vh - aboveBottom,
            left,
            width: POPOVER_WIDTH,
        };
    }, [anchorRect]);

    const totalAvailable = available.length;
    const selectedCount = selectedIds.size;
    const addEnabled = selectedCount > 0;

    function toggle(id: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function clearAll() {
        setSelectedIds(new Set());
    }

    function handleAdd() {
        if (!addEnabled) return;
        const picked = available.filter((row) => selectedIds.has(row.id));
        const limited = capacity > 0 ? picked.slice(0, capacity) : picked;
        onAdd(limited);
    }

    if (typeof document === "undefined") return null;

    return createPortal(
        // `pointer-events-auto` is load-bearing: Radix Dialog locks
        // `body { pointer-events: none }` while open, so any portalled
        // child must opt back in or its clicks fall through silently.
        // z-[95] sits above the L2 dialog content (z-[61]) and below
        // the system feedback surface (z-[100]).
        <div
            ref={popoverRef}
            role="dialog"
            aria-label={t("settings.approval_line.add_dialog.add_approver")}
            style={style}
            className="pointer-events-auto z-[95] flex flex-col overflow-hidden rounded-md bg-white shadow-[0_1px_1px_0_rgba(0,0,0,0.1),_0_0_2px_0_rgba(0,0,0,0.1),_0_6px_20px_0_rgba(0,0,0,0.1)]"
        >
            {/* Search — Figma 9196:12159. Borderless input flush against
               the popover edges; bottom border supplied by the wrapper. */}
            <div className="border-b border-wb-ntrl-3 bg-white py-1">
                <div className="flex items-center gap-1.5 px-2 py-2">
                    <Search
                        className="size-4 shrink-0 text-wb-ntrl-5"
                        strokeWidth={1.8}
                        aria-hidden
                    />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t(
                            "settings.approval_line.add_dialog.search_placeholder",
                        )}
                        aria-label={t(
                            "settings.approval_line.add_dialog.search_placeholder",
                        )}
                        className="flex-1 min-w-0 bg-transparent text-wb-14-tight font-medium text-wb-ntrl-10 caret-brand outline-none placeholder:text-wb-ntrl-5"
                    />
                </div>
            </div>

            {/* Count row — Figma 9196:12253. Always visible (matches the
               user-supplied spec mock). Light grey backdrop so the count
               + Clear all link read as a meta-row distinct from the list. */}
            <div className="flex items-center justify-between gap-2 border-b border-wb-ntrl-3 bg-wb-bg-footer px-2.5 py-1">
                <span className="text-wb-13 font-normal leading-5 text-wb-dark">
                    {t("settings.approval_line.add_dialog.selected_count", {
                        current: String(selectedCount),
                        max: String(totalAvailable),
                    })}
                </span>
                <button
                    type="button"
                    onClick={clearAll}
                    disabled={selectedCount === 0}
                    className="cursor-pointer rounded p-1 text-wb-12 font-medium tracking-wb-tight text-brand-hover hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {t("settings.approval_line.add_dialog.clear_all")}
                </button>
            </div>

            {/* List — Figma 9196:12259. Capped at ~210 px tall via
               max-height + scroll so the popup never grows beyond the
               dialog viewport on small screens. Empty filtered state
               renders the Figma 9196:12296 placeholder. */}
            {filtered.length === 0 ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center gap-1 px-4 py-6 text-center">
                    <Search
                        className="size-10 text-wb-ntrl-5"
                        strokeWidth={1.5}
                        aria-hidden
                    />
                    <p className="text-wb-12 font-semibold text-wb-dark">
                        {t(
                            "settings.approval_line.add_dialog.empty_search_title",
                        )}
                    </p>
                    <p className="text-wb-11 font-medium text-wb-ntrl-6">
                        {t(
                            "settings.approval_line.add_dialog.empty_search_hint",
                        )}
                    </p>
                </div>
            ) : (
                <ul className="custom-scrollbar-y max-h-[210px] overflow-y-auto">
                    {filtered.map((row, i) => {
                        const checked = selectedIds.has(row.id);
                        return (
                            <li
                                key={row.id}
                                className={cn(
                                    "flex items-center gap-2 px-2.5 py-2.5",
                                    i < filtered.length - 1 &&
                                        "border-b border-wb-bg-sidebar",
                                    checked && "bg-brand-soft",
                                )}
                            >
                                <label className="flex flex-1 cursor-pointer items-center justify-between gap-2">
                                    <span className="block flex-1 truncate text-wb-13 font-medium leading-5 text-wb-ink">
                                        {row.name}
                                    </span>
                                    <Checkbox
                                        checked={checked}
                                        onCheckedChange={() =>
                                            toggle(row.id)
                                        }
                                        aria-label={row.name}
                                    />
                                </label>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Footer — Figma 9196:12215 (disabled) / 9196:12292 (enabled).
               Full-width Add chip. Disabled state uses the WB365 ntrl-04
               grey fill the Figma frame specifies; enabled state uses the
               standard primary-blue + brand-btn shadow. */}
            <div className="flex items-center justify-end border-t border-wb-ntrl-3 bg-wb-bg-footer px-2.5 py-4">
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!addEnabled}
                    className={cn(
                        "flex h-6 w-full cursor-pointer items-center justify-center rounded-[4px] px-1 text-wb-12 font-medium tracking-wb-tight text-white",
                        addEnabled
                            ? "bg-brand shadow-wb-brand-btn hover:bg-brand-hover"
                            : "cursor-not-allowed bg-wb-ntrl-4 shadow-wb-outline",
                    )}
                >
                    {addEnabled
                        ? t(
                              "settings.approval_line.add_dialog.add_count",
                              { count: String(selectedCount) },
                          )
                        : t("settings.approval_line.add_dialog.add_short")}
                </button>
            </div>
        </div>,
        document.body,
    );
}
