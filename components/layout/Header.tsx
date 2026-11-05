"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Building2, Search, Check, ChevronDown, Globe, LogOut, Menu, X } from "lucide-react";

import { MenuItem, Popover } from "@/components/shared/Popover";
import { useDialog } from "@/components/shared/dialog";
import { setActiveTaxId } from "@/lib/api/weinvoice/sync";
import { logout, session } from "@/lib/weinvoice/auth";
import { LOCALE_OPTIONS, useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import { NAV, moduleFor } from "@/lib/weinvoice/nav";
import { cn } from "@/lib/utils";

export default function Header({ sidebarOpen, onToggleSidebar }: { sidebarOpen: boolean; onToggleSidebar: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const { t, locale, setLocale } = useTranslation();
    const { toast } = useDialog();
    const active = moduleFor(pathname);
    const connections = useStore((s) => s.connections);
    const activeTaxId = useStore((s) => s.activeTaxId);
    const current = connections.find((c) => c.taxId === activeTaxId);
    const user = session.get();

    return (
        <header className="sticky top-0 z-30 flex h-[var(--h-wb-header)] w-full shrink-0 items-center justify-between bg-brand pr-3 pl-3 md:pr-4 md:pl-4">
            <div className="flex min-w-0 flex-1 items-center">
                <button
                    type="button"
                    aria-label={sidebarOpen ? t("nav.close_menu") : t("nav.open_menu")}
                    onClick={onToggleSidebar}
                    className="mr-2 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-white hover:bg-white/10 lg:hidden"
                >
                    {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                </button>
                <Link href="/dashboard" className="flex shrink-0 items-center gap-2 lg:w-[195px]">
                    <span className="hidden size-6 rounded-md bg-white lg:flex lg:items-center lg:justify-center">
                        <span className="size-2.5 rounded-[3px] bg-brand" />
                    </span>
                    <span className="text-wb-18 font-bold tracking-wb-tighter text-white">
                        We<span className="font-semibold">Invoice</span>
                    </span>
                </Link>
                <nav className="hidden min-w-0 items-center overflow-hidden md:flex">
                    {NAV.map((m) => {
                        const on = m.key === active.key;
                        const Icon = m.icon;
                        return (
                            <Link
                                key={m.key}
                                href={m.home}
                                className={cn(
                                    "flex h-[var(--h-wb-header)] items-center gap-2 px-3.5 text-wb-15 font-medium whitespace-nowrap transition-colors 2xl:px-4",
                                    on ? "bg-white text-brand-active" : "text-white hover:bg-white/10",
                                )}
                            >
                                <Icon className="size-5" />
                                <span className={cn(!on && "hidden lg:inline")}>{t(`nav.m.${m.key}`)}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("weinvoice:palette"))}
                    className="hidden h-8 cursor-pointer items-center gap-2 rounded-md bg-white/12 px-2.5 text-wb-13 text-white/85 ring-1 ring-white/25 hover:bg-white/20 min-[1600px]:flex"
                    title="Ctrl+K"
                >
                    <Search className="size-4" />
                    <span className="w-[150px] truncate text-left">{t("pal.trigger")}</span>
                    <kbd className="rounded bg-white/20 px-1 text-wb-11">Ctrl+K</kbd>
                </button>
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("weinvoice:palette"))} className="flex size-8 cursor-pointer items-center justify-center rounded-md text-white hover:bg-white/10 min-[1600px]:hidden" aria-label="Search">
                    <Search className="size-5" />
                </button>
                {/* Active MST (tax ID) switcher — every screen is scoped to it */}
                <Popover
                    align="right"
                    width={340}
                    trigger={({ toggle }) => (
                        <button
                            type="button"
                            onClick={toggle}
                            className="flex h-8 max-w-[260px] cursor-pointer items-center gap-2 rounded-md bg-white/12 px-2.5 text-white ring-1 ring-white/25 hover:bg-white/20"
                        >
                            <Building2 className="size-4 shrink-0" />
                            <span className="hidden truncate text-wb-13 font-medium sm:inline">{current ? current.taxId : t("header.no_mst")}</span>
                            <ChevronDown className="size-4 shrink-0" />
                        </button>
                    )}
                >
                    {(close) => (
                        <div className="py-1">
                            <p className="px-3 pt-1.5 pb-1 text-wb-11 font-medium uppercase text-wb-ntrl-6">{t("header.working_mst")}</p>
                            {connections.map((c) => (
                                <MenuItem
                                    key={c.taxId}
                                    active={c.taxId === activeTaxId}
                                    icon={c.taxId === activeTaxId ? <Check /> : <span className="size-4" />}
                                    hint={c.companyName}
                                    onClick={() => {
                                        setActiveTaxId(c.taxId);
                                        close();
                                        toast(t("header.switched", { mst: c.taxId }), "info");
                                    }}
                                >
                                    {c.taxId} {c.label && <span className="text-wb-ntrl-6">· {c.label}</span>}
                                </MenuItem>
                            ))}
                            <div className="mt-1 border-t border-wb-border-sidebar pt-1">
                                <MenuItem
                                    onClick={() => {
                                        close();
                                        router.push("/sources/gdt?add=1");
                                    }}
                                >
                                    <span className="text-brand">+ {t("header.add_mst")}</span>
                                </MenuItem>
                            </div>
                        </div>
                    )}
                </Popover>

                <Popover
                    align="right"
                    width={160}
                    trigger={({ toggle }) => (
                        <button type="button" onClick={toggle} className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-wb-13 font-semibold text-white hover:bg-white/10" aria-label="Language">
                            <Globe className="size-4" />
                            {LOCALE_OPTIONS.find((l) => l.code === locale)?.short}
                        </button>
                    )}
                >
                    {(close) => (
                        <div className="py-1">
                            {LOCALE_OPTIONS.map((l) => (
                                <MenuItem
                                    key={l.code}
                                    active={l.code === locale}
                                    onClick={() => {
                                        setLocale(l.code);
                                        close();
                                    }}
                                >
                                    {l.label}
                                </MenuItem>
                            ))}
                        </div>
                    )}
                </Popover>

                <button type="button" className="relative hidden size-8 cursor-pointer items-center justify-center rounded-md text-white hover:bg-white/10 sm:flex" aria-label={t("header.notifications")}>
                    <Bell className="size-5" />
                    <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-wb-error ring-2 ring-brand" />
                </button>

                <Popover
                    align="right"
                    width={240}
                    trigger={({ toggle }) => (
                        <button type="button" onClick={toggle} className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-white text-wb-12 font-bold text-brand">
                            {(user?.name ?? "D").slice(0, 1).toUpperCase()}
                        </button>
                    )}
                >
                    {() => (
                        <div className="py-1">
                            <div className="border-b border-wb-border-sidebar px-3 py-2">
                                <p className="text-wb-13 font-semibold text-wb-ink">{user?.name}</p>
                                <p className="text-wb-12 text-wb-ntrl-6">{user?.companyName}</p>
                            </div>
                            <MenuItem
                                icon={<LogOut />}
                                onClick={async () => {
                                    await logout();
                                    router.replace("/login");
                                }}
                            >
                                {t("header.logout")}
                            </MenuItem>
                        </div>
                    )}
                </Popover>
            </div>
        </header>
    );
}
