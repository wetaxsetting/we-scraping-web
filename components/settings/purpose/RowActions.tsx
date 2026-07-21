"use client";

import DeleteIcon from "@/components/shared/icons/DeleteIcon";
import EditIcon from "@/components/shared/icons/EditIcon";
import { useTranslation } from "@/lib/i18n";

import ToggleSwitch from "../ToggleSwitch";

type RowActionsProps = {
    code: string;
    enabled: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
    onToggle?: (next: boolean) => void;
};

/**
 * Per-row action group: Edit (pencil) + Delete (trash, red ring) + Toggle.
 *
 * Mirrors the canonical Chart of Accounts icon-only pair (CLAUDE.md §3b.B
 * — `size-7` wrapper, `size-3.5` icon, paired via `gap-1.5`) and adds the
 * orange Purpose-panel toggle at the end. The toggle stays the right-most
 * affordance so the table's action column reads as one consistent block
 * across every Settings list.
 *
 * <h2>Delete button — always enabled</h2>
 *
 * The trash button is always interactive, including on parent rows that
 * have sub-purposes. The parent-vs-leaf distinction drives the
 * <i>confirmation dialog wording</i> at the panel layer (parents get a
 * "this will also remove all sub-purposes" warning), and the existing
 * server-side `WBE1199` envelope still surfaces an Error dialog when the
 * row turns out to be referenced by a transaction. The frontend never
 * pre-disables based on `usedInTransactions` — that flag drives
 * messaging, not gating (per the 2026-05-12 spec update aligning Purpose
 * with the Figma delete flow at node 9542:20102).
 */
export default function RowActions({
    code,
    enabled,
    onEdit,
    onDelete,
    onToggle,
}: RowActionsProps) {
    const { t } = useTranslation();
    return (
        <div className="flex items-center justify-end gap-1.5">
            <button
                type="button"
                onClick={onEdit}
                aria-label={t("settings.purpose.actions.edit_aria", { code })}
                className="flex size-7 cursor-pointer items-center justify-center rounded-md bg-white text-wb-ntrl-8 shadow-wb-btn hover:bg-black/[0.03]"
            >
                <EditIcon className="size-3.5" />
            </button>
            <button
                type="button"
                onClick={onDelete}
                aria-label={t("settings.purpose.actions.delete_aria", { code })}
                className="flex size-7 cursor-pointer items-center justify-center rounded-md bg-white text-wb-red-07 shadow-[0_0_0_1px_var(--color-wb-red-04)] hover:bg-wb-red-04/10"
            >
                <DeleteIcon className="size-3.5" />
            </button>
            <ToggleSwitch
                checked={enabled}
                onChange={onToggle}
                ariaLabel={t(
                    enabled
                        ? "settings.purpose.toggle_on"
                        : "settings.purpose.toggle_off",
                )}
            />
        </div>
    );
}
