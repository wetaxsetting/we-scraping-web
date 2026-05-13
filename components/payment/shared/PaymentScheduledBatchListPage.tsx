"use client";

import { Check, ChevronDown, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import StatusBadge from "@/components/payment/approval-box/StatusBadge";
import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import CalendarIconButton from "@/components/shared/CalendarIconButton";
import DataTableFooter from "@/components/shared/DataTableFooter";
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

export type PaymentScheduledBatchRow = {
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
};

/**
 * Optional module-specific column inserted between Total Transfer Amount and
 * Approval Status. Currently only used by Overseas Payment for its Schedule
 * Date column (Figma 29:14947). Header label rendering matches the canonical
 * columns; body rendering is the caller's responsibility.
 */
export type ScheduledBatchExtraColumn<Row> = {
    key: string;
    label: React.ReactNode;
    /** CSS width for the `<col>` (e.g. `"140px"`, `"var(--w-wb-st-schedule-date)"`). */
    width: string;
    align?: "left" | "right" | "center";
    render: (row: Row) => React.ReactNode;
};

type FooterTotal = { currency: string; amount: string };

/**
 * Period dropdown options. The translated label comes from
 * `payment.internal.filter.period.<key>` so each Payment module reuses
 * the same i18n surface.
 */
export type PeriodKey = "7d" | "30d" | "90d";

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
export type ScheduledBatchSortable = Partial<Record<
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
>>;

export type PaymentScheduledBatchListPageProps<Row extends PaymentScheduledBatchRow> = {
    /** Already-translated page title (`t("payment.<module>.scheduled_title")`). */
    title: string;
    rows: Row[];
    /** Builds the row's detail-page route. */
    rowDetailHref: (row: Row) => string;
    /** Min-width of the table — bumped by callers that add `extraColumn`. */
    tableMinWidth?: string;
    /**
     * Optional extra column inserted between Total Transfer Amount and
     * Approval Status. Used by Overseas for Schedule Date. When supplied,
     * `tableMinWidth` MUST be wide enough to accommodate the extra width
     * (the shared default token covers the canonical 11-column layout).
     */
    extraColumn?: ScheduledBatchExtraColumn<Row>;
    /**
     * Per-currency total amounts rendered in the sibling footer. Each entry
     * produces one footer row aligned under Total Transfer Amount. Pass an
     * empty array to render only the count cell (rare).
     */
    totals: FooterTotal[];
    /** Pre-translated label for the count cell — e.g. `t("payment.document_count", { count })`. */
    countLabel?: string;
    /** Searchable string fields — defaults to fileName/requestor/approver/approvalRef/approvalTitle. */
    searchableFields?: (keyof Row & string)[];
    /**
     * Fired when the user clicks the Excel Upload chip in the title-row
     * action group. Each Payment module wires this to its own per-type
     * thin wrapper around `<PaymentExcelUploadDialog>` (CLAUDE.md §3a) —
     * Internal Transfer to `<InternalTransferUploadDialog>`, Vendor to
     * `<VendorPaymentUploadDialog>`, etc. Omit on modules that have
     * not yet enabled upload (button renders inert).
     */
    onExcelUpload?: () => void;

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
     * `sortableColumns` maps stable column keys to backend FIELD_IDs
     * — columns missing from the map render without sort wiring (no
     * click handler, glyph is the inactive default). `onSort` cycles
     * the state for the supplied FIELD_ID via the page's hook.
     */
    sort?: { field: string | null; direction: ListSortDirection };
    sortableColumns?: ScheduledBatchSortable;
    onSort?: (fieldId: string) => void;

    /* — Period dropdown (opt-in) ——————————————————————————————————
     *
     * When `period` + `onPeriodChange` are provided the toolbar's
     * "Last N Days" chip becomes an interactive popover with the
     * three canonical options (7 / 30 / 90 days). Pages map the
     * selected key to a from/to-date window before firing their data
     * fetcher.
     */
    period?: PeriodKey;
    onPeriodChange?: (period: PeriodKey) => void;

    /* — Approval-status dropdown (opt-in) ——————————————————————————
     *
     * When `apprTypeOptions` + `onApprTypeChange` are provided the
     * toolbar's "All Approval Status" chip becomes an interactive
     * picklist; the selected value is mirrored back via `apprType`
     * (empty string = "All"). Pages forward the value into their
     * data fetcher's `appr_type` param.
     */
    apprType?: string;
    apprTypeOptions?: ReadonlyArray<{ value: string; labelKey: string }>;
    onApprTypeChange?: (apprType: string) => void;

    /* — Server-driven search (opt-in) ——————————————————————————————
     *
     * When `onSearchChange` is provided the shared toolbar's
     * SearchInput becomes a controlled component bound to `search`.
     * Pages debounce-forward the value into their data fetcher's
     * `srch_wd` param and reset to page 0 on every change.
     */
    search?: string;
    onSearchChange?: (keyword: string) => void;

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
     */
    onPrint?: () => void;
    onListView?: (anchorRect: DOMRect) => void;

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
};

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
    tableMinWidth = DEFAULT_TABLE_MIN_WIDTH,
    extraColumn,
    totals,
    countLabel,
    searchableFields,
    onExcelUpload,
    pagination,
    sort,
    sortableColumns,
    onSort,
    period,
    onPeriodChange,
    apprType,
    apprTypeOptions,
    onApprTypeChange,
    search: controlledSearch,
    onSearchChange,
    onPrint,
    onListView,
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
    const isSearchControlled = onSearchChange !== undefined;
    const [internalSearch, setInternalSearch] = useState("");
    const search = isSearchControlled ? (controlledSearch ?? "") : internalSearch;
    const setSearch = isSearchControlled
        ? (next: string) => onSearchChange(next)
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

    const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
    const toggleRow = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const toggleAll = () =>
        setSelected(allChecked ? new Set() : new Set(filtered.map((r) => r.id)));

    const goToDetail = (row: Row) => router.push(rowDetailHref(row));

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
                period={period}
                onPeriodChange={onPeriodChange}
                apprType={apprType}
                apprTypeOptions={apprTypeOptions}
                onApprTypeChange={onApprTypeChange}
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
                            page={1}
                            pageCount={Math.max(1, Math.ceil(filtered.length / 10))}
                            pageSize={10}
                            totalLabel={t("common.showing_of", {
                                shown: String(Math.min(filtered.length, 10)),
                                total: String(filtered.length),
                            })}
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
    period,
    onPeriodChange,
    apprType,
    apprTypeOptions,
    onApprTypeChange,
}: {
    search: string;
    onSearchChange: (v: string) => void;
    period?: PeriodKey;
    onPeriodChange?: (period: PeriodKey) => void;
    apprType?: string;
    apprTypeOptions?: ReadonlyArray<{ value: string; labelKey: string }>;
    onApprTypeChange?: (apprType: string) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" className="h-[var(--h-wb-filter-btn)] px-3">
                    {t("payment.internal.request_approval")}
                </Button>
                {period !== undefined && onPeriodChange ? (
                    <PeriodFilterDropdown
                        period={period}
                        onPeriodChange={onPeriodChange}
                    />
                ) : (
                    <FilterDropdown
                        label={t("payment.internal.filter.last_30_days")}
                        width="var(--w-wb-st-period)"
                    />
                )}
                <CalendarIconButton />
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
 * trigger when the page passes `period` + `onPeriodChange`. Three
 * canonical options (Last 7 / 30 / 90 Days) that map 1:1 to the
 * {@link PeriodKey} values consumed by the page's data fetcher.
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
        { value: "7d",  label: t("payment.internal.filter.last_7_days") },
        { value: "30d", label: t("payment.internal.filter.last_30_days") },
        { value: "90d", label: t("payment.internal.filter.last_90_days") },
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
}: {
    row: Row;
    extraColumn?: ScheduledBatchExtraColumn<Row>;
    /** Visibility predicate from the shell — keyed by V85 FIELD_ID. */
    isVisible: FieldVisibility;
    selected: boolean;
    onToggle: () => void;
    onActivate: () => void;
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
                <Checkbox
                    checked={selected}
                    onCheckedChange={onToggle}
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
                    <TextSpan>{row.approvalRef}</TextSpan>
                </BodyCell>
            )}

            <BodyCell onClick={onActivate}>
                <span className="block text-wb-13 font-medium leading-snug text-wb-ink">
                    {row.approvalTitle}
                </span>
            </BodyCell>

            <TableCell className="px-2.5 py-2.5">
                <RowAction action={row.action} onPrimary={onActivate} />
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

