"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination, { PAGE_SIZE_OPTIONS } from "@/components/shared/Pagination";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    isSpecialViewSettingField,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { ApiCallError } from "@/lib/api/banking";
import { downloadApprovalBoxReport } from "@/lib/api/approvalBox";
import { useTranslation } from "@/lib/i18n";
import { escapeHtml, printReport } from "@/lib/print";
import { SCREEN_IDS } from "@/lib/viewSettingScreens";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import type { MappedApprovalBoxList } from "@/lib/api/mappers";

import CommonApprovalDetailsDialog from "@/components/payment/shared/CommonApprovalDetailsDialog";

import ApprovalTable, { APPROVAL_COLUMN_REGISTRY } from "./ApprovalTable";
import ApprovalTableFooter from "./ApprovalTableFooter";
import ApprovalTabs from "./ApprovalTabs";
import FilterBar from "./FilterBar";
import { useApprovalBoxList, TAB_TO_APPR_TYPE_CD } from "./useApprovalBoxList";
import type {
    ApprovalRow,
    CurrencyTotal,
} from "./types";

/** First-paint fallback for the footer currency totals — shown only
 *  before the first list response latches. Mirrors the legacy
 *  `resl_0001_001` footer which always renders USD / VND / KRW. Once
 *  `data` is present, the server-computed `footerCurrencyTotals` (full
 *  tab-unfiltered set) replaces this. */
const EMPTY_CURRENCY_TOTALS: CurrencyTotal[] = [
    { currency: "USD", total: "0" },
    { currency: "VND", total: "0" },
    { currency: "KRW", total: "0" },
];

/** Maps the View Setting `FIELD_ID` seeded in V84 to the i18n header
 *  key the page already uses for the table column. Used by the popover
 *  so the row label reads "Date" / "Type" / … instead of the raw DB
 *  identifier. */
const FIELD_ID_TO_LABEL_KEY: Record<string, string> = {
    REG_DTM: "approval.col.date",
    DOC_NM: "approval.col.type",
    DOC_NO: "approval.col.document_no",
    TITL: "approval.col.title",
    FILE_NM: "approval.col.file_name",
    CURRENCY: "approval.col.currency",
    TOT_PAY_AMT: "approval.col.amount",
    PAY_END_YN: "approval.col.status",
    PAY_DATE: "approval.col.scheduled",
    DRAFT_USER_NM: "approval.col.requestor",
    APPRER_NM: "approval.col.approver",
};

/**
 * Excel export config — one entry per FIELD_ID the backend
 * `ApprovalBoxExportProvider` knows how to project. CHECKBOX / ETC
 * are admin-only and filtered by the shared hook regardless.
 * `widthChars` follows the CLAUDE.md §13b guidance:
 *   text (short)            → 16–20
 *   text (composite)        → 32–40
 *   amount (VND-scale)      → 22
 *   datetime / scheduled    → 22
 */
/**
 * Default column layout used until `useViewSetting` resolves the user's
 * persisted preferences. Mirrors the legacy `resl_0001_001` OSMC seed
 * (queried verbatim from JEX DEV `SYS_SCR_OPTION_WECMS` on 2026-05-27)
 * + the refactor's V207 reseed of `SYS_SCR_OPTION_WECMS` for
 * `approval-box`. Once the hook resolves, `vs.items` takes over.
 *
 * 11 columns in legacy order: Date · Type · Document No. · Title · File
 * Name · Currency · Transfer Amount · Approval Status · Scheduled Date ·
 * Requestor · Approver.
 */
