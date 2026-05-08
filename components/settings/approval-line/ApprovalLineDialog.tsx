"use client";

import { useMemo, useState } from "react";
import { GripVertical, Info, Plus, X } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

import AddApproverPopover from "./AddApproverPopover";
import {
    APPROVER_POOL,
    MAX_APPROVERS,
    type ApproverRow,
} from "./approverMockData";

/**
 * Dialog mode toggles the title + footer button label, and is the single
 * switch that distinguishes "Add" from "Update". Every other piece of
 * chrome (Esc/X header, hero name input, "+ Add Approver" button,
 * approver table, count badge, "Approvers assigned" label, Cancel button)
 * stays identical between modes — that's the explicit ask in the user
 * spec ("almost the same as Add Approval Line modal").
 */
export type ApprovalLineDialogMode = "add" | "update";

type ApprovalLineDialogProps = {
    mode: ApprovalLineDialogMode;
    /** Pre-fills the hero name input. Defaults to empty. */
    initialName?: string;
    /** Seeds the approver chain table. Defaults to empty. */
    initialApprovers?: ApproverRow[];
    onClose: () => void;
};

/**
 * Approval Line dialog — Figma 9196:11969 (empty-add) + 9196:11547
 * (assigned-add). Supports both Add and Update via the `mode` prop:
 *
 *   - `mode="add"`    → title "Add Approval line",    button "Save"
 *   - `mode="update"` → title "Update Approval Line", button "Update"
 *
 * Custom-shape modal that deliberately deviates from the standard
 * <DialogHeader>/<DialogBody>/<DialogFooter> rhythm because the Figma
 * frame specifies its own padding, header / footer borders, and header
 * "Esc + X" affordance (mirroring the parent Settings shell). The
 * shared <Dialog> primitive (Radix portal + overlay + keyboard +
 * modalStack) still provides the chrome — only the content shape is
 * overridden.
 *
 * Sits at stackLevel=2 because it's a direct child of the Settings
 * modal: Settings = L1 (bg-black/45), this dialog = L2 (bg-black/20).
 * ESC closes only this dialog (modalStack ensures the parent Settings
 * shell stays mounted) — see CLAUDE.md §"Modal stacking convention".
 *
 * Static UI (both modes):
 *   - Add mode boots empty so the "0 of 5" footer + 4 placeholder ghost
 *     rows match Figma 9196:11969.
 *   - Update mode boots with `initialName` + `initialApprovers` so the
 *     hero input + chain mirror the row the user clicked Edit on.
 *   - Remove dispatches locally — drops the row + decrements the
 *     "n of 5" badge.
 *   - "+ Add Approver" opens a portal-rendered popover anchored to
 *     the button's right edge (Figma 9196:12153). Picking approvers
 *     and pressing Add appends them to the chain; selecting again
 *     filters out already-added rows so the same person can't be
 *     double-added.
 *   - Cancel / Save / Update / X / ESC all just dismiss the dialog
 *     without mutating the parent's approval-line list.
 */
