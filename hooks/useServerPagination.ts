"use client";

import { useCallback, useState } from "react";

import { PAGE_SIZE_OPTIONS } from "@/components/shared/Pagination";

/**
 * Pagination state for a **server-paginated** list.
 *
 * `usePagination` (in `components/shared/Pagination.tsx`) owns the client-side
 * case: it takes the full `items` array and slices it. That cannot work when
 * the backend returns one page at a time, so this hook covers the other half of
 * the same concern — the state, the page-size reset, and the 1-based → 0-based
 * translation — instead of every screen re-declaring `useState` pairs and
 * remembering to reset the page when the size changes (CLAUDE.md §4 / §5).
 *
 * `page` is 1-based because `<Pagination>` renders 1-based page numbers;
 * `pageIndex` is the 0-based value the API expects.
 *
 * ```tsx
 * const pg = useServerPagination();
 * const { data } = useApiData(
 *   () => fetchRows({ page: pg.pageIndex, size: pg.pageSize }),
 *   [pg.page, pg.pageSize],
 * );
 * <Pagination page={pg.page} pageSize={pg.pageSize}
 *   pageCount={Math.max(1, data?.totalPages ?? 1)}
 *   onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} />
 * ```
 */
export function useServerPagination(initialPageSize: number = PAGE_SIZE_OPTIONS[0]) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSizeState] = useState<number>(initialPageSize);

    // Growing or shrinking the window invalidates the current offset, so the
    // list always returns to the first page — same contract as usePagination.
    const setPageSize = useCallback((size: number) => {
        setPageSizeState(size);
        setPage(1);
    }, []);

    return {
        /** 1-based, for `<Pagination>`. */
        page,
        /** 0-based, for the API request. */
        pageIndex: page - 1,
        pageSize,
        setPage,
        setPageSize,
        /** Back to page 1 — call from filter / search `onChange` handlers. */
        reset: useCallback(() => setPage(1), []),
    };
}
