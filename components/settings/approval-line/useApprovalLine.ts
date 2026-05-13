"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiCallError } from "@/lib/api/banking";
import {
    createApprovalLine,
    deleteApprovalLine,
    fetchApprovalLine,
    fetchApprovalLines,
    type FetchApprovalLinesParams,
    updateApprovalLine,
} from "@/lib/api/approvalLine";

import { toApprovalLineRow, toCreateRequest, toUpdateRequest } from "./mappers";
import type { ApprovalLineFormValues, ApprovalLineRow } from "./types";

/**
 * Shared list-fetch hook for the Approval Line panel. Holds the search
 * term (server-side ILIKE), runs the GET, and maps wire rows to the
 * in-memory shape consumed by the table + dialog.
 *
 * <p>Single fetch on (params, refetch token) change; previous results
 * stay rendered while a new fetch is in flight so the table doesn't
 * flash empty between requests. Errors surface via
 * {@link UseApprovalLineListState#error} (camelCase
 * `{ code, message }`) — the panel routes them through the shared
 * error dialog.
 *
 * <p>Mirrors the {@code useContacts.ts} precedent — same lifecycle,
 * same error envelope, same imperative refetch contract.
 */
export type UseApprovalLineListState = {
    rows:            ApprovalLineRow[];
    totalCount:      number;
    /** True while the FIRST fetch is in flight. */
    initialLoading:  boolean;
    /** True while ANY fetch is in flight. */
    fetching:        boolean;
    error:           { code: string; message: string } | null;
    /** Imperative refetch — e.g. after a successful mutation. */
    refetch:         () => Promise<void>;
};

export function useApprovalLineList(params: FetchApprovalLinesParams): UseApprovalLineListState {
    const [rows,           setRows]           = useState<ApprovalLineRow[]>([]);
    const [totalCount,     setTotalCount]     = useState(0);
    const [initialLoading, setInitialLoading] = useState(true);
    const [fetching,       setFetching]       = useState(false);
    const [error,          setError]          = useState<UseApprovalLineListState["error"]>(null);

    const run = useCallback(async () => {
        setFetching(true);
        setError(null);
        try {
            const res = await fetchApprovalLines(params);
            setRows((res.approval_lines ?? []).map(toApprovalLineRow));
            setTotalCount(res.total_count ?? 0);
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            setError({ code: ex.code ?? "NETWORK", message: ex.message ?? "Network error" });
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

    return { rows, totalCount, initialLoading, fetching, error, refetch };
}

/* =================================================================
 *  Mutations
 * ================================================================= */

export type ApprovalLineMutationsState = {
    submitting: boolean;
    error:      { code: string; message: string } | null;
    /** Lazy detail fetch — Edit dialog seeds its form on mount. */
    loadDetail: (apprLineNo: number) => Promise<ApprovalLineRow>;
    create:     (values: ApprovalLineFormValues) => Promise<ApprovalLineRow>;
    update:     (apprLineNo: number, values: ApprovalLineFormValues) => Promise<ApprovalLineRow>;
    remove:     (apprLineNo: number) => Promise<void>;
    clearError: () => void;
};

/**
 * Local mutation hook — wraps the writes, exposes submitting + error
 * state, and lets the caller `clearError()` between dialog opens.
 * The hook never refetches on its own; the panel calls
 * {@link UseApprovalLineListState#refetch} after a successful
 * mutation so side-effects stay explicit.
 */
export function useApprovalLineMutations(): ApprovalLineMutationsState {
    const [submitting, setSubmitting] = useState(false);
    const [error,      setError]      = useState<ApprovalLineMutationsState["error"]>(null);

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

    const loadDetail = useCallback(
        (apprLineNo: number) =>
            wrap(async () => toApprovalLineRow(await fetchApprovalLine(apprLineNo))),
        [wrap],
    );

    const create = useCallback(
        (values: ApprovalLineFormValues) =>
            wrap(async () => toApprovalLineRow(await createApprovalLine(toCreateRequest(values)))),
        [wrap],
    );

    const update = useCallback(
        (apprLineNo: number, values: ApprovalLineFormValues) =>
            wrap(async () =>
                toApprovalLineRow(await updateApprovalLine(apprLineNo, toUpdateRequest(values))),
            ),
        [wrap],
    );

    const remove = useCallback(
        (apprLineNo: number) => wrap(() => deleteApprovalLine(apprLineNo)),
        [wrap],
    );

    const clearError = useCallback(() => setError(null), []);

    return { submitting, error, loadDetail, create, update, remove, clearError };
}
