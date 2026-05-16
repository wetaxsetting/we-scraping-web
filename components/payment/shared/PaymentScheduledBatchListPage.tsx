"use client";

import { Check, ChevronDown, FileText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import StatusBadge from "@/components/payment/approval-box/StatusBadge";
import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import CalendarIconButton from "@/components/shared/CalendarIconButton";
import DataTableFooter from "@/components/shared/DataTableFooter";
import DateField from "@/components/shared/DateField";
import DateRangePopover from "@/components/shared/DateRangePopover";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import type { ViewSettingItem } from "@/components/shared/view-setting";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Common batch-file Scheduled row contract — every Payment module's
 * Scheduled list row satisfies this shape. Internal Transfer is the
 * canonical Figma reference (1:9972); Vendor (24:1398), Expense (25:7584),
 * Payroll (27:11294), and Overseas (29:14947) all show the same shape.
 *
 * Modules are free to extend this with module-specific fields (e.g.
 * Overseas's `scheduleDate`) — those are surfaced through the optional
 * `extraColumn` slot and never shoehorned into the canonical column list.
 */
export type ScheduledBatchAction = "transfer" | "document" | "complete";
export type ScheduledBatchRowHighlight = "selected" | "warning";

export interface PaymentScheduledBatchRow {
    id: string;
    /** Two-line date + time, e.g. `"05-07-2025\n11:39:50"`. */
    dateTime: string;
    fileName: string;
    txnCount: number;
    txnCurrency: string;
    totalAmount: string;
    status?: ApprovalStatus;
    statusStep?: string;
    requestor: string;
    approver: string;
    approverCount?: number;
    approvalRef: string;
    approvalTitle: string;
    action?: ScheduledBatchAction;
    rowHighlight?: ScheduledBatchRowHighlight;
    /**
     * Legacy `pymn_0009_001.createActionCell` gates Delete on
     * `!APPR_SEQ_NO && PRDT_TYPE !== 'H' && canDo('D')`. The page does
     * that derivation server-side and stamps this flag so the shared
     * shell can render the red Delete pill without reaching into the
     * legacy fields.
     */
    canDelete?: boolean;
    /**
     * Legacy `pymn_0009_001.createActionCell` always renders the
     * download arrow when `FILE_URL` is set. Pages set this flag when
     * a file is attached (uploaded Excel exists for the batch).
     */
    canDownloadFile?: boolean;
    /**
     * Disabled Transfer button — legacy `pymn_0009_001.ts:248-251`
     * disables when `currentDate < PAY_DATE` (scheduled in the future).
     */
    transferDisabled?: boolean;
}

/**
 * Optional module-specific column inserted between Total Transfer Amount and
 * Approval Status. Currently only used by Overseas Payment for its Schedule
 * Date column (Figma 29:14947). Header label rendering matches the canonical
 * columns; body rendering is the caller's responsibility.
 */
export interface ScheduledBatchExtraColumn<Row> {
    key: string;
    label: React.ReactNode;
    /** CSS width for the `<col>` (e.g. `"140px"`, `"var(--w-wb-st-schedule-date)"`). */
    width: string;
    align?: "left" | "right" | "center";
    render: (row: Row) => React.ReactNode;
}

type FooterTotal = { currency: string; amount: string };

/**
 * Period dropdown options. The translated label comes from
 * `payment.internal.filter.period.<key>` so each Payment module reuses
 * the same i18n surface.
 *
 * <p>"manual" pairs with a {@link ManualDateRange} prop on the shell —
 * pages render their own date inputs (or reuse {@code <DateField>}) and
 * supply the chosen window verbatim; the shared shell does NOT resolve
 * it to a days-back count.
 */
export type PeriodKey = "30d" | "90d" | "180d" | "manual";

/** Manual from/to window in yyyyMMdd format (no separators), supplied
 *  by the page when {@link PeriodKey} === "manual". */
export type ManualDateRange = { fromDate: string; toDate: string };

/**
 * Sort direction reaching the shared shell — same shape the page's
 * `useTableSort` hook emits.
 */
export type ListSortDirection = "ASC" | "DESC" | null;

/**
 * Per-column sort mapping: maps the visible column key to the
 * backend FIELD_ID from the page's whitelist enum. Pages omit
 * columns that aren't in the whitelist so their headers stay
 * non-clickable. Column keys are stable identifiers used inside the
 * shared shell ({@code DATE_TIME}, {@code FILE_NAME}, etc.).
 */
export type ScheduledBatchSortable = Partial<
    Record<
        | "DATE_TIME"
        | "FILE_NAME"
        | "TXN_COUNT"
        | "TOTAL_AMOUNT"
        | "STATUS"
        | "REQUESTOR"
        | "APPROVER"
        | "APPROVAL_REF"
        | "APPROVAL_TITLE",
        string
    >
>;

export interface PaymentScheduledBatchListPageProps<Row extends PaymentScheduledBatchRow> {
    /** Already-translated page title (`t("payment.<module>.scheduled_title")`). */
    title: string;
    rows: Row[];
    /** Builds the row's detail-page route. */
    rowDetailHref: (row: Row) => string;
    /** Optional row-click interceptor. */
    onRowActivate?: (row: Row) => boolean | undefined;
    /** Optional cell-scoped click handler for the Approval Ref column. */
    onApprovalRefClick?: (row: Row) => void;
    /** Min-width of the table — bumped by callers that add `extraColumn`. */
    tableMinWidth?: string;
    /** Optional extra column inserted between Total Transfer Amount and Approval Status. */
    extraColumn?: ScheduledBatchExtraColumn<Row>;
    /** Per-currency total amounts rendered in the sibling footer. */
    totals: FooterTotal[];
    /** Pre-translated label for the count cell. */
    countLabel?: string;
    /** Searchable string fields — defaults to fileName/requestor/approver/approvalRef/approvalTitle. */
    searchableFields?: (keyof Row & string)[];

    /* — Shared filtering + search state (opt-in) ———————————————————— */
    /** Controlled search value. If provided, disables internal filtering. */
    search?: string;
    /** Controlled search change handler. */
    onSearchChange?: (keyword: string) => void;
    /** Controlled page index (1-based). */
    page?: number;
    /** Controlled total pages. */
    pageCount?: number;
    /** Controlled page size. */
    pageSize?: number;
    /** Controlled page change handler. */
    onPageChange?: (page: number) => void;
    /** Controlled page size change handler. */
    onPageSizeChange?: (size: number) => void;

    /** Custom filter components to replace the hardcoded date/status placeholders. */
    toolbarFilters?: React.ReactNode;
    /** Click handler for Excel Upload chip in the title-row action group. */
    onExcelUpload?: () => void;
    /** Click handler for the blue "Request Approval" CTA in the toolbar. */
    onRequestApproval?: (selectedRows: Row[]) => void;

    /* — Server-driven pagination (opt-in) —————————————————————————— */
    pagination?: {
        page: number;
        pageSize: number;
        totalCount: number;
        onPageChange: (page: number) => void;
        onPageSizeChange: (size: number) => void;
    };

    /* — Server-driven sort (opt-in) ——————————————————————————————— */
    sort?: { field: string | null; direction: ListSortDirection };
    sortableColumns?: ScheduledBatchSortable;
    onSort?: (fieldId: string) => void;

    /* — Period dropdown (opt-in) ——————————————————————————————————
     *
     * When the user picks "Enter Manually" the dropdown emits the
     * chosen window via {@link onManualRangeChange}; the page stores
     * the {@code (fromDate, toDate)} pair and feeds it back via
     * {@link manualRange} so the trigger reads consistently across
     * re-renders. Pages that don't wire {@link onManualRangeChange}
     * have the "Enter Manually" option hidden — the dropdown falls
     * back to the three preset choices.
     */
    period?: PeriodKey;
    onPeriodChange?: (period: PeriodKey) => void;
    manualRange?: ManualDateRange;
    onManualRangeChange?: (range: ManualDateRange) => void;

    /* — Approval-status dropdown (opt-in) —————————————————————————— */
    apprType?: string;
    apprTypeOptions?: ReadonlyArray<{ value: string; labelKey: string }>;
    onApprTypeChange?: (apprType: string) => void;

    /* — Toolbar icons (opt-in) —————————————————————————————————— */
    onPrint?: () => void;
    onListView?: (anchorRect: DOMRect) => void;

    /* — Row-action callbacks (opt-in) —————————————————————————————— */
    onTransferRow?: (row: Row) => void;
    onDeleteRow?:   (row: Row) => void;
    onDownloadRow?: (row: Row) => void;

    /* — Column visibility from View Setting (opt-in) ————————————————
     *
     * When provided, each seeded data column on the shell maps to a
     * View Setting `FIELD_ID` and renders only when its `USE_YN === "Y"`.
     * CHECKBOX, APPROVER, APPROVAL_TITLE, and ACTION columns stay
     * always-rendered (CHECKBOX is a special special FIELD_ID; the
     * other three have no V85 seed entry — they ride through the
     * legacy shell unchanged until the seed catches up).
     *
     * Pages that don't pass this prop fall back to the legacy
     * always-render behaviour — preserves backwards-compat for the
     * other Payment modules that don't yet wire View Setting.
     */
    viewSettingItems?: ViewSettingItem[];
}

const DEFAULT_TABLE_MIN_WIDTH = "var(--w-wb-st-table-min)";
const DEFAULT_SEARCHABLE: (keyof PaymentScheduledBatchRow & string)[] = [
    "fileName",
    "requestor",
    "approver",
    "approvalRef",
    "approvalTitle",
];

/**
 * Shared batch-file Scheduled Payment list page. Every Payment module
 * (Internal Transfer, Vendor, Expense, Payroll, Overseas) routes through
 * this template — see CLAUDE.md §12a "Payment Module Pagination Rule".
 *
 * Visual contract is identical across modules — Figma 1:9972 / 24:1398 /
 * 25:7584 / 27:11294 / 29:14947 all show the same toolbar (Request Approval
 * CTA + period dropdown + shared CalendarIconButton + status dropdown +
 * SearchInput), the same 11-column table (12 with Overseas's Schedule Date
 * extra), the same `paginationWithTotals` footer aligned under Total
 * Transfer Amount, and the same shared Pagination.
 *
 * Module-specific variation (page title, row shape, total amounts, detail
 * route, Schedule Date column) is supplied via props; chrome stays
 * byte-identical so the system reads as one product.
 */
export default function PaymentScheduledBatchListPage<Row extends PaymentScheduledBatchRow>({
    title,
    rows,
    rowDetailHref,
    onRowActivate,
    onApprovalRefClick,
    tableMinWidth = DEFAULT_TABLE_MIN_WIDTH,
    extraColumn,
    totals,
    countLabel,
    searchableFields,
    search: controlledSearch,
    onSearchChange: controlledSearchChange,
    page: controlledPage,
    pageCount: controlledPageCount,
    pageSize: controlledPageSize,
    onPageChange: controlledPageChange,
    onPageSizeChange: controlledPageSizeChange,
    toolbarFilters,
    onExcelUpload,
    onRequestApproval,
    pagination,
    sort,
    sortableColumns,
    onSort,
    period,
    onPeriodChange,
    manualRange,
    onManualRangeChange,
    apprType,
    apprTypeOptions,
    onApprTypeChange,
    onPrint,
    onListView,
    onTransferRow,
    onDeleteRow,
    onDownloadRow,
    viewSettingItems,
}: PaymentScheduledBatchListPageProps<Row>) {
    // FIELD_ID → USE_YN visibility map. When the page doesn't pass
    // `viewSettingItems` the map is empty and `isVisible(...)` returns
    // true for every column — preserves the legacy always-render
    // behaviour for modules that haven't wired View Setting yet.
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
        return visibilityMap.get(fieldId) ?? true;
    };
    const { t } = useTranslation();
    const router = useRouter();



    // When `onSearchChange` is supplied the page owns the search state
    // (server-driven flows debounce-forward to the API). Otherwise the
    // shell keeps its legacy local-state behaviour so mock-data pages
    // continue to client-side filter.
    const isSearchControlled = controlledSearchChange !== undefined;
    const [internalSearch, setInternalSearch] = useState("");
    const search = isSearchControlled ? (controlledSearch ?? "") : internalSearch;
    const setSearch = isSearchControlled
        ? (next: string) => controlledSearchChange(next)
        : setInternalSearch;
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // When the page drives pagination/sort server-side, `rows` is the
    // already-resolved current page — DO NOT client-side filter (the
    // search box is intentionally inert when server-side wiring is on;
    // a follow-up MR forwards the keyword to the API). Pages that
    // still ship the static mock keep the original client-side
    // search-filter behaviour.
    const serverDriven = Boolean(pagination);
    const filtered = useMemo(() => {
        if (serverDriven) return rows;
        if (!search.trim()) return rows;
        const q = search.trim().toLowerCase();
        const fields = (searchableFields ?? DEFAULT_SEARCHABLE) as (keyof Row & string)[];
        return rows.filter((r) =>
            fields
                .map((f) => {
                    const v = r[f];
                    return typeof v === "string" ? v : "";
                })
                .join(" ")
                .toLowerCase()
                .includes(q),
        );
    }, [rows, search, searchableFields, serverDriven]);

    // Header checkbox + select-all only operate on rows that can
    // still be selected — already-submitted rows (`approvalRef` set)
    // are ineligible because Request Approval can't act on them.
    // Mirrors the disabled per-row checkbox state below.
    const selectableRows = filtered.filter((r) => !r.approvalRef);
    const allChecked =
        selectableRows.length > 0 &&
        selectableRows.every((r) => selected.has(r.id));
    const toggleRow = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const toggleAll = () =>
        setSelected(
            allChecked ? new Set() : new Set(selectableRows.map((r) => r.id)),
        );

    const goToDetail = (row: Row) => {
        if (onRowActivate?.(row)) return;
        router.push(rowDetailHref(row));
    };

    return (
        <PageLayout>
            <PageHeader title={title}>
                <ScheduledTitleActionGroup
                    onExcelUpload={onExcelUpload}
                    onPrint={onPrint}
                    onListView={onListView}
                />
            </PageHeader>

            <ScheduledToolbar
                search={search}
                onSearchChange={setSearch}
                toolbarFilters={toolbarFilters}
                period={period}
                onPeriodChange={onPeriodChange}
                manualRange={manualRange}
                onManualRangeChange={onManualRangeChange}
                apprType={apprType}
                apprTypeOptions={apprTypeOptions}
                onApprTypeChange={onApprTypeChange}
                onRequestApproval={
                    onRequestApproval
                        ? () => {
                              // Hand the page the rows the user
                              // checked. `filtered` is the current
                              // visible window (after server filter +
                              // search) so the selection ids resolve
                              // to actual row objects on this page.
                              const chosen = filtered.filter((r) => selected.has(r.id));
                              onRequestApproval(chosen);
                          }
                        : undefined
                }
            />

            <DataTableShell
                footerMode="paginationWithTotals"
                table={
                    <table
                        className="w-full table-fixed border-collapse"
                        style={{ minWidth: tableMinWidth }}
                    >
                        <ScheduledColumns extraColumn={extraColumn} isVisible={isVisible} />
                        <TableHeader className="sticky top-0 z-10">
                            <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                                <TableHeaderCell sortable={false}>
                                    <Checkbox
                                        checked={allChecked}
                                        onCheckedChange={toggleAll}
                                        aria-label={t("payment.aria.select_all")}
                                    />
                                </TableHeaderCell>
                                {isVisible("REG_DTM") &&
                                    renderSortableHeader(
                                        "DATE_TIME",
                                        t("payment.internal.col.date_time"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {isVisible("TITL") &&
                                    renderSortableHeader(
                                        "FILE_NAME",
                                        t("payment.internal.col.file_name"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {isVisible("TOT_TRNS_CNT") &&
                                    renderSortableHeader(
                                        "TXN_COUNT",
                                        t("payment.internal.col.txn_count"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {isVisible("TOTAL_TRAN_AMT") &&
                                    renderSortableHeader(
                                        "TOTAL_AMOUNT",
                                        t("payment.internal.col.total_transfer"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {extraColumn ? (
                                    <TableHeaderCell
                                        align={extraColumn.align === "right" ? "right" : "left"}
                                    >
                                        {extraColumn.label}
                                    </TableHeaderCell>
                                ) : null}
                                {isVisible("APPR_STTS") &&
                                    renderSortableHeader(
                                        "STATUS",
                                        t("approval.col.status"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {isVisible("REG_ID") &&
                                    renderSortableHeader(
                                        "REQUESTOR",
                                        t("payment.col.requestor"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {renderSortableHeader(
                                    "APPROVER",
                                    t("payment.col.approver"),
                                    sortableColumns,
                                    sort,
                                    onSort,
                                )}
                                {isVisible("APPR_SEQ_NO") &&
                                    renderSortableHeader(
                                        "APPROVAL_REF",
                                        t("payment.internal.col.approval_ref"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {renderSortableHeader(
                                    "APPROVAL_TITLE",
                                    t("payment.internal.col.approval_title"),
                                    sortableColumns,
                                    sort,
                                    onSort,
                                )}
                                <TableHeaderCell sortable={false}>{""}</TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((row) => (
                                <ScheduledRow
                                    key={row.id}
                                    row={row}
                                    extraColumn={extraColumn}
                                    isVisible={isVisible}
                                    selected={selected.has(row.id)}
                                    onToggle={() => toggleRow(row.id)}
                                    onActivate={() => goToDetail(row)}
                                    onApprovalRefClick={
                                        onApprovalRefClick
                                            ? () => onApprovalRefClick(row)
                                            : undefined
                                    }
                                    onTransfer={onTransferRow ? () => onTransferRow(row) : undefined}
                                    onDelete={onDeleteRow ? () => onDeleteRow(row) : undefined}
                                    onDownload={onDownloadRow ? () => onDownloadRow(row) : undefined}
                                />
                            ))}
                        </TableBody>
                    </table>
                }
                footer={
                    <DataTableFooter
                        colgroup={
                            <ScheduledColumns
                                extraColumn={extraColumn}
                                isVisible={isVisible}
                            />
                        }
                        minWidth={tableMinWidth}
                        className="mt-auto"
                    >
                        {totals.length === 0 ? (
                            <tr>
                                <td colSpan={extraColumn ? 12 : 11} className="px-2.5 py-3">
                                    {countLabel ? (
                                        <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                                            {countLabel}
                                        </span>
                                    ) : null}
                                </td>
                            </tr>
                        ) : (
                            totals.map((total) => (
                                <ScheduledFooterRow
                                    key={total.currency}
                                    total={total}
                                    extraColumn={extraColumn}
                                />
                            ))
                        )}
                    </DataTableFooter>
                }
                pagination={
                    pagination ? (
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
                                shown: String(
                                    Math.min(
                                        rows.length,
                                        pagination.totalCount,
                                    ),
                                ),
                                total: String(pagination.totalCount),
                            })}
                            className="shrink-0"
                        />
                    ) : (
                        <Pagination
                            page={controlledPage ?? 1}
                            pageCount={controlledPageCount ?? Math.max(1, Math.ceil(filtered.length / (controlledPageSize ?? 10)))}
                            pageSize={controlledPageSize ?? 10}
                            totalLabel={t("common.showing_of", {
                                shown: String(Math.min(filtered.length, controlledPageSize ?? 10)),
                                total: String(filtered.length),
                            })}
                        onPageChange={controlledPageChange}
                        onPageSizeChange={controlledPageSizeChange}
                            className="shrink-0"
                        />
                    )
                }
            />
        </PageLayout>
    );
}

/* ─────────────────────────── colgroup ─────────────────────────── */

/**
 * Per-column visibility predicate — keyed by the legacy V85 `FIELD_ID`
 * for each seeded data column. Always-on columns (CHECKBOX / APPROVER /
 * APPROVAL_TITLE / ACTION) ignore this hook and render unconditionally.
 */
type FieldVisibility = (fieldId: string) => boolean;

function ScheduledColumns<Row extends PaymentScheduledBatchRow>({
    extraColumn,
    isVisible = () => true,
}: {
    extraColumn?: ScheduledBatchExtraColumn<Row>;
    isVisible?: FieldVisibility;
}) {
    return (
        <colgroup>
            <col className="w-[var(--w-wb-st-checkbox)]" />
            {isVisible("REG_DTM") ? <col className="w-[var(--w-wb-st-datetime)]" /> : null}
            {isVisible("TITL") ? <col className="w-[var(--w-wb-st-filename)]" /> : null}
            {isVisible("TOT_TRNS_CNT") ? <col className="w-[var(--w-wb-st-txn-count)]" /> : null}
            {isVisible("TOTAL_TRAN_AMT") ? <col className="w-[var(--w-wb-st-total)]" /> : null}
            {extraColumn ? <col style={{ width: extraColumn.width }} /> : null}
            {isVisible("APPR_STTS") ? <col className="w-[var(--w-wb-st-status)]" /> : null}
            {isVisible("REG_ID") ? <col className="w-[var(--w-wb-st-requestor)]" /> : null}
            <col className="w-[var(--w-wb-st-approver)]" />
            {isVisible("APPR_SEQ_NO") ? <col className="w-[var(--w-wb-st-approval-ref)]" /> : null}
            <col className="w-[var(--w-wb-st-approval-title)]" />
            <col className="w-[var(--w-wb-st-action)]" />
        </colgroup>
    );
}

/* ─────────────────────────── footer row ─────────────────────────── */

function ScheduledFooterRow<Row extends PaymentScheduledBatchRow>({
    total,
    extraColumn,
}: {
    total: FooterTotal;
    extraColumn?: ScheduledBatchExtraColumn<Row>;
}) {
    const { t } = useTranslation();
    // The "Total ({currency})" label sits under columns 2-4 (Date/Time +
    // File Name + No. of Transactions), and the amount sits under Total
    // Transfer Amount (col 5). Trailing columns get one spanning empty cell.
    const trailingColspan = extraColumn ? 7 : 6;
    return (
        <tr>
            <td />
            <td colSpan={3} className="px-2.5 py-3">
                <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                    {t("payment.internal.footer_total", { currency: total.currency })}
                </span>
            </td>
            <td className="px-2.5 py-3">
                <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-ink">
                    {total.amount}
                </span>
            </td>
            <td colSpan={trailingColspan} />
        </tr>
    );
}

/* ─────────────────────────── toolbar ─────────────────────────── */

function ScheduledToolbar({
    search,
    onSearchChange,
    toolbarFilters,
    onRequestApproval,
    period,
    onPeriodChange,
    manualRange,
    onManualRangeChange,
    apprType,
    apprTypeOptions,
    onApprTypeChange,
}: {
    search: string;
    onSearchChange: (v: string) => void;
    toolbarFilters?: React.ReactNode;
    onRequestApproval?: () => void;
    period?: PeriodKey;
    onPeriodChange?: (period: PeriodKey) => void;
    manualRange?: ManualDateRange;
    onManualRangeChange?: (range: ManualDateRange) => void;
    apprType?: string;
    apprTypeOptions?: ReadonlyArray<{ value: string; labelKey: string }>;
    onApprTypeChange?: (apprType: string) => void;
}) {
    const { t } = useTranslation();
    return (
        // `relative z-20` keeps the period + status dropdowns' absolutely-
        // positioned popovers above the sibling `<DataTableShell>` table
        // frame (DOM-order siblings without z-index let the later sibling
        // win — without this the popover items get hidden under the
        // sticky `<thead>`).
        <div className="relative z-20 flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    size="sm"
                    className="h-[var(--h-wb-filter-btn)] px-3"
                    onClick={onRequestApproval}
                    disabled={!onRequestApproval}
                >
                    {t("payment.internal.request_approval")}
                </Button>
                {toolbarFilters ? (
                    toolbarFilters
                ) : (
                    <>
                        {period !== undefined && onPeriodChange ? (
                            <PeriodFilterDropdown
                                period={period}
                                onPeriodChange={onPeriodChange}
                                manualRange={manualRange}
                                onManualRangeChange={onManualRangeChange}
                            />
                        ) : (
                            <FilterDropdown
                                label={t("payment.internal.filter.last_30_days")}
                                width="var(--w-wb-st-period)"
                            />
                        )}
                        <CalendarRangeAffordance
                            period={period}
                            manualRange={manualRange}
                            onPeriodChange={onPeriodChange}
                            onManualRangeChange={onManualRangeChange}
                        />
                        {apprTypeOptions && onApprTypeChange ? (
                            <StatusFilterDropdown
                                value={apprType ?? ""}
                                options={apprTypeOptions}
                                onChange={onApprTypeChange}
                            />
                        ) : (
                            <FilterDropdown
                                label={t("payment.internal.filter.all_status")}
                                width="var(--w-wb-st-status-filter)"
                            />
                        )}
                    </>
                )}
            </div>
            <SearchInput value={search} onChange={onSearchChange} />
        </div>
    );
}


/**
 * Interactive Approval-Status filter — replaces the inert
 * `<FilterDropdown>` chip when the page passes `options` + `onChange`.
 * The first option's `value` should be `""` (treated as "All"). Labels
 * are i18n keys resolved at render time so each Payment module can
 * reuse the same component without forcing its own translated strings
 * through the props.
 */
function StatusFilterDropdown({
    value,
    options,
    onChange,
}: {
    value: string;
    options: ReadonlyArray<{ value: string; labelKey: string }>;
    onChange: (next: string) => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        function onDocMouseDown(e: MouseEvent) {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", onDocMouseDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const current = options.find((o) => o.value === value) ?? options[0];

    return (
        <div
            ref={rootRef}
            className="relative"
            style={{ width: "var(--w-wb-st-status-filter)" }}
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex h-[var(--h-wb-filter-btn)] w-full cursor-pointer items-center justify-between gap-2 overflow-clip rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-13 font-medium text-wb-ink hover:bg-neutral-50"
            >
                <span className="flex-1 truncate text-left">
                    {t(current.labelKey)}
                </span>
                <ChevronDown
                    aria-hidden
                    className={cn(
                        "size-4 shrink-0 text-wb-ntrl-6 transition-transform",
                        open && "rotate-180",
                    )}
                    strokeWidth={1.8}
                />
            </button>
            {open && (
                <ul
                    role="listbox"
                    className="absolute left-0 right-0 top-[calc(var(--h-wb-filter-btn)+4px)] z-10 rounded-md border border-wb-ntrl-4 bg-white py-1 shadow-wb-card"
                >
                    {options.map((opt) => {
                        const isSelected = opt.value === value;
                        return (
                            <li key={opt.value || "__all__"}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "block w-full truncate px-2.5 py-2 text-left text-wb-13 font-medium",
                                        isSelected
                                            ? "bg-brand-soft text-brand"
                                            : "text-wb-ink hover:bg-wb-bg-sidebar",
                                    )}
                                >
                                    {t(opt.labelKey)}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/**
 * Interactive period filter — replaces the static `<FilterDropdown>`
 * trigger when the page passes `period` + `onPeriodChange`. Four
 * canonical options: Last 30 / 90 / 180 Days + Enter Manually.
 * Mirrors legacy `pymn_*` period filter (period dropdown +
 * date-input popover on "Enter Manually").
 *
 * <p>When the user selects "Enter Manually" the dropdown switches to a
 * label like "15-05-2026 ~ 15-05-2026" and emits the chosen range via
 * {@code onManualRangeChange}. Cancel reverts {@code period} to its
 * previous value so the parent can re-fetch with the old window.
 */
function PeriodFilterDropdown({
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
    const { t } = useTranslation();
    const [open, setOpen]               = useState(false);
    const [manualPopover, setManualPop] = useState(false);
    const [draftFrom, setDraftFrom]     = useState<string>("");
    const [draftTo, setDraftTo]         = useState<string>("");
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open && !manualPopover) return;
        function onDocMouseDown(e: MouseEvent) {
            if (!rootRef.current?.contains(e.target as Node)) {
                setOpen(false);
                setManualPop(false);
            }
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setOpen(false);
                setManualPop(false);
            }
        }
        document.addEventListener("mousedown", onDocMouseDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, manualPopover]);

    const options: Array<{ value: PeriodKey; label: string }> = [
        { value: "30d",    label: t("payment.internal.filter.last_30_days") },
        { value: "90d",    label: t("payment.internal.filter.last_90_days") },
        { value: "180d",   label: t("payment.internal.filter.last_180_days") },
        { value: "manual", label: t("payment.internal.filter.enter_manually") },
    ];

    // Trigger label — when in manual mode AND the user has picked a
    // range, show "DD-MM-YYYY ~ DD-MM-YYYY" so the chosen window stays
    // visible at a glance. Falls back to the "Enter Manually" label
    // until the user commits a range, and to the matched preset label
    // for the three preset values (default: Last 30 Days).
    const triggerLabel = (() => {
        if (period === "manual") {
            if (manualRange) {
                return `${dmyFromYyyymmdd(manualRange.fromDate)} ~ ${dmyFromYyyymmdd(manualRange.toDate)}`;
            }
            return t("payment.internal.filter.enter_manually");
        }
        return options.find((o) => o.value === period)?.label ?? options[0].label;
    })();

    function selectOption(value: PeriodKey) {
        if (value === "manual") {
            // Seed the draft with the current manual range (or today as
            // both ends) so the popover opens with sensible defaults.
            const todayIso = isoFromYyyymmdd(yyyymmddToday());
            setDraftFrom(
                manualRange ? isoFromYyyymmdd(manualRange.fromDate) : todayIso,
            );
            setDraftTo(
                manualRange ? isoFromYyyymmdd(manualRange.toDate) : todayIso,
            );
            setOpen(false);
            setManualPop(true);
            return;
        }
        onPeriodChange(value);
        setOpen(false);
    }

    function saveManual() {
        if (!draftFrom || !draftTo) return;
        if (draftFrom > draftTo) return; // ISO strings sort lexicographically
        if (onManualRangeChange) {
            onManualRangeChange({
                fromDate: yyyymmddFromIso(draftFrom),
                toDate:   yyyymmddFromIso(draftTo),
            });
        }
        onPeriodChange("manual");
        setManualPop(false);
    }

    function cancelManual() {
        setManualPop(false);
    }

    return (
        <div
            ref={rootRef}
            className="relative"
            style={{ width: "var(--w-wb-st-period)" }}
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex h-[var(--h-wb-filter-btn)] w-full cursor-pointer items-center justify-between gap-2 overflow-clip rounded-md bg-white px-2 shadow-wb-btn"
            >
                <span className="flex-1 truncate text-left text-wb-14-tight font-medium text-wb-ntrl-8">
                    {triggerLabel}
                </span>
                <ChevronDown
                    aria-hidden
                    className={cn(
                        "size-4 shrink-0 text-wb-ntrl-6 transition-transform",
                        open && "rotate-180",
                    )}
                    strokeWidth={1.8}
                />
            </button>
            {open && (
                <ul
                    role="listbox"
                    className="absolute left-0 right-0 top-[calc(var(--h-wb-filter-btn)+4px)] z-10 rounded-md border border-wb-ntrl-4 bg-white py-1 shadow-wb-card"
                >
                    {options.map((opt) => {
                        const isSelected = opt.value === period;
                        return (
                            <li key={opt.value}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => selectOption(opt.value)}
                                    className={cn(
                                        "block w-full truncate px-2.5 py-2 text-left text-wb-13 font-medium",
                                        isSelected
                                            ? "bg-brand-soft text-brand"
                                            : "text-wb-ink hover:bg-wb-bg-sidebar",
                                    )}
                                >
                                    {opt.label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
            {manualPopover && (
                <div
                    className="absolute left-0 top-[calc(var(--h-wb-filter-btn)+4px)] z-20 flex flex-col gap-3 rounded-md border border-wb-ntrl-4 bg-white p-3 shadow-wb-card"
                    style={{ minWidth: 360 }}
                >
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <DateField
                                value={draftFrom}
                                onChange={setDraftFrom}
                            />
                        </div>
                        <span className="text-wb-13 font-medium text-wb-ntrl-6">~</span>
                        <div className="flex-1">
                            <DateField
                                value={draftTo}
                                onChange={setDraftTo}
                                minIso={draftFrom || undefined}
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={cancelManual}
                            className="flex h-8 cursor-pointer items-center rounded-md bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/5"
                        >
                            {t("dialog.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={saveManual}
                            disabled={!draftFrom || !draftTo || draftFrom > draftTo}
                            className={cn(
                                "flex h-8 items-center rounded-md px-3 text-wb-13 font-medium text-white shadow-wb-brand-btn",
                                draftFrom && draftTo && draftFrom <= draftTo
                                    ? "cursor-pointer bg-brand hover:bg-brand-hover"
                                    : "cursor-not-allowed bg-wb-ntrl-4",
                            )}
                        >
                            {t("dialog.save")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* Date format helpers — yyyy-MM-dd (HTML <input type="date">) ↔
 * yyyyMMdd (backend wire format). */
function yyyymmddToday(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
function isoFromYyyymmdd(raw: string): string {
    if (!raw || raw.length !== 8) return "";
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}
function yyyymmddFromIso(iso: string): string {
    if (!iso || iso.length !== 10) return "";
    return iso.replace(/-/g, "");
}

/**
 * Calendar-icon trigger + dual-month range popover (Figma 123:4630).
 *
 * <p>Click the icon to open {@link DateRangePopover}. Apply commits the
 * chosen range as a manual period — flips {@code period} to `"manual"`
 * and writes the yyyymmdd pair into {@code manualRange}. The seed for
 * the popover comes from the current manual range (when in manual mode)
 * or from today − N days (where N matches the preset period).
 *
 * <p>When {@code onManualRangeChange} is omitted the icon stays inert —
 * callers that don't expose a manual-range slot fall back to the icon-
 * only chrome via {@link CalendarIconButton}.
 */
function CalendarRangeAffordance({
    period,
    manualRange,
    onPeriodChange,
    onManualRangeChange,
}: {
    period?: PeriodKey;
    manualRange?: ManualDateRange;
    onPeriodChange?: (period: PeriodKey) => void;
    onManualRangeChange?: (range: ManualDateRange) => void;
}) {
    const [open, setOpen] = useState(false);

    // Seed for the popover — current manual range if any, otherwise the
    // window matching the preset period (mirrors the legacy click-to-open
    // behaviour where the popover lands on the "current" selection).
    const seed = seedRangeFor(period, manualRange);

    if (!onManualRangeChange || !onPeriodChange) {
        return <CalendarIconButton />;
    }
    return (
        <div className="relative">
            <CalendarIconButton onClick={() => setOpen((v) => !v)} />
            {open && (
                <DateRangePopover
                    start={seed.startIso}
                    end={seed.endIso}
                    onApply={(range) => {
                        onManualRangeChange({
                            fromDate: yyyymmddFromIso(range.start),
                            toDate:   yyyymmddFromIso(range.end),
                        });
                        onPeriodChange("manual");
                        setOpen(false);
                    }}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}

/** Derive ISO start / end for the popover seed from the current period
 *  state. Manual mode → return the committed manualRange; preset mode →
 *  return today − N days. */
function seedRangeFor(
    period: PeriodKey | undefined,
    manualRange: ManualDateRange | undefined,
): { startIso: string; endIso: string } {
    if (period === "manual" && manualRange) {
        return {
            startIso: isoFromYyyymmdd(manualRange.fromDate),
            endIso:   isoFromYyyymmdd(manualRange.toDate),
        };
    }
    const days = period === "180d" ? 180 : period === "90d" ? 90 : 30;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    return { startIso: isoOf(start), endIso: isoOf(today) };
}

function isoOf(d: Date): string {
    const yyyy = d.getFullYear().toString().padStart(4, "0");
    const mm   = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd   = d.getDate().toString().padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function dmyFromYyyymmdd(raw: string): string {
    if (!raw || raw.length !== 8) return raw ?? "";
    return `${raw.slice(6, 8)}-${raw.slice(4, 6)}-${raw.slice(0, 4)}`;
}

/**
 * Render one canonical sort-aware column header. When the page passes
 * a `sortableColumns` entry for this column key the header becomes
 * clickable and routes the click into the page's `onSort` handler.
 * Pages that don't wire sort (mock-data twins) pass nothing and the
 * header renders as a plain non-clickable cell.
 */
function renderSortableHeader(
    columnKey: keyof ScheduledBatchSortable,
    label: React.ReactNode,
    sortableColumns: ScheduledBatchSortable | undefined,
    sort: { field: string | null; direction: ListSortDirection } | undefined,
    onSort: ((fieldId: string) => void) | undefined,
) {
    const fieldId = sortableColumns?.[columnKey];
    if (fieldId && sort && onSort) {
        return (
            <TableHeaderCell
                sortFieldId={fieldId}
                activeSortField={sort.field}
                activeSortDirection={sort.direction}
                onSort={onSort}
            >
                {label}
            </TableHeaderCell>
        );
    }
    return <TableHeaderCell>{label}</TableHeaderCell>;
}

function ScheduledTitleActionGroup({
    onExcelUpload,
    onPrint,
    onListView,
}: {
    onExcelUpload?: () => void;
    onPrint?: () => void;
    onListView?: (anchorRect: DOMRect) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-2">
            <ToolbarIcon
                src="/assets/common/ico-list.svg"
                label={t("common.open_list")}
                onClickWithRect={onListView}
            />
            <ToolbarIcon
                src="/assets/common/ico-print.svg"
                label={t("common.print")}
                onClick={onPrint}
            />
            <ExcelUploadButton onClick={onExcelUpload} />
        </div>
    );
}

function FilterDropdown({ label, width }: { label: string; width?: string }) {
    return (
        <button
            type="button"
            className="flex h-[var(--h-wb-filter-btn)] items-center justify-between gap-2 rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-13 font-medium text-wb-ink hover:bg-neutral-50"
            style={width ? { width } : undefined}
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

function ToolbarIcon({
    src,
    label,
    onClick,
    onClickWithRect,
}: {
    src: string;
    label: string;
    onClick?: () => void;
    /**
     * Variant of `onClick` that receives the icon's `DOMRect` — used by
     * the list-view trigger so the View Setting popover can anchor
     * itself below the icon (CLAUDE.md §13).
     */
    onClickWithRect?: (anchorRect: DOMRect) => void;
}) {
    const handler = onClickWithRect
        ? (e: React.MouseEvent<HTMLButtonElement>) =>
              onClickWithRect(e.currentTarget.getBoundingClientRect())
        : onClick;
    return (
        <button
            type="button"
            onClick={handler}
            disabled={!handler}
            aria-label={label}
            className="flex size-8 items-center justify-center rounded-md hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" aria-hidden className="size-5" />
        </button>
    );
}

function ExcelUploadButton({ onClick }: { onClick?: () => void }) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className="flex h-[var(--h-wb-filter-btn)] items-center gap-2 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium text-wb-ink hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/assets/common/ico-excel.svg"
                alt=""
                aria-hidden
                className="size-4"
            />
            {t("payment.internal.excel_upload")}
        </button>
    );
}

/* ─────────────────────────── row ─────────────────────────── */

function ScheduledRow<Row extends PaymentScheduledBatchRow>({
    row,
    extraColumn,
    isVisible,
    selected,
    onToggle,
    onActivate,
    onApprovalRefClick,
    onTransfer,
    onDelete,
    onDownload,
}: {
    row: Row;
    extraColumn?: ScheduledBatchExtraColumn<Row>;
    /** Visibility predicate from the shell — keyed by V85 FIELD_ID. */
    isVisible: FieldVisibility;
    selected: boolean;
    onToggle: () => void;
    onActivate: () => void;
    /** Per-cell handler for the Approval Ref column — renders the
     *  value as a clickable affordance with click propagation stopped
     *  so the rest of the row still triggers `onActivate`. */
    onApprovalRefClick?: () => void;
    onTransfer?: () => void;
    onDelete?:   () => void;
    onDownload?: () => void;
}) {
    const { t } = useTranslation();
    const [date, time] = row.dateTime.split("\n");

    return (
        <TableRow
            className={cn(
                "h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0",
                row.rowHighlight === "selected" && "bg-wb-status-progress-bg",
                row.rowHighlight === "warning" && "bg-wb-status-pending-bg",
            )}
        >
            <TableCell className="px-2.5 py-2.5">
                {/* Already-submitted rows (those with an approval ref)
                 *  can't be re-submitted via Request Approval — the
                 *  backend rejects with WBE2062 — so the checkbox is
                 *  disabled at the UI layer for clarity. Mirrors the
                 *  legacy `comm_0194_001` flow which short-circuits on
                 *  `APPR_SEQ_NO` before opening the approval dialog. */}
                <Checkbox
                    checked={selected}
                    onCheckedChange={onToggle}
                    disabled={Boolean(row.approvalRef)}
                    aria-label={t("payment.aria.select_file", { fileName: row.fileName })}
                />
            </TableCell>

            {isVisible("REG_DTM") && (
                <BodyCell onClick={onActivate}>
                    <span className="block text-wb-13 font-medium text-wb-ink">{date}</span>
                    {time ? (
                        <span className="mt-0.5 block text-wb-12 font-normal text-wb-ntrl-6">
                            {time}
                        </span>
                    ) : null}
                </BodyCell>
            )}

            {isVisible("TITL") && (
                <BodyCell onClick={onActivate}>
                    <TextSpan>{row.fileName}</TextSpan>
                </BodyCell>
            )}

            {isVisible("TOT_TRNS_CNT") && (
                <BodyCell onClick={onActivate}>
                    <TextSpan>
                        {t("payment.internal.txn_count_with_currency", {
                            count: String(row.txnCount),
                            currency: row.txnCurrency,
                        })}
                    </TextSpan>
                </BodyCell>
            )}

            {isVisible("TOTAL_TRAN_AMT") && (
                <BodyCell onClick={onActivate}>
                    <TextSpan>{row.totalAmount}</TextSpan>
                </BodyCell>
            )}

            {extraColumn ? (
                <TableCell
                    onClick={onActivate}
                    className={cn(
                        "cursor-pointer px-2.5 py-2.5",
                        extraColumn.align === "right" && "text-right",
                        extraColumn.align === "center" && "text-center",
                    )}
                >
                    {extraColumn.render(row)}
                </TableCell>
            ) : null}

            {isVisible("APPR_STTS") && (
                <TableCell className="px-2.5 py-2.5">
                    {row.status ? (
                        <StatusBadge
                            status={row.status}
                            step={row.statusStep}
                            label={t(`payment.status.${row.status}`)}
                        />
                    ) : null}
                </TableCell>
            )}

            {isVisible("REG_ID") && (
                <BodyCell onClick={onActivate}>
                    <TextSpan>{row.requestor}</TextSpan>
                </BodyCell>
            )}

            <TableCell className="px-2.5 py-2.5">
                <div className="flex items-center gap-1">
                    <span className="truncate text-wb-13 font-medium text-wb-ink">
                        {row.approver}
                    </span>
                    {row.approverCount != null ? (
                        <>
                            <span className="inline-flex items-center justify-center rounded-[4px] border border-wb-ntrl-4 bg-wb-ntrl-3 px-1 text-wb-10 font-medium uppercase text-black/70">
                                {row.approverCount}
                            </span>
                            <ChevronDown
                                aria-hidden
                                className="size-[18px] shrink-0 text-wb-ntrl-6"
                                strokeWidth={1.8}
                            />
                        </>
                    ) : null}
                </div>
            </TableCell>

            {isVisible("APPR_SEQ_NO") && (
                <BodyCell onClick={onActivate}>
                    {onApprovalRefClick && row.approvalRef ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                // Stop propagation so the row's
                                // `onActivate` (detail-page navigation)
                                // doesn't fire alongside the
                                // approval-details intent.
                                e.stopPropagation();
                                onApprovalRefClick();
                            }}
                            className="cursor-pointer text-wb-13 font-medium text-brand hover:underline"
                        >
                            {row.approvalRef}
                        </button>
                    ) : (
                        <TextSpan>{row.approvalRef}</TextSpan>
                    )}
                </BodyCell>
            )}

            <BodyCell onClick={onActivate}>
                <span className="block text-wb-13 font-medium leading-snug text-wb-ink">
                    {row.approvalTitle}
                </span>
            </BodyCell>

            <TableCell className="px-2.5 py-2.5">
                <RowAction
                    action={row.action}
                    canDelete={row.canDelete ?? false}
                    canDownloadFile={row.canDownloadFile ?? false}
                    transferDisabled={row.transferDisabled ?? false}
                    onPrimary={onActivate}
                    onTransfer={onTransfer}
                    onDelete={onDelete}
                    onDownload={onDownload}
                />
            </TableCell>
        </TableRow>
    );
}

function BodyCell({
    children,
    onClick,
}: {
    children: React.ReactNode;
    onClick?: () => void;
}) {
    return (
        <TableCell
            onClick={onClick}
            className={cn("px-2.5 py-2.5", onClick && "cursor-pointer")}
        >
            {children}
        </TableCell>
    );
}

function TextSpan({ children }: { children: React.ReactNode }) {
    return (
        <span className="block truncate text-wb-13 font-medium text-wb-ink">
            {children}
        </span>
    );
}

/**
 * Per-row action cell — mirrors legacy `pymn_0009_001.createActionCell`:
 *
 *   • Transfer / Check icon — only when `action === "transfer"` (not yet
 *     dispatched, awaiting send) or `action === "complete"` (TRNF_YN='Y',
 *     already dispatched).
 *   • Delete pill — only when `canDelete === true` (not yet submitted
 *     for approval, derived per-row by the page).
 *   • Download icon — only when `canDownloadFile === true` (uploaded
 *     Excel exists for the batch).
 *
 * Each control is rendered as soon as its row flag + matching callback
 * are both present; missing callbacks degrade the cell silently so
 * mock-data twins (Vendor / Expense / Payroll / Overseas) keep working.
 */
function RowAction({
    action,
    canDelete,
    canDownloadFile,
    transferDisabled,
    onPrimary,
    onTransfer,
    onDelete,
    onDownload,
}: {
    action?: ScheduledBatchAction;
    canDelete: boolean;
    canDownloadFile: boolean;
    transferDisabled: boolean;
    onPrimary: () => void;
    onTransfer?: () => void;
    onDelete?:   () => void;
    onDownload?: () => void;
}) {
    const { t } = useTranslation();

    // Suppress the row-click navigation when the user is clicking a
    // nested control — mirrors the legacy stopPropagation pattern so
    // the click doesn't fall through to the row's `onActivate`.
    const stop = (fn?: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        fn?.();
    };

    const showTransfer = action === "transfer";
    const showComplete = action === "complete";
    const showDelete   = canDelete && Boolean(onDelete);
    const showDownload = canDownloadFile && Boolean(onDownload);
    // Fallback so existing mock-data twins still get the document-glyph
    // detail trigger they had before this rewrite — only when no real
    // row-action is rendered.
    const showFallback = !showTransfer && !showComplete && !showDelete && !showDownload;

    return (
        <div className="flex items-center justify-end gap-1.5">
            {showTransfer && (
                <button
                    type="button"
                    onClick={stop(onTransfer ?? onPrimary)}
                    disabled={transferDisabled}
                    className={cn(
                        "flex h-7 items-center rounded-md border px-2 text-wb-13 font-medium",
                        transferDisabled
                            ? "cursor-not-allowed border-wb-ntrl-4 bg-wb-ntrl-3 text-wb-ntrl-6"
                            : "cursor-pointer border-wb-ntrl-4 bg-white text-wb-ink hover:bg-neutral-50",
                    )}
                >
                    {t("payment.internal.transfer_action")}
                </button>
            )}
            {showComplete && (
                <span
                    aria-label={t("payment.internal.transfer_completed")}
                    className="inline-flex size-5 items-center justify-center rounded-full bg-wb-status-approved-text text-white"
                >
                    <Check className="size-3" strokeWidth={3} />
                </span>
            )}
            {showDelete && (
                <button
                    type="button"
                    onClick={stop(onDelete)}
                    aria-label={t("payment.internal.delete_action")}
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-wb-status-rejected-text/40 bg-white px-2 text-wb-13 font-medium text-wb-status-rejected-text hover:bg-wb-status-rejected-bg"
                >
                    <Trash2 className="size-3.5" strokeWidth={1.8} />
                    {t("payment.internal.delete_action")}
                </button>
            )}
            {showDownload && (
                <button
                    type="button"
                    onClick={stop(onDownload)}
                    aria-label={t("payment.internal.download_excel")}
                    className="flex size-6 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-download.svg"
                        alt=""
                        aria-hidden
                        className="size-4"
                    />
                </button>
            )}
            {showFallback && <DocumentIcon onClick={stop(onPrimary)} />}
        </div>
    );
}

function DocumentIcon({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={t("payment.aria.open_detail")}
            className="flex size-6 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5"
        >
            <FileText className="size-4" strokeWidth={1.8} />
        </button>
    );
}
