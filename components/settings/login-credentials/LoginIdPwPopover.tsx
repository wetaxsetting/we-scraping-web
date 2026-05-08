"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import PasswordConfirmationDialog from "@/components/shared/popups/PasswordConfirmationDialog";
import { useTranslation } from "@/lib/i18n";

import type { LoginCredentialAccount } from "./types";

type LoginIdPwPopoverProps = {
    accounts: LoginCredentialAccount[];
    /**
     * Fired when the user clicks outside or presses Esc — host clears the
     * `openRowId` so the popover unmounts. Click-outside is detected on
     * mousedown so the close fires before any focus shift inside.
     */
    onClose: () => void;
};

/**
 * Floating panel that lists every (loginId, password) pair for a single
 * institution row — Figma 999:21715 (panel labelled "LOGIN ID / PW").
 *
 * Static UI: the password is part of the mock row, so toggling the eye
 * icon flips between a fixed mask string and the real value. Once the API
 * lands, the eye toggle will fire a per-account reveal request. Mask uses
 * a 16-char run of `*` so the rendered width stays comparable to a
 * realistic password.
 *
 * Positioning is owned by the caller (the table cell wraps the popover in
 * a `relative` parent and supplies the offset). The panel itself only
 * owns its content + chrome + dismiss handlers.
 */
const MASK = "****************";

export default function LoginIdPwPopover({
    accounts,
    onClose,
}: LoginIdPwPopoverProps) {
    const { t } = useTranslation();
    const ref = useRef<HTMLDivElement>(null);
    const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
    /**
     * Index of the row whose password reveal is gated behind the
     * Confirmation popup. `null` when no confirmation is open. The
     * popover suppresses its click-outside handler while this is set
     * so clicking inside the confirmation dialog (which portals to
     * `document.body`, outside the popover's ref) doesn't unmount the
     * popover beneath it.
     */
    const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null);
    /** Controlled value of the confirmation dialog's password field.
     *  Reset on dialog close so a re-open starts fresh. */
    const [confirmValue, setConfirmValue] = useState("");

    // Click-outside (mousedown) + Esc dismiss. Mousedown beats click so we
    // don't see a flash of focus inside before the popover unmounts.
    // Skipped while the confirmation dialog is open — see comment above.
    useEffect(() => {
        if (confirmingIndex !== null) return;
        function onMouseDown(e: MouseEvent) {
            if (!ref.current) return;
            if (!ref.current.contains(e.target as Node)) onClose();
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        }
        document.addEventListener("mousedown", onMouseDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onMouseDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [onClose, confirmingIndex]);

    function handleEyeClick(index: number) {
        // Revealing a hidden password requires confirmation; hiding a
        // revealed password is a free toggle. This matches the Figma
        // 9198:7071 contract — the eye-slash icon opens the confirmation
        // popup, the eye icon (revealed state) just flips back to masked.
        if (revealed.has(index)) {
            setRevealed((prev) => {
                const next = new Set(prev);
                next.delete(index);
                return next;
            });
        } else {
            setConfirmingIndex(index);
        }
    }

    return (
        <div
            ref={ref}
            role="dialog"
            aria-label={t("settings.login_credentials.popover.title")}
            className="absolute left-0 top-full z-30 mt-1 w-[280px] rounded-md border border-wb-ntrl-4 bg-white p-3 shadow-[0_8px_24px_0_rgba(0,0,0,0.12)]"
        >
            <p className="mb-2 text-wb-12 font-semibold uppercase tracking-wb-tight text-wb-ntrl-6">
                {t("settings.login_credentials.popover.title")}
            </p>
            <ul className="flex flex-col gap-2">
                {accounts.map((acct, i) => {
                    const isRevealed = revealed.has(i);
                    return (
                        <li
                            key={`${acct.loginId}-${i}`}
                            className="flex items-center justify-between gap-3"
                        >
                            <span className="truncate text-wb-13 font-medium text-wb-ink">
                                {acct.loginId}
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                                <span
                                    className="font-mono text-wb-13 tracking-tight text-wb-ink"
                                    aria-label={
                                        isRevealed
                                            ? t("settings.login_credentials.popover.password_revealed")
                                            : t("settings.login_credentials.popover.password_hidden")
                                    }
                                >
                                    {isRevealed ? acct.password : MASK}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleEyeClick(i)}
                                    aria-label={
                                        isRevealed
                                            ? t("settings.login_credentials.popover.hide_password")
                                            : t("settings.login_credentials.popover.show_password")
                                    }
                                    aria-pressed={isRevealed}
                                    className="flex size-5 cursor-pointer items-center justify-center rounded-sm text-brand hover:bg-black/5"
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
                        </li>
                    );
                })}
            </ul>

            {/* Password confirmation popup — Figma 9198:7071. Mounted as a
               sibling so Radix portals it to <body>; the popover stays
               visible behind the dialog overlay. Static UI: closing the
               dialog leaves the row's masked state unchanged. */}
            {confirmingIndex !== null && (
                <PasswordConfirmationDialog
                    title={t("settings.login_credentials.confirmation.title")}
                    label={t("settings.login_credentials.confirmation.label")}
                    helperText={t("settings.login_credentials.confirmation.helper")}
                    value={confirmValue}
                    onChange={setConfirmValue}
                    onClose={() => {
                        setConfirmingIndex(null);
                        setConfirmValue("");
                    }}
                />
            )}
        </div>
    );
}
