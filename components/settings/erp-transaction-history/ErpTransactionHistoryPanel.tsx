"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
    type DateRangeFilterPreset,
    type DateRangeFilterValue,
} from "@/components/shared/DateRangeFilter";
import Pagination from "@/components/shared/Pagination";
import { useDialog } from "@/components/shared/dialog";
import { useTableSort } from "@/hooks/useTableSort";
import { ApiCallError } from "@/lib/api/banking";
import {
    fetchErpTransactionHistory,
    getErpTransactionHistoryDownloadUrl,
} from "@/lib/api/erpTransactionHistory";
import { mapErpTransactionHistoryRow } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { downloadFile } from "@/lib/file";
import { useTranslation } from "@/lib/i18n";

import ErpTransactionHistoryFilters, {
    type TransactionTypeOption,
} from "./ErpTransactionHistoryFilters";
import ErpTransactionHistoryTable from "./ErpTransactionHistoryTable";
import ErpTransactionHistoryTabs from "./ErpTransactionHistoryTabs";
import {
    DELETED_TAB_TYPE_SUBSET,
    type ErpDirection,
    type ErpTransactionHistoryRow,
    type ErpTransactionHistoryTabCounts,
    type ErpTransactionHistoryTabKey,
} from "./types";

/**
 * ERP Transaction History panel — Figma 134:16546 (Settings popup
 * submenu). Mirrors legacy `comm_0219_001` (list + 4 counts) and
 * `comm_0219_001_r002` (per-row file download).
 *
 * <p>Wires the panel to the Phase 2 backend
 * `GET /api/v1/settings/erp-transaction-history` via
 * `lib/api/erpTransactionHistory.ts`. Owns server-side filter +
 * pagination + sort state, debounces keyword input, and latches the
 * latest non-null response so the table chrome doesn't flicker
 * between refetches (canonical FBH / AccountInquiryClient pattern).
 *
 * <p>Layout (top → bottom, all inside the modal's right column):
 * <pre>
 *   [Header]      — title + description (shrink-0); pr-24 clears the shell's Esc/X
 *   [Tabs]        — All / WeCMS → ERP / ERP → WeCMS / Deleted
 *   [Filters]     — date range + transaction-type dropdown + Search
 *   [Table]       — ONLY this region scrolls (vertical + horizontal as needed)
 *   [Pagination]  — fixed at the bottom, OUTSIDE the scroll container
 * </pre>
 *
 * <p>Errors surface via the global system dialog. Validation errors
 * (`WBE_VALIDATION`) are suppressed since the panel's own state guards
 * against them. File-download failures (`WBE2014` / `WBE2015`) route
 * through the same dialog with the backend's error code.
 *
 * <p>Refactor-only behaviour (intentional divergence from legacy):
 * <ul>
 *   <li>Product-agnostic (OQ-2 resolved 2026-05-11) — no `prdt_type`
 *       branching. All four tabs always visible; File column always
 *       visible; all 17 transaction-type codes in the dropdown on
 *       non-Deleted tabs.</li>
 *   <li>View Setting NOT adopted (OQ-FE-2 resolved 2026-05-11) — legacy
 *       panel has no toolbar list-icon button; column visibility / order
 *       are hardcoded in the static `<colgroup>`.</li>
 *   <li>Sort whitelist matches backend `ErpTrnsHistorySortField`
 *       (`REG_DTM`, `ERP_TYPE`, `TRNS_TYPE_CD`, `REG_USER`); `FILE` is
 *       non-sortable per OQ-5.</li>
 *   <li>Download flow uses `lib/file.ts downloadFile(url, filename)`
 *       (axios + blob + synthetic anchor click) per OQ-FE-1.</li>
 * </ul>
 */

/** Default page size — matches the canonical PAGE_SIZE_OPTIONS[0] (10). */
const DEFAULT_PAGE_SIZE = 10;

/** Keyword debounce window — same as FBH / Account Inquiry. */
const KEYWORD_DEBOUNCE_MS = 300;

/** Map a preset to its day-window. Used both to seed the ISO start/end
 *  fields when the user picks a preset (so a later flip to manual mode
 *  opens the calendar at the equivalent range) AND to compute the wire
 *  dates for the API call in preset mode. */
const PRESET_DAYS: Record<DateRangeFilterPreset, number> = {
    last_30_days: 30,
    last_90_days: 90,
    last_180_days: 180,
};

