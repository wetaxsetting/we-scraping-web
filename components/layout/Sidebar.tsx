"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import {
    FCY_ACCOUNTS,
    VND_ACCOUNTS,
    accountHref,
} from "@/components/banking/transaction-history/accounts";
import SidebarMenuItem from "@/components/layout/SidebarMenuItem";
import { userStorage } from "@/lib/auth/storage";
import { cn } from "@/lib/utils";

/**
 * Sidebar nav is defined declaratively so new routes plug in by adding an
 * `href`. Active state is derived from `usePathname()` — no prop drilling.
 * Items without an `href` render as disabled placeholders until the route
 * is implemented.
 *
 * Items may carry `children` — those render as an expandable nested list
 * under the parent. The parent row is an expand/collapse toggle (no
 * navigation); each child has its own `href`. A parent auto-opens when
 * any descendant matches the current path. See `NavItem` below.
 *
 * Groups are split per module: the active module is resolved from the URL
 * (`/banking/...` → banking rail, `/payment/...` → payment rail).
 */
type NavItem = {
    label: string;
    /** Leading icon (optional for nested child rows). */
    icon?: string;
    /** Route path. Omit for placeholder items that don't have a page yet. */
    href?: string;
    chevron?: boolean;
    /** Nested child rows — presence turns this row into an expand toggle. */
    children?: NavItem[];
    /** When true, this child auto-activates the first account on mount. */
    defaultOpen?: boolean;
};

type NavGroup = {
    title: string;
    badge?: "VND" | "FCY";
    badgeHidden?: boolean;
    items: NavItem[];
};

function accountsToChildren(
    scope: "VND" | "FCY",
): NavItem[] {
    const list = scope === "VND" ? VND_ACCOUNTS : FCY_ACCOUNTS;
    return list.map((a) => ({
        label: `${a.bankName} (${a.currency})`,
        href: accountHref(scope, a.id),
    }));
}

const bankingGroups: NavGroup[] = [
    {
        title: "Current & Savings",
        badge: "VND",
        items: [
            { label: "Account Inquiry", icon: "/assets/sidebar/ico-search.svg", href: "/banking/account-inquiry" },
            {
                label: "Transaction History",
                icon: "/assets/sidebar/ico-arrow.svg",
                href: "/banking/transaction-history",
                children: accountsToChildren("VND"),
            },
        ],
    },
    {
        title: "Current & Savings",
        badge: "FCY",
        items: [
            { label: "Account Inquiry", icon: "/assets/sidebar/ico-search.svg", href: "/banking/account-inquiry-fcy" },
            {
                label: "Transaction History",
                icon: "/assets/sidebar/ico-arrow.svg",
                href: "/banking/transaction-history-fcy",
                children: accountsToChildren("FCY"),
            },
        ],
    },
    {
        title: "Internal Transfer",
        badge: "VND",
        items: [
            { label: "Transfer Own Accounts", icon: "/assets/sidebar/ico-search.svg", href: "/banking/transfer-own-accounts" },
            { label: "Transfer History", icon: "/assets/sidebar/ico-arrow.svg", href: "/banking/transfer-history" },
        ],
    },
    {
        title: "Reports",
        badgeHidden: true,
        items: [
            { label: "Daily Cash", icon: "/assets/sidebar/ico-chart.svg", href: "/banking/reports/daily-cash" },
            // CMC Daily Financial — standard variant; live JEX rept_0015_001.act.
            { label: "Daily Financial", icon: "/assets/sidebar/ico-chart.svg", href: "/banking/reports/daily-financial" },
            // HAENGSUNG Daily Financial — customer-specific bank-grouped ledger
            // (Figma 9183:18510). See CLAUDE.md "Banking Report Sidebar Variants".
            { label: "Daily Financial (HS)", icon: "/assets/sidebar/ico-chart.svg", href: "/banking/reports/daily-financial-hs" },
            { label: "Cash Flow", icon: "/assets/sidebar/ico-chart.svg", href: "/banking/reports/cash-flow" },
        ],
    },
];

