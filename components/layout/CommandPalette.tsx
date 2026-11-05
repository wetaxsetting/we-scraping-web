"use client";

import { Building2, CornerDownLeft, FileText, Globe, LogOut, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { partnerOf } from "@/lib/api/weinvoice/invoices";
import { setActiveTaxId } from "@/lib/api/weinvoice/sync";
import { logout } from "@/lib/weinvoice/auth";
import { fmtDate, fmtMoney } from "@/lib/weinvoice/format";
import { LOCALE_OPTIONS, useTranslation } from "@/lib/i18n";
import { getState } from "@/lib/api/weinvoice/store";
import { NAV } from "@/lib/weinvoice/nav";
import { fullSymbol } from "@/lib/weinvoice/types";
import { cn } from "@/lib/utils";

/** "g <key>" quick jumps (shown on the right of each page row, like Invoy). */
const JUMP: Record<string, string> = { d: "/dashboard", i: "/invoices/purchase", b: "/invoices/sales", u: "/sources/upload", c: "/checks/invoices", r: "/checks/supplier-risk", t: "/tools/taxpayer-lookup", s: "/settings/general" };

type Item = { id: string; group: "pages" | "invoices" | "partners" | "mst" | "actions"; icon: ReactNode; title: string; hint?: string; key?: string; run: () => void };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

/**
 * Ctrl+K / ⌘K global search (M01-F02): pages, invoices, partners, MST, actions.
 * Also "g + letter" jumps anywhere outside inputs. Production: invoice/partner search → GET /api/v1/search?q=.
 */
export default function CommandPalette() {
    const { t, setLocale, locale } = useTranslation();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const list = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let g = 0;
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((v) => !v);
                return;
            }
            const el = e.target as HTMLElement;
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
            if (e.key === "g") { g = Date.now(); return; }
            if (Date.now() - g < 900 && JUMP[e.key]) { router.push(JUMP[e.key]); g = 0; }
        };
        const onOpen = () => setOpen(true);
        window.addEventListener("keydown", onKey);
        window.addEventListener("weinvoice:palette", onOpen);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("weinvoice:palette", onOpen);
        };
    }, [router]);

    useEffect(() => {
        if (open) { setQ(""); setSel(0); setTimeout(() => input.current?.focus(), 10); }
    }, [open]);

    const go = (href: string) => { setOpen(false); router.push(href); };

    const items = useMemo<Item[]>(() => {
        if (!open) return [];
        const st = getState();
        const f = fold(q.trim());
        const pages: Item[] = NAV.flatMap((m) => m.groups.flatMap((g) => g.items)).map((it) => {
            const jk = Object.entries(JUMP).find(([, h]) => h === it.href)?.[0];
            const Icon = it.icon;
            return { id: `p:${it.href}`, group: "pages" as const, icon: <Icon />, title: t(`nav.i.${it.key}`), hint: it.phase === "MVP" ? t(`pal.hint.${it.key}`).startsWith("pal.") ? undefined : t(`pal.hint.${it.key}`) : t("soon.phase", { p: it.phase }), key: jk ? `g ${jk}` : undefined, run: () => go(it.href) };
        });
        const actions: Item[] = [
            ...LOCALE_OPTIONS.filter((l) => l.code !== locale).map((l) => ({ id: `l:${l.code}`, group: "actions" as const, icon: <Globe />, title: t("pal.lang", { l: l.label }), run: () => { setLocale(l.code); setOpen(false); } })),
            { id: "logout", group: "actions", icon: <LogOut />, title: t("header.logout"), hint: t("pal.logout_hint"), run: async () => { setOpen(false); await logout(); router.replace("/login"); } },
        ];
        if (!f) return [...pages.filter((p) => ["/dashboard", "/invoices/purchase", "/checks/invoices", "/checks/supplier-risk", "/tools/taxpayer-lookup", "/settings/general"].includes(p.id.slice(2))), ...actions];
        const hit = (s: string) => fold(s).includes(f);
        const mine = st.invoices.filter((i) => (i.direction === "purchase" ? i.buyerTaxId : i.sellerTaxId) === st.activeTaxId);
        const invs: Item[] = mine
            .filter((i) => hit(i.number) || String(Number(i.number)) === f || hit(partnerOf(i).name) || hit(partnerOf(i).taxId) || hit(`${fullSymbol(i)}`))
            .slice(0, 6)
            .map((i) => ({ id: `i:${i.id}`, group: "invoices", icon: <FileText />, title: `${fullSymbol(i)} · ${i.number} — ${partnerOf(i).name}`, hint: `${fmtDate(i.issueDate)} · ${fmtMoney(i.total)} đ · ${t(`dir.${i.direction}`)}`, run: () => go(`/invoices/${i.direction}/?open=${i.id}`) }));
        const partners = Array.from(new Map(mine.map((i) => [partnerOf(i).taxId, partnerOf(i)])).values())
            .filter((p) => hit(p.name) || hit(p.taxId))
            .slice(0, 4)
            .map((p) => ({ id: `pt:${p.taxId}`, group: "partners" as const, icon: <UserRound />, title: p.name, hint: `MST ${p.taxId} · ${t("pal.partner_hint")}`, run: () => go(`/tools/taxpayer-lookup?mst=${p.taxId}`) }));
        const msts = st.connections.filter((c) => hit(c.taxId) || hit(c.companyName)).map((c) => ({ id: `m:${c.taxId}`, group: "mst" as const, icon: <Building2 />, title: `${c.taxId} — ${c.companyName}`, hint: c.taxId === st.activeTaxId ? t("pal.mst_active") : t("pal.mst_switch"), run: () => { setActiveTaxId(c.taxId); setOpen(false); } }));
        return [...pages.filter((p) => hit(p.title) || hit(p.hint ?? "")), ...invs, ...partners, ...msts, ...actions.filter((a) => hit(a.title))];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, q, locale]);

    useEffect(() => setSel(0), [q]);
    useEffect(() => {
        list.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" });
    }, [sel]);

    if (!open || typeof document === "undefined") return null;
    let idx = -1;
    const groups = (["pages", "invoices", "partners", "mst", "actions"] as const).map((g) => ({ g, rows: items.filter((i) => i.group === g) })).filter((x) => x.rows.length);
    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 px-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
            <div className="w-full max-w-[560px] overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 border-b border-wb-border-sidebar px-4">
                    <Search className="size-5 text-wb-ntrl-6" />
                    <input
                        ref={input}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") setOpen(false);
                            else if (e.key === "ArrowDown") { e.preventDefault(); setSel((v) => Math.min(v + 1, items.length - 1)); }
                            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((v) => Math.max(v - 1, 0)); }
                            else if (e.key === "Enter") { e.preventDefault(); items[sel]?.run(); }
                        }}
                        placeholder={t("pal.placeholder")}
                        className="h-12 flex-1 bg-transparent text-wb-15 outline-none"
                    />
                    <kbd className="rounded border border-wb-border-sidebar px-1.5 text-wb-11 text-wb-ntrl-6">ESC</kbd>
                </div>
                <div ref={list} className="custom-scrollbar max-h-[420px] overflow-y-auto py-2">
                    {groups.length === 0 && <p className="px-4 py-8 text-center text-wb-13 text-wb-ntrl-6">{t("pal.none", { q })}</p>}
                    {groups.map(({ g, rows }) => (
                        <div key={g} className="pb-1">
                            <p className="px-4 pt-2 pb-1 text-wb-11 font-bold tracking-wide text-wb-ntrl-6 uppercase">{t(`pal.g.${g}`)}</p>
                            {rows.map((it) => {
                                idx++;
                                const me = idx;
                                return (
                                    <button
                                        key={it.id}
                                        type="button"
                                        data-idx={me}
                                        onMouseEnter={() => setSel(me)}
                                        onClick={() => it.run()}
                                        className={cn("flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left", sel === me ? "bg-brand-soft" : "hover:bg-wb-bg-sidebar")}
                                    >
                                        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4", it.group === "actions" && it.id === "logout" ? "bg-wb-status-rejected-bg text-wb-status-rejected-text" : "bg-brand-soft text-brand")}>{it.icon}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-wb-13 font-semibold text-wb-ink">{it.title}</span>
                                            {it.hint && <span className="block truncate text-wb-12 text-wb-ntrl-6">{it.hint}</span>}
                                        </span>
                                        {it.key && <kbd className="rounded border border-wb-border-sidebar px-1.5 font-mono text-wb-11 text-wb-ntrl-6">{it.key}</kbd>}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-3 border-t border-wb-border-sidebar px-4 py-2 text-wb-11 text-wb-ntrl-6">
                    <span>↑↓ {t("pal.f_choose")}</span>
                    <span className="flex items-center gap-1"><CornerDownLeft className="size-3" /> {t("pal.f_open")}</span>
                    <span>g + d/i/c/s… {t("pal.f_jump")}</span>
                    <span className="ml-auto">Ctrl+K</span>
                </div>
            </div>
        </div>,
        document.body,
    );
}
