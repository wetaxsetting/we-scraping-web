"use client";

import { useId, useState, type ReactNode } from "react";
import { Lock, User } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    type DialogStackLevel,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

export type LoginIdPasswordValues = {
    id: string;
    password: string;
    confirmPassword: string;
};

export type LoginIdPasswordDialogProps = {
    /** Institution display name — surfaces in aria-labels (e.g. for the
     *  "Choose another bank" affordance) and helps screen readers identify
     *  the dialog context. The Figma frame doesn't render this string in
     *  the title; the visible identity comes from `bankLogo`. */
    bankName: string;
    /** Optional bank logo / brand mark rendered above the form fields.
     *  Hosts pass any ReactNode (typically `<BankBrandLogo>` or a real
     *  `<img>`). The Figma frame caps the slot at 80 × 240 — pass elements
     *  sized to fit within that envelope. */
    bankLogo?: ReactNode;
    onChooseAnotherBank?: () => void;
    onCancel: () => void;
    /** Submit handler. When omitted (or `loginDisabled` is true), the
     *  Login button stays in its disabled visual state and clicks no-op.
     *  Receives the current field values when fired. */
    onLogin?: (values: LoginIdPasswordValues) => void;
    /** Optional explicit override — when `true`, force the Login button
     *  into its disabled visual state regardless of field values. When
     *  omitted, the dialog auto-enables Login as soon as all three
     *  required fields (ID + Password + Confirm password) are non-empty
     *  AND `onLogin` is provided. */
    loginDisabled?: boolean;
    /** Optional initial field values. Useful when re-opening the dialog
     *  after a draft was kept around; the static UI doesn't read these
     *  back via callbacks. */
    initialValues?: Partial<LoginIdPasswordValues>;
    /** Position in the modal stack. Defaults to `3` because the canonical
     *  use is the Settings → Registered → Login ID/PW chain. Callers that
     *  open this popup as a direct child of a Settings panel (e.g. Bank
     *  Account Management → +Add → Select Bank → Login ID/PW) pass `2`
     *  so the overlay dim and z-index match CLAUDE.md §"Modal stacking
     *  convention". */
    stackLevel?: DialogStackLevel;
};

/**
 * Login ID/PW feature dialog — Figma 1081:25293.
 *
 * Reusable institution credential form: a small modal with bank logo,
 * three password-style fields (ID + Password + Confirm password), and a
 * three-button footer (Choose another bank / Cancel / Login). Triggered
 * by "Add Login ID/PW" inside the Registered Login Credentials dialog,
 * but generic enough to be reused by future flows that subscribe new
 * banking credentials.
 *
 * Modal frame: `max-w-[440px]`, `rounded-[16px]`,
 * `p-6 gap-8`. Inner sections are laid out by hand (per CLAUDE.md §3a's
 * Figma-driven deviation precedent for small modals).
 *
 * Static UI: fields are uncontrolled (managed internally via `useState`).
 * Login submits the current values to `onLogin` if provided + enabled;
 * Cancel and Choose-another-bank are simple dismiss / callback hooks.
 */
