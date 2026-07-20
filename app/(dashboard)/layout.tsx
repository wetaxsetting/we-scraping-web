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
            {/* Global session-expired re-auth popup — ACTIVE-USAGE case
               only (confirmed requirement §1). While the app is loaded and
               the user is working, any in-page 401 surfaces this popup via
               the requestReAuth bus so the user re-authenticates in place
               and resumes on the same screen. Mounted unconditionally (not
               gated on `ready`) so its bus handler is registered before any
               in-page request can 401; a 401 that arrives before it mounts
               is caught up on registration (see lib/auth/sessionExpired.ts).

               The page-load / reload path (§2) is deliberately NOT handled
               here: the bootstrap fetchMe() 401 is excluded from the popup
               interceptor (lib/axios.ts) and instead flows to the catch
               above, which clears auth state and redirects to /login. The
               AppShell stays unmounted until `ready`, so no protected
               content is exposed before that redirect. */}
            <SessionExpiredDialog />
        </>
    );
}
