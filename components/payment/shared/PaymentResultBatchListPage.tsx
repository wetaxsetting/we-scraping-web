"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import BatchListStickyFooter from "@/components/payment/shared/BatchListStickyFooter";
import CommonApprovalDetailsDialog from "@/components/payment/shared/CommonApprovalDetailsDialog";
import TableEmptyState from "@/components/payment/shared/TableEmptyState";
import DateRangeFilter, {
    type DateRangeFilterPreset,
    type DateRangeFilterValue,
} from "@/components/shared/DateRangeFilter";
import DataTableShell from "@/components/shared/DataTableShell";
import DownloadIcon from "@/components/shared/icons/DownloadIcon";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import type { ViewSettingItem } from "@/components/shared/view-setting";
import { Checkbox } from "@/components/ui/checkbox";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type {
    ListSortDirection,
    ManualDateRange,
    PeriodKey,
} from "./PaymentScheduledBatchListPage";

/**
 * Common batch-file Result row contract — every Payment module's Result
 * list row satisfies this shape. Internal Transfer is the canonical Figma
 * reference (1:11730); Vendor (24:5491), Expense (25:9221), Payroll
 * (27:12877), and Overseas (29:16738) all show the same shape.
 */
export type PaymentResultBatchRowStatus = "completed" | "in_progress";

export type PaymentResultBatchRow = {
    id: string;
    /** Two-line date + time, e.g. `"30-10-2024\n11:39:50"`. */
    dateTime: string;
    fileName: string;
    txnCount: number;
    txnCurrency: string;
    totalAmount: string;
    status: PaymentResultBatchRowStatus;
    /** Inline success counter — only rendered when `status === "completed"`. */
    successCount?: number;
    /** Inline failed counter — only rendered when `status === "completed"`. */
    failedCount?: number;
    approvalRef: string;
    approvalTitle: string;
    /** F4b — approval-document identifier (legacy `APPR_SEQ_NO`). When present
     *  the Approval Ref cell renders as a clickable link that opens the shared
     *  Approval Details popup (refactor equivalent of legacy `comm_0195_001`).
     *  Null/absent for draft rows with no approval → cell stays plain text. */
    approvalRefId?: string | null;
};

type FooterTotal = { currency: string; amount: string };

/**
 * Per-column sort mapping: maps stable column keys used inside the shared
 * shell to backend FIELD_IDs from the page's whitelist enum. Columns
 * missing from the map render without sort wiring.
 */
export type ResultBatchSortable = Partial<Record<
    | "DATE_TIME"
    | "FILE_NAME"
    | "TXN_COUNT"
    | "TOTAL_AMOUNT"
    | "STATUS"
    | "APPROVAL_REF"
    | "APPROVAL_TITLE",
    string
>>;

/** Status filter checkbox group state — Figma 1:11730. */
export type ResultStatusFilter = {
    completed: boolean;
    in_progress: boolean;
};

/**
 * Definition for an extra module-specific column rendered between
 * Total Transfer Amount and Approval Ref. in the result table.
 * The caller passes a list of these via the `extraColumns` prop so
 * module-specific fields (Scheduled Date, Approval Status, Requestor,
 * Approver) don't pollute the shared base row type.
 */
export type ResultExtraColumn<Row> = {
    /** View Setting FIELD_ID — controls visibility via `isVisible()`. */
    fieldId: string;
    header: React.ReactNode;
    renderCell: (row: Row) => React.ReactNode;
    /** Optional CSS width applied to the `<col>` element. */
    width?: string;
    /** Backend FIELD_ID for this column; when set the header becomes sortable. */
    sortFieldId?: string;
};

