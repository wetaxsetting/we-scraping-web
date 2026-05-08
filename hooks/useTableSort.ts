"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Wire-format sort direction. Matches the backend
 * `com.kosign.wecms.common.web.SortDirection` enum (`ASC` / `DESC`) — the
 * cycle's default state is encoded as `null` rather than a sentinel so the
 * sort params are simply omitted from the API request.
 */
export type SortDirection = "ASC" | "DESC" | null;

export type TableSortState = {
    /** View Setting `FIELD_ID` currently driving the sort, or `null` for default. */
    sortField: string | null;
    /** `ASC` | `DESC` | `null` (default state — no user sort). */
    sortDirection: SortDirection;
};

export type UseTableSortReturn = TableSortState & {
    /**
     * Cycle the sort state for a single column. The cycle mirrors every
     * other WeCMS list page:
     *
     *   default → ASC (first click on a column)
     *          → DESC (second click on the same column)
     *          → default (third click on the same column)
     *
     * Clicking a different column resets the cycle to ASC on the new column.
     * Callers pass the View Setting `FIELD_ID` (uppercase semantic key
     * matching `SYS_SCR_OPTION_WECMS.field_id`).
     */
    toggleSort: (fieldId: string) => void;
    /**
     * Wire-shaped object suitable for spreading into an Axios `params`
     * object. `null` when the cycle is in its default state — pages should
     * spread `...(sortParams ?? {})` so the request omits both keys, and
     * the backend falls back to the legacy default ORDER BY.
     */
    sortParams: { sortField: string; sortDirection: "ASC" | "DESC" } | null;
    /**
     * Force a specific cycle state (useful when restoring from a URL or
     * persisted preference). Passing `{ sortField: null, sortDirection: null }`
     * returns to default.
     */
    setSort: (next: TableSortState) => void;
};

/**
 * Common table-sort hook backing every WeCMS list page that exposes
 * sortable column headers (Banking > Account Inquiry, future
 * Transaction History, Approval Box, e-Invoices, etc.). Owns the
 * `default → ASC → DESC → default` cycle and emits API-shaped params
 * the page passes to its data fetcher.
 *
 * The hook is screen-agnostic — it does NOT know which `FIELD_ID`s are
 * sortable. The caller is responsible for filtering its column registry
 * against `SORT_YN === "Y"` from the View Setting (and for never wiring
 * the special `CHECKBOX` / `ETC` columns into a sort handler) before
 * forwarding clicks here. Backend whitelist enforcement is the second
 * line of defence — unknown `FIELD_ID`s fall back to the default ORDER BY.
 *
 * Single hook per list page; do not wrap individual headers with their
 * own hook instance.
 */
export function useTableSort(initial?: Partial<TableSortState>): UseTableSortReturn {
    const [state, setState] = useState<TableSortState>({
        sortField: initial?.sortField ?? null,
        sortDirection: initial?.sortDirection ?? null,
    });

    const toggleSort = useCallback((fieldId: string) => {
        if (!fieldId) return;
        setState((prev) => {
            if (prev.sortField !== fieldId) {
                return { sortField: fieldId, sortDirection: "ASC" };
            }
            if (prev.sortDirection === "ASC") {
                return { sortField: fieldId, sortDirection: "DESC" };
            }
            if (prev.sortDirection === "DESC") {
                return { sortField: null, sortDirection: null };
            }
            return { sortField: fieldId, sortDirection: "ASC" };
        });
    }, []);

    const setSort = useCallback((next: TableSortState) => {
        setState({
            sortField: next.sortField ?? null,
            sortDirection: next.sortDirection ?? null,
        });
    }, []);

    const sortParams = useMemo(() => {
        if (state.sortField && (state.sortDirection === "ASC" || state.sortDirection === "DESC")) {
            return { sortField: state.sortField, sortDirection: state.sortDirection };
        }
        return null;
    }, [state.sortField, state.sortDirection]);

    return {
        sortField: state.sortField,
        sortDirection: state.sortDirection,
        toggleSort,
        setSort,
        sortParams,
    };
}
