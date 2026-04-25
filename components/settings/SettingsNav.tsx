"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { SettingsPanelKey } from "./types";

type NavItem = {
    key: SettingsPanelKey;
    labelKey: string;
    /** Icon used in expanded sidebar and as the default collapsed icon. */
    icon: string;
    /**
     * Icon used in collapsed (icon-only) mode when Figma specifies a
     * different shape. Falls back to `icon` if omitted.
     * VAS Account is the only case where the shapes differ between states.
     */
    collapsedIcon?: string;
};

type NavGroup = {
    labelKey?: string;
    items: NavItem[];
};

/** Groups rendered at the top of the sidebar. */
const TOP_GROUPS: NavGroup[] = [
    {
        items: [
            { key: "purpose", labelKey: "settings.nav.purpose", icon: "/assets/settings/ico-purpose.svg" },
            {
                key: "vas_account", labelKey: "settings.nav.vas_account",
                icon: "/assets/settings/ico-vas-account.svg",
                // Figma collapsed sidebar uses ico_box (3D cube) instead of ico_list bullet variant
                collapsedIcon: "/assets/settings/ico-vas-account-box.svg",
            },
            { key: "contacts", labelKey: "settings.nav.contacts", icon: "/assets/settings/ico-contacts.svg" },
            { key: "approval_line", labelKey: "settings.nav.approval_line", icon: "/assets/settings/ico-approval-line.svg" },
            { key: "chart_of_accounts", labelKey: "settings.nav.chart_of_accounts", icon: "/assets/settings/ico-chart-of-accounts.svg" },
        ],
    },
    {
        items: [
            { key: "login_credentials", labelKey: "settings.nav.login_credentials", icon: "/assets/settings/ico-login-credentials.svg" },
            { key: "bank_account", labelKey: "settings.nav.bank_account", icon: "/assets/settings/ico-bank-account.svg" },
            { key: "preferences", labelKey: "settings.nav.preferences", icon: "/assets/settings/ico-preferences.svg" },
            { key: "user", labelKey: "settings.nav.user", icon: "/assets/settings/ico-user.svg" },
        ],
    },
];

/**
 * Groups pinned to the bottom in both expanded and collapsed views.
 * Figma: bottom section is `shrink-0` and the container uses `justify-between`
 * so these items always sit at the card bottom regardless of the top group height.
 */
const BOTTOM_GROUPS: NavGroup[] = [
    {
        labelKey: "settings.nav.group.erp",
        items: [
            { key: "transaction_history", labelKey: "settings.nav.transaction_history", icon: "/assets/settings/ico-transaction-history.svg" },
        ],
    },
    {
        labelKey: "settings.nav.group.firm_banking",
        items: [
            { key: "firm_banking_setting", labelKey: "settings.nav.firm_banking_setting", icon: "/assets/settings/ico-firm-banking-setting.svg" },
            { key: "firm_banking_history", labelKey: "settings.nav.firm_banking_history", icon: "/assets/settings/ico-firm-banking-history.svg" },
        ],
    },
];

/** Flat list of all bottom items for collapsed rendering. */
const BOTTOM_ITEMS: NavItem[] = BOTTOM_GROUPS.flatMap((g) => g.items);

type SettingsNavProps = {
    active: SettingsPanelKey;
    onChange: (key: SettingsPanelKey) => void;
    title?: string;
};

// ─────────────────────────────────────────────────────────────
// Collapsed sidebar — Figma node 9601:23161
//
// Layout: flex-col, justify-between, items-center, full height, 65px wide
//   TOP: header (hamburger, 48px) + 1px divider + group1 (5 items, gap-px)
//        + 1px divider + group2 (4 items, gap-px)
//   BOTTOM: 3 items (gap-px)
//   FLOATING: right-pointing chevron pill at left-56 top-15
//
// Every icon cell: h-48 w-52, items-center justify-center, rounded-6
// Active cell: bg-wb-bg-active (e3e3e3)
// Dividers: h-px w-full bg-wb-border-sidebar (no extra margin)
// ─────────────────────────────────────────────────────────────
function CollapsedCell({
    item,
    active,
    onChange,
    t,
}: {
    item: NavItem;
    active: SettingsPanelKey;
    onChange: (key: SettingsPanelKey) => void;
    t: (k: string) => string;
}) {
    const isActive = item.key === active;
    return (
        <button
            type="button"
            onClick={() => onChange(item.key)}
            title={t(item.labelKey)}
            aria-label={t(item.labelKey)}
            className={cn(
                "flex h-12 w-[52px] cursor-pointer items-center justify-center rounded-md transition-colors",
                isActive ? "bg-wb-bg-active" : "hover:bg-black/5",
            )}
            aria-current={isActive ? "page" : undefined}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={item.collapsedIcon ?? item.icon}
                alt=""
                aria-hidden
                className="size-[var(--size-wb-icon-sm)]"
            />
        </button>
    );
}

