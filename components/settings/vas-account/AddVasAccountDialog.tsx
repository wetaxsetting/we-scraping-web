"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { ApiCallError } from "@/lib/api/banking";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { validateVasAccount } from "./schema";
import type { VasAccountFormValues } from "./types";
import { useVasAccountMutations } from "./useVasAccount";

type AddVasAccountDialogProps = {
    onClose: () => void;
    /** Fires after a successful POST / PUT — host refetches and dismisses. */
    onSaved?: () => void | Promise<void>;
    /**
     * Dialog variant. Edit only differs in (1) title, (2) primary button
     * label, (3) initial form state, and (4) the wire call (PUT vs POST).
     */
    mode?: "add" | "edit";
    /** Required when `mode="edit"` — backend identity travels via the
     *  path segment. */
    seqNo?: string;
    /** Seed values for `mode="edit"`. */
    initialValues?: VasAccountFormValues;
};

/**
 * Add / Edit VAS Account dialog — Figma 9194:9233.
 *
 * Wired to `POST /api/v1/settings/vas-account` (add) and
 * `PUT /api/v1/settings/vas-account/{seqNo}` (edit). Zod validation
 * mirrors the Spring DTO constraints (`@NotBlank`, `@Size`, `@Pattern`),
 * so the Submit button only enables when the form is valid AND the
 * server rejects nothing the client wouldn't have caught first. Server-
 * side validation failures still surface as `WBE_VALIDATION` /
 * `WBE0003` (duplicate code) through the shared error dialog.
 *
 * Stack: `stackLevel={2}` over the L1 Settings shell.
 */
