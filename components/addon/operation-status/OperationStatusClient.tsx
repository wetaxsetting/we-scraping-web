"use client";

import { useCallback, useEffect, useState } from "react";

import OperationStatusPage from "./OperationStatusPage";
import { useTableSort } from "@/hooks/useTableSort";
import { fetchOperationStatus } from "@/lib/api/addon";
import { ApiCallError } from "@/lib/api/banking";
import { mapOperationCompanyRow } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";

/**
 * Default page size — matches the canonical {@code PAGE_SIZE_OPTIONS[0]}
 * (10) so the dropdown selector and the initial fetch agree on the same
 * value. Backend clamps to {@code OperationStatusService.MAX_PAGE_SIZE}.
 */
const DEFAULT_PAGE_SIZE = 10;

/**
 * Keyword debounce — a refetch on every keystroke is wasteful. The page
 * sees the live value for input rendering (no lag in the box); the
 * network roundtrip waits for typing to settle.
 */
const KEYWORD_DEBOUNCE_MS = 300;

/**
 * Client wrapper around `<OperationStatusPage>`. Owns server-side filter
 * / pagination / sort state (q, companyStatus, page, pageSize, sort),
 * latches the most recent non-null response so chrome stays stable
 * across refetches, and forwards everything to the static page.
 *
 * <p>Update button → {@code refreshKey++} → refetch the same query
 * (Sprint 1 R&amp;D scope). Inquire CTA → no-op for now (the GDT bridge
 * is intentionally not wired — the button stays inert with an
 * explanatory tooltip until / unless NXISAS is ported).
 */
export default function OperationStatusClient() {
    const [refreshKey, setRefreshKey] = useState(0);

    const { sortField, sortDirection, sortParams, toggleSort } = useTableSort();

    // Server-side filter + pagination state. Mirrors the JEX
    // `aosv_0001_001_r001` input set with refactor-side names (q,
    // companyStatus). `page` is zero-based per Spring Data convention.
    const [keyword, setKeyword] = useState("");
    const [companyStatus, setCompanyStatus] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    // Update handler — re-fetch the local snapshot. Real GDT pull is
    // out of refactor R&D scope; mirror Sales e-Invoices' Phase-1
    // stance (refreshKey++ → refetch).
    const handleRefresh = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    // Debounced keyword used as the API dep. The input box always shows
    // the live `keyword`; the wire only changes when typing pauses.
    const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);
    useEffect(() => {
        const handle = window.setTimeout(
            () => setDebouncedKeyword(keyword),
            KEYWORD_DEBOUNCE_MS,
        );
        return () => window.clearTimeout(handle);
    }, [keyword]);

    const { data, error } = useApiData(
        () =>
            fetchOperationStatus({
                q: debouncedKeyword || undefined,
                companyStatus: companyStatus ?? undefined,
                ...(sortParams ?? {}),
                page,
                size: pageSize,
            }),
        // refreshKey forces a refetch on Update. Sort + filter + page
        // changes drive the rest. Keep this list aligned with the wire
        // call above so React doesn't fire stale requests.
        [
            refreshKey,
            sortField,
            sortDirection,
            debouncedKeyword,
            companyStatus,
            page,
            pageSize,
        ],
    );

    // Latch the latest non-null response so chrome (pagination labels,
    // total count, table rows) doesn't flicker between requests when
    // the user changes a filter — `useApiData` resets `data` to `null`
    // on every refetch. Pattern mirrors AccountInquiryClient.
    const [stableData, setStableData] = useState(data);
    const [prevData, setPrevData] = useState(data);
    if (data !== prevData) {
        setPrevData(data);
        if (data) setStableData(data);
    }

    const rows = stableData
        ? stableData.rows.map(mapOperationCompanyRow)
        : [];

    const errorCode = error instanceof ApiCallError ? error.code : null;
    const errorMessage = error ? error.message : null;

    return (
        <OperationStatusPage
            rows={rows}
            errorCode={errorCode}
            errorMessage={errorMessage}
            totalCompanies={stableData?.total_count ?? 0}
            totalPages={stableData?.total_pages ?? 1}
            keyword={keyword}
            companyStatus={companyStatus}
            page={page}
            pageSize={pageSize}
            sortField={sortField}
            sortDirection={sortDirection}
            sortParams={sortParams}
            onKeywordChange={(kw) => {
                setKeyword(kw);
                setPage(0);
            }}
            onCompanyStatusChange={(cs) => {
                setCompanyStatus(cs);
                setPage(0);
            }}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
            }}
            onSort={toggleSort}
            onRefresh={handleRefresh}
        />
    );
}
