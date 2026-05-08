"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";

export type RowActionMenuProps = {
    /**
     * Bounding rect of the kebab `⋮` button captured at click time.
     * The menu anchors its right-edge to the trigger's right-edge so
     * it extends LEFT into the viewport (matches Figma) and pins
     * itself just below the trigger. Passed in as `DOMRect` so the
     * parent can swap rows atomically — clicking row B's kebab while
     * row A's menu is open closes A and opens B with B's rect in a
     * single render.
     */
    anchorRect: DOMRect;
    /** Optional aria-label on the menu element — usually a row
     *  identifier (contact name, institution, …) so screen readers
     *  announce *which* row the menu acts on. */
    ariaLabel?: string;
    /** Resolved Edit label (caller runs `t(...)`). */
    editLabel: string;
    /** Resolved Delete label. */
    deleteLabel: string;
    /** Optional aria-label for the Edit `<button>` — defaults to the
     *  visible Edit label when omitted. Pass when the row identifier
     *  should be embedded (e.g. "Edit ACME CORP"). */
    editAriaLabel?: string;
    /** Optional aria-label for the Delete `<button>`. */
    deleteAriaLabel?: string;
    onEdit: () => void;
    onDelete: () => void;
    /** Fired when the menu wants to dismiss itself — outside-click,
     *  ESC, or after picking an item. The host owns the open/closed
     *  state. */
    onClose: () => void;
};

/**
 * Shared row-action menu — Figma 2236:30291 (the canonical Edit /
 * Delete dropdown that appears off the kebab `⋮` button on a list
 * row).
 *
 * Small floating dropdown anchored to a kebab button via a captured
 * `DOMRect`. Renders into `document.body` via `createPortal` with
 * `position: fixed`, so it's NEVER clipped by the table's
 * `overflow-auto` scroll wrapper or the Settings panel's
 * `overflow-hidden` outer container — both would clip an inline
 * absolutely-positioned menu sitting inside the row cell.
 *
 * Layout per Figma:
 *   - Container: `bg-white rounded-[6px]` with the canonical layered
 *     dropdown shadow (`0 1 1 / 0 0 2 / 0 6 20` rgba(0,0,0,0.1))
 *   - Inner padding `p-1` + `gap-0.5` between items
 *   - Each item: `p-2 rounded-[4px] gap-1` row, `size-4` icon on the
 *     left, label `text-wb-14 font-medium leading-4 tracking-wb-tight`
 *   - Edit: text `wb-ntrl-08` (#404040). Delete: text `#bd1822`.
 *   - Hover paints `bg-wb-bg-sidebar` (matches the rest of the
 *     dropdown patterns in this codebase — Select Institution,
 *     View Setting popover, etc.)
 *
 * Z-index: `z-50` to sit above the Settings shell (z-50 too) — the
 * portal mounts AFTER Settings, so DOM order resolves the tie in our
 * favour. The menu does NOT register with the cross-modal
 * `modalStack` (per CLAUDE.md §"Modal stacking convention") because
 * it's a panel-local popover, not a modal — Settings + any stacked
 * Radix dialog above are unaffected by ESC handling here.
 *
 * Dismissal: ESC + outside-click (mousedown anywhere outside the
 * menu element). Click on either Edit / Delete fires the callback
 * and then onClose() — the host can choose to actually open an Edit
 * dialog / fire a delete confirmation; the menu itself owns no
 * application state.
 *
 * Adoption: first promoted out of LoginCredentialsRowMenu when
 * Settings > Contacts became the second consumer. Future kebab-row
 * menus (Bank Account, User, Approval Line, …) MUST consume this
 * component — never re-implement the portal + outside-click + ESC
 * + viewport-clamp logic per feature.
 */

const MENU_MIN_WIDTH = 140;
const OFFSET = 4;
const VIEWPORT_PAD = 8;

