"use client";

import { useCallback, useEffect, useState } from "react";

import InquireOperationStatusDialog from "./InquireOperationStatusDialog";
import OperationStatusPage from "./OperationStatusPage";
import { useDialog } from "@/components/shared/dialog";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import { fetchOperationStatus, updateOperationStatus } from "@/lib/api/addon";
import { ApiCallError } from "@/lib/api/banking";
import { mapOperationCompanyRow } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";

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
    const { t } = useTranslation();
    const dialog = useDialog();

    const [refreshKey, setRefreshKey] = useState(0);
    const [inquireOpen, setInquireOpen] = useState(false);
    /* Mutation-in-flight gate for the toolbar "Update" action. Held
     * alongside the action's own try/finally so the button stays
     * disabled across the await window. The functional guard (this
     * boolean checked at handler entry) blocks a duplicate request
     * before the sticky mirror flips. */
    const [updating, setUpdating] = useState(false);

    // Lifted selection state — owned here so the toolbar Update button
    // can target the selected subset. Set keyed by row.id (= TAXCODE).
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const { sortField, sortDirection, sortParams, toggleSort } = useTableSort();

    // Server-side filter + pagination state. Mirrors the JEX
    // `aosv_0001_001_r001` input set with refactor-side names (q,
    // companyStatus). `page` is zero-based per Spring Data convention.
    const [keyword, setKeyword] = useState("");
    const [companyStatus, setCompanyStatus] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    /**
     * Toolbar "Update" — re-polls cached rows from the GDT and upserts
     * fresh values. When the user has selected specific rows via the
     * checkbox column, only those tax codes are re-fetched; otherwise
     * the whole tenant cache is re-polled. Per-row errors do not abort
     * the batch; backend surfaces the `{total_attempted, updated, failed}`
     * counter for the success toast. No confirmation prompt — the
     * button click fires the call directly.
     */
    const handleRefresh = useCallback(async () => {
        if (updating) return; // guard against double-click while a refresh is in flight
        setUpdating(true);
        const targets = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
        try {
            const res = await updateOperationStatus(targets);
            setRefreshKey((k) => k + 1);
            // Clear selection on full-batch success — keep it on partial
            // failure so the user can see which rows were targeted.
            if (res.failed === 0 && selectedIds.size > 0) {
                setSelectedIds(new Set());
            }
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description:
                    res.failed > 0
                        ? t("operation.update.partial", {
                              updated: String(res.updated),
                              total:   String(res.total_attempted),
                              failed:  String(res.failed),
                          })
                        : t("operation.update.success", {
                              updated: String(res.updated),
                              total:   String(res.total_attempted),
                          }),
            });
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const msg = err instanceof Error ? err.message : t("common.error.unknown");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: msg,
                errorCode: code,
            });
        } finally {
            setUpdating(false);
        }
    }, [dialog, t, selectedIds, updating]);

    const handleInquire = useCallback(() => setInquireOpen(true), []);
    const handleInquireSaved = useCallback(() => setRefreshKey((k) => k + 1), []);

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

    const { data, error, loading } = useApiData(
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

    /* Smooth the initial loading → empty / loading → table transition.
     * `loading && !stableData` is true only while no response has
     * latched yet, so a fast cached fetch doesn't flicker the empty
     * message on and off before rows arrive. Search / filter /
     * pagination flicker on subsequent fetches is already prevented by
     * the stable-data latch above — the previous rows stay visible.
     * Mirrors the Settings module's VasAccountPanel pattern. */
    const stickyInitialLoading = useStickyLoading(loading && !stableData);

    /* Keep the Update / Inquire buttons visibly disabled for the
     * minimum-visibility window so a fast refresh doesn't flicker the
     * pill enabled → disabled → enabled. The functional guard
     * (`updating`) inside the handler still blocks duplicate requests. */
    const stickyUpdating = useStickyLoading(updating);

    const rows = stableData
        ? stableData.rows.map(mapOperationCompanyRow)
        : [];

    const errorCode = error instanceof ApiCallError ? error.code : null;
    const errorMessage = error ? error.message : null;

    return (
        <>
        <OperationStatusPage
            rows={rows}
            // Initial-load gate: true only while the very first fetch is in
            // flight (no response latched yet). Sticky-wrapped so a fast
            // cached response doesn't flash "Loading…" off the screen before
            // the user notices it (≥ 400 ms minimum-visibility window per
            // useStickyLoading). Subsequent refetches keep the previous rows
            // visible via `stableData`, so the empty-state shows "No Data
            // Found" rather than the loading message on a real empty result.
            // Mirrors the VAS Account `stickyInitialLoading` pattern.
            loading={stickyInitialLoading}
            updating={stickyUpdating}
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
            onInquire={handleInquire}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
        />
        <InquireOperationStatusDialog
            open={inquireOpen}
            onOpenChange={(o) => {
                setInquireOpen(o);
                // Reset the row checkboxes whenever the dialog closes — the
                // X / Close button and a successful Save all route through
                // onOpenChange(false) (Save → handleClose → onOpenChange).
                // Opening (o === true) never clears, so a selection made
                // before clicking Inquire survives until the popup is
                // actually dismissed. (Esc / outside-click are disabled on
                // this dialog, so there is no other close path.)
                if (!o) setSelectedIds(new Set());
            }}
            onSaved={handleInquireSaved}
        />
        </>
    );
}
