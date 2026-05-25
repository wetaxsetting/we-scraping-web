"use client";

import { useId, type FormEvent } from "react";

import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    type DialogStackLevel,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type RevealPasswordConfirmDialogProps = {
    /** Title rendered at the top of the dialog (already translated). */
    title: string;
    /** Field label rendered above the password input (already translated). */
    label: string;
    /** Accessible name appended after the red asterisk so screen readers
     *  announce the field as required. Already translated. */
    requiredText: string;
    /** Placeholder rendered inside the password input (already translated). */
    placeholder: string;
    /** Helper / instructional text rendered below the input
     *  (already translated). */
    helper: string;
    /** Controlled value of the password input. */
    value: string;
    onChange: (next: string) => void;
    onClose: () => void;
    /** Submit handler — fires on Save click or Enter inside the input.
     *  No-op when {@link saveDisabled} is `true` or undefined. */
    onSave?: () => void;
    /** When `true`, the Save button renders disabled chrome and Enter
     *  is a no-op. Defaults to `true` so static UI callers don't fire a
     *  half-wired request. */
    saveDisabled?: boolean;
    /** Stack depth — see CLAUDE.md "Modal stacking convention". Defaults
     *  to `3` (sibling popup opened from inside Settings → Registered),
     *  matching the legacy `comm_0218_008` layer position. */
    stackLevel?: DialogStackLevel;
};

/**
 * Password-reveal confirmation dialog — legacy
 * {@code comm_0218_008} parity (legacy view: layer popup with title,
 * single password field, red-asterisk required label, helper text, and
 * Close / Save footer).
 *
 * <p>Distinct from the shared {@code <PasswordConfirmationDialog>}
 * (Figma 83:12764 Lock Screen) — that one is the compact identity-card
 * variant used by {@code <SessionExpiredDialog>} for token-expiry
 * re-auth. The Login Credentials reveal flow uses THIS dialog instead so
 * the chrome reads identical to the legacy WeCMS page.
 *
 * <p>Visual rhythm follows CLAUDE.md §3a Settings Dialog rhythm:
 * <ul>
 *   <li>Header {@code px-6 pt-6 pb-4} — title {@code text-wb-18 font-semibold}</li>
 *   <li>Body {@code px-6 py-4} — label, input ({@code h-9}), helper</li>
 *   <li>Footer {@code border-t px-6 py-3 gap-2 justify-end} — Close (secondary) + Save (primary)</li>
 * </ul>
 *
 * <p>Both buttons render at the canonical Settings height
 * ({@code h-8 px-3 text-wb-14-tight font-medium}) per §3b.
 */
export default function RevealPasswordConfirmDialog({
    title,
    label,
    requiredText,
    placeholder,
    helper,
    value,
    onChange,
    onClose,
    onSave,
    saveDisabled = true,
    stackLevel = 3,
}: RevealPasswordConfirmDialogProps) {
    const { t } = useTranslation();
    const inputId = useId();
    const isSaveDisabled = saveDisabled || !onSave;

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (isSaveDisabled) return;
        onSave?.();
    }

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={stackLevel}
                aria-describedby={undefined}
                className="w-[480px] max-w-[calc(100vw-32px)] gap-0 rounded-2xl p-0"
            >
                <form onSubmit={handleSubmit} className="flex flex-col">
                    <DialogHeader className="px-6 pt-6 pb-4">
                        <DialogTitle className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                            {title}
                        </DialogTitle>
                    </DialogHeader>

                    <DialogBody className="flex flex-col gap-1.5 px-6 py-4">
                        <label
                            htmlFor={inputId}
                            className="flex items-center gap-1 text-wb-13 font-medium text-wb-ntrl-8"
                        >
                            <span>{label}</span>
                            <span aria-hidden="true" className="text-wb-status-rejected-text">
                                *
                            </span>
                            <span className="sr-only">{requiredText}</span>
                        </label>
                        <input
                            id={inputId}
                            type="password"
                            autoFocus
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={placeholder}
                            // Suppress browser password-manager overlays so the
                            // shell doesn't render duplicated borders.
                            autoComplete="new-password"
                            data-1p-ignore="true"
                            data-lpignore="true"
                            data-form-type="other"
                            spellCheck={false}
                            className="h-9 w-full rounded-md bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-outline transition-shadow placeholder:text-wb-ntrl-5 focus:shadow-wb-focus focus:outline-none"
                        />
                        <p className="text-wb-12 font-medium text-wb-ntrl-6">
                            {helper}
                        </p>
                    </DialogBody>

                    <DialogFooter className="flex items-center justify-end gap-2 border-t border-wb-table-border px-6 py-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("dialog.close")}
                        </button>
                        <button
                            type="submit"
                            disabled={isSaveDisabled}
                            className={cn(
                                "flex h-8 items-center justify-center rounded-md px-3 text-wb-14-tight font-medium text-white",
                                isSaveDisabled
                                    ? "cursor-not-allowed bg-wb-ntrl-4"
                                    : "cursor-pointer bg-brand shadow-wb-brand-btn hover:bg-brand-hover",
                            )}
                        >
                            {t("dialog.save")}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
