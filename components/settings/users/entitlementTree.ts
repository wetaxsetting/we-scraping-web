import type { ComponentType, SVGAttributes } from "react";
import {
    CircleDollarSign,
    Landmark,
    Scissors,
    Settings as SettingsIcon,
} from "lucide-react";

import type { MenuNode, NavigationTree } from "@/lib/api/navigation";

/**
 * Menu Entitlement permission universe — Phase 5.
 *
 * The grantable menu set is sourced from the resolved product navigation tree
 * (`GET /api/v1/navigation`): an admin loads the **full product tree** (admin
 * bypass), so its leaves are exactly the menus a user in that tenant may be
 * granted. Because the tree is product-scoped server-side, an H tenant's tree
 * has no Add-on Service section and no Daily Cash / Cash Flow / e-Invoice
 * leaves — so an H admin can neither see nor grant them, automatically.
 *
 * Settings (`comm_0180_001`) is NOT in the navigation product tree (it's a
 * modal/GNB item) and is product-invariant, so its grantable panels stay a
 * frontend registry here — exactly the Phase-4 decision for `SettingsNav`.
 *
 * Item ids are the kebab `permission_cd` values (the grant keys written to
 * `USER_MENU_AUTH_INFM` and matched against the loaded `menu_auth_cds`). The
 * label keys / icons below are presentation only (i18n + lucide), keyed by the
 * stable navigation node id / permission_cd so the look matches the previous
 * static tree exactly. `lib/menuAuth.ts` is unchanged.
 */

export type EntitlementIcon = ComponentType<SVGAttributes<SVGSVGElement>>;

export type EntitlementItem = {
    /** Permission code (grant key) — written to / read from USER_MENU_AUTH_INFM. */
    id: string;
    labelKey: string;
};

export type EntitlementGroup = {
    id: string;
    /** Translation key for the left-column group label. */
    categoryKey: string;
    items: EntitlementItem[];
};

export type EntitlementSection = {
    id: string;
    labelKey: string;
    Icon: EntitlementIcon;
    groups: EntitlementGroup[];
};

/** Navigation top-menu node id → entitlement section presentation. */
const SECTION_PRESENTATION: Record<
    string,
    { id: string; labelKey: string; Icon: EntitlementIcon }
> = {
    banking: { id: "banking", labelKey: "settings.users.menu.section.banking", Icon: Landmark },
    payment: { id: "payment", labelKey: "settings.users.menu.section.payment", Icon: CircleDollarSign },
    "addon-service": { id: "addon", labelKey: "settings.users.menu.section.addon", Icon: Scissors },
};

/** Navigation group node id → entitlement category label key. */
const GROUP_LABEL_KEY: Record<string, string> = {
    "banking-current-savings-vnd": "settings.users.menu.banking.current_savings_vnd",
    "banking-current-savings-fcy": "settings.users.menu.banking.current_savings_fcy",
    "banking-internal-transfer-vnd": "settings.users.menu.banking.internal_transfer_vnd",
    "banking-reports": "settings.users.menu.banking.reports",
    "payment-approval": "settings.users.menu.payment.approval_management",
    "payment-internal-transfer": "settings.users.menu.payment.internal_transfer",
    "payment-vendor": "settings.users.menu.payment.vendor_payment",
    "payment-expense": "settings.users.menu.payment.expense_payment",
    "payment-payroll": "settings.users.menu.payment.payroll",
    "payment-overseas": "settings.users.menu.payment.overseas_payment",
    "payment-corporate-card": "settings.users.menu.payment.corporate_card",
    "addon-einvoice": "settings.users.menu.addon.einvoices",
    "addon-operation-status": "settings.users.menu.addon.operation_status",
    "addon-report-and-tax": "settings.users.menu.addon.report_and_tax",
};

