"use client";

import { startTransition, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import SessionExpiredDialog from "@/components/auth/SessionExpiredDialog";
import { fetchMe } from "@/lib/auth/client";
import { tokenStorage, userStorage } from "@/lib/auth/storage";

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
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const me = await fetchMe();
                if (cancelled) return;
                userStorage.set(me);
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

    if (!ready) return null;

    return (
        <>
            <AppShell>{children}</AppShell>
            {/* Global session-expired re-auth modal. Mounts inside the
               authenticated tree so the bus is only listening when the
               user is actually past /login. */}
            <SessionExpiredDialog />
        </>
    );
}
