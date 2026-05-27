"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    ChevronDown,
    ChevronUp,
    ChevronsDown,
    ChevronsUp,
    RotateCcw,
} from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
    isSpecialViewSettingField,
    type ViewSettingItem,
} from "@/components/shared/view-setting/useViewSetting";

/**
 * Shared View Setting popover (Figma 100:13382). Anchored fixed near
 * the trigger that opened it (typically the list-view icon in the
 * page-header action toolbar).
 *
 * Reused by every list page — pages pass the merged column list +
 * setItems + save/reset/cancel callbacks (built via {@link
 * useViewSetting}). Locked rows (FIX_YN='Y') render their checkbox
 * disabled + are skipped by the reorder buttons.
 */
type Props = {
    /** DOMRect of the click trigger so the popover can anchor itself. */
    anchorRect: DOMRect;
    /** Working copy of the column list — local edits before Save. */
    items: ViewSettingItem[];
    /** Setter the reorder + checkbox callbacks call. */
    onItemsChange: (next: ViewSettingItem[]) => void;
    /** Persist working copy → backend. Caller closes the popover on success. */
    onSave: () => void | Promise<void>;
    /** Wipe user overrides → backend. Caller leaves the popover open with
     *  refreshed defaults so the user can verify before closing. */
    onReset: () => void | Promise<void>;
    /** Discard working copy and close. */
    onClose: () => void;
    /** Optional resolver for the row label. Pages pass a function that maps
     *  a ViewSettingItem to the localized header text (typically by aliasing
     *  the DB FIELD_ID to the page's renderer key, then translating the
     *  i18n header key). Falls back to {@code item.field_nm} when omitted —
     *  legacy behaviour, preserved so callers without an i18n mapping
     *  continue to render the DB display name verbatim. The DB FIELD_ID /
     *  FIELD_NM are NEVER mutated; this is purely a presentation hook. */
    getLabel?: (item: ViewSettingItem) => string;
};

const POPUP_WIDTH = 340;
const POPUP_MAX_HEIGHT = 360;
const OFFSET = 6;