/** Leaf permission_cd → entitlement item label key. */
const ITEM_LABEL_KEY: Record<string, string> = {
    "banking-vnd-account-inquiry": "settings.users.menu.banking.account_inquiry",
    "banking-vnd-inquire-transactions": "settings.users.menu.shared.inquire_transactions",
    "banking-fcy-update-inquire": "settings.users.menu.banking.update_inquire_account",
    "banking-fcy-inquire-transactions": "settings.users.menu.shared.inquire_transactions",
    "banking-internal-transfer-own": "settings.users.menu.banking.transfer_own_accounts",
    "banking-internal-transfer-history": "settings.users.menu.banking.inquire_transfer_history",
    "banking-reports-daily-cash": "settings.users.menu.banking.daily_cash_report",
    "banking-reports-daily-financial": "settings.users.menu.banking.daily_financial_report",
    // HaengSung Daily Financial (rept_0017_001) reuses the Daily Financial label.
    "banking-reports-daily-financial-hs": "settings.users.menu.banking.daily_financial_report",
    "banking-reports-cash-flow": "settings.users.menu.banking.cash_flow_report",
    "payment-approval-box": "settings.users.menu.payment.approval_box",
    "payment-internal-transfer-scheduled": "settings.users.menu.payment.scheduled_transfer",
    "payment-internal-transfer-result": "settings.users.menu.payment.transfer_result",
    "payment-vendor-scheduled": "settings.users.menu.shared.scheduled_payment",
    "payment-vendor-result": "settings.users.menu.shared.payment_result",
    "payment-expense-scheduled": "settings.users.menu.shared.scheduled_payment",
    "payment-expense-result": "settings.users.menu.shared.payment_result",
    "payment-payroll-scheduled": "settings.users.menu.shared.scheduled_payment",
    "payment-payroll-result": "settings.users.menu.shared.payment_result",
    "payment-overseas-request": "settings.users.menu.payment.payment_request",
    "payment-overseas-result": "settings.users.menu.payment.request_result",
    "payment-overseas-exchange": "settings.users.menu.payment.exchange_rate_inquiry",
    "payment-corporate-card-transactions": "settings.users.menu.payment.card_transactions",
    "addon-einvoices-sales": "settings.users.menu.addon.sales_einvoices",
    "addon-einvoices-expenses": "settings.users.menu.addon.expenses_einvoices",
    "addon-operation-status-inquiry": "settings.users.menu.addon.operation_status_inquiry",
    "addon-report-and-tax-filing": "settings.users.menu.addon.tax_filing",
};

/**
 * Settings entitlements — product-invariant, not part of the navigation
 * product tree (Phase-4 parity). Item ids are the `settings-*` grant codes
 * persisted in USER_MENU_AUTH_INFM.
 */
const SETTINGS_SECTION: EntitlementSection = {
    id: "settings",
    labelKey: "settings.users.menu.section.settings",
    Icon: SettingsIcon,
    groups: [
        {
            id: "settings-core",
            categoryKey: "settings.users.menu.settings.settings",
            items: [
                { id: "settings-core-purpose", labelKey: "settings.users.menu.settings.purpose" },
                { id: "settings-core-vas-account", labelKey: "settings.users.menu.settings.vas_account" },
                { id: "settings-core-contacts", labelKey: "settings.users.menu.settings.contacts" },
                { id: "settings-core-approval-line", labelKey: "settings.users.menu.settings.approval_line" },
                { id: "settings-core-chart-of-accounts", labelKey: "settings.users.menu.settings.chart_of_accounts" },
                { id: "settings-core-login-credentials", labelKey: "settings.users.menu.settings.login_credentials" },
                { id: "settings-core-bank-account", labelKey: "settings.users.menu.settings.bank_account" },
                { id: "settings-core-preference", labelKey: "settings.users.menu.settings.preference" },
                { id: "settings-core-users", labelKey: "settings.users.menu.settings.users" },
            ],
        },
        {
            id: "settings-erp",
            categoryKey: "settings.users.menu.settings.erp",
            items: [
                { id: "settings-erp-transaction-history", labelKey: "settings.users.menu.settings.transaction_history" },
            ],
        },
        {
            id: "settings-firm-banking",
            categoryKey: "settings.users.menu.settings.firm_banking",
            items: [
                { id: "settings-firm-banking-settings", labelKey: "settings.users.menu.settings.firm_banking_settings" },
                { id: "settings-firm-banking-history", labelKey: "settings.users.menu.settings.firm_banking_history" },
            ],
        },
    ],
};

function toItems(leaves: MenuNode[]): EntitlementItem[] {
    const items: EntitlementItem[] = [];
    for (const leaf of leaves) {
        if (!leaf.permissionCd) continue; // pure parent — skip
        items.push({
            id: leaf.permissionCd,
            labelKey: ITEM_LABEL_KEY[leaf.permissionCd] ?? leaf.label,
        });
    }
    return items;
}

/**
 * Build the entitlement universe for the Menu Entitlement screen from the
 * resolved navigation tree, then append the product-invariant Settings
 * section. Returns just Settings when the tree is unavailable (loading /
 * error) so the panel never renders empty chrome.
 */
export function buildEntitlementSections(tree: NavigationTree | null): EntitlementSection[] {
    const sections: EntitlementSection[] = [];

    for (const top of tree?.topMenus ?? []) {
        const sectionPres = SECTION_PRESENTATION[top.id];
        if (!sectionPres) continue;

        const groups: EntitlementGroup[] = [];
        for (const groupNode of top.children) {
            const items = toItems(groupNode.children);
            if (items.length === 0) continue;
            groups.push({
                id: groupNode.id,
                categoryKey: GROUP_LABEL_KEY[groupNode.id] ?? groupNode.label,
                items,
            });
        }
        if (groups.length > 0) {
            sections.push({
                id: sectionPres.id,
                labelKey: sectionPres.labelKey,
                Icon: sectionPres.Icon,
                groups,
            });
        }
    }

    sections.push(SETTINGS_SECTION);
    return sections;
}
