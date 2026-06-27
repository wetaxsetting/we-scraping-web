import {
    accountHref,
    type TransactionAccount,
} from "@/components/banking/transaction-history/accounts";
import type { MenuNode, NavigationTree } from "@/lib/api/navigation";

/**
 * Sidebar structure is sourced from the resolved navigation tree
 * (`GET /api/v1/navigation`) — already product-scoped and permission-filtered
 * by the backend. This module maps that tree into the sidebar's render model
 * (`NavGroup[]`), keeping **presentation** (i18n label key, icon asset, VND/FCY
 * badge) in the frontend, keyed by stable menu-item id so the look matches the
 * previous hardcoded rails exactly.
 *
 * Why a presentation registry instead of the API's `label` / `icon`:
 *  - the API `label` is resolved server-side from the JWT language and would
 *    not follow the client-side language toggle; the frontend keeps `labelKey`
 *    → `locales/{en,ko,vi}.json` so the toggle still works.
 *  - the API `icon` is the legacy export hint (e.g. `acc-inq`), not an asset
 *    path; the registry maps to the existing `/assets/sidebar/*.svg` icons.
 *
 * Structure, ordering (by `seq`), routes, and visibility all come from the API.
 */

export type NavItem = {
    label: string;
    /** Translation key for the visible label. Falls back to `label` when absent. */
    labelKey?: string;
    /** Leading icon (optional for nested child rows). */
    icon?: string;
    /** Route path. Omit for placeholder items that don't have a page yet. */
    href?: string;
    chevron?: boolean;
    /** Nested child rows — presence turns this row into an expand toggle. */
    children?: NavItem[];
    /**
     * Marks an account-list parent (Transaction History VND/FCY) that is
     * ALWAYS an accordion toggle — never a navigation link — even when its
     * `children` list is empty. Legacy parity: `inc_wabook_fnsh_lnb.jsp`
     * renders Transaction History as a `data-bs-toggle="collapse"` accordion
     * that shows "No data available" when the account list is empty and never
     * navigates. Without this flag an empty-children item degrades into a
     * `<Link>` (the bug this fixes).
     */
    accountList?: boolean;
    /** When true, this child auto-activates the first account on mount. */
    defaultOpen?: boolean;
};

export type NavGroup = {
    title: string;
    /** Translation key for the group heading. Falls back to `title` when absent. */
    titleKey?: string;
    badge?: "VND" | "FCY";
    badgeHidden?: boolean;
    items: NavItem[];
};

const ICON = {
    search: "/assets/sidebar/ico-search.svg",
    arrow: "/assets/sidebar/ico-arrow.svg",
    chart: "/assets/sidebar/ico-chart.svg",
    check: "/assets/sidebar/ico-check.svg",
    calendar: "/assets/sidebar/ico-calendar.svg",
    list: "/assets/sidebar/ico-list.svg",
    listAlt: "/assets/sidebar/ico-list-alt.svg",
    docHistory: "/assets/sidebar/ico-doc-history.svg",
    arrowSwap: "/assets/sidebar/ico-arrow-swap.svg",
    arrowCard: "/assets/sidebar/ico-arrow-card.svg",
    einvoiceDoc: "/assets/sidebar/ico-einvoice-doc.svg",
    einvoiceDollar: "/assets/sidebar/ico-einvoice-dollar.svg",
} as const;

/** Depth-0 module root id per URL prefix (matches the legacy `resolveGroups`). */
function moduleIdForPath(pathname: string): string {
    if (pathname.startsWith("/payment")) return "payment";
    if (pathname.startsWith("/addon")) return "addon-service";
    return "banking";
}

