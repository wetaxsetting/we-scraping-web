"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

export type VasAccountRowMenuProps = {
    /** Bounding rect of the kebab `⋮` button captured at click time.
     *  The menu anchors its right-edge to the trigger's right-edge so
     *  it extends LEFT into the viewport (matches the canonical Settings
     *  row-menu placement) and pins itself just below the trigger.
     *  Passed in as `DOMRect` so the parent can swap rows atomically —
     *  clicking row B's kebab while row A's menu is open closes A and
     *  opens B with B's rect in a single render. */
    anchorRect: DOMRect;
    /** VAS code of the row — surfaces in the per-row aria-labels so
     *  screen readers announce *which* row the action targets. */
    code: string;
    onEdit: () => void;
    onDelete: () => void;
    /** Fired when the menu wants to dismiss itself — outside-click,
     *  ESC, or after picking an item. The host owns the open/closed
     *  state. */
    onClose: () => void;
};

/**
 * VAS Account row-action menu — same geometry / chrome as
 * `FirmBankingRowMenu` (Figma 5936:24741): compact floating dropdown
 * anchored to a row's kebab `⋮` via a captured `DOMRect`. Renders into
 * `document.body` via `createPortal` with `position: fixed`, so it's
 * NEVER clipped by the panel's `overflow-hidden` outer container or
 * the table's own scroll wrapper.
 *
 * Layout:
 *   - Container: `bg-white rounded-md p-1 gap-0.5`, drop-shadow stack
 *     (0 0 0.5 / 0 1 1 / 0 4 10).
 *   - Each item: `p-1.5 rounded gap-2.5` row, `size-4` icon on the
 *     left, label `text-wb-13 font-medium`.
 *   - Edit: text + icon `text-wb-dark` (#05111d).
 *   - Delete: text + icon `text-wb-red-07` (#e1232e — WB365 red-07
 *     token).
 *   - Hover paints `bg-wb-bg-sidebar` (matches every other dropdown
 *     in this codebase).
 *
 * Z-index `z-[95]` — sits ABOVE the deepest stacked Radix `<Dialog>`
 * (L5 → `z-[91]`) and BELOW `<SystemDialog>` (`z-[100]`), so the menu
 * works whether the user opens it from the Settings panel (L1) or
 * from any future stacked surface. Does NOT register with
 * `modalStack` because it's a panel-local popover, not a modal — ESC
 * dismisses only the menu, leaving any underlying dialog untouched.
 *
 * NOTE — third consumer of the same shape (FirmBanking + LoginCredentials
 * are the prior two). Per CLAUDE.md §1 this is the trigger to lift the
 * three menus into a shared `<RowActionMenu>` primitive; that
 * extraction is intentionally OUT OF SCOPE here per the task brief
 * ("do not modify unrelated components"), and is tracked for the next
 * Settings stabilisation pass.
 */

const MENU_MIN_WIDTH = 130;
const OFFSET = 4;
const VIEWPORT_PAD = 8;

export default function VasAccountRowMenu({
    anchorRect,
    code,
    onEdit,
    onDelete,
    onClose,
}: VasAccountRowMenuProps) {
    const { t } = useTranslation();
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

    const style = useMemo<React.CSSProperties>(() => {
        if (typeof window === "undefined") return {};
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = MENU_MIN_WIDTH;
        // Two compact 28px rows + 8px vertical padding ≈ 70px — only
        // needs to be close enough to decide above/below.
        const estHeight = 70;

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
        // `pointer-events-auto` is load-bearing — the menu portals to
        // document.body, but when the menu opens from inside a Radix
        // <Dialog> Radix has set `body { pointer-events: none }` to
        // block clicks outside the dialog content. Without re-enabling
        // pointer events on the menu wrapper, clicks on Edit / Delete
        // would fall through silently.
        <div
            ref={menuRef}
            role="menu"
            aria-label={t("settings.vas_account.row_menu_aria", { code })}
            style={style}
            className="pointer-events-auto z-[95] min-w-[130px] overflow-hidden rounded-md bg-white shadow-[0px_0px_0.5px_0px_rgba(0,0,0,0.22),0px_1px_1px_0px_rgba(0,0,0,0.06),0px_4px_10px_0px_rgba(0,0,0,0.15)]"
        >
            <ul className="flex flex-col gap-0.5 p-1">
                <li>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                            // `stopPropagation` keeps the click from
                            // bubbling into any parent listener (e.g.
                            // a row's own click handler) on call sites
                            // where the kebab + menu are nested inside
                            // an interactive row.
                            e.stopPropagation();
                            onEdit();
                            onClose();
                        }}
                        aria-label={t(
                            "settings.vas_account.row_menu.aria_edit",
                            { code },
                        )}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded p-1.5 text-left hover:bg-wb-bg-sidebar"
                    >
                        <Pencil
                            className="size-4 shrink-0 text-wb-dark"
                            strokeWidth={2}
                            aria-hidden
                        />
                        <span className="truncate text-wb-13 font-medium text-wb-dark">
                            {t("settings.vas_account.row_menu.edit")}
                        </span>
                    </button>
                </li>
                <li>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                            onClose();
                        }}
                        aria-label={t(
                            "settings.vas_account.row_menu.aria_delete",
                            { code },
                        )}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded p-1.5 text-left hover:bg-wb-bg-sidebar"
                    >
                        <Trash2
                            className="size-4 shrink-0 text-wb-red-07"
                            strokeWidth={2}
                            aria-hidden
                        />
                        <span className="truncate text-wb-13 font-medium text-wb-red-07">
                            {t("settings.vas_account.row_menu.delete")}
                        </span>
                    </button>
                </li>
            </ul>
        </div>,
        document.body,
    );
}