export default function ViewSettingPopover({
    anchorRect,
    items,
    onItemsChange,
    onSave,
    onReset,
    onClose,
    getLabel,
}: Props) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const popoverRef = useRef<HTMLDivElement>(null);

    /**
     * Save flow: call the host's `onSave` (which posts to the backend
     * and updates the table optimistically). On success, open the
     * shared Success dialog (blue checkmark + "Success" title + the
     * action-specific description). On failure, the host hook surfaces
     * the error via `vs.error`; we don't double-render here — that's a
     * global concern.
     */
    async function handleSaveClick() {
        try {
            await onSave();
        } catch {
            // Host hook already captured the error in `vs.error` and
            // rolled back the optimistic update. Don't show a success
            // dialog when the save didn't actually succeed.
            return;
        }
        dialog.open({
            type: "success",
            description: t("view_setting.saved_successfully"),
            confirmText: t("dialog.ok"),
        });
    }

    /**
     * Reset flow: confirmation first, then API on Continue, then
     * success acknowledgment. Cancel just closes the confirmation
     * dialog without touching the backend or the working draft. The
     * confirmation dialog stays as `type: "confirmation"`; only the
     * post-action ack uses the Success type. Button labels come from
     * the shared SystemDialog defaults (Cancel / Continue) — do not
     * override per page.
     */
    function handleResetClick() {
        dialog.open({
            type: "confirmation",
            description: t("view_setting.confirm_reset_description"),
            onConfirm: async () => {
                try {
                    await onReset();
                } catch {
                    return;
                }
                dialog.open({
                    type: "success",
                    description: t("view_setting.reset_successfully"),
                    confirmText: t("dialog.ok"),
                });
            },
        });
    }

    // Currently selected row for the First/Prev/Next/Last reorder
    // buttons. Selection is independent of visibility — a hidden row
    // can still be moved. Starts unset so the popover opens with no
    // row pre-highlighted; the reorder buttons stay disabled until the
    // user explicitly clicks a row.
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

    // Anchor right-edge to trigger right-edge so the popover extends
    // LEFT into the viewport (the list-icon trigger sits at the page
    // header's right side). Computed via useMemo rather than a state +
    // effect to avoid the cascading-render lint rule — `anchorRect` is
    // stable per popover-open and doesn't change while the popover is
    // shown, so a one-shot derive is enough.
    const style = useMemo<React.CSSProperties>(() => {
        if (typeof window === "undefined") return {};
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = anchorRect.right - POPUP_WIDTH;
        if (left < 8) left = 8;
        if (left + POPUP_WIDTH > vw - 8) left = vw - POPUP_WIDTH - 8;

        const belowTop = anchorRect.bottom + OFFSET;
        const aboveBottom = anchorRect.top - OFFSET;
        if (belowTop + POPUP_MAX_HEIGHT < vh) {
            return { top: belowTop, left };
        }
        return { bottom: vh - aboveBottom, left };
    }, [anchorRect]);

    // ESC closes; outside-click closes.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const id = setTimeout(() => {
            document.addEventListener("mousedown", onDocClick);
        }, 0);
        return () => {
            clearTimeout(id);
            document.removeEventListener("mousedown", onDocClick);
        };
    }, [onClose]);

    // Items shown in the popup row list.
    // Two categories are excluded from the visible list but preserved in the
    // underlying array so Save+Reset carry them back unchanged:
    //   1. CHECKBOX (DISP_ORD=0) and ETC (DISP_ORD=99) — admin-controlled
    //      structural columns (row-selection, action column). Users cannot
    //      see, hide, reorder, or edit them.
    //   2. DISP_YN='N' rows — columns deliberately hidden from the popup by
    //      the system admin (mirrors IDO.USER_SCR_OPTION_WECMS_R002.xml
    //      `WHERE ... AND USR.DISP_YN = 'Y'` in the legacy JEX system).
    //      VAS_ACCOUNT is the current example — hidden by default until its
    //      backing data lands.
    const userItems = items.filter(
        (it) => !isSpecialViewSettingField(it.field_id) && it.disp_yn !== "N",
    );
    const specialItems = items.filter(
        (it) => isSpecialViewSettingField(it.field_id) || it.disp_yn === "N",
    );

    function handleToggleVisibility(item: ViewSettingItem, visible: boolean) {
        // Defensive — special and DISP_YN='N' rows aren't rendered, so these
        // branches should never fire from real user input. Belt and suspenders.
        if (isSpecialViewSettingField(item.field_id)) return;
        if (item.disp_yn === "N") return;
        // Locked rows ignore visibility toggles (UI also disables the
        // checkbox; this is the defensive fallback).
        if (item.fix_yn === "Y") return;
        onItemsChange(
            items.map((it) =>
                it.field_id === item.field_id
                    ? { ...it, use_yn: visible ? "Y" : "N" }
                    : it,
            ),
        );
    }

    function moveSelected(direction: "first" | "prev" | "next" | "last") {
        if (!selectedFieldId) return;
        // Reorder operates ONLY on user-configurable rows. CHECKBOX/ETC
        // keep their original DISP_ORD (0 / 99) regardless of any normalize
        // step — that's why the renumbering below maps user rows to 1..N
        // and merges specials back unchanged.
        const idx = userItems.findIndex((it) => it.field_id === selectedFieldId);
        if (idx < 0) return;
        const target = userItems[idx];
        if (target.fix_yn === "Y") return;

        const dest =
            direction === "first" ? 0
                : direction === "prev" ? Math.max(0, idx - 1)
                : direction === "next" ? Math.min(userItems.length - 1, idx + 1)
                : userItems.length - 1;
        if (dest === idx) return;

        const next = userItems.slice();
        next.splice(idx, 1);
        next.splice(dest, 0, target);
        const renumbered = next.map((it, i) => ({ ...it, disp_ord: i + 1 }));
        onItemsChange([...specialItems, ...renumbered]);
    }

    const selected = userItems.find((it) => it.field_id === selectedFieldId);
    const canMove = !!selected && selected.fix_yn !== "Y";

    const content = (
        <div
            ref={popoverRef}
            style={{ ...style, width: POPUP_WIDTH }}
            // Figma 100:13382 — drop shadow stack only, no outer
            // border. `rounded-[10px]` per Figma. Header / footer get
            // their own subtle 1px hairline dividers.
            className="fixed z-50 flex max-h-[var(--vs-max-h,400px)] flex-col rounded-[10px] bg-white shadow-wb-popup animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
        >
            {/* Header — Figma 100:13384 */}
            <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-3 py-2">
                <span className="text-wb-14 font-medium leading-8 text-black">
                    {t("view_setting.title")}
                </span>
                <div className="flex items-center gap-1">
                    <ReorderButton
                        ariaLabelKey="view_setting.aria.first"
                        disabled={!canMove}
                        onClick={() => moveSelected("first")}
                    >
                        <ChevronsUp className="size-4" strokeWidth={1.8} />
                    </ReorderButton>
                    <ReorderButton
                        ariaLabelKey="view_setting.aria.prev"
                        disabled={!canMove}
                        onClick={() => moveSelected("prev")}
                    >
                        <ChevronUp className="size-4" strokeWidth={1.8} />
                    </ReorderButton>
                    <ReorderButton
                        ariaLabelKey="view_setting.aria.next"
                        disabled={!canMove}
                        onClick={() => moveSelected("next")}
                    >
                        <ChevronDown className="size-4" strokeWidth={1.8} />
                    </ReorderButton>
                    <ReorderButton
                        ariaLabelKey="view_setting.aria.last"
                        disabled={!canMove}
                        onClick={() => moveSelected("last")}
                    >
                        <ChevronsDown className="size-4" strokeWidth={1.8} />
                    </ReorderButton>
                </div>
            </div>

            {/* Body — Figma 100:13404. Scrollable column list. Only
                user-configurable rows render here; CHECKBOX / ETC are
                excluded by `userItems`. */}
            <div className="custom-scrollbar-y flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1">
                {userItems.map((item) => (
                    <ColumnRow
                        key={item.field_id}
                        item={item}
                        label={getLabel ? getLabel(item) : item.field_nm}
                        selected={item.field_id === selectedFieldId}
                        onSelect={() => setSelectedFieldId(item.field_id)}
                        onToggleVisibility={(v) => handleToggleVisibility(item, v)}
                    />
                ))}
            </div>

            {/* Footer — Figma 100:13420. Reset (outline left) +
               Save (brand) + Cancel (outline right). */}
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-black/10 p-4">
                <button
                    type="button"
                    onClick={handleResetClick}
                    className="flex h-8 cursor-pointer items-center gap-1 rounded-md bg-white px-2 text-wb-14 font-medium text-wb-ntrl-10 shadow-wb-btn"
                >
                    <RotateCcw className="size-4" strokeWidth={1.8} />
                    {t("view_setting.reset")}
                </button>
                <div className="flex flex-1 items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => void handleSaveClick()}
                        className="flex h-8 cursor-pointer items-center rounded-md bg-brand px-3 text-wb-14 font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                    >
                        {t("view_setting.save")}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 cursor-pointer items-center rounded-md bg-white px-3 text-wb-14 font-medium text-wb-ntrl-10 shadow-wb-btn"
                    >
                        {t("view_setting.cancel")}
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document === "undefined") return null;
    return createPortal(content, document.body);
}