// Icon sources per Figma node 9189:5702 (Payment sidebar).
const paymentGroups: NavGroup[] = [
    {
        title: "Approval Management",
        badgeHidden: true,
        items: [
            { label: "Approval Box", icon: "/assets/sidebar/ico-check.svg", href: "/payment/approval-box" },
        ],
    },
    {
        title: "Internal Transfer",
        badge: "FCY",
        badgeHidden: true,
        items: [
            { label: "Scheduled Transfer", icon: "/assets/sidebar/ico-calendar.svg", href: "/payment/internal-transfer/scheduled-transfer" },
            { label: "Transfer Result", icon: "/assets/sidebar/ico-list.svg", href: "/payment/internal-transfer/transfer-result" },
        ],
    },
    {
        title: "Vendor Payment",
        badge: "FCY",
        badgeHidden: true,
        items: [
            { label: "Scheduled Payment", icon: "/assets/sidebar/ico-calendar.svg", href: "/payment/vendor-payment/scheduled-payment" },
            { label: "Payment Result", icon: "/assets/sidebar/ico-list.svg", href: "/payment/vendor-payment/payment-result" },
        ],
    },
    {
        title: "Expense Payment",
        badge: "FCY",
        badgeHidden: true,
        items: [
            { label: "Scheduled Payment", icon: "/assets/sidebar/ico-calendar.svg", href: "/payment/expense-payment/scheduled-payment" },
            { label: "Payment Result", icon: "/assets/sidebar/ico-list.svg", href: "/payment/expense-payment/payment-result" },
        ],
    },
    {
        title: "Payroll",
        badge: "FCY",
        badgeHidden: true,
        items: [
            { label: "Scheduled Payment", icon: "/assets/sidebar/ico-calendar.svg", href: "/payment/payroll/scheduled-payment" },
            { label: "Payment Result", icon: "/assets/sidebar/ico-list.svg", href: "/payment/payroll/payment-result" },
        ],
    },
    {
        title: "Overseas Payment",
        badge: "FCY",
        badgeHidden: true,
        items: [
            // Figma uses a document-history glyph for the Overseas flow.
            { label: "Scheduled Payment", icon: "/assets/sidebar/ico-doc-history.svg", href: "/payment/overseas-payment/scheduled-payment" },
            { label: "Payment Result", icon: "/assets/sidebar/ico-list-alt.svg", href: "/payment/overseas-payment/payment-result" },
            { label: "Exchange Rate Inquiry", icon: "/assets/sidebar/ico-arrow-swap.svg", href: "/payment/overseas-payment/exchange-rate-inquiry" },
        ],
    },
    {
        title: "Corporate Card",
        badge: "FCY",
        badgeHidden: true,
        items: [
            { label: "Card Transactions", icon: "/assets/sidebar/ico-arrow-card.svg", href: "/payment/corporate-card/card-transactions" },
        ],
    },
];

// Icon sources per Figma node 9194:6812 (Add-On Service sidebar).
// All three icons are 18×18 and rendered at `size-wb-icon-sm` to match the
// Banking/Payment rails. Paths were exported directly from the Figma frame.
const addonGroups: NavGroup[] = [
    {
        title: "e-invoices",
        badgeHidden: true,
        items: [
            {
                label: "Sales e-Invoices",
                icon: "/assets/sidebar/ico-einvoice-doc.svg",
                href: "/addon/sales-einvoices",
            },
            {
                label: "Expenses e-Invoices",
                icon: "/assets/sidebar/ico-einvoice-dollar.svg",
                href: "/addon/expenses-einvoices",
            },
        ],
    },
    {
        title: "Operation Status",
        badgeHidden: true,
        items: [
            {
                label: "Operation Status Inquiry",
                icon: "/assets/sidebar/ico-list.svg",
                href: "/addon/operation-status",
            },
        ],
    },
];

function resolveGroups(pathname: string): NavGroup[] {
    if (pathname.startsWith("/payment")) return paymentGroups;
    if (pathname.startsWith("/addon")) return addonGroups;
    return bankingGroups;
}

