"use client";

import { useEffect, useState } from "react";

import { fetchNavigation, type NavigationTree } from "@/lib/api/navigation";
import { userStorage } from "@/lib/auth/storage";

/**
 * Loads the resolved navigation tree from `GET /api/v1/navigation` once per
 * session and caches it in module memory so route changes (the sidebar stays
 * mounted in `<AppShell>`) and additional consumers don't refetch.
 *
 * The cache is keyed by `bizKey` so a logout→login as a different tenant in
 * the same tab refetches instead of showing the previous tenant's tree.
 *
 * Failure / loading degrade safely: `tree` stays `null` and the caller renders
 * an empty rail (the shell chrome + module switcher still paint) rather than
 * crashing — there is no hardcoded per-product fallback by design (Phase 2
 * removes the hardcoded sidebar arrays).
 */

let cacheKey: string | null = null;
let cacheTree: NavigationTree | null = null;
let inflight: Promise<NavigationTree> | null = null;

/** Test/login-flow seam — drop the cache so the next mount refetches. */
export function clearNavigationCache(): void {
    cacheKey = null;
    cacheTree = null;
    inflight = null;
}

export type NavigationState = {
    tree: NavigationTree | null;
    loading: boolean;
    error: Error | null;
};

export function useNavigation(): NavigationState {
    const bizKey = userStorage.get()?.bizKey ?? "";

    // The initializer reflects the cache for the current tenant; a cache miss
    // starts in the loading state. The sidebar lives in `<AppShell>` and only
    // remounts on a full logout→login, so `bizKey` does not change in place —
    // the initializer is the source of truth on every mount and the effect
    // never needs a synchronous loading reset.
    const [state, setState] = useState<NavigationState>(() =>
        cacheTree && cacheKey === bizKey
            ? { tree: cacheTree, loading: false, error: null }
            : { tree: null, loading: true, error: null },
    );

    useEffect(() => {
        // Cache hit for the current tenant — initializer already reflects it.
        if (cacheTree && cacheKey === bizKey) return;

        // Cache miss / tenant changed — fetch once, sharing any in-flight
        // request across concurrent consumers. State is updated only from the
        // async callbacks (never synchronously in the effect body).
        let cancelled = false;
        if (!inflight || cacheKey !== bizKey) {
            cacheKey = bizKey;
            cacheTree = null;
            inflight = fetchNavigation();
        }
        inflight
            .then((tree) => {
                cacheTree = tree;
                cacheKey = bizKey;
                inflight = null;
                if (!cancelled) setState({ tree, loading: false, error: null });
            })
            .catch((err) => {
                inflight = null;
                const error = err instanceof Error ? err : new Error(String(err));
                if (!cancelled) setState({ tree: null, loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, [bizKey]);

    return state;
}