export type PaymentResultBatchListPageProps<Row extends PaymentResultBatchRow> = {
    /** Already-translated page title (`t("payment.<module>.result_title")`). */
    title: string;
    rows: Row[];
    /** Builds the row's detail-page route. */
    rowDetailHref: (row: Row) => string;
    /** Min-width of the table — defaults to the canonical 8-column token. */
    tableMinWidth?: string;
    /**
     * Per-currency total amounts rendered in the sibling footer. Pass an
     * empty array (or omit) to use `paginationOnly` mode — Internal
     * Transfer Result is the only Result page that omits the totals row
     * per Figma 1:11730. Every other Payment Result variant must supply
     * at least one total per CLAUDE.md §12a.
     */
    totals?: FooterTotal[];
    /** Searchable string fields — defaults to fileName/approvalRef/approvalTitle. */
    searchableFields?: (keyof Row & string)[];
    /**
     * Unit label rendered in the "No. of Transactions" cell —
     * `{txnCount} {txnUnitLabel} ({txnCurrency})`. Defaults to the legacy
     * abbreviation `"Trx"` so existing callers (Vendor / Expense / Payroll
     * / Overseas Result) are unchanged; Internal Transfer Result passes the
     * full word `"Transaction"` (legacy `pymn_0010_001` parity).
     */
    txnUnitLabel?: string;

    /* — Server-driven pagination (opt-in) ——————————————————————————
     *
     * When `pagination` is provided the shared shell wires the
     * `<Pagination>` controls to the caller's state instead of
     * computing client-side counts from `rows.length`. Pages that
     * still run on mock data omit this prop and inherit the legacy
     * client-side fallback.
     */
    pagination?: {
        page: number;          // zero-based
        pageSize: number;
        totalCount: number;
        onPageChange: (page: number) => void;
        onPageSizeChange: (size: number) => void;
    };

    /* — Server-driven sort (opt-in) ———————————————————————————————
     *
     * `sort` carries the current sort state (from `useTableSort`).
     * `sortableColumns` maps stable column keys to backend FIELD_IDs.
     * Pages omit columns that aren't in the whitelist so those headers
     * stay non-clickable.
     */
    sort?: { field: string | null; direction: ListSortDirection };
    sortableColumns?: ResultBatchSortable;
    onSort?: (fieldId: string) => void;

    /* — Period dropdown (opt-in) ——————————————————————————————————
     *
     * When `period` + `onPeriodChange` are provided the toolbar's
     * "Last N Days" chip becomes an interactive popover with four
     * options (Last 30 / 90 / 180 Days + Enter Manually). "Enter
     * Manually" emits the user's chosen window via
     * {@link onManualRangeChange}.
     */
    period?: PeriodKey;
    onPeriodChange?: (period: PeriodKey) => void;
    manualRange?: ManualDateRange;
    onManualRangeChange?: (range: ManualDateRange) => void;

    /* — Server-driven search (opt-in) ——————————————————————————————
     *
     * When `onSearchChange` is provided the shared toolbar's
     * SearchInput becomes a controlled component bound to `search`.
     * Pages debounce-forward the value into their data fetcher's
     * `srch_wd` param and reset to page 0 on every change.
     */
    search?: string;
    onSearchChange?: (keyword: string) => void;

    /* — Status filter checkboxes (opt-in) ————————————————————————————
     *
     * When `statusFilter` + `onStatusFilterChange` are provided the
     * checkboxes become controlled. Both flags false (or both true)
     * means "all" — pages translate that into a missing `trnf_stts`
     * query param. The shared shell otherwise owns the filter state
     * (legacy client-side behaviour for mock-data pages).
     */
    statusFilter?: ResultStatusFilter;
    onStatusFilterChange?: (next: ResultStatusFilter) => void;

    /* — Toolbar icons (opt-in) ——————————————————————————————————
     *
     * `onPrint` wires the printer icon to a real handler — pages pass
     * a closure that builds a {@link PrintColumn} list from the
     * current row set and calls {@link printReport}.
     *
     * `onListView` receives the icon's `DOMRect` so callers can
     * anchor the shared View Setting popover (CLAUDE.md §13). Pages
     * without View Setting wiring may ignore the argument and open a
     * "coming soon" dialog stub.
     *
     * `onExcelExport` fires when the user clicks the Excel icon — pages
     * route this to `useExcelExport()` (CLAUDE.md §13b) once the backend
     * has a per-resource export endpoint; otherwise to a "coming soon"
     * dialog stub.
     *
     * `onCalendarClick` fires when the user clicks the toolbar's
     * calendar icon. Pages wire this to a custom date-range picker (or
     * a "coming soon" notice while the picker isn't built yet). Omit to
     * render the icon inert.
     */
    onPrint?: () => void;
    onListView?: (anchorRect: DOMRect) => void;
    onExcelExport?: () => void;
    onCalendarClick?: () => void;

    /* — Per-row trailing download icon ————————————————————————————
     *
     * Fires when the user clicks the small `ico-download.svg` glyph on
     * the right edge of each row. Pages typically call the per-batch
     * original-Excel download endpoint (Internal Transfer:
     * `downloadOriginalExcel(row.id)`; Vendor / Expense / Payroll have
     * the matching module-prefixed helper).
     *
     * When omitted the icon renders inert (matches the previous
     * static-shell behaviour for modules that haven't wired the
     * download endpoint yet).
     */
    onDownloadRow?: (row: Row) => void;

    /* — Column visibility from View Setting (opt-in) ————————————————
     *
     * When provided, each seeded data column on the shell maps to a
     * View Setting `FIELD_ID` and renders only when its `USE_YN === "Y"`.
     * Unknown FIELD_IDs default to hidden so extra columns don't bleed
     * into modules that haven't seeded them. The trailing action column
     * is always rendered.
     *
     * Pages that don't pass this prop fall back to the legacy
     * always-render behaviour — preserves backwards-compat for the
     * other Payment modules that don't yet wire View Setting.
     */
    viewSettingItems?: ViewSettingItem[];

    /**
     * Module-specific columns inserted between Total Transfer Amount
     * and Approval Ref. Each entry is controlled by its `fieldId` via
     * the same `isVisible()` mechanism as the base columns — only
     * renders when the View Setting seed includes the FIELD_ID with
     * `USE_YN = 'Y'`.
     */
    extraColumns?: ResultExtraColumn<Row>[];

    /**
     * Pre-translated empty-state copy rendered below the table header
     * when the filtered/paginated row set is empty. Each Payment module
     * passes its page-specific message via `t(...)`. Omit to leave the
     * empty body silent (legacy behaviour).
     */
    emptyMessage?: string;

    /**
     * Sticky-wrapped initial-loading flag from the consumer
     * (`useStickyLoading(state.loading && !stableData)`). When true AND
     * the filtered row set is empty, the shell renders
     * `t("common.loading")` in the empty-state slot instead of
     * {@link emptyMessage}. Mirrors the Account Inquiry pattern.
     */
    loading?: boolean;

    /**
     * Sticky-wrapped mutation-in-flight flag — disables row-level
     * Download / Inquire icons across the minimum-visibility window
     * so a fast refresh doesn't flicker the affordance.
     */
    actionInFlight?: boolean;

    /**
     * Per-page FIELD_ID aliases. Each entry overrides the default V131
     * FIELD_ID the shell uses for the matching column slot. Pages that
     * don't pass this prop keep the V131 set (REG_DTM=Date/Time,
     * ORG_FILE_NM=File Name, TOT_TRNS_CNT=No. of Transactions,
     * TOTAL_TRAN_AMT=Total, TRNF_YN=Status, APPR_SEQ_NO=Approval Ref,
     * TITL=Approval Title) — preserves backward-compat for Vendor /
     * Expense / Payroll / Overseas Result.
     *
     * Internal Transfer Result's V219 seed uses the legacy pymn_0010_001
     * FIELD_IDs (TRAN_DT, FILE_NM, SCDUL_PYMN_DETL_NO, TRAN_AMT,
     * PROC_STAT, APPR_DOC_NO, TITL); the page supplies a full alias
     * map so the shell honours those names.
     */
    fieldIdMap?: {
        /** FIELD_ID for the Date/Time slot. Default {@code "REG_DTM"}. */
        dateTime?: string;
        /** FIELD_ID for the File Name slot. Default {@code "ORG_FILE_NM"}. */
        fileName?: string;
        /** FIELD_ID for the No. of Transactions slot. Default {@code "TOT_TRNS_CNT"}. */
        txnCount?: string;
        /** FIELD_ID for the Total Transfer Amount slot. Default {@code "TOTAL_TRAN_AMT"}. */
        totalAmount?: string;
        /** FIELD_ID for the Transfer Status slot. Default {@code "TRNF_YN"}. */
        status?: string;
        /** FIELD_ID for the Approval Ref slot. Default {@code "APPR_SEQ_NO"}. */
        approvalRef?: string;
        /** FIELD_ID for the Approval Title slot. Default {@code "TITL"}. */
        approvalTitle?: string;
    };
};

