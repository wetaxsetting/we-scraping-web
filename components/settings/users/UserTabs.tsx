"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

import type { UserDetailTabKey } from "./types";

type UserTabsProps = {
    activeTab: UserDetailTabKey;
    onChange: (tab: UserDetailTabKey) => void;
    /** Hides the Menu Entitlement tab — used when an Admin user is
     *  selected (admins implicitly have full access, so the per-menu
     *  permission tree doesn't apply per Figma 5300:31189). */
    hideMenuEntitlement?: boolean;
};

const ALL_TABS: { key: UserDetailTabKey; labelKey: string }[] = [
    { key: "info", labelKey: "settings.users.tabs.info" },
    { key: "menu_entitlement", labelKey: "settings.users.tabs.menu_entitlement" },
];

/**
 * Tab strip on the Users detail panel — Figma 142:23379.
 *
 * Two tabs: Info (default active) + Menu Entitlement. Active state uses
 * the brand-softer pill background (`#ddecf8`) + brand-active text colour
 * (`#0069b9`); inactive tabs sit at `text-wb-dark` until clicked.
 *
 * `hideMenuEntitlement` filters the second tab out — admins get full
 * menu access by definition so the entitlement tree is omitted for
 * them. The parent owns the active-tab state and is responsible for
 * keeping `activeTab !== "menu_entitlement"` while the flag is on.
 */
export default function UserTabs({
    activeTab,
    onChange,
    hideMenuEntitlement = false,
}: UserTabsProps) {
    const { t } = useTranslation();
    const tabs = hideMenuEntitlement
        ? ALL_TABS.filter((tab) => tab.key !== "menu_entitlement")
        : ALL_TABS;
    return (
        <div className="flex items-center gap-1.5">
            {tabs.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => onChange(tab.key)}
                        className={cn(
                            "flex cursor-pointer items-center gap-1 rounded-md p-2 text-wb-13 font-medium tracking-wb-tight transition-colors",
                            isActive
                                ? "bg-brand-softer text-brand-active"
                                : "text-wb-dark hover:bg-black/5",
                        )}
                        aria-current={isActive ? "page" : undefined}
                    >
                        {t(tab.labelKey)}
                    </button>
                );
            })}
        </div>
    );
}
