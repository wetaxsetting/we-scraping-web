"use client";

import { useCallback, useMemo, useState } from "react";

import PaymentResultBatchListPage, {
    type PaymentResultBatchRow,
    type ResultBatchSortable,
    type ResultStatusFilter,
} from "@/components/payment/shared/PaymentResultBatchListPage";
import type { PeriodKey } from "@/components/payment/shared/PaymentScheduledBatchListPage";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { ApiCallError } from "@/lib/api/banking";
import { downloadOriginalExcel, fetchTransferResultList } from "@/lib/api/internalTransfer";
import {
    mapTransferResultList,
    type TransferResultRow,
} from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { formatNumber } from "@/lib/currency";
import { useExcelExport, type ExcelExportColumnConfig } from "@/hooks/useExcelExport";
import { useTableSort } from "@/hooks/useTableSort";
import { useTranslation } from "@/lib/i18n";
import { formatRegDtmDisplay } from "@/lib/datetime";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import { type InternalResultRow } from "./mockData";

/**
 * Payment > Internal Transfer > Transfer Result — Figma 1:11730.
 *
 * Mirrors legacy `pymn_0010_001_r001` (Phase A read path). Composes the
 * shared `<PaymentResultBatchListPage>` (CLAUDE.md §12a) with full
 * server-driven wiring: period dropdown, status checkboxes, search,
 * sort, pagination, View Setting popover, and Print all reset the page
 * to 0 and re-fire the list call.
 *
 * <p>Excel export is wired to a "coming soon" notice — backend
 * `POST /api/v1/payment/internal-transfer/results/export` hasn't shipped
 * yet (see CLAUDE.md §13b for the contract). Flip to `useExcelExport`
 * the moment the provider lands; no other change required.
 *
 * <p>Internal Transfer Result is the only Payment Result variant exempt
 * from the totals footer per CLAUDE.md §12a — Figma 1:11730 shows
 * pagination only. Every other Result page (Vendor / Expense / Payroll /
 * Overseas) supplies a `totals` array.
 */
