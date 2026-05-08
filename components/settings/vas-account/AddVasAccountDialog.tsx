"use client";

import { useState } from "react";
import { X } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { VasAccountStatus } from "./types";

type AddVasAccountDialogProps = {
    onClose: () => void;
    /**
     * Dialog variant. Same UI / layout / spacing / behaviour for both
     * modes — Edit only differs in (1) the title ("Edit VAS Account"),
     * (2) the primary button label ("Save" instead of "Add"), and
     * (3) the initial form state (pre-filled with the row being edited
     * vs Add's empty defaults). Defaults to `"add"`.
     */
    mode?: "add" | "edit";
    /**
     * Seed values for `mode="edit"` — the row currently being edited.
     * Ignored when `mode="add"`. Static UI: edits never round-trip to
     * the backend; once the API lands, the parent will pass the
     * up-to-date row plus an `onSave(patch)` handler.
     */
    initialValues?: {
        vasCode: string;
        accountName: string;
        status: VasAccountStatus;
    };
};

/**
 * Add VAS Account dialog — Figma 9194:9233.
 *
 * Custom-shape modal (`p-0` + `rounded-[16px]`) that deviates from the
 * canonical `<DialogHeader>/<DialogBody>/<DialogFooter>` rhythm because
 * the Figma frame specifies its own padding (`px-[16px] py-[24px]`,
 * `gap-[24px]` between sections), 16px corner radius, no `border-t`
 * footer separator, and a 16px (not 18px) title — same per-Figma
 * override pattern used by `<AddNewContactDialog>` and
 * `<EditBankAccountDialog>`. The shared Radix primitive still owns
 * portal, overlay, keyboard handling, and modal-stack registration.
 *
 * Stack: opens from inside Settings → `stackLevel={2}`. Default
 * `closeOnOutsideClick={false}` (inherited from the L2 default) so a
 * click on the dimmed Settings modal underneath does NOT dismiss this
 * dialog by accident. ESC + X + Cancel close. The close X sits inside
 * the title row (flex `justify-between`) rather than using the
 * primitive's default absolute placement so the title bar stays in
 * tight visual harmony with Figma 9194:9234 / 9194:9314 — same
 * pattern AddNewContactDialog uses. `hideClose` therefore stays on
 * the primitive (we render our own X).
 *
 * Static UI: form state lives in this component; Cancel just dismisses,
 * Add is rendered disabled (gray) per Figma until both required fields
 * carry a value — once both are filled it flips to the brand-blue
 * primary style. The Save handler is currently a no-op that closes
 * the dialog; replace with the real POST when the backend lands.
 */
