"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { useTransactionHistoryAccounts } from "@/components/banking/transaction-history/accounts";
import SidebarMenuItem from "@/components/layout/SidebarMenuItem";
import {
    buildSidebarGroupsFromTree,
    type NavGroup,
    type NavItem,
} from "@/components/layout/sidebarNav";
import { useSettingsModal } from "@/components/settings/SettingsModalProvider";
import { useNavigation } from "@/hooks/useNavigation";
import { useTopMenuItems } from "@/hooks/useTopMenuItems";
import { userStorage, type StoredUser } from "@/lib/auth/storage";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Sidebar structure comes from the resolved navigation tree
 * (`GET /api/v1/navigation`, via {@link useNavigation}) — the backend selects
 * the product tree from the session's `prdt_type` and returns it already
 * intersected with the user's `USER_MENU_AUTH_INFM` grants (admins get the
 * full product tree). The sidebar therefore renders the response as-is; the
 * permission `∩` lives on the backend and `lib/menuAuth.ts` is unchanged
 * (still used by the mobile module switcher below + the route guards).
 *
 * {@link buildSidebarGroupsFromTree} maps the tree → render model and keeps
 * presentation (i18n label key, icon asset, VND/FCY badge) in the frontend so
 * the look is unchanged from the previous hardcoded rails.
 *
 * Active state is derived from `usePathname()`. Items may carry `children`
 * (Transaction History's live account list) — those render as an expandable
 * nested list; the parent row is a toggle, each child has its own `href` and
 * auto-expands when the URL matches a descendant.
 */

type SidebarProps = {
    /**
     * Explicit company name override. When omitted the sidebar hydrates from
     * the logged-in user's `companyName` (captured at login from
     * `BUSI_INFM.CMPN_NM` and stored in `userStorage`). Falls back to the
     * app title "WeCMS" if neither source is available — for example during
     * preview mode or before the client-side store rehydrates.
     */
    company?: string;
    open?: boolean;
    onClose?: () => void;
};

const COMPANY_FALLBACK = "WeCMS";

/**
 * True when `pathname` matches `item.href` exactly, or — for items with
 * children — when it matches the `href` of any descendant. Used to keep a
 * parent visibly "on the same branch" while a child is selected and to
 * auto-expand the parent group when the user lands on a child URL.
 */
function isBranchActive(item: NavItem, pathname: string): boolean {
    if (item.href && pathname === item.href) return true;
    if (item.href && pathname.startsWith(item.href + "/")) return true;
    if (!item.children) return false;
    return item.children.some((c) => isBranchActive(c, pathname));
}

export default function Sidebar({
    company,
    open = false,
    onClose,
}: SidebarProps) {
    const pathname = usePathname();
    const { t } = useTranslation();
    const settingsModal = useSettingsModal();

    // Active-user profile from the stored login response, read once via a lazy
    // initializer (same idiom as `Header`). `userStorage.get()` guards SSR
    // (returns null on the server). The profile drives the mobile MENU module
    // switcher's section filter; the per-module groups are product-resolved
    // server-side, so they no longer need the product type here.
    const [storedUser] = useState<StoredUser | null>(() => userStorage.get());

    const companyLabel = company ?? (storedUser?.companyName || COMPANY_FALLBACK);

    // Live account lists for the Banking sidebar's Transaction History
    // group. Both scopes fetch independently from
    // `/api/v1/banking/accounts?currency=…`; while the request is in
    // flight the children list renders empty (the parent row still
    // toggles). When the user lands on a deep-linked
    // `/banking/transaction-history/{acctSeqNo}` URL the children
    // populate on first response and the matching child highlights
    // automatically via `isBranchActive`.
    const vndState = useTransactionHistoryAccounts("VND");
    const fcyState = useTransactionHistoryAccounts("FCY");

    // Resolved navigation tree (product tree ∩ grants, from the backend).
    // Fetched once per session by the hook; route changes reuse the cache.
    const nav = useNavigation();

    const groups = useMemo(
        () =>
            buildSidebarGroupsFromTree(nav.tree, pathname, {
                vnd: vndState.accounts,
                fcy: fcyState.accounts,
            }),
        [nav.tree, pathname, vndState.accounts, fcyState.accounts],
    );

    // Mobile drawer MENU section mirrors the top nav — driven by the same
    // resolved navigation tree as the desktop `<Header>` (Phase 3, via the
    // shared `useTopMenuItems` hook) so module visibility stays in lockstep.
    const visibleTopMenuItems = useTopMenuItems(storedUser);

    // Which expandable parents are currently open. An item is identified by
    // its label + route-scope to avoid collisions across VND/FCY twins. The
    // default open-set includes every parent whose branch matches the URL,
    // so navigating to `/banking/transaction-history/woori-2308` lands with
    // the FCY Transaction History group already expanded.
    const autoOpenKeys = useMemo(() => {
        const keys = new Set<string>();
        for (const group of groups) {
            for (const item of group.items) {
                if (item.children && isBranchActive(item, pathname)) {
                    keys.add(itemKey(group, item));
                }
            }
        }
        return keys;
    }, [groups, pathname]);

    const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({});

    function toggle(key: string, wasOpen: boolean) {
        setUserOverrides((prev) => ({ ...prev, [key]: !wasOpen }));
    }

    function isOpen(key: string): boolean {
        if (key in userOverrides) return userOverrides[key];
        return autoOpenKeys.has(key);
    }

    return (
        <>
            {/* Mobile backdrop — below lg only.
               z-30 sits above all page content (sticky table headers cap at
               z-10) and below the drawer itself at z-40. Header is z-30 too,
               but the backdrop's `top: var(--h-wb-header)` means it never
               visually overlaps the header. */}
            <div
                aria-hidden
                onClick={onClose}
                className={cn(
                    "fixed inset-0 top-[var(--h-wb-header)] z-30 bg-black/40 transition-opacity lg:hidden",
                    open ? "opacity-100" : "pointer-events-none opacity-0",
                )}
            />

            <aside
                className={cn(
                    // `overflow-x-hidden` clamps the rail to its 211px width on
                    // every breakpoint — guards against a long submenu label
                    // (e.g. "Daily Financial (HS)") pushing horizontally past
                    // the drawer edge on a narrow mobile viewport.
                    //
                    // z-40 keeps the drawer above every page-content element —
                    // sticky table headers (z-10) and the mobile backdrop
                    // (z-30) both stay underneath. Dialogs/popovers at z-50
                    // remain on top.
                    "z-40 flex w-[var(--w-wb-sidebar)] shrink-0 flex-col overflow-x-hidden border-r border-wb-border-sidebar bg-wb-bg-sidebar py-2.5 font-inter",
                    // Mobile/Tablet: fixed drawer, slide in/out
                    "fixed inset-y-0 left-0 top-[var(--h-wb-header)] transform transition-transform duration-200",
                    open ? "translate-x-0" : "-translate-x-full",
                    // Desktop/Laptop (lg+): persistent rail
                    "lg:sticky lg:top-[var(--h-wb-header)] lg:h-[calc(100vh-var(--h-wb-header))] lg:translate-x-0",
                )}
            >
                {/* Company section — Figma 60:20692 (mobile drawer) places an
                   X close button on the right of the company name, only in
                   drawer mode. The desktop rail (lg+) hides it via `lg:hidden`. */}
                <div className="flex w-full flex-col items-start justify-center border-b border-wb-border-sidebar pb-2.5">
                    <div className="flex w-full items-center gap-2 px-4 py-2">
                        <div
                            className="size-[var(--size-wb-icon-sm)] shrink-0 rounded-sm bg-wb-ntrl-4"
                            aria-hidden
                        />
                        <p className="flex-1 break-words text-wb-13 font-semibold leading-tight text-wb-ink">
                            {companyLabel}
                        </p>
                        <button
                            type="button"
                            aria-label={t("nav.close_menu")}
                            onClick={onClose}
                            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-wb-ink hover:bg-black/5 lg:hidden"
                        >
                            <X className="size-4" strokeWidth={2} />
                        </button>
                    </div>
                </div>

                {/* Nav groups — `flex-1 min-h-0` lets this region absorb the
                   space below the company header and lets `overflow-y-auto`
                   actually scroll instead of pushing past the drawer edge.
                   Without those two utilities the bottom Reports group would
                   get clipped on a < 768px viewport once Banking submenus are
                   expanded. `overflow-x-hidden` and `pb-3` are belt-and-braces
                   guards against any horizontal escape and visual flush at
                   the bottom edge respectively. */}
                <div className="custom-scrollbar-y flex min-h-0 flex-1 flex-col items-start gap-4 overflow-y-auto overflow-x-hidden pt-2 pb-3">
                    {/* MENU group — drawer-only (lg:hidden). Mirrors the top-nav
                       module list (Banking / Payment / Add-on / Settings) so a
                       narrow viewport can still navigate between modules without
                       a top-nav bar. Source: Figma 60:20692 (mobile < 767). */}
                    <div className="flex w-full flex-col items-start p-1 lg:hidden">
                        <div className="flex w-full items-center gap-1 px-2.5 pb-2">
                            <p className="text-wb-11 font-medium uppercase text-black/70">
                                {t("nav.menu")}
                            </p>
                        </div>
                        {visibleTopMenuItems.map(({ key, labelKey, ActiveIcon, href, activePrefix }) => {
                            const isSettings = key === "settings";
                            const prefix = activePrefix ?? href;
                            const isActive =
                                !!prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`));
                            // Always render the Active variant — Header
                            // inactive icons use `fill="white"` (designed for
                            // the blue header bar) and would be invisible on
                            // the white drawer. The active variant uses
                            // BRAND (#0069B9) outlines + gold accents which
                            // read correctly on white. Row selection is
                            // conveyed by the standard `bg-wb-bg-active` tint
                            // and `text-brand` label, not the icon swap.
                            const node = <ActiveIcon className="size-5" />;
                            if (isSettings) {
                                return (
                                    <SidebarMenuItem
                                        key={key}
                                        label={t(labelKey)}
                                        iconNode={node}
                                        active={isActive}
                                        onClick={() => {
                                            onClose?.();
                                            settingsModal.open();
                                        }}
                                    />
                                );
                            }
                            return (
                                <SidebarMenuItem
                                    key={key}
                                    label={t(labelKey)}
                                    iconNode={node}
                                    href={href}
                                    active={isActive}
                                    onClick={onClose}
                                />
                            );
                        })}
                    </div>

                    {groups.map((group, gi) => (
                        <div
                            key={`${group.title}-${gi}`}
                            className="flex w-full flex-col items-start p-1"
                        >
                            {/* Group header — `min-w-0 truncate` keeps a long
                               group title (e.g. "THANH TOÁN & TIẾT KIỆM") on a
                               single line with an ellipsis instead of wrapping.
                               No `flex-1`, so the title only claims the space it
                               needs and the VND/FCY badge stays adjacent (short
                               titles are unchanged); the badge's `shrink-0`
                               guards it against the title's shrink. */}
                            <div className="flex w-full items-center gap-1 px-2.5 pb-2">
                                <p className="min-w-0 truncate text-wb-11 font-medium uppercase text-black/70">
                                    {group.titleKey ? t(group.titleKey) : group.title}
                                </p>
                                {group.badge && (
                                    <span
                                        className={cn(
                                            "flex shrink-0 items-center justify-center rounded-sm border border-wb-ntrl-4 bg-wb-ntrl-3 px-1",
                                            group.badgeHidden && "opacity-0",
                                        )}
                                    >
                                        <span className="text-wb-10 font-medium uppercase text-black/70">
                                            {group.badge}
                                        </span>
                                    </span>
                                )}
                            </div>

                            {/* Group items — rendered through the shared
                               SidebarMenuItem so every rail (Banking, Payment,
                               Add-on) uses identical icon size, typography,
                               spacing and state styling. Items with `children`
                               expand into a nested account list underneath
                               (see `renderItem`). */}
                            {group.items.map((item) =>
                                renderItem({
                                    group,
                                    item,
                                    pathname,
                                    isOpen,
                                    toggle,
                                    onClose,
                                    t,
                                }),
                            )}
                        </div>
                    ))}
                </div>
            </aside>
        </>
    );
}

function itemKey(group: NavGroup, item: NavItem): string {
    return `${group.title}:${group.badge ?? ""}:${item.label}`;
}

function renderItem({
    group,
    item,
    pathname,
    isOpen,
    toggle,
    onClose,
    t,
}: {
    group: NavGroup;
    item: NavItem;
    pathname: string;
    isOpen: (k: string) => boolean;
    toggle: (k: string, wasOpen: boolean) => void;
    onClose?: () => void;
    t: (key: string) => string;
}) {
    // Expandable parent — render the toggle row, then the nested children
    // list when open. The parent row itself never navigates even if `href`
    // is set; `href` is retained only so breadcrumb / default-redirect code
    // can point at it.
    //
    // `accountList` items (Transaction History VND/FCY) are ALWAYS toggles,
    // even with zero children — legacy parity: they show "No data available"
    // and never navigate. Without the `item.accountList` clause an empty
    // account list would fall through to the leaf `<Link>` branch below and
    // navigate to `/banking/transaction-history` (the bug this fixes).
    const hasChildren = !!item.children && item.children.length > 0;
    if (item.children && (hasChildren || item.accountList)) {
        const key = itemKey(group, item);
        const open = isOpen(key);
        const branchActive = isBranchActive(item, pathname);
        return (
            <div key={item.label} className="flex w-full flex-col">
                <SidebarMenuItem
                    label={item.labelKey ? t(item.labelKey) : item.label}
                    icon={item.icon}
                    expandable
                    isExpanded={open}
                    onToggle={() => toggle(key, open)}
                    active={branchActive && !open}
                />
                {open && (
                    <div
                        className={cn(
                            "flex w-full flex-col",
                            // Transaction History account list: cap at ~5 rows
                            // and scroll when there are more, matching legacy
                            // `inc_wabook_fnsh_lnb.jsp`'s fixed-height account
                            // scroll box. `max-h` (not a fixed height) lets a
                            // list of 5 or fewer render at its natural height
                            // with no scrollbar; a 6th+ row triggers the scroll.
                            // Generic nested menus render their (short) child
                            // list uncapped.
                            item.accountList &&
                                "custom-scrollbar-y max-h-[var(--h-wb-sidebar-acct-list)] overflow-y-auto",
                        )}
                    >
                        {hasChildren ? (
                            item.children.map((child) => (
                                <SidebarMenuItem
                                    // Use `href` (built from the unique
                                    // `acct_seq_no` slug = BANK_CD_ACCT_NO)
                                    // as the React key, not the display label —
                                    // saved nicknames (`ACCT_NICK_NM`) can repeat
                                    // across accounts (e.g. all rows nicknamed
                                    // with the company name) and would collide.
                                    key={child.href ?? child.label}
                                    label={child.label}
                                    icon={child.icon}
                                    href={child.href}
                                    active={
                                        !!child.href && pathname === child.href
                                    }
                                    indent
                                    onClick={onClose}
                                />
                            ))
                        ) : (
                            // Empty account list — non-interactive placeholder,
                            // indented to align under the account rows. Mirrors
                            // legacy `<li>No data available</li>`.
                            <SidebarMenuItem
                                label={t("sidebar.no_data_available")}
                                indent
                            />
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Leaf items stay active on their own sub-routes — e.g. the Payment
    // > Vendor Payment > Scheduled Payment row remains highlighted on
    // `/payment/vendor-payment/scheduled-payment/{id}` detail pages.
    // CLAUDE.md "Payment Detail Page Rules" depends on this prefix match.
    const leafActive =
        !!item.href &&
        (pathname === item.href || pathname.startsWith(item.href + "/"));

    return (
        <SidebarMenuItem
            key={item.label}
            label={item.labelKey ? t(item.labelKey) : item.label}
            icon={item.icon}
            href={item.href}
            active={leafActive}
            chevron={item.chevron}
            onClick={onClose}
        />
    );
}