function RowAction({
    action,
    onPrimary,
}: {
    action?: ScheduledBatchAction;
    onPrimary: () => void;
}) {
    const { t } = useTranslation();

    if (action === "transfer") {
        return (
            <div className="flex items-center justify-end gap-1.5">
                <button
                    type="button"
                    onClick={onPrimary}
                    className="flex h-7 items-center rounded-md border border-wb-ntrl-4 bg-white px-2 text-wb-13 font-medium text-wb-ink hover:bg-neutral-50"
                >
                    {t("payment.internal.transfer_action")}
                </button>
                <DocumentIcon onClick={onPrimary} />
            </div>
        );
    }
    if (action === "complete") {
        return (
            <div className="flex items-center justify-end gap-1.5">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-wb-status-approved-text text-white">
                    <Check className="size-3" strokeWidth={3} />
                </span>
                <DocumentIcon onClick={onPrimary} />
            </div>
        );
    }
    return (
        <div className="flex items-center justify-end">
            <DocumentIcon onClick={onPrimary} />
        </div>
    );
}

function DocumentIcon({ onClick }: { onClick: () => void }) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={t("payment.aria.open_detail")}
            className="flex size-6 items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5"
        >
            <FileText className="size-4" strokeWidth={1.8} />
        </button>
    );
}
