"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import DeleteIcon from "@/components/shared/icons/DeleteIcon";
import EditIcon from "@/components/shared/icons/EditIcon";
import { useTranslation } from "@/lib/i18n";

export type FirmBankingRowMenuProps = {
    /** Bounding rect of the kebab `⋮` button captured at click time.
     *  The menu anchors its right-edge to the trigger's right-edge so
     *  it extends LEFT into the viewport (matches Figma 5936:24741)
     *  and pins itself just below the trigger. Passed in as `DOMRect`
     *  so the parent can swap rows atomically — clicking row B's
     *  kebab while row A's menu is open closes A and opens B with B's
     *  rect in a single render. */
    anchorRect: DOMRect;
    /** Visible bank label — surfaces in the per-row aria-labels so
     *  screen readers announce *which* row the action targets. */
    bankLabel: string;
    onEdit: () => void;
    onDelete: () => void;
    /** Fired when the menu wants to dismiss itself — outside-click,
     *  ESC, or after picking an item. The host owns the open/closed
     *  state. */
    onClose: () => void;
};

/**
 * Firm Banking row-action menu — Figma 5936:24741.
 *
 * Compact floating dropdown anchored to a row's kebab `⋮` via a
 * captured `DOMRect`. Renders into `document.body` via `createPortal`
 * with `position: fixed`, so it's NEVER clipped by the panel's
 * `overflow-hidden` outer container or the linked-account list's own
 * scroll wrapper.
 *
 * Layout per Figma 5936:24741:
 *   - Container: `bg-white rounded-md p-1 gap-0.5`, drop-shadow stack
 *     (0 0 0.5 / 0 1 1 / 0 4 10) — lighter than the LoginCredentials
 *     menu shadow because the spec uses smaller blur/offsets.
 *   - Each item: `p-1.5 rounded gap-2.5` row, `size-4` icon on the
 *     left, label `text-wb-13 font-medium`. Note the wider
 *     icon→label gap (10 px) than the LoginCredentials menu (4 px).
 *   - Edit: text + icon `text-wb-dark` (#05111d).
 *   - Delete: text + icon `text-destructive` — the project-wide
 *     destructive token (CSS var `--color-destructive`, defined in
 *     `app/globals.css` against both light and dark scopes and used
 *     by every shadcn `<Button variant="destructive">` in the
 *     codebase). Earlier revisions used `text-wb-red-07` (a
 *     feature-specific WB365 red-07 token), but that token resolved
 *     as transparent in some Tailwind 4 build environments,
 *     rendering Delete with no color. Switching to the shadcn
 *     destructive token aligns the row-menu Delete with the
 *     destructive primary button rendered by `<SystemDialog
 *     destructive />` so the two destructive surfaces share the
 *     same proven color value.
 *   - Hover paints `bg-wb-bg-sidebar` (matches every other dropdown
 *     in this codebase — Select Institution, View Setting popover,
 *     LoginCredentials row menu).
 *
 * Why this isn't a shared `<RowActionMenu>` yet: only two menus
 * exist today (this + LoginCredentials), and the spacing/typography
 * differ (text-wb-13/p-1.5/gap-2.5 vs text-wb-14/p-2/gap-1). The
 * second consumer is the trigger to extract per CLAUDE.md §1; if a
 * third menu lands with overlapping geometry, lift them then.
 *
 * Z-index: `z-[95]` — chosen so the menu always sits ABOVE the
 * deepest stacked Radix `<Dialog>` (L5 → `z-[91]` per
 * components/ui/dialog.tsx) and still BELOW `<SystemDialog>`
 * (`z-[100]`, the always-on-top feedback surface). This is what
 * lets the menu open from any depth — Settings panel rows (L1
 * SettingsModal) AND the Firm Banking Details dialog kebab (L2
 * shadcn Dialog at `z-[61]`) — without the dialog content
 * occluding it. Does NOT register with `modalStack` because it's
 * a panel-local popover, not a modal — ESC dismisses only the
 * menu, leaving any underlying dialog in the stack untouched.
 */

const MENU_MIN_WIDTH = 130;
const OFFSET = 4;
const VIEWPORT_PAD = 8;

export default function FirmBankingRowMenu({
    anchorRect,
    bankLabel,
    onEdit,
    onDelete,
    onClose,
}: FirmBankingRowMenuProps) {
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

    // Anchor right-edge of the menu to the kebab's right-edge so the
    // menu extends LEFT — matches Figma 5936:24741 where the menu is
    // visually right-aligned to the action button. Pinned just below
    // the trigger; falls back to "above the trigger" when the bottom
    // would push past the viewport.
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
        // document.body, but when this menu opens from inside a Radix
        // <Dialog> (e.g. <FirmBankingDetailsDialog>) Radix has set
        // `body { pointer-events: none }` to block clicks outside the
        // dialog content. Without re-enabling pointer events on the
        // menu wrapper, clicks on Edit / Delete fall through silently
        // even though the menu is visually on top. Same gotcha
        // <SystemDialog> documents at z-[100]; we apply it here so
        // the menu works regardless of which surface launches it.
        <div
            ref={menuRef}
            role="menu"
            aria-label={bankLabel}
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
                            // a row's own click → details modal) on
                            // call sites where the kebab + menu are
                            // nested inside an interactive row.
                            e.stopPropagation();
                            onEdit();
                            onClose();
                        }}
                        aria-label={t(
                            "settings.firm_banking_settings.row_menu.aria_edit",
                            { bank: bankLabel },
                        )}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded p-1.5 text-left hover:bg-wb-bg-sidebar"
                    >
                        <EditIcon className="size-4 shrink-0 text-wb-dark" />
                        <span className="truncate text-wb-13 font-medium text-wb-dark">
                            {t("settings.firm_banking_settings.row_menu.edit")}
                        </span>
                    </button>
                </li>
                <li>
                    {/* Destructive Delete affordance — Figma 5936:24741.
                       Icon AND label use the project-wide
                       `text-destructive` token so the row reads
                       destructive at a glance. The matching destructive
                       primary button in the Confirm Delete dialog
                       (<SystemDialog destructive />) uses the same
                       `bg-destructive` token — keep both surfaces in
                       sync against `--color-destructive`. Do NOT swap
                       to `text-wb-dark` / `text-wb-ink` even on hover;
                       `hover:bg-…` changes background only, the red
                       text/icon must persist. */}
                    <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                            onClose();
                        }}
                        aria-label={t(
                            "settings.firm_banking_settings.row_menu.aria_delete",
                            { bank: bankLabel },
                        )}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded p-1.5 text-left text-destructive hover:bg-wb-bg-sidebar hover:text-destructive"
                    >
                        <DeleteIcon className="size-4 shrink-0 text-destructive" />
                        <span className="truncate text-wb-13 font-medium text-destructive">
                            {t("settings.firm_banking_settings.row_menu.delete")}
                        </span>
                    </button>
                </li>
            </ul>
        </div>,
        document.body,
    );
}