const APPROVAL_FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "REG_DTM",       field_nm: "Date",              disp_ord: 1,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "90px"  },
    { field_id: "DOC_NM",        field_nm: "Type",              disp_ord: 2,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "170px" },
    { field_id: "DOC_NO",        field_nm: "Document No.",      disp_ord: 3,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "135px" },
    { field_id: "TITL",          field_nm: "Title",             disp_ord: 4,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "220px" },
    { field_id: "FILE_NM",       field_nm: "File Name",         disp_ord: 5,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "260px" },
    { field_id: "CURRENCY",      field_nm: "Transfer Currency", disp_ord: 6,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "150px" },
    { field_id: "TOT_PAY_AMT",   field_nm: "Transfer Amount",   disp_ord: 7,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "150px" },
    { field_id: "PAY_END_YN",    field_nm: "Approval Status",   disp_ord: 8,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "160px" },
    { field_id: "PAY_DATE",      field_nm: "Scheduled Date",    disp_ord: 9,  use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "145px" },
    { field_id: "DRAFT_USER_NM", field_nm: "Requestor",         disp_ord: 10, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "180px" },
    { field_id: "APPRER_NM",     field_nm: "Approver",          disp_ord: 11, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "180px" },
];

export default function ApprovalBoxPage() {
    const { t, locale } = useTranslation();
    const sysDialog = useDialog();
    const list = useApprovalBoxList();
    const viewSetting = useViewSetting(SCREEN_IDS.PAYMENT_APPROVAL_BOX);

    /* Shared table-sort cycle (default → ASC → DESC → default) per
     * CLAUDE.md §13a. The hook owns the cycle state; sync into the
     * list hook so the API request gets `sortField` / `sortDirection`
     * and the backend ORDER BY follows. Mirrors the Account Inquiry
     * pattern (`AccountInquiryClient` → `AccountService.list`). */
    const sort = useTableSort();
    const { setSort: setListSort } = list;
    useEffect(() => {
        setListSort(sort.sortField, sort.sortDirection);
    }, [sort.sortField, sort.sortDirection, setListSort]);

    /** APPR_SEQ_NO of the row opened in the SHARED CommonApprovalDetailsDialog.
     *  Every type (including card, after the Phase-3 card migration) routes
     *  here; the shared dialog self-fetches the detail + approver chain and owns
     *  approve / reject / edit / withdraw (per-kind dispatch lives inside it).
     *  Null when closed. */
    const [commonApprSeqNo, setCommonApprSeqNo] = useState<string | null>(null);

    /* Deep-link (notification click → `?appr_seq_no=…`). `deepLinkApprSeqNo` is
     * read once from the URL via a lazy initialiser (client-only; SSR-safe via
     * the typeof-window guard) so there's no setState-in-effect on mount;
     * `highlightApprSeqNo` tints the matched row; `deepLinkHandledRef`
     * guarantees the auto-open fires exactly once even though the list effect
     * re-runs on every filter / refetch. */
    const [deepLinkApprSeqNo] = useState<string | null>(() => {
        if (typeof window === "undefined") return null;
        return new URLSearchParams(window.location.search).get("appr_seq_no")?.trim() || null;
    });
    const [highlightApprSeqNo, setHighlightApprSeqNo] = useState<string | null>(null);
    const deepLinkHandledRef = useRef(false);

    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[]>([]);

    /* Stable-data latch — preserves the previous response across
     * refetches (tab switch, search debounce, pagination, mutation
     * refetch) so the table doesn't flash empty between requests.
     * Mirrors the Account Inquiry / Operation Status pattern. */
    const [stableData, setStableData] = useState<MappedApprovalBoxList | null>(list.data);
    const [prevData, setPrevData] = useState<MappedApprovalBoxList | null>(list.data);
    if (list.data !== prevData) {
        setPrevData(list.data);
        if (list.data) setStableData(list.data);
    }

    const data = stableData;
    const rows = useMemo(() => data?.rows ?? [], [data]);
    const tabCounts = data?.tabCounts ?? {
        all: 0,
        draft: 0,
        pending: 0,
        in_progress: 0,
        approved: 0,
        rejected: 0,
    };
    const totalCount = data?.totalCount ?? 0;
    const totalPages = data?.totalPages ?? 0;
    // Footer document count is TAB-UNFILTERED (full result set) — distinct
    // from totalCount (tab-filtered) which drives pagination. Legacy
    // resl_0001_001 footer parity.
    const footerDocumentCount = data?.footerDocumentCount ?? 0;

    /* Sticky-wrapped initial-loading gate — true only while the very
     * first fetch is in flight (no response latched yet). Keeps the
     * "Loading…" centered message visible ≥ 400 ms even when the API
     * responds in <50 ms so the user notices something happened
     * before rows pop in. Subsequent refetches keep the previous rows
     * visible via {@link stableData} and never trip this gate. */
    const stickyInitialLoading = useStickyLoading(list.loading && !stableData);

    const displayRows = useMemo<ApprovalRow[]>(
        () =>
            rows.map((r) => ({
                ...r,
                type: r.typeKey ? t(`approval.type.${r.typeKey}`) : r.documentNo,
            })),
        [rows, t],
    );

    // Footer currency totals come from the backend aggregate (tab-unfiltered,
    // full result set) — NOT a client page-slice sum. Falls back to a
    // three-currency zero set on the very first paint before any response
    // latches, mirroring the legacy footer which always shows USD/VND/KRW.
    const currencyTotals = data?.footerCurrencyTotals ?? EMPTY_CURRENCY_TOTALS;

    /**
     * Resolve the live View Setting items into the columns the table
     * should actually render — filtered to USE_YN === "Y", dropping
     * special (CHECKBOX / ETC) + admin-hidden (DISP_YN === "N") rows,
     * dropping columns the registry doesn't know how to render, then
     * sorted by DISP_ORD. Falls back to {@link APPROVAL_FALLBACK_COLUMNS}
     * until the API resolves so the table doesn't flash empty.
     */
    /**
     * Detect the "V207 not yet applied" state — backend still returns
     * the V109 seed (no FILE_NM, CURRENCY at disp_ord=10). When that's
     * the case fall back to the canonical legacy order from
     * {@link APPROVAL_FALLBACK_COLUMNS} so the table + popover render
     * Transfer Currency before Transfer Amount + show File Name
     * regardless of whether the backend's reseed migration has run on
     * the dev's local DB. Once V207 lands, backend items take over.
     */
    const orderedItems = useMemo<ViewSettingItem[]>(() => {
        const backendHasNewOrder =
            viewSetting.items.length > 0 &&
            viewSetting.items.some((it) => it.field_id === "FILE_NM");
        return backendHasNewOrder ? viewSetting.items : APPROVAL_FALLBACK_COLUMNS;
    }, [viewSetting.items]);

    const visibleColumns = useMemo<ViewSettingItem[]>(() => {
        return orderedItems
            .filter(
                (it) =>
                    !isSpecialViewSettingField(it.field_id) &&
                    it.disp_yn !== "N" &&
                    it.use_yn === "Y" &&
                    APPROVAL_COLUMN_REGISTRY[it.field_id] !== undefined,
            )
            .slice()
            .sort((a, b) => a.disp_ord - b.disp_ord);
    }, [orderedItems]);

    // Every type (card included) opens the SHARED CommonApprovalDetailsDialog by
    // APPR_SEQ_NO — the legacy single-popup architecture (comm_0195_001). The
    // shared dialog self-fetches the normalized detail + approver chain and owns
    // approve / reject / edit / withdraw (per-kind dispatch — incl. card's
    // dedicated withdraw/change-line — lives inside it).
    const openDocumentDetails = useCallback((row: ApprovalRow) => {
        setCommonApprSeqNo(row.apprSeqNo);
    }, []);

    /* Resolve the deep-link after the list has loaded: locate the matching
     * row, highlight it, and open the read-only Approval Details dialog.
     * Runs exactly once (deepLinkHandledRef) so closing the dialog or
     * changing a filter never re-opens it. A target outside the current
     * list (wrong tab / page / date window, or already gone) surfaces a
     * single non-blocking warning rather than failing silently. */
    useEffect(() => {
        if (deepLinkHandledRef.current || !deepLinkApprSeqNo) return;
        // Wait for the first fetch to settle. On error, leave it unhandled
        // so a later successful refetch can still resolve the deep link.
        if (list.loading) return;
        if (list.error) return;
        deepLinkHandledRef.current = true;
        const match = rows.find((r) => r.apprSeqNo === deepLinkApprSeqNo);
        if (match) {
            // Genuine "react once when the list settles" effect (ref-guarded):
            // the highlight + auto-open fire in response to async data arrival,
            // which can't be derived during render or via a lazy initialiser.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHighlightApprSeqNo(deepLinkApprSeqNo);
            openDocumentDetails(match);
        } else {
            sysDialog.open({
                type: "warning",
                title: t("dialog.warning"),
                description: t("approval.deeplink.not_found"),
            });
        }
    }, [
        deepLinkApprSeqNo,
        list.loading,
        list.error,
        rows,
        openDocumentDetails,
        sysDialog,
        t,
    ]);

    const listError = list.error;
    useEffect(() => {
        if (!listError) return;
        sysDialog.open({
            type: "error",
            title: t("dialog.error"),
            description: listError.message,
            errorCode: listError.code,
            uuid: listError.traceId,
        });
    }, [listError, sysDialog, t]);

    const openViewSetting = useCallback(
        (anchor: DOMRect) => {
            // Use the same canonical-vs-backend resolution as the table —
            // if the backend hasn't shipped the V207 reseed yet, seed the
            // popover from APPROVAL_FALLBACK_COLUMNS so the row order
            // matches what the user sees in the table (Transfer Currency
            // before Transfer Amount, File Name in position 5).
            setVsDraft(orderedItems as ViewSettingItem[]);
            setVsAnchor(anchor);
        },
        [orderedItems],
    );
    const closeViewSetting = useCallback(() => setVsAnchor(null), []);

    /** Mirrors the legacy `resl_0001_001_osmc.ts setUpDataForPrintImpl`
     *  flow — print the page's current filtered rows (NOT just the page
     *  slice) via the shared `printReport` helper. Columns reflect the
     *  on-screen 10-column set (no checkbox, no row-action cell —
     *  CLAUDE.md §6d "Columns must match the on-screen table"). */
    const handlePrint = useCallback(() => {
        const summary = t("approval.pagination_label", {
            shown: displayRows.length,
            total: totalCount,
        });
        printReport({
            title: t("approval.title"),
            summary,
            columns: [
                { header: t("approval.col.date"), render: (r) => escapeHtml(r.date) },
                { header: t("approval.col.type"), render: (r) => escapeHtml(r.type ?? r.documentNo) },
                { header: t("approval.col.document_no"), render: (r) => escapeHtml(r.documentNo) },
                { header: t("approval.col.title"), render: (r) => escapeHtml(r.title) },
                { header: t("approval.col.file_name"), render: (r) => escapeHtml(r.fileName) },
                { header: t("approval.col.currency"), render: (r) => escapeHtml(r.currency) },
                { header: t("approval.col.amount"), align: "right", render: (r) => escapeHtml(r.amount) },
                { header: t("approval.col.status"), render: (r) => escapeHtml(t(`approval.tab.${r.status}`)) },
                { header: t("approval.col.scheduled"), render: (r) => escapeHtml(r.scheduledDate ?? t("approval.scheduled_empty")) },
                { header: t("approval.col.requestor"), render: (r) => escapeHtml(r.requestor) },
                {
                    header: t("approval.col.approver"),
                    render: (r) => {
                        const name = escapeHtml(r.approver);
                        if (r.approverCount == null) return name;
                        return `${name} <span class="muted small">(${r.approverCount})</span>`;
                    },
                },
            ],
            rows: displayRows,
        });
    }, [displayRows, totalCount, t]);

    /** Excel Download — PO-requested **template-based** report. Routes
     *  through the dedicated `GET /api/v1/payment/approval-box/report`
     *  endpoint (NOT the generic `POST /export`), which loads the locale
     *  `.xls` template and populates it server-side. The current filters
     *  (date range + status tab + keyword), sort, and UI locale travel
     *  with the request so the download mirrors the on-screen list.
     *  See docs/audits/approval-box-excel-download-audit.md. */
    const handleExportExcel = useCallback(async () => {
        try {
            await downloadApprovalBoxReport({
                fromDate:      list.fromDateIso.replace(/-/g, ""),
                toDate:        list.toDateIso.replace(/-/g, ""),
                apprTypeCd:    TAB_TO_APPR_TYPE_CD[list.tab],
                srchWd:        list.search.trim(),
                sortField:     list.sortField,
                sortDirection: list.sortDirection,
                lang:          locale,
            });
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const message = err instanceof ApiCallError
                ? err.message
                : t("approval.export_failed");
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        }
    }, [
        list.fromDateIso,
        list.toDateIso,
        list.tab,
        list.search,
        list.sortField,
        list.sortDirection,
        locale,
        sysDialog,
        t,
    ]);

    return (
        <PageLayout>
            <PageHeader title={t("approval.title")}>
                <PageActionButtons
                    showList
                    showPrint
                    showExcel
                    onList={openViewSetting}
                    onPrint={handlePrint}
                    onExport={handleExportExcel}
                />
            </PageHeader>

            <ApprovalTabs
                active={list.tab}
                counts={tabCounts}
                onChange={list.setTab}
            />

            <FilterBar
                period={list.period}
                onPeriodChange={list.setPeriod}
                manualRange={list.manualRange}
                onManualRangeChange={list.setManualRange}
                startDateIso={list.fromDateIso}
                endDateIso={list.toDateIso}
                search={list.search}
                onSearchChange={list.setSearch}
            />

            <DataTableShell
                footerMode="paginationWithTotals"
                table={
                    <>
                        <ApprovalTable
                            rows={displayRows}
                            items={visibleColumns}
                            onDocumentNoClick={openDocumentDetails}
                            sortField={sort.sortField}
                            sortDirection={sort.sortDirection}
                            onSort={sort.toggleSort}
                            highlightApprSeqNo={highlightApprSeqNo}
                        />
                        {/* Page-specific empty-state — rendered below
                           the header when the current page has no rows.
                           Same `text-wb-13 font-medium text-wb-ntrl-6`
                           token chain as the Account Inquiry baseline.
                           While the initial fetch is in flight (sticky-
                           wrapped, ≥ 400 ms minimum visibility) the
                           message reads `t("common.loading")` so a fast
                           cached response doesn't flash empty → loading
                           → table on first paint. Subsequent refetches
                           keep the previous rows visible via the
                           stable-data latch and never trip this gate. */}
                        {displayRows.length === 0 && (
                            <div className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6">
                                {stickyInitialLoading
                                    ? t("common.loading")
                                    : t("approval.empty")}
                            </div>
                        )}
                    </>
                }
                footer={
                    <ApprovalTableFooter
                        className="mt-auto"
                        documentCount={footerDocumentCount}
                        totals={currencyTotals}
                        items={visibleColumns}
                    />
                }
                pagination={
                    <Pagination
                        page={list.page + 1}
                        pageCount={Math.max(totalPages, 1)}
                        pageSize={list.pageSize}
                        totalLabel={t("approval.pagination_label", {
                            shown: displayRows.length,
                            total: totalCount,
                        })}
                        className="shrink-0"
                        onPageChange={(p: number) => list.setPage(Math.max(0, p - 1))}
                        onPageSizeChange={(s: number) => list.setPageSize(s)}
                        pageSizeOptions={PAGE_SIZE_OPTIONS}
                    />
                }
            />

            {/* Shared Approval Details popup — EVERY type (card included).
               Self-fetches the normalized detail by APPR_SEQ_NO and owns approve
               / reject / edit / withdraw (per-kind dispatch, incl. card's
               dedicated endpoints, lives inside the shared dialog). Refetch the
               list on close so a status change made in the popup is reflected in
               the row + the tab counts. */}
            {commonApprSeqNo && (
                <CommonApprovalDetailsDialog
                    apprSeqNo={commonApprSeqNo}
                    onClose={() => {
                        setCommonApprSeqNo(null);
                        void list.refetch();
                    }}
                />
            )}

            {vsAnchor && (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={setVsDraft}
                    getLabel={(item) => {
                        const key = FIELD_ID_TO_LABEL_KEY[item.field_id];
                        return key ? t(key) : item.field_nm;
                    }}
                    onSave={async () => {
                        await viewSetting.save(vsDraft);
                        closeViewSetting();
                    }}
                    onReset={async () => {
                        const fresh = await viewSetting.reset();
                        setVsDraft(fresh as ViewSettingItem[]);
                    }}
                    onClose={closeViewSetting}
                />
            )}
        </PageLayout>
    );
}

