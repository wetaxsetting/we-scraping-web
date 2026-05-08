"use client";

import { useTranslation } from "@/lib/i18n";

import MenuEntitlementRow from "./MenuEntitlementRow";
import MenuEntitlementSection from "./MenuEntitlementSection";
import { ENTITLEMENT_SECTIONS } from "./mockMenuEntitlements";
import type { SettingsUser } from "./types";

type UserMenuEntitlementPanelProps = {
    /** Currently used only for the aria-label so screen readers know
     *  whose entitlements are on screen. The static UI doesn't read any
     *  per-user state — every selected user shows the same blank tree.
     *  Optional so the same panel can render in add-user mode (no
     *  selected user yet) without forcing a placeholder. */
    user?: SettingsUser;
};

/**
 * Menu Entitlement detail body — Figma 142:22279.
 *
 * Three-column grid: [category 220 px] · [item label 1 fr] · [checkbox auto].
 * The grid is shared across the top "Allow full menu access" row, every
 * section header (Banking / Payment / Add-on Service / Settings), and
 * every group's sub-item rows — so all checkboxes line up in one
 * vertical column on the right edge regardless of nesting depth.
 *
 * Only the panel body scrolls (`custom-scrollbar-y overflow-y-auto`) so
 * the modal's tabs row + Esc/X stay pinned while the user scans through
 * the long permission list. Static UI: every checkbox is rendered
 * `disabled` until the edit-mode flow + real `MENU_AUTH_M` write API
 * lands.
 */
export default function UserMenuEntitlementPanel({ user }: UserMenuEntitlementPanelProps) {
    const { t } = useTranslation();
    return (
        <div
            className="custom-scrollbar-y flex min-h-0 flex-1 flex-col overflow-y-auto p-6"
            aria-label={
                user
                    ? t("settings.users.menu.aria_panel", { name: user.name })
                    : t("settings.users.menu.aria_panel_new")
            }
        >
            <div className="grid w-full grid-cols-[220px_1fr_auto]">
                <MenuEntitlementRow label={t("settings.users.menu.allow_full_access")} />
                {ENTITLEMENT_SECTIONS.map((section) => (
                    <MenuEntitlementSection key={section.id} section={section} />
                ))}
            </div>
        </div>
    );
}