function CollapsedDivider() {
    return <div className="h-px w-full bg-wb-border-sidebar" />;
}

function CollapsedSidebar({
    active,
    onChange,
    onToggle,
    t,
}: {
    active: SettingsPanelKey;
    onChange: (key: SettingsPanelKey) => void;
    onToggle: () => void;
    t: (k: string) => string;
}) {
    return (
        <nav
            className="relative flex h-full shrink-0 flex-col items-center justify-between border-r border-wb-ntrl-4 bg-wb-bg-sidebar"
            style={{
                width: "var(--w-wb-settings-nav-collapsed)",
                minWidth: "var(--w-wb-settings-nav-collapsed)",
                maxWidth: "var(--w-wb-settings-nav-collapsed)",
            }}
        >
            {/* Expand pill — absolute at right edge, pointing right (→).
               Figma: left-[56px] top-[15px] (same as right-edge of 65px rail). */}
            <button
                type="button"
                onClick={onToggle}
                aria-label={t("settings.title")}
                className="absolute left-[56px] top-[15px] z-10 flex size-[18px] cursor-pointer items-center justify-center rounded-full bg-white text-wb-ink shadow-[0_0_0_1px_rgba(0,0,0,0.12),_0_1px_1px_0_rgba(0,0,0,0.15)] hover:bg-wb-bg-sidebar"
            >
                <ChevronRight className="size-3" strokeWidth={2.25} />
            </button>

            {/* ── TOP section ── */}
            <div className="flex w-full flex-col items-center gap-1.5">
                {/* Header row — hamburger icon at 48px height (Figma matches) */}
                <div className="flex h-12 w-[52px] items-center justify-center rounded-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/settings/ico-hamburger.svg" alt="" aria-hidden className="size-[var(--size-wb-icon-sm)]" />
                </div>

                <CollapsedDivider />

                {/* Group 1 — 5 items, gap-px */}
                <div className="flex w-full flex-col items-center" style={{ gap: "1px" }}>
                    {TOP_GROUPS[0].items.map((item) => (
                        <CollapsedCell key={item.key} item={item} active={active} onChange={onChange} t={t} />
                    ))}
                </div>

                <CollapsedDivider />

                {/* Group 2 — 4 items, gap-px */}
                <div className="flex w-full flex-col items-center" style={{ gap: "1px" }}>
                    {TOP_GROUPS[1].items.map((item) => (
                        <CollapsedCell key={item.key} item={item} active={active} onChange={onChange} t={t} />
                    ))}
                </div>
            </div>

            {/* ── BOTTOM section — pinned via justify-between ── */}
            <div className="flex w-full flex-col items-center" style={{ gap: "1px" }}>
                {BOTTOM_ITEMS.map((item) => (
                    <CollapsedCell key={item.key} item={item} active={active} onChange={onChange} t={t} />
                ))}
            </div>
        </nav>
    );
}