type SidebarProps = {
    /**
     * Explicit company name override. When omitted the sidebar hydrates from
     * the logged-in user's BUSI_INFM.CMPN_NM (captured at login and stored
     * in `userStorage`). Falls back to the app title "WeCMS" if neither
     * source is available — for example during preview mode or before the
     * client-side store rehydrates.
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
    const [storedCompany, setStoredCompany] = useState<string>("");

    // Hydrate the company name from the stored login response on mount.
    // localStorage is not available during SSR, so the first paint shows
    // the fallback and the real name appears on the client re-render.
    useEffect(() => {
        if (company !== undefined) return;
        const user = userStorage.get();
        if (user?.CMPN_NM) setStoredCompany(user.CMPN_NM);
    }, [company]);

    const companyLabel = company ?? (storedCompany || COMPANY_FALLBACK);
    const groups = resolveGroups(pathname);

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
            {/* Mobile backdrop — below lg only */}
            <div
                aria-hidden
                onClick={onClose}
                className={cn(
                    "fixed inset-0 top-[var(--h-wb-header)] z-20 bg-black/40 transition-opacity lg:hidden",
                    open ? "opacity-100" : "pointer-events-none opacity-0",
                )}
            />

            <aside
                className={cn(
                    "z-20 flex w-[var(--w-wb-sidebar)] shrink-0 flex-col border-r border-wb-border-sidebar bg-wb-bg-sidebar py-2.5 font-inter",
                    // Mobile/Tablet: fixed drawer, slide in/out
                    "fixed inset-y-0 left-0 top-[var(--h-wb-header)] transform transition-transform duration-200",
                    open ? "translate-x-0" : "-translate-x-full",
                    // Desktop/Laptop (lg+): persistent rail
                    "lg:sticky lg:top-[var(--h-wb-header)] lg:h-[calc(100vh-var(--h-wb-header))] lg:translate-x-0",
                )}
            >
                {/* Company section */}
                <div className="flex w-full flex-col items-start justify-center border-b border-wb-border-sidebar pb-2.5">
                    <div className="flex w-full items-start gap-2 px-4 py-2">
                        <div
                            className="size-[var(--size-wb-icon-sm)] shrink-0 rounded-sm bg-wb-ntrl-4"
                            aria-hidden
                        />
                        <p className="text-wb-13 font-semibold leading-none text-wb-ink">
                            {companyLabel}
                        </p>
                    </div>
                </div>

                {/* Nav groups */}
                <div className="custom-scrollbar-y flex flex-col items-start gap-4 overflow-y-auto pt-2">
                    {groups.map((group, gi) => (
                        <div
                            key={`${group.title}-${gi}`}
                            className="flex w-full flex-col items-start p-1"
                        >
                            {/* Group header */}
                            <div className="flex w-full items-center gap-1 px-2.5 pb-2">
                                <p className="text-wb-11 font-medium uppercase text-black/70">
                                    {group.title}
                                </p>
                                {group.badge && (
                                    <span
                                        className={cn(
                                            "flex items-center justify-center rounded-sm border border-wb-ntrl-4 bg-wb-ntrl-3 px-1",
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
                               future Add-on / Settings) uses identical icon
                               size, typography, spacing and state styling.
                               Items with `children` expand into a nested
                               account list underneath (see `renderItem`). */}
                            {group.items.map((item) =>
                                renderItem({
                                    group,
                                    item,
                                    pathname,
                                    isOpen,
                                    toggle,
                                    onClose,
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
}: {
    group: NavGroup;
    item: NavItem;
    pathname: string;
    isOpen: (k: string) => boolean;
    toggle: (k: string, wasOpen: boolean) => void;
    onClose?: () => void;
}) {
    // Expandable parent — render the toggle row, then the nested children
    // list when open. The parent row itself never navigates even if `href`
    // is set; `href` is retained only so breadcrumb / default-redirect code
    // can point at it.
    if (item.children && item.children.length > 0) {
        const key = itemKey(group, item);
        const open = isOpen(key);
        const branchActive = isBranchActive(item, pathname);
        return (
            <div key={item.label} className="flex w-full flex-col">
                <SidebarMenuItem
                    label={item.label}
                    icon={item.icon}
                    expandable
                    isExpanded={open}
                    onToggle={() => toggle(key, open)}
                    active={branchActive && !open}
                />
                {open && (
                    <div className="flex w-full flex-col">
                        {item.children.map((child) => (
                            <SidebarMenuItem
                                key={child.label}
                                label={child.label}
                                icon={child.icon}
                                href={child.href}
                                active={
                                    !!child.href && pathname === child.href
                                }
                                indent
                                onClick={onClose}
                            />
                        ))}
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
            label={item.label}
            icon={item.icon}
            href={item.href}
            active={leafActive}
            chevron={item.chevron}
            onClick={onClose}
        />
    );
}
