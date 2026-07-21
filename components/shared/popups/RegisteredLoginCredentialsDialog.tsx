"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import EditIcon from "@/components/shared/icons/EditIcon";
import { useTranslation } from "@/lib/i18n";

/**
 * One (loginId, password) entry plus its primary linked bank account.
 * Hosts pre-build entries from their own row data — backend wiring will
 * later flow through the same shape via
 * `GET /api/v1/login-credentials/{rowId}/accounts`.
 */
export type RegisteredCredentialEntry = {
    loginId: string;
    password: string;
    /** Primary linked bank account label (e.g. `"BIDV 123021212211"`).
     *  Empty string renders an em-dash placeholder. */
    bankAccount: string;
    /** Count of additional bank accounts sharing the same login ID.
     *  Drives the `+N` chip; `0` hides it. */
    extraAccountCount: number;
};

export type RegisteredLoginCredentialsDialogProps = {
    /** Institution display name used by aria labels + remove/edit
     *  context strings (rendered inside the logo slot is the host's
     *  call). */
    institutionName: string;
    /** Logo / brand mark rendered above the table. Hosts pass any
     *  ReactNode (typically `<BankBrandLogo>` or a real `<img>`). */
    logo?: ReactNode;
    entries: RegisteredCredentialEntry[];
    onClose: () => void;
    onDisconnect?: () => void;
    onAddLogin?: () => void;
    onEdit?: (entry: RegisteredCredentialEntry) => void;
    onRemove?: (entry: RegisteredCredentialEntry) => void;
    /**
     * Fired when the user clicks the eye-slash icon on a HIDDEN row
     * (going hidden→reveal). When provided, the dialog defers the
     * reveal to the host — typical use is opening a password
     * confirmation popup. Hide (eye → eye-slash) is always a free
     * toggle inside the dialog regardless of this prop.
     *
     * When omitted, eye-slash clicks toggle the row directly.
     */
    onPasswordIconClick?: (entry: RegisteredCredentialEntry) => void;
};

/**
 * Registered Login Credentials feature dialog — Figma 3881:22605.
 *
 * Lists every (loginId, password) pair for a single institution plus
 * the primary linked bank account; per-row Remove (red minus) + Edit
 * (pencil) actions; footer Close / Disconnect / Add Login ID/PW.
 *
 * Modal frame mirrors the shared Audit Logs dialog — `max-w-[860px]`,
 * `max-h-[calc(100vh-120px)]`, `rounded-[16px]`, sticky
 * thead inside a scroll body. The chrome is inherited; only `entries`,
 * `institutionName`, and the `logo` slot vary per host.
 */
const PASSWORD_MASK = "****************";

