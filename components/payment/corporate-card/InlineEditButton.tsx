"use client";

import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The corporate-card inline "edit name" pencil chip — single source of
 * truth for the edit-button chrome shared by CardManagementDialog
 * (Card Holder + Card Nickname cells) and SelectCardsDialog (Card Name
 * cell). Size (24px), radius (4px), background, shadow, icon size /
 * stroke, colour, and hover state are owned here; callers may only add
 * visibility / positioning classes (e.g. Card Management's
 * reveal-on-row-hover `invisible group-hover:visible`) — never a second
 * copy of the chrome.
 */
export default function InlineEditButton({
    ariaLabel,
    onClick,
    className,
}: {
    ariaLabel:  string;
    onClick:    () => void;
    className?: string;
}) {
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            onClick={onClick}
            className={cn(
                "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded bg-white p-1 text-wb-ink shadow-wb-btn hover:bg-black/5",
                className,
            )}
        >
            <Pencil className="size-4" strokeWidth={1.7} />
        </button>
    );
}
