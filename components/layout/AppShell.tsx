"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import CommandPalette from "@/components/layout/CommandPalette";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { saveLanguage, serverLocale } from "@/lib/api/weinvoice/me";
import { hydrate, reloadForTaxId, useHydration } from "@/lib/api/weinvoice/remote";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { useStore } from "@/lib/api/weinvoice/store";
import { useTranslation } from "@/lib/i18n";
import { fetchMe, session } from "@/lib/weinvoice/auth";

const noopSubscribe = () => () => {};

/**
 * Authenticated chrome (header + sidebar). The edge gate (proxy.ts) already
 * blocks unauthenticated requests; this client check additionally waits for
 * the session profile (header avatar / MST) and bounces to /login when the
 * token is present but the profile is gone.
 */
export default function AppShell({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    // null on the server and during hydration → spinner, then the client value.
    const ready = useSyncExternalStore(noopSubscribe, () => !!session.get(), () => null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { t, locale, setLocale } = useTranslation();
    const hydration = useHydration();
    const activeTaxId = useStore((s) => s.activeTaxId);
    const [lastPath, setLastPath] = useState(pathname);

    // Close the mobile drawer on navigation (state adjusted during render, not in an effect).
    if (lastPath !== pathname) {
        setLastPath(pathname);
        setSidebarOpen(false);
    }

    useEffect(() => {
        if (ready === false) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }, [ready, router, pathname]);

    // Once per app load: rehydrate the profile from GET /api/v1/auth/me. A rejected token
    // (expired / revoked) clears the local session; a network failure keeps the cached profile.
    useEffect(() => {
        if (!ready) return;
        fetchMe()
            // API mode: fill the empty store from the backend once the session is confirmed.
            .then(() => hydrate())
            // API mode: the language saved for this user (else the login language) wins on app load.
            .then(() => {
                const saved = serverLocale();
                if (saved) setLocale(saved);
            })
            .catch((e: { code?: string }) => {
                if (e.code === "WBE_NETWORK") return;
                session.clear();
                router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    // API mode: a language change after hydration is saved on the backend (PUT /me/preferences).
    useEffect(() => {
        if (hydration.status === "idle" || hydration.status === "loading") return;
        saveLanguage(locale).catch(() => undefined); // best effort: localStorage keeps the choice on this browser
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locale]);

    // API mode: the header's working-MST switch reloads the MST-scoped data (no-op for the MST just hydrated).
    useEffect(() => {
        if (hydration.status !== "idle") void reloadForTaxId(activeTaxId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTaxId]);

    if (!ready) {
        return (
            <div className="flex h-screen items-center justify-center">
                <span className="size-6 rounded-full border-2 border-brand border-t-transparent wb-spin" />
            </div>
        );
    }
    return (
        <div className="flex h-screen w-full flex-col bg-white">
            <Header sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
            <div className="relative flex min-h-0 flex-1 items-stretch">
                <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-white">
                    {DATA_SOURCE === "api" && hydration.status === "loading" && (
                        <p className="shrink-0 border-b border-wb-border-sidebar bg-brand-soft px-4 py-1.5 text-wb-12 text-brand md:px-6" role="status">
                            {t("api.loading")}
                        </p>
                    )}
                    {DATA_SOURCE === "api" && hydration.status === "error" && (
                        <div className="shrink-0 border-b border-wb-warn-border/40 bg-wb-warn-bg px-4 py-2 text-wb-12 text-wb-warn-text md:px-6" role="alert">
                            <p className="font-semibold">{t("api.load_failed")}</p>
                            <ul className="mt-0.5">
                                {hydration.errors.map((x) => (
                                    <li key={x.endpoint}>
                                        {x.endpoint}: {x.error.message} ({x.error.code})
                                    </li>
                                ))}
                            </ul>
                            <button type="button" onClick={() => void hydrate()} className="mt-1 cursor-pointer font-semibold underline">
                                {t("common.retry")}
                            </button>
                        </div>
                    )}
                    {children}
                </main>
            </div>
            <CommandPalette />
        </div>
    );
}
