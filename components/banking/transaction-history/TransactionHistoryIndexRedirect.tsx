"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
    accountHref,
    useTransactionHistoryAccounts,
} from "./accounts";

type Props = {
    scope: "VND" | "FCY";
};

/**
 * Bare client wrapper that resolves the user's first account for the
 * given scope and redirects there. Replaces the legacy server-side
 * `redirect(accountHref(...))` flow which relied on a hardcoded
 * account list — accounts are now hydrated from
 * `/api/v1/banking/accounts?currency=…`.
 *
 * While the request is in flight the page renders nothing (the parent
 * dashboard layout already mounts the sidebar + header, so the user
 * sees the rail with a loading-empty children list). On empty result
 * we render a small "No accounts" stub — this is the safer behaviour
 * than redirecting to the parent route, which would loop.
 */
export default function TransactionHistoryIndexRedirect({ scope }: Props) {
    const router = useRouter();
    const { accounts, loading } = useTransactionHistoryAccounts(scope);

    useEffect(() => {
        if (loading) return;
        const first = accounts[0];
        if (first) {
            router.replace(accountHref(scope, first.id));
        }
    }, [router, scope, accounts, loading]);

    if (loading || accounts.length > 0) {
        // Render nothing while loading OR while the redirect effect is
        // about to fire. The parent dashboard layout still mounts.
        return null;
    }

    return (
        <div className="flex h-full items-center justify-center px-6 py-10 text-wb-13 font-medium text-wb-muted">
            No accounts available for this scope.
        </div>
    );
}
