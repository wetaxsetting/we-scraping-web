"use client";

import { useCallback, useMemo, useState } from "react";

import TransferHistoryPage, {
    type StatusRadio,
    radioToWire,
} from "./TransferHistoryPage";
import { PAGE_SIZE_OPTIONS } from "@/components/shared/Pagination";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import {
    ApiCallError,
    fetchTransferHistory,
} from "@/lib/api/banking";
import {
    mapTransferHistoryRow,
    mapTransferHistoryTotals,
} from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";

/** Page-size whitelist — re-uses the canonical shared
 *  {@link PAGE_SIZE_OPTIONS} (`[10, 20, 50, 100]`) so the dropdown
 *  options on every list page in the app stay in sync (Own Account
 *  Transfer / Account Inquiry / Approval Box precedent). Backend's
 *  `@Pattern(regexp = "10|15|20|50|100")` accepts 15 too, but the
 *  frontend doesn't surface it — keeping the dropdown identical to
 *  the rest of the app. Default 10 matches every other list page. */
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSizeOption = 10;

/** Default range matches the legacy view's `last 7 days` initialisation
 *  (`trns_0003_001.ts:149` → `comm_0106_001.loadinitializeDate(..., -7, …)`). */
function defaultRangeIso(): { start: string; end: string } {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7);
    const start = startDate.toISOString().slice(0, 10);
    return { start, end };
}

/** Convert ISO `YYYY-MM-DD` to the wire's `YYYYMMDD`. */
function isoToWireDate(iso: string): string {
    return iso.replaceAll("-", "");
}

/**
 * Client wrapper for Banking > Internal Transfer > Transfer History
 * (`/banking/transfer-history`). Owns date-range / status / pagination
 * state and fetches from
 * `GET /api/v1/banking/internal-transfer/transfer-history` with the
 * snake_case query params delivered in Prompt 2.
 *
 * <p>The static `<TransferHistoryPage>` is the presentational layer;
 * the wire ↔ in-memory translation happens here via the mappers in
 * `lib/api/mappers.ts`.
 *
 * <p>View Setting popover is NOT rendered — feature spec § 8.4 / OQ-5,
 * matches the legacy panel which has no toolbar list-icon button. The
 * screenId `transfer-history` is still registered in
 * `SCREEN_IDS.TRANSFER_HISTORY` for the audit / log / future-popover
 * identifier surface.
 *
 * <p>Audit-log: no AUDIT_LOGS_INFM writes from the backend (read-only,
 * legacy parity).
 */
