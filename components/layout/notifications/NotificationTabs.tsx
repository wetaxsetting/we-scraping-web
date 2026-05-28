"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { NotificationTab } from "./types";

/*
 * Unread / All tab strip — Figma node 12346:43825.
 * Active tab is bold with a short underline beneath the label; switching is
 * purely client-side state (no API filtering yet).
 */
const TABS: { id: NotificationTab; labelKey: string }[] = [
    { id: "unread", labelKey: "notification.tab.unread" },
    { id: "all", labelKey: "notification.tab.all" },
];

type NotificationTabsProps = {
    value: NotificationTab;
    onChange: (tab: NotificationTab) => void;
};

export default function NotificationTabs({ value, onChange }: NotificationTabsProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-[30px]">
            {TABS.map((tab) => {
                const active = tab.id === value;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        aria-pressed={active}
                        className={cn(
                            "relative cursor-pointer pb-1 text-wb-13 leading-normal tracking-wb-tight transition-colors",
                            active ? "font-bold text-wb-ink" : "font-medium text-wb-ink/60 hover:text-wb-ink",
                        )}
                    >
                        {t(tab.labelKey)}
                        <span
                            aria-hidden
                            className={cn(
                                "absolute inset-x-0 -bottom-[11px] h-0.5 rounded-full bg-wb-ink transition-opacity",
                                active ? "opacity-100" : "opacity-0",
                            )}
                        />
                    </button>
                );
            })}
        </div>
    );
}
