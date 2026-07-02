"use client";

import { cn } from "@/lib/utils";

/**
 * The corporate-card inline-edit text field — single source of truth
 * for the editor chrome shared by CardManagementDialog (Card Holder +
 * Card Nickname cells) and SelectCardsDialog (Card Name cell). Border,
 * radius, padding, text token, focus ring, and the Enter-commit /
 * Esc-cancel / blur-commit behaviour are owned here; callers may only
 * add width/positioning classes via {@link className} — never a second
 * copy of the chrome.
 *
 * Defaults to {@code w-full} (fills its cell, as Card Management's
 * narrow columns expect). A caller in a wider column caps the width by
 * passing e.g. {@code max-w-[240px]} so the input stays proportionate.
 */
export default function InlineEditInput({
    value,
    onChange,
    onCommit,
    onCancel,
    ariaLabel,
    maxLength,
    className,
}: {
    value:      string;
    onChange:   (next: string) => void;
    onCommit:   () => void;
    onCancel:   () => void;
    ariaLabel:  string;
    maxLength:  number;
    className?: string;
}) {
    return (
        <input
            type="text"
            autoFocus
            aria-label={ariaLabel}
            value={value}
            maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    onCommit();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    onCancel();
                }
            }}
            onBlur={onCommit}
            className={cn(
                "block w-full rounded-md border border-wb-ntrl-4 bg-white px-2 py-1 text-wb-13 font-medium text-wb-ink",
                "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40",
                className,
            )}
        />
    );
}
