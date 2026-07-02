"use client";

import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shared "Dashboard" toggle button used by list pages that can show / hide
 * a summary (KPI / TOTAL ACCOUNTS) card at the top of the page — Card
 * Transactions, Account Inquiry (VND / FCY), and any future page with the
 * same affordance.
 *
 * Single source of truth for the button's chrome so every page renders it
 * identically: same height (`h-9`), radius, padding, icon size + spacing,
 * blue active state, white inactive state, and hover. Both states share the
 * exact same box model, so toggling never shifts the surrounding toolbar.
 *
 *  - `active` (summary visible)  → blue: filled brand background, Eye icon.
 *  - `!active` (summary hidden)  → white: outlined button, EyeOff icon.
 */
export interface DashboardToggleButtonProps {
    /** Whether the summary card is currently visible (the "on" state). */
    active: boolean;
    /** Toggle handler — flips the summary card's visibility. */
    onToggle: () => void;
    /** Translated button label (e.g. `t("account_inquiry.dashboard")`). */
    label: string;
    /** Optional extra classes for the toolbar's alignment needs. */
    className?: string;
}

export default function DashboardToggleButton({
    active,
    onToggle,
    label,
    className,
}: DashboardToggleButtonProps) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onToggle}
            className={cn(
                "flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md px-4",
                "text-wb-14 font-medium",
                active
                    ? "bg-brand text-white shadow-wb-outline hover:bg-brand-hover"
                    : "bg-white text-wb-ntrl-8 shadow-wb-btn hover:bg-neutral-50",
                className,
            )}
        >
            <span>{label}</span>
            {active ? (
                <Eye className="size-5" strokeWidth={1.8} />
            ) : (
                <EyeOff className="size-5" strokeWidth={1.8} />
            )}
        </button>
    );
}
