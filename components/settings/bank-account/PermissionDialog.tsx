"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { ApiCallError } from "@/lib/api/banking";
import {
    fetchBankAccountPermissions,
    updateBankAccountPermissions,
} from "@/lib/api/bankAccount";
import type { ApiBankAccountPermissionMember } from "@/lib/types/api";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type PermissionKind = "view" | "withdrawal";

type PermissionDialogProps = {
    /** Which permission this dialog represents — drives the title and
     *  the wire kind (`VIEW` / `WITHDRAWAL`). */
    kind: PermissionKind;
    /** Bank-account composite key for the wire path. */
    bankCd: string;
    acctNo: string;
    onClose: () => void;
    /** Fired after a successful save so the parent panel can refetch
     *  the list and surface the new "X + N more" labels. */
    onSaved?: () => void;
};

/** Map the frontend semantic kind to the backend wire kind. */
const KIND_TO_WIRE: Record<PermissionKind, "VIEW" | "WITHDRAWAL"> = {
    view:       "VIEW",
    withdrawal: "WITHDRAWAL",
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
    bankCd,
    acctNo,
    onClose,
    onSaved,
}: PermissionDialogProps) {
    const { t } = useTranslation();
    const sysDialog = useDialog();
    const wireKind = KIND_TO_WIRE[kind];

    /** Members fetched from the API. `null` while loading. */
    const [members, setMembers] = useState<ApiBankAccountPermissionMember[] | null>(null);
    /** Current selection — derived from `is_selected` on initial fetch
     *  then mutated as the user clicks. Lives separate from `members`
     *  so the roster stays stable while the user edits. */
    const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
    const [loadError, setLoadError] = useState<{ code: string; message: string } | null>(null);
    const [saving, setSaving] = useState(false);

    const titleKey =
        kind === "view"
            ? "settings.bank_account.permission.view_title"
            : "settings.bank_account.permission.withdrawal_title";

    /** Load the roster on mount. Conditional-mount + the parent's
     *  `key=` make this fire exactly once per dialog open. */
    useEffect(() => {
        let cancelled = false;
        fetchBankAccountPermissions(bankCd, acctNo, wireKind)
            .then((res) => {
                if (cancelled) return;
                setMembers(res.members);
                const initial = new Set(
                    res.members.filter((m) => m.is_selected).map((m) => m.user_id),
                );
                setSelectedIds(initial);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const code = err instanceof ApiCallError ? err.code : "WBE9999";
                const message = err instanceof ApiCallError ? err.message : String(err);
                setLoadError({ code, message });
            });
        return () => {
            cancelled = true;
        };
    }, [bankCd, acctNo, wireKind]);

    function toggleUser(userId: string) {
        const member = members?.find((m) => m.user_id === userId);
        if (!member || member.is_locked) return;
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    }

    /** Header checkbox state derives from the user-toggleable subset.
     *  Locked rows (admins, self) are excluded because they cannot be
     *  flipped. */
    const togglableUsers = useMemo(
        () => (members ?? []).filter((m) => !m.is_locked),
        [members],
    );
    const togglableSelectedCount = togglableUsers.filter((m) =>
        selectedIds.has(m.user_id),
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
            for (const m of togglableUsers) {
                if (checkAll) result.add(m.user_id);
                else result.delete(m.user_id);
            }
            return result;
        });
    }

    const handleSave = useCallback(async () => {
        if (saving || !members) return;
        setSaving(true);
        try {
            await updateBankAccountPermissions(bankCd, acctNo, {
                kind:     wireKind,
                user_ids: Array.from(selectedIds),
            });
            sysDialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("settings.bank_account.permission.save_success"),
                onConfirm: () => {
                    onSaved?.();
                    onClose();
                },
                onClose: () => {
                    onSaved?.();
                    onClose();
                },
            });
        } catch (err: unknown) {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : String(err);
            sysDialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        } finally {
            setSaving(false);
        }
    }, [saving, members, bankCd, acctNo, wireKind, selectedIds, sysDialog, t, onSaved, onClose]);

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
                            {members === null && !loadError && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-3 py-4 text-center text-wb-13 font-medium text-wb-ntrl-6"
                                    >
                                        {t("common.loading")}
                                    </td>
                                </tr>
                            )}
                            {loadError && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-3 py-4 text-center text-wb-13 font-medium text-wb-red-07"
                                    >
                                        {loadError.message}
                                    </td>
                                </tr>
                            )}
                            {members?.map((member) => {
                                const isSelected = selectedIds.has(member.user_id);
                                const isDisabled = member.is_locked;
                                // Row tint = user-actively-selected (NOT
                                // pre-locked admin). Per Figma, the
                                // disabled-checked admin row stays white
                                // even though its checkbox shows checked.
                                const showRowTint = isSelected && !isDisabled;
                                return (
                                    <PermissionRow
                                        key={member.user_id}
                                        member={member}
                                        selected={isSelected}
                                        disabled={isDisabled}
                                        showRowTint={showRowTint}
                                        onToggle={() => toggleUser(member.user_id)}
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
                            disabled={saving}
                            className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t("common.close")}
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={saving || members === null || !!loadError}
                            className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
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
    member: ApiBankAccountPermissionMember;
    selected: boolean;
    disabled: boolean;
    showRowTint: boolean;
    onToggle: () => void;
    t: (key: string) => string;
};

function PermissionRow({
    member,
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
                        aria-label={member.user_nm}
                    />
                </div>
            </td>
            <BodyCell>{member.user_nm}</BodyCell>
            <BodyCell>{member.user_id}</BodyCell>
            <BodyCell>
                {t(`settings.bank_account.permission.type.${
                    member.user_type === "ADMIN" ? "admin" : "user"
                }`)}
            </BodyCell>
            <BodyCell>{member.phone_no ?? ""}</BodyCell>
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