/** Compute the ISO start/end pair for a given preset, anchored to today. */
function rangeFromPreset(preset: DateRangeFilterPreset): {
    start: string;
    end: string;
} {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - PRESET_DAYS[preset]);
    return { start: toIso(start), end: toIso(today) };
}

/** Default filter value — preset mode anchored to last 30 days
 *  (mirrors legacy `comm_0219_001.ts:451-452` `getDateMinusDays(30)`
 *  seed). The ISO start/end are populated so a later flip to manual
 *  mode opens the calendar at the equivalent window without a flicker. */
function defaultDateRangeValue(): DateRangeFilterValue {
    const preset: DateRangeFilterPreset = "last_30_days";
    const { start, end } = rangeFromPreset(preset);
    return { mode: "preset", preset, start, end };
}

function toIso(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

/** ISO `YYYY-MM-DD` → wire `YYYYMMDD` accepted by the backend's
 *  `validateDate8`. */
function toWireDate(iso: string): string {
    return iso.replaceAll("-", "");
}

/** Resolve the effective ISO start/end pair for the current state.
 *  - Manual mode: use the user-chosen literal start/end.
 *  - Preset mode: recompute from the preset's day-window so the value
 *    stays anchored to "today" across re-renders. */
function resolveIsoRange(value: DateRangeFilterValue): {
    start: string;
    end: string;
} {
    if (value.mode === "manual") {
        return { start: value.start, end: value.end };
    }
    return rangeFromPreset(value.preset);
}

/** Tab → wire `erp_type` filter value. `"all"` omits the filter. */
function tabToErpType(tab: ErpTransactionHistoryTabKey): ErpDirection | undefined {
    return tab === "all" ? undefined : tab;
}

export default function ErpTransactionHistoryPanel() {
    const { t } = useTranslation();
    const dialog = useDialog();
    const { sortField, sortDirection, sortParams, toggleSort } = useTableSort();

    const [dateRange, setDateRange] = useState<DateRangeFilterValue>(
        () => defaultDateRangeValue(),
    );
    const [activeTab, setActiveTab] = useState<ErpTransactionHistoryTabKey>("all");
    const [transactionType, setTransactionType] =
        useState<TransactionTypeOption>("all");
    const [keyword, setKeyword] = useState("");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    // Wire dates derived from the controlled filter value — recomputed
    // on each render so preset-mode keeps anchoring to today without an
    // explicit refresh.
    const { start: wireStartIso, end: wireEndIso } = useMemo(
        () => resolveIsoRange(dateRange),
        [dateRange],
    );

    // Debounced keyword used as the API dep — page sees the live value
    // in the input box (no lag) but the network round-trip waits for
    // typing to settle.
    const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);
    useEffect(() => {
        const handle = window.setTimeout(
            () => setDebouncedKeyword(keyword),
            KEYWORD_DEBOUNCE_MS,
        );
        return () => window.clearTimeout(handle);
    }, [keyword]);

    const wireErpType = tabToErpType(activeTab);
    const wireTrnsTypeCd =
        transactionType === "all" ? undefined : transactionType;

    const { data, error } = useApiData(
        () =>
            fetchErpTransactionHistory({
                fromDate: toWireDate(wireStartIso),
                toDate: toWireDate(wireEndIso),
                erpType: wireErpType,
                trnsTypeCd: wireTrnsTypeCd,
                keyword: debouncedKeyword || undefined,
                ...(sortParams ?? {}),
                page,
                size: pageSize,
            }),
        [
            wireStartIso,
            wireEndIso,
            wireErpType,
            wireTrnsTypeCd,
            debouncedKeyword,
            sortField,
            sortDirection,
            page,
            pageSize,
        ],
    );

    // Latch the latest non-null response so the table + pagination
    // chrome stays stable across refetches. Pattern mirrors FBH /
    // AccountInquiryClient.
    const [stableData, setStableData] = useState(data);
    const [prevData, setPrevData] = useState(data);
    if (data !== prevData) {
        setPrevData(data);
        if (data) setStableData(data);
    }

    // Surface non-validation backend errors via the global system
    // dialog. Suppress validation since the panel's own state guards
    // against it. 401 is intercepted globally by lib/axios.ts.
    const lastSurfacedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!error) {
            lastSurfacedRef.current = null;
            return;
        }
        const code = error instanceof ApiCallError ? error.code : "WBE9999";
        if (code === "WBE_VALIDATION") return;
        if (lastSurfacedRef.current === code) return;
        lastSurfacedRef.current = code;
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: error.message || t("common.error.unknown"),
            errorCode: code,
        });
    }, [error, dialog, t]);

    const rows: ErpTransactionHistoryRow[] = stableData
        ? stableData.list.map(mapErpTransactionHistoryRow)
        : [];
    const totalCount = stableData?.total_count ?? 0;
    const totalPages = Math.max(1, stableData?.total_pages ?? 1);
    const counts: ErpTransactionHistoryTabCounts = {
        all: stableData?.total_count ?? 0,
        W: stableData?.total_count_wecms ?? 0,
        E: stableData?.total_count_erp ?? 0,
        D: stableData?.total_count_deleted ?? 0,
    };

    const handleTabChange = (key: ErpTransactionHistoryTabKey) => {
        setActiveTab(key);
        setPage(0);
        // Deleted tab restricts the dropdown to a scheduled-payment
        // subset; if the current selection is now hidden, reset to All
        // (mirrors legacy `comm_0219_001.ts:502-509`).
        if (
            key === "D" &&
            transactionType !== "all" &&
            !DELETED_TAB_TYPE_SUBSET.includes(transactionType)
        ) {
            setTransactionType("all");
        }
    };

    const handleDownload = async (row: ErpTransactionHistoryRow) => {
        try {
            await downloadFile(
                getErpTransactionHistoryDownloadUrl(row.seqNo),
                row.orgFileNm,
            );
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            if (code === "WBE_VALIDATION") return;
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description:
                    (err as Error).message || t("common.error.unknown"),
                errorCode: code,
            });
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — pr-24 keeps clear of the shell's Esc/X affordance. */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-14 pr-24">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.erp_transaction_history.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.erp_transaction_history.description")}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 px-8">
                <ErpTransactionHistoryTabs
                    active={activeTab}
                    counts={counts}
                    onChange={handleTabChange}
                />
            </div>

            {/* Filters */}
            <div className="shrink-0 px-8 pb-3 pt-3">
                <ErpTransactionHistoryFilters
                    dateRange={dateRange}
                    onDateRangeChange={(next) => {
                        // When the user picks a preset, refresh the ISO
                        // start/end fields from the preset's day-window
                        // so a later flip to manual mode opens the
                        // calendar at the equivalent range. Manual-mode
                        // edits pass start/end through verbatim.
                        if (next.mode === "preset") {
                            const { start, end } = rangeFromPreset(next.preset);
                            setDateRange({ ...next, start, end });
                        } else {
                            setDateRange(next);
                        }
                        setPage(0);
                    }}
                    transactionType={transactionType}
                    onTransactionTypeChange={(value) => {
                        setTransactionType(value);
                        setPage(0);
                    }}
                    keyword={keyword}
                    onKeywordChange={(value) => {
                        setKeyword(value);
                        setPage(0);
                    }}
                    activeTab={activeTab}
                />
            </div>

            {/* Scroll region — table body scrolls; header is sticky inside.
                The inner flex column lets the empty-state sibling expand
                via `flex-1` so "No Data Found" centers in the area below
                the header instead of hugging the header at its natural
                cell-padding height. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8">
                <div className="custom-scrollbar h-full overflow-auto">
                    <div className="flex h-full min-w-[920px] flex-col">
                        <ErpTransactionHistoryTable
                            rows={rows}
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={toggleSort}
                            onDownload={handleDownload}
                        />
                        {rows.length === 0 && (
                            <div className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6">
                                {t("settings.erp_transaction_history.empty")}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Pagination — pinned below the scroll region. Server-side
                math: convert zero-based <-> one-based at the boundary
                (Spring uses 0-based; the chrome displays 1-based). */}
            <div className="shrink-0 px-8 py-3">
                <Pagination
                    page={page + 1}
                    pageCount={totalPages}
                    pageSize={pageSize}
                    totalLabel={t("common.showing_of", {
                        shown: String(rows.length),
                        total: String(totalCount),
                    })}
                    onPageChange={(p) => setPage(Math.max(0, p - 1))}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(0);
                    }}
                />
            </div>
        </div>
    );
}
