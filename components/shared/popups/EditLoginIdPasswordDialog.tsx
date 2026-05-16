"use client";

import { useId, useState, type ReactNode } from "react";
import { Lock, User } from "lucide-react";

import {
    Dialog,
    DialogContent,
    type DialogStackLevel,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

export type EditLoginIdPasswordValues = {
    newPassword: string;
    confirmPassword: string;
};

export type EditLoginIdPasswordDialogProps = {
    /** The login ID being edited — displayed read-only with a gray
     *  background per Figma 2781:23399. The form only edits the
     *  password fields below. */
    idValue: string;
    onCancel: () => void;
    /** Submit handler. Receives the new password + confirm-password
     *  values when fired. When omitted (or `saveDisabled` is true)
     *  the Save button still renders in its enabled visual state per
     *  Figma but clicks no-op. */
    onSave?: (values: EditLoginIdPasswordValues) => void;
    /** Force Save into its disabled visual state. Defaults to `false`
     *  per Figma — Save renders as the enabled brand button. */
    saveDisabled?: boolean;
    /** Optional initial password values (e.g. for a draft restore).
     *  The static UI doesn't read these back via callbacks. */
    initialValues?: Partial<EditLoginIdPasswordValues>;
    /** Position in the modal stack. Defaults to {@code 3} — the
     *  Settings → Registered → Edit chain. Pass {@code 2} when the
     *  dialog opens directly from the panel kebab menu (no parent
     *  Registered dialog mounted), so the overlay dim doesn't double
     *  up. */
    stackLevel?: DialogStackLevel;
};

/**
 * Edit Login ID/PW feature dialog — Figma 2781:23399.
 *
 * Reusable credential-edit popup: small modal with a read-only ID
 * field (prefilled from the row the user clicked) plus two editable
 * password fields (New Password + Confirm New Password). Footer is a
 * text-link Cancel + brand Save. Triggered today by the pencil icon
 * inside the Registered Login Credentials table, but generic enough
 * to be reused by any future flow that prompts the user to update
 * the password for an existing credential without changing its ID.
 *
 * Modal frame: `max-w-[440px]`, `rounded-[16px]`,
 * `p-6 gap-8`. Inner sections are laid out by hand (per CLAUDE.md
 * §3a's Figma-driven deviation precedent for small modals).
 *
 * Static UI: password fields are uncontrolled (managed internally via
 * `useState`). Save submits the current values to `onSave` if
 * provided + enabled; Cancel is a simple dismiss callback.
 */
export default function EditLoginIdPasswordDialog({
    idValue,
    onCancel,
    onSave,
    saveDisabled = false,
    initialValues,
    stackLevel = 3,
}: EditLoginIdPasswordDialogProps) {
    const { t } = useTranslation();
    const idInputId = useId();
    const newPwInputId = useId();
    const confirmInputId = useId();

    const [newPassword, setNewPassword] = useState(
        initialValues?.newPassword ?? "",
    );
    const [confirmPassword, setConfirmPassword] = useState(
        initialValues?.confirmPassword ?? "",
    );

    // Save defaults to enabled per Figma 2781:23421 (rendered in the
    // brand-blue active style). Parent can force the disabled visual
    // state via `saveDisabled={true}` while a real submission is in
    // flight, otherwise clicks fire `onSave` with the current values.
    //
    // Confirm-password mismatch also blocks save — surfaces inline
    // once the user has typed in Confirm Password.
    const passwordsMismatch =
        confirmPassword.length > 0 && newPassword !== confirmPassword;
    const isSaveDisabled = saveDisabled || !onSave || passwordsMismatch;

    function handleSave() {
        if (isSaveDisabled || !onSave) return;
        onSave({ newPassword, confirmPassword });
    }

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                // Don't dismiss while the parent's scrape is in flight —
                // the user might click ESC / outside and lose the
                // verification context. saveDisabled is true during the
                // scrape; the dialog stays mounted until applyScrapeResult
                // transitions it (Select Bank Accounts) or the caller
                // unmounts it after success / error.
                if (!next && !saveDisabled) onCancel();
            }}
        >
            <DialogContent
                // Default Level 3 (Settings → Registered → Edit). Caller
                // can pass stackLevel={2} when opening directly from the
                // panel kebab menu (no parent Registered mounted), so
                // the overlay dim doesn't compound. The shared modalStack
                // handles the z-index / overlay tier per the chosen level.
                stackLevel={stackLevel}
                // Figma 2781:23399 has title only, no description — opt
                // out of Radix's a11y description requirement.
                aria-describedby={undefined}
                className="max-w-[440px] overflow-hidden rounded-2xl"
            >
                <div className="flex flex-col gap-8 p-6">
                    {/* Header — title only, gap-1.5 reserved for any
                       future subtitle. */}
                    <div className="flex flex-col items-start gap-1.5">
                        <DialogTitle asChild>
                            <h2 className="text-wb-16 font-semibold text-wb-dark">
                                {t(
                                    "settings.login_credentials.edit_form.title",
                                )}
                            </h2>
                        </DialogTitle>
                    </div>

                    {/* Indeterminate progress strip — same pattern as
                       the Add Login ID/PW dialog (mirrors legacy
                       comm_0218_nxisas_view.jsp:109 #container-percent).
                       Renders while saveDisabled is true, i.e. while
                       the parent's NXISAS scrape is in flight after
                       the user clicked Save. The negative horizontal
                       margins span the strip edge-to-edge inside the
                       parent's p-6 so it reads as a full-width band. */}
                    {saveDisabled && (
                        <div
                            aria-hidden
                            className="pointer-events-none relative -mx-6 h-1.5 overflow-hidden bg-[rgba(231,233,253,1)]"
                        >
                            <span className="absolute inset-0 block animate-wb-login-sweep bg-[linear-gradient(to_right,rgba(15,31,234,1)_0%,rgba(116,202,241,0.8)_50%,rgba(15,31,234,1)_100%)] bg-[length:200%_100%]" />
                        </div>
                    )}

                    {/* Body — three stacked fields, gap-4 between them. */}
                    <div className="flex w-full flex-col gap-4">
                        <FormField
                            inputId={idInputId}
                            label={t(
                                "settings.login_credentials.edit_form.label.id",
                            )}
                            icon={<User className="size-4" strokeWidth={2} />}
                            type="text"
                            value={idValue}
                            // ID is informational — disabled gray field
                            // per Figma 3880:22777. No `onChange`.
                            readOnly
                            requiredLabel={t(
                                "settings.login_credentials.confirmation.required",
                            )}
                            autoComplete="username"
                        />
                        <FormField
                            inputId={newPwInputId}
                            label={t(
                                "settings.login_credentials.edit_form.label.new_password",
                            )}
                            placeholder={t(
                                "settings.login_credentials.edit_form.placeholder.new_password",
                            )}
                            icon={<Lock className="size-4" strokeWidth={2} />}
                            type="password"
                            value={newPassword}
                            onChange={setNewPassword}
                            // Lock the inputs during the scrape so the
                            // user can't change values mid-verification
                            // (matches Add Login ID/PW behaviour).
                            readOnly={saveDisabled}
                            requiredLabel={t(
                                "settings.login_credentials.confirmation.required",
                            )}
                            autoComplete="new-password"
                        />
                        <FormField
                            inputId={confirmInputId}
                            label={t(
                                "settings.login_credentials.edit_form.label.confirm_new_password",
                            )}
                            placeholder={t(
                                "settings.login_credentials.edit_form.placeholder.confirm_new_password",
                            )}
                            icon={<Lock className="size-4" strokeWidth={2} />}
                            type="password"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            readOnly={saveDisabled}
                            requiredLabel={t(
                                "settings.login_credentials.confirmation.required",
                            )}
                            autoComplete="new-password"
                        />
                        {/* Inline mismatch error — same pattern as the
                           Add Login ID/PW dialog. Disables Save until
                           the user fixes the mismatch. */}
                        {passwordsMismatch && (
                            <p
                                role="alert"
                                className="text-wb-12 font-medium text-[#bd1822]"
                            >
                                {t(
                                    "settings.login_credentials.add_form.password_mismatch",
                                )}
                            </p>
                        )}
                    </div>

                    {/* Footer — Cancel (white outlined, blue text) +
                       Save (brand primary), right-aligned, gap-2 per
                       Figma 2781:23419. Cancel reuses the shared
                       outlined-button contract — `bg-white` +
                       `shadow-wb-btn` (the project's 1 px outline) —
                       same as every other secondary button in the
                       popup family (LoginIdPasswordDialog,
                       SelectBankDialog, SelectBankAccountsDialog Back),
                       with `text-brand` to keep the blue label from
                       the Figma. */}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={saveDisabled}
                            aria-disabled={saveDisabled}
                            className={
                                saveDisabled
                                    ? "flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-brand shadow-wb-btn opacity-60"
                                    : "flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-brand shadow-wb-btn hover:bg-black/[0.03]"
                            }
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="button"
                            disabled={isSaveDisabled}
                            aria-disabled={isSaveDisabled}
                            onClick={isSaveDisabled ? undefined : handleSave}
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