const DEFAULT_TABLE_MIN_WIDTH = "var(--w-wb-tr-table-min)";
const DEFAULT_SEARCHABLE: (keyof PaymentResultBatchRow & string)[] = [
    "fileName",
    "approvalRef",
    "approvalTitle",
];

/**
 * Shared batch-file Payment Result list page. Every Payment module routes
 * through this template — see CLAUDE.md §12a. Visual contract is identical
 * across modules: same toolbar (period dropdown + shared CalendarIconButton
 * + Completed / In Progress checkboxes + SearchInput), same 8-column table
 * (no checkbox, status counters, trailing per-row size-4 download glyph),
 * same `paginationWithTotals` footer aligned under Total Transfer Amount
 * (or `paginationOnly` for Internal Transfer Result).
 */
export default function PaymentResultBatchListPage<Row extends PaymentResultBatchRow>({
    title,
    rows,
    rowDetailHref,
    tableMinWidth = DEFAULT_TABLE_MIN_WIDTH,
    totals,
    searchableFields,
    txnUnitLabel = "Trx",
    pagination,
    sort,
    sortableColumns,
    onSort,
    period,
    onPeriodChange,
    manualRange,
    onManualRangeChange,
    search: controlledSearch,
    onSearchChange,
    statusFilter: controlledStatusFilter,
    onStatusFilterChange,
    onPrint,
    onListView,
    onExcelExport,
    // `onCalendarClick` predates the shared <DateRangeFilter> rollout —
    // the calendar trigger now lives inside the shared filter component
    // so this callback is preserved for backwards-compat with existing
    // callers (Internal Transfer / Overseas Result) but no longer fires.
    onCalendarClick: _onCalendarClick,
    onDownloadRow,
    viewSettingItems,
    extraColumns,
    emptyMessage,
    loading,
    actionInFlight,
    fieldIdMap,
}: PaymentResultBatchListPageProps<Row>) {
    const { t } = useTranslation();
    const router = useRouter();

    // F4b — Approval Ref → shared Approval Details popup (legacy comm_0195_001).
    // Holds the appr_seq_no of the row whose Approval Ref was clicked; null = closed.
    const [apprDialogSeqNo, setApprDialogSeqNo] = useState<string | null>(null);

    // Resolve each column slot to its FIELD_ID — pages may override via
    // `fieldIdMap`, otherwise the V131 defaults apply. The shell uses
    // these for both visibility gating AND the DB-driven width lookup.
    const dateTimeFieldId      = fieldIdMap?.dateTime      ?? "REG_DTM";
    const fileNameFieldId      = fieldIdMap?.fileName      ?? "ORG_FILE_NM";
    const txnCountFieldId      = fieldIdMap?.txnCount      ?? "TOT_TRNS_CNT";
    const totalAmountFieldId   = fieldIdMap?.totalAmount   ?? "TOTAL_TRAN_AMT";
    const statusFieldId        = fieldIdMap?.status        ?? "TRNF_YN";
    const approvalRefFieldId   = fieldIdMap?.approvalRef   ?? "APPR_SEQ_NO";
    const approvalTitleFieldId = fieldIdMap?.approvalTitle ?? "TITL";

    // When `onSearchChange` is supplied the page owns the search state
    // (server-driven flows debounce-forward to the API). Otherwise the
    // shell keeps its legacy local-state behaviour so mock-data pages
    // continue to client-side filter.
    const isSearchControlled = onSearchChange !== undefined;
    const [internalSearch, setInternalSearch] = useState("");
    const search = isSearchControlled ? (controlledSearch ?? "") : internalSearch;
    const setSearch = isSearchControlled
        ? (next: string) => onSearchChange(next)
        : setInternalSearch;

    // Same controlled/uncontrolled split for the status checkboxes.
    const isStatusControlled = onStatusFilterChange !== undefined;
    const [internalStatus, setInternalStatus] = useState<ResultStatusFilter>({
        completed: false,
        in_progress: false,
    });
    const statusFilter = isStatusControlled
        ? (controlledStatusFilter ?? { completed: false, in_progress: false })
        : internalStatus;
    const setStatusFilter = isStatusControlled
        ? (next: ResultStatusFilter) => onStatusFilterChange(next)
        : setInternalStatus;

    // FIELD_ID → USE_YN visibility map (opt-in). When the page doesn't
    // pass `viewSettingItems` every column stays visible — preserves the
    // legacy always-render behaviour for modules that haven't wired View
    // Setting yet.
    const visibilityMap = useMemo(() => {
        const map = new Map<string, boolean>();
        if (viewSettingItems) {
            for (const item of viewSettingItems) {
                map.set(item.field_id, item.use_yn === "Y");
            }
        }
        return map;
    }, [viewSettingItems]);
    const isVisible = (fieldId: string): boolean => {
        if (!viewSettingItems) return true;
        // Unknown FIELD_IDs default to hidden when viewSettingItems is active
        // so extra/module-specific columns don't show on modules that haven't
        // seeded them.
        return visibilityMap.get(fieldId) ?? false;
    };

    // FIELD_ID → SIZE map for DB-driven column widths. When the seed
    // ships a `size` value (e.g. `"105px"`), the <col> consumes it
    // directly; otherwise the column falls back to its CSS-var default.
    const widthByFieldId = useMemo(() => {
        const map = new Map<string, string>();
        if (viewSettingItems) {
            for (const item of viewSettingItems) {
                if (item.size) map.set(item.field_id, item.size);
            }
        }
        return map;
    }, [viewSettingItems]);
    const widthFor = (fieldId: string, fallback: string): string =>
        widthByFieldId.get(fieldId) ?? fallback;

    // When the page drives pagination server-side, `rows` is the
    // already-resolved current page — DO NOT client-side filter (the
    // search + status pickers are pushed to the page's data fetcher).
    // Pages that still ship the static mock keep the original
    // client-side filter behaviour.
    const serverDriven = Boolean(pagination);
    const filtered = useMemo(() => {
        if (serverDriven) return rows;
        const anyChecked = statusFilter.completed || statusFilter.in_progress;
        const bucket = anyChecked
            ? rows.filter(
                (r) =>
                    (statusFilter.completed && r.status === "completed") ||
                    (statusFilter.in_progress && r.status === "in_progress"),
            )
            : rows;
        if (!search.trim()) return bucket;
        const q = search.trim().toLowerCase();
        const fields = (searchableFields ?? DEFAULT_SEARCHABLE) as (keyof Row & string)[];
        return bucket.filter((r) =>
            fields
                .map((f) => {
                    const v = r[f];
                    return typeof v === "string" ? v : "";
                })
                .join(" ")
                .toLowerCase()
                .includes(q),
        );
    }, [rows, search, statusFilter, searchableFields, serverDriven]);

    const goToDetail = (row: Row) => router.push(rowDetailHref(row));

    // Switch on whether the caller PASSED a totals array, not whether
    // it has entries. The sticky footer always shows the canonical
    // USD / VND totals (defaulting to 0 when missing — see
    // `<BatchListStickyFooter>`), so pages that opt into the footer
    // should keep showing it even when the current page has no rows.
    // Pages that genuinely want no footer (e.g. screens still on the
    // legacy paginationOnly contract) simply omit the prop.
    const hasTotals = totals != null;

    const extraCols = (extraColumns ?? []) as ResultExtraColumn<unknown>[];

    const tableNode = (
        <>
        <table
            className="w-full table-fixed border-collapse"
            style={{ minWidth: tableMinWidth }}
        >
            <ResultColumns
                isVisible={isVisible}
                extraColumns={extraCols}
                widthFor={widthFor}
                dateTimeFieldId={dateTimeFieldId}
                fileNameFieldId={fileNameFieldId}
                txnCountFieldId={txnCountFieldId}
                totalAmountFieldId={totalAmountFieldId}
                statusFieldId={statusFieldId}
                approvalRefFieldId={approvalRefFieldId}
                approvalTitleFieldId={approvalTitleFieldId}
            />
            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    {isVisible(dateTimeFieldId) &&
                        renderSortableHeader(
                            "DATE_TIME",
                            t("payment.internal.col.date_time"),
                            sortableColumns,
                            sort,
                            onSort,
                        )}
                    {isVisible(fileNameFieldId) &&
                        renderSortableHeader(
                            "FILE_NAME",
                            t("payment.internal.col.file_name"),
                            sortableColumns,
                            sort,
                            onSort,
                        )}
                    {isVisible(txnCountFieldId) &&
                        renderSortableHeader(
                            "TXN_COUNT",
                            t("payment.internal.col.txn_count"),
                            sortableColumns,
                            sort,
                            onSort,
                        )}
                    {isVisible(totalAmountFieldId) &&
                        renderSortableHeader(
                            "TOTAL_AMOUNT",
                            t("payment.internal.col.total_transfer"),
                            sortableColumns,
                            sort,
                            onSort,
                            "right",
                        )}
                    {extraCols
                        .filter((ec) => isVisible(ec.fieldId))
                        .map((ec) =>
                            ec.sortFieldId && sort && onSort ? (
                                <TableHeaderCell
                                    key={ec.fieldId}
                                    textSizeClass="text-wb-13"
                                    sortFieldId={ec.sortFieldId}
                                    activeSortField={sort.field}
                                    activeSortDirection={sort.direction}
                                    onSort={onSort}
                                >
                                    {ec.header}
                                </TableHeaderCell>
                            ) : (
                                <TableHeaderCell key={ec.fieldId} textSizeClass="text-wb-13">
                                    {ec.header}
                                </TableHeaderCell>
                            ),
                        )}
                    {isVisible(statusFieldId) &&
                        renderSortableHeader(
                            "STATUS",
                            t("payment.internal.result.col.transfer_status"),
                            sortableColumns,
                            sort,
                            onSort,
                        )}
                    {isVisible(approvalRefFieldId) &&
                        renderSortableHeader(
                            "APPROVAL_REF",
                            t("payment.internal.col.approval_ref"),
                            sortableColumns,
                            sort,
                            onSort,
                        )}
                    {isVisible(approvalTitleFieldId) &&
                        renderSortableHeader(
                            "APPROVAL_TITLE",
                            t("payment.internal.col.approval_title"),
                            sortableColumns,
                            sort,
                            onSort,
                        )}
                    <TableHeaderCell textSizeClass="text-wb-13" sortable={false}>{""}</TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filtered.map((row) => (
                    <ResultRow
                        key={row.id}
                        row={row}
                        isVisible={isVisible}
                        extraColumns={extraCols}
                        dateTimeFieldId={dateTimeFieldId}
                        fileNameFieldId={fileNameFieldId}
                        txnCountFieldId={txnCountFieldId}
                        txnUnitLabel={txnUnitLabel}
                        totalAmountFieldId={totalAmountFieldId}
                        statusFieldId={statusFieldId}
                        approvalRefFieldId={approvalRefFieldId}
                        approvalTitleFieldId={approvalTitleFieldId}
                        onActivate={() => goToDetail(row)}
                        onApprovalRefClick={setApprDialogSeqNo}
                        onDownload={onDownloadRow ? () => onDownloadRow(row) : undefined}
                        actionInFlight={Boolean(actionInFlight)}
                    />
                ))}
            </TableBody>
        </table>
        {/* Page-specific empty-state copy — rendered as a sibling of
           the <table> inside the shell's scroll container so the
           header stays visible and the message centers below. While
           the initial fetch is in flight (sticky-wrapped by the
           consumer) the slot reads `t("common.loading")` instead. */}
        {filtered.length === 0 && (loading || emptyMessage) ? (
            <TableEmptyState
                message={loading ? t("common.loading") : (emptyMessage ?? "")}
            />
        ) : null}
        </>
    );

    const paginationNode = pagination ? (
        <Pagination
            page={pagination.page + 1}
            pageCount={Math.max(
                1,
                Math.ceil(pagination.totalCount / pagination.pageSize),
            )}
            pageSize={pagination.pageSize}
            onPageChange={(p) => pagination.onPageChange(p - 1)}
            onPageSizeChange={pagination.onPageSizeChange}
            totalLabel={t("common.showing_of", {
                shown: String(Math.min(rows.length, pagination.totalCount)),
                total: String(pagination.totalCount),
            })}
            className="shrink-0"
        />
    ) : (
        <Pagination
            page={1}
            pageCount={Math.max(1, Math.ceil(filtered.length / 10))}
            pageSize={10}
            totalLabel={t("common.showing_of", {
                shown: String(Math.min(filtered.length, 10)),
                total: String(filtered.length),
            })}
            className="shrink-0"
        />
    );

    return (
        <PageLayout>
            <PageHeader title={title}>
                <ResultTitleActionGroup
                    onPrint={onPrint}
                    onListView={onListView}
                    onExcelExport={onExcelExport}
                />
            </PageHeader>

            <ResultToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                period={period}
                onPeriodChange={onPeriodChange}
                manualRange={manualRange}
                onManualRangeChange={onManualRangeChange}
            />

            {hasTotals ? (
                <DataTableShell
                    footerMode="paginationWithStickyFooter"
                    table={tableNode}
                    footer={
                        <BatchListStickyFooter
                            // Always show a count label even when the
                            // table is empty (0 rows) — the user expects
                            // the footer to read "0 document(s)" rather
                            // than disappear.
                            countLabel={t("payment.document_count", {
                                count: pagination?.totalCount ?? 0,
                            })}
                            totals={totals!.map((tot) => ({
                                currency: tot.currency,
                                amount:   tot.amount,
                            }))}
                        />
                    }
                    pagination={paginationNode}
                />
            ) : (
                <DataTableShell
                    footerMode="paginationOnly"
                    table={tableNode}
                    pagination={paginationNode}
                />
            )}

            {/* F4b — shared Approval Details popup (legacy comm_0195_001),
               opened from a row's clickable Approval Ref. Portal-rendered, so
               it overlays without navigating. Keyed by appr_seq_no; the backend
               detail endpoint resolves APPR_DV / POST_SEQ_NO server-side. */}
            {apprDialogSeqNo && (
                <CommonApprovalDetailsDialog
                    apprSeqNo={apprDialogSeqNo}
                    onClose={() => setApprDialogSeqNo(null)}
                />
            )}
        </PageLayout>
    );
}

