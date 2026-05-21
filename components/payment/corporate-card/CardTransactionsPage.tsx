"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import type { DateRangeFilterValue } from "@/components/shared/DateRangeFilter";
import { useDialog } from "@/components/shared/dialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import Pagination from "@/components/shared/Pagination";
import { useTableSort } from "@/hooks/useTableSort";
import { ApiCallError } from "@/lib/api/banking";
import { fetchActiveCards, fetchCardTransactions, fetchNextCardDocNo } from "@/lib/api/cardTransactions";
import { useApiData } from "@/lib/api/useApiData";
import type { ApiActiveCard } from "@/lib/types/api";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import CardManagementDialog from "./CardManagementDialog";
import UpdateCardsDialog from "./UpdateCardsDialog";
import CardSummaryCards from "./CardSummaryCards";
import { mapCardTransactionList } from "./cardTransactionMappers";
import type { CardTransaction } from "./cardTransactionMappers";
import CardTransactionsFilterBar from "./CardTransactionsFilterBar";
import CardTransactionsTable from "./CardTransactionsTable";
import CardTransactionsTableFooter from "./CardTransactionsTableFooter";
import EditDescriptionDialog from "./EditDescriptionDialog";
import ApprovalRefDetailDialog from "./ApprovalRefDetailDialog";
import ReportingAccountPickerPopover from "./ReportingAccountPickerPopover";
import RequestApprovalDialog, {
    type RequestApprovalRow as ApprovalRow,
    type RequestApprovalTransaction,
} from "@/components/payment/shared/RequestApprovalDialog";
import type { CardSummary, CurrencyTotal, LinkTab } from "./types";

/** Page-size options matching every other paginated list in the app. */
const PAGE_SIZE = 15;

/** Map the inline {@link LinkTab} state → backend `link_yn` wire value. */
function tabToLinkYn(tab: LinkTab): "" | "Y" | "N" {
    if (tab === "linked")   return "Y";
    if (tab === "unlinked") return "N";
    return "";
}

