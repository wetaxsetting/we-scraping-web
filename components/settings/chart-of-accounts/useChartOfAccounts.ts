"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiCallError } from "@/lib/api/banking";
import {
    bulkDeactivateChartOfAccounts,
    bulkDeleteChartOfAccounts,
    createChartOfAccount,
    deleteChartOfAccount,
    fetchChartOfAccounts,
    type FetchChartOfAccountsParams,
    updateChartOfAccount,
} from "@/lib/api/chartOfAccounts";
import type { ApiChartOfAccountBulkActionResponse } from "@/lib/types/api";

import {
    sortChartOfAccountsRows,
    toChartOfAccountsRequest,
    toChartOfAccountsRow,
    toChartOfAccountsUpdateRequest,
} from "./mappers";
import type { ChartOfAccountsFormValues, ChartOfAccountsRow } from "./types";

/**
 * Shared list-fetch hook for the Chart of Accounts panel. Holds the
 * search term + sort tuple, runs the GET, maps wire rows to the
 * in-memory shape, and tree-sorts so restricted roots and their
 * descendants appear together. Mirrors the {@code useApprovalLine}
 * precedent — same lifecycle, same error envelope, same imperative
 * refetch contract.
 *
 * <p>Single fetch on (params, refetch token) change; previous results
 * stay rendered while a new fetch is in flight so the table doesn't
 * flash empty between requests. Errors surface via
 * {@link UseChartOfAccountsListState#error} (camelCase
 * {@code code, message}) — the panel routes them through the shared
 * error dialog.
 */
export type UseChartOfAccountsListState = {
    rows:            ChartOfAccountsRow[];
    totalCount:      number;
    restrictedCodes: Set<string>;
    /** True while the FIRST fetch is in flight. */
    initialLoading:  boolean;
    /** True while ANY fetch is in flight. */
    fetching:        boolean;
    error:           { code: string; message: string } | null;
    refetch:         () => Promise<void>;
};

export function useChartOfAccountsList(
    params: FetchChartOfAccountsParams,
): UseChartOfAccountsListState {
    const [rows,            setRows]            = useState<ChartOfAccountsRow[]>([]);
    const [totalCount,      setTotalCount]      = useState(0);
    const [restrictedCodes, setRestrictedCodes] = useState<Set<string>>(new Set());
    const [initialLoading,  setInitialLoading]  = useState(true);
    const [fetching,        setFetching]        = useState(false);
    const [error,           setError]           = useState<UseChartOfAccountsListState["error"]>(null);

    const run = useCallback(async () => {
        setFetching(true);
        setError(null);
        try {
            const res = await fetchChartOfAccounts(params);
            const mapped = (res.items ?? []).map(toChartOfAccountsRow);
            setRows(sortChartOfAccountsRows(mapped));
            setTotalCount(res.total_count ?? mapped.length);
            setRestrictedCodes(new Set(res.restricted_codes ?? []));
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            setError({
                code:    ex.code ?? "NETWORK",
                message: ex.message ?? "Network error",
            });
        } finally {
            setInitialLoading(false);
            setFetching(false);
        }
    }, [params]);

    useEffect(() => {
        void run();
    }, [run]);

    const refetch = useCallback(async () => {
        await run();
    }, [run]);

    return { rows, totalCount, restrictedCodes, initialLoading, fetching, error, refetch };
}

/* =================================================================
 *  Mutations
 * ================================================================= */

export type ChartOfAccountsMutationsState = {
    submitting: boolean;
    error:      { code: string; message: string } | null;
    create:     (values: ChartOfAccountsFormValues) => Promise<ChartOfAccountsRow>;
    update:     (
        chartAcctSeqNo: string,
        values: ChartOfAccountsFormValues,
    ) => Promise<ChartOfAccountsRow>;
    remove:     (chartAcctSeqNo: string) => Promise<void>;
    /** Bulk soft-delete by seq_no. Per-row failures (restricted code,
     *  not found, etc.) are tallied server-side and returned as
     *  {@code failed} — the caller decides whether to surface a
     *  partial-success vs. full-success dialog. */
    bulkRemove: (chartAcctSeqNos: string[]) => Promise<ApiChartOfAccountBulkActionResponse>;
    /** Bulk deactivate (flip {@code STTS='I'}) by seq_no. Idempotent
     *  per-row server-side; restricted roots are tallied in
     *  {@code failed}. */
    bulkDeactivate: (chartAcctSeqNos: string[]) => Promise<ApiChartOfAccountBulkActionResponse>;
    clearError: () => void;
};

/**
 * Local mutation hook — wraps the writes, exposes submitting + error
 * state, and lets the caller {@code clearError()} between dialog
 * opens. The hook never refetches on its own; the panel calls
 * {@link UseChartOfAccountsListState#refetch} after a successful
 * mutation so side-effects stay explicit (same precedent as
 * {@code useApprovalLine}).
 */
export function useChartOfAccountsMutations(): ChartOfAccountsMutationsState {
    const [submitting, setSubmitting] = useState(false);
    const [error,      setError]      = useState<ChartOfAccountsMutationsState["error"]>(null);

    const wrap = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
        setSubmitting(true);
        setError(null);
        try {
            return await fn();
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            setError({
                code:    ex.code ?? "NETWORK",
                message: ex.message ?? "Network error",
            });
            throw e;
        } finally {
            setSubmitting(false);
        }
    }, []);

    const create = useCallback(
        (values: ChartOfAccountsFormValues) =>
            wrap(async () =>
                toChartOfAccountsRow(
                    await createChartOfAccount(toChartOfAccountsRequest(values)),
                ),
            ),
        [wrap],
    );

    const update = useCallback(
        (chartAcctSeqNo: string, values: ChartOfAccountsFormValues) =>
            wrap(async () =>
                toChartOfAccountsRow(
                    await updateChartOfAccount(
                        chartAcctSeqNo,
                        toChartOfAccountsUpdateRequest(values),
                    ),
                ),
            ),
        [wrap],
    );

    const remove = useCallback(
        (chartAcctSeqNo: string) => wrap(() => deleteChartOfAccount(chartAcctSeqNo)),
        [wrap],
    );

    const bulkRemove = useCallback(
        (chartAcctSeqNos: string[]) =>
            wrap(() => bulkDeleteChartOfAccounts(chartAcctSeqNos)),
        [wrap],
    );

    const bulkDeactivate = useCallback(
        (chartAcctSeqNos: string[]) =>
            wrap(() => bulkDeactivateChartOfAccounts(chartAcctSeqNos)),
        [wrap],
    );

    const clearError = useCallback(() => setError(null), []);

    return { submitting, error, create, update, remove, bulkRemove, bulkDeactivate, clearError };
}