export default function TransferResultPage() {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [period, setPeriod] = useState<PeriodKey>("30d");
    const [statusFilter, setStatusFilter] = useState<ResultStatusFilter>({
        completed: false,
        in_progress: false,
    });
    const [search, setSearch] = useState<string>("");
    const sort = useTableSort();

    // View Setting state — mirrors the canonical Account Inquiry pattern
    // (CLAUDE.md §13). The hook loads `vs.items` keyed by the V113-seeded
    // FIELD_IDs for `payment-internal-transfer-result`; the shell's
    // `viewSettingItems` prop gates each column's <col>/<th>/<td> by
    // `USE_YN === "Y"`.
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_RESULT,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    // Reset to page 0 whenever the filter / sort / size changes so the
    // user doesn't land on a now-out-of-range page after the result
    // count shrinks. Mirrors the legacy `fn_loadData(option=true)`
    // reset documented in wecms-web-main CLAUDE.md §4.
    function changePeriod(next: PeriodKey) {
        setPeriod(next);
        setPage(0);
    }
    function changePageSize(next: number) {
        setPageSize(next);
        setPage(0);
    }
    function handleSort(fieldId: string) {
        sort.toggleSort(fieldId);
        setPage(0);
    }
    function changeSearch(next: string) {
        setSearch(next);
        setPage(0);
    }
    function changeStatusFilter(next: ResultStatusFilter) {
        setStatusFilter(next);
        setPage(0);
    }

    const { fromDate, toDate } = useMemo(() => periodToWindow(period), [period]);
    // Derive the backend `trnf_stts` param from the checkbox group.
    // Both unchecked OR both checked = no filter; one checked = bias.
    const trnfStts: "Y" | "N" | undefined = useMemo(() => {
        if (statusFilter.completed && !statusFilter.in_progress) return "Y";
        if (statusFilter.in_progress && !statusFilter.completed) return "N";
        return undefined;
    }, [statusFilter]);

    const state = useApiData(
        () =>
            fetchTransferResultList({
                fromDate,
                toDate,
                srchWd: search.trim() || undefined,
                trnfStts,
                page,
                size: pageSize,
                sortField: sort.sortParams?.sortField,
                sortDirection: sort.sortParams?.sortDirection,
            }).then(mapTransferResultList),
        [
            fromDate,
            toDate,
            search,
            trnfStts,
            page,
            pageSize,
            sort.sortField,
            sort.sortDirection,
        ],
    );

    const rows: Array<InternalResultRow & PaymentResultBatchRow> = (
        state.data?.rows ?? []
    ).map(toListRow);
    const totalCount = state.data?.totalCount ?? 0;

    // Print → opens a clean popup with the 7 data columns rendered from
    // the current `rows`. Mirrors the Scheduled page's `handlePrint` /
    // `printReport` pattern per CLAUDE.md §6d — never calls
    // window.print() on the live DOM.
    const handlePrint = useCallback(() => {
        const columns: PrintColumn<InternalResultRow & PaymentResultBatchRow>[] = [
            {
                header: t("payment.internal.col.date_time"),
                render: (r) => escapeHtml(r.dateTime.replace(/\n/g, " ")),
            },
            {
                header: t("payment.internal.col.file_name"),
                render: (r) => escapeHtml(r.fileName),
            },
            {
                header: t("payment.internal.col.txn_count"),
                align: "right",
                render: (r) =>
                    escapeHtml(`${r.txnCount} Trx (${r.txnCurrency})`),
            },
            {
                header: t("payment.internal.col.total_transfer"),
                align: "right",
                render: (r) => escapeHtml(r.totalAmount),
            },
            {
                header: t("payment.internal.result.col.transfer_status"),
                render: (r) =>
                    escapeHtml(
                        r.status === "completed"
                            ? t("payment.internal.result.status.completed")
                            : t("payment.internal.result.status.in_progress"),
                    ),
            },
            {
                header: t("payment.internal.col.approval_ref"),
                render: (r) => escapeHtml(r.approvalRef),
            },
            {
                header: t("payment.internal.col.approval_title"),
                render: (r) => escapeHtml(r.approvalTitle),
            },
        ];
        const summary = t("common.showing_of", {
            shown: String(rows.length),
            total: String(totalCount),
        });
        printReport({
            title: t("payment.internal.result_title"),
            summary,
            columns,
            rows,
        });
    }, [rows, totalCount, t]);

    // List-icon → open View Setting popover anchored to the trigger.
    // Snapshot `vs.items` into a local draft so checkbox / reorder
    // edits stay reversible until Save. Mirrors the canonical Account
    // Inquiry reference (CLAUDE.md §13).
    const handleListView = useCallback(
        (anchorRect: DOMRect) => {
            const seed = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
            setVsDraft(seed.map((it) => ({ ...it })));
            setVsAnchor(anchorRect);
        },
        [vs.items],
    );
    const closeViewSetting = useCallback(() => {
        setVsAnchor(null);
        setVsDraft(null);
    }, []);

    // Excel export — shared `useExcelExport` hook POSTs the filter +
    // sort + View Setting context to the backend
    // `POST /api/v1/payment/internal-transfer/results/export`, which
    // re-runs the same query as the list endpoint and streams XLSX
    // bytes back. Backend provider:
    // `InternalTransferResultExportProvider` (CLAUDE.md §13b).
    const exportXlsx = useExcelExport();
    const handleExcelExport = useCallback(async () => {
        try {
            await exportXlsx({
                endpoint:     "/api/v1/payment/internal-transfer/results/export",
                screenId:     SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_RESULT,
                dymAreaId:    DEFAULT_AREA_ID,
                fileName:     `${t("payment.internal.result_title")}_${todayDmy()}`,
                title:        t("payment.internal.result_title"),
                items:        vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS,
                columnConfig: RESULT_EXPORT_COLUMNS,
                t,
                filters: {
                    fromDate,
                    toDate,
                    srchWd:   search.trim() || undefined,
                    trnfStts: trnfStts,
                },
                sort: sort.sortField && sort.sortDirection
                    ? { field: sort.sortField, direction: sort.sortDirection }
                    : null,
            });
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const message = err instanceof ApiCallError
                ? err.message
                : t("payment.internal.transfer_failed");
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        }
    }, [exportXlsx, vs.items, fromDate, toDate, search, trnfStts, sort.sortField, sort.sortDirection, dialog, t]);

    // Per-row download — streams the original Excel uploaded with the
    // batch. Mirrors the Scheduled list's download handler. Legacy
    // DEV-imported batches without a `save_file_nm` surface as
    // WBE2069; treat that as a "file unavailable" warning rather than
    // a hard error.
    const handleDownloadRow = useCallback(
        async (row: InternalResultRow & PaymentResultBatchRow) => {
            try {
                await downloadOriginalExcel(row.id);
            } catch (err) {
                if (err instanceof ApiCallError) {
                    dialog.open({
                        type:        err.code === "WBE2069" ? "warning" : "error",
                        title:       err.code === "WBE2069"
                            ? t("dialog.warning")
                            : t("dialog.error"),
                        description: err.message,
                        errorCode:   err.code,
                    });
                    return;
                }
                dialog.open({
                    type:        "error",
                    title:       t("dialog.error"),
                    description: t("payment.internal.download_failed"),
                });
            }
        },
        [dialog, t],
    );

    // Calendar icon — custom date-range picker isn't built yet (the
    // period dropdown's three presets carry the page today). Surface a
    // warning notice so the click has visible feedback. Replace with a
    // real popover when the date-range component lands.
    const handleCalendarClick = useCallback(() => {
        dialog.open({
            type: "warning",
            title: t("dialog.warning"),
            description: t("payment.internal.calendar_coming_soon"),
        });
    }, [dialog, t]);

    return (
        <>
            <PaymentResultBatchListPage<InternalResultRow & PaymentResultBatchRow>
                title={t("payment.internal.result_title")}
                rows={rows}
                rowDetailHref={(row) =>
                    `/payment/internal-transfer/transfer-result/${row.id}`
                }
                period={period}
                onPeriodChange={changePeriod}
                search={search}
                onSearchChange={changeSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={changeStatusFilter}
                pagination={{
                    page,
                    pageSize,
                    totalCount,
                    onPageChange: setPage,
                    onPageSizeChange: changePageSize,
                }}
                sort={{
                    field: sort.sortField,
                    direction: sort.sortDirection,
                }}
                sortableColumns={SORTABLE_COLUMNS}
                onSort={handleSort}
                onPrint={handlePrint}
                onListView={handleListView}
                onExcelExport={handleExcelExport}
                onDownloadRow={handleDownloadRow}
                onCalendarClick={handleCalendarClick}
                viewSettingItems={
                    vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS
                }
            />
            {vsAnchor && vsDraft && (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={(next) => setVsDraft(next)}
                    getLabel={(item) => item.field_nm || item.field_id}
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

/**
 * Mirror of the V113 SYS_SCR_OPTION_WECMS seed for
 * `payment-internal-transfer-result` / `default`. Used as the paint-time
 * fallback while the API resolves so the table doesn't flash empty.
 * The authoritative config still comes from the backend; this exists
 * only to bridge first-render.
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "REG_DTM",        field_nm: "Date / Time",           disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "150px", sort_yn: "Y" },
    { field_id: "TITL",           field_nm: "File Name",             disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "240px", sort_yn: "Y" },
    { field_id: "TOT_TRNS_CNT",   field_nm: "No. of Transactions",   disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "TOTAL_TRAN_AMT", field_nm: "Total Transfer Amount", disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "TRNF_YN",        field_nm: "Transfer Status",       disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "APPR_SEQ_NO",    field_nm: "Approval Ref.",         disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "DOC_NO",         field_nm: "Doc No.",               disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "ETC",            field_nm: "",                      disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "60px",  sort_yn: "N" },
];

/**
 * Per-column metadata for the shared {@link useExcelExport} hook. Each
 * entry maps a View Setting FIELD_ID to its header i18n key + write
 * format. The keys match the backend
 * `PaymentResultExportProvider.ALLOWED_FIELD_IDS` allow-list — anything
 * not listed here is dropped by the writer.
 */
const RESULT_EXPORT_COLUMNS: Record<string, ExcelExportColumnConfig> = {
    REG_DTM:        { headerKey: "payment.internal.col.date_time",       format: "text" },
    TITL:           { headerKey: "payment.internal.col.file_name",       format: "text", widthChars: 40 },
    TOT_TRNS_CNT:   { headerKey: "payment.internal.col.txn_count",       format: "number", align: "right" },
    TOTAL_TRAN_AMT: { headerKey: "payment.internal.col.total_transfer",  format: "amount", align: "right" },
    TRNF_YN:        { headerKey: "payment.internal.col.transfer_status", format: "text" },
    APPR_SEQ_NO:    { headerKey: "payment.internal.col.approval_ref",    format: "text" },
    DOC_NO:         { headerKey: "payment.internal.col.doc_no",         format: "text" },
};

/** Today as `DDMMYYYY` (no separators) — same convention as the
 *  Account Inquiry export filename suffix (CLAUDE.md §13b). */
function todayDmy(): string {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear());
    return `${dd}${mm}${yy}`;
}

/**
 * Per-column FIELD_ID map. Keys are the stable column identifiers the
 * shared shell understands; values are the backend
 * `InternalTransferResultSortField` enum names.
 */
const SORTABLE_COLUMNS: ResultBatchSortable = {
    DATE_TIME:      "REG_DTM",
    FILE_NAME:      "TITL",
    TXN_COUNT:      "TOT_TRNS_CNT",
    TOTAL_AMOUNT:   "TOTAL_TRAN_AMT",
    STATUS:         "TRNF_YN",
    APPROVAL_REF:   "APPR_SEQ_NO",
    APPROVAL_TITLE: "TITL",
};

/* ----------------------------------------------------------------------------
 *  Wire row → list-page row adapter
 *
 *  Backend Phase A populates the core fields; success/failed counters
 *  come from `tot_trns_succ_cnt` / `tot_trns_error_cnt` when present.
 *  Status derives from `trnfStts` — `'Y'` (fully dispatched) reads as
 *  "completed"; anything else reads as "in_progress" so the user sees
 *  the orange in-progress label and no count pills.
 * -------------------------------------------------------------------------- */

function toListRow(
    api: TransferResultRow,
): InternalResultRow & PaymentResultBatchRow {
    // Legacy two-status rule (pymn_0010_001.ts:371-378): a batch reads as
    // "in_progress" while it hasn't dispatched OR while the dispatch-table
    // counts haven't settled. Once dispatched AND succ+err meet total,
    // it flips to "completed" and the chips render.
    const succ  = parseCount(api.totTrnsSuccCnt)  ?? 0;
    const err   = parseCount(api.totTrnsErrorCnt) ?? 0;
    const total = parseCount(api.totTrnsCnt)      ?? 0;
    const isInProgress = api.trnfStts !== "Y" || (succ + err) < total;
    const status: PaymentResultBatchRow["status"] = isInProgress ? "in_progress" : "completed";
    return {
        id:            api.scdulPymnNo,
        dateTime:      formatRegDtm(api.regDtm),
        fileName:      api.titl,
        txnCount:      total,
        txnCurrency:   api.ccyCd,
        totalAmount:   formatNumber(api.totalTranAmt),
        status,
        successCount:  status === "completed" ? succ : undefined,
        failedCount:   status === "completed" ? err  : undefined,
        approvalRef:   api.apprSeqNo ?? "",
        approvalTitle: api.titl,
        // Withdrawal bank lives on the detail wire shape, not the list
        // row — keep blank here, detail page fills it in.
        fromBank:      "",
    };
}

function parseCount(raw: string | null | undefined): number | undefined {
    if (raw == null || raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
}

/**
 * `yyyyMMddHHmmss` (14 chars, UTC) → two-line `"DD-MM-YYYY\nHH:mm:ss"`.
 * Matches the Scheduled-page formatter so both lists render the timestamp
 * column identically. Falls back to the raw string when the wire value
 * isn't the expected length so we never throw.
 */
function formatRegDtm(raw: string | null | undefined): string {
    return formatRegDtmDisplay(raw);
}

/**
 * Map a {@link PeriodKey} to the backend `from_date / to_date` window.
 * Always ends today; start is N days back. Output format is
 * `yyyyMMdd` per the controller's `@RequestParam` contract.
 */
function periodToWindow(period: PeriodKey): { fromDate: string; toDate: string } {
    const fmt = (d: Date): string => {
        const yyyy = d.getFullYear().toString().padStart(4, "0");
        const mm   = (d.getMonth() + 1).toString().padStart(2, "0");
        const dd   = d.getDate().toString().padStart(2, "0");
        return `${yyyy}${mm}${dd}`;
    };
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    return { fromDate: fmt(start), toDate: fmt(today) };
}
