"use client";

import { useEffect } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ModalField, ModalInput } from "@/components/shared/modal-form";
import { useDialog } from "@/components/shared/dialog";
import { changePassword, LoginError } from "@/lib/auth/client";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Change Password popup — wired into {@link ProfileMenu}. Feature dialog
 * (shadcn primitive), NOT a system `useDialog()` dialog. UI follows the
 * compact New Firm Banking popup reference — shared {@link ModalField} /
 * {@link ModalInput} primitives, max-w-[400px] rounded-2xl shell, h-8
 * footer buttons — so every compact modal form reads as one product.
 * Mirrors the legacy {@code comm_0401_001} popup
 * ({@code comm_0400_001_u001} action).
 *
 * Validation surfaces through the shared system dialog (same pattern as
 * {@code LoginForm}): zod holds translation keys, the invalid-submit
 * handler shows the first error, and the API never fires on a failed
 * client validation. Success / backend errors also route through the
 * system dialog.
 */

const changePasswordSchema = z
    .object({
        currentPassword: z
            .string()
            .min(1, "change_password.current_required")
            .max(100, "login.password_max"),
        newPassword: z
            .string()
            .min(1, "change_password.new_required")
            .max(100, "login.password_max"),
        confirmPassword: z
            .string()
            .min(1, "change_password.confirm_required")
            .max(100, "login.password_max"),
    })
    // New password must equal the confirmation — frontend backstop for the
    // backend WBE_CHANGE_PASSWORD_MISMATCH. Error attaches to the confirm
    // field so it surfaces after the per-field required checks.
    .refine((d) => d.newPassword === d.confirmPassword, {
        message: "change_password.mismatch",
        path: ["confirmPassword"],
    });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

// Drives which validation message surfaces first — matches the visual
// top-to-bottom field order.
const FIELD_ORDER: (keyof ChangePasswordFormValues)[] = [
    "currentPassword",
    "newPassword",
    "confirmPassword",
];

type ChangePasswordDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export default function ChangePasswordDialog({
    open,
    onOpenChange,
}: ChangePasswordDialogProps) {
    const dialog = useDialog();
    const { t } = useTranslation();

    const {
        register,
        handleSubmit,
        reset,
        setFocus,
        formState: { errors, isSubmitting },
    } = useForm<ChangePasswordFormValues>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    });

    // Clear the fields whenever the popup closes (Cancel / X / outside-click /
    // success) so the next open starts blank — never leaks a typed password.
    useEffect(() => {
        if (!open) reset();
    }, [open, reset]);

    const reportError = (err: unknown) => {
        const isLoginError = err instanceof LoginError;
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: isLoginError ? err.message : t("dialog.unexpected_error"),
            errorCode: isLoginError ? err.code : undefined,
            uuid: isLoginError ? err.traceId : undefined,
        });
    };

    const onSubmit = handleSubmit(
        async (values) => {
            try {
                await changePassword(
                    values.currentPassword,
                    values.newPassword,
                    values.confirmPassword,
                );
                // Success — acknowledge, then close the popup. The close
                // effect resets the fields.
                dialog.open({
                    type: "success",
                    title: t("dialog.success"),
                    description: t("change_password.success"),
                    onConfirm: () => onOpenChange(false),
                    onClose: () => onOpenChange(false),
                });
            } catch (err) {
                reportError(err);
            }
        },
        (fieldErrors) => {
            for (const field of FIELD_ORDER) {
                const key = fieldErrors[field]?.message;
                if (key) {
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description: t(key),
                        onClose: () => setFocus(field),
                    });
                    return;
                }
            }
        },
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Modal wrapper mirrors the New Firm Banking popup (the approved
                compact feature-dialog reference): max-w-[400px], rounded-2xl,
                p-0 with an inner `px-4 py-6 gap-6` column. Standalone dialog
                (opened from ProfileMenu) → default stackLevel 1, default close
                X. `closeOnOutsideClick={false}` so the popup dismisses ONLY via
                the X / Cancel (a stray backdrop click must not discard a typed
                password) — same close contract the Settings/New-Firm-Banking
                stacked dialogs get by default. ESC stays enabled (primitive
                default). */}
            <DialogContent
                className="max-w-[400px] rounded-2xl p-0"
                closeOnOutsideClick={false}
            >
                <div className="flex w-full flex-col gap-6 px-4 py-6">
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold leading-[18px] text-wb-dark">
                            {t("change_password.title")}
                        </h2>
                    </DialogTitle>

                    <form
                        id="change-password-form"
                        noValidate
                        onSubmit={onSubmit}
                        className="flex flex-col gap-4"
                    >
                        <PasswordField
                            id="currentPassword"
                            label={t("change_password.current_label")}
                            placeholder={t("change_password.current_placeholder")}
                            autoComplete="current-password"
                            invalid={!!errors.currentPassword}
                            register={register("currentPassword")}
                        />
                        <PasswordField
                            id="newPassword"
                            label={t("change_password.new_label")}
                            placeholder={t("change_password.new_placeholder")}
                            autoComplete="new-password"
                            invalid={!!errors.newPassword}
                            register={register("newPassword")}
                        />
                        <PasswordField
                            id="confirmPassword"
                            label={t("change_password.confirm_label")}
                            placeholder={t("change_password.confirm_placeholder")}
                            autoComplete="new-password"
                            invalid={!!errors.confirmPassword}
                            register={register("confirmPassword")}
                        />
                    </form>

                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("dialog.cancel")}
                        </button>
                        <button
                            type="submit"
                            form="change-password-form"
                            disabled={isSubmitting}
                            aria-busy={isSubmitting}
                            className={cn(
                                "flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn",
                                isSubmitting
                                    ? "cursor-wait bg-brand opacity-60"
                                    : "bg-brand hover:bg-brand-hover",
                            )}
                        >
                            {isSubmitting && (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                            )}
                            {isSubmitting
                                ? t("change_password.saving")
                                : t("dialog.save")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

type PasswordFieldProps = {
    id: string;
    label: string;
    placeholder: string;
    autoComplete: string;
    invalid: boolean;
    register: UseFormRegisterReturn;
};

/** One password row — shared {@link ModalField} label + {@link ModalInput}
 *  control, matching the New Firm Banking field rhythm. */
function PasswordField({
    id,
    label,
    placeholder,
    autoComplete,
    invalid,
    register,
}: PasswordFieldProps) {
    return (
        <ModalField label={label} htmlFor={id}>
            <ModalInput
                id={id}
                type="password"
                placeholder={placeholder}
                autoComplete={autoComplete}
                aria-invalid={invalid}
                {...register}
            />
        </ModalField>
    );
}
