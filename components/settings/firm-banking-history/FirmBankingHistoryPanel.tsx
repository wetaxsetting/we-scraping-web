"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Pagination from "@/components/shared/Pagination";
import { useDialog } from "@/components/shared/dialog";
import { useTableSort } from "@/hooks/useTableSort";
import { ApiCallError } from "@/lib/api/banking";
import { fetchFirmBankingHistory } from "@/lib/api/firmBankingHistory";
import { mapFirmBankingHistoryRow } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";

import FirmBankingHistoryDetailPopover from "./FirmBankingHistoryDetailPopover";
import FirmBankingHistoryFilters, {
    type ServiceTypeOption,
} from "./FirmBankingHistoryFilters";
import FirmBankingHistoryTable from "./FirmBankingHistoryTable";
import type { FirmBankingHistoryRow } from "./types";

/**
 * Firm Banking History panel — Figma 9198:11718 (Settings popup submenu).
 *
 * Wires the static UI panel to the Phase 2 backend
 * `GET /api/v1/settings/firm-banking-history`. Owns server-side filter
 * + pagination + sort state, debounces keyword input, and latches the
 * latest non-null response so the table chrome doesn't flicker between
 * refetches (matches the canonical
 * {@code AccountInquiryClient} / {@code OperationStatusClient} pattern).
 *
 * <p>Layout (top → bottom, all inside the modal's right column):
 *   [Header]      — title + description (shrink-0); pr-24 clears the shell's Esc/X
 *   [Filters]     — date range + Service Type dropdown + Search (shrink-0)
 *   [Table]       — ONLY this region scrolls (vertical + horizontal as needed)
 *   [Pagination]  — fixed at the bottom, OUTSIDE the scroll container
 *
 * <p>Errors surface via the global system dialog (mirrors Operation
 * Status). Validation errors ({@code WBE_VALIDATION}) are silently
 * suppressed since the panel's own input shape guards against them.
 */

/** Default page size — matches the canonical {@code PAGE_SIZE_OPTIONS[0]}
 *  (10) so the dropdown selector and the initial fetch agree. Backend
 *  clamps to {@code FirmBankingHistoryService.MAX_PAGE_SIZE = 100}. */
const DEFAULT_PAGE_SIZE = 10;

/** Keyword debounce — same window used by every other list panel
 *  (Account Inquiry, Operation Status). The input box always renders
 *  the live value; the network roundtrip waits for typing to settle. */
const KEYWORD_DEBOUNCE_MS = 300;

/** Default date window when the user opens the panel — last 30 days
 *  inclusive, matching legacy `comm_0221_001.ts:108`'s
 *  `loadinitializeDate(-30, today)`. The static UI's read-only
 *  `<DateRangePicker>` chips render off this state. */
function defaultDateRange(): { start: string; end: string } {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    return { start: toIso(start), end: toIso(today) };
}