export default function ApprovalLineDialog({
    mode,
    initialName = "",
    initialApprovers,
    onClose,
}: ApprovalLineDialogProps) {
    const { t } = useTranslation();

    const [approvalLineName, setApprovalLineName] = useState(initialName);
    const [approvers, setApprovers] = useState<ApproverRow[]>(
        initialApprovers ?? [],
    );

    /**
     * Bounding rect of the "+ Add Approver" trigger captured at click.
     * `null` keeps the popover closed; setting a rect mounts the
     * popover and anchors it to that geometry. Cleared on dismiss
     * (outside-click / ESC / Add commit).
     */
    const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);

    const handleRemove = (id: string) => {
        setApprovers((rows) => rows.filter((r) => r.id !== id));
    };

    /** Pool of selectable approvers minus rows already in the chain so
     *  the same person can't be double-added across consecutive Add
     *  Approver opens. */
    const available = useMemo(
        () =>
            APPROVER_POOL.filter(
                (poolRow) => !approvers.some((a) => a.id === poolRow.id),
            ),
        [approvers],
    );

    const remainingCapacity = Math.max(MAX_APPROVERS - approvers.length, 0);
    const addApproverDisabled =
        approvers.length >= MAX_APPROVERS || available.length === 0;

    function handleOpenPopover(e: React.MouseEvent<HTMLButtonElement>) {
        setPopoverAnchor(e.currentTarget.getBoundingClientRect());
    }

    function handlePopoverAdd(rows: ApproverRow[]) {
        setApprovers((prev) => [...prev, ...rows].slice(0, MAX_APPROVERS));
        setPopoverAnchor(null);
    }

    const titleKey =
        mode === "update"
            ? "settings.approval_line.update_dialog.title"
            : "settings.approval_line.add_dialog.title";
    const primaryButtonKey =
        mode === "update"
            ? "settings.approval_line.update_dialog.update"
            : "settings.approval_line.add_dialog.save";

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={2}
                hideClose
                aria-describedby={undefined}
                className="max-w-[880px] rounded-2xl p-0"
            >
                {/* Header — title + Esc badge + custom X close. Mirrors the
                   Settings shell's top-right "Esc + X" affordance so the
                   close interaction reads identically. */}
                <div className="flex shrink-0 items-center gap-1 border-b border-wb-border-sidebar p-5">
                    <DialogTitle asChild>
                        <h2 className="flex-1 text-wb-16 font-semibold leading-[22.9px] tracking-wb-tight text-wb-dark">
                            {t(titleKey)}
                        </h2>
                    </DialogTitle>
                    <span className="rounded bg-wb-ntrl-3 px-1 py-px text-wb-13 font-medium text-wb-ntrl-6">
                        {t("settings.esc")}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t("settings.close")}
                        className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-wb-ink hover:bg-black/5"
                    >
                        <X className="size-[18px]" strokeWidth={2} />
                    </button>
                </div>

                {/* Body — name input + Add Approver action + table. */}
                <div className="flex min-h-0 flex-1 flex-col p-5 pt-0">
                    {/* Approval line name — borderless input with a thin
                       bottom rule per Figma 9196:11978. Styled as a hero
                       title input (24/600). Empty state shows the Figma
                       placeholder; typed text inherits the same size/weight
                       so the input feels seamless with the placeholder. */}
                    <div className="border-b border-wb-ntrl-3 pb-3 pt-5">
                        <input
                            type="text"
                            value={approvalLineName}
                            onChange={(e) => setApprovalLineName(e.target.value)}
                            placeholder={t(
                                "settings.approval_line.add_dialog.name_placeholder",
                            )}
                            aria-label={t(
                                "settings.approval_line.add_dialog.name_placeholder",
                            )}
                            className="w-full bg-transparent text-wb-24 font-semibold text-wb-dark caret-[#0f1fea] outline-none placeholder:text-wb-ntrl-6 placeholder:opacity-60"
                        />
                    </div>

                    {/* Add Approver action — right-aligned default-button
                       chip (Figma 9196:11982). Disabled when the chain is
                       at MAX_APPROVERS so the user can't visually overflow
                       the table without a follow-up dialog. */}
                    <div className="flex justify-end py-3">
                        <button
                            type="button"
                            onClick={handleOpenPopover}
                            disabled={addApproverDisabled}
                            aria-haspopup="dialog"
                            aria-expanded={popoverAnchor !== null}
                            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md bg-white px-2 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Plus className="size-4" strokeWidth={2} aria-hidden />
                            {t("settings.approval_line.add_dialog.add_approver")}
                        </button>
                    </div>

                    {/* Table region — fixed-height scroll container so the
                       dialog's overall size stays constant whether the
                       chain is empty or full. The instruction strip
                       (sticky) and table header (sticky beneath it) stay
                       visible while body rows scroll. */}
                    <div className="custom-scrollbar-y h-[266px] overflow-y-auto">
                        {/* Instruction strip — neutral grey banner with a
                           drag-handle glyph and the help copy. Sticky so
                           it stays anchored even as approvers scroll past. */}
                        <div className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-wb-bg-sidebar px-2.5 py-[9px]">
                            <div className="flex items-center gap-1.5">
                                <GripVertical
                                    className="size-4 shrink-0 text-wb-ntrl-6"
                                    strokeWidth={1.8}
                                    aria-hidden
                                />
                                <span className="text-wb-13 font-medium text-wb-ntrl-6">
                                    {t(
                                        "settings.approval_line.add_dialog.drag_hint",
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* Approvers table — bare <table> + table-fixed +
                           <colgroup> so columns line up between the sticky
                           header and the scrolling body. Header sits at
                           top-[34px] so it nests directly under the
                           instruction strip without overlap. */}
                        <table className="w-full table-fixed border-collapse">
                            <colgroup>
                                <col style={{ width: "32px" }} />
                                <col style={{ width: "44px" }} />
                                <col />
                                <col />
                                <col />
                                <col style={{ width: "104px" }} />
                            </colgroup>

                            <thead className="sticky top-[34px] z-10">
                                <tr className="h-10 border-y border-wb-table-border bg-wb-bg-card">
                                    <th className="bg-wb-bg-card" aria-hidden />
                                    <th className="bg-wb-bg-card px-2 py-3 text-center text-wb-13 font-medium text-wb-dark">
                                        #
                                    </th>
                                    <th className="bg-wb-bg-card py-3 pr-2.5 text-left text-wb-13 font-medium text-wb-dark">
                                        {t(
                                            "settings.approval_line.add_dialog.col.name",
                                        )}
                                    </th>
                                    <th className="bg-wb-bg-card py-3 pr-2.5 text-left text-wb-13 font-medium text-wb-dark">
                                        {t(
                                            "settings.approval_line.add_dialog.col.position",
                                        )}
                                    </th>
                                    <th className="bg-wb-bg-card py-3 pr-2.5 text-left text-wb-13 font-medium text-wb-dark">
                                        {t(
                                            "settings.approval_line.add_dialog.col.department",
                                        )}
                                    </th>
                                    <th
                                        className="bg-wb-bg-card"
                                        aria-label={t(
                                            "settings.approval_line.add_dialog.col.actions",
                                        )}
                                    />
                                </tr>
                            </thead>

                            <tbody>
                                {approvers.length === 0 ? (
                                    // Empty state — render four ghost rows
                                    // so the table area keeps its height
                                    // and the dialog doesn't visually
                                    // collapse when every approver is
                                    // removed. Mirrors Figma 9196:11969.
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <tr
                                            key={`empty-${i}`}
                                            className="h-12 border-b border-wb-table-border last:border-b-0"
                                        >
                                            <td colSpan={6} />
                                        </tr>
                                    ))
                                ) : (
                                    approvers.map((row, i) => (
                                        <tr
                                            key={row.id}
                                            className="h-12 border-b border-wb-table-border"
                                        >
                                            {/* Drag handle — visible 6-dot
                                               grip glyph. Visual only on
                                               static UI; DnD wiring lands
                                               in a follow-up task. */}
                                            <td className="px-2 align-middle">
                                                <button
                                                    type="button"
                                                    aria-label={t(
                                                        "settings.approval_line.add_dialog.drag_aria",
                                                        { name: row.name },
                                                    )}
                                                    className="flex size-4 cursor-grab items-center justify-center text-wb-ntrl-6"
                                                >
                                                    <GripVertical
                                                        className="size-4"
                                                        strokeWidth={1.8}
                                                        aria-hidden
                                                    />
                                                </button>
                                            </td>
                                            <td className="px-2 py-2.5 text-center align-middle text-wb-13 font-medium text-wb-ink">
                                                {i + 1}
                                            </td>
                                            <td className="py-2.5 pr-2.5 align-middle">
                                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                                    {row.name}
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-2.5 align-middle">
                                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                                    {row.position}
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-2.5 align-middle">
                                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                                    {row.department}
                                                </span>
                                            </td>
                                            <td className="px-2.5 align-middle">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleRemove(row.id)
                                                    }
                                                    aria-label={t(
                                                        "settings.approval_line.add_dialog.remove_aria",
                                                        { name: row.name },
                                                    )}
                                                    className="inline-flex h-7 cursor-pointer items-center rounded-[4px] border border-wb-red-04 bg-white px-1.5 text-wb-12 font-medium tracking-wb-tight text-wb-red-07 shadow-wb-warning-btn hover:bg-wb-red-04/10"
                                                >
                                                    {t(
                                                        "settings.approval_line.add_dialog.remove",
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer — count badge + Approvers assigned label + info
                   icon on the left; Cancel + primary (Save / Update) on
                   the right. Border-t matches the header's border-b for
                   visual symmetry per Figma 9196:12144 / 9196:11708. */}
                <div className="flex shrink-0 items-center justify-between gap-4 border-t border-wb-border-sidebar px-5 py-4">
                    <div className="flex items-center gap-1">
                        <span className="rounded-md bg-brand-soft px-1.5 py-1 text-wb-13 font-medium leading-none text-brand-hover">
                            {t("settings.approval_line.add_dialog.count", {
                                current: String(approvers.length),
                                max: String(MAX_APPROVERS),
                            })}
                        </span>
                        <span className="text-wb-13 font-medium text-wb-ink">
                            {t(
                                "settings.approval_line.add_dialog.approvers_assigned",
                            )}
                        </span>
                        <Info
                            className="size-4 shrink-0 text-wb-dark"
                            strokeWidth={1.8}
                            aria-hidden
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("settings.approval_line.add_dialog.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover"
                        >
                            {t(primaryButtonKey)}
                        </button>
                    </div>
                </div>

                {/* Add Approver popover — Figma 9196:12153 / 9196:12218 /
                   9196:12296. Portal-rendered to document.body so the
                   dialog's overflow-hidden / focus trap can't clip it.
                   The popover owns its own ESC + outside-click dismiss
                   so it never accidentally tears down the parent dialog. */}
                {popoverAnchor && (
                    <AddApproverPopover
                        anchorRect={popoverAnchor}
                        available={available}
                        capacity={remainingCapacity}
                        onClose={() => setPopoverAnchor(null)}
                        onAdd={handlePopoverAdd}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