/* ─────────────────────────── colgroup ─────────────────────────── */

type FieldVisibility = (fieldId: string) => boolean;
type FieldWidthLookup = (fieldId: string, fallback: string) => string;

function ResultColumns({
    isVisible = () => true,
    extraColumns = [],
    widthFor,
    dateTimeFieldId,
    fileNameFieldId,
    txnCountFieldId,
    totalAmountFieldId,
    statusFieldId,
    approvalRefFieldId,
    approvalTitleFieldId,
}: {
    isVisible?: FieldVisibility;
    extraColumns?: ResultExtraColumn<unknown>[];
    widthFor?: FieldWidthLookup;
    dateTimeFieldId: string;
    fileNameFieldId: string;
    txnCountFieldId: string;
    totalAmountFieldId: string;
    statusFieldId: string;
    approvalRefFieldId: string;
    approvalTitleFieldId: string;
}) {
    const w = widthFor ?? ((_: string, fallback: string) => fallback);
    const datetimeStyle      = { width: w(dateTimeFieldId,      "var(--w-wb-tr-datetime)") };
    const filenameStyle      = { width: w(fileNameFieldId,      "var(--w-wb-tr-filename)") };
    const txnCountStyle      = { width: w(txnCountFieldId,      "var(--w-wb-tr-txn-count)") };
    const totalStyle         = { width: w(totalAmountFieldId,   "var(--w-wb-tr-total)") };
    const statusStyle        = { width: w(statusFieldId,        "var(--w-wb-tr-status)") };
    const approvalRefStyle   = { width: w(approvalRefFieldId,   "var(--w-wb-tr-approval-ref)") };
    const approvalTitleStyle = { width: w(approvalTitleFieldId, "var(--w-wb-tr-approval-title)") };
    const actionStyle        = { width: w("ETC",                "var(--w-wb-tr-action)") };
    return (
        <colgroup>
            {isVisible(dateTimeFieldId)      ? <col style={datetimeStyle} /> : null}
            {isVisible(fileNameFieldId)      ? <col style={filenameStyle} /> : null}
            {isVisible(txnCountFieldId)      ? <col style={txnCountStyle} /> : null}
            {isVisible(totalAmountFieldId)   ? <col style={totalStyle} /> : null}
            {extraColumns
                .filter((ec) => isVisible(ec.fieldId))
                .map((ec) => (
                    <col key={ec.fieldId} style={ec.width ? { width: ec.width } : undefined} />
                ))}
            {isVisible(statusFieldId)        ? <col style={statusStyle} /> : null}
            {isVisible(approvalRefFieldId)   ? <col style={approvalRefStyle} /> : null}
            {isVisible(approvalTitleFieldId) ? <col style={approvalTitleStyle} /> : null}
            <col style={actionStyle} />
        </colgroup>
    );
}