export default function RowActionMenu({
    anchorRect,
    ariaLabel,
    editLabel,
    deleteLabel,
    editAriaLabel,
    deleteAriaLabel,
    onEdit,
    onDelete,
    onClose,
}: RowActionMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // ESC + outside-click dismiss. Wrap the outside-click subscription
    // in a 0 ms timeout so the same click that opened the menu (which
    // bubbles after this effect mounts) doesn't immediately close it.
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
            if (menuRef.current?.contains(target)) return;
            onClose();
        }
        document.addEventListener("keydown", handleKey);
        const id = setTimeout(() => {
            document.addEventListener("mousedown", handleMouseDown);
        }, 0);
        return () => {
            clearTimeout(id);
            document.removeEventListener("keydown", handleKey);
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [onClose]);

    // Anchor right-edge of the menu to the kebab's right-edge so the
    // menu extends LEFT — matches Figma 2236:30291 where the menu is
    // visually right-aligned to the action button. Pinned just below
    // the trigger; falls back to "above the trigger" when the bottom
    // would push past the viewport. Computed via useMemo so React
    // doesn't recompute on every render — `anchorRect` is stable per
    // open.
    const style = useMemo<React.CSSProperties>(() => {
        if (typeof window === "undefined") return {};
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = MENU_MIN_WIDTH;
        // The menu's content height is data-driven (only ever two
        // rows), but we don't need an exact value — only enough to
        // decide above/below. Two 32px rows + 8px padding ≈ 80px.
        const estHeight = 80;

        let left = anchorRect.right - width;
        if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
        if (left + width > vw - VIEWPORT_PAD) {
            left = vw - width - VIEWPORT_PAD;
        }

        const belowTop = anchorRect.bottom + OFFSET;
        const aboveBottom = anchorRect.top - OFFSET;
        if (belowTop + estHeight < vh - VIEWPORT_PAD) {
            return { position: "fixed", top: belowTop, left };
        }
        return { position: "fixed", bottom: vh - aboveBottom, left };
    }, [anchorRect]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            aria-label={ariaLabel}
            style={style}
            className="z-50 min-w-[140px] overflow-hidden rounded-[6px] bg-white shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_2px_0px_rgba(0,0,0,0.1),0px_6px_20px_0px_rgba(0,0,0,0.1)]"
        >
            <ul className="flex flex-col gap-0.5 p-1">
                <li>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            onEdit();
                            onClose();
                        }}
                        aria-label={editAriaLabel ?? editLabel}
                        className="flex w-full cursor-pointer items-center gap-1 rounded-[4px] p-2 text-left hover:bg-wb-bg-sidebar"
                    >
                        <Pencil
                            className="size-4 shrink-0 text-wb-ntrl-8"
                            strokeWidth={2}
                            aria-hidden
                        />
                        <span className="truncate text-wb-14 font-medium leading-4 tracking-wb-tight text-wb-ntrl-8">
                            {editLabel}
                        </span>
                    </button>
                </li>
                <li>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            onDelete();
                            onClose();
                        }}
                        aria-label={deleteAriaLabel ?? deleteLabel}
                        className="flex w-full cursor-pointer items-center gap-1 rounded-[4px] p-2 text-left hover:bg-wb-bg-sidebar"
                    >
                        {/* Delete uses the WB365 red-08 (#bd1822) wash
                           per Figma. No token exists for this exact
                           value — wb-red-07 (#e1232e) is the only
                           defined red label token and reads brighter
                           than the spec; arbitrary color is the
                           narrowest deviation. Promote to a token if a
                           third consumer reuses it. */}
                        <Trash2
                            className="size-4 shrink-0 text-[#bd1822]"
                            strokeWidth={2}
                            aria-hidden
                        />
                        <span className="truncate text-wb-14 font-medium leading-4 tracking-wb-tight text-[#bd1822]">
                            {deleteLabel}
                        </span>
                    </button>
                </li>
            </ul>
        </div>,
        document.body,
    );
}
