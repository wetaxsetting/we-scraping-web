"use client";

import DeleteIcon from "@/components/shared/icons/DeleteIcon";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The three tabs of the Purpose screen, mirroring legacy
 *  comm_0187_001_view.jsp: Banking Deposit (usag_grp_cd 4) / Banking
 *  Withdrawal (usag_grp_cd 6) / Deleted Purpose. */
export type PurposeTab = "deposit" | "withdrawal" | "deleted";

type PurposeTabsProps = {
    active: PurposeTab;
    onChange: (tab: PurposeTab) => void;
    /** Disable tab switching while an unsaved Edit / Add session is open. */
    disabled?: boolean;
};

/**
 * Purpose tab strip — Figma 1353:33844. Banking Deposit / Banking
 * Withdrawal sit left of a vertical divider; the delete-marked
 * "Deleted Purpose" tab (trash glyph) sits to its right. The active
 * tab carries the black 2px bottom border.
 */
export default function PurposeTabs({ active, onChange, disabled }: PurposeTabsProps) {
    const { t } = useTranslation();

    const tab = (id: PurposeTab, label: string, icon?: React.ReactNode) => {
        const isActive = active === id;
        return (
            <button
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={disabled}
                onClick={() => !disabled && onChange(id)}
                className={cn(
                    "flex h-9 items-center justify-center gap-1 whitespace-nowrap text-wb-13",
                    isActive
                        ? "border-b-2 border-black font-semibold text-black"
                        : "font-medium text-wb-ink",
                    disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                )}
            >
                {icon}
                {label}
            </button>
        );
    };

    return (
        <div
            role="tablist"
            className="flex w-full items-center gap-5 border-b border-wb-table-border"
        >
            {tab("deposit", t("settings.purpose.tabs.deposit"))}
            {tab("withdrawal", t("settings.purpose.tabs.withdrawal"))}
            <span aria-hidden className="h-6 w-px bg-wb-table-border" />
            {tab(
                "deleted",
                t("settings.purpose.tabs.deleted"),
                <DeleteIcon className="size-4" />,
            )}
        </div>
    );
}
