"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

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
import ProfileMenu from "@/components/layout/ProfileMenu";
import { useSettingsModal } from "@/components/settings/SettingsModalProvider";
import { useTranslation } from "@/lib/i18n";
import { ADDON_HOME, BANKING_HOME, HOME_ROUTE, PAYMENT_HOME } from "@/lib/routes";
import { cn } from "@/lib/utils";

type MenuKey = "banking" | "payment" | "addon" | "settings";

type IconComponent = (props: { className?: string }) => React.ReactElement;

type HeaderMenuItem = {
    key: MenuKey;
    /** Translation key for the visible label. */
    labelKey: string;
    /** Figma inactive icon — drawn on the blue `bg-brand` header. */
    Icon: IconComponent;
    /** Figma active icon — drawn on the white tab background. */
    ActiveIcon: IconComponent;
    /** Click destination. Items without an href render as disabled. */
    href?: string;
    /** URL prefix that keeps this item active across sub-pages. Defaults to `href`. */
    activePrefix?: string;
};

/**
 * Top-menu definition. Active state is derived from `usePathname()` matching
 * `activePrefix` (falls back to `href`), so a module stays highlighted on any
 * of its sub-pages — and the `ActiveIcon` swap happens for free. Adding a
 * new module = appending an entry with its icon pair, `href`, and
 * (optional) `activePrefix` — no Header call-site changes needed.
 */
const menuItems: HeaderMenuItem[] = [
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

type HeaderProps = {
    sidebarOpen?: boolean;
    onToggleSidebar?: () => void;
};

export default function Header({
    sidebarOpen = false,
    onToggleSidebar,
}: HeaderProps) {
    const pathname = usePathname();
    const { t } = useTranslation();
    const settingsModal = useSettingsModal();
    return (
        <header className="sticky top-0 z-30 flex h-[var(--h-wb-header)] w-full items-center justify-between bg-brand pl-3 pr-3 font-inter md:pl-4 md:pr-4">
            {/* Left: Hamburger (< lg) + Logo + Menu — no outer gap so nav starts flush
               with sidebar right edge on lg+ (16px pl + 195px logo block = 211px sidebar). */}
            <div className="flex flex-1 items-center">
                {/* Hamburger — only below lg */}
                <button
                    type="button"
                    aria-label={sidebarOpen ? t("nav.close_menu") : t("nav.open_menu")}
                    aria-expanded={sidebarOpen}
                    onClick={onToggleSidebar}
                    className="mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/10 lg:hidden"
                >
                    {sidebarOpen ? (
                        <X className="size-5" strokeWidth={2} />
                    ) : (
                        <Menu className="size-5" strokeWidth={2} />
                    )}
                </button>

                {/* Logo block — reserved width on lg+ aligns the nav with sidebar right edge.
                   Logo always navigates to the app's home (HOME_ROUTE); sharing a destination
                   with Banking today is intentional until a cross-module home page exists. */}
                <Link
                    href={HOME_ROUTE}
                    aria-label={t("nav.home")}
                    className="flex items-center gap-2 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:w-[195px]"
                >
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/header/logo-mark.svg"
                            alt=""
                            aria-hidden
                            className="h-4 w-3.5"
                        />
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/header/logo-wordmark.svg"
                        alt="WeCMS"
                        className="hidden h-4 w-[var(--w-wb-logo-wordmark)] sm:block"
                    />
                </Link>

                {/* Main menu — hidden below lg. The Settings item has no route;
                   it pops the shared settings modal via <SettingsModalProvider>
                   so it works identically from any dashboard page. */}
                <nav className="hidden items-center lg:flex">
                    {menuItems.map(({ key, labelKey, Icon, ActiveIcon, href, activePrefix }) => {
                        const isSettings = key === "settings";
                        const prefix = activePrefix ?? href;
                        const isActive =
                            !!prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`));
                        const RenderedIcon = isActive ? ActiveIcon : Icon;
                        const className = cn(
                            "flex h-[var(--h-wb-header)] cursor-pointer items-center gap-2.5 px-4 text-wb-15 font-medium transition-colors duration-150",
                            isActive
                                ? "bg-white text-brand-active"
                                : href || isSettings
                                    ? "text-white hover:bg-white/10"
                                    : "cursor-default text-white/70",
                        );
                        const inner = (
                            <>
                                <RenderedIcon className="size-6" />
                                <span className="whitespace-nowrap">{t(labelKey)}</span>
                            </>
                        );
                        if (href) {
                            return (
                                <Link
                                    key={key}
                                    href={href}
                                    aria-current={isActive ? "page" : undefined}
                                    className={className}
                                >
                                    {inner}
                                </Link>
                            );
                        }
                        if (isSettings) {
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => settingsModal.open()}
                                    className={className}
                                >
                                    {inner}
                                </button>
                            );
                        }
                        return (
                            <button key={key} type="button" disabled className={className}>
                                {inner}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Right: action icons — Figma 9183:14669 keeps 10px gap between each 32px icon/avatar */}
            <div className="flex items-center gap-2.5">
                <button
                    type="button"
                    aria-label={t("nav.documents")}
                    className="hidden cursor-pointer items-center justify-center rounded-full p-1 transition-opacity hover:bg-white/10 hover:opacity-90 md:flex"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/header/ico-document.svg" alt="" aria-hidden className="size-6" />
                </button>
                <button
                    type="button"
                    aria-label={t("nav.switch")}
                    className="hidden cursor-pointer items-center justify-center rounded-full p-1 transition-opacity hover:bg-white/10 hover:opacity-90 md:flex"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/header/ico-switch.svg" alt="" aria-hidden className="size-6" />
                </button>
                <button
                    type="button"
                    aria-label={t("nav.notifications")}
                    className="flex cursor-pointer items-center justify-center rounded-full p-1 transition-opacity hover:bg-white/10 hover:opacity-90"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/header/ico-bell.svg" alt="" aria-hidden className="size-6" />
                </button>
                {/* Profile dropdown — Figma node 9523:20132 */}
                <ProfileMenu />
            </div>
        </header>
    );
}
