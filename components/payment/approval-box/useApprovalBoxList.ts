"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    ApprovalBoxApiError,
    fetchApprovalBoxList,
    type ApprovalBoxListQuery,
} from "@/lib/api/approval-box";
import { mapApprovalBoxList, type MappedApprovalBoxList } from "@/lib/api/mappers";
import { userStorage } from "@/lib/auth/storage";
import { PAGE_SIZE_OPTIONS } from "@/components/shared/Pagination";
import type {
    ManualDateRange,
    PeriodKey,
} from "@/components/payment/shared/PaymentPeriodDropdown";
import type { ApprovalTabKey } from "./types";

export type ApprovalBoxListState = {
    data: MappedApprovalBoxList | null;
    loading: boolean;
    error: ApprovalBoxApiError | null;
};

export type ApprovalBoxListControls = {
    tab: ApprovalTabKey;
    setTab: (key: ApprovalTabKey) => void;
    search: string;
    setSearch: (value: string) => void;
    /** Period preset OR `"manual"`. The hook derives the actual date
     *  window from this + {@link manualRange}. */
    period: PeriodKey;
    setPeriod: (p: PeriodKey) => void;
    /** Manual range (yyyymmdd) committed via the period dropdown's
     *  "Enter Manually" popover. Undefined until the user saves. */
    manualRange: ManualDateRange | undefined;
    setManualRange: (range: ManualDateRange | undefined) => void;
    /** ISO `YYYY-MM-DD` — derived from period + manualRange. The hook
     *  converts to legacy `YYYYMMDD` at the axios boundary. */
    fromDateIso: string;
    toDateIso: string;
    page: number;
    setPage: (page: number) => void;
    pageSize: number;
    setPageSize: (size: number) => void;
    sortField: string | null;
    sortDirection: "ASC" | "DESC" | null;
    setSort: (field: string | null, direction: "ASC" | "DESC" | null) => void;
    refetch: () => Promise<void>;
};

const TAB_TO_APPR_TYPE_CD: Record<ApprovalTabKey, "" | "00" | "01" | "02" | "03"> = {
    all: "",
    draft: "",          // backend has no `draft` tab; reserved for future use
    pending: "00",
    in_progress: "03",
    approved: "01",
    rejected: "02",
};

function formatIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function isoToYyyymmdd(iso: string): string {
    return iso.replace(/-/g, "");
}

function yyyymmddToIso(raw: string): string {
    if (!raw || raw.length !== 8) return "";
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/** Derive `(fromIso, toIso)` from period + manualRange. Mirrors the
 *  legacy `getCurrentDate(option)` + manual-range branch in
 *  `resl_0001_001_osmc.ts`. */
function periodToDateWindow(
    period: PeriodKey,
    manualRange: ManualDateRange | undefined,
): { fromIso: string; toIso: string } {
    if (period === "manual" && manualRange) {
        return {
            fromIso: yyyymmddToIso(manualRange.fromDate),
            toIso:   yyyymmddToIso(manualRange.toDate),
        };
    }
    const days = period === "180d" ? 180 : period === "90d" ? 90 : 30;
    const now = new Date();
    const past = new Date(now);
    past.setDate(past.getDate() - days);
    return { fromIso: formatIsoDate(past), toIso: formatIsoDate(now) };
}

/**
 * Owns the list state for the Approval Box page. Mirrors the legacy
 * {@code resl_0001_001_osmc.ts} top-level flow: any filter / tab / page
 * change triggers a fresh `GET /api/v1/payment/approval-box` call; the
 * latest in-flight request wins (token-cancellation via a run-id ref
 * — useEffect cleanup is the standard cancellation idiom for this
 * codebase).
 */
export function useApprovalBoxList(): ApprovalBoxListState & ApprovalBoxListControls {
    const [tab, setTab] = useState<ApprovalTabKey>("all");
    const [search, setSearch] = useState("");
    const [period, setPeriod] = useState<PeriodKey>("30d");
    const [manualRange, setManualRange] = useState<ManualDateRange | undefined>(
        undefined,
    );
    const { fromIso: fromDateIso, toIso: toDateIso } = useMemo(
        () => periodToDateWindow(period, manualRange),
        [period, manualRange],
    );
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<"ASC" | "DESC" | null>(null);

    const [state, setState] = useState<ApprovalBoxListState>({
        data: null,
        loading: false,
        error: null,
    });

    const runIdRef = useRef(0);

    const load = useCallback(async () => {
        const runId = ++runIdRef.current;
        setState((s) => ({ ...s, loading: true, error: null }));
        const query: ApprovalBoxListQuery = {
            fromDate: isoToYyyymmdd(fromDateIso),
            toDate: isoToYyyymmdd(toDateIso),
            apprTypeCd: TAB_TO_APPR_TYPE_CD[tab],
            srchWd: search.trim(),
            sortField: sortField ?? undefined,
            sortDirection: sortDirection ?? undefined,
            page,
            size: pageSize,
        };
        try {
            const wire = await fetchApprovalBoxList(query);
            const userId = userStorage.get()?.userId ?? null;
            const mapped = mapApprovalBoxList(wire, userId);
            if (runIdRef.current !== runId) return;
            setState({ data: mapped, loading: false, error: null });
        } catch (err) {
            if (runIdRef.current !== runId) return;
            const wrapped =
                err instanceof ApprovalBoxApiError
                    ? err
                    : new ApprovalBoxApiError("WBE_NETWORK", "Network error");
            setState({ data: null, loading: false, error: wrapped });
        }
    }, [tab, search, fromDateIso, toDateIso, page, pageSize, sortField, sortDirection]);

    useEffect(() => {
        // Fetch-on-mount + re-fetch-on-filter-change is the intended
        // behaviour; setState happens asynchronously after the network
        // round-trip, not synchronously during render.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load();
    }, [load]);

    const setPeriodBoundary = useCallback((p: PeriodKey) => {
        setPage(0);
        setPeriod(p);
    }, []);

    const setManualRangeBoundary = useCallback(
        (range: ManualDateRange | undefined) => {
            setPage(0);
            setManualRange(range);
        },
        [],
    );

    const setSort = useCallback(
        (field: string | null, direction: "ASC" | "DESC" | null) => {
            // Mirror the boundary-setter pattern (tab / search / period
            // / manualRange) — reset to page 0 so the user always lands
            // on the first page of the new sort order. Legacy
            // `fn_loadData(input, option=true)` does the same.
            setPage(0);
            setSortField(field);
            setSortDirection(direction);
        },
        [],
    );

    const setTabBoundary = useCallback((key: ApprovalTabKey) => {
        setPage(0);
        setTab(key);
    }, []);

    const setSearchBoundary = useCallback((value: string) => {
        setPage(0);
        setSearch(value);
    }, []);

    return {
        ...state,
        tab,
        setTab: setTabBoundary,
        search,
        setSearch: setSearchBoundary,
        period,
        setPeriod: setPeriodBoundary,
        manualRange,
        setManualRange: setManualRangeBoundary,
        fromDateIso,
        toDateIso,
        page,
        setPage,
        pageSize,
        setPageSize,
        sortField,
        sortDirection,
        setSort,
        refetch: load,
    };
}
