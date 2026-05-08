"use client";

import { useEffect, useRef, useState } from "react";

export type ApiState<T> = {
    data: T | null;
    error: Error | null;
    loading: boolean;
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
    const [state, setState] = useState<ApiState<T>>({
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
        setState({ data: null, error: null, loading: true });
        loaderRef
            .current()
            .then((data) => {
                if (!cancelled) setState({ data, error: null, loading: false });
            })
            .catch((err) => {
                if (cancelled) return;
                const error = err instanceof Error ? err : new Error(String(err));
                setState({ data: null, error, loading: false });
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return state;
}
