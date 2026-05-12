"use client";

import { useId, type FormEvent } from "react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
    type DialogStackLevel,
} from "@/components/ui/dialog";

export type PasswordConfirmationDialogProps = {
    /** Accessible name for the dialog (visually hidden — the Figma frame has
     *  no on-screen title). Pass an already-translated string. */
    accessibleTitle: string;
    /** Top identity line — usually the company name. */
    companyName: string;
    /** Optional Tax ID rendered in square brackets directly beneath
     *  {@link companyName}. In legacy WeCMS the company-level admin
     *  login id (`USER_ID`) carries the tax-registration number — pass
     *  that, never the internal `bizKey` (which is the WeCMS tenant
     *  identifier and never user-facing). */
    companyId?: string;
    /** User identity line — usually the login email / id. */
    userEmail: string;
    /** Controlled value of the password input. */
    value: string;
    onChange: (next: string) => void;
    onClose: () => void;
    /** Submit handler. When omitted (or {@link saveDisabled} is `true`)
     *  Enter-to-submit is a no-op. */
    onSave?: () => void;
    /** Force the disabled state. Defaults to `true` so the static UI
     *  contract holds: Enter only fires once a caller wires `onSave` AND
     *  passes `saveDisabled={false}`. */
    saveDisabled?: boolean;
    /** Accessible label for the password input — already translated. */
    passwordAriaLabel: string;
    /** Optional placeholder shown in the password input — already translated. */
    passwordPlaceholder?: string;
    /** Stack depth — see CLAUDE.md "Modal stacking convention". Defaults
     *  to `3` (sibling popup opened from inside Settings → Registered).
     *  The global `<SessionExpiredDialog>` overrides to `5` so a token
     *  expiry mid-flow renders above any open Settings chain. */
    stackLevel?: DialogStackLevel;
    /** When `false`, hides the primitive's top-right X close affordance
     *  (Figma 83:12764 has no visible close button). Defaults to `true`. */
    showClose?: boolean;
};

/**
 * Password confirmation feature dialog — Figma 83:12764 (Lock Screen).
 *
 * A reusable identity-confirmation popup. The visual frame is intentionally
 * minimal: a 48px computer-with-lock badge, the company identity (name +
 * optional code in brackets), the user's email/login id, and a single
 * password field with a 16px keylock leading icon. Per Figma there is no
 * visible title and no Save / Close button — the dialog primitive's X
 * affordance is the dismiss path, and Enter submits.
 *
 * Reusable by passing identity strings + an optional onSave; static UI
 * callers leave onSave unset so Enter no-ops while the verification flow
 * is wired up later.
 *
 * Stack level 3 — opens from inside Settings → Registered → Login ID/PW.
 */
export default function PasswordConfirmationDialog({
    accessibleTitle,
    companyName,
    companyId,
    userEmail,
    value,
    onChange,
    onClose,
    onSave,
    saveDisabled = true,
    passwordAriaLabel,
    passwordPlaceholder,
    stackLevel = 3,
    showClose = true,
}: PasswordConfirmationDialogProps) {
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
                hideClose={!showClose}
                aria-describedby={undefined}
                // Figma 83:12764 — fixed 320 × 282 identity card with
                // 34/26 inner inset. `max-w-/max-h-[calc(100vw|vh-32px)]`
                // keeps the popup readable on narrow mobile viewports
                // without breaking the desktop pixel target.
                className="box-border h-[282px] max-h-[calc(100vh-32px)] w-[320px] max-w-[calc(100vw-32px)] gap-0 px-[34px] py-[26px]"
            >
                {/* Visually-hidden title — Radix needs an accessible name on
                   every dialog, but the Figma frame deliberately renders no
                   visible heading. */}
                <DialogTitle className="sr-only">{accessibleTitle}</DialogTitle>

                <form
                    onSubmit={handleSubmit}
                    className="flex h-full w-full flex-col items-center justify-center gap-[26px]"
                >
                    {/* Identity block — Figma 83:12765 (12 px between icon
                       and company text). */}
                    <div className="flex w-full flex-col items-center gap-[12px]">
                        {/* Top monitor-lock icon — Figma 83:12768 ships the
                           SVG with `viewBox 0 0 48 39.8` AND
                           `preserveAspectRatio="none"`, so a square box
                           stretches it vertically. Use the asset's real
                           48×40 aspect ratio (matches the Figma frame's
                           `h-[39.802px] w-[48px]`). */}
                        <img
                            src="/assets/auth/ico-computer-lock-48.svg"
                            alt=""
                            aria-hidden
                            className="h-10 w-12 shrink-0"
                        />
                        <p className="text-center text-wb-14-relaxed font-medium tracking-wb-tight text-wb-ink">
                            <span>{companyName}</span>
                            {companyId ? (
                                <>
                                    <br aria-hidden />
                                    <span>{`[${companyId}]`}</span>
                                </>
                            ) : null}
                        </p>
                    </div>

                    {/* Credentials block — Figma 83:12775 (email + input,
                       12 px gap). */}
                    <div className="flex w-full flex-col items-stretch gap-[12px]">
                        <p className="text-center text-wb-14-tight font-medium tracking-wb-tight text-wb-ink">
                            {userEmail}
                        </p>

                        {/* Input shell — 38 px tall (Sonny override on top
                           of the 32 px Figma node), 6 px corners, 1 px
                           outline via shadow-wb-outline; brand focus ring
                           via shadow-wb-focus on focus-within. Leading
                           lock matches the Login page's input chrome
                           (`/images/login/ico-lock.svg` + `size-[18px]`)
                           — the Figma 83:12780 asset ships with
                           `preserveAspectRatio="none"` on a non-square
                           viewBox so it would stretch in a square box;
                           the Login icon is square + already the right
                           gray (#A3A3A3). */}
                        <label
                            htmlFor={inputId}
                            className="flex h-[38px] items-center gap-2 rounded-md bg-white px-2 shadow-wb-outline transition-shadow focus-within:shadow-wb-focus"
                        >
                            <span className="sr-only">{passwordAriaLabel}</span>
                            <img
                                src="/images/login/ico-lock.svg"
                                alt=""
                                aria-hidden
                                className="size-[18px] shrink-0"
                            />
                            <input
                                id={inputId}
                                type="password"
                                autoFocus
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                aria-label={passwordAriaLabel}
                                placeholder={passwordPlaceholder}
                                // Suppress browser password-manager overlays
                                // (1Password / LastPass / Dashlane / Edge
                                // shield) — they would render as a
                                // duplicated inner border.
                                autoComplete="new-password"
                                data-1p-ignore="true"
                                data-lpignore="true"
                                data-form-type="other"
                                spellCheck={false}
                                className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-wb-13 font-medium leading-4 text-wb-ink shadow-none outline-none placeholder:text-wb-ntrl-5 focus:border-0 focus:outline-none focus:ring-0"
                            />
                        </label>
                    </div>

                    {/* Hidden submit so Enter triggers onSave even though
                       the visual frame ships no Save button. */}
                    <button
                        type="submit"
                        disabled={isSaveDisabled}
                        aria-hidden
                        tabIndex={-1}
                        className="sr-only"
                    >
                        {accessibleTitle}
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