export default function TransferHistoryClient() {
    const { t } = useTranslation();

    const [range, setRange] = useState(defaultRangeIso);
    const [statusRadio, setStatusRadio] = useState<StatusRadio>("all");
    const [pageNo, setPageNo] = useState<number>(1);
    const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);

    // Common-sort hook — owns the `default → ASC → DESC → default` cycle
    // and emits API-shaped params (`sortField` / `sortDirection`) the
    // fetcher passes verbatim to the backend whitelist
    // (`TransferHistorySortField`).
    const { sortField, sortDirection, sortParams, toggleSort } = useTableSort();

    // Page-resetting wrappers keep filter-change → page-1 invariant
    // in one place instead of scattering `setPageNo(1)` across handlers.
    const handleDateRangeChange = useCallback(
        (next: { start: string; end: string }) => {
            setRange(next);
            setPageNo(1);
        },
        [],
    );
    const handleStatusRadioChange = useCallback((next: StatusRadio) => {
        setStatusRadio(next);
        setPageNo(1);
    }, []);
    const handlePageSizeChange = useCallback((next: number) => {
        const allowed = PAGE_SIZE_OPTIONS.find((opt) => opt === next);
        if (allowed != null) {
            setPageSize(allowed);
            setPageNo(1);
        }
    }, []);
    const handlePageChange = useCallback((next: number) => {
        setPageNo(Math.max(1, next));
    }, []);
    const handleSort = useCallback((fieldId: string) => {
        toggleSort(fieldId);
        setPageNo(1);
    }, [toggleSort]);

    const fromDt = useMemo(() => isoToWireDate(range.start), [range.start]);
    const toDt   = useMemo(() => isoToWireDate(range.end),   [range.end]);
    const trnsStts = useMemo(() => radioToWire(statusRadio), [statusRadio]);

    const { data, error, loading } = useApiData(
        () =>
            fetchTransferHistory({
                fromDt,
                toDt,
                trnsStts: trnsStts === "" ? undefined : trnsStts,
                pageNo,
                pagePerCnt: pageSize,
                sort: sortParams,
            }),
        // `sortParams` is null in the default state — spread into the deps
        // via its primitive members so the effect only re-fires when the
        // user actually changes the sort.
        [
            fromDt, toDt, trnsStts, pageNo, pageSize,
            sortParams?.sortField ?? null,
            sortParams?.sortDirection ?? null,
        ],
    );

    /* Latch the latest non-null response so date / status / pagination
     * / sort refetches don't blank the table chrome between requests
     * (`useApiData` resets `data` to null on every dep change). Mirrors
     * the AccountInquiry / OperationStatus pattern. */
    const [stableData, setStableData] = useState(data);
    const [prevData, setPrevData] = useState(data);
    if (data !== prevData) {
        setPrevData(data);
        if (data) setStableData(data);
    }

    const rows = useMemo(
        () => stableData?.rows.map(mapTransferHistoryRow) ?? [],
        [stableData],
    );
    const totals = useMemo(
        () => (stableData ? mapTransferHistoryTotals(stableData) : undefined),
        [stableData],
    );

    /* Sticky-wrap the initial-load gate so the centered "Loading…"
     * message stays visible for the minimum-visibility window on
     * first paint. Once `stableData` lights up, subsequent refetches
     * keep the previous rows visible and the sticky gate never trips
     * again. Mirrors the AccountInquiry / OperationStatus pattern. */
    const stickyInitialLoading = useStickyLoading(loading && !stableData);

    const errorPair = useMemo(() => {
        if (!error) return { message: null as string | null, code: null as string | null };
        if (error instanceof ApiCallError) {
            // Map Coocon-source backend codes (engine timeout / engine failure
            // surfaced by upstream Transfer Register persistence) to the
            // localised banner copy. Read-only Transfer History only sees
            // `WBE_TRANSFER_HISTORY_INVALID_PERIOD`, `WBE_VALIDATION`, plus
            // generic transport errors (`NETWORK`, `WBE9999`).
            const key = errorKeyForCode(error.code);
            return {
                message: t(key) || error.message,
                code: error.code,
            };
        }
        return {
            message: t("transfer_history.error.network") || error.message,
            code: "NETWORK",
        };
    }, [error, t]);

    return (
        <TransferHistoryPage
            rows={rows}
            total={totals}
            startIsoDate={range.start}
            endIsoDate={range.end}
            onDateRangeChange={handleDateRangeChange}
            statusRadio={statusRadio}
            onStatusRadioChange={handleStatusRadioChange}
            pageNo={pageNo}
            pageSize={pageSize}
            totalCount={stableData?.total_count ?? 0}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            loading={stickyInitialLoading}
            errorMessage={errorPair.message}
            errorCode={errorPair.code}
        />
    );
}

/** Map a backend error code to a localised banner message key. Unknown
 *  codes fall back to the generic key. Surfaces engine-side timeout /
 *  failure codes a future Internal Transfer Register MR may bubble up
 *  through the upstream write path — even though Transfer History itself
 *  is read-only, the row may have been stamped with an engine error
 *  message which the banner is well-positioned to explain. */
function errorKeyForCode(code: string): string {
    switch (code) {
        case "WBE_TRANSFER_HISTORY_INVALID_PERIOD":
            return "transfer_history.error.invalid_period";
        case "WBE_VALIDATION":
            return "transfer_history.error.validation";
        case "NETWORK":
            return "transfer_history.error.network";
        case "WBE_COOCON_TIMEOUT":
            return "transfer_history.error.coocon_timeout";
        case "WBE_COOCON_FAILURE":
            return "transfer_history.error.coocon_failure";
        default:
            return "transfer_history.error.unknown";
    }
}