function toIso(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

/** Turn ISO {@code YYYY-MM-DD} into the wire's {@code YYYYMMDD} that
 *  the backend's `validateDate8` accepts. */
function toWireDate(iso: string): string {
    return iso.replaceAll("-", "");
}

/** Wire `svc_type` value for the panel's internal filter enum. The UI's
 *  4-option enum maps to backend's 4-leg enum 1:1; 'all' omits the
 *  filter so the request returns rows from every leg. */
const SERVICE_TYPE_TO_WIRE: Record<Exclude<ServiceTypeOption, "all">, "F" | "S" | "G" | "B"> = {
    firm_banking_transaction: "F",
    scraping_transfer: "S",
    vietnam_gdt_inquiry: "G",
    vietnam_business_inquiry: "B",
};

export default function FirmBankingHistoryPanel() {
    const { t } = useTranslation();
    const dialog = useDialog();
    const { sortField, sortDirection, sortParams, toggleSort } = useTableSort();

    const initial = useMemo(defaultDateRange, []);
    // Date range is now stateful (Phase 3a). The shared
    // <InteractiveDateRangePicker> drives onChange when:
    //   - the user picks a single day in the start chip's popover,
    //   - the user picks a single day in the end chip's popover, or
    //   - the user clicks Apply in the dual-month range popover.
    // Each change resets the page to 0 to mirror filter-reset
    // semantics elsewhere on the page.
    const [startDate, setStartDate] = useState(initial.start);
    const [endDate, setEndDate]     = useState(initial.end);
    const [serviceType, setServiceType] = useState<ServiceTypeOption>("all");
    const [keyword, setKeyword] = useState("");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [detail, setDetail] = useState<{
        row: FirmBankingHistoryRow;
        anchorRect: DOMRect;
    } | null>(null);

    // Debounced keyword used as the API dep — page sees the live value
    // for input rendering (no lag in the box) but the network roundtrip
    // waits for typing to settle.
    const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);
    useEffect(() => {
        const handle = window.setTimeout(() => setDebouncedKeyword(keyword), KEYWORD_DEBOUNCE_MS);
        return () => window.clearTimeout(handle);
    }, [keyword]);

    const wireSvcType =
        serviceType === "all" ? undefined : SERVICE_TYPE_TO_WIRE[serviceType];

    const { data, error } = useApiData(
        () =>
            fetchFirmBankingHistory({
                fromDate: toWireDate(startDate),
                toDate: toWireDate(endDate),
                svcType: wireSvcType,
                keyword: debouncedKeyword || undefined,
                ...(sortParams ?? {}),
                page,
                size: pageSize,
            }),
        [
            startDate,
            endDate,
            wireSvcType,
            debouncedKeyword,
            sortField,
            sortDirection,
            page,
            pageSize,
        ],
    );

    // Latch the latest non-null response so the table + pagination
    // chrome stays stable across refetches — `useApiData` resets `data`
    // to null on every dep change. Pattern mirrors AccountInquiryClient.
    const [stableData, setStableData] = useState(data);
    const [prevData, setPrevData] = useState(data);
    if (data !== prevData) {
        setPrevData(data);
        if (data) setStableData(data);
    }

    // Surface non-validation backend errors via the global system
    // dialog. Validation errors are suppressed because the panel's
    // own state guarantees `from_date`/`to_date` shape. 401 / NETWORK
    // failures are intercepted globally by `lib/axios.ts` and
    // `useApiData` returns the error here so we can show a dialog.
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

    const rows: FirmBankingHistoryRow[] = stableData
        ? stableData.list.map(mapFirmBankingHistoryRow)
        : [];
    const totalCount = stableData?.total_count ?? 0;
    const totalPages = Math.max(1, stableData?.total_pages ?? 1);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — pr-24 keeps clear of the shell's Esc/X affordance. */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-14 pr-24">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.firm_banking_history.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.firm_banking_history.description")}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="shrink-0 px-8 pb-3">
                <FirmBankingHistoryFilters
                    startDate={startDate}
                    endDate={endDate}
                    serviceType={serviceType}
                    keyword={keyword}
                    onDateRangeChange={(range) => {
                        setStartDate(range.start);
                        setEndDate(range.end);
                        setPage(0);
                    }}
                    onServiceTypeChange={(value) => {
                        setServiceType(value);
                        setPage(0);
                    }}
                    onKeywordChange={(value) => {
                        setKeyword(value);
                        setPage(0);
                    }}
                />
            </div>

            {/* Scroll region — table body scrolls; header is sticky inside. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8">
                <div className="custom-scrollbar h-full overflow-auto">
                    <FirmBankingHistoryTable
                        rows={rows}
                        sortField={sortField}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        onViewDetails={(row, anchorRect) =>
                            setDetail({ row, anchorRect })
                        }
                    />
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

            {/* Detail popover — anchored under the clicked `View Details`,
               portal-mounted so the table's scroll container can't clip
               it. Conditional mount + `key` re-seed (keyed on row id)
               so clicking row B after row A remounts the popover with
               B's payload; the unmount also resets the local copy/copied
               flag. */}
            {detail && (
                <FirmBankingHistoryDetailPopover
                    key={detail.row.id}
                    row={detail.row}
                    anchorRect={detail.anchorRect}
                    onClose={() => setDetail(null)}
                />
            )}
        </div>
    );
}
