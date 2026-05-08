"use client";

import { useId } from "react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

export type PasswordConfirmationDialogProps = {
    /** Modal title — already translated. */
    title: string;
    /** Field label — already translated. The required asterisk is appended
     *  automatically; pass plain label text. */
    label: string;
    /** Optional helper line beneath the input — already translated. */
    helperText?: string;
    /** Controlled value of the password field. */
    value: string;
    onChange: (next: string) => void;
    onClose: () => void;
    /** Save handler. When omitted (or `saveDisabled`), the button renders
     *  in its disabled visual state and clicks no-op. */
    onSave?: () => void;
    /** Force the Save button into its disabled visual state. Defaults to
     *  `true` for static UI — Save lights up only when both `onSave` is
     *  provided AND `saveDisabled` is explicitly `false`. */
    saveDisabled?: boolean;
};

/**
 * Password confirmation feature dialog — Figma 9198:7071.
 *
 * Re-usable sensitive-action confirmation popup: a small modal with one
 * password field, optional helper text, and a Close + Save footer. The
 * Save button stays disabled by default (matches the static UI contract);
 * callers wire `onSave` + `saveDisabled={false}` once validation lands.
 *
 * Frame: `max-w-[440px]`, `rounded-[16px]`, `px-4 py-6 gap-6`.
 * The inner sections are laid out by hand (per CLAUDE.md §3a's
 * Figma-driven deviation precedent for small modals).
 */
export default function PasswordConfirmationDialog({
    title,
    label,
    helperText,
    value,
    onChange,
    onClose,
    onSave,
    saveDisabled = true,
}: PasswordConfirmationDialogProps) {
    const { t } = useTranslation();
    const inputId = useId();
    const isSaveDisabled = saveDisabled || !onSave;

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                // Level 3 sibling of Login ID/PW + Select Bank in the
                // Settings → Registered → child chain. Sits at z-[70]
                // above Registered (z-[60]) with a transparent overlay
                // so the Settings dim isn't compounded. Standard
                // top-right X close icon comes from the primitive —
                // dismisses only this dialog via the shared modalStack.
                stackLevel={3}
                // Figma 9198:7071 has title + helperText only, no
                // DialogDescription — opt out of Radix's a11y description
                // requirement. The helperText is rendered as a peer
                // <p> below the input, not as the dialog's accessible
                // description.
                aria-describedby={undefined}
                className="max-w-[440px] rounded-2xl"
            >
                <div className="flex flex-col gap-6 px-4 py-6">
                    {/* Title */}
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
                            {title}
                        </h2>
                    </DialogTitle>

                    {/* Field block — label + input + optional helper text. */}
                    <div className="flex flex-col gap-2">
                        <label
                            htmlFor={inputId}
                            className="flex items-start gap-0.5 text-wb-14 font-medium leading-4 text-wb-ntrl-8"
                        >
                            <span>{label}</span>
                            <span aria-hidden className="text-wb-red-07">
                                *
                            </span>
                            <span className="sr-only">
                                {t("settings.login_credentials.confirmation.required")}
                            </span>
                        </label>

                        {/* Input row — single 1 px gray border, no focus
                           color swap. Plain password field per the
                           updated Figma: no leading search icon, no
                           trailing eye toggle, no fake dot-mask
                           placeholder. The input renders empty on
                           mount; the browser shows real masked
                           characters only after the user types
                           (`type="password"` default behaviour). */}
                        <div className="flex items-center rounded-md border border-wb-ntrl-4 bg-white p-2">
                            <input
                                id={inputId}
                                type="password"
                                autoFocus
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                // Suppress browser password-manager UI (Edge's
                                // shield icon, Chrome/Safari's autofill bar,
                                // 1Password / LastPass / Dashlane overlays) —
                                // those overlays read as a duplicated inner
                                // border per the Figma frame's clean field.
                                autoComplete="new-password"
                                data-1p-ignore="true"
                                data-lpignore="true"
                                data-form-type="other"
                                spellCheck={false}
                                className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-wb-14 font-medium leading-4 text-wb-ntrl-8 shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                            />
                        </div>

                        {helperText && (
                            <p className="text-wb-13 font-medium leading-normal text-wb-ntrl-6">
                                {helperText}
                            </p>
                        )}
                    </div>

                    {/* Footer — Close + Save (disabled by default), right-aligned. */}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("common.close")}
                        </button>
                        <button
                            type="button"
                            disabled={isSaveDisabled}
                            aria-disabled={isSaveDisabled}
                            onClick={isSaveDisabled ? undefined : onSave}
                            className={
                                isSaveDisabled
                                    ? "flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-wb-ntrl-4 px-3 text-wb-14-tight font-medium tracking-wb-tight text-white"
                                    : "flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover"
                            }
                        >
                            {t("common.save")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