function ReorderButton({
    children,
    onClick,
    disabled,
    ariaLabelKey,
}: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    ariaLabelKey: string;
}) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-label={t(ariaLabelKey)}
            className={cn(
                "flex size-7 items-center justify-center rounded-md bg-white text-wb-ntrl-10 shadow-wb-btn",
                disabled
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer hover:bg-wb-bg-active",
            )}
        >
            {children}
        </button>
    );
}

function ColumnRow({
    item,
    label,
    selected,
    onSelect,
    onToggleVisibility,
}: {
    item: ViewSettingItem;
    label: string;
    selected: boolean;
    onSelect: () => void;
    onToggleVisibility: (visible: boolean) => void;
}) {
    const locked = item.fix_yn === "Y";
    // Ref-based discrimination: the row's onClick fires for clicks
    // anywhere on the row, including the checkbox (Radix's checkbox
    // composes click handlers, so a synthetic-event stopPropagation
    // doesn't reliably keep the row's handler from firing). Detecting
    // "did this click originate inside the checkbox button?" via DOM
    // containment is unambiguous regardless of how Radix evolves.
    const checkboxRef = useRef<HTMLButtonElement>(null);

    const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (checkboxRef.current?.contains(e.target as Node)) return;
        onSelect();
    };

    return (
        <div
            role="option"
            tabIndex={0}
            aria-selected={selected}
            onClick={handleRowClick}
            onKeyDown={(e) => {
                // Enter / Space on the row body select it. The checkbox
                // has its own keyboard handling for toggle (Space when
                // it's focused).
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect();
                }
            }}
            className={cn(
                "flex cursor-pointer items-center gap-2 rounded-[5px] px-2.5 py-2",
                selected ? "bg-brand-softer" : "hover:bg-wb-bg-active",
            )}
        >
            <Checkbox
                ref={checkboxRef}
                checked={item.use_yn === "Y"}
                disabled={locked}
                onCheckedChange={(v) => onToggleVisibility(v === true)}
                className="size-[18px] shrink-0"
                aria-label={label}
            />
            <span className="text-wb-14-tight font-medium text-wb-ntrl-8">
                {label}
            </span>
        </div>
    );
}