// ─────────────────────────────────────────────────────────────
// Expanded sidebar — Figma node 9198:12533
//
// Layout: flex-col, 211px wide
//   Header: px-5 pt-4 pb-2 → "Setting" title  16/600
//   Scroll area: flex-1, overflow-y-auto, px-2
//     Inner col: flex-col, min-h-full
//       TOP_GROUPS (with border-top between groups)
//       flex-1 spacer
//       BOTTOM_GROUPS (ERP, Firm Banking) with section labels
//   Floating back-chevron pill: right-[-9px] top-[14px], pointing left (←)
// ─────────────────────────────────────────────────────────────
function ExpandedGroupBlock({
    group,
    active,
    onChange,
    showDivider,
    t,
}: {
    group: NavGroup;
    active: SettingsPanelKey;
    onChange: (key: SettingsPanelKey) => void;
    showDivider: boolean;
    t: (k: string) => string;
}) {
    return (
        <div className={showDivider ? "border-t border-wb-border-sidebar pt-[10px]" : "pt-[10px]"}>
            {group.labelKey && (
                <span className="block px-2.5 py-1.5 text-wb-12 font-medium text-wb-ntrl-6">
                    {t(group.labelKey)}
                </span>
            )}
            <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
                    const isActive = item.key === active;
                    return (
                        <li key={item.key}>
                            <button
                                type="button"
                                onClick={() => onChange(item.key)}
                                className={cn(
                                    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-wb-13 font-medium text-wb-ink transition-colors",
                                    isActive ? "bg-wb-bg-active" : "hover:bg-black/5",
                                )}
                                aria-current={isActive ? "page" : undefined}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.icon} alt="" aria-hidden className="size-[var(--size-wb-icon-sm)] shrink-0" />
                                <span className="truncate">{t(item.labelKey)}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function ExpandedSidebar({
    active,
    onChange,
    onToggle,
    title,
    t,
}: {
    active: SettingsPanelKey;
    onChange: (key: SettingsPanelKey) => void;
    onToggle: () => void;
    title?: string;
    t: (k: string) => string;
}) {
    return (
        <nav
            className="relative flex h-full shrink-0 flex-col border-r border-wb-ntrl-4 bg-wb-bg-sidebar"
            style={{
                width: "var(--w-wb-settings-nav)",
                minWidth: "var(--w-wb-settings-nav)",
                maxWidth: "var(--w-wb-settings-nav)",
            }}
        >
            {/* Header */}
            <div className="flex shrink-0 items-center px-5 pt-4 pb-2">
                <h2 className="text-wb-16 font-semibold tracking-wb-tight text-black">
                    {title ?? t("settings.title")}
                </h2>
            </div>

            {/* Collapse pill — astride the sidebar right edge, pointing left (←). */}
            <button
                type="button"
                onClick={onToggle}
                aria-label={t("settings.back")}
                className="absolute right-[-9px] top-[14px] z-10 flex size-[18px] cursor-pointer items-center justify-center rounded-full bg-white text-wb-ink shadow-[0_0_0_1px_rgba(0,0,0,0.12),_0_1px_1px_0_rgba(0,0,0,0.15)] hover:bg-wb-bg-sidebar"
            >
                <ChevronLeft className="size-3" strokeWidth={2.25} />
            </button>

            {/* Scroll area */}
            <div className="custom-scrollbar flex-1 overflow-y-auto px-2">
                <div className="flex min-h-full flex-col pb-3">

                    {/* Top groups */}
                    {TOP_GROUPS.map((group, gi) => (
                        <ExpandedGroupBlock
                            key={gi}
                            group={group}
                            active={active}
                            onChange={onChange}
                            showDivider={gi > 0}
                            t={t}
                        />
                    ))}

                    {/* Flex spacer — the "Auto" gap in Figma; pushes bottom groups down. */}
                    <div className="flex-1" />

                    {/* Bottom groups (ERP + Firm Banking) */}
                    {BOTTOM_GROUPS.map((group, gi) => (
                        <ExpandedGroupBlock
                            key={gi}
                            group={group}
                            active={active}
                            onChange={onChange}
                            showDivider={true}
                            t={t}
                        />
                    ))}

                </div>
            </div>
        </nav>
    );
}

/**
 * Setting popup side-nav — manages expand/collapse state locally.
 *
 * Clicking the chevron pill toggles the rail width between 211px (expanded)
 * and 65px (collapsed). This does NOT close the modal. Each state renders
 * a completely separate sub-component because the Figma specs (9198:12533
 * expanded, 9601:23161 collapsed) differ in structure, not just styling:
 *   - Expanded: 30px rows, icon+text, section labels, flex-1 spacer
 *   - Collapsed: 48px cells, icons only, hamburger header, 1px dividers,
 *                justify-between to pin bottom icons
 */
export default function SettingsNav({
    active,
    onChange,
    title,
}: SettingsNavProps) {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);

    const toggle = () => setCollapsed((v) => !v);

    if (collapsed) {
        return <CollapsedSidebar active={active} onChange={onChange} onToggle={toggle} t={t} />;
    }
    return <ExpandedSidebar active={active} onChange={onChange} onToggle={toggle} title={title} t={t} />;
}
