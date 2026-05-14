"use client";

import { useId, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

export type GdtCredentialsValues = {
    userName: string;
    password: string;
    passwordConfirmation: string;
};

export type GdtCredentialsDialogProps = {
    onCancel: () => void;
    /** Submit handler. Receives the current field values when fired.
     *  When omitted (or all required fields are empty), Next stays
     *  disabled. */
    onNext?: (values: GdtCredentialsValues) => void;
    /** Optional explicit override — when `true`, force Next into its
     *  disabled visual state regardless of field values (e.g. while a
     *  previous submission is in flight). */
    nextDisabled?: boolean;
    /** Optional initial field values. */
    initialValues?: Partial<GdtCredentialsValues>;
};

/**
 * GDT Credentials feature dialog — Figma 2344:21946.
 *
 * Reusable Account Management popup for GDT (General Department of
 * Taxation, Vietnam). Triggered from
 *   Settings → Login Credentials → Add → Select Institution → GDT
 * but kept generic enough for any future flow that needs the same
 * brown-tabbed credentials form. Sibling of the Bank-branch's first
 * step (`SelectBankDialog`) — both sit at stack level 3 above the
 * level-2 institution picker so the visual stack remains "Settings +
 * one credentials popup at a time".
 *
 * Modal frame:
 *   - max-w-[540px], rounded-[16px], standard shadcn `<DialogContent>`
 *     primitive (Radix portal + overlay + ESC focus trap)
 *   - Standard top-right X close icon comes from the primitive —
 *     dismisses only this dialog via the shared `modalStack` (Settings
 *     stays open behind)
 *   - stackLevel={3} matches the Bank flow's first-after-institution
 *     step so the dim ramp + z-index ramp stay symmetric
 *
 * Inner stack (`p-6 gap-6`):
 *   [Header]      title "Account Management" + description
 *                 "Please edit GDT credentials." (gap-1.5, pr-10 to
 *                 clear the absolute X close icon)
 *   [Login banner] static image asset
 *                 (`/assets/settings/gdt-login-panel.png`) — cropped
 *                 from the Figma frame so the brown chevron tab,
 *                 inline X, brown underline, and User Name + Password
 *                 preview row render exactly as designed without
 *                 reconstructing them as interactive HTML. Marked
 *                 `aria-hidden` since the row below is the real
 *                 editable surface.
 *   [Form]        three required fields rendered as label-left /
 *                 input-right rows: User Name * / Password * /
 *                 Password Confirmation *. Plain inputs — no clear-X,
 *                 no eye-toggle — per the Figma update.
 *   [Footer]      Cancel (white outline) + Next (auto-enables once
 *                 all three required fields carry a value AND
 *                 `onNext` is provided).
 *
 * Static UI: fields are uncontrolled (managed internally). Cancel + X
 * + ESC dismiss; outside-click is gated off by stackLevel=3's default
 * `closeOnOutsideClick=false` so a stray click on the dim doesn't
 * silently abandon the form.
 */
export default function GdtCredentialsDialog({
    onCancel,
    onNext,
    nextDisabled,
    initialValues,
}: GdtCredentialsDialogProps) {
    const { t } = useTranslation();
    const userNameInputId = useId();
    const passwordInputId = useId();
    const confirmInputId = useId();

    const [userName, setUserName] = useState(initialValues?.userName ?? "");
    const [password, setPassword] = useState(initialValues?.password ?? "");
    const [passwordConfirmation, setPasswordConfirmation] = useState(
        initialValues?.passwordConfirmation ?? "",
    );

    // Auto-derive Next-enabled from the three required fields AND
    // the two password fields agreeing. The optional `nextDisabled`
    // prop wins when explicitly `true`. Mismatch surfaces inline only
    // after the user has typed in Confirm Password — an empty field
    // is "incomplete", not "mismatched".
    const allRequiredFilled =
        userName.length > 0 &&
        password.length > 0 &&
        passwordConfirmation.length > 0;
    const passwordsMismatch =
        passwordConfirmation.length > 0 && password !== passwordConfirmation;
    const isNextDisabled =
        nextDisabled === true ||
        !onNext ||
        !allRequiredFilled ||
        passwordsMismatch;

    function handleNext() {
        if (isNextDisabled || !onNext) return;
        onNext({ userName, password, passwordConfirmation });
    }

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onCancel();
            }}
        >
            <DialogContent
                // Stack level 3 — sibling of the Bank-branch's first
                // step (Select Bank) so the visual stack stays
                // symmetric across both branches. Standard top-right
                // X close icon comes from the primitive.
                stackLevel={3}
                className="max-w-[540px] rounded-2xl"
            >
                <div className="flex flex-col gap-6 p-6">
                    {/* Header — title + description, gap-1.5. pr-10
                       reserves space for the absolute X close icon at
                       right-4 top-4 so the description never wraps
                       under it on a narrow viewport. */}
                    <div className="flex flex-col items-start gap-1.5 pr-10">
                        <DialogTitle asChild>
                            <h2 className="text-wb-16 font-semibold text-wb-dark">
                                {t("settings.login_credentials.gdt.title")}
                            </h2>
                        </DialogTitle>
                        <DialogDescription asChild>
                            <p className="text-wb-13 font-medium text-wb-dark/70">
                                {t("settings.login_credentials.gdt.description")}
                            </p>
                        </DialogDescription>
                    </div>

                    {/* Log in panel — static banner image cropped from
                       Figma 2344:21946. Replaces the previous
                       hand-rendered tab card per the update: the brown
                       chevron tab, inline X, underline, and User Name +
                       Password preview row are baked into the asset so
                       no part of this section is interactive. The image
                       fills the available width (block + w-full + h-auto)
                       so it scales with the modal cleanly; aria-hidden
                       because the editable surface is the form below. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/settings/gdt-login-panel.png"
                        alt=""
                        aria-hidden
                        className="block h-auto w-full select-none"
                        draggable={false}
                    />

                    {/* Form fields — three required label-left / input-right
                       rows. Plain inputs only (no clear-X, no eye-toggle)
                       per the Figma update. */}
                    <div className="flex flex-col gap-3">
                        <FieldRow
                            inputId={userNameInputId}
                            label={t(
                                "settings.login_credentials.gdt.label.user_name",
                            )}
                            requiredLabel={t(
                                "settings.login_credentials.confirmation.required",
                            )}
                        >
                            <input
                                id={userNameInputId}
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                placeholder={t(
                                    "settings.login_credentials.gdt.placeholder.user_name",
                                )}
                                autoComplete="username"
                                spellCheck={false}
                                className="h-9 w-full rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14 font-medium leading-4 text-wb-ntrl-8 outline-none placeholder:text-wb-ntrl-5"
                            />
                        </FieldRow>

                        <FieldRow
                            inputId={passwordInputId}
                            label={t(
                                "settings.login_credentials.gdt.label.password",
                            )}
                            requiredLabel={t(
                                "settings.login_credentials.confirmation.required",
                            )}
                        >
                            <input
                                id={passwordInputId}
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t(
                                    "settings.login_credentials.gdt.placeholder.password",
                                )}
                                // Suppress browser password-manager UI —
                                // those overlays read as a duplicated
                                // inner border on the Figma-spec'd field.
                                autoComplete="new-password"
                                data-1p-ignore="true"
                                data-lpignore="true"
                                data-form-type="other"
                                spellCheck={false}
                                className="h-9 w-full rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14 font-medium leading-4 text-wb-ntrl-8 outline-none placeholder:text-wb-ntrl-5"
                            />
                        </FieldRow>

                        <FieldRow
                            inputId={confirmInputId}
                            label={t(
                                "settings.login_credentials.gdt.label.password_confirmation",
                            )}
                            requiredLabel={t(
                                "settings.login_credentials.confirmation.required",
                            )}
                        >
                            <input
                                id={confirmInputId}
                                type="password"
                                value={passwordConfirmation}
                                onChange={(e) =>
                                    setPasswordConfirmation(e.target.value)
                                }
                                placeholder={t(
                                    "settings.login_credentials.gdt.placeholder.password_confirmation",
                                )}
                                autoComplete="new-password"
                                data-1p-ignore="true"
                                data-lpignore="true"
                                data-form-type="other"
                                spellCheck={false}
                                className="h-9 w-full rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14 font-medium leading-4 text-wb-ntrl-8 outline-none placeholder:text-wb-ntrl-5"
                            />
                        </FieldRow>

                        {/* Inline mismatch error — visible once the user
                           has typed in Confirm Password and the two
                           password fields disagree. Disables Next at the
                           same time (see `passwordsMismatch` state). */}
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

                    {/* Footer — Cancel (outline) + Next (disabled until
                       all required fields are filled). Right-aligned,
                       gap-2, matches every other Settings-flow popup. */}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="button"
                            disabled={isNextDisabled}
                            aria-disabled={isNextDisabled}
                            onClick={isNextDisabled ? undefined : handleNext}
                            className={
                                isNextDisabled
                                    ? "flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-wb-ntrl-4 px-3 text-wb-14-tight font-medium tracking-wb-tight text-white"
                                    : "flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover"
                            }
                        >
                            {t("settings.login_credentials.gdt.next")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Form-field row (label-left + input-right)
// ─────────────────────────────────────────────────────────────────────

type FieldRowProps = {
    inputId: string;
    label: string;
    /** Translated `sr-only` text following the red required dot so
     *  screen readers announce the required-field state. */
    requiredLabel: string;
    children: React.ReactNode;
};

function FieldRow({ inputId, label, requiredLabel, children }: FieldRowProps) {
    return (
        <div className="grid grid-cols-[180px_1fr] items-center gap-3">
            {/* Label cell — text + red required dot per Figma. The dot
               is a true bullet (•) rather than an asterisk to match the
               filled-circle glyph in the Figma frame. */}
            <label
                htmlFor={inputId}
                className="flex items-center gap-1 text-wb-13 font-medium leading-4 text-wb-ntrl-8"
            >
                <span>{label}</span>
                <span aria-hidden className="text-wb-red-07 leading-none">
                    •
                </span>
                <span className="sr-only">{requiredLabel}</span>
            </label>
            {children}
        </div>
    );
}
