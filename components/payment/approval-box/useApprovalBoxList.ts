"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    ApprovalBoxApiError,
    fetchApprovalBoxList,
    type ApprovalBoxListQuery,
} from "@/lib/api/approval-box";
import { mapApprovalBoxList, type MappedApprovalBoxList } from "@/lib/api/mappers";
import { userStorage } from "@/lib/auth/storage";
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
    /** ISO `YYYY-MM-DD` — what the picker components speak. The hook
     *  converts to legacy `YYYYMMDD` at the axios boundary. */
    fromDateIso: string;
    toDateIso: string;
    setDateRange: (range: { start: string; end: string }) => void;
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

function defaultRangeIso(): { start: string; end: string } {
    const now = new Date();
    const end = formatIsoDate(now);
    const past = new Date(now);
    past.setDate(past.getDate() - 30);
    return { start: formatIsoDate(past), end };
}

function formatIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function isoToYyyymmdd(iso: string): string {
    return iso.replace(/-/g, "");
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
    const initial = useMemo(() => defaultRangeIso(), []);
    const [tab, setTab] = useState<ApprovalTabKey>("all");
    const [search, setSearch] = useState("");
    const [fromDateIso, setFromDateIso] = useState(initial.start);
    const [toDateIso, setToDateIso] = useState(initial.end);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(15);
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

    const setDateRange = useCallback((range: { start: string; end: string }) => {
        setPage(0);
        setFromDateIso(range.start);
        setToDateIso(range.end);
    }, []);

    const setSort = useCallback(
        (field: string | null, direction: "ASC" | "DESC" | null) => {
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
        fromDateIso,
        toDateIso,
        setDateRange,
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
