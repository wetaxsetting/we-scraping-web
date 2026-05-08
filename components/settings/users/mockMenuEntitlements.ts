import type { ComponentType, SVGAttributes } from "react";
import {
    CircleDollarSign,
    Landmark,
    Scissors,
    Settings as SettingsIcon,
} from "lucide-react";

/**
 * Menu Entitlement permission tree — Figma 142:22279.
 *
 * Each section corresponds to a top-nav module (Banking, Payment, Add-on
 * Service, Settings). Sections render their own checkbox row with a
 * leading icon; groups underneath share one category label spanning their
 * items, and every item carries its own row with a trailing checkbox.
 *
 * Static UI: the tree is presentation-only — no FIELD_ID / WSVC binding,
 * no backend write path, no per-row state. Wired to the real menu
 * permission API later (`MENU_AUTH_M`) without touching the renderer.
 */

export type EntitlementIcon = ComponentType<SVGAttributes<SVGSVGElement>>;

export type EntitlementItem = {
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

export const ENTITLEMENT_SECTIONS: EntitlementSection[] = [
    {
        id: "banking",
        labelKey: "settings.users.menu.section.banking",
        Icon: Landmark,
        groups: [
            {
                id: "banking-vnd",
                categoryKey: "settings.users.menu.banking.current_savings_vnd",
                items: [
                    { id: "banking-vnd-account-inquiry", labelKey: "settings.users.menu.banking.account_inquiry" },
                    { id: "banking-vnd-inquire-transactions", labelKey: "settings.users.menu.shared.inquire_transactions" },
                ],
            },
            {
                id: "banking-fcy",
                categoryKey: "settings.users.menu.banking.current_savings_fcy",
                items: [
                    { id: "banking-fcy-update-inquire", labelKey: "settings.users.menu.banking.update_inquire_account" },
                    { id: "banking-fcy-inquire-transactions", labelKey: "settings.users.menu.shared.inquire_transactions" },
                ],
            },
            {
                id: "banking-internal-transfer",
                categoryKey: "settings.users.menu.banking.internal_transfer_vnd",
                items: [
                    { id: "banking-internal-transfer-own", labelKey: "settings.users.menu.banking.transfer_own_accounts" },
                    { id: "banking-internal-transfer-history", labelKey: "settings.users.menu.banking.inquire_transfer_history" },
                ],
            },
            {
                id: "banking-reports",
                categoryKey: "settings.users.menu.banking.reports",
                items: [
                    { id: "banking-reports-daily-cash", labelKey: "settings.users.menu.banking.daily_cash_report" },
                    { id: "banking-reports-daily-financial", labelKey: "settings.users.menu.banking.daily_financial_report" },
                    { id: "banking-reports-cash-flow", labelKey: "settings.users.menu.banking.cash_flow_report" },
                ],
            },
        ],
    },
    {
        id: "payment",
        labelKey: "settings.users.menu.section.payment",
        Icon: CircleDollarSign,
        // Group order matches the live Payment top-nav (Figma):
        // Approval Management → Internal Transfer → Vendor → Expense →
        // Payroll → Overseas → Corporate Card. Corporate Card stays
        // last; Overseas always sits directly above it.
        groups: [
            {
                id: "payment-approval",
                categoryKey: "settings.users.menu.payment.approval_management",
                items: [
                    { id: "payment-approval-box", labelKey: "settings.users.menu.payment.approval_box" },
                ],
            },
            {
                id: "payment-internal-transfer",
                categoryKey: "settings.users.menu.payment.internal_transfer",
                items: [
                    { id: "payment-internal-transfer-scheduled", labelKey: "settings.users.menu.payment.scheduled_transfer" },
                    { id: "payment-internal-transfer-result", labelKey: "settings.users.menu.payment.transfer_result" },
                ],
            },
            {
                id: "payment-vendor",
                categoryKey: "settings.users.menu.payment.vendor_payment",
                items: [
                    { id: "payment-vendor-scheduled", labelKey: "settings.users.menu.shared.scheduled_payment" },
                    { id: "payment-vendor-result", labelKey: "settings.users.menu.shared.payment_result" },
                ],
            },
            {
                id: "payment-expense",
                categoryKey: "settings.users.menu.payment.expense_payment",
                items: [
                    { id: "payment-expense-scheduled", labelKey: "settings.users.menu.shared.scheduled_payment" },
                    { id: "payment-expense-result", labelKey: "settings.users.menu.shared.payment_result" },
                ],
            },
            {
                id: "payment-payroll",
                categoryKey: "settings.users.menu.payment.payroll",
                items: [
                    { id: "payment-payroll-scheduled", labelKey: "settings.users.menu.shared.scheduled_payment" },
                    { id: "payment-payroll-result", labelKey: "settings.users.menu.shared.payment_result" },
                ],
            },
            {
                id: "payment-overseas",
                categoryKey: "settings.users.menu.payment.overseas_payment",
                items: [
                    { id: "payment-overseas-request", labelKey: "settings.users.menu.payment.payment_request" },
                    // Overseas uses "Request Result" (NOT the shared
                    // "Payment Result") — its sibling key is the
                    // Payment Request flow above.
                    { id: "payment-overseas-result", labelKey: "settings.users.menu.payment.request_result" },
                    { id: "payment-overseas-exchange", labelKey: "settings.users.menu.payment.exchange_rate_inquiry" },
                ],
            },
            {
                id: "payment-corporate-card",
                categoryKey: "settings.users.menu.payment.corporate_card",
                items: [
                    { id: "payment-corporate-card-transactions", labelKey: "settings.users.menu.payment.card_transactions" },
                ],
            },
        ],
    },
    {
        id: "addon",
        labelKey: "settings.users.menu.section.addon",
        Icon: Scissors,
        groups: [
            {
                id: "addon-einvoices",
                categoryKey: "settings.users.menu.addon.einvoices",
                items: [
                    { id: "addon-einvoices-sales", labelKey: "settings.users.menu.addon.sales_einvoices" },
                    { id: "addon-einvoices-expenses", labelKey: "settings.users.menu.addon.expenses_einvoices" },
                ],
            },
            {
                id: "addon-operation-status",
                categoryKey: "settings.users.menu.addon.operation_status",
                items: [
                    { id: "addon-operation-status-inquiry", labelKey: "settings.users.menu.addon.operation_status_inquiry" },
                ],
            },
        ],
    },
    {
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
    },
];
