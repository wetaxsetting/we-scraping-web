"use client";

import { startTransition, useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import SessionExpiredDialog from "@/components/auth/SessionExpiredDialog";
import { fetchMe } from "@/lib/auth/client";
import { tokenStorage, userStorage, type StoredUser } from "@/lib/auth/storage";
import { firstAllowedRoute, isRouteAllowed } from "@/lib/menuAuth";
import { useTranslation } from "@/lib/i18n";

/**
 * Shared shell for every authenticated route.
 *
 * Route group `(dashboard)` is a Next.js grouping — it does not appear in the
 * URL. Pages live under real feature paths such as `/banking/account-inquiry`,
 * `/payment/…`, `/settings/…`. Any new feature page that needs auth + the
 * AppShell chrome should be created under `app/(dashboard)/…` to inherit both.
 *
 * Route protection is enforced by `proxy.ts` at the edge — by the time this
 * layout renders, the request has already been gated on the `wecms_token`
 * cookie. This layout's only job is to rehydrate the in-memory user from
 * `/auth/me` (source of truth) so the sidebar/profile chrome reflects the
 * current session even after a cookie refresh. A failed /me call means the
 * token is revoked/expired — clear local state and bounce to `/login`.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useTranslation();
    const [ready, setReady] = useState(false);
    const [me, setMe] = useState<StoredUser | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const meResp = await fetchMe();
                if (cancelled) return;
                userStorage.set(meResp);
                setMe(meResp);
                startTransition(() => setReady(true));
            } catch {
                if (cancelled) return;
                tokenStorage.clear();
                userStorage.clear();
                router.replace("/login");
            }
        })();
        return () => { cancelled = true; };
    }, [router]);

    // Menu Authorization (MENU-1) route guard: a normal user who hits an
    // ungranted page by URL is redirected to their first allowed route.
    // Admins (allMenus) pass everything; non-module routes are not gated.
    // When the user has NO granted route at all, we render a notice
    // instead of redirecting — avoids a redirect loop.
    const allowed = !me || isRouteAllowed(pathname, me);
    const landing = me ? firstAllowedRoute(me) : null;

    useEffect(() => {
        if (!ready || !me || allowed) return;
        if (landing) router.replace(landing);
    }, [ready, me, allowed, landing, pathname, router]);

    return (
        <>
            {/* Mount the AppShell only after /me confirms the session AND
               the current route is permitted. A blocked route renders
               nothing while the guard redirects; a user with zero granted
               menus (no landing) gets a notice instead of a redirect loop. */}
            {ready && allowed ? (
                <AppShell>{children}</AppShell>
            ) : ready && !allowed && !landing ? (
                <div className="flex min-h-screen items-center justify-center p-10 text-center">
                    <p className="text-wb-14 font-medium text-wb-ntrl-8">{t("nav.no_menus")}</p>
                </div>
            ) : null}
            {/* Global session-expired re-auth modal. MUST mount
               unconditionally — the legacy JEX trigger surface is
               jex.wabooks.custom_v2.js:91-117 ("any AJAX response with
               SES001 opens comm_0300_001"). The refactor equivalent is:
               any HTTP 401 from any authenticated call surfaces this
               popup via the requestReAuth bus. If we gated the dialog
               on `ready`, the very first /me 401 (token expired in the
               background while the tab was idle) would fall through to
               the catch path above and bounce the user to /login —
               the same regression legacy avoided by mounting the lock
               screen on every page. Keeping it mounted lets the bus
               handler register before fetchMe() runs, so an expired
               token surfaces the popup instead of a redirect. */}
            <SessionExpiredDialog />
        </>
    );
}