/* ─────────────────────────── toolbar ─────────────────────────── */

function ResultToolbar({
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    period,
    onPeriodChange,
    manualRange,
    onManualRangeChange,
}: {
    search: string;
    onSearchChange: (v: string) => void;
    statusFilter: ResultStatusFilter;
    onStatusFilterChange: (next: ResultStatusFilter) => void;
    period?: PeriodKey;
    onPeriodChange?: (period: PeriodKey) => void;
    manualRange?: ManualDateRange;
    onManualRangeChange?: (range: ManualDateRange) => void;
}) {
    const { t } = useTranslation();
    return (
        // `relative z-20` is required so the period dropdown's absolutely-
        // positioned popover stacks above the sibling `<DataTableShell>`
        // (which would otherwise paint on top by DOM order — the sticky
        // `<thead z-10>` lives in a separate stacking context but the
        // shell's outer wrapper is rendered after the toolbar, so without
        // an explicit z-index the table's frame wins).
        <div className="relative z-20 flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
                {period !== undefined && onPeriodChange ? (
                    <PaymentDateRangeFilter
                        period={period}
                        onPeriodChange={onPeriodChange}
                        manualRange={manualRange}
                        onManualRangeChange={onManualRangeChange}
                    />
                ) : (
                    <PeriodDropdownStatic label={t("date_range_filter.last_180_days")} />
                )}
                <FilterCheckbox
                    label={t("payment.internal.result.filter.completed")}
                    checked={statusFilter.completed}
                    onChange={(next) =>
                        onStatusFilterChange({ ...statusFilter, completed: next })
                    }
                />
                <FilterCheckbox
                    label={t("payment.internal.result.filter.in_progress")}
                    checked={statusFilter.in_progress}
                    onChange={(next) =>
                        onStatusFilterChange({ ...statusFilter, in_progress: next })
                    }
                />
            </div>
            <SearchInput value={search} onChange={onSearchChange} />
        </div>
    );
}