/** Format a {@link Date} as {@code yyyyMMdd} for the API wire. */
function fmtYyyymmdd(d: Date): string {
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** Today as ISO {@code YYYY-MM-DD} — used to seed manual mode. */
function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Seed the shared {@code <DateRangeFilter>} — preset mode, 30 days. */
function defaultDateRangeValue(): DateRangeFilterValue {
    return {
        mode:   "preset",
        preset: "last_30_days",
        start:  todayIso(),
        end:    todayIso(),
    };
}

/** Translate the shared {@link DateRangeFilterValue} into the
 *  {@code yyyyMMdd} window the API expects. Preset mode rolls the
 *  window backward from today; manual mode honours the ISO chips. */
function rangeToWindow(v: DateRangeFilterValue): { fromDt: string; toDt: string } {
    if (v.mode === "manual") {
        return {
            fromDt: v.start.replaceAll("-", ""),
            toDt:   v.end.replaceAll("-", ""),
        };
    }
    const days = v.preset === "last_180_days" ? 180
              : v.preset === "last_90_days"  ? 90
              : 30;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return { fromDt: fmtYyyymmdd(from), toDt: fmtYyyymmdd(to) };
}

export default function CardTransactionsPage() {
    const { t, locale } = useTranslation();
    const dialog = useDialog();
    const sort = useTableSort();

    const [activeTab, setActiveTab] = useState<LinkTab>("all");
    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState<DateRangeFilterValue>(defaultDateRangeValue);
    const dateWindow = useMemo(() => rangeToWindow(dateRange), [dateRange]);
    /** Selected BANK_CD filter — `null` = "All Card Companies". */
    const [bankCdFilter, setBankCdFilter] = useState<string | null>(null);
    /** Selected CARD_NO filter — `null` = "All Cards". */
    const [cardNoFilter, setCardNoFilter] = useState<string | null>(null);
    /** Active-cards dropdown payload — loaded once + refreshed when the
     *  Manage Cards modal mutates the registry. */
    const [activeCards, setActiveCards] = useState<ApiActiveCard[]>([]);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);
    /** Bumped after a successful PATCH / PUT to re-fire {@link useApiData}. */
    const [refreshKey, setRefreshKey] = useState(0);

    /** PATCH-description target row — null when the dialog is closed. */
    const [editDescriptionRow, setEditDescriptionRow] = useState<CardTransaction | null>(null);
    /** PUT-reporting-account target row — null when the picker is closed. */
    const [editReportingRow, setEditReportingRow] = useState<CardTransaction | null>(null);
    /** Bounding rect of the clicked Reporting Account cell — drives
     *  the {@link ReportingAccountPickerPopover} anchor. Captured on
     *  the click; cleared when the popover closes. */
    const [editReportingRect, setEditReportingRect] = useState<DOMRect | null>(null);
    /** Manage Cards modal (legacy `card_0001_003`). */
    const [manageCardsOpen, setManageCardsOpen] = useState(false);
    /** Whether the three summary cards (Total / Approval Not Requested
     *  / Approval Requested) are visible. Toggled by the Dashboard
     *  chip at the top-right. Defaults to visible (legacy parity —
     *  the dashboard pane is always shown on first render). */
    const [dashboardVisible, setDashboardVisible] = useState(true);
    /** Update Cards dialog (legacy `nxisas_cardTranList`). */
    const [updateCardsOpen, setUpdateCardsOpen] = useState(false);

    /** Set of `cardSeqNo` values whose checkbox is ticked — feeds
     *  the Request Approval batch button. Legacy
     *  `card_0001_001.ts:644-657` enables the button when at least
     *  one row is checked AND no checked row already has an
     *  `appr_seq_no` set. */
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    /** Snapshot of the selected rows passed to the shared
     *  {@code RequestApprovalDialog} when it opens. Cleared on close
     *  or successful submit. */
    const [approvalRows, setApprovalRows] = useState<ApprovalRow[] | null>(null);
    /** Previewed VO_YYMMDD_NNN doc number for the open Request Approval
     *  popup. Fetched on form open via {@code GET /next-doc-no}. Card
     *  has no parent batch row, so this is the only way the read-only
     *  "Document No." field can render a meaningful value before
     *  submit. Cleared when the popup closes. */
    const [approvalDocNo, setApprovalDocNo] = useState<string | null>(null);
    /** apprSeqNo whose Approval Ref cell was clicked — drives the
     *  {@link ApprovalRefDetailDialog}. {@code null} when closed. */
    const [apprRefSeqNo, setApprRefSeqNo] = useState<string | null>(null);

    const state = useApiData(
        () =>
            fetchCardTransactions({
                fromDt: dateWindow.fromDt,
                toDt:   dateWindow.toDt,
                srchWd: search.trim() || undefined,
                bankCds: bankCdFilter ? [bankCdFilter] : undefined,
                cardNos: cardNoFilter ? [cardNoFilter] : undefined,
                linkYn: tabToLinkYn(activeTab) || undefined,
                sortField:     sort.sortParams?.sortField,
                sortDirection: sort.sortParams?.sortDirection,
                page,
                size: pageSize,
            }).then((api) => mapCardTransactionList(api, locale)),
        [
            dateWindow.fromDt,
            dateWindow.toDt,
            search,
            bankCdFilter,
            cardNoFilter,
            activeTab,
            page,
            pageSize,
            sort.sortField,
            sort.sortDirection,
            refreshKey,
            locale,
        ],
    );

    // Active-cards payload — drives the All Card Companies + All Cards
    // dropdowns. Refresh whenever the page-level refreshKey bumps so
    // mutations from the Manage Cards modal (add / delete / activate)
    // propagate into the filter dropdowns.
    useEffect(() => {
        let cancelled = false;
        fetchActiveCards()
            .then((res) => { if (!cancelled) setActiveCards(res.cards ?? []); })
            .catch(() => { /* soft-fail; dropdowns just stay empty */ });
        return () => { cancelled = true; };
    }, [refreshKey]);

    // Preview the next VO_YYMMDD_NNN when the Request Approval popup
    // opens. Soft-fail to a dash if the preview endpoint is
    // unreachable — submission still works because the authoritative
    // value is assigned server-side by ApprovalBoxFanoutService.
    useEffect(() => {
        if (!approvalRows) return;
        let cancelled = false;
        fetchNextCardDocNo()
            .then((docNo) => { if (!cancelled) setApprovalDocNo(docNo); })
            .catch(() => { if (!cancelled) setApprovalDocNo(null); });
        return () => { cancelled = true; };
    }, [approvalRows]);

    const rows: CardTransaction[]      = state.data?.rows ?? [];
    const totalCount                   = state.data?.totalCount ?? 0;
    const totals                       = state.data?.totals;

    /** Surface fetch errors as a single dialog — fired once per error. */
    if (state.error && !state.loading) {
        const err = state.error;
        const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
        const message = err instanceof ApiCallError ? err.message : t("payment.card.fetch_failed");
        // Defer to a microtask so React doesn't see a side-effect during render.
        queueMicrotask(() => {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        });
    }

    const summary: CardSummary = useMemo(() => ({
        total:                       totals?.totalCount                ?? 0,
        totalAmount:                 totals?.totalAmount               ?? "",
        approvalNotRequested:        totals?.approvalNotRequestedCount ?? 0,
        approvalNotRequestedAmount:  totals?.approvalNotRequestedAmount ?? "",
        approvalRequested:           totals?.approvalRequestedCount    ?? 0,
        approvalRequestedAmount:     totals?.approvalRequestedAmount   ?? "",
    }), [totals]);

    /** Footer per-currency totals — Sprint 0 ships a single VND tile
     *  because the totals envelope is single-currency on the backend.
     *  Multi-currency rollout lifts this when the totals shape grows
     *  a per-CCY breakdown (Phase B). */
    const currencyTotals: CurrencyTotal[] = useMemo(() => {
        if (!totals) return [];
        return [{ currency: "VND", total: totals.totalAmount }];
    }, [totals]);

    const handleTabChange = useCallback((tab: LinkTab) => {
        setActiveTab(tab);
        setPage(0);
    }, []);

    const handleSearchChange = useCallback((value: string) => {
        setSearch(value);
        setPage(0);
    }, []);

    const handleDateRangeChange = useCallback((next: DateRangeFilterValue) => {
        setDateRange(next);
        setPage(0);
    }, []);

    const handleBankCdChange = useCallback((next: string | null) => {
        setBankCdFilter(next);
        setPage(0);
        // Clear any stale card filter that doesn't belong to the new
        // bank — otherwise the API would return zero rows and the
        // user couldn't tell why. We resolve the check against the
        // current `activeCards` list via the functional setter so we
        // don't have to add it to this callback's deps.
        setCardNoFilter((prev) => {
            if (!prev) return prev;
            if (next && !activeCards.some(
                (c) => c.bank_cd === next && c.card_no === prev,
            )) {
                return null;
            }
            return prev;
        });
    }, [activeCards]);

    const handleCardNoChange = useCallback((next: string | null) => {
        setCardNoFilter(next);
        setPage(0);
    }, []);

    const refreshList = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    /** Toggle a single row's selection — mirrors legacy
     *  `.sub_checkbox` per-row toggle. Rows already carrying an
     *  apprSeqNo are guarded at the table level (disabled
     *  checkbox); we double-check here too. */
    const handleToggleRow = useCallback((row: CardTransaction) => {
        if (row.apprSeqNo) return;
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(row.cardSeqNo)) {
                next.delete(row.cardSeqNo);
            } else {
                next.add(row.cardSeqNo);
            }
            return next;
        });
    }, []);

    /** Toggle the header "select all" checkbox. Selects every
     *  visible row that doesn't already have an apprSeqNo, or
     *  deselects them all if every visible row is currently
     *  selected. */
    const handleToggleAll = useCallback((visible: CardTransaction[]) => {
        const eligible = visible.filter((r) => !r.apprSeqNo);
        setSelected((prev) => {
            const allChecked = eligible.length > 0 && eligible.every((r) => prev.has(r.cardSeqNo));
            const next = new Set(prev);
            if (allChecked) {
                eligible.forEach((r) => next.delete(r.cardSeqNo));
            } else {
                eligible.forEach((r) => next.add(r.cardSeqNo));
            }
            return next;
        });
    }, []);

    /** Clear the selection on refresh — keeps the user's mental
     *  model of "selected rows" tied to the current page state. */
    const clearSelection = useCallback(() => {
        setSelected(new Set());
    }, []);

    /** Called by {@link UpdateCardsDialog} after a successful scrape.
     *  Widens the page's date filter to the scrape window so any
     *  freshly-inserted rows that fall outside the default 30-day
     *  display window become visible — without this, scraped txns
     *  older than 30 days land in the DB but never appear in the
     *  table. */
    const handleUpdateSuccess = useCallback(
        (range: { fromDt: string; toDt: string }) => {
            // Flip the shared period filter into manual mode so the
            // chips display the exact scrape window the user picked
            // in the Update Cards dialog. Convert yyyyMMdd → ISO so
            // <DateRangeFilter> can render the chips.
            const toIso = (v: string) =>
                v.length === 8
                    ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`
                    : v;
            setDateRange((prev) => ({
                ...prev,
                mode:  "manual",
                start: toIso(range.fromDt),
                end:   toIso(range.toDt),
            }));
            setPage(0);
            setRefreshKey((k) => k + 1);
        },
        [],
    );

    /** Distinct bank options for the All Card Companies dropdown.
     *  Source from {@link activeCards} so the list only carries banks
     *  the tenant actually has cards for. */
    const bankOptions = useMemo(() => {
        const seen = new Map<string, string>();
        for (const c of activeCards) {
            if (!seen.has(c.bank_cd)) seen.set(c.bank_cd, c.bank_nm);
        }
        return Array.from(seen, ([bank_cd, bank_nm]) => ({ bank_cd, bank_nm }))
            .sort((a, b) => a.bank_nm.localeCompare(b.bank_nm));
    }, [activeCards]);

    /** Cards visible in the All Cards dropdown — narrowed by the
     *  currently-selected bank when one is set. */
    const cardOptions = useMemo(() => {
        return activeCards
            .filter((c) => !bankCdFilter || c.bank_cd === bankCdFilter)
            .map((c) => ({
                bank_cd: c.bank_cd,
                card_no: c.card_no,
                label: c.card_nick_nm || c.card_nm || c.card_no,
            }));
    }, [activeCards, bankCdFilter]);

    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 md:px-6">
                {/* Page header — title left, actions right */}
                <PageHeader title={t("payment.card.title")}>
                    <div className="flex items-center gap-2">
                        {/* Dashboard chip button — toggles the three
                            summary cards (Total / Approval Not Requested
                            / Approval Requested). Icon mirrors the
                            current state: Eye when summary is visible
                            (click to hide), EyeOff when collapsed (click
                            to reveal). aria-pressed exposes the toggle
                            state for screen readers. */}
                        <button
                            type="button"
                            aria-pressed={dashboardVisible}
                            onClick={() => setDashboardVisible((v) => !v)}
                            className={cn(
                                "flex h-[var(--h-wb-filter-btn)] shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3",
                                "text-wb-14-tight font-medium",
                                dashboardVisible
                                    ? "bg-brand text-white hover:bg-brand-hover"
                                    : "border border-wb-ntrl-4 bg-white text-wb-ntrl-8 shadow-wb-btn hover:bg-neutral-50",
                            )}
                        >
                            <span>{t("payment.card.dashboard")}</span>
                            {dashboardVisible
                                ? <Eye    className="size-4" strokeWidth={1.8} />
                                : <EyeOff className="size-4" strokeWidth={1.8} />}
                        </button>

                        {/* List / Print / Excel icon buttons — Excel + Print Phase B */}
                        <PageActionButtons showList showPrint showExcel />

                        {/* Manage Cards outlined button — opens the
                            Card Management modal (legacy `card_0001_003`). */}
                        <button
                            type="button"
                            onClick={() => setManageCardsOpen(true)}
                            className="flex h-[var(--h-wb-filter-btn)] shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14-tight font-medium text-wb-ntrl-8 shadow-wb-btn hover:bg-neutral-50"
                        >
                            {t("payment.card.manage_cards")}
                        </button>

                        {/* Update — opens the date-range picker that
                            kicks off the Coocon scrape sync across every
                            active card with a registered credential
                            (legacy `nxisas_cardTranList`). */}
                        <button
                            type="button"
                            onClick={() => setUpdateCardsOpen(true)}
                            className="flex h-[var(--h-wb-filter-btn)] shrink-0 cursor-pointer items-center rounded-md bg-brand px-4 text-wb-14-tight font-medium text-white hover:bg-brand-hover"
                        >
                            {t("payment.card.update")}
                        </button>
                    </div>
                </PageHeader>

                {/* Summary cards — gated by the Dashboard toggle.
                    Hidden state collapses the three cards completely so
                    the table area expands. */}
                {dashboardVisible && <CardSummaryCards summary={summary} />}

                {/* Filter / toolbar */}
                <CardTransactionsFilterBar
                    dateRange={dateRange}
                    onDateRangeChange={handleDateRangeChange}
                    bankOptions={bankOptions}
                    selectedBankCd={bankCdFilter}
                    onBankCdChange={handleBankCdChange}
                    cardOptions={cardOptions}
                    selectedCardNo={cardNoFilter}
                    onCardNoChange={handleCardNoChange}
                    activeTab={activeTab}
                    search={search}
                    onTabChange={handleTabChange}
                    onSearchChange={handleSearchChange}
                    selectedCount={selected.size}
                    onRequestApproval={() => {
                        // Snapshot the currently-selected rows into
                        // the shared `RequestApprovalDialog`'s row
                        // shape. Card transactions don't have a file
                        // name per "batch" the way upload-driven
                        // payment flows do, so we synthesise one
                        // ("Card …5559" etc.) from the row's merchant
                        // / card-no so the dialog's selected-row chip
                        // still has something human-readable to
                        // display.
                        const chosen = rows.filter((r) => selected.has(r.cardSeqNo));
                        if (chosen.length === 0) return;
                        setApprovalRows(chosen.map((r) => ({
                            id:          r.cardSeqNo,
                            fileName:    r.merchNm ?? `Card ${r.cardNo}`,
                            ccyCd:       r.ccyCd,
                            totalAmount: r.trscAmt,
                            txnCount:    1,
                        })));
                    }}
                />

                {/* Table + footer + pagination */}
                <DataTableShell
                    footerMode="paginationWithTotals"
                    table={
                        <CardTransactionsTable
                            rows={rows}
                            sortField={sort.sortField}
                            sortDirection={sort.sortDirection}
                            onSort={sort.toggleSort}
                            onEditDescription={setEditDescriptionRow}
                            onEditReportingAccount={(row, rect) => {
                                setEditReportingRow(row);
                                setEditReportingRect(rect);
                            }}
                            activeReportingRow={editReportingRow}
                            selected={selected}
                            onToggleRow={handleToggleRow}
                            onToggleAll={handleToggleAll}
                            onApprovalRefClick={(row) => setApprRefSeqNo(row.apprSeqNo)}
                        />
                    }
                    footer={
                        <CardTransactionsTableFooter
                            transactionCount={rows.length}
                            totals={currencyTotals}
                            className="mt-auto"
                        />
                    }
                    pagination={
                        <Pagination
                            page={page + 1}
                            pageCount={pageCount}
                            pageSize={pageSize as 10 | 15 | 20 | 50 | 100}
                            totalLabel={`${rows.length} of ${totalCount}`}
                            onPageChange={(next) => setPage(Math.max(0, next - 1))}
                            onPageSizeChange={(size) => {
                                setPageSize(size);
                                setPage(0);
                            }}
                            className="shrink-0"
                        />
                    }
                />
            </div>

            {/* Edit dialogs — conditional-mount + key re-seed pattern so
                opening row B after row A starts each form with B's seed. */}
            {editDescriptionRow && (
                <EditDescriptionDialog
                    key={`desc-${editDescriptionRow.cardSeqNo}`}
                    row={editDescriptionRow}
                    onClose={() => setEditDescriptionRow(null)}
                    onSaved={refreshList}
                />
            )}
            {editReportingRow && editReportingRect && (
                <ReportingAccountPickerPopover
                    key={`chart-${editReportingRow.cardSeqNo}`}
                    row={editReportingRow}
                    anchorRect={editReportingRect}
                    onClose={() => {
                        setEditReportingRow(null);
                        setEditReportingRect(null);
                    }}
                    onSaved={refreshList}
                />
            )}

            {/* Approval Ref detail popup — opens on clicking the
                Approval Ref cell. Uses the shared
                <ApprovalDetailsDialog kind="card"> so the chrome reads
                identical to the other Payment Approval Details popups.
                Mirrors legacy `card_0001_001.ts:191` → `comm_0195_001.act`. */}
            <ApprovalRefDetailDialog
                open={apprRefSeqNo != null}
                apprSeqNo={apprRefSeqNo}
                rows={rows}
                onClose={() => setApprRefSeqNo(null)}
                onActed={refreshList}
            />

            {/* Request Approval — shared `<RequestApprovalDialog
                kind="card">` (Figma 7503:47745). Same full-card
                overlay every other payment page uses (Vendor /
                Expense / Internal Transfer / Payroll / Overseas).
                Submits {card_seq_nos, appr_line_no} to the backend
                in one batch call. Mirrors legacy
                `card_0001_001.ts:661-676` + `comm_0194_001_view.jsp`
                (`APPR_DV='33'`). */}
            {approvalRows && (
                <RequestApprovalDialog
                    kind="card"
                    selectedRows={approvalRows}
                    // Card has no per-batch document no like SCDUL_PYMN_NO —
                    // the real VO_YYMMDD_NNN is allocated by
                    // ApprovalBoxFanoutService.nextDocNo at submit time.
                    // Preview-fetch it from /next-doc-no on form open so
                    // the read-only field renders a meaningful value
                    // instead of falling back to selectedRows[0].id (the
                    // raw CARD_SEQ_NO).
                    documentNo={approvalDocNo ?? "—"}
                    transactions={approvalRows.map<RequestApprovalTransaction>((r) => ({
                        id:              r.id,
                        depositBankCode: "",
                        depositBankName: "",
                        depositBankCcyCd: r.ccyCd,
                        depositAccountNo: "",
                        transferAmount:  r.totalAmount,
                        recipientName:   r.fileName,
                    }))}
                    onClose={() => {
                        setApprovalRows(null);
                        setApprovalDocNo(null);
                    }}
                    onSubmitted={() => {
                        setApprovalRows(null);
                        setApprovalDocNo(null);
                        clearSelection();
                        refreshList();
                    }}
                />
            )}

            {/* Card Management modal — opens via the Manage Cards toolbar
                button. Mounts on demand and remounts each time the user
                re-opens so any in-flight inline edit / sort state resets. */}
            {manageCardsOpen && (
                <CardManagementDialog
                    open={manageCardsOpen}
                    onClose={() => setManageCardsOpen(false)}
                />
            )}

            {/* Update Cards dialog — kicks the Coocon scrape sync across
                every active registered card; refreshes the ledger on
                completion. */}
            {updateCardsOpen && (
                <UpdateCardsDialog
                    onClose={() => setUpdateCardsOpen(false)}
                    onSuccess={handleUpdateSuccess}
                />
            )}
        </div>
    );
}
