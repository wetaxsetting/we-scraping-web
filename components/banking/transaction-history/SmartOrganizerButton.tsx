"use client";

import { Sparkles } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SmartOrganizerButtonProps = {
    onClick?: () => void;
    className?: string;
};

/**
 * Smart Organizer trigger shown in the top-right action area of the
 * Transaction History detail (Figma node 989:22011). It opens the
 * auto-classification flow when the backend lands — kept UI-only for now.
 *
 * Outline style with a leading spark glyph to match the Figma asset; the
 * button lives alongside the list/export icons in the same 32px-height
 * action toolbar.
 */
export default function SmartOrganizerButton({
    onClick,
    className,
}: SmartOrganizerButtonProps) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-wb-bg-card",
                className,
            )}
        >
            <Sparkles className="size-4 shrink-0 text-brand" strokeWidth={1.8} />
            <span className="whitespace-nowrap">
                {t("txn_history.smart_organizer")}
            </span>
        </button>
    );
}
