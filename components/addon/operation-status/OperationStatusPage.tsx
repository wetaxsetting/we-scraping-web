"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import OperationStatusActionBar from "./OperationStatusActionBar";
import type { OperationCompanyRow, OperationStatusCode } from "./types";
import DataTableShell from "@/components/shared/DataTableShell";
import FilterDropdown from "@/components/shared/FilterDropdown";
import FilterRow from "@/components/shared/FilterRow";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
    isSpecialViewSettingField,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useDialog } from "@/components/shared/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useExcelExport, type ExcelExportColumnConfig } from "@/hooks/useExcelExport";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import type { SortDirection } from "@/hooks/useTableSort";
import { printReport, type PrintColumn } from "@/lib/print";
import { todayDmy } from "@/lib/excel";
import { formatDateLang } from "@/lib/datetime";
import { useTranslation, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

/**
 * Add-on Service > Operation Status Inquiry (Figma node 12346:109158,
 * live JEX ref `aosv_0001_001.act`).
 *
 * <p>Server-side filter / pagination / sort wired via the parent
 * {@code <OperationStatusClient>}. View Setting drives column
 * visibility / order via {@code useViewSetting(...)} — the popover
 * itself is intentionally NOT rendered (Figma 12346:109158 has no
 * list-view icon; toolbar is Excel + Print + Update + Inquire only).
 * The hook's data still flows into the Excel export column intersection
 * per [§13b](../../../wecms-web/CLAUDE.md).
 *
 * <p>Bottom layout follows the {@code paginationOnly} pattern (CLAUDE.md
 * §7a / §7a.1) — Figma has pagination but no totals row, so no sibling
 * footer table is rendered.
 */

/** Column registry — one entry per FIELD_ID seeded in V56. The page
 *  walks {@code vs.items} filtered to {@code USE_YN === 'Y'} and looks
 *  up each FIELD_ID here for its width / header / body renderer. */
type OperationStatusColumnDef = {
    /** Tailwind width class used in the {@code <colgroup>}. {@code "w-fit"}
     *  for flex columns that take the remaining width. */
    colClassName?: string;
    headerKey: string;
    /** Defaults to "left". */
    align?: "left" | "right";
    cellClassName?: string;
    renderBody: (ctx: {
        row: OperationCompanyRow;
        t: (key: string, vars?: Record<string, string | number>) => string;
        locale: Locale;
    }) => React.ReactNode;
};

const COLUMN_REGISTRY: Record<string, OperationStatusColumnDef> = {
    COMPANY: {
        // Flex column — no width class; takes remaining space alongside ADDRESS.
        headerKey: "operation.col.company",
        cellClassName: "px-2.5 py-2.5 align-middle",
        renderBody: ({ row }) => (
            <div className="flex flex-col gap-0.5">
                <span className="truncate text-wb-13 font-medium text-wb-ink">
                    {row.companyName}
                </span>
                <span className="truncate text-wb-13 font-medium text-wb-muted">
                    {row.taxCode}
                </span>
            </div>
        ),
    },
    ADDRESS: {
        // Flex column — no width class.
        headerKey: "operation.col.address",
        cellClassName: "px-2.5 py-2.5 align-middle",
        renderBody: ({ row }) => (
            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                {row.address}
            </span>
        ),
    },
    OPERATION_STATUS: {
        colClassName: "w-[339px]",
        headerKey: "operation.col.operation_status",
        cellClassName: "px-2.5 py-2.5 align-middle",
        renderBody: ({ row, t }) => <OperationStatusCell status={row.status} t={t} />,
    },
    LAST_UPDATE: {
        colClassName: "w-[220px]",
        headerKey: "operation.col.last_update",
        cellClassName: "px-2.5 py-2.5 align-middle",
        renderBody: ({ row, locale }) => (
            <span className="text-wb-13 font-medium text-wb-ink">
                {/* Locale-aware date-only display — port of legacy
                 *  `common.app.formatDateLang(YYYYMMDD, lang)` used by
                 *  `aosv_0001_001.ts:248-251` (legacy splits the formatted
                 *  datetime, discards the time, then locale-formats the
                 *  date half via `formatDateLang`). EN → DD-MMM-YYYY,
                 *  KO → YYYY-MM-DD, others → DD-MM-YYYY. */}
                {formatDateLang(row.lastUpdate, locale) || row.lastUpdate}
            </span>
        ),
    },
};

/** Stable empty-array reference so the page never re-flickers when the
 *  client wrapper hasn't lit up yet. */
const EMPTY_ROWS: OperationCompanyRow[] = [];

/**
 * First-paint stand-in for {@code vs.items}. Mirrors the V56 seed
 * exactly so the table renders the right shape before the hook resolves.
 * Once {@code vs.items} populates, the live merge takes over.
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "CHECKBOX",         field_nm: "CHECKBOX",         disp_ord: 0, disp_yn: "N", use_yn: "Y", sort_yn: "N", size: "66px"  },
    { field_id: "COMPANY",          field_nm: "COMPANY",          disp_ord: 1, disp_yn: "Y", use_yn: "Y", sort_yn: "Y", size: "auto"  },
    { field_id: "ADDRESS",          field_nm: "ADDRESS",          disp_ord: 2, disp_yn: "Y", use_yn: "Y", sort_yn: "Y", size: "auto"  },
    { field_id: "OPERATION_STATUS", field_nm: "OPERATION_STATUS", disp_ord: 3, disp_yn: "Y", use_yn: "Y", sort_yn: "Y", size: "339px" },
    { field_id: "LAST_UPDATE",      field_nm: "LAST_UPDATE",      disp_ord: 4, disp_yn: "Y", use_yn: "Y", sort_yn: "Y", size: "220px" },
];

/** Excel export column registry — keyed by FIELD_ID; format hints drive
 *  the POI cell-style coercion on the backend writer. Matches the
 *  {@code allowedFieldIds()} set on
 *  {@code OperationStatusExportProvider}. */
const OPERATION_STATUS_EXPORT_COLUMNS: Record<string, ExcelExportColumnConfig> = {
    COMPANY: {
        headerKey: "operation.col.company",
        widthChars: 40,
    },
    ADDRESS: {
        headerKey: "operation.col.address",
        widthChars: 60,
    },
    OPERATION_STATUS: {
        headerKey: "operation.col.operation_status",
        widthChars: 36,
    },
    LAST_UPDATE: {
        headerKey: "operation.col.last_update",
        format: "datetime",
        widthChars: 22,
    },
};

/** Status-filter dropdown options. Each option's {@code wireValue} is
 *  the raw Vietnamese substring sent as the {@code companyStatus}
 *  query param (legacy parity — backend uses partial-match ILIKE);
 *  {@code labelKey} drives the localised display label. */
type StatusFilterOption = {
    /** {@code null} for "All — no filter". */
    wireValue: string | null;
    labelKey: string;
};

const STATUS_FILTER_OPTIONS: StatusFilterOption[] = [
    { wireValue: null,            labelKey: "operation.filter.all_operation_status" },
    { wireValue: "đang hoạt động", labelKey: "operation.filter.active" },
    { wireValue: "ngừng",          labelKey: "operation.filter.suspended" },
    { wireValue: "tạm",            labelKey: "operation.filter.tam_suspended" },
];

type OperationStatusPageProps = {
    rows: OperationCompanyRow[];
    /** True only while the first fetch is in flight (no response latched
     *  yet). Gates the centered table-body message: loading text while
     *  fetching, "No Data Found" once an empty result has resolved.
     *  Sticky-wrapped by the parent client so the gate is held for the
     *  minimum-visibility window. */
    loading: boolean;
    /** True while a {@code POST .../refresh} batch is in flight (or
     *  held sticky immediately after). Disables Update / Inquire on
     *  the toolbar so a fast resolve can't trigger a duplicate refresh.
     *  Owned by the parent client; threaded through unchanged. */
    updating?: boolean;
    /** Server-reported total. */
    totalCompanies: number;
    /** Server-reported page count. */
    totalPages: number;
    /** Zero-based current page. */
    page: number;
    pageSize: number;
    keyword: string;
    /** Currently-selected status substring (raw Vietnamese), or
     *  {@code null} for "All". */
    companyStatus: string | null;
    sortField: string | null;
    sortDirection: SortDirection;
    sortParams: { sortField: string; sortDirection: "ASC" | "DESC" } | null;
    errorCode: string | null;
    errorMessage: string | null;

    onKeywordChange: (kw: string) => void;
    onCompanyStatusChange: (cs: string | null) => void;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    onSort: (fieldId: string) => void;
    onRefresh: () => void;
    /** Opens the "Inquire Operation Status" popup (Tax ID → Get
     *  Business Info → Save). */
    onInquire: () => void;
    /** Selected tax codes (the row's {@code id}, which is its TAXCODE).
     *  Lifted out of the page so the Update button can target the
     *  selected subset; persists across pagination per the canonical
     *  Account Inquiry pattern. */
    selectedIds: Set<string>;
    onSelectedIdsChange: (next: Set<string>) => void;
};

export default function OperationStatusPage({
    rows: rowsProp,
    loading,
    updating = false,
    totalCompanies,
    totalPages,
    page,
    pageSize,
    keyword,
    companyStatus,
    sortField,
    sortDirection,
    sortParams,
    errorCode,
    errorMessage,
    onKeywordChange,
    onCompanyStatusChange,
    onPageChange,
    onPageSizeChange,
    onSort,
    onRefresh,
    onInquire,
    selectedIds,
    onSelectedIdsChange,
}: OperationStatusPageProps) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();
    const handleExportExcel = useExcelExport();

    /* Local export gate — owned here because the request fires from
     * `handleExport` in this component (not from the parent client).
     * Sticky-wrap keeps the Print + Excel chrome visibly disabled across
     * the minimum-visibility window so a fast cached download can't be
     * triggered twice. */
    const [exporting, setExporting] = useState(false);
    const stickyExporting = useStickyLoading(exporting);

    // Operation Status does NOT adopt View Setting — Figma 12346:109158 has
    // no list-view icon, so the page renders no <ViewSettingPopover> and must
    // NOT call the screen-options API (which would WBE2001 for the unseeded
    // `addon-operation-status` screen). Columns come straight from the static
    // FALLBACK_COLUMNS; Excel export passes the same list to the backend, which
    // exports unseeded screens via the request-columns ∩ provider allow-list
    // path (no SYS_SCR_OPTION_WECMS seed required). To adopt View Setting later,
    // re-introduce useViewSetting + a V156-style seed in the same change.
    const itemsForRender = FALLBACK_COLUMNS;

    const sourceRows = rowsProp ?? EMPTY_ROWS;

    // Row selection state is owned by the parent client so the toolbar
    // Update button can target the selected subset. Set keyed by
    // `row.id` (which is TAXCODE — see `mapOperationCompanyRow`).
    // Persists across pagination per the canonical Account Inquiry
    // pattern; the parent is responsible for clearing.

    // Header checkbox — checked when every visible row on the current
    // page is in the selection set. Indeterminate when some-but-not-all
    // are selected. Ports the legacy "checkbox-all" three-state shape.
    const allOnPageSelected =
        sourceRows.length > 0 && sourceRows.every((r) => selectedIds.has(r.id));
    const someOnPageSelected = sourceRows.some((r) => selectedIds.has(r.id));

    const toggleRow = (id: string, next: boolean) => {
        const out = new Set(selectedIds);
        if (next) out.add(id);
        else out.delete(id);
        onSelectedIdsChange(out);
    };
    const toggleAllOnPage = (next: boolean) => {
        const out = new Set(selectedIds);
        for (const r of sourceRows) {
            if (next) out.add(r.id);
            else out.delete(r.id);
        }
        onSelectedIdsChange(out);
    };

    // Build the visible column list once per items / vs change.
    // CHECKBOX rides through the items but is rendered as a hard-coded
    // column (special FIELD_ID, never customizable).
    const visibleDataColumns = useMemo(() => {
        return itemsForRender
            .filter((it) => it.use_yn === "Y")
            .filter((it) => it.disp_yn !== "N")
            .filter((it) => !isSpecialViewSettingField(it.field_id))
            .filter((it) => Boolean(COLUMN_REGISTRY[it.field_id]))
            .slice()
            .sort((a, b) => a.disp_ord - b.disp_ord);
    }, [itemsForRender]);

    // Surface non-401 backend errors via the global system dialog.
    // Mirror the AccountInquiry pattern. 401s are handled automatically
    // by the global Axios session-expired interceptor.
    const lastSurfacedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!errorCode) {
            lastSurfacedRef.current = null;
            return;
        }
        // Don't re-fire the dialog on every render — only when the code
        // changes. Don't surface 401 / NETWORK errors (handled
        // elsewhere); don't surface validation errors that the user
        // can't act on.
        if (lastSurfacedRef.current === errorCode) return;
        if (errorCode === "WBE_VALIDATION") return;
        lastSurfacedRef.current = errorCode;
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: errorMessage ?? t("common.error.unknown"),
            errorCode,
        });
    }, [errorCode, errorMessage, dialog, t]);

    // Status-filter dropdown popover. Click opens; selection emits the
    // raw Vietnamese substring; outside-click closes.
    const [statusOpen, setStatusOpen] = useState(false);
    const statusFilterLabel = useMemo(() => {
        const found = STATUS_FILTER_OPTIONS.find((o) => o.wireValue === companyStatus);
        return found ? t(found.labelKey) : t("operation.filter.all_operation_status");
    }, [companyStatus, t]);

    const handlePrint = () => {
        const printColumns: PrintColumn<OperationCompanyRow>[] = visibleDataColumns
            .map((col) => buildPrintColumn(col.field_id, t, locale))
            .filter((c): c is PrintColumn<OperationCompanyRow> => c !== null);
        printReport({
            title: t("operation.title"),
            columns: printColumns,
            rows: sourceRows,
        });
    };

    const handleExport = async () => {
        if (exporting) return; // guard against double-click while a download is in flight
        // Convert the wire-shape `sortParams` (`sortField` / `sortDirection`)
        // emitted by `useTableSort()` into the shared `ExcelExportSort`
        // shape (`field` / `direction`). Two different contracts
        // historically — list endpoint accepts `sortField`/`sortDirection`,
        // export endpoint expects `field`/`direction`. Account Inquiry
        // does the same translation inline.
        const sort = sortParams
            ? { field: sortParams.sortField, direction: sortParams.sortDirection }
            : null;
        setExporting(true);
        try {
            await handleExportExcel({
                endpoint: "/api/v1/addon/operation-status/export",
                screenId: SCREEN_IDS.ADDON_OPERATION_STATUS,
                dymAreaId: DEFAULT_AREA_ID,
                fileName: `${t("operation.export_title")}_${todayDmy()}`,
                title: t("operation.title"),
                items: itemsForRender,
                columnConfig: OPERATION_STATUS_EXPORT_COLUMNS,
                t,
                filters: {
                    q: keyword || undefined,
                    companyStatus: companyStatus ?? undefined,
                },
                sort,
            });
        } catch (e: unknown) {
            const code =
                e && typeof e === "object" && "code" in e
                    ? String((e as { code: unknown }).code ?? "WBE9999")
                    : "WBE9999";
            const message =
                e && typeof e === "object" && "message" in e
                    ? String((e as { message: unknown }).message ?? "")
                    : "";
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message || t("common.error.unknown"),
                errorCode: code,
            });
        } finally {
            setExporting(false);
        }
    };

    // Pagination chrome converts between zero-based (server / state)
    // and one-based (display).
    const displayPage = page + 1;
    const displayPageCount = Math.max(1, totalPages);

    return (
        <PageLayout>
            <PageHeader title={t("operation.title")}>
                <OperationStatusActionBar
                    onPrint={handlePrint}
                    onExport={handleExport}
                    onUpdate={onRefresh}
                    onInquire={onInquire}
                    updating={updating}
                    exporting={stickyExporting}
                />
            </PageHeader>

            <FilterRow
                right={
                    <SearchInput value={keyword} onChange={onKeywordChange} />
                }
            >
                <div className="relative">
                    <FilterDropdown
                        value={statusFilterLabel}
                        className="w-[250px]"
                        onClick={() => setStatusOpen((v) => !v)}
                        ariaLabel={t("operation.filter.all_operation_status")}
                    />
                    {statusOpen && (
                        <StatusFilterPopover
                            current={companyStatus}
                            onSelect={(value) => {
                                onCompanyStatusChange(value);
                                setStatusOpen(false);
                            }}
                            onClose={() => setStatusOpen(false)}
                        />
                    )}
                </div>
            </FilterRow>

            <DataTableShell
                footerMode="paginationOnly"
                table={
                    <>
                    <table className="w-full min-w-[960px] table-fixed border-collapse">
                        <colgroup>
                            <col className="w-[66px]" />{/* CHECKBOX */}
                            {visibleDataColumns.map((col) => {
                                const def = COLUMN_REGISTRY[col.field_id];
                                return (
                                    <col
                                        key={col.field_id}
                                        className={def.colClassName}
                                    />
                                );
                            })}
                        </colgroup>
                        <TableHeader className="sticky top-0 z-10">
                            <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                                <TableHead className="px-2.5 text-left">
                                    <Checkbox
                                        className="size-[var(--size-wb-icon-sm)]"
                                        checked={
                                            allOnPageSelected
                                                ? true
                                                : someOnPageSelected
                                                    ? "indeterminate"
                                                    : false
                                        }
                                        onCheckedChange={(v) => toggleAllOnPage(v === true)}
                                        aria-label={t("operation.aria.select_all")}
                                    />
                                </TableHead>
                                {visibleDataColumns.map((col) => {
                                    const def = COLUMN_REGISTRY[col.field_id];
                                    const sortable =
                                        col.sort_yn === "Y" &&
                                        !isSpecialViewSettingField(col.field_id);
                                    return (
                                        <TableHeaderCell
                                            key={col.field_id}
                                            sortFieldId={col.field_id}
                                            activeSortField={sortField}
                                            activeSortDirection={sortDirection}
                                            onSort={onSort}
                                            sortable={sortable}
                                            align={def.align}
                                            textSizeClass="text-wb-13"
                                        >
                                            {t(def.headerKey)}
                                        </TableHeaderCell>
                                    );
                                })}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Render rows directly. While the first fetch
                             *  is in flight (or after an error before the
                             *  client wrapper has latched a stable
                             *  response), `sourceRows` is empty and the
                             *  body renders empty — matching Account
                             *  Inquiry's pattern. We deliberately do NOT
                             *  inject a colSpan loading / empty row here
                             *  because the client wrapper latches the
                             *  previous response across refetches; a
                             *  colSpan replacement would collapse the
                             *  body to a single wide cell on every sort
                             *  / filter change and read as "the table
                             *  got affected" to the user. */}
                            {sourceRows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                                >
                                    <TableCell className="px-2.5 align-middle">
                                        <Checkbox
                                            className="size-[var(--size-wb-icon-sm)]"
                                            checked={selectedIds.has(row.id)}
                                            onCheckedChange={(v) => toggleRow(row.id, v === true)}
                                            aria-label={t("operation.aria.select_row", {
                                                name: row.companyName,
                                            })}
                                        />
                                    </TableCell>
                                    {visibleDataColumns.map((col) => {
                                        const def = COLUMN_REGISTRY[col.field_id];
                                        return (
                                            <TableCell
                                                key={col.field_id}
                                                className={def.cellClassName}
                                            >
                                                {def.renderBody({ row, t, locale })}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                    {/* Centered table-body message — sibling of the <table>
                       inside the shell's `flex min-h-full flex-col` scroll
                       column, so `flex-1` expands to fill the area below the
                       (always-visible) header. Mirrors the VAS Account
                       empty-state pattern. While the first fetch is in flight
                       show the loading text; on a resolved empty result show
                       "No Data Found". */}
                    {sourceRows.length === 0 && (
                        <div className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6">
                            {loading ? t("common.loading") : t("operation.empty")}
                        </div>
                    )}
                    </>
                }
                pagination={
                    <Pagination
                        page={displayPage}
                        pageCount={displayPageCount}
                        pageSize={pageSize}
                        totalLabel={t("common.showing_of", {
                            shown: String(sourceRows.length),
                            total: String(totalCompanies),
                        })}
                        onPageChange={(p) => onPageChange(Math.max(0, p - 1))}
                        onPageSizeChange={onPageSizeChange}
                        className="shrink-0"
                    />
                }
            />
        </PageLayout>
    );
}

function OperationStatusCell({
    status,
    t,
}: {
    status: OperationStatusCode;
    t: (key: string) => string;
}) {
    const tone =
        status === "active_certificate_issued"
            ? "text-wb-status-approved-text"
            : status === "suspended"
                ? "text-wb-status-pending-text"
                : "text-wb-muted";
    return (
        <span className={cn("inline-flex items-center gap-1 text-wb-13 font-medium", tone)}>
            <Check aria-hidden className="size-[18px]" strokeWidth={2.5} />
            <span>{t(`operation.status.${status}`)}</span>
        </span>
    );
}

/** Lightweight popover for the status-filter dropdown. Built inline
 *  rather than via the future shared {@code <FilterPopover>} (TBD)
 *  because the option set is small and fixed. */
function StatusFilterPopover({
    current,
    onSelect,
    onClose,
}: {
    current: string | null;
    onSelect: (value: string | null) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        // Defer until next tick so the trigger's own click doesn't
        // immediately close us via the document handler.
        const timer = window.setTimeout(() => {
            document.addEventListener("mousedown", handleClick);
            document.addEventListener("keydown", handleKey);
        }, 0);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [onClose]);

    return (
        <div
            ref={ref}
            role="listbox"
            className="absolute left-0 top-[calc(100%+4px)] z-20 w-[250px] rounded-md border border-wb-ntrl-4 bg-white py-1 shadow-wb-card"
        >
            {STATUS_FILTER_OPTIONS.map((opt) => {
                const isActive = opt.wireValue === current;
                return (
                    <button
                        key={opt.labelKey}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => onSelect(opt.wireValue)}
                        className={cn(
                            "flex w-full cursor-pointer items-center px-2 py-1.5 text-left text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                            isActive && "bg-wb-bg-active",
                        )}
                    >
                        {t(opt.labelKey)}
                    </button>
                );
            })}
        </div>
    );
}

/** Build a {@link PrintColumn} from a FIELD_ID. Returns {@code null}
 *  when the column has no print renderer (defensive — every seeded
 *  data FIELD_ID has one; CHECKBOX is intentionally skipped). */
function buildPrintColumn(
    fieldId: string,
    t: (key: string, vars?: Record<string, string | number>) => string,
    locale: Locale,
): PrintColumn<OperationCompanyRow> | null {
    const def = COLUMN_REGISTRY[fieldId];
    if (!def) return null;
    return {
        header: t(def.headerKey),
        align: def.align === "right" ? "right" : undefined,
        render: (row) => buildPrintCell(fieldId, row, t, locale),
    };
}

/** Convert a row + FIELD_ID into the print-cell HTML the shared
 *  {@code printReport} helper expects. Mirrors the on-screen rendering
 *  but emits flat strings (no React) — print pipeline does not
 *  auto-escape, so untrusted strings would normally need
 *  {@code escapeHtml}; sourcing the values from typed
 *  {@code OperationCompanyRow} fields guarantees they are plain text
 *  already. */
function buildPrintCell(
    fieldId: string,
    row: OperationCompanyRow,
    t: (key: string, vars?: Record<string, string | number>) => string,
    locale: Locale,
): string {
    switch (fieldId) {
        case "COMPANY":
            return `${row.companyName}<br><span class="muted">${row.taxCode}</span>`;
        case "ADDRESS":
            return row.address;
        case "OPERATION_STATUS":
            return t(`operation.status.${row.status}`);
        case "LAST_UPDATE":
            // Same locale-aware port of `common.app.formatDateLang` the
            // on-screen LAST_UPDATE cell uses, so the printed report and
            // the table render identical strings.
            return formatDateLang(row.lastUpdate, locale) || row.lastUpdate || "";
        default:
            return "";
    }
}
