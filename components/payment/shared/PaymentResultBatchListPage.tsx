"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import CalendarIconButton from "@/components/shared/CalendarIconButton";
import DataTableFooter from "@/components/shared/DataTableFooter";
import DataTableShell from "@/components/shared/DataTableShell";
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
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type {
    ListSortDirection,
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
     * "Last N Days" chip becomes an interactive popover with the
     * three canonical options (7 / 30 / 90 days).
     */
    period?: PeriodKey;
    onPeriodChange?: (period: PeriodKey) => void;

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
    pagination,
    sort,
    sortableColumns,
    onSort,
    period,
    onPeriodChange,
    search: controlledSearch,
    onSearchChange,
    statusFilter: controlledStatusFilter,
    onStatusFilterChange,
    onPrint,
    onListView,
    onExcelExport,
    onCalendarClick,
    onDownloadRow,
    viewSettingItems,
    extraColumns,
}: PaymentResultBatchListPageProps<Row>) {
    const { t } = useTranslation();
    const router = useRouter();

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

    const hasTotals = totals != null && totals.length > 0;

    const extraCols = extraColumns ?? [];

    const tableNode = (
        <table
            className="w-full table-fixed border-collapse"
            style={{ minWidth: tableMinWidth }}
        >
            <ResultColumns isVisible={isVisible} extraColumns={extraCols} />
            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    {isVisible("REG_DTM") &&
                        renderSortableHeader(
                            "DATE_TIME",
                            t("payment.internal.col.date_time"),
                            sortableColumns,
                            sort,
                            onSort,
                        )}
                    {isVisible("ORG_FILE_NM") &&
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
                    {isVisible("TOTAL_TRAN_AMT") && (
                        <TableHeaderCell align="right">
                            {renderSortableInlineLabel(
                                "TOTAL_AMOUNT",
                                t("payment.internal.col.total_transfer"),
                                sortableColumns,
                                sort,
                                onSort,
                            )}
                        </TableHeaderCell>
                    )}
                    {extraCols
                        .filter((ec) => isVisible(ec.fieldId))
                        .map((ec) => (
                            <TableHeaderCell key={ec.fieldId}>
                                {ec.header}
                            </TableHeaderCell>
                        ))}
                    {isVisible("TRNF_YN") &&
                        renderSortableHeader(
                            "STATUS",
                            t("payment.internal.result.col.transfer_status"),
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
                    {isVisible("TITL") &&
                        renderSortableHeader(
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
                    <ResultRow
                        key={row.id}
                        row={row}
                        isVisible={isVisible}
                        extraColumns={extraCols}
                        onActivate={() => goToDetail(row)}
                        onDownload={onDownloadRow ? () => onDownloadRow(row) : undefined}
                    />
                ))}
            </TableBody>
        </table>
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
                onCalendarClick={onCalendarClick}
            />

            {hasTotals ? (
                <DataTableShell
                    footerMode="paginationWithTotals"
                    table={tableNode}
                    footer={
                        <DataTableFooter
                            colgroup={<ResultColumns isVisible={isVisible} extraColumns={extraCols} />}
                            minWidth={tableMinWidth}
                            className="mt-auto"
                        >
                            {totals!.map((total) => (
                                <ResultFooterRow
                                    key={total.currency}
                                    total={total}
                                    isVisible={isVisible}
                                    extraColumns={extraCols}
                                />
                            ))}
                        </DataTableFooter>
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
        </PageLayout>
    );
}

/* ─────────────────────────── colgroup ─────────────────────────── */

type FieldVisibility = (fieldId: string) => boolean;

function ResultColumns({
    isVisible = () => true,
    extraColumns = [],
}: {
    isVisible?: FieldVisibility;
    extraColumns?: ResultExtraColumn<unknown>[];
}) {
    return (
        <colgroup>
            {isVisible("REG_DTM") ? <col className="w-[var(--w-wb-tr-datetime)]" /> : null}
            {isVisible("ORG_FILE_NM") ? <col className="w-[var(--w-wb-tr-filename)]" /> : null}
            {isVisible("TOT_TRNS_CNT") ? <col className="w-[var(--w-wb-tr-txn-count)]" /> : null}
            {isVisible("TOTAL_TRAN_AMT") ? <col className="w-[var(--w-wb-tr-total)]" /> : null}
            {extraColumns
                .filter((ec) => isVisible(ec.fieldId))
                .map((ec) => (
                    <col key={ec.fieldId} style={ec.width ? { width: ec.width } : undefined} />
                ))}
            {isVisible("TRNF_YN") ? <col className="w-[var(--w-wb-tr-status)]" /> : null}
            {isVisible("APPR_SEQ_NO") ? <col className="w-[var(--w-wb-tr-approval-ref)]" /> : null}
            {isVisible("TITL") ? <col className="w-[var(--w-wb-tr-approval-title)]" /> : null}
            <col className="w-[var(--w-wb-tr-action)]" />
        </colgroup>
    );
}

/* ─────────────────────────── footer row ─────────────────────────── */

function ResultFooterRow({
    total,
    isVisible,
    extraColumns = [],
}: {
    total: FooterTotal;
    isVisible: FieldVisibility;
    extraColumns?: ResultExtraColumn<unknown>[];
}) {
    const { t } = useTranslation();
    const extraVisible = extraColumns.filter((ec) => isVisible(ec.fieldId)).length;
    const visibleDataCols =
        [
            isVisible("REG_DTM"),
            isVisible("ORG_FILE_NM"),
            isVisible("TOT_TRNS_CNT"),
            isVisible("TOTAL_TRAN_AMT"),
            isVisible("TRNF_YN"),
            isVisible("APPR_SEQ_NO"),
            isVisible("TITL"),
        ].filter(Boolean).length + extraVisible;
    // Leading label spans 3 columns when there are at least 4 visible
    // data columns; otherwise it spans all but the last (amount).
    const leadingSpan = Math.min(3, Math.max(1, visibleDataCols - 1));
    const trailingSpan = Math.max(
        0,
        visibleDataCols - leadingSpan - 1, /* the amount column */
    );
    return (
        <tr>
            <td colSpan={leadingSpan} className="px-2.5 py-3">
                <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                    {t("payment.internal.footer_total", { currency: total.currency })}
                </span>
            </td>
            <td className="px-2.5 py-3 text-right">
                <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-ink">
                    {total.amount}
                </span>
            </td>
            {trailingSpan > 0 ? <td colSpan={trailingSpan} /> : null}
            {/* trailing action column */}
            <td />
        </tr>
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
    onCalendarClick,
}: {
    search: string;
    onSearchChange: (v: string) => void;
    statusFilter: ResultStatusFilter;
    onStatusFilterChange: (next: ResultStatusFilter) => void;
    period?: PeriodKey;
    onPeriodChange?: (period: PeriodKey) => void;
    onCalendarClick?: () => void;
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
                    <PeriodFilterDropdown
                        period={period}
                        onPeriodChange={onPeriodChange}
                    />
                ) : (
                    <PeriodDropdownStatic label={t("date_range_filter.last_180_days")} />
                )}
                <CalendarIconButton onClick={onCalendarClick} />
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
 * Interactive period filter — replaces the static chip when the page
 * passes `period` + `onPeriodChange`. Three canonical options (Last 7 /
 * 30 / 90 Days) that map 1:1 to the {@link PeriodKey} values consumed
 * by the page's data fetcher. Mirrors the Scheduled shell's twin
 * component byte-for-byte.
 */
function PeriodFilterDropdown({
    period,
    onPeriodChange,
}: {
    period: PeriodKey;
    onPeriodChange: (period: PeriodKey) => void;
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

    const options: Array<{ value: PeriodKey; label: string }> = [
        { value: "30d",  label: t("date_range_filter.last_30_days") },
        { value: "90d",  label: t("date_range_filter.last_90_days") },
        { value: "180d", label: t("date_range_filter.last_180_days") },
    ];
    const current = options.find((o) => o.value === period) ?? options[1];

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
                    {current.label}
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
                                    onClick={() => {
                                        onPeriodChange(opt.value);
                                        setOpen(false);
                                    }}
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
        </div>
    );
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
            <ToolbarIcon
                src="/assets/common/ico-excel.svg"
                label={t("common.export_excel")}
                onClick={onExcelExport}
            />
        </div>
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

/* ─────────────────────────── sortable header helpers ─────────────────────────── */

function renderSortableHeader(
    columnKey: keyof ResultBatchSortable,
    label: React.ReactNode,
    sortableColumns: ResultBatchSortable | undefined,
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

/**
 * `<TableHeaderCell align="right">` can't take a sortable variant because
 * the alignment prop and sort props are mutually exclusive on the
 * component's typed API. For the right-aligned Total Transfer Amount
 * column we fall back to passing the label string — the column header
 * stays non-clickable. When a future TableHeaderCell signature unifies
 * align+sort, swap this for a single `renderSortableHeader` call.
 */
function renderSortableInlineLabel(
    _columnKey: keyof ResultBatchSortable,
    label: React.ReactNode,
    _sortableColumns: ResultBatchSortable | undefined,
    _sort: { field: string | null; direction: ListSortDirection } | undefined,
    _onSort: ((fieldId: string) => void) | undefined,
): React.ReactNode {
    return label;
}

/* ─────────────────────────── row ─────────────────────────── */

function ResultRow<Row extends PaymentResultBatchRow>({
    row,
    isVisible,
    extraColumns = [],
    onActivate,
    onDownload,
}: {
    row: Row;
    isVisible: FieldVisibility;
    extraColumns?: ResultExtraColumn<Row>[];
    onActivate: () => void;
    onDownload?: () => void;
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
            {isVisible("REG_DTM") && (
                <TableCell className="px-2.5 py-2.5">
                    <span className="block text-wb-13 font-medium text-wb-ink">{date}</span>
                    {time ? (
                        <span className="mt-0.5 block text-wb-12 font-normal text-wb-ntrl-6">
                            {time}
                        </span>
                    ) : null}
                </TableCell>
            )}
            {isVisible("ORG_FILE_NM") && (
                <TableCell className="px-2.5 py-2.5">
                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                        {row.fileName}
                    </span>
                </TableCell>
            )}
            {isVisible("TOT_TRNS_CNT") && (
                <TableCell className="px-2.5 py-2.5">
                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                        {row.txnCount} Trx ({row.txnCurrency})
                    </span>
                </TableCell>
            )}
            {isVisible("TOTAL_TRAN_AMT") && (
                <TableCell className="px-2.5 py-2.5 text-right">
                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                        {row.totalAmount}
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
            {isVisible("TRNF_YN") && (
                <TableCell className="px-2.5 py-2.5">
                    <ResultStatusCell row={row} />
                </TableCell>
            )}
            {isVisible("APPR_SEQ_NO") && (
                <TableCell className="px-2.5 py-2.5">
                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                        {row.approvalRef}
                    </span>
                </TableCell>
            )}
            {isVisible("TITL") && (
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
                    disabled={!onDownload}
                    onClick={(e) => {
                        // Stop row-click navigation when the user
                        // hits the per-row download glyph.
                        e.stopPropagation();
                        onDownload?.();
                    }}
                    className={`flex size-6 items-center justify-center rounded-md text-wb-ntrl-6 ${
                        onDownload
                            ? "cursor-pointer hover:bg-black/5"
                            : "cursor-not-allowed opacity-40"
                    }`}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-download.svg"
                        alt=""
                        aria-hidden
                        className="size-4"
                    />
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
                    className="inline-flex size-3.5 items-center justify-center rounded-full bg-wb-status-rejected-text text-white text-[9px] font-bold leading-none"
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
