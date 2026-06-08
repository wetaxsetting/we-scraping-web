"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiCallError } from "@/lib/api/banking";
import {
    createVasAccount,
    deleteVasAccount,
    fetchVasAccounts,
    type FetchVasAccountsParams,
    updateVasAccount,
} from "@/lib/api/vasAccount";
import type { ApiVasAccountRow } from "@/lib/types/api";

import {
    buildTree,
    toCreateRequest,
    toUpdateRequest,
} from "./mappers";
import type { VasAccountFormValues, VasAccountRow } from "./types";

/**
 * Shared list-fetch hook for the VAS Account panel. Holds the filter
 * state (search, status filter), runs the filtered GET, and maps the
 * flat backend rows into the tree shape the table consumes.
 *
 * <p>The panel passes `all: true` so the GET returns the entire filtered
 * set (no pagination) — `buildTree` therefore builds the prefix-code
 * hierarchy over the FULL dataset, never a single page slice. This is
 * legacy parity (`comm_0217_001_r001` has no paging) and fixes the
 * audit's RISK-1 (20-row cap) + RISK-2 (tree split across pages).
 *
 * <p>Single fetch on (params, refresh-token) change; previous results
 * stay rendered while a new fetch is in flight so the table doesn't
 * flash empty between requests. Errors are surfaced via {@link
 * UseVasAccountListState#error} (camelCase `{ code, message }`) — the
 * panel decides whether to render an inline empty state, dispatch the
 * shared error dialog, or both.
 *
 * <p>Empty status set behaves like the legacy two-checkbox toggle:
 * both ticked = no filter. Skipping the wire call when neither is
 * ticked mirrors `comm_0217_001.ts` (no rows in that legacy state).
 */
export type UseVasAccountListState = {
    /** Tree rows ready for the table renderer. */
    rows: VasAccountRow[];
    /** Raw flat rows (before tree building) — exposed so the panel can
     *  look up a row by `id` when opening the Edit dialog without a
     *  second network call. */
    rawRows: ApiVasAccountRow[];
    totalCount: number;
    /** True while the FIRST fetch is in flight. Subsequent fetches
     *  keep the prior list rendered. */
    initialLoading: boolean;
    /** True while ANY fetch is in flight (initial or refetch). Panel
     *  uses this to dim the table or show a corner spinner. */
    fetching: boolean;
    error: { code: string; message: string } | null;
    /** Imperative refetch — e.g. after a successful create / update /
     *  delete. Resolves when the new list is in state. */
    refetch: () => Promise<void>;
};

export function useVasAccountList(params: FetchVasAccountsParams): UseVasAccountListState {
    const [rawRows, setRawRows] = useState<ApiVasAccountRow[]>([]);
    const [rows, setRows] = useState<VasAccountRow[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [initialLoading, setInitialLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<UseVasAccountListState["error"]>(null);

    // Empty status set ⇒ no rows; mirrors legacy "no checkbox ticked"
    // behaviour without hitting the wire.
    const emptyStatuses = (params.statuses?.length ?? 0) === 0;

    const run = useCallback(async () => {
        if (emptyStatuses) {
            setRawRows([]);
            setRows([]);
            setTotalCount(0);
            setError(null);
            setInitialLoading(false);
            return;
        }
        setFetching(true);
        setError(null);
        try {
            const res = await fetchVasAccounts(params);
            setRawRows(res.list);
            setRows(buildTree(res.list));
            setTotalCount(res.total_count);
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            setError({ code: ex.code ?? "NETWORK", message: ex.message ?? "Network error" });
        } finally {
            setInitialLoading(false);
            setFetching(false);
        }
    }, [
        emptyStatuses,
        params,
    ]);

    useEffect(() => {
        void run();
    }, [run]);

    const refetch = useCallback(async () => {
        await run();
    }, [run]);

    return { rows, rawRows, totalCount, initialLoading, fetching, error, refetch };
}

/* =================================================================
 *  Mutations
 * ================================================================= */

export type VasAccountMutationsState = {
    submitting: boolean;
    error: { code: string; message: string } | null;
    create: (values: VasAccountFormValues) => Promise<ApiVasAccountRow>;
    update: (seqNo: string, values: VasAccountFormValues) => Promise<ApiVasAccountRow>;
    remove: (seqNo: string) => Promise<void>;
    clearError: () => void;
};

/**
 * Local mutation hook — wraps the three writes, exposes submitting +
 * error state, and lets the caller `clearError()` between dialog
 * opens. The hook never refetches on its own; the parent component
 * calls `useVasAccountList().refetch()` after a successful mutation
 * so the side-effects are explicit (no hidden refetches).
 */
export function useVasAccountMutations(): VasAccountMutationsState {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<VasAccountMutationsState["error"]>(null);

    const wrap = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
        setSubmitting(true);
        setError(null);
        try {
            return await fn();
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            const payload = { code: ex.code ?? "NETWORK", message: ex.message ?? "Network error" };
            setError(payload);
            throw e;
        } finally {
            setSubmitting(false);
        }
    }, []);

    const create = useCallback(
        (values: VasAccountFormValues) => wrap(() => createVasAccount(toCreateRequest(values))),
        [wrap],
    );

    const update = useCallback(
        (seqNo: string, values: VasAccountFormValues) =>
            wrap(() => updateVasAccount(seqNo, toUpdateRequest(values))),
        [wrap],
    );

    const remove = useCallback((seqNo: string) => wrap(() => deleteVasAccount(seqNo)), [wrap]);

    const clearError = useCallback(() => setError(null), []);

    return { submitting, error, create, update, remove, clearError };
}
