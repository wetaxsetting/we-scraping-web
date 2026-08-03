"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ApiState<T> = {
    data: T | null;
    error: Error | null;
    loading: boolean;
    /**
     * Overwrite the cached value without a network round-trip. For mutations
     * whose response already carries the refreshed resource (e.g. a POST that
     * returns the recalculated record) — seed it here instead of forcing a
     * follow-up GET. Does not re-fire the loader.
     */
    setData: (data: T) => void;
};

/**
 * Minimal client-side fetch hook used by Sprint 1 page wrappers. The page
 * mounts, fires the loader once, and renders the existing static-UI
 * component once data lands.
 *
 * Errors are surfaced via the `error` field — pages that already accept
 * a `rows` prop can fall back to whatever default they ship (mock data)
 * if `data` is null. This matches the gradual-rollout pattern: empty
 * backend responses degrade to the static demo seed without breaking
 * the page.
 *
 * `deps` are forwarded to the inner `useEffect` — pass any params that
 * should re-trigger the fetch (e.g. `[currency]`, `[accountId]`).
 */
export function useApiData<T>(
    loader: () => Promise<T>,
    deps: unknown[] = [],
): ApiState<T> {
    const [state, setState] = useState<Omit<ApiState<T>, "setData">>({
        data: null,
        error: null,
        loading: true,
    });
    // The loader closure changes on every render but the caller only wants
    // it re-fired when the explicit `deps` move. Capture the latest closure
    // so React's stale-closure rule doesn't bite when `deps` is empty.
    const loaderRef = useRef(loader);
    loaderRef.current = loader;

    useEffect(() => {
        let cancelled = false;
        // Stale-while-revalidate: keep the previous data visible
        // during a refetch so the page doesn't flash an empty table
        // when the user changes a filter / sort / search / page. Only
        // the first mount (and a subsequent error) sees `data === null`.
        // Same UX pattern React-Query / SWR ship by default.
        setState((prev) => ({ data: prev.data, error: null, loading: true }));
        loaderRef
            .current()
            .then((data) => {
                if (!cancelled) setState({ data, error: null, loading: false });
            })
            .catch((err) => {
                if (cancelled) return;
                const error = err instanceof Error ? err : new Error(String(err));
                // On error, clear stale data — surfacing the old rows
                // alongside an error banner would mislead the user
                // about what's actually backing the screen.
                setState({ data: null, error, loading: false });
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    const setData = useCallback((data: T) => {
        setState({ data, error: null, loading: false });
    }, []);

    return { ...state, setData };
}
