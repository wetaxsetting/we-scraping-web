"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import { NAV, moduleFor } from "@/lib/weinvoice/nav";
import { cn } from "@/lib/utils";

/** WeInvoice sidebar (UI Spec v1.0) — WeCMS sidebar look: company block, uppercase group titles, 13/500 rows, grey active pill. */
export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
    const pathname = usePathname();
    const { t } = useTranslation();
    const mod = moduleFor(pathname);
    const activeTaxId = useStore((s) => s.activeTaxId);
    const connections = useStore((s) => s.connections);
    const company = connections.find((c) => c.taxId === activeTaxId);

    return (
        <>
            <div
                aria-hidden
                onClick={onClose}
                className={cn("fixed inset-0 top-[var(--h-wb-header)] z-30 bg-black/40 transition-opacity lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
            />
            <aside
                className={cn(
                    "z-40 flex w-[var(--w-wb-sidebar)] shrink-0 flex-col overflow-x-hidden border-r border-wb-border-sidebar bg-wb-bg-sidebar py-2.5",
                    "fixed inset-y-0 left-0 top-[var(--h-wb-header)] transform transition-transform duration-200",
                    open ? "translate-x-0" : "-translate-x-full",
                    "lg:sticky lg:h-[calc(100vh-var(--h-wb-header))] lg:translate-x-0",
                )}
            >
                <div className="flex w-full items-start gap-2 border-b border-wb-border-sidebar px-4 pt-2 pb-3">
                    <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-brand text-wb-10 font-bold text-white">
                        {(company?.companyName ?? "W").replace(/^CÔNG TY (CỔ PHẦN|TNHH)\s*/i, "").slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-wb-13 leading-tight font-semibold break-words text-wb-ink">{company?.companyName ?? "WeInvoice"}</p>
                        {company && <p className="mt-0.5 text-wb-12 text-wb-ntrl-6">MST {company.taxId}</p>}
                    </div>
                    <button type="button" onClick={onClose} className="flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-black/5 lg:hidden">
                        <X className="size-4" />
                    </button>
                </div>

                <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-3 pb-3">
                    {/* Module switcher inside the drawer on small screens */}
                    <div className="flex flex-col p-1 md:hidden">
                        <p className="px-2.5 pb-2 text-wb-11 font-medium uppercase text-black/70">{t("nav.menu")}</p>
                        {NAV.map((m) => (
                            <Link key={m.key} href={m.home} onClick={onClose} className={cn("flex items-center gap-2 rounded-md px-2.5 py-2 text-wb-13 font-medium", m.key === mod.key ? "bg-wb-bg-active text-brand" : "text-wb-ink hover:bg-black/5")}>
                                <m.icon className="size-5" />
                                {t(`nav.m.${m.key}`)}
                            </Link>
                        ))}
                    </div>
                    {mod.groups.map((g) => (
                        <div key={g.key} className="flex flex-col p-1">
                            <p className="truncate px-2.5 pb-2 text-wb-11 font-medium uppercase text-black/70">{t(`nav.g.${g.key}`)}</p>
                            {g.items.map((it) => {
                                const on = pathname === it.href || pathname.startsWith(it.href + "/");
                                const Icon = it.icon;
                                return (
                                    <Link
                                        key={it.key}
                                        href={it.href}
                                        onClick={onClose}
                                        className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left", on ? "bg-wb-bg-active" : "hover:bg-black/5")}
                                    >
                                        <Icon className={cn("size-[18px] shrink-0", on ? "text-brand" : "text-wb-ntrl-7")} />
                                        <span className={cn("min-w-0 flex-1 truncate text-wb-13 font-medium", on ? "text-brand" : "text-wb-ink")}>{t(`nav.i.${it.key}`)}</span>
                                        {it.phase !== "MVP" && (
                                            <span className="shrink-0 rounded-sm border border-wb-ntrl-4 bg-wb-ntrl-3 px-1 text-wb-10 font-medium text-black/60">{it.phase}</span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </div>
                <div className="border-t border-wb-border-sidebar px-4 pt-2.5 text-wb-11 text-wb-ntrl-6">WeInvoice · UI Spec v1.0</div>
            </aside>
        </>
    );
}