export default function AddVasAccountDialog({
    onClose,
    mode = "add",
    initialValues,
}: AddVasAccountDialogProps) {
    const { t } = useTranslation();
    const isEdit = mode === "edit";

    const [vasCode, setVasCode] = useState(initialValues?.vasCode ?? "");
    const [accountName, setAccountName] = useState(
        initialValues?.accountName ?? "",
    );
    const [status, setStatus] = useState<VasAccountStatus>(
        initialValues?.status ?? "active",
    );

    const canSubmit =
        vasCode.trim().length > 0 && accountName.trim().length > 0;

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
                // Per-Figma 9194:9233 overrides: 16px corner radius, no
                // internal padding (the inner stack owns the 16/24px
                // padding directly). Width capped at 400px to match the
                // compact Figma frame; the primitive's
                // `max-w-[calc(100vw-32px)]` keeps a 16px gutter on
                // smaller viewports. Height is content-driven — no
                // explicit cap because the form is short.
                className="max-w-[400px] rounded-2xl p-0"
            >
                <div className="flex flex-col gap-6 px-4 py-6">
                    {/* Title bar — Figma 9194:9234 (Add) / 9194:9314 (Edit).
                       16px semibold title on the left, 24px close X on
                       the right via flex `justify-between`. Edit mode
                       swaps only the title text — every other visual
                       (including the X) stays identical. */}
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

                    {/* Form body — Figma 9194:9238. 16px gap between
                       fields; each label+input pair is gap-2. */}
                    <div className="flex flex-col gap-4">
                        <FormField
                            label={t(
                                "settings.vas_account.add_dialog.field.code",
                            )}
                            required
                        >
                            <TextInput
                                value={vasCode}
                                onChange={setVasCode}
                                placeholder={t(
                                    "settings.vas_account.add_dialog.placeholder.code",
                                )}
                            />
                        </FormField>

                        <FormField
                            label={t(
                                "settings.vas_account.add_dialog.field.name",
                            )}
                            required
                        >
                            <TextInput
                                value={accountName}
                                onChange={setAccountName}
                                placeholder={t(
                                    "settings.vas_account.add_dialog.placeholder.name",
                                )}
                            />
                        </FormField>

                        {/* Status radio — Figma 9194:9243. Label + 24px
                           gap radio row (Active selected by default). */}
                        <div className="flex flex-col gap-2">
                            <span className="text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                                {t(
                                    "settings.vas_account.add_dialog.field.status",
                                )}
                            </span>
                            <div className="flex items-center gap-6">
                                <RadioPill
                                    checked={status === "active"}
                                    onClick={() => setStatus("active")}
                                    label={t(
                                        "settings.vas_account.add_dialog.status.active",
                                    )}
                                />
                                <RadioPill
                                    checked={status === "inactive"}
                                    onClick={() => setStatus("inactive")}
                                    label={t(
                                        "settings.vas_account.add_dialog.status.inactive",
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer — Cancel + Add right-aligned, 8px gap.
                       No `border-t` per Figma. The Add button stays
                       disabled (gray) until both required fields are
                       populated; static UI Save is a no-op + close. */}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("settings.vas_account.add_dialog.cancel")}
                        </button>
                        <button
                            type="button"
                            disabled={!canSubmit}
                            onClick={() => {
                                if (!canSubmit) return;
                                // Static UI: just dismiss. Wire the real
                                // POST /api/v1/settings/vas-accounts call
                                // here once the endpoint lands.
                                onClose();
                            }}
                            className={cn(
                                "inline-flex h-8 items-center justify-center rounded-md px-3 text-wb-14-tight font-medium text-white",
                                canSubmit
                                    ? "cursor-pointer bg-brand shadow-wb-brand-btn hover:bg-brand-hover"
                                    : "cursor-not-allowed bg-wb-ntrl-4 shadow-wb-outline",
                            )}
                        >
                            {t(
                                isEdit
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

/**
 * Form-field wrapper — label (with optional red asterisk) on top, control
 * below, with the Figma-spec'd 8px gap between them. Local to this dialog
 * because the larger app form-field shape (login) carries an error slot
 * we don't need here. Mirrors `AddNewContactDialog`'s `FormField`.
 */
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

/**
 * Bare text input — h-8 rounded-md with a 1px outline-shadow (NOT a
 * border, per Figma). Matches the Figma `Text Field` instance used by
 * every short input in this dialog (Code / Name).
 */
function TextInput({
    value,
    onChange,
    placeholder,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <div className="flex h-8 w-full items-center rounded-md bg-white px-2 shadow-wb-outline focus-within:shadow-[0_0_0_1px_var(--color-brand)]">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="min-w-0 flex-1 bg-transparent text-wb-14-tight font-medium text-wb-ntrl-8 outline-none placeholder:text-wb-ntrl-5"
            />
        </div>
    );
}

/**
 * Active / Inactive radio button. Custom (no Radix radio in the project)
 * so the visual matches the Figma 18px ring + 6px brand inner dot exactly.
 * Mirrors the `RadioPill` used by `AddNewContactDialog`.
 */
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
            <span className="text-wb-14 font-medium text-wb-ntrl-8">
                {label}
            </span>
        </button>
    );
}