function PeriodDropdownStatic({ label }: { label: string }) {
    return (
        <button
            type="button"
            className="flex h-[var(--h-wb-filter-btn)] items-center justify-between gap-2 rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-13 font-medium text-wb-ink hover:bg-neutral-50"
            style={{ width: "var(--w-wb-st-period)" }}
        >
            <span className="truncate">{label}</span>
            <ChevronDown
                aria-hidden
                className="size-4 shrink-0 text-wb-ntrl-6"
                strokeWidth={1.8}
            />
        </button>
    );
}

/**
 * Period filter for the Result shell — single shared chrome across the
 * whole Payment menu. Mirrors Add-on Service > Sales / Expenses
 * e-Invoices (Figma 100:13382): preset dropdown ({@code last_30_days}
 * / {@code last_90_days} / {@code last_180_days} / Enter Manually)
 * paired with the canonical calendar trigger. Manual mode swaps the
 * dropdown for the shared start ↔ end range picker chips. Adapts the
 * Payment shells' existing {@code period} + {@code manualRange} props
 * to the shared {@link DateRangeFilterValue} shape so per-page callers
 * don't change.
 */
function PaymentDateRangeFilter({
    period,
    onPeriodChange,
    manualRange,
    onManualRangeChange,
}: {
    period: PeriodKey;
    onPeriodChange: (period: PeriodKey) => void;
    manualRange?: ManualDateRange;
    onManualRangeChange?: (range: ManualDateRange) => void;
}) {
    const value = periodToDateRangeFilterValue(period, manualRange);
    return (
        <DateRangeFilter
            value={value}
            onChange={(next) => {
                if (next.mode === "manual") {
                    // When the user picks "Enter Manually" from the
                    // preset dropdown, `next.start` / `next.end` are
                    // empty (the preset adapter doesn't carry wire
                    // dates). Seed `manualRange` from the active preset
                    // window so the chips open with meaningful values
                    // and the API receives a real range.
                    const seed =
                        next.start && next.end
                            ? { fromDate: fromIso(next.start), toDate: fromIso(next.end) }
                            : computePresetRangeYyyymmdd(period);
                    onManualRangeChange?.(seed);
                    if (period !== "manual") onPeriodChange("manual");
                    return;
                }
                const nextPeriod = presetToPeriodKey(next.preset);
                if (nextPeriod !== period) onPeriodChange(nextPeriod);
            }}
            presetClassName="w-[var(--w-wb-st-period)]"
        />
    );
}

