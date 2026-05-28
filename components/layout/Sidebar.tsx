"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import {
    accountHref,
    useTransactionHistoryAccounts,
    type TransactionAccount,
} from "@/components/banking/transaction-history/accounts";
import SidebarMenuItem from "@/components/layout/SidebarMenuItem";
import { topMenuItems } from "@/components/layout/topMenu";
import { useSettingsModal } from "@/components/settings/SettingsModalProvider";
import { isProductType } from "@/lib/auth/client";
import { userStorage, type StoredUser } from "@/lib/auth/storage";
import { useTranslation } from "@/lib/i18n";
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
    /** Translation key for the visible label. Falls back to `label` when absent (e.g. dynamic account children). */
    labelKey?: string;
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
    /** Translation key for the group heading. Falls back to `title` when absent. */
    titleKey?: string;
    badge?: "VND" | "FCY";
    badgeHidden?: boolean;
    items: NavItem[];
};

function accountsToChildren(
    scope: "VND" | "FCY",
    list: TransactionAccount[],
): NavItem[] {
    // Match the legacy JEX sidebar (`inc_wabook_fnsh_lnb.jsp`) by
    // rendering the saved nickname verbatim. The parent group badge
    // (`VND` / `FCY`) already shows the scope, so we don't suffix
    // `(${currency})` — that duplication was what pushed long labels
    // (e.g. "Vietin Bank 4853 (VND)") past the rail width and produced
    // the mid-token truncation reported in the legacy parity audit.
    return list.map((a) => ({
        label: a.nickname,
        href: accountHref(scope, a.id),
    }));
}

/**
 * Build the Banking sidebar groups using live accounts hydrated from
 * `/api/v1/banking/accounts`. Pure function — kept outside the
 * component so the children lists are stable references between
 * renders when the input arrays haven't changed.
 */
function buildBankingGroups(
    vndAccounts: TransactionAccount[],
    fcyAccounts: TransactionAccount[],
    showDailyFinancialHs: boolean,
): NavGroup[] {
    return [
    {
        title: "Current & Savings",
        titleKey: "sidebar.banking.currentSavingsVnd",
        badge: "VND",
        items: [
            { label: "Account Inquiry", labelKey: "sidebar.banking.accountInquiry", icon: "/assets/sidebar/ico-search.svg", href: "/banking/account-inquiry" },
            {
                label: "Transaction History",
                labelKey: "sidebar.banking.transactionHistory",
                icon: "/assets/sidebar/ico-arrow.svg",
                href: "/banking/transaction-history",
                children: accountsToChildren("VND", vndAccounts),
            },
        ],
    },
    {
        title: "Current & Savings",
        titleKey: "sidebar.banking.currentSavingsFcy",
        badge: "FCY",
        items: [
            { label: "Account Inquiry", labelKey: "sidebar.banking.accountInquiry", icon: "/assets/sidebar/ico-search.svg", href: "/banking/account-inquiry-fcy" },
            {
                label: "Transaction History",
                labelKey: "sidebar.banking.transactionHistory",
                icon: "/assets/sidebar/ico-arrow.svg",
                href: "/banking/transaction-history-fcy",
                children: accountsToChildren("FCY", fcyAccounts),
            },
        ],
    },
    {
        title: "Internal Transfer",
        titleKey: "sidebar.banking.internalTransfer",
        badge: "VND",
        items: [
            { label: "Own Account Transfer", labelKey: "sidebar.banking.ownAccountTransfer", icon: "/assets/sidebar/ico-search.svg", href: "/banking/own-account-transfer" },
            { label: "Transfer History", labelKey: "sidebar.banking.transferHistory", icon: "/assets/sidebar/ico-arrow.svg", href: "/banking/transfer-history" },
        ],
    },
    {
        title: "Reports",
        titleKey: "sidebar.banking.reports",
        badgeHidden: true,
        items: [
            { label: "Daily Cash", labelKey: "sidebar.banking.dailyCash", icon: "/assets/sidebar/ico-chart.svg", href: "/banking/reports/daily-cash" },
            // CMC Daily Financial — standard variant; live JEX rept_0015_001.act.
            { label: "Daily Financial", labelKey: "sidebar.banking.dailyFinancial", icon: "/assets/sidebar/ico-chart.svg", href: "/banking/reports/daily-financial" },
            // HAENGSUNG Daily Financial — customer-specific bank-grouped ledger
            // (Figma 9183:18510). Only rendered for tenants with
            // BUSI_INFM.PRDT_TYPE = "H"; see CLAUDE.md
            // "Banking Report Sidebar Variants".
            ...(showDailyFinancialHs
                ? [{ label: "Daily Financial (HS)", labelKey: "sidebar.banking.dailyFinancialHs", icon: "/assets/sidebar/ico-chart.svg", href: "/banking/reports/daily-financial-hs" } satisfies NavItem]
                : []),
            { label: "Cash Flow", labelKey: "sidebar.banking.cashFlow", icon: "/assets/sidebar/ico-chart.svg", href: "/banking/reports/cash-flow" },
        ],
    },
    ];
}

