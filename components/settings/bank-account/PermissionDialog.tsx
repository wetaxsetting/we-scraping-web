"use client";

import { useMemo, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import {
    mockPermissionUsers,
    type PermissionInitial,
    type PermissionUser,
} from "./permissionMockData";

export type PermissionKind = "view" | "withdrawal";

type PermissionDialogProps = {
    /** Which permission this dialog represents — drives the title only;
     *  the table and footer are identical across both kinds. */
    kind: PermissionKind;
    /** Initial selection / disabled state per kind. The two popups open
     *  with different presets per the Figma mock. */
    initial: PermissionInitial;
    onClose: () => void;
};

/**
 * View Permission / Withdrawal Permission dialog — Figma 166:24840 /
 * 166:25059.
 *
 * Both popups share the same shape (table of users with a "select all"
 * header checkbox + per-row checkbox + selected-row tint + disabled-row
 * grey). Only the title differs, so this component is parameterised by
 * `kind`.
 *
 * The Figma frame specifies a custom modal shape (rounded-[16px],
 * 16 px title, 24 px outer padding, no footer separator, plain-text
 * Close button) that deliberately diverges from the standard
 * `<DialogHeader>/<DialogBody>/<DialogFooter>` rhythm codified on
 * `<DialogContent>`. The shared shadcn `<Dialog>` primitive still
 * provides the chrome (Radix portal + overlay + ESC + focus trap);
 * only the inner shape is overridden — the same exception EditBank-
 * AccountDialog applies for its custom Figma shape.
 *
 * Static UI: Save / Close / overlay / ESC all dismiss. The selection
 * draft is local to this open instance — the parent remounts via
 * `key={kind}` so opening View after Withdrawal seeds fresh.
 */
export default function PermissionDialog({
    kind,
    initial,
    onClose,
}: PermissionDialogProps) {
    const { t } = useTranslation();

    const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
        () => new Set(initial.selectedIds),
    );

    const titleKey =
        kind === "view"
            ? "settings.bank_account.permission.view_title"
            : "settings.bank_account.permission.withdrawal_title";

    function toggleUser(userId: string) {
        if (initial.disabledIds.has(userId)) return;
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    }

    /** Header checkbox state derives from the user-toggleable subset.
     *  Disabled rows are excluded because they cannot be flipped. */
    const togglableUsers = useMemo(
        () => mockPermissionUsers.filter((u) => !initial.disabledIds.has(u.id)),
        [initial.disabledIds],
    );
    const togglableSelectedCount = togglableUsers.filter((u) =>
        selectedIds.has(u.id),
    ).length;
    const headerChecked: boolean | "indeterminate" =
        togglableSelectedCount === 0
            ? false
            : togglableSelectedCount === togglableUsers.length
                ? true
                : "indeterminate";

    function toggleAll(next: boolean | "indeterminate") {
        const checkAll = next === true;
        setSelectedIds((prev) => {
            const result = new Set(prev);
            for (const u of togglableUsers) {
                if (checkAll) result.add(u.id);
                else result.delete(u.id);
            }
            return result;
        });
    }

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                // Standard Settings-popup feature-dialog frame:
                //   - height: auto (no `h-*` constraint) so the modal
                //     wraps content when rows are few — no empty white
                //     space below a short table
                //   - max-h-[calc(100vh-120px)] caps the modal so a
                //     long log list doesn't push the dialog past the
                //     viewport; the body's `min-h-0 + overflow-y-auto`
                //     branch takes over once content exceeds the cap
                //   - rounded-[16px] (not the default rounded-lg = 8 px)
                //   - drop-shadow stack matches "0 1 0.5 / 0 0 1 / 0 6 10"
                //   - top-right X close icon rendered by the primitive;
                //     dismisses only this dialog, leaving Settings open
                //   - stackLevel={2} so it sits above the L1 Settings
                //     shell with the lighter overlay dim and routes
                //     ESC through the shared modalStack
                //
                // Inner stack uses the canonical scroll-on-overflow shape:
                //   [Title]   shrink-0
                //   [Body]    flex-1 + min-h-0 + overflow-y-auto with a
                //             sticky thead so column labels stay pinned
                //             while rows scroll
                //   [Footer]  shrink-0
                stackLevel={2}
                // Figma frame has title + table only, no description — opt
                // out of Radix's a11y description requirement.
                aria-describedby={undefined}
                className="max-h-[calc(100vh-120px)] max-w-[720px] rounded-2xl shadow-[0px_1px_0.5px_0px_rgba(0,0,0,0.1),0px_0px_1px_0px_rgba(0,0,0,0.1),0px_6px_10px_0px_rgba(0,0,0,0.1)]"
            >
                {/* Title — shrink-0. pt-6 per Figma 166:24842; pb-6
                   reserves the 24 px gap before the table. */}
                <div className="flex shrink-0 flex-col items-start justify-center px-6 pb-6 pt-6">
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold text-wb-dark">
                            {t(titleKey)}
                        </h2>
                    </DialogTitle>
                </div>

                {/* Body — flex-1, vertical scroll. Sticky <thead> keeps
                   the column labels pinned at the top while rows
                   scroll. `custom-scrollbar-y` per CLAUDE.md §6c. */}
                <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto px-6">
                    <table className="w-full table-fixed border-collapse">
                        <colgroup>
                            <col className="w-[37px]" />
                            <col className="w-[79px]" />
                            <col className="w-[277px]" />
                            <col className="w-[99px]" />
                            <col />
                        </colgroup>

                        <thead>
                            <tr className="h-[var(--h-wb-table-head)]">
                                <th className="sticky top-0 z-10 border-b border-wb-table-border bg-wb-bg-sidebar px-0 py-3 align-middle">
                                    <div className="flex items-center justify-center">
                                        <Checkbox
                                            checked={headerChecked}
                                            onCheckedChange={toggleAll}
                                            aria-label={t(
                                                "settings.bank_account.permission.select_all",
                                            )}
                                        />
                                    </div>
                                </th>
                                <HeaderCell>
                                    {t("settings.bank_account.permission.col.user")}
                                </HeaderCell>
                                <HeaderCell>
                                    {t("settings.bank_account.permission.col.user_id")}
                                </HeaderCell>
                                <HeaderCell>
                                    {t("settings.bank_account.permission.col.type")}
                                </HeaderCell>
                                <HeaderCell>
                                    {t("settings.bank_account.permission.col.phone")}
                                </HeaderCell>
                            </tr>
                        </thead>

                        <tbody>
                            {mockPermissionUsers.map((user) => {
                                const isSelected = selectedIds.has(user.id);
                                const isDisabled = initial.disabledIds.has(user.id);
                                // Row tint = user-actively-selected
                                // (NOT pre-locked admin). Per Figma,
                                // the disabled-checked row stays on
                                // the white background even when its
                                // checkbox shows checked.
                                const showRowTint = isSelected && !isDisabled;
                                return (
                                    <PermissionRow
                                        key={user.id}
                                        user={user}
                                        selected={isSelected}
                                        disabled={isDisabled}
                                        showRowTint={showRowTint}
                                        onToggle={() => toggleUser(user.id)}
                                        t={t}
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer — shrink-0. Figma 166:25028: px-6 py-4,
                   right-aligned, NO top border, gap-2 between the two
                   buttons. Close uses the standard outlined-secondary
                   pattern (`bg-white shadow-wb-btn`) so it carries a
                   visible border and matches the rest of the
                   Settings-popup chrome (Edit Bank Account's Back
                   button uses the same style). Save is the standard
                   primary brand pill. */}
                <div className="flex shrink-0 items-center justify-end px-6 py-4">
                    <div className="flex items-start gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("common.close")}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover"
                        >
                            {t("common.save")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
    // Canonical Settings-popup table header — same token set used by
    // <BankAccountTable> / <TransactionHistoryTable> / Operation Status:
    //   - bg-wb-bg-sidebar (NOT inline #fbfbfb)
    //   - border-b border-wb-table-border (NOT border-y border-[#e1e1e1])
    //   - px-3 py-3 (symmetric — both left and right gutter)
    //   - text-wb-13 font-semibold tracking-wb-tight text-wb-dark
    //
    // Sticky thead pattern: each `<th>` carries `sticky top-0 z-10` plus
    // its own bg + borders so it occludes scrolling tbody rows. Putting
    // bg/borders on the parent `<tr>` instead gets dropped during scroll
    // because `border-collapse` collapses the row's borders into the
    // cell edges.
    return (
        <th className="sticky top-0 z-10 whitespace-nowrap border-b border-wb-table-border bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark">
            {children}
        </th>
    );
}

type PermissionRowProps = {
    user: PermissionUser;
    selected: boolean;
    disabled: boolean;
    showRowTint: boolean;
    onToggle: () => void;
    t: (key: string) => string;
};

function PermissionRow({
    user,
    selected,
    disabled,
    showRowTint,
    onToggle,
    t,
}: PermissionRowProps) {
    return (
        <tr
            className={cn(
                "border-b border-wb-table-border last:border-b-0",
                showRowTint && "bg-brand-soft",
            )}
        >
            {/* Checkbox column — centered, no horizontal padding so the
               body cell aligns with the matching `<th>` (also `px-0`). */}
            <td className="px-0 py-3 align-middle">
                <div className="flex items-center justify-center">
                    <Checkbox
                        checked={selected}
                        disabled={disabled}
                        onCheckedChange={onToggle}
                        aria-label={user.name}
                    />
                </div>
            </td>
            <BodyCell>{user.name}</BodyCell>
            <BodyCell>{user.userId}</BodyCell>
            <BodyCell>
                {t(`settings.bank_account.permission.type.${user.type}`)}
            </BodyCell>
            <BodyCell>{user.phone}</BodyCell>
        </tr>
    );
}

function BodyCell({ children }: { children: React.ReactNode }) {
    // Canonical Settings-popup table body cell — `px-3 py-3` (symmetric,
    // matches the <th> padding so columns align), `text-wb-13` body
    // size, and `text-wb-ink` token (matches <BankAccountTable>).
    return (
        <td className="px-3 py-3 align-middle">
            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                {children}
            </span>
        </td>
    );
}
