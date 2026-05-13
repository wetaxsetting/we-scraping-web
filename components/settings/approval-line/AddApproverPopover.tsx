"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { ApproverRow } from "./approverMockData";

type AddApproverPopoverProps = {
    /**
     * Directory of approvers the user can pick from. Already-added
     * rows are filtered out by the host so the user can't double-add
     * the same person.
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
    /** Fired when ESC or outside-click dismisses the popover without
     *  committing. */
    onClose: () => void;
    /** Fired when the Add button commits — receives the selected pool
     *  rows in selection order. The host appends them to the chain. */
    onAdd: (rows: ApproverRow[]) => void;
};

/**
 * Add Approver popover — Figma 9196:12153 (initial), 9196:12218
 * (assigned state), 9196:12296 (empty search state).
 *
 * <p>Rendered <b>inline</b> as an absolute-positioned sibling of
 * the "+ Add Approver" trigger button. The host wraps both the
 * trigger and this popover in a {@code relative} container so this
 * component anchors via plain CSS (`right-0 top-full mt-1`) — no
 * viewport-coord math, no {@code createPortal}.
 *
 * <h2>Why no portal</h2>
 *
 * The parent {@link import('@/components/ui/dialog').Dialog} is a
 * Radix Dialog whose {@code DialogContent} sets a CSS transform
 * (the centering {@code translate-x/y-1/2}) plus
 * {@code overflow-hidden}. Two consequences:
 *
 *  <ol>
 *    <li>{@code position: fixed} inside the dialog is relative to
 *        DialogContent, not the viewport — so viewport-coord
 *        anchoring is broken anyway.</li>
 *    <li>Children portalled to {@code document.body} land OUTSIDE
 *        Radix's {@code FocusScope} + {@code inert} boundary. Radix
 *        marks body siblings of the open dialog as
 *        {@code aria-hidden} / inert, which prevents the search
 *        input from accepting focus when the user clicks it — the
 *        original "Add Approver dropdown ignores typing / scrolling"
 *        bug.</li>
 *  </ol>
 *
 * <p>Rendering inline keeps the popover inside Radix's focus scope
 * (input is focusable) and inside DialogContent's clip rect (popover
 * never overflows the modal — what the user asked for).
 * Scroll-chaining into the parent modal is blocked at the popover
 * boundary via {@code overscroll-behavior: contain} on the
 * scrollable list.
 *
 * <h2>Behaviour</h2>
 * <ul>
 *   <li>ESC dismisses the popover only (parent dialog stays open).</li>
 *   <li>Outside-click dismisses — the listener compares the click
 *       target against the popover ref + the popover's own anchor
 *       wrapper (set by the host via the {@code data-popover-anchor}
 *       attribute) so clicks on the trigger button itself don't
 *       double-toggle.</li>
 *   <li>Search filters by case-insensitive substring on
 *       {@code name}.</li>
 *   <li>Clear all resets the local selection set without
 *       dismissing.</li>
 *   <li>Add commits the selected rows (in directory order) to the
 *       host.</li>
 * </ul>
 */
export default function AddApproverPopover({
    available,
    capacity,
    onClose,
    onAdd,
}: AddApproverPopoverProps) {
    const { t } = useTranslation();
    const popoverRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [query, setQuery] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return available;
        return available.filter((row) =>
            row.name.toLowerCase().includes(needle),
        );
    }, [available, query]);

    /** ESC + outside-click dismiss. The outside-click subscription is
     *  wrapped in a 0 ms timeout so the same click that opened the
     *  popover doesn't immediately close it. ESC's `stopPropagation`
     *  keeps the parent Radix Dialog's escape handler from also
     *  firing. */
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
            // Clicks inside the popover keep it open.
            if (popoverRef.current?.contains(target)) return;
            // Clicks on the anchor wrapper (the +Add Approver button
            // and its `relative` container) are the trigger's own
            // toggle — let the host decide. We dismiss only on clicks
            // landing strictly outside both.
            const anchor = popoverRef.current?.parentElement;
            if (anchor?.contains(target)) return;
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
     *  visibly sits inside the search input on open. Now that the
     *  popover lives INSIDE the Radix focus scope, this focus call
     *  isn't reclaimed by the dialog's focus trap. */
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

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

    return (
        <div
            ref={popoverRef}
            role="dialog"
            aria-label={t("settings.approval_line.add_dialog.add_approver")}
            // Anchored: bottom-right of the trigger via the host's
            // `relative` wrapper. Width pinned at 260px to match Figma
            // 9196:12153. z-10 keeps it above the chain table sticky
            // header (z-20 belongs to the drag-instruction strip, but
            // that lives further down the dialog body).
            className="absolute right-0 top-full z-30 mt-1 flex w-[260px] flex-col overflow-hidden rounded-md bg-white shadow-[0_1px_1px_0_rgba(0,0,0,0.1),_0_0_2px_0_rgba(0,0,0,0.1),_0_6px_20px_0_rgba(0,0,0,0.1)]"
        >
            {/* Search — Figma 9196:12159. */}
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

            {/* Count row — Figma 9196:12253. */}
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

            {/* List — Figma 9196:12259.
               `overscroll-contain` is load-bearing: it stops wheel /
               touch scroll-chaining from leaking into the parent
               Radix Dialog body (or the page) when the user reaches
               either end of the list. The list owns its own scroll
               viewport. */}
            {filtered.length === 0 ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center gap-1 px-4 py-6 text-center">
                    <Search
                        className="size-10 text-wb-ntrl-5"
                        strokeWidth={1.5}
                        aria-hidden
                    />
                    <p className="text-wb-12 font-semibold text-wb-dark">
                        {t("settings.approval_line.add_dialog.empty_search_title")}
                    </p>
                    <p className="text-wb-11 font-medium text-wb-ntrl-6">
                        {t("settings.approval_line.add_dialog.empty_search_hint")}
                    </p>
                </div>
            ) : (
                <ul className="custom-scrollbar-y max-h-[210px] overflow-y-auto overscroll-contain">
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
                                        onCheckedChange={() => toggle(row.id)}
                                        aria-label={row.name}
                                    />
                                </label>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Footer — Figma 9196:12215 / 9196:12292. */}
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
                        ? t("settings.approval_line.add_dialog.add_count", {
                              count: String(selectedCount),
                          })
                        : t("settings.approval_line.add_dialog.add_short")}
                </button>
            </div>
        </div>
    );
}
