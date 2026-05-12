"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
    fetchEnvironmentSetting,
    updateEnvironmentSetting,
} from "@/lib/api/environmentSettings";

/**
 * Strict Y/N → boolean coercion. ONLY the exact uppercase string
 * {@code "Y"} maps to {@code true}; everything else (including
 * {@code "N"}, {@code null}, blanks, lowercase {@code "y"}) maps to
 * {@code false}. Mirrors the legacy whitelist semantics in
 * {@code comm_0215_001_u001_act.jsp} where the save action only
 * accepts an exact-match Y/N value.
 */
function isYesValue(value: string | null | undefined): boolean {
    return value === "Y";
}

/**
 * Hook for tenant environment-settings flags (legacy
 * {@code BUSI_ENV_SET_INFM}). Mirrors legacy semantics:
 *
 * <ul>
 *   <li>Initial mount fires one {@code GET /api/v1/settings/environment-settings/{code}}
 *       per code in parallel — backend applies COALESCE(BUSI, SYS)
 *       so the response carries the effective value for the tenant.</li>
 *   <li>{@code setEnabled(code, next)} fires {@code PUT} with the new
 *       value. Optimistic update + revert-on-error mirrors the legacy
 *       immediate-save UX: the UI flips at click time, the network
 *       call settles, and on rejection the value reverts and the
 *       error propagates to the caller.</li>
 * </ul>
 *
 * <p>Concurrency: rapid toggles on the same flag race; the last
 * settled PUT wins. The optimistic value reflects the most recent
 * click — matches legacy where the checkbox always represents the
 * user's last intent.
 *
 * <p>The {@code codes} array MUST be a stable reference across
 * renders (memoize at the call site or define as a module-level
 * constant) — the load effect re-runs whenever the join of codes
 * changes.
 */
export type UseEnvironmentSettingsResult = {
    values: Record<string, boolean>;
    loading: boolean;
    loadError: Error | null;
    setEnabled: (code: string, next: boolean) => Promise<void>;
};

export function useEnvironmentSettings(
    codes: ReadonlyArray<string>,
): UseEnvironmentSettingsResult {
    const [values, setValues] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<Error | null>(null);

    const cancelledRef = useRef(false);
    // Stable string key over the codes — drives the effect's deps so
    // a parent re-rendering with a fresh array literal of the same
    // contents does not re-fetch.
    const codesKey = codes.join(",");

    useEffect(() => {
        cancelledRef.current = false;
        if (codes.length === 0) {
            setValues({});
            setLoadError(null);
            setLoading(false);
            return () => {};
        }
        Promise.all(codes.map((c) => fetchEnvironmentSetting(c)))
            .then((rows) => {
                if (cancelledRef.current) return;
                const next: Record<string, boolean> = {};
                for (const row of rows) {
                    next[row.env_set_inf] = isYesValue(row.env_set_cont);
                }
                setValues(next);
                setLoadError(null);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelledRef.current) return;
                setLoadError(err instanceof Error ? err : new Error(String(err)));
                setLoading(false);
            });
        return () => {
            cancelledRef.current = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codesKey]);

    const setEnabled = useCallback(
        async (code: string, next: boolean): Promise<void> => {
            const prev = values[code] ?? false;
            setValues((curr) => ({ ...curr, [code]: next }));
            try {
                const saved = await updateEnvironmentSetting(code, {
                    env_set_cont: next ? "Y" : "N",
                });
                // Reconcile with the persisted value in case backend
                // canonicalised it (e.g. trimmed). Legacy returns the
                // saved string verbatim; this keeps the optimistic
                // update aligned with what was actually written.
                setValues((curr) => ({
                    ...curr,
                    [code]: isYesValue(saved.env_set_cont),
                }));
            } catch (err) {
                setValues((curr) => ({ ...curr, [code]: prev }));
                throw err;
            }
        },
        [values],
    );

    return { values, loading, loadError, setEnabled };
}
