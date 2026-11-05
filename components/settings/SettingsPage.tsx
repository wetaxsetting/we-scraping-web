"use client";

import { Building2, CalendarClock, ChevronRight, CreditCard, Globe, Keyboard, LogOut, Mail, Tags, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import PageLayout from "@/components/shared/PageLayout";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/shared/dialog";
import { logout, session } from "@/lib/weinvoice/auth";
import { LOCALE_OPTIONS, useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import { cn } from "@/lib/utils";
import { subAccountsAvailable } from "@/lib/api/weinvoice/subaccounts";

/**
 * Cài đặt (M11-F01) — layout of Invoy "Cài đặt": Tài khoản · Quản lý · Phiên đăng nhập,
 * plus WeInvoice extras (ngôn ngữ, phím tắt). The prototype's "Sao lưu dữ liệu" (browser-DB
 * backup) is intentionally not ported — this build keeps no browser persistence.
 */
export default function SettingsPage() {
    const { t, locale, setLocale } = useTranslation();
    const { confirm } = useDialog();
    const router = useRouter();
    const user = session.get();
    const activeTaxId = useStore((s) => s.activeTaxId);
    const tags = useStore((s) => s.tags);
    const subs = useStore((s) => s.subaccounts);
    const conns = useStore((s) => s.connections);

    return (
        <PageLayout>
            <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 py-6">
                <div>
                    <h1 className="text-wb-24 font-bold tracking-wb-tight text-wb-dark">{t("set.title")}</h1>
                    <p className="text-wb-13 text-wb-ntrl-6">{t("set.subtitle")}</p>
                </div>

                <Section title={t("set.account")}>
                    <div className="divide-y divide-wb-border-sidebar rounded-lg bg-white shadow-wb-card">
                        <Row icon={<Mail />} label={t("login.user")} value={user?.userId ?? "—"} />
                        <Row icon={<Users />} label={t("set.user_name")} value={user?.name ?? "—"} />
                        <Row icon={<CalendarClock />} label={t("set.company")} value={user ? `${user.companyName}${user.taxId ? ` · MST ${user.taxId}` : ""}` : "—"} />
                    </div>
                </Section>

                <Section title={t("set.manage")}>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Tile href="/sources/gdt" icon={<Building2 />} tone="bg-wb-status-approved-bg text-wb-status-approved-text" title={t("set.tile_mst")} hint={t("set.tile_mst_hint", { mst: activeTaxId, n: conns.length })} />
                        <Tile href="/settings/tags" icon={<Tags />} tone="bg-brand-soft text-brand" title={t("set.tile_tags")} hint={t("set.tile_tags_hint", { n: tags.length })} />
                        <Tile href="/settings/users" icon={<Users />} tone="bg-[#f3e8ff] text-[#7e22ce]" title={t("set.tile_users")} hint={subAccountsAvailable() ? t("set.tile_users_hint", { n: subs?.length ?? 0 }) : t("common.not_on_server")} />
                        <Tile href="/settings/plan" icon={<CreditCard />} tone="bg-wb-warn-bg text-wb-warn-text" title={t("set.tile_plan")} hint={t("set.tile_plan_hint")} />
                    </div>
                </Section>

                <Section title={t("set.prefs")}>
                    <div className="divide-y divide-wb-border-sidebar rounded-lg bg-white shadow-wb-card">
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <Icon><Globe /></Icon>
                            <div className="min-w-0 flex-1">
                                <p className="text-wb-13 font-semibold">{t("set.language")}</p>
                                <p className="text-wb-12 text-wb-ntrl-6">{t("set.language_hint")}</p>
                            </div>
                            <div className="flex rounded-md bg-wb-bg-sidebar p-0.5">
                                {LOCALE_OPTIONS.map((l) => (
                                    <button key={l.code} type="button" onClick={() => setLocale(l.code)} className={cn("h-7 cursor-pointer rounded px-3 text-wb-12 font-semibold", l.code === locale ? "bg-white text-brand shadow-wb-btn" : "text-wb-ntrl-7")}>
                                        {l.short}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <Icon><Keyboard /></Icon>
                            <div className="min-w-0 flex-1">
                                <p className="text-wb-13 font-semibold">{t("set.shortcuts")}</p>
                                <p className="text-wb-12 text-wb-ntrl-6">{t("set.shortcuts_hint")}</p>
                            </div>
                            <Button size="wb-sm" variant="neutral" onClick={() => window.dispatchEvent(new CustomEvent("weinvoice:palette"))}>
                                Ctrl + K
                            </Button>
                        </div>
                    </div>
                </Section>

                <Section title={t("set.session")}>
                    <div className="rounded-lg bg-white px-4 py-4 shadow-wb-card">
                        <Button size="md"
                            variant="danger"
                            icon={<LogOut />}
                            onClick={async () => {
                                if (!(await confirm({ title: t("header.logout"), message: t("set.logout_confirm"), danger: true, confirmLabel: t("header.logout") }))) return;
                                await logout();
                                router.replace("/login");
                            }}
                        >
                            {t("set.logout")}
                        </Button>
                    </div>
                </Section>
            </div>
        </PageLayout>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2">
            <h2 className="text-wb-12 font-bold tracking-wide text-wb-ntrl-7 uppercase">{title}</h2>
            {children}
        </section>
    );
}
function Icon({ children }: { children: ReactNode }) {
    return <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-wb-bg-sidebar text-wb-ntrl-7 [&_svg]:size-4">{children}</span>;
}
function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <Icon>{icon}</Icon>
            <div className="min-w-0">
                <p className="text-wb-12 font-semibold text-wb-ntrl-8">{label}</p>
                <p className="truncate text-wb-13 text-wb-ink">{value}</p>
            </div>
        </div>
    );
}
function Tile({ href, icon, tone, title, hint }: { href: string; icon: ReactNode; tone: string; title: string; hint: string }) {
    return (
        <Link href={href} className="group flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-wb-card hover:shadow-[0_0_0_1px_#0060b9]">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5", tone)}>{icon}</span>
            <span className="min-w-0 flex-1">
                <span className="block text-wb-13 font-semibold text-wb-ink">{title}</span>
                <span className="block truncate text-wb-12 text-wb-ntrl-6">{hint}</span>
            </span>
            <ChevronRight className="size-4 text-wb-ntrl-5 group-hover:text-brand" />
        </Link>
    );
}
