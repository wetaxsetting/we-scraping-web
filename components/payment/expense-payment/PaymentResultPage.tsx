"use client";

import { useCallback, useMemo, useState } from "react";

import PaymentResultBatchListPage, {
    type PaymentResultBatchRow,
    type ResultStatusFilter,
} from "@/components/payment/shared/PaymentResultBatchListPage";
import type {
    ManualDateRange,
    PeriodKey,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useExcelExport, type ExcelExportColumnConfig } from "@/hooks/useExcelExport";
import { useTableSort } from "@/hooks/useTableSort";
import { ApiCallError } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import {
    downloadOriginalExpenseExcel,
    fetchExpensePaymentResultList,
} from "@/lib/api/expensePayment";
import { formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { formatRegDtmDisplay } from "@/lib/datetime";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import { type ExpenseResultRow } from "./mockData";

/**
 * Payment > Expense Payment > Payment Result — Figma 25:9221.
 *
 * Server-driven for pagination, sort, period, search, and the
 * Completed / In Progress status filter. Toolbar's list-view icon
 * opens the shared `<ViewSettingPopover>` keyed by
 * `payment-expense-payment-result` (seeded by V143). Print routes
 * through the shared `printReport` helper.
 *
 * Mirrors the Payroll Result page wiring pattern (CLAUDE.md §12a).
 */
export default function ExpensePaymentResultPage() {
    const { t } = useTranslation();
    const dialog = useDialog();

    /* ── Toolbar / filter / pagination state ─────────────────────── */
    const [page, setPage]         = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [period, setPeriod]     = useState<PeriodKey>("30d");
    const [manualRange, setManualRange] = useState<ManualDateRange | undefined>(
        undefined,
    );
    const [search, setSearch]     = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<ResultStatusFilter>({
        completed:   false,
        in_progress: false,
    });

    const sort = useTableSort();

    /* ── View Setting popover state ──────────────────────────────── */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_EXPENSE_PAYMENT_RESULT,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft]   = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    /* ── Filter-change resets ────────────────────────────────────── */
    function changePeriod(next: PeriodKey)            { setPeriod(next);   setPage(0); }
    function changePageSize(next: number)             { setPageSize(next); setPage(0); }
    function changeSearch(next: string)               { setSearch(next);   setPage(0); }
    function changeStatusFilter(next: ResultStatusFilter) {
        setStatusFilter(next);
        setPage(0);
    }
    function handleSort(fieldId: string) {
        sort.toggleSort(fieldId);
        setPage(0);
    }

    const trnfStts: "Y" | "N" | undefined = useMemo(() => {
        if (statusFilter.completed && !statusFilter.in_progress)   return "Y";
        if (statusFilter.in_progress && !statusFilter.completed)   return "N";
        return undefined;
    }, [statusFilter]);

    const { fromDate, toDate } = useMemo(
        () => periodToWindow(period, manualRange),
        [period, manualRange],
    );
    const state = useApiData(
        () => fetchExpensePaymentResultList({
            fromDate,
            toDate,
            srchWd:        search.trim() || undefined,
            trnfStts,
            page,
            size:          pageSize,
            sortField:     sort.sortParams?.sortField,
            sortDirection: sort.sortParams?.sortDirection,
        }),
        [
            fromDate, toDate, search, trnfStts,
            page, pageSize,
            sort.sortField, sort.sortDirection,
        ],
    );

    const rows: Array<ExpenseResultRow & PaymentResultBatchRow> = useMemo(
        () => (state.data?.rows ?? []).map(toResultRow),
        [state.data],
    );

    const totals = useMemo(
        () =>
            (state.data?.currency_totals ?? []).map((c) => ({
                currency: c.ccy_cd,
                amount: formatNumber(c.total_amount),
            })),
        [state.data],
    );
    const totalCount = state.data?.total_count ?? rows.length;

    const handlePrint = useCallback(() => {
        const columns: PrintColumn<ExpenseResultRow & PaymentResultBatchRow>[] = [
            { header: t("payment.internal.col.date_time"),     render: (r) => escapeHtml(r.dateTime.replace(/\n/g, " ")) },
            { header: t("payment.internal.col.file_name"),     render: (r) => escapeHtml(r.fileName) },
            {
                header: t("payment.internal.col.txn_count"),
                align: "right",
                render: (r) => escapeHtml(t("payment.internal.txn_count_with_currency", {
                    count: String(r.txnCount), currency: r.txnCurrency,
                })),
            },
            { header: t("payment.internal.col.total_transfer"), align: "right", render: (r) => escapeHtml(r.totalAmount) },
            { header: t("payment.internal.col.transfer_status"), render: (r) => escapeHtml(t(`payment.result_status.${r.status}`)) },
            { header: t("payment.internal.col.approval_ref"),   render: (r) => escapeHtml(r.approvalRef) },
            { header: t("payment.internal.col.approval_title"), render: (r) => escapeHtml(r.approvalTitle) },
        ];
        const summary = t("common.showing_of", {
            shown: String(rows.length),
            total: String(totalCount),
        });
        printReport({
            title: t("payment.expense.result_title"),
            summary,
            columns,
            rows,
        });
    }, [rows, totalCount, t]);

    const handleListView = useCallback((anchorRect: DOMRect) => {
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_RESULT_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    }, [vs.items]);
    const closeViewSetting = useCallback(() => {
        setVsAnchor(null);
        setVsDraft(null);
    }, []);

    const exportXlsx = useExcelExport();
    const handleExcelExport = useCallback(async () => {
        try {
            await exportXlsx({
                endpoint:     "/api/v1/payment/expense-payment/results/export",
                screenId:     SCREEN_IDS.PAYMENT_EXPENSE_PAYMENT_RESULT,
                dymAreaId:    DEFAULT_AREA_ID,
                fileName:     `${t("payment.expense.result_title")}_${todayDmy()}`,
                title:        t("payment.expense.result_title"),
                items:        vs.items.length > 0 ? vs.items : FALLBACK_RESULT_COLUMNS,
                columnConfig: RESULT_EXPORT_COLUMNS,
                t,
                filters: {
                    fromDate,
                    toDate,
                    srchWd:   search.trim() || undefined,
                    trnfStts,
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

    /* ── Per-row download — streams the original uploaded Excel. */
    const handleDownloadRow = useCallback(
        async (row: ExpenseResultRow & PaymentResultBatchRow) => {
            try {
                await downloadOriginalExpenseExcel(row.id);
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

    return (
        <>
            <PaymentResultBatchListPage<ExpenseResultRow & PaymentResultBatchRow>
                title={t("payment.expense.result_title")}
                rows={rows}
                rowDetailHref={(row) =>
                    `/payment/expense-payment/payment-result/${row.id}`
                }
                totals={totals}
                period={period}
                onPeriodChange={changePeriod}
                manualRange={manualRange}
                onManualRangeChange={(r) => {
                    setManualRange(r);
                    setPage(0);
                }}
                search={search}
                onSearchChange={changeSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={changeStatusFilter}
                pagination={{
                    page,
                    pageSize,
                    totalCount,
                    onPageChange:     setPage,
                    onPageSizeChange: changePageSize,
                }}
                sort={{ field: sort.sortField, direction: sort.sortDirection }}
                onSort={handleSort}
                onPrint={handlePrint}
                onListView={handleListView}
                onExcelExport={handleExcelExport}
                onDownloadRow={handleDownloadRow}
                viewSettingItems={vs.items.length > 0 ? vs.items : FALLBACK_RESULT_COLUMNS}
            />
            {vsAnchor && vsDraft && (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={(next) => setVsDraft(next)}
                    getLabel={(item) => item.field_nm || item.field_id}
                    onSave={async () => {
                        try { await vs.save(vsDraft); }
                        finally { closeViewSetting(); }
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

/** Paint-time fallback for the View Setting popover (mirrors V143 seed). */
const FALLBACK_RESULT_COLUMNS: ViewSettingItem[] = [
    { field_id: "REG_DTM",        field_nm: "Date / Time",           disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "150px", sort_yn: "Y" },
    { field_id: "TITL",           field_nm: "File Name",             disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "240px", sort_yn: "Y" },
    { field_id: "TOT_TRNS_CNT",   field_nm: "No. of Transactions",   disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "TOTAL_TRAN_AMT", field_nm: "Total Transfer Amount", disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "TRNF_YN",        field_nm: "Transfer Status",       disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "APPR_SEQ_NO",    field_nm: "Approval Ref.",         disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "DOC_NO",         field_nm: "Doc No.",               disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "ETC",            field_nm: "",                      disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "60px",  sort_yn: "N" },
];

const RESULT_EXPORT_COLUMNS: Record<string, ExcelExportColumnConfig> = {
    REG_DTM:        { headerKey: "payment.internal.col.date_time",       format: "text" },
    TITL:           { headerKey: "payment.internal.col.file_name",       format: "text", widthChars: 40 },
    TOT_TRNS_CNT:   { headerKey: "payment.internal.col.txn_count",       format: "number", align: "right" },
    TOTAL_TRAN_AMT: { headerKey: "payment.internal.col.total_transfer",  format: "amount", align: "right" },
    TRNF_YN:        { headerKey: "payment.internal.col.transfer_status", format: "text" },
    APPR_SEQ_NO:    { headerKey: "payment.internal.col.approval_ref",    format: "text" },
    DOC_NO:         { headerKey: "payment.internal.col.doc_no",          format: "text" },
};

function todayDmy(): string {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`;
}

/** PeriodKey → backend `from_date` / `to_date` window (yyyyMMdd). */
function periodToWindow(
    period: PeriodKey,
    manualRange: ManualDateRange | undefined,
): { fromDate: string; toDate: string } {
    const fmt = (d: Date): string => {
        const yyyy = d.getFullYear().toString().padStart(4, "0");
        const mm   = (d.getMonth() + 1).toString().padStart(2, "0");
        const dd   = d.getDate().toString().padStart(2, "0");
        return `${yyyy}${mm}${dd}`;
    };
    if (period === "manual" && manualRange) {
        return manualRange;
    }
    const days = period === "180d" ? 180 : period === "90d" ? 90 : 30;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    return { fromDate: fmt(start), toDate: fmt(today) };
}

/**
 * Map a wire row onto the Expense Payment Result list-page row shape.
 * Status follows the legacy two-status rule (`pymn_0004_001.ts:449-455`):
 * in_progress until the batch dispatches AND succ+err meet total.
 */
function toResultRow(api: {
    scdul_pymn_no:      string;
    titl:               string;
    appr_seq_no:        string | null;
    total_tran_amt:     string;
    tot_trns_cnt:       string;
    tot_trns_succ_cnt:  string | null;
    tot_trns_error_cnt: string | null;
    trnf_stts:          string | null;
    reg_dtm:            string;
    ccy_cd:             string;
}): ExpenseResultRow & PaymentResultBatchRow {
    const succ  = Number(api.tot_trns_succ_cnt  ?? "0") || 0;
    const err   = Number(api.tot_trns_error_cnt ?? "0") || 0;
    const total = Number(api.tot_trns_cnt       ?? "0") || 0;
    const isInProgress = api.trnf_stts !== "Y" || (succ + err) < total;
    const status: "completed" | "in_progress" = isInProgress ? "in_progress" : "completed";
    return {
        id:            api.scdul_pymn_no,
        dateTime:      formatRegDtm(api.reg_dtm),
        fileName:      api.titl,
        txnCount:      total,
        txnCurrency:   api.ccy_cd,
        totalAmount:   formatNumber(api.total_tran_amt),
        status,
        successCount:  status === "completed" ? succ : undefined,
        failedCount:   status === "completed" ? err  : undefined,
        approvalRef:   api.appr_seq_no ?? "",
        approvalTitle: api.titl,
        fromBank:      "",
    };
}

function formatRegDtm(raw: string | null | undefined): string {
    return formatRegDtmDisplay(raw);
}
