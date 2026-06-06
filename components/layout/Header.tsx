"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import NotificationPopup from "@/components/layout/notifications/NotificationPopup";
import ProfileMenu from "@/components/layout/ProfileMenu";
import { useSettingsModal } from "@/components/settings/SettingsModalProvider";
import { useTopMenuItems } from "@/hooks/useTopMenuItems";
import { userStorage } from "@/lib/auth/storage";
import { useTranslation } from "@/lib/i18n";
import { HOME_ROUTE } from "@/lib/routes";
import { cn } from "@/lib/utils";

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

    // Top-nav modules come from the resolved navigation tree (product-scoped +
    // permission-filtered server-side, via `useTopMenuItems`); Settings is
    // appended by the hook and gated by its own section grant. `user` is read
    // once at mount — the dashboard layout's fetchMe() has already refreshed
    // userStorage before AppShell (and this Header) mounts. A null user
    // (designer ?preview=1 / no session) shows the full static list for preview.
    const [user] = useState(() => userStorage.get());
    const visibleTopMenuItems = useTopMenuItems(user);

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
                   with Banking today is intentional until a cross-module home page exists.
                   Figma 1:9975: plain white square (24×24, no icon) + white wordmark.
                   Square is hidden below lg; wordmark stays visible at all widths. */}
                <Link
                    href={HOME_ROUTE}
                    aria-label={t("nav.home")}
                    className="flex items-center gap-2 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:w-[195px]"
                >
                    {/* Plain white square — Figma 1:9975 / 1:9976: the mark IS the
                        white square itself, no icon inside. Desktop/laptop only. */}
                    <div className="hidden size-6 shrink-0 rounded-md bg-white lg:block" aria-hidden />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/header/logo-wordmark.svg"
                        alt="WeCMS"
                        className="block h-4 w-[var(--w-wb-logo-wordmark)]"
                    />
                </Link>

                {/* Main menu — hidden below md. On md (tablet 768-1023, Figma 60:19204
                   / 60:19715) the labels collapse so only the icon group fits next
                   to the logo + hamburger; the active item still renders its label
                   on a white tab. On lg+ every item shows its label. The Settings
                   item has no route; it pops the shared settings modal via
                   <SettingsModalProvider> so it works identically from any
                   dashboard page. */}
                <nav className="hidden items-center md:flex">
                    {visibleTopMenuItems.map(({ key, labelKey, Icon, ActiveIcon, href, activePrefix }) => {
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
                        // On tablet (md), collapse inactive labels; show only the
                        // active item's label so the Figma's "icon strip + active
                        // tab" layout fits inside the 768-1023 viewport.
                        const labelClass = cn(
                            "whitespace-nowrap",
                            !isActive && "hidden lg:inline",
                        );
                        const inner = (
                            <>
                                <RenderedIcon className="size-6" />
                                <span className={labelClass}>{t(labelKey)}</span>
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
                {/* Notifications dropdown — Figma node 12346:43819 (owns the bell trigger) */}
                <NotificationPopup />
                {/* Profile dropdown — Figma node 9523:20132 */}
                <ProfileMenu />
            </div>
        </header>
    );
}