export default function LoginIdPasswordDialog({
    bankName,
    bankLogo,
    onChooseAnotherBank,
    onCancel,
    onLogin,
    loginDisabled,
    initialValues,
    stackLevel = 3,
}: LoginIdPasswordDialogProps) {
    const { t } = useTranslation();
    const idInputId = useId();
    const pwInputId = useId();
    const confirmInputId = useId();

    const [id, setId] = useState(initialValues?.id ?? "");
    const [password, setPassword] = useState(initialValues?.password ?? "");
    const [confirmPassword, setConfirmPassword] = useState(
        initialValues?.confirmPassword ?? "",
    );

    // Login lights up when all three required fields carry a value AND
    // a submit handler is provided. The optional `loginDisabled` prop
    // wins when explicitly `true` — lets a parent veto the auto-enable
    // (e.g. while a previous submission is in flight).
    const allFieldsFilled =
        id.length > 0 && password.length > 0 && confirmPassword.length > 0;
    const isLoginDisabled =
        loginDisabled === true || !onLogin || !allFieldsFilled;

    function handleLogin() {
        if (isLoginDisabled || !onLogin) return;
        onLogin({ id, password, confirmPassword });
    }

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onCancel();
            }}
        >
            <DialogContent
                // Stack position is caller-driven: defaults to L3 for the
                // Settings → Registered → Login ID/PW chain, and L2 when
                // opened directly from a Settings panel (Bank Account →
                // +Add → Select Bank → Login ID/PW). The shared modalStack
                // ensures ESC and X dismiss only this dialog regardless
                // of the selected level.
                stackLevel={stackLevel}
                className="max-w-[440px] rounded-2xl"
            >
                <div className="flex flex-col gap-8 p-6">
                    {/* Header — title + subtitle stacked, gap-1.5. */}
                    <div className="flex flex-col items-start gap-1.5">
                        <DialogTitle asChild>
                            <h2 className="text-wb-16 font-semibold text-wb-dark">
                                {t("settings.login_credentials.add_form.title")}
                            </h2>
                        </DialogTitle>
                        <DialogDescription asChild>
                            <p className="text-wb-13 font-medium text-wb-dark/70">
                                {t("settings.login_credentials.add_form.subtitle")}
                            </p>
                        </DialogDescription>
                    </div>

                    {/* Body — bank logo above the three fields. */}
                    <div className="flex flex-col items-center gap-6">
                        {bankLogo && (
                            <div
                                className="flex items-center justify-center"
                                aria-label={bankName}
                            >
                                {bankLogo}
                            </div>
                        )}

                        <div className="flex w-full flex-col gap-4">
                            <FormField
                                inputId={idInputId}
                                label={t("settings.login_credentials.add_form.label.id")}
                                placeholder={t("settings.login_credentials.add_form.placeholder.id")}
                                icon={<User className="size-4" strokeWidth={2} />}
                                type="text"
                                value={id}
                                onChange={setId}
                                requiredLabel={t(
                                    "settings.login_credentials.confirmation.required",
                                )}
                                autoComplete="username"
                            />
                            <FormField
                                inputId={pwInputId}
                                label={t("settings.login_credentials.add_form.label.password")}
                                placeholder={t("settings.login_credentials.add_form.placeholder.password")}
                                icon={<Lock className="size-4" strokeWidth={2} />}
                                type="password"
                                value={password}
                                onChange={setPassword}
                                requiredLabel={t(
                                    "settings.login_credentials.confirmation.required",
                                )}
                                autoComplete="new-password"
                            />
                            <FormField
                                inputId={confirmInputId}
                                label={t("settings.login_credentials.add_form.label.confirm_password")}
                                placeholder={t("settings.login_credentials.add_form.placeholder.confirm_password")}
                                icon={<Lock className="size-4" strokeWidth={2} />}
                                type="password"
                                value={confirmPassword}
                                onChange={setConfirmPassword}
                                requiredLabel={t(
                                    "settings.login_credentials.confirmation.required",
                                )}
                                autoComplete="new-password"
                            />
                        </div>
                    </div>

                    {/* Footer — split: Choose-another-bank LEFT, Cancel +
                       Login RIGHT (gap-2). All three buttons share the
                       same height + padding. */}
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={onChooseAnotherBank}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-8 shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("settings.login_credentials.add_form.choose_another_bank")}
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                type="button"
                                disabled={isLoginDisabled}
                                aria-disabled={isLoginDisabled}
                                onClick={isLoginDisabled ? undefined : handleLogin}
                                className={
                                    isLoginDisabled
                                        ? "flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-wb-ntrl-4 px-3 text-wb-14-tight font-medium tracking-wb-tight text-white"
                                        : "flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover"
                                }
                            >
                                {t("settings.login_credentials.add_form.login")}
                            </button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

type FormFieldProps = {
    inputId: string;
    label: string;
    placeholder: string;
    icon: ReactNode;
    type: "text" | "password";
    value: string;
    onChange: (next: string) => void;
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

            {/* Input row — single 1 px gray border, no focus color swap.
               Same "single, flat border" contract as PasswordConfirmationDialog. */}
            <div className="flex items-center gap-1 rounded-md border border-wb-ntrl-4 bg-white p-2">
                <span aria-hidden className="flex size-4 shrink-0 items-center justify-center text-wb-ntrl-6">
                    {icon}
                </span>
                <input
                    id={inputId}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    // Suppress browser password-manager UI for password
                    // fields — the Figma frame shows clean fields, those
                    // overlays read as a duplicated inner border.
                    autoComplete={autoComplete}
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                    spellCheck={false}
                    className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-wb-14 font-medium leading-4 text-wb-ntrl-8 shadow-none outline-none ring-0 placeholder:text-wb-ntrl-5 focus:border-0 focus:outline-none focus:ring-0"
                />
            </div>
        </div>
    );
}
