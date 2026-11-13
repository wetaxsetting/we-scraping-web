"use client";

import { CheckCircle2, Globe } from "lucide-react";
import type { ReactNode } from "react";

import { LOCALE_OPTIONS, useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Public auth page frame shared by `/login` and `/register`: WeCMS login layout (brand-soft canvas, navy marketing
 * band on the left from `lg`, locale switch above the card). The card itself is the child.
 */
export function AuthShell({ children }: { children: ReactNode }) {
    const { t, locale, setLocale } = useTranslation();
    const points = [t("login.p1"), t("login.p2"), t("login.p3"), t("login.p4")];

    return (
        <div className="flex min-h-screen w-full bg-brand-soft">
            <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-wb-navy p-12 text-white lg:flex">
                <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-white">
                        <span className="size-3 rounded-[3px] bg-brand" />
                    </span>
                    <span className="text-wb-22 font-bold tracking-wb-tighter">WeInvoice</span>
                </div>
                <div>
                    <h1 className="max-w-[460px] text-wb-28 font-bold tracking-wb-tight">{t("login.hero")}</h1>
                    <ul className="mt-8 flex flex-col gap-3">
                        {points.map((p) => (
                            <li key={p} className="flex items-start gap-2.5 text-wb-15 text-white/90">
                                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-03" />
                                {p}
                            </li>
                        ))}
                    </ul>
                </div>
                <p className="text-wb-12 text-white/60">{t("login.family")}</p>
                <div className="pointer-events-none absolute -right-24 -bottom-24 size-80 rounded-full bg-brand/40 blur-3xl" />
            </div>

            <div className="flex flex-1 flex-col items-center justify-center p-6">
                <div className="mb-4 flex w-full max-w-[400px] justify-end gap-1">
                    <Globe className="mt-1.5 size-4 text-wb-ntrl-6" />
                    {LOCALE_OPTIONS.map((l) => (
                        <button
                            key={l.code}
                            type="button"
                            onClick={() => setLocale(l.code)}
                            className={cn("cursor-pointer rounded-md px-2 py-1 text-wb-12 font-semibold", l.code === locale ? "bg-white text-brand shadow-wb-card" : "text-wb-ntrl-6 hover:text-wb-ink")}
                        >
                            {l.short}
                        </button>
                    ))}
                </div>
                {children}
            </div>
        </div>
    );
}

/** `?next=` target after sign-in / sign-up, else the dashboard (never back to an auth page). */
export function nextPath(): string {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") && !next.startsWith("/login") && !next.startsWith("/register") ? next : "/dashboard";
}
