"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { userStorage } from "@/lib/auth/storage";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { SettingsPanelKey } from "./types";

/**
 * Phase 4 — Settings navigation source.
 *
 * Settings (`comm_0180_001`) is a **modal/GNB item, not a product-tree node**:
 * `GET /api/v1/navigation` returns only Banking / Payment / Add-on (the
 * `MENU_ITEM` / `PRODUCT_MENU` seed has no Settings rows), and Settings is
 * **product-invariant** (identical for F / M / H). So the Settings panel
 * STRUCTURE has no representation in the navigation API and stays this
 * frontend registry (`TOP_GROUPS` / `BOTTOM_GROUPS` below) — analogous to the
 * Banking/Payment/Add-on presentation registries the sidebar uses.
 *
 * What IS navigation-driven is **visibility**: each panel is gated by the
 * session's `allowedMenuCds` (the `settings-*` grants from
 * `USER_MENU_AUTH_INFM`, surfaced on `/auth/me`), admin bypass via `allMenus`.
 * Phase 4 wires that permission set from the **shared session store**
 * (`userStorage`) — the same source the navigation-driven Header / Sidebar
 * read (Phases 2-3) — so the component is self-sufficient and consistent
 * with them. `lib/menuAuth.ts` is unchanged.
 */

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

type SettingsNavProps = {
    active: SettingsPanelKey;
    onChange: (key: SettingsPanelKey) => void;
    title?: string;
    /**
     * MENU-1: admin bypass for Settings-panel filtering. Optional **override** —
     * when omitted, the value is read from the shared session store
     * (`userStorage`), consistent with the navigation-driven Header / Sidebar
     * (Phase 4). Pass explicitly only for preview / tests. `true` shows every
     * panel; `false` filters by {@link allowedMenuCds}.
     */
    allMenus?: boolean;
    /** MENU-1: granted leaf slugs from `USER_MENU_AUTH_INFM` (the `settings-*`
     *  ones gate the Settings panels). Optional **override** — defaults to the
     *  session's `allowedMenuCds` when omitted (see {@link allMenus}). */
    allowedMenuCds?: string[];
};

/**
 * MENU-1: Settings panel → entitlement leaf slug. A panel is shown to a
 * normal user only when its slug is granted. Every Settings panel MUST be
 * mapped here — an unmapped panel is hidden for non-admins (secure
 * default, see {@link panelVisible}). The {@code user} panel is now
 * permission-driven for **visibility** via {@code settings-core-users}
 * (revised SEC-1): a non-admin granted it can OPEN Users read-only.
 * Whether the panel is full-edit or read-only is decided separately by
 * the admin role inside {@code UsersPanel} / {@code SettingsModal}; this
 * map governs visibility only.
 */
const SETTINGS_PANEL_MENU_CD: Partial<Record<SettingsPanelKey, string>> = {
    purpose:               "settings-core-purpose",
    vas_account:           "settings-core-vas-account",
    contacts:              "settings-core-contacts",
    approval_line:         "settings-core-approval-line",
    chart_of_accounts:     "settings-core-chart-of-accounts",
    login_credentials:     "settings-core-login-credentials",
    bank_account:          "settings-core-bank-account",
    preferences:           "settings-core-preference",
    user:                  "settings-core-users",
    transaction_history:   "settings-erp-transaction-history",
    firm_banking_setting:  "settings-firm-banking-settings",
    firm_banking_history:  "settings-firm-banking-history",
};

/** Is a Settings panel visible for the given grants? (admin bypass;
 *  unmapped ⇒ hidden). Exported so the modal can land on a panel the
 *  user can actually see. */
export function isSettingsPanelVisible(
    key: SettingsPanelKey,
    allMenus: boolean,
    allowedMenuCds: string[],
): boolean {
    if (allMenus) return true;                       // admin bypass
    const slug = SETTINGS_PANEL_MENU_CD[key];
    // Secure default: an unmapped panel is HIDDEN for a non-admin (never
    // fallback-visible). A panel is shown only when its mapped slug is
    // explicitly granted.
    return slug ? allowedMenuCds.includes(slug) : false;
}

function panelVisible(item: NavItem, allMenus: boolean, allowedMenuCds: string[]): boolean {
    return isSettingsPanelVisible(item.key, allMenus, allowedMenuCds);
}

/** Ordered panel keys (top groups, then bottom groups). */
const ALL_PANEL_KEYS: SettingsPanelKey[] =
    [...TOP_GROUPS, ...BOTTOM_GROUPS].flatMap((g) => g.items.map((i) => i.key));

/** First panel the user may see, in nav order — used to open the modal on
 *  a visible panel (a viewer with only `settings-core-users` lands on
 *  Users, not a hidden default). Null when nothing is visible. */
export function firstVisibleSettingsPanel(
    allMenus: boolean,
    allowedMenuCds: string[],
): SettingsPanelKey | null {
    return ALL_PANEL_KEYS.find((k) => isSettingsPanelVisible(k, allMenus, allowedMenuCds)) ?? null;
}

/** Filter items within each group (MENU-1 entitlement). Group structure
 *  is preserved (items only) so the collapsed rail's positional
 *  `topGroups[0]/[1]` indexing stays valid. */
