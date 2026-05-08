import {
    IconAddonActive,
    IconAddonInactive,
    IconBankingActive,
    IconBankingInactive,
    IconPaymentActive,
    IconPaymentInactive,
    IconSettingsActive,
    IconSettingsInactive,
} from "@/components/layout/HeaderIcons";
import { ADDON_HOME, BANKING_HOME, PAYMENT_HOME } from "@/lib/routes";

export type TopMenuKey = "banking" | "payment" | "addon" | "settings";

export type TopMenuIconComponent = (props: { className?: string }) => React.ReactElement;

export type TopMenuItem = {
    key: TopMenuKey;
    /** Translation key for the visible label. */
    labelKey: string;
    /** Inactive Figma icon — drawn on the blue `bg-brand` header. */
    Icon: TopMenuIconComponent;
    /** Active Figma icon — drawn on the white tab background or selected drawer row. */
    ActiveIcon: TopMenuIconComponent;
    /** Click destination. Items without an href render as disabled. */
    href?: string;
    /** URL prefix that keeps this item active across sub-pages. Defaults to `href`. */
    activePrefix?: string;
};

/**
 * Top-level module navigation. Active state is derived from `usePathname()`
 * matching `activePrefix` (falls back to `href`). Shared between the desktop
 * `<Header>` top nav and the mobile `<Sidebar>` drawer's MENU section so a
 * new module appears in both places automatically.
 */
export const topMenuItems: TopMenuItem[] = [
    {
        key: "banking",
        labelKey: "nav.banking",
        Icon: IconBankingInactive,
        ActiveIcon: IconBankingActive,
        href: BANKING_HOME,
        activePrefix: "/banking",
    },
    {
        key: "payment",
        labelKey: "nav.payment",
        Icon: IconPaymentInactive,
        ActiveIcon: IconPaymentActive,
        href: PAYMENT_HOME,
        activePrefix: "/payment",
    },
    {
        key: "addon",
        labelKey: "nav.addon",
        Icon: IconAddonInactive,
        ActiveIcon: IconAddonActive,
        href: ADDON_HOME,
        activePrefix: "/addon",
    },
    {
        key: "settings",
        labelKey: "nav.settings",
        Icon: IconSettingsInactive,
        ActiveIcon: IconSettingsActive,
        activePrefix: "/settings",
    },
];
