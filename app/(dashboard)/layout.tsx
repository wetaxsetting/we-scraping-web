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

    return (
        <>
            {/* Mount the AppShell only after /me confirms the session.
               Before that the page renders nothing visible — the dialog
               below sits on a transparent root. */}
            {ready ? <AppShell>{children}</AppShell> : null}
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