function filterPanelGroups(
    groups: NavGroup[],
    allMenus: boolean,
    allowedMenuCds: string[],
): NavGroup[] {
    return groups.map((g) => ({
        ...g,
        items: g.items.filter((i) => panelVisible(i, allMenus, allowedMenuCds)),
    }));
}

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
    hideToggle = false,
    topGroups,
    bottomGroups,
    t,
}: {
    active: SettingsPanelKey;
    onChange: (key: SettingsPanelKey) => void;
    onToggle: () => void;
    /**
     * Hide the expand chevron pill. Set on mobile (< 768px) where the
     * full-text sidebar would not fit inside the modal card and would
     * crowd out the active panel.
     */
    hideToggle?: boolean;
    /** Top + bottom groups after SEC-1 / MENU-1 filtering. */
    topGroups: NavGroup[];
    bottomGroups: NavGroup[];
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
               Figma: left-[56px] top-[15px] (same as right-edge of 65px rail).
               Hidden on mobile because the expanded 211px rail would not fit
               inside the modal card on a < 768px viewport. */}
            {!hideToggle && (
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={t("settings.title")}
                    className="absolute left-[56px] top-[15px] z-10 flex size-[18px] cursor-pointer items-center justify-center rounded-full bg-white text-wb-ink shadow-[0_0_0_1px_rgba(0,0,0,0.12),_0_1px_1px_0_rgba(0,0,0,0.15)] hover:bg-wb-bg-sidebar"
                >
                    <ChevronRight className="size-3" strokeWidth={2.25} />
                </button>
            )}

            {/* ── TOP section ── */}
            <div className="flex w-full flex-col items-center gap-1.5">
                {/* Header row — hamburger icon at 48px height (Figma matches) */}
                <div className="flex h-12 w-[52px] items-center justify-center rounded-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/settings/ico-hamburger.svg" alt="" aria-hidden className="size-[var(--size-wb-icon-sm)]" />
                </div>

                <CollapsedDivider />

                {/* Group 1 — gap-px */}
                <div className="flex w-full flex-col items-center" style={{ gap: "1px" }}>
                    {topGroups[0].items.map((item) => (
                        <CollapsedCell key={item.key} item={item} active={active} onChange={onChange} t={t} />
                    ))}
                </div>

                <CollapsedDivider />

                {/* Group 2 — gap-px (User entry omitted for non-admins, SEC-1) */}
                <div className="flex w-full flex-col items-center" style={{ gap: "1px" }}>
                    {topGroups[1].items.map((item) => (
                        <CollapsedCell key={item.key} item={item} active={active} onChange={onChange} t={t} />
                    ))}
                </div>
            </div>

            {/* ── BOTTOM section — pinned via justify-between ── */}
            <div className="flex w-full flex-col items-center" style={{ gap: "1px" }}>
                {bottomGroups.flatMap((g) => g.items).map((item) => (
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
    topGroups,
    bottomGroups,
    t,
}: {
    active: SettingsPanelKey;
    onChange: (key: SettingsPanelKey) => void;
    onToggle: () => void;
    title?: string;
    /** Top + bottom groups after SEC-1 / MENU-1 filtering. */
    topGroups: NavGroup[];
    bottomGroups: NavGroup[];
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
                <h2 className="text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
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

                    {/* Top groups (User entry omitted for non-admins, SEC-1;
                       panels filtered by MENU-1). Empty groups dropped so a
                       filtered-out group leaves no orphan divider. */}
                    {topGroups.filter((g) => g.items.length > 0).map((group, gi) => (
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

                    {/* Bottom groups (ERP + Firm Banking) — MENU-1 filtered */}
                    {bottomGroups.filter((g) => g.items.length > 0).map((group, gi) => (
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
 *
 * Responsive behaviour: viewports < 768px always render the collapsed
 * (icon-only) rail and the expand chevron is suppressed — the 211px rail
 * would crowd out the panel inside a mobile-sized modal card. ≥ 768px keeps
 * the user-controlled toggle (default expanded).
 */
export default function SettingsNav({
    active,
    onChange,
    title,
    allMenus: allMenusProp,
    allowedMenuCds: allowedMenuCdsProp,
}: SettingsNavProps) {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Permission source: explicit props win (preview / tests); otherwise read
    // the shared session store once at mount — same idiom as Header / Sidebar
    // (Phases 2-3). A null session (preview / no login) yields no grants, so
    // the panels filter down to nothing, matching the prior behavior.
    const [sessionUser] = useState(() => userStorage.get());
    const allMenus = allMenusProp ?? !!sessionUser?.allMenus;
    const allowedMenuCds = allowedMenuCdsProp ?? sessionUser?.allowedMenuCds ?? [];

    const topGroups = filterPanelGroups(TOP_GROUPS, allMenus, allowedMenuCds);
    const bottomGroups = filterPanelGroups(BOTTOM_GROUPS, allMenus, allowedMenuCds);

    // Tailwind `md` breakpoint (= 768px). Below that the modal is too narrow
    // to host the expanded text rail alongside readable panel content.
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 767px)");
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);

    const toggle = () => setCollapsed((v) => !v);

    if (isMobile || collapsed) {
        return (
            <CollapsedSidebar
                active={active}
                onChange={onChange}
                onToggle={toggle}
                hideToggle={isMobile}
                topGroups={topGroups}
                bottomGroups={bottomGroups}
                t={t}
            />
        );
    }
    return <ExpandedSidebar active={active} onChange={onChange} onToggle={toggle} title={title} topGroups={topGroups} bottomGroups={bottomGroups} t={t} />;
}