function periodToDateRangeFilterValue(
    period: PeriodKey,
    manualRange: ManualDateRange | undefined,
): DateRangeFilterValue {
    if (period === "manual") {
        // Inconsistent-state guard — if `period === "manual"` but no
        // `manualRange` is committed yet, fall back to the Last 30 Days
        // window so the chips never render empty.
        const range = manualRange ?? computePresetRangeYyyymmdd("30d");
        return {
            mode:   "manual",
            preset: "last_30_days",
            start:  toIso(range.fromDate),
            end:    toIso(range.toDate),
        };
    }
    return {
        mode:   "preset",
        preset: periodKeyToPreset(period),
        start:  "",
        end:    "",
    };
}

/** Resolve the `yyyymmdd` window for the active preset, anchored to
 *  today. Used to seed `manualRange` the first time the user picks
 *  "Enter Manually" so the chips never open empty. */
function computePresetRangeYyyymmdd(period: PeriodKey): ManualDateRange {
    const days =
        period === "180d" ? 180
            : period === "90d"  ? 90
            : period === "7d"   ? 7
            : 30;
    const fmt = (d: Date): string =>
        d.getFullYear().toString().padStart(4, "0") +
        (d.getMonth() + 1).toString().padStart(2, "0") +
        d.getDate().toString().padStart(2, "0");
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    return { fromDate: fmt(start), toDate: fmt(today) };
}

function periodKeyToPreset(period: Exclude<PeriodKey, "manual">): DateRangeFilterPreset {
    switch (period) {
        case "180d": return "last_180_days";
        case "90d":  return "last_90_days";
        case "7d":
        case "30d":
        default:     return "last_30_days";
    }
}

function presetToPeriodKey(preset: DateRangeFilterPreset): PeriodKey {
    switch (preset) {
        case "last_180_days": return "180d";
        case "last_90_days":  return "90d";
        case "last_30_days":
        default:              return "30d";
    }
}

function toIso(raw: string): string {
    if (!raw || raw.length !== 8) return "";
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}
function fromIso(iso: string): string {
    if (!iso || iso.length !== 10) return "";
    return iso.replace(/-/g, "");
}

function FilterCheckbox({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-2 text-wb-13 font-medium text-wb-ink">
            <Checkbox
                checked={checked}
                onCheckedChange={(v) => onChange(v === true)}
                aria-label={label}
            />
            {label}
        </label>
    );
}

/* ─────────────────────────── title-row action group ─────────────────────────── */

function ResultTitleActionGroup({
    onPrint,
    onListView,
    onExcelExport,
}: {
    onPrint?: () => void;
    onListView?: (anchorRect: DOMRect) => void;
    onExcelExport?: () => void;
}) {
    return (
        <PageActionButtons
            showList
            showPrint
            showExcel
            onList={onListView}
            onPrint={onPrint}
            onExport={onExcelExport}
        />
    );
}

/* ─────────────────────────── sortable header helpers ─────────────────────────── */

function renderSortableHeader(
    columnKey: keyof ResultBatchSortable,
    label: React.ReactNode,
    sortableColumns: ResultBatchSortable | undefined,
    sort: { field: string | null; direction: ListSortDirection } | undefined,
    onSort: ((fieldId: string) => void) | undefined,
    align?: "left" | "right",
) {
    const fieldId = sortableColumns?.[columnKey];
    if (fieldId && sort && onSort) {
        return (
            <TableHeaderCell
                textSizeClass="text-wb-13"
                align={align}
                sortFieldId={fieldId}
                activeSortField={sort.field}
                activeSortDirection={sort.direction}
                onSort={onSort}
            >
                {label}
            </TableHeaderCell>
        );
    }
    return <TableHeaderCell textSizeClass="text-wb-13" align={align}>{label}</TableHeaderCell>;
}

/* ─────────────────────────── row ─────────────────────────── */