/** Group-node presentation, keyed by menu-item id (depth-1 nodes). */
const GROUP_PRESENTATION: Record<string, Pick<NavGroup, "titleKey" | "badge" | "badgeHidden">> = {
    "banking-current-savings-vnd": { titleKey: "sidebar.banking.currentSavingsVnd", badge: "VND" },
    "banking-current-savings-fcy": { titleKey: "sidebar.banking.currentSavingsFcy", badge: "FCY" },
    "banking-internal-transfer-vnd": { titleKey: "sidebar.banking.internalTransfer", badge: "VND" },
    "banking-reports": { titleKey: "sidebar.banking.reports", badgeHidden: true },
    "payment-approval": { titleKey: "sidebar.payment.approvalManagement", badgeHidden: true },
    "payment-internal-transfer": { titleKey: "sidebar.payment.internalTransfer", badgeHidden: true },
    "payment-vendor": { titleKey: "sidebar.payment.vendorPayment", badgeHidden: true },
    "payment-expense": { titleKey: "sidebar.payment.expensePayment", badgeHidden: true },
    "payment-payroll": { titleKey: "sidebar.payment.payroll", badgeHidden: true },
    "payment-overseas": { titleKey: "sidebar.payment.overseasPayment", badgeHidden: true },
    "payment-corporate-card": { titleKey: "sidebar.payment.corporateCard", badgeHidden: true },
    "addon-einvoice": { titleKey: "sidebar.addon.eInvoices", badgeHidden: true },
    "addon-operation-status": { titleKey: "sidebar.addon.operationStatus", badgeHidden: true },
};

/** Leaf-node presentation, keyed by menu-item id (depth-2 nodes). */
const LEAF_PRESENTATION: Record<string, { labelKey: string; icon: string }> = {
    "banking-account-inquiry-vnd": { labelKey: "sidebar.banking.accountInquiry", icon: ICON.search },
    "banking-transaction-history-vnd": { labelKey: "sidebar.banking.transactionHistory", icon: ICON.arrow },
    "banking-account-inquiry-fcy": { labelKey: "sidebar.banking.accountInquiry", icon: ICON.search },
    "banking-transaction-history-fcy": { labelKey: "sidebar.banking.transactionHistory", icon: ICON.arrow },
    "banking-transfer-own-accounts": { labelKey: "sidebar.banking.ownAccountTransfer", icon: ICON.search },
    "banking-transfer-history": { labelKey: "sidebar.banking.transferHistory", icon: ICON.arrow },
    "banking-report-daily-cash": { labelKey: "sidebar.banking.dailyCash", icon: ICON.chart },
    "banking-report-daily-financial": { labelKey: "sidebar.banking.dailyFinancial", icon: ICON.chart },
    "banking-report-daily-financial-haengsung": { labelKey: "sidebar.banking.dailyFinancialHs", icon: ICON.chart },
    "banking-report-cash-flow": { labelKey: "sidebar.banking.cashFlow", icon: ICON.chart },
    "payment-approval-box": { labelKey: "sidebar.payment.approvalBox", icon: ICON.check },
    "payment-scheduled-transfer": { labelKey: "sidebar.payment.scheduledTransfer", icon: ICON.calendar },
    "payment-transfer-result": { labelKey: "sidebar.payment.transferResult", icon: ICON.list },
    "payment-vendor-scheduled": { labelKey: "sidebar.payment.scheduledPayment", icon: ICON.calendar },
    "payment-vendor-result": { labelKey: "sidebar.payment.paymentResult", icon: ICON.list },
    "payment-expense-scheduled": { labelKey: "sidebar.payment.scheduledPayment", icon: ICON.calendar },
    "payment-expense-result": { labelKey: "sidebar.payment.paymentResult", icon: ICON.list },
    "payment-payroll-scheduled": { labelKey: "sidebar.payment.scheduledPayment", icon: ICON.calendar },
    "payment-payroll-result": { labelKey: "sidebar.payment.paymentResult", icon: ICON.list },
    "payment-overseas-request": { labelKey: "sidebar.payment.scheduledPayment", icon: ICON.docHistory },
    "payment-overseas-result": { labelKey: "sidebar.payment.paymentResult", icon: ICON.listAlt },
    "payment-exchange-rate": { labelKey: "sidebar.payment.exchangeRateInquiry", icon: ICON.arrowSwap },
    "payment-card-transactions": { labelKey: "sidebar.payment.cardTransactions", icon: ICON.arrowCard },
    "addon-sales-einvoice": { labelKey: "sidebar.addon.salesEInvoices", icon: ICON.einvoiceDoc },
    "addon-expense-einvoice": { labelKey: "sidebar.addon.expensesEInvoices", icon: ICON.einvoiceDollar },
    "addon-operation-status-inquiry": { labelKey: "sidebar.addon.operationStatusInquiry", icon: ICON.list },
};