type FormFieldProps = {
    inputId: string;
    label: string;
    placeholder?: string;
    icon: ReactNode;
    type: "text" | "password";
    value: string;
    onChange?: (next: string) => void;
    /** When true, render the field in the gray "informational" style
     *  (bg-#f5f5f5 + muted text + non-interactive). Used for the ID
     *  field on this dialog per Figma 3880:22777. */
    readOnly?: boolean;
    /** Translated `sr-only` text following the red asterisk so screen
     *  readers announce the required-field state without the icon. */
    requiredLabel: string;
    /** Browser autocomplete hint for accessibility / extension behaviour.
     *  Use `"username"` for the ID field, `"new-password"` for the
     *  password fields (suppresses saved-password autofill). */
    autoComplete: string;
};

function FormField({
    inputId,
    label,
    placeholder,
    icon,
    type,
    value,
    onChange,
    readOnly = false,
    requiredLabel,
    autoComplete,
}: FormFieldProps) {
    return (
        <div className="flex flex-col gap-2">
            {/* Label row — text + red required asterisk. */}
            <label
                htmlFor={inputId}
                className="flex items-start gap-0.5 text-wb-14 font-medium leading-4 text-wb-ntrl-8"
            >
                <span>{label}</span>
                <span aria-hidden className="text-wb-red-07">
                    *
                </span>
                <span className="sr-only">{requiredLabel}</span>
            </label>

            {/* Input row — same "single, flat 1px outline" contract as
               LoginIdPasswordDialog. The readOnly variant swaps the
               background to wb-bg-sidebar (#f5f5f5) and dims the icon
               + text per Figma 3880:22777. */}
            <div
                className={
                    "flex items-center gap-1 rounded-md border border-wb-ntrl-4 p-2 " +
                    (readOnly ? "bg-wb-bg-sidebar" : "bg-white")
                }
            >
                <span
                    aria-hidden
                    className={
                        "flex size-4 shrink-0 items-center justify-center " +
                        (readOnly ? "text-wb-ntrl-6" : "text-wb-ntrl-6")
                    }
                >
                    {icon}
                </span>
                <input
                    id={inputId}
                    type={type}
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                    placeholder={placeholder}
                    readOnly={readOnly}
                    // Suppress browser password-manager UI for password
                    // fields — the Figma frame shows clean fields, those
                    // overlays read as a duplicated inner border.
                    autoComplete={autoComplete}
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                    spellCheck={false}
                    className={
                        "min-w-0 flex-1 appearance-none border-0 bg-transparent text-wb-14 font-medium leading-4 shadow-none outline-none ring-0 placeholder:text-wb-ntrl-5 focus:border-0 focus:outline-none focus:ring-0 " +
                        (readOnly
                            ? "cursor-default text-wb-ntrl-6"
                            : "text-wb-ntrl-8")
                    }
                />
            </div>
        </div>
    );
}