function ResultRow<Row extends PaymentResultBatchRow>({
    row,
    isVisible,
    extraColumns = [],
    dateTimeFieldId,
    fileNameFieldId,
    txnCountFieldId,
    txnUnitLabel = "Trx",
    totalAmountFieldId,
    statusFieldId,
    approvalRefFieldId,
    approvalTitleFieldId,
    onActivate,
    onApprovalRefClick,
    onDownload,
    actionInFlight,
}: {
    row: Row;
    isVisible: FieldVisibility;
    extraColumns?: ResultExtraColumn<Row>[];
    dateTimeFieldId: string;
    fileNameFieldId: string;
    txnCountFieldId: string;
    txnUnitLabel?: string;
    totalAmountFieldId: string;
    statusFieldId: string;
    approvalRefFieldId: string;
    approvalTitleFieldId: string;
    onActivate: () => void;
    /** F4b — opens the shared Approval Details popup for this row's
     *  `approvalRefId` (legacy comm_0195_001). Absent → cell stays plain text. */
    onApprovalRefClick?: (apprSeqNo: string) => void;
    onDownload?: () => void;
    /** Sticky-wrapped global mutation flag — disables per-row Download
     *  glyph while a refresh / mutation is in flight. */
    actionInFlight?: boolean;
}) {
    const { t } = useTranslation();
    const [date, time] = row.dateTime.split("\n");

    return (
        <TableRow
            role="link"
            tabIndex={0}
            onClick={onActivate}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onActivate();
                }
            }}
            className={cn(
                "h-[var(--h-wb-table-row)] cursor-pointer border-b border-wb-table-border last:border-b-0 hover:bg-wb-bg-active",
            )}
        >
            {isVisible(dateTimeFieldId) && (
                <TableCell className="px-2.5 py-2.5">
                    <span className="block text-wb-13 font-medium text-wb-ink">{date}</span>
                    {time ? (
                        <span className="mt-0.5 block text-wb-12 font-normal text-wb-ntrl-6">
                            {time}
                        </span>
                    ) : null}
                </TableCell>
            )}
            {isVisible(fileNameFieldId) && (
                <TableCell className="px-2.5 py-2.5">
                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                        {row.fileName}
                    </span>
                </TableCell>
            )}
            {isVisible(txnCountFieldId) && (
                <TableCell className="px-2.5 py-2.5">
                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                        {row.txnCount} {txnUnitLabel} ({row.txnCurrency})
                    </span>
                </TableCell>
            )}
            {isVisible(totalAmountFieldId) && (
                <TableCell className="px-2.5 py-2.5 text-right">
                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                        {formatAmount(row.totalAmount, row.txnCurrency, false)}
                    </span>
                </TableCell>
            )}
            {extraColumns
                .filter((ec) => isVisible(ec.fieldId))
                .map((ec) => (
                    <TableCell key={ec.fieldId} className="px-2.5 py-2.5">
                        <span className="block truncate text-wb-13 font-medium text-wb-ink">
                            {ec.renderCell(row)}
                        </span>
                    </TableCell>
                ))}
            {isVisible(statusFieldId) && (
                <TableCell className="px-2.5 py-2.5">
                    <ResultStatusCell row={row} />
                </TableCell>
            )}
            {isVisible(approvalRefFieldId) && (
                <TableCell className="px-2.5 py-2.5">
                    {row.approvalRefId && onApprovalRefClick ? (
                        // F4b — clickable Approval Ref → shared Approval Details
                        // popup (legacy comm_0195_001). stopPropagation so the
                        // row-click navigation to the detail page doesn't also fire.
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onApprovalRefClick(row.approvalRefId!);
                            }}
                            className="block max-w-full cursor-pointer truncate text-left text-wb-13 font-medium text-brand hover:underline"
                        >
                            {row.approvalRef}
                        </button>
                    ) : (
                        <span className="block truncate text-wb-13 font-medium text-wb-ink">
                            {row.approvalRef}
                        </span>
                    )}
                </TableCell>
            )}
            {isVisible(approvalTitleFieldId) && (
                <TableCell className="px-2.5 py-2.5">
                    <span className="block text-wb-13 font-medium leading-snug text-wb-ink">
                        {row.approvalTitle}
                    </span>
                </TableCell>
            )}
            <TableCell className="px-2.5 py-2.5">
                <button
                    type="button"
                    aria-label={t("payment.internal.result.aria.download_file")}
                    disabled={!onDownload || Boolean(actionInFlight)}
                    onClick={(e) => {
                        // Stop row-click navigation when the user
                        // hits the per-row download glyph.
                        e.stopPropagation();
                        onDownload?.();
                    }}
                    className={`flex size-6 items-center justify-center rounded-md text-wb-ntrl-6 ${
                        onDownload && !actionInFlight
                            ? "cursor-pointer hover:bg-black/5"
                            : "cursor-not-allowed opacity-40"
                    }`}
                >
                    <DownloadIcon />
                </button>
            </TableCell>
        </TableRow>
    );
}

function ResultStatusCell({ row }: { row: PaymentResultBatchRow }) {
    const { t } = useTranslation();
    if (row.status === "in_progress") {
        return (
            <span className="text-wb-13 font-semibold text-wb-status-progress-text">
                {t("payment.internal.result.status.in_progress")}
            </span>
        );
    }
    return (
        <div className="flex items-center gap-2">
            <span className="text-wb-13 font-semibold text-wb-status-approved-text">
                {t("payment.internal.result.status.completed")}
            </span>
            {row.successCount != null && (
                <CountPill kind="success" count={row.successCount} />
            )}
            {row.failedCount != null && (
                <CountPill kind="failed" count={row.failedCount} />
            )}
        </div>
    );
}

function CountPill({
    kind,
    count,
}: {
    kind: "success" | "failed";
    count: number;
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 text-wb-13 font-semibold",
                kind === "success"
                    ? "text-wb-status-approved-text"
                    : "text-wb-status-rejected-text",
            )}
        >
            {count}
            {kind === "success" ? (
                <span
                    aria-hidden
                    className="inline-flex size-3.5 items-center justify-center rounded-full bg-wb-status-approved-text text-white"
                >
                    <CheckGlyph />
                </span>
            ) : (
                <span
                    aria-hidden
                    className="inline-flex size-3.5 items-center justify-center rounded-full bg-wb-status-rejected-text text-white text-wb-10 font-bold leading-none"
                >
                    !
                </span>
            )}
        </span>
    );
}

function CheckGlyph() {
    return (
        <svg
            viewBox="0 0 12 12"
            className="size-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M2.5 6.5L5 9l4.5-5" />
        </svg>
    );
}