// Icon sources per Figma node 9189:5702 (Payment sidebar).
const paymentGroups: NavGroup[] = [
    {
        title: "Approval Management",
        titleKey: "sidebar.payment.approvalManagement",
        badgeHidden: true,
        items: [
            { label: "Approval Box", labelKey: "sidebar.payment.approvalBox", icon: "/assets/sidebar/ico-check.svg", href: "/payment/approval-box" },
        ],
    },
    {
        title: "Internal Transfer",
        titleKey: "sidebar.payment.internalTransfer",
        badge: "FCY",
        badgeHidden: true,
        items: [
            { label: "Scheduled Transfer", labelKey: "sidebar.payment.scheduledTransfer", icon: "/assets/sidebar/ico-calendar.svg", href: "/payment/internal-transfer/scheduled-transfer" },
            { label: "Transfer Result", labelKey: "sidebar.payment.transferResult", icon: "/assets/sidebar/ico-list.svg", href: "/payment/internal-transfer/transfer-result" },
        ],
    },
    {
        title: "Vendor Payment",
        titleKey: "sidebar.payment.vendorPayment",
        badge: "FCY",
        badgeHidden: true,
        items: [
            { label: "Scheduled Payment", labelKey: "sidebar.payment.scheduledPayment", icon: "/assets/sidebar/ico-calendar.svg", href: "/payment/vendor-payment/scheduled-payment" },
            { label: "Payment Result", labelKey: "sidebar.payment.paymentResult", icon: "/assets/sidebar/ico-list.svg", href: "/payment/vendor-payment/payment-result" },
        ],
    },
    {
        title: "Expense Payment",
        titleKey: "sidebar.payment.expensePayment",
        badge: "FCY",
        badgeHidden: true,
        items: [
            { label: "Scheduled Payment", labelKey: "sidebar.payment.scheduledPayment", icon: "/assets/sidebar/ico-calendar.svg", href: "/payment/expense-payment/scheduled-payment" },
            { label: "Payment Result", labelKey: "sidebar.payment.paymentResult", icon: "/assets/sidebar/ico-list.svg", href: "/payment/expense-payment/payment-result" },
        ],
    },
    {
        title: "Payroll",
        titleKey: "sidebar.payment.payroll",
        badge: "FCY",
        badgeHidden: true,
        items: [
            { label: "Scheduled Payment", labelKey: "sidebar.payment.scheduledPayment", icon: "/assets/sidebar/ico-calendar.svg", href: "/payment/payroll/scheduled-payment" },
            { label: "Payment Result", labelKey: "sidebar.payment.paymentResult", icon: "/assets/sidebar/ico-list.svg", href: "/payment/payroll/payment-result" },
        ],
    },
    {
        title: "Overseas Payment",
        titleKey: "sidebar.payment.overseasPayment",
        badge: "FCY",
        badgeHidden: true,
        items: [
            // Figma uses a document-history glyph for the Overseas flow.
            { label: "Scheduled Payment", labelKey: "sidebar.payment.scheduledPayment", icon: "/assets/sidebar/ico-doc-history.svg", href: "/payment/overseas-payment/scheduled-payment" },
            { label: "Payment Result", labelKey: "sidebar.payment.paymentResult", icon: "/assets/sidebar/ico-list-alt.svg", href: "/payment/overseas-payment/payment-result" },
            { label: "Exchange Rate Inquiry", labelKey: "sidebar.payment.exchangeRateInquiry", icon: "/assets/sidebar/ico-arrow-swap.svg", href: "/payment/overseas-payment/exchange-rate-inquiry" },
        ],
    },
    {
        title: "Corporate Card",
        titleKey: "sidebar.payment.corporateCard",
        badge: "FCY",
        badgeHidden: true,
        items: [
            { label: "Card Transactions", labelKey: "sidebar.payment.cardTransactions", icon: "/assets/sidebar/ico-arrow-card.svg", href: "/payment/corporate-card/card-transactions" },
        ],
    },
];