export default function AddVasAccountDialog({
    onClose,
    onSaved,
    mode = "add",
    seqNo,
    initialValues,
}: AddVasAccountDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const mutations = useVasAccountMutations();
    /* Sticky mirror of `mutations.submitting` — keeps Save / Cancel
     * disabled for the minimum-visibility window so a fast POST / PUT
     * doesn't flicker the buttons enabled → disabled → enabled. The
     * functional guard (`mutations.submitting`) is still checked at
     * handler entry so we never queue a duplicate request even before
     * the sticky flag flips. */
    const stickySubmitting = useStickyLoading(mutations.submitting);
    const isEdit = mode === "edit";

    const [values, setValues] = useState<VasAccountFormValues>(
        initialValues ?? {
            vasCode: "",
            accountName: "",
            status: "active",
        },
    );

    /**
     * Per-field error keys keyed by form-field name. Populated by the
     * Zod schema on Submit; cleared as the user edits a field. We do
     * NOT render the per-field error inline below each input (existing
     * dialog has no error slot) — instead the first issue is surfaced
     * via the shared warning dialog. The Submit button stays enabled
     * (Zod runs on submit, not on every keystroke) so the user can
     * always trigger a fresh validation pass.
     */
    const [submitError, setSubmitError] = useState<string | null>(null);

    const canSubmit = useMemo(() => {
        // Lightweight gate — the formal Zod pass runs on Submit.
        return (
            values.vasCode.trim().length >= 3 &&
            values.accountName.trim().length > 0
        );
    }, [values.vasCode, values.accountName]);

    const setField = <K extends keyof VasAccountFormValues>(
        key: K,
        next: VasAccountFormValues[K],
    ) => {
        setSubmitError(null);
        setValues((prev) => ({ ...prev, [key]: next }));
    };

    const handleSubmit = async () => {
        if (!canSubmit || mutations.submitting) return;

        const issues = validateVasAccount(values);
        if (issues) {
            // Surface the first issue through the shared warning
            // dialog — the per-field error UI is out of scope for this
            // compact form. Translation keys come from the Zod schema.
            const first = issues[0];
            const messageKey = first.key;
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t(messageKey),
            });
            setSubmitError(messageKey);
            return;
        }

        try {
            if (isEdit) {
                if (!seqNo) throw new Error("seqNo is required for edit mode");
                await mutations.update(seqNo, values);
            } else {
                await mutations.create(values);
            }
            if (onSaved) await onSaved();
            else onClose();
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: ex.message,
                errorCode: ex.code,
            });
        }
    };

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
                className="max-w-[400px] rounded-2xl p-0"
            >
                <div className="flex flex-col gap-6 px-4 py-6">
                    <div className="flex items-center justify-between gap-4">
                        <DialogTitle className="text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
                            {t(
                                isEdit
                                    ? "settings.vas_account.edit_dialog.title"
                                    : "settings.vas_account.add_dialog.title",
                            )}
                        </DialogTitle>
                        <button
                            type="button"
                            aria-label={t("settings.close")}
                            onClick={onClose}
                            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-wb-ink hover:bg-black/5"
                        >
                            <X className="size-[18px]" strokeWidth={2} />
                        </button>
                    </div>

                    <div className="flex flex-col gap-4">
                        <FormField
                            label={t("settings.vas_account.add_dialog.field.code")}
                            required
                        >
                            <TextInput
                                value={values.vasCode}
                                onChange={(v) => setField("vasCode", v)}
                                placeholder={t(
                                    "settings.vas_account.add_dialog.placeholder.code",
                                )}
                                ariaInvalid={
                                    submitError?.startsWith(
                                        "settings.vas_account.validation.vasCode",
                                    )
                                }
                            />
                        </FormField>

                        <FormField
                            label={t("settings.vas_account.add_dialog.field.name")}
                            required
                        >
                            <TextInput
                                value={values.accountName}
                                onChange={(v) => setField("accountName", v)}
                                placeholder={t(
                                    "settings.vas_account.add_dialog.placeholder.name",
                                )}
                                ariaInvalid={
                                    submitError?.startsWith(
                                        "settings.vas_account.validation.accountName",
                                    )
                                }
                            />
                        </FormField>

                        {/*
                         * VAS Account Name (English) + Type intentionally
                         * NOT rendered (PO call 2026-05-11) — the wire
                         * omits both fields; the backend defaults Type
                         * to Dual on Create and preserves the existing
                         * entity value on Update so a future tool can
                         * still set them without the Edit dialog wiping
                         * them. The locale keys are kept for the read-
                         * side type label (table / detail view).
                         */}

                        <div className="flex flex-col gap-2">
                            <span className="text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                                {t("settings.vas_account.add_dialog.field.status")}
                            </span>
                            <div className="flex items-center gap-6">
                                <RadioPill
                                    checked={values.status === "active"}
                                    onClick={() => setField("status", "active")}
                                    label={t(
                                        "settings.vas_account.add_dialog.status.active",
                                    )}
                                />
                                <RadioPill
                                    checked={values.status === "inactive"}
                                    onClick={() => setField("status", "inactive")}
                                    label={t(
                                        "settings.vas_account.add_dialog.status.inactive",
                                    )}
                                />
                            </div>
                        </div>

                        {/*
                         * Notes / Optional description retired from the
                         * form (UI cleanup pass). The wire omits `cont`
                         * on Create / Update — see mappers.ts +
                         * VasAccountFormValues. Existing rows' Notes
                         * are preserved on Update because the backend
                         * service guards `cont` with the same isBlank
                         * preserve pattern used for Type / English Name.
                         */}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={stickySubmitting}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t("settings.vas_account.add_dialog.cancel")}
                        </button>
                        <button
                            type="button"
                            disabled={!canSubmit || stickySubmitting}
                            onClick={handleSubmit}
                            className={cn(
                                "inline-flex h-8 items-center justify-center rounded-md px-3 text-wb-14-tight font-medium text-white",
                                canSubmit && !stickySubmitting
                                    ? "cursor-pointer bg-brand shadow-wb-brand-btn hover:bg-brand-hover"
                                    : "cursor-not-allowed bg-wb-ntrl-4 shadow-wb-outline",
                            )}
                        >
                            {t(
                                mutations.submitting
                                    ? "settings.vas_account.add_dialog.saving"
                                    : isEdit
                                    ? "settings.vas_account.add_dialog.update"
                                    : "settings.vas_account.add_dialog.add",
                            )}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function FormField({
    label,
    required = false,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-2">
            <span className="flex items-start gap-0.5 text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                {label}
                {required && (
                    <span className="text-wb-red-07" aria-hidden>
                        *
                    </span>
                )}
            </span>
            {children}
        </label>
    );
}

function TextInput({
    value,
    onChange,
    placeholder,
    ariaInvalid,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    ariaInvalid?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex h-8 w-full items-center rounded-md bg-white px-2 shadow-wb-outline focus-within:shadow-[0_0_0_1px_var(--color-brand)]",
                ariaInvalid && "shadow-[0_0_0_1px_var(--color-wb-red-07)]",
            )}
        >
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-invalid={ariaInvalid || undefined}
                className="min-w-0 flex-1 bg-transparent text-wb-14-tight font-medium text-wb-ntrl-8 outline-none placeholder:text-wb-ntrl-5"
            />
        </div>
    );
}

function RadioPill({
    checked,
    onClick,
    label,
}: {
    checked: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={onClick}
            className="inline-flex cursor-pointer items-center gap-2.5"
        >
            <span
                className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    checked ? "border-brand" : "border-wb-ntrl-4",
                )}
            >
                {checked && <span className="size-2 rounded-full bg-brand" />}
            </span>
            <span className="text-wb-14 font-medium text-wb-ntrl-8">{label}</span>
        </button>
    );
}
