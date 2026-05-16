"use client";

import { useState } from "react";

import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import PageLayout from "@/components/shared/PageLayout";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import {
    useViewSetting,
    ViewSettingPopover,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";
import { useTranslation } from "@/lib/i18n";

import SmartOrganizerDialog from "./SmartOrganizerDialog";
import TransactionHistoryActions from "./TransactionHistoryActions";
import TransactionStatusTabs from "./TransactionStatusTabs";
import TransactionTable from "./TransactionTable";
import TransactionTableFooter from "./TransactionTableFooter";
import TransactionTypeFilter from "./TransactionTypeFilter";
import type { TransactionAccount } from "./accounts";
import type {
    TransactionRow,
    TransactionStatusCounts,
    TransactionStatusFilter,
    TransactionSummary,
    TransactionTotals,
    TransactionTypeFilter as TypeFilter,
} from "./types";

/**
 * Fallback column set for the View Setting popover, mirroring the V157
 * + V159 `SYS_SCR_OPTION_WECMS` seed for `banking-transaction-history`.
 * Used until `useViewSetting` resolves the live items so the popover
 * can open immediately.
 *
 * Aligned with the legacy on-screen table — 12 data columns + 1
 * trailing action column. The action column is admin chrome (Confirm /
 * Undo) and is intentionally not in the View Setting seed.
 */
const FALLBACK_VS_COLUMNS: ViewSettingItem[] = [
    { field_id: "TRSC_ID",      field_nm: "Transaction ID", disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "N" },
    { field_id: "TRSC_DTM",     field_nm: "Date/Time",      disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "Y" },
    { field_id: "DEPOSIT_AMT",  field_nm: "Deposit",        disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "WITHDRAW_AMT", field_nm: "Withdrawal",     disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "BAL",          field_nm: "Balance",        disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "RMRK",         field_nm: "Remarks",        disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "240px", sort_yn: "N" },
    { field_id: "FILE_NM",      field_nm: "File Name",      disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "N" },
    { field_id: "MTCH_DT",      field_nm: "Matched Date",   disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "MTCH_BY",      field_nm: "Matched By",     disp_ord: 9,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "120px", sort_yn: "N" },
    { field_id: "PURPOSE",      field_nm: "Purpose",        disp_ord: 10, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "N" },
    { field_id: "CONTACT_NM",   field_nm: "Contact Name",   disp_ord: 11, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "N" },
    { field_id: "CONFIRMED_BY", field_nm: "Confirmed by",   disp_ord: 12, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "N" },
];

/** Maps each Transaction History FIELD_ID to its i18n header key so the
 *  popover renders localized labels (legacy `FIELD_NM` falls through
 *  for unknown ids — see `<ViewSettingPopover>`'s `getLabel` callback). */
const VS_FIELD_LABEL_KEYS: Record<string, string> = {
    TRSC_ID:      "txn_history.col.transaction_id",
    TRSC_DTM:     "txn_history.col.date_time",
    DEPOSIT_AMT:  "txn_history.col.deposit",
    WITHDRAW_AMT: "txn_history.col.withdraw",
    BAL:          "txn_history.col.balance",
    RMRK:         "txn_history.col.remarks",
    FILE_NM:      "txn_history.col.file_name",
    MTCH_DT:      "txn_history.col.matched_date",
    MTCH_BY:      "txn_history.col.matched_by",
    PURPOSE:      "txn_history.col.purpose",
    CONTACT_NM:   "txn_history.col.contact_name",
    CONFIRMED_BY: "txn_history.col.confirmed_by",
};

type TransactionHistoryPageProps = {
    /** Selected account — drives the breadcrumb title. */
    account: TransactionAccount;
    /** Server-side filtered + status-narrowed rows from the list endpoint. */
    rows: TransactionRow[];
    /**
     * Summary aggregates for the current filter scope EXCEPT the status tab —
     * drives the All / Confirmed / Unconfirmed tab counters. Null while the
     * first request is in flight; falls back to deriving counts from `rows`.
     */
    summary: TransactionSummary | null;
    /**
     * Totals for the rows currently visible in the table (after status tab).
     * Drives the footer count + deposit / withdraw sums. Null while the first
     * request is in flight; falls back to deriving from `rows`.
     */
    listTotals: TransactionTotals | null;
    /** ISO `YYYY-MM-DD` start of the active date filter window. */
    startDate: string;
    /** ISO `YYYY-MM-DD` end of the active date filter window. */
    endDate: string;
    /** Fires when either chip OR the dual-month range popover commits a
     *  new window. Always emits both ends; the wrapper resets pagination
     *  to page 1 (see local handler). */
    onDateRangeChange: (range: { start: string; end: string }) => void;
    typeFilter: TypeFilter;
    onTypeFilterChange: (next: TypeFilter) => void;
    statusFilter: TransactionStatusFilter;
    onStatusFilterChange: (next: TransactionStatusFilter) => void;
    search: string;
    onSearchChange: (next: string) => void;
    /** Row-level Confirm — flips CNFM_YN to 'Y' for the given row. */
    onConfirmRow?: (rowId: string) => void;
    /** Row-level Undo — flips CNFM_YN back to 'N'. */
    onUndoRow?: (rowId: string) => void;
    /** Toolbar Excel export. */
    onExport?: () => void;
    /** Toolbar Smart Organizer CTA. */
    onSmartOrganize?: () => void;
    /** Fires after Smart Organizer match / undo so the parent can
     *  bump its refresh key and re-fetch the transaction list. */
    onMatchChanged?: () => void;
};

/**
 * Transaction History detail page — Banking module. Pure presentation:
 * every filter, fetch, and aggregate lives on the client wrapper
 * (`TransactionHistoryClient`); this component just renders. Mirrors
 * Figma frames 6044:25536 / 6044:25523 / 6044:25526:
 *
 *   Header (one block, two columns, `items-start`):
 *     Left  col:  title            |  Right col:  list + Excel + Smart Organizer
 *                 date + flow radio             All / Confirmed / Unconfirmed + Search
 *   Table: 10-col shared scroll: 5 statement cols + 5 matching cols
 *   Footer: total count + deposit/withdraw totals (pinned via mt-auto, §7a)
 *   Pagination: shared component outside the scroll container
 *
 * Pagination is currently client-side over the backend's full filtered set
 * (backend returns no page/size yet — see plan OQ #2). When server-side
 * pagination lands the `usePagination` block here can drop to a simpler
 * `<Pagination>` driven directly by server counts.
 */
export default function TransactionHistoryPage({
    account,
    rows,
    summary,
    listTotals,
    startDate,
    endDate,
    onDateRangeChange,
    typeFilter,
    onTypeFilterChange,
    statusFilter,
    onStatusFilterChange,
    search,
    onSearchChange,
    onConfirmRow,
    onUndoRow,
    onExport,
    onSmartOrganize,
    onMatchChanged,
}: TransactionHistoryPageProps) {
    const { t } = useTranslation();

    // Smart Organizer popup — opens for a single transaction row. The
    // toolbar button picks the first eligible row (unmatched +
    // unconfirmed); a future enhancement could add per-row "Organize"
    // buttons in the table itself, but the legacy `comm_0196_001` flow
    // is always one row at a time.
    const [organizingRow, setOrganizingRow] = useState<TransactionRow | null>(null);

    // CLAUDE.md §13 — every list page binds to the central screenId
    // registry. Banking > Transaction History uses one screenId for
    // both VND and FCY scopes (V128 seed); CCY filtering is parameter
    // driven on the list / export endpoints, not the View Setting key.
    const vs = useViewSetting(
        SCREEN_IDS.BANKING_TRANSACTION_HISTORY,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    const openViewSetting = (anchorRect: DOMRect) => {
        // Seed the draft from the live items when present; fall back to
        // the V128 mirror so the popover opens cleanly on cold render.
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_VS_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    };

    const closeViewSetting = () => {
        setVsAnchor(null);
        setVsDraft(null);
    };

    // Derive tab counters from the summary endpoint when available so the
    // tabs read the full pre-status scope. Fall back to row-derived counts
    // when the summary is still in flight (first paint) — keeps the tabs
    // accurate even before the second network round-trip lands.
    const statusCounts: TransactionStatusCounts = summary
        ? {
              all: summary.totalCount,
              confirmed: summary.confirmedCount,
              unconfirmed: summary.unconfirmedCount,
          }
        : deriveCountsFromRows(rows);

    // Footer totals — prefer the list endpoint's pre-aggregated deposit /
    // withdraw sums (always honour the current status tab). Fall back to a
    // count-only derivation while the first request is in flight.
    const totals: TransactionTotals = listTotals ?? {
        count: rows.length,
        depositTotal: "0",
        withdrawTotal: "0",
    };

    const pg = usePagination<TransactionRow>({ items: rows });

    // Filter changes should snap pagination back to page 1 — otherwise a
    // narrower filter set leaves the cursor on a now-empty trailing page.
    const handleTypeFilterChange = (next: TypeFilter) => {
        onTypeFilterChange(next);
        pg.resetPage();
    };
    const handleStatusFilterChange = (next: TransactionStatusFilter) => {
        onStatusFilterChange(next);
        pg.resetPage();
    };
    const handleSearchChange = (next: string) => {
        onSearchChange(next);
        pg.resetPage();
    };
    const handleDateRangeChange = (range: { start: string; end: string }) => {
        onDateRangeChange(range);
        pg.resetPage();
    };

    return (
        <>
        <PageLayout>
            {/* Single top header block — two-column flex.
               Left:  title (row 1) + date range + flow radio (row 2).
               Right: action toolbar (row 1) + status tabs + search (row 2).
               `items-start` keeps the toolbar on the same top line as
               the title so the Excel icon and Smart Organizer button
               sit at the top-right corner of the header block per
               Figma 6044:25536 / 6044:25523 / 6044:25526. Inlined (not
               `<PageHeader>`) because this screen needs a two-row stack
               in both columns, which the shared header can't express. */}
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-4 pt-4 md:pt-6">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <h1 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("txn_history.breadcrumb", {
                            account: `${account.bankName} (${account.currency})`,
                        })}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4">
                        <InteractiveDateRangePicker
                            startIso={startDate}
                            endIso={endDate}
                            onChange={handleDateRangeChange}
                        />
                        <TransactionTypeFilter
                            value={typeFilter}
                            onChange={handleTypeFilterChange}
                        />
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-3">
                    <TransactionHistoryActions
                        onList={openViewSetting}
                        onExport={onExport}
                        onSmartOrganize={onSmartOrganize}
                    />
                    <div className="flex flex-col items-end gap-3 md:flex-row md:items-center md:gap-4">
                        <TransactionStatusTabs
                            active={statusFilter}
                            counts={statusCounts}
                            onChange={handleStatusFilterChange}
                        />
                        <SearchInput
                            value={search}
                            onChange={handleSearchChange}
                            placeholder={t("txn_history.search_placeholder")}
                        />
                    </div>
                </div>
            </div>

            {/* Custom shell — does NOT use the shared <DataTableShell>
               because this page wants the Total row pinned OUTSIDE the
               scroll area, flush above the pagination. The shared
               shell intentionally keeps the footer inside the scroll
               container so it shares horizontal scroll with the table
               (CLAUDE.md §7a); Transaction History deviates so the
               Total stays anchored to the viewport bottom regardless
               of vertical scroll position.

               Layout:
                 [table scroll area — vertical scroll only]
                 [Total row — pinned, shrink-0]
                 [Pagination — pinned, shrink-0]
            */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 pb-3">
                {/* Shared horizontal-scroll container — both the table
                   AND the Total footer share one X-axis scroll so the
                   footer columns stay aligned under their headers when
                   the user scrolls right. The inner `flex min-h-full
                   flex-col` lets `mt-auto` on the footer pin it to the
                   bottom of the viewport when rows don't fill the area.
                   Pagination stays OUTSIDE the scroll container as a
                   separate `shrink-0` sibling so it never scrolls
                   horizontally. */}
                <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
                    <div className="flex min-h-full flex-col">
                        <TransactionTable
                            rows={pg.paged}
                            onConfirm={onConfirmRow}
                            onUndo={onUndoRow}
                            onOrganize={(rowId) => {
                                const row = rows.find((r) => r.id === rowId);
                                if (row && row.trnsSeqNo) {
                                    setOrganizingRow(row);
                                }
                            }}
                        />
                        <TransactionTableFooter
                            totals={totals}
                            currency={account.currency}
                            className="mt-auto"
                        />
                    </div>
                </div>
                <Pagination
                    page={pg.page}
                    pageCount={pg.pageCount}
                    pageSize={pg.pageSize}
                    onPageChange={pg.setPage}
                    onPageSizeChange={pg.setPageSize}
                    totalLabel={t("common.showing_of", {
                        shown: String(pg.counts.shown),
                        total: String(pg.counts.total),
                    })}
                    className="shrink-0"
                />
            </div>
        </PageLayout>

        {/* View Setting popover — CLAUDE.md §13. The draft is a local
           copy of `vs.items`; Save commits via the shared hook (PUT
           /api/v1/screen-options/{screenId}/{dymAreaId}); Reset wipes
           user overrides; Cancel just closes. Column-to-table binding
           is intentionally deferred — Transaction History's table still
           renders the Figma 10-column layout. Reordering / toggling
           round-trips against the backend so user choices persist;
           pulling the rendered column set from `vs.items` is a
           follow-up. */}
        {/* Smart Organizer popup — legacy comm_0196_001 port. Anchored
           on one transaction row at a time; opens via the toolbar
           Smart Organizer button (picks first eligible row). */}
        {organizingRow && organizingRow.trnsSeqNo && (
            <SmartOrganizerDialog
                accountAcctSeqNo={account.id}
                row={organizingRow}
                currency={account.currency}
                bankLabel={`${account.bankName} (${account.currency})`}
                bankAccountNo={account.id.split("_").slice(1).join("_")}
                onClose={() => setOrganizingRow(null)}
                onMatched={() => {
                    setOrganizingRow(null);
                    onMatchChanged?.();
                }}
            />
        )}

        {vsAnchor && vsDraft && (
            <ViewSettingPopover
                anchorRect={vsAnchor}
                items={vsDraft}
                onItemsChange={(next) => setVsDraft(next)}
                getLabel={(item) => {
                    const key = VS_FIELD_LABEL_KEYS[item.field_id];
                    return key ? t(key) : item.field_nm;
                }}
                onSave={async () => {
                    try {
                        await vs.save(vsDraft);
                    } finally {
                        closeViewSetting();
                    }
                }}
                onReset={async () => {
                    const next = await vs.reset();
                    setVsDraft(next.map((it) => ({ ...it })));
                }}
                onClose={closeViewSetting}
            />
        )}
        </>
    );
}

function deriveCountsFromRows(rows: TransactionRow[]): TransactionStatusCounts {
    let confirmed = 0;
    for (const r of rows) {
        if (r.confirmed) confirmed += 1;
    }
    return {
        all: rows.length,
        confirmed,
        unconfirmed: rows.length - confirmed,
    };
}