// Icon sources per Figma node 9194:6812 (Add-On Service sidebar).
// All three icons are 18×18 and rendered at `size-wb-icon-sm` to match the
// Banking/Payment rails. Paths were exported directly from the Figma frame.
const addonGroups: NavGroup[] = [
    {
        title: "e-invoices",
        titleKey: "sidebar.addon.eInvoices",
        badgeHidden: true,
        items: [
            {
                label: "Sales e-Invoices",
                labelKey: "sidebar.addon.salesEInvoices",
                icon: "/assets/sidebar/ico-einvoice-doc.svg",
                href: "/addon/sales-einvoices",
            },
            {
                label: "Expenses e-Invoices",
                labelKey: "sidebar.addon.expensesEInvoices",
                icon: "/assets/sidebar/ico-einvoice-dollar.svg",
                href: "/addon/expenses-einvoices",
            },
        ],
    },
    {
        title: "Operation Status",
        titleKey: "sidebar.addon.operationStatus",
        badgeHidden: true,
        items: [
            {
                label: "Operation Status Inquiry",
                labelKey: "sidebar.addon.operationStatusInquiry",
                icon: "/assets/sidebar/ico-list.svg",
                href: "/addon/operation-status",
            },
        ],
    },
];

function resolveGroups(
    pathname: string,
    bankingGroups: NavGroup[],
): NavGroup[] {
    if (pathname.startsWith("/payment")) return paymentGroups;
    if (pathname.startsWith("/addon")) return addonGroups;
    return bankingGroups;
}

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
    const [storedCompany, setStoredCompany] = useState<string>("");
    const [storedUser, setStoredUser] = useState<StoredUser | null>(null);

    // Hydrate the company name + active-user profile from the stored
    // login response on mount. localStorage is not available during SSR,
    // so the first paint shows the fallback and the real name appears on
    // the client re-render. The user profile drives product-type-aware
    // sidebar items (e.g. Daily Financial (HS) only for PRDT_TYPE = "H").
    useEffect(() => {
        const user = userStorage.get();
        setStoredUser(user);
        if (company === undefined && user?.companyName) {
            setStoredCompany(user.companyName);
        }
    }, [company]);

    const companyLabel = company ?? (storedCompany || COMPANY_FALLBACK);

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
    const showDailyFinancialHs = isProductType(storedUser, "H");
    const bankingGroups = useMemo(
        () => buildBankingGroups(vndState.accounts, fcyState.accounts, showDailyFinancialHs),
        [vndState.accounts, fcyState.accounts, showDailyFinancialHs],
    );

    const groups = resolveGroups(pathname, bankingGroups);

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
                        {topMenuItems.map(({ key, labelKey, ActiveIcon, href, activePrefix }) => {
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
                            {/* Group header */}
                            <div className="flex w-full items-center gap-1 px-2.5 pb-2">
                                <p className="text-wb-11 font-medium uppercase text-black/70">
                                    {group.titleKey ? t(group.titleKey) : group.title}
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
    if (item.children && item.children.length > 0) {
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
                    <div className="flex w-full flex-col">
                        {item.children.map((child) => (
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
            label={item.labelKey ? t(item.labelKey) : item.label}
            icon={item.icon}
            href={item.href}
            active={leafActive}
            chevron={item.chevron}
            onClick={onClose}
        />
    );
}