export default function RegisteredLoginCredentialsDialog({
    institutionName,
    logo,
    entries,
    onClose,
    onDisconnect,
    onAddLogin,
    onEdit,
    onRemove,
    onPasswordIconClick,
}: RegisteredLoginCredentialsDialogProps) {
    const { t } = useTranslation();
    const [revealed, setRevealed] = useState<Set<number>>(() => new Set());

    function handleEyeClick(index: number) {
        if (revealed.has(index)) {
            // Going revealed → hidden is a free toggle, no callback.
            setRevealed((prev) => {
                const next = new Set(prev);
                next.delete(index);
                return next;
            });
            return;
        }
        // Going hidden → revealed: defer to host when a callback is
        // provided (typical static-UI flow opens a confirmation popup),
        // otherwise toggle directly.
        if (onPasswordIconClick) {
            onPasswordIconClick(entries[index]);
        } else {
            setRevealed((prev) => new Set(prev).add(index));
        }
    }

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                // Level 2 of the Settings → Registered → child chain. Sits
                // at z-[60] above the Settings popup (z-50) and uses a
                // transparent overlay so the Settings dim isn't doubled.
                // Standard top-right X close icon is provided by the
                // primitive — closing it dismisses only this dialog and
                // routes through the shared modalStack so Settings stays
                // open.
                stackLevel={2}
                // Figma 3881:22605 has title only, no description — opt
                // out of Radix's a11y description requirement.
                aria-describedby={undefined}
                className="max-h-[calc(100vh-120px)] max-w-[860px] rounded-2xl"
            >
                {/* Header — single title row, no description per Figma. */}
                <div className="flex shrink-0 flex-col items-start justify-center gap-1.5 px-6 pb-4 pt-6">
                    <DialogTitle asChild>
                        <h2 className="whitespace-nowrap text-wb-16 font-semibold text-wb-dark">
                            {t("settings.login_credentials.registered.title")}
                        </h2>
                    </DialogTitle>
                </div>

                {/* Body — logo above the table; both share the panel's
                   horizontal padding. The scroll container handles long
                   credential lists; short lists stay anchored to the top
                   so empty space sits at the bottom rather than expanding
                   the rows. */}
                <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto px-6">
                    {logo && <div className="pb-4">{logo}</div>}

                    <table className="w-full table-fixed border-collapse">
                        <colgroup>
                            <col className="w-[160px]" />
                            <col className="w-[240px]" />
                            <col />
                        </colgroup>

                        <thead>
                            <tr className="h-[var(--h-wb-table-head)]">
                                <HeaderCell>
                                    {t("settings.login_credentials.registered.col.login_id")}
                                </HeaderCell>
                                <HeaderCell>
                                    {t("settings.login_credentials.registered.col.password")}
                                </HeaderCell>
                                <HeaderCell>
                                    {t("settings.login_credentials.registered.col.bank_account")}
                                </HeaderCell>
                            </tr>
                        </thead>

                        <tbody>
                            {entries.map((entry, index) => (
                                <RegisteredCredentialRow
                                    key={`${entry.loginId}-${index}`}
                                    entry={entry}
                                    isRevealed={revealed.has(index)}
                                    onToggleReveal={() => handleEyeClick(index)}
                                    onEdit={onEdit}
                                    onRemove={onRemove}
                                    t={t}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer — Figma 3881:22721. px-6 py-4 right-aligned, three
                   actions: blue-outlined Close, red-outlined Disconnect,
                   neutral-outlined Add Login ID/PW. The `institutionName`
                   surfaces in the aria-labels so screen readers announce
                   which institution the action applies to. */}
                <div className="flex shrink-0 items-center justify-end gap-2 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-brand bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-brand hover:bg-black/[0.03]"
                    >
                        {t("common.close")}
                    </button>
                    <button
                        type="button"
                        onClick={onDisconnect}
                        aria-label={
                            onDisconnect
                                ? `${t("settings.login_credentials.registered.disconnect")} ${institutionName}`
                                : undefined
                        }
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-wb-red-04 bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-red-07 shadow-wb-warning-btn hover:bg-black/[0.03]"
                    >
                        {t("settings.login_credentials.registered.disconnect")}
                    </button>
                    <button
                        type="button"
                        onClick={onAddLogin}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-8 shadow-wb-btn hover:bg-black/[0.03]"
                    >
                        {t("settings.login_credentials.registered.add_login")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function HeaderCell({
    children,
    "aria-hidden": ariaHidden,
}: {
    children?: React.ReactNode;
    "aria-hidden"?: boolean;
}) {
    return (
        <th
            aria-hidden={ariaHidden}
            className="sticky top-0 z-10 whitespace-nowrap border-b border-wb-table-border bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold tracking-wb-tight text-wb-dark"
        >
            {children}
        </th>
    );
}

type RegisteredCredentialRowProps = {
    entry: RegisteredCredentialEntry;
    isRevealed: boolean;
    onToggleReveal: () => void;
    onEdit?: (entry: RegisteredCredentialEntry) => void;
    onRemove?: (entry: RegisteredCredentialEntry) => void;
    t: (key: string, vars?: Record<string, string>) => string;
};

function RegisteredCredentialRow({
    entry,
    isRevealed,
    onToggleReveal,
    onEdit,
    onRemove,
    t,
}: RegisteredCredentialRowProps) {
    return (
        <tr className="border-b border-wb-table-border last:border-b-0">
            {/* Login ID — plain text. */}
            <td className="px-3 py-3 align-middle">
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {entry.loginId}
                </span>
            </td>

            {/* Password — mask + eye toggle. The mask string is fixed
               so the rendered width stays comparable across every row
               whether or not the password is revealed. */}
            <td className="px-3 py-3 align-middle">
                <span className="flex items-center gap-2.5">
                    <span
                        className="font-mono text-wb-13 font-medium tracking-tight text-wb-ink"
                        aria-label={
                            isRevealed
                                ? t("settings.login_credentials.popover.password_revealed")
                                : t("settings.login_credentials.popover.password_hidden")
                        }
                    >
                        {isRevealed ? entry.password : PASSWORD_MASK}
                    </span>
                    <button
                        type="button"
                        onClick={onToggleReveal}
                        aria-label={
                            isRevealed
                                ? t("settings.login_credentials.popover.hide_password")
                                : t("settings.login_credentials.popover.show_password")
                        }
                        aria-pressed={isRevealed}
                        className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-brand"
                    >
                        {/* Icon mirrors current state per Figma 3881:22646:
                           masked → eye-with-slash (EyeOff), visible → eye (Eye). */}
                        {isRevealed ? (
                            <Eye className="size-4" strokeWidth={2} />
                        ) : (
                            <EyeOff className="size-4" strokeWidth={2} />
                        )}
                    </button>
                </span>
            </td>

            {/* Bank Account — primary label + optional `+N` chip on the
               LEFT, Remove + Edit action icons pinned to the RIGHT edge
               of the cell. Matches the legacy `comm_0218` layout and the
               live dev.wecms.vn rendering (screenshot 2 of the 2026-05-25
               review): the actions sit at the row's right edge, not
               packed next to the bank-account text with trailing empty
               space on the right. `justify-between` keeps the two groups
               apart at any cell width; `gap-2.5` inside each group
               preserves the inter-element rhythm. */}
            <td className="px-3 py-3 align-middle">
                <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                        <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                            {entry.bankAccount || "—"}
                        </span>
                        {entry.extraAccountCount > 0 && (
                            <span className="inline-flex items-center justify-center rounded-md border-[1.5px] border-wb-ntrl-4 bg-wb-ntrl-3 px-[5px] text-wb-12 font-medium uppercase text-wb-ntrl-8">
                                +{entry.extraAccountCount}
                            </span>
                        )}
                    </span>
                    {/* Remove (red minus) + Edit (pencil) icon buttons.
                       Per CLAUDE.md §8a the Remove glyph comes from the
                       committed `ico-minus.svg` asset (red-filled circle
                       + white minus), not a lucide substitution. */}
                    <span className="flex shrink-0 items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => onRemove?.(entry)}
                            aria-label={t("settings.login_credentials.registered.remove", {
                                loginId: entry.loginId,
                            })}
                            className="flex size-6 cursor-pointer items-center justify-center rounded border border-wb-red-04 bg-white shadow-wb-warning-btn hover:bg-black/[0.03]"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/assets/common/ico-minus.svg"
                                alt=""
                                aria-hidden
                                className="size-4"
                            />
                        </button>
                        <button
                            type="button"
                            onClick={() => onEdit?.(entry)}
                            aria-label={t("settings.login_credentials.registered.edit", {
                                loginId: entry.loginId,
                            })}
                            className="flex size-6 cursor-pointer items-center justify-center rounded bg-white text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            <EditIcon className="size-4" />
                        </button>
                    </span>
                </div>
            </td>
        </tr>
    );
}
