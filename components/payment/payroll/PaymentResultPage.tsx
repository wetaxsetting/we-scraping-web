"use client";

import { useCallback, useMemo, useState } from "react";

import PaymentResultBatchListPage, {
    type PaymentResultBatchRow,
    type ResultBatchSortable,
    type ResultExtraColumn,
    type ResultStatusColors,
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
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import { useApiData } from "@/lib/api/useApiData";
import { ApiCallError } from "@/lib/api/banking";
import type { ApiTransferResultListResponse, ApiTransferResultRow } from "@/lib/types/api";
import {
    downloadPayrollResultBulkReport,
    downloadPayrollResultReport,
    fetchPayrollPaymentResultList,
} from "@/lib/api/payrollPayment";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { formatRegDtmDisplay } from "@/lib/datetime";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import { type PayrollResultRow } from "./types";

/** Local extension over `PayrollResultRow` so the Payroll-only
 *  "Payroll Type" extra column can render a per-row value from the
 *  shared `extraColumns` slot on `<PaymentResultBatchListPage>`.
 *
 *  Wire backing: `appr_fund_tp` on `ApiTransferResultRow` (the backend
 *  Payroll Result list resolves it from `EXPT_RESOL_MSTR.APPR_FUND_TP`
 *  by `APPR_SEQ_NO`). Carried here as the raw legacy code (`"0"`/`"1"`/…);
 *  the column renders the localized Salary/Bonus label per legacy
 *  `pymn_0006_001.ts:464-467`. */
type PayrollResultRowExt = PayrollResultRow & PaymentResultBatchRow & {
    payrollType: string;
};

/**
 * Payment > Payroll Payment > Payment Result — Figma 27:12877.
 *
 * Server-driven for pagination, sort, period, search, and the
 * Completed / In Progress status filter. Toolbar's list-view icon
 * opens the shared `<ViewSettingPopover>` keyed by
 * `payment-payroll-payment-result` (seeded by V230 — legacy
 * `pymn_0006_001` column set). Print routes through the shared
 * `printReport` helper.
 *
 * Column projection is fully View-Setting-driven: order, visibility,
 * width, sortability come from `sys_scr_option_wecms`. The
 * Payroll-only "Payroll Type" column rides in the shared shell's
 * `extraColumns` slot between Total Transfer Amount and Transfer
 * Status (Figma 27:12877 order).
 */
export default function PayrollPaymentResultPage() {
    const { t, locale } = useTranslation();
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
        SCREEN_IDS.PAYMENT_PAYROLL_PAYMENT_RESULT,
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

    /* ── Map status checkbox state → backend trnf_stts param.
     *    `Y` filter when only "Completed" is checked; `N` filter when
     *    only "In Progress" is checked. Neither (or both) checked
     *    means "no filter" — the backend returns every batch. */
    const trnfStts: "C" | "P" | undefined = useMemo(() => {
        // C2: Completed → 'C', In Progress → 'P' (route-aware PROC_STAT filter).
        if (statusFilter.completed && !statusFilter.in_progress)   return "C";
        if (statusFilter.in_progress && !statusFilter.completed)   return "P";
        return undefined;
    }, [statusFilter]);

    /* ── Data fetch ──────────────────────────────────────────────── */
    const { fromDate, toDate } = useMemo(
        () => periodToWindow(period, manualRange),
        [period, manualRange],
    );
    const state = useApiData(
        () => fetchPayrollPaymentResultList({
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

    /* Stable-data latch + sticky gates. */
    const [stableData, setStableData] = useState<ApiTransferResultListResponse | null>(state.data);
    const [prevData, setPrevData] = useState<ApiTransferResultListResponse | null>(state.data);
    if (state.data !== prevData) {
        setPrevData(state.data);
        if (state.data) setStableData(state.data);
    }

    const rows: PayrollResultRowExt[] = useMemo(
        () => (stableData?.rows ?? []).map(toResultRow),
        [stableData],
    );

    const totals = useMemo(
        () =>
            (stableData?.currency_totals ?? []).map((c) => ({
                currency: c.ccy_cd,
                // formatAmount with symbol — matches Scheduled output.
                amount: formatAmount(c.total_amount, c.ccy_cd, true),
            })),
        [stableData],
    );
    const totalCount = stableData?.total_count ?? rows.length;

    const stickyInitialLoading = useStickyLoading(state.loading && !stableData);
    const [actionInFlight, setActionInFlight] = useState(false);
    const stickyActionInFlight = useStickyLoading(actionInFlight);

    /* ── Print ───────────────────────────────────────────────────── */
    const handlePrint = useCallback(() => {
        const columns: PrintColumn<PayrollResultRowExt>[] = [
            { header: t("payment.internal.col.date_time"),     render: (r) => escapeHtml(r.dateTime.replace(/\n/g, " ")) },
            { header: t("payment.internal.col.file_name"),     render: (r) => escapeHtml(r.fileName) },
            {
                header: t("payment.internal.col.txn_count"),
                align: "right",
                render: (r) => escapeHtml(t("payment.internal.txn_count_with_currency", {
                    count: String(r.txnCount), currency: r.txnCurrency,
                })),
            },
            { header: t("payment.internal.col.total_transfer"),  align: "right", render: (r) => escapeHtml(r.totalAmount) },
            { header: t("payment.payroll.col.payroll_type"),     render: (r) => escapeHtml(r.payrollType) },
            { header: t("payment.internal.col.transfer_status"), render: (r) => escapeHtml(t(`payment.result_status.${r.status}`)) },
            { header: t("payment.internal.col.approval_ref"),    render: (r) => escapeHtml(r.approvalRef) },
            { header: t("payment.internal.col.approval_title"),  render: (r) => escapeHtml(r.approvalTitle) },
        ];
        const summary = t("common.showing_of", {
            shown: String(rows.length),
            total: String(totalCount),
        });
        printReport({
            title: t("payment.payroll.result_title"),
            summary,
            columns,
            rows,
        });
    }, [rows, totalCount, t]);

    /* ── View Setting popover ────────────────────────────────────── */
    const handleListView = useCallback((anchorRect: DOMRect) => {
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_RESULT_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    }, [vs.items]);
    const closeViewSetting = useCallback(() => {
        setVsAnchor(null);
        setVsDraft(null);
    }, []);

    /* ── Toolbar Excel — generates the SAME locale-template 20-column report
     *    (incl. Payroll Type) as the per-row download, but for ALL batches in
     *    the current filter (legacy `pymn_0006_002_r003` bulk-report parity).
     *    `GET /api/v1/payment/payroll-payment/results/report` →
     *    `PayrollPaymentDownloadService.generateBulk`. Replaces the old
     *    from-scratch 7-column `ExcelExportService` summary. */
    const handleExcelExport = useCallback(async () => {
        try {
            await downloadPayrollResultBulkReport(
                {
                    fromDate,
                    toDate,
                    srchWd:   search.trim() || undefined,
                    trnfStts,
                },
                locale,
            );
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
    }, [fromDate, toDate, search, trnfStts, locale, dialog, t]);

    /* ── Per-row download — streams the original uploaded Excel. */
    const handleDownloadRow = useCallback(
        async (row: PayrollResultRowExt) => {
            if (actionInFlight) return;
            setActionInFlight(true);
            try {
                await downloadPayrollResultReport(row.id, locale);
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
            } finally {
                setActionInFlight(false);
            }
        },
        [dialog, t, locale, actionInFlight],
    );

    // Payroll-only extra column — sits between Total Transfer Amount
    // and Transfer Status per Figma 27:12877. The shared shell renders
    // it only when the View Setting seed (V230) ships `APPR_FUND_TP`
    // with `USE_YN='Y'`; sort wires via `sortFieldId` so the same
    // cycle as the canonical columns applies.
    const payrollTypeExtraColumn: ResultExtraColumn<PayrollResultRowExt> = useMemo(
        () => ({
            fieldId:    "APPR_FUND_TP",
            header:     t("payment.payroll.col.payroll_type"),
            // Legacy label map (pymn_0006_001.ts:464-467): "0" → Salary,
            // "1" → Bonus, anything else (incl. "9"/blank) → "". No bank
            // override on the list (that is comm_0195_001 Approval-Details only).
            renderCell: (row) =>
                row.payrollType === "0"
                    ? t("payment.payroll.fund_type.salary")
                    : row.payrollType === "1"
                        ? t("payment.payroll.fund_type.bonus")
                        : "",
            width:      undefined, // shell pulls the live `size` value via widthFor
            sortFieldId: "APPR_FUND_TP",
        }),
        [t],
    );

    return (
        <>
            <PaymentResultBatchListPage<PayrollResultRowExt>
                title={t("payment.payroll.result_title")}
                txnUnitLabel="Transaction"
                // Transfer Status column colours — legacy `pymn_0006_001`
                // parity (cBlue In Progress / cGreen Completed + cGreen
                // success / cRed error count), plain coloured text, no badge.
                // Identical ramp to Vendor / Expense / Internal Transfer.
                statusColors={LEGACY_STATUS_COLORS}
                rows={rows}
                rowDetailHref={(row) =>
                    `/payment/payroll/payment-result/${row.id}`
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
                sortableColumns={SORTABLE_COLUMNS}
                onSort={handleSort}
                onPrint={handlePrint}
                onListView={handleListView}
                onExcelExport={handleExcelExport}
                onDownloadRow={handleDownloadRow}
                viewSettingItems={vs.items.length > 0 ? vs.items : FALLBACK_RESULT_COLUMNS}
                fieldIdMap={FIELD_ID_MAP}
                extraColumns={[payrollTypeExtraColumn]}
                emptyMessage={t("payment.payroll.result_empty")}
                loading={stickyInitialLoading}
                actionInFlight={stickyActionInFlight}
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

/**
 * Mirror of the V230 SYS_SCR_OPTION_WECMS seed for
 * `payment-payroll-payment-result` / `default`. Paint-time fallback used
 * while the API resolves so the table doesn't flash empty and column
 * widths are correct on first paint.
 *
 * Aligned with legacy `pymn_0006_001` PROD widths + FIELD_IDs — Payroll
 * differs from Vendor / Expense / Internal Transfer Result by an extra
 * `APPR_FUND_TP` ("Payroll Type") column inserted at disp_ord 5.
 */
/**
 * Transfer Status column colours — legacy `pymn_0006_001` parity
 * (`.cBlue` In Progress / `.cGreen` Completed + `.cGreen` success /
 * `.cRed` error count), plain coloured text, no badge. Same object the
 * Vendor / Expense / Internal Transfer Result pages pass. Tokens in
 * app/globals.css.
 */
const LEGACY_STATUS_COLORS: ResultStatusColors = {
    inProgressText: "text-brand-active",
    completedText:  "text-wb-status-completed-text",
    successText:    "text-wb-status-completed-text",
    successBadgeBg: "bg-wb-status-completed-text",
    errorText:      "text-wb-status-error-text",
    errorBadgeBg:   "bg-wb-status-error-text",
};

const FALLBACK_RESULT_COLUMNS: ViewSettingItem[] = [
    { field_id: "TRAN_DT",            field_nm: "Date/Time",             disp_ord: 1,  disp_yn: "Y", use_yn: "Y", size: "105px", sort_yn: "Y" },
    { field_id: "FILE_NM",            field_nm: "File Name",             disp_ord: 2,  disp_yn: "Y", use_yn: "Y", size: "290px", sort_yn: "Y" },
    { field_id: "SCDUL_PYMN_DETL_NO", field_nm: "No. of Transactions",   disp_ord: 3,  disp_yn: "Y", use_yn: "Y", size: "155px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",           field_nm: "Total Transfer Amount", disp_ord: 4,  disp_yn: "Y", use_yn: "Y", size: "235px", sort_yn: "Y" },
    { field_id: "APPR_FUND_TP",       field_nm: "Payroll Type",          disp_ord: 5,  disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "PROC_STAT",          field_nm: "Transfer Status",       disp_ord: 6,  disp_yn: "Y", use_yn: "Y", size: "190px", sort_yn: "Y" },
    { field_id: "APPR_DOC_NO",        field_nm: "Approval Ref.",         disp_ord: 7,  disp_yn: "Y", use_yn: "Y", size: "160px", sort_yn: "Y" },
    { field_id: "TITL",               field_nm: "Approval Title",        disp_ord: 8,  disp_yn: "Y", use_yn: "Y", size: "250px", sort_yn: "Y" },
    { field_id: "ETC",                field_nm: "",                      disp_ord: 99, disp_yn: "Y", use_yn: "Y", size: "50px",  sort_yn: "N" },
];

/**
 * FIELD_ID aliases supplied to `<PaymentResultBatchListPage>` so the
 * shell maps each canonical column slot to the legacy V230 FIELD_ID
 * rather than the V131 default. The Payroll-only `APPR_FUND_TP` rides
 * in the `extraColumns` slot — it does NOT belong in this map.
 */
const FIELD_ID_MAP = {
    dateTime:      "TRAN_DT",
    fileName:      "FILE_NM",
    txnCount:      "SCDUL_PYMN_DETL_NO",
    totalAmount:   "TRAN_AMT",
    status:        "PROC_STAT",
    approvalRef:   "APPR_DOC_NO",
    approvalTitle: "TITL",
} as const;

/**
 * Per-column FIELD_ID map for the shared shell. APPR_FUND_TP is the
 * extra column's own `sortFieldId` (declared on the
 * `payrollTypeExtraColumn` object); it does NOT belong in
 * `sortableColumns` because the keys here are the shell's fixed
 * canonical slots, not extra-column ids.
 */
const SORTABLE_COLUMNS: ResultBatchSortable = {
    DATE_TIME:      "TRAN_DT",
    FILE_NAME:      "FILE_NM",
    TXN_COUNT:      "SCDUL_PYMN_DETL_NO",
    TOTAL_AMOUNT:   "TRAN_AMT",
    STATUS:         "PROC_STAT",
    APPROVAL_REF:   "APPR_DOC_NO",
    APPROVAL_TITLE: "TITL",
};


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
 * Map a wire row onto the Payroll Payment Result list-page row shape.
 * Status follows the legacy two-status rule (`pymn_0006_001.ts:493-499`):
 * in_progress until the batch dispatches AND succ+err meet total.
 *
 * `appr_fund_tp` (Payroll Type) is resolved server-side from
 * `EXPT_RESOL_MSTR.APPR_FUND_TP` (legacy `pymn_0006_001` list) and carried
 * on `ApiTransferResultRow`. Stored here as the raw legacy code; the column
 * renders the Salary/Bonus label.
 */
function toResultRow(api: ApiTransferResultRow): PayrollResultRowExt {
    // Legacy two-status rule (pymn_0006_001.ts:493-499 reads PROC_STAT
    // directly, but semantically equivalent to the count math used by
    // the other 3 Result pages — succ+err < total iff the batch hasn't
    // settled yet, regardless of source field).
    const succ  = Number(api.tot_trns_succ_cnt  ?? "0") || 0;
    const err   = Number(api.tot_trns_error_cnt ?? "0") || 0;
    const total = Number(api.tot_trns_cnt       ?? "0") || 0;
    const isInProgress = api.trnf_stts !== "Y" || (succ + err) < total;
    const status: "completed" | "in_progress" = isInProgress ? "in_progress" : "completed";
    return {
        id:            api.scdul_pymn_no,
        dateTime:      formatRegDtm(api.reg_dtm),
        dateTimeRaw:   api.reg_dtm ?? undefined,
        // File Name = ORG_FILE_NM (api.file_nm) — the uploaded Excel name,
        // distinct from `titl` (the approval-request title). Mirrors Vendor.
        fileName:      api.file_nm ?? api.titl,
        txnCount:      total,
        txnCurrency:   api.ccy_cd,
        // Raw wire decimal — shell re-formats via formatAmount.
        totalAmount:   String(api.total_tran_amt ?? "0"),
        status,
        successCount:  status === "completed" ? succ : undefined,
        failedCount:   status === "completed" ? err  : undefined,
        approvalRef:   api.doc_no ?? "",
        // F4b — appr_seq_no keys the shared Approval Details popup (legacy
        // comm_0195_001). Null when the batch has no approval → cell stays text.
        approvalRefId: api.appr_seq_no ?? null,
        approvalTitle: api.titl,
        fromBank:      "",
        payrollType:   api.appr_fund_tp ?? "",
    };
}

function formatRegDtm(raw: string | null | undefined): string {
    return formatRegDtmDisplay(raw);
}