/** Live-account leaves whose children are injected from `/banking/accounts`. */
const TX_HISTORY_VND_ID = "banking-transaction-history-vnd";
const TX_HISTORY_FCY_ID = "banking-transaction-history-fcy";

function accountsToChildren(scope: "VND" | "FCY", list: TransactionAccount[]): NavItem[] {
    // Render the saved nickname verbatim — the parent group badge already
    // conveys the scope, so we don't suffix `(VND)` (legacy parity with
    // `inc_wabook_fnsh_lnb.jsp`; avoids the long-label truncation the audit
    // flagged).
    return list.map((a) => ({ label: a.nickname, href: accountHref(scope, a.id) }));
}

type LiveAccounts = { vnd: TransactionAccount[]; fcy: TransactionAccount[] };

function toNavItem(leaf: MenuNode, accounts: LiveAccounts): NavItem {
    const pres = LEAF_PRESENTATION[leaf.id];
    const isTxHistory = leaf.id === TX_HISTORY_VND_ID || leaf.id === TX_HISTORY_FCY_ID;
    const item: NavItem = {
        label: leaf.label,
        labelKey: pres?.labelKey,
        icon: pres?.icon,
        // Transaction History is an account-list accordion, NOT a navigable
        // page — it must never carry an `href` (legacy `javascript:void(0)` +
        // `data-bs-toggle="collapse"`). Dropping the route here is what stops
        // the empty-account state from degrading into a `<Link>` that
        // navigates to `/banking/transaction-history`. The per-account child
        // rows carry the real `href` (built from `acct_seq_no`).
        href: isTxHistory ? undefined : (leaf.route ?? undefined),
    };
    // Inject live Transaction History account children (the API leaf carries
    // no children — accounts come from `/api/v1/banking/accounts`). The
    // `accountList` flag keeps the row an accordion toggle even when the
    // injected list is empty, so it shows "No data available" instead of
    // navigating.
    if (leaf.id === TX_HISTORY_VND_ID) {
        item.accountList = true;
        item.children = accountsToChildren("VND", accounts.vnd);
    }
    if (leaf.id === TX_HISTORY_FCY_ID) {
        item.accountList = true;
        item.children = accountsToChildren("FCY", accounts.fcy);
    }
    return item;
}

/**
 * Build the sidebar groups for the active module from the resolved tree.
 * Returns `[]` when the tree is unavailable (loading / error) or the active
 * module has no menu for this product (e.g. Add-on under H) — the caller then
 * renders an empty rail safely.
 */
export function buildSidebarGroupsFromTree(
    tree: NavigationTree | null,
    pathname: string,
    accounts: LiveAccounts,
): NavGroup[] {
    if (!tree) return [];
    const moduleId = moduleIdForPath(pathname);
    const root = tree.topMenus.find((n) => n.id === moduleId);
    if (!root) return [];

    return root.children
        .map((groupNode): NavGroup => {
            const pres = GROUP_PRESENTATION[groupNode.id];
            return {
                title: groupNode.label,
                titleKey: pres?.titleKey,
                badge: pres?.badge,
                badgeHidden: pres?.badgeHidden,
                items: groupNode.children.map((leaf) => toNavItem(leaf, accounts)),
            };
        })
        .filter((g) => g.items.length > 0);
}
