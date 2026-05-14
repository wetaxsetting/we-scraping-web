"use client";

import { useCallback, useMemo, useState } from "react";

import PaymentResultBatchListPage, {
    type PaymentResultBatchRow,
    type ResultStatusFilter,
} from "@/components/payment/shared/PaymentResultBatchListPage";
import type { PeriodKey } from "@/components/payment/shared/PaymentScheduledBatchListPage";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useTableSort } from "@/hooks/useTableSort";
import { useApiData } from "@/lib/api/useApiData";
import { fetchPayrollPaymentResultList } from "@/lib/api/payrollPayment";
import { formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import { payrollResultRows, type PayrollResultRow } from "./mockData";

/**
 * Payment > Payroll Payment > Payment Result — Figma 27:12877.
 *
 * Server-driven for pagination, sort, period, search, and the
 * Completed / In Progress status filter. Toolbar's list-view icon
 * opens the shared `<ViewSettingPopover>` keyed by
 * `payment-payroll-payment-result` (seeded by V144). Print routes
 * through the shared `printReport` helper.
 */
export default function PayrollPaymentResultPage() {
    const { t } = useTranslation();
    const dialog = useDialog();

    /* ── Toolbar / filter / pagination state ─────────────────────── */
    const [page, setPage]         = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [period, setPeriod]     = useState<PeriodKey>("30d");
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
    const trnfStts: "Y" | "N" | undefined = useMemo(() => {
        if (statusFilter.completed && !statusFilter.in_progress)   return "Y";
        if (statusFilter.in_progress && !statusFilter.completed)   return "N";
        return undefined;
    }, [statusFilter]);

    /* ── Data fetch ──────────────────────────────────────────────── */
    const { fromDate, toDate } = useMemo(() => periodToWindow(period), [period]);
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

    const rows: Array<PayrollResultRow & PaymentResultBatchRow> = useMemo(() => {
        const apiRows = (state.data?.rows ?? []).map(toResultRow);
        return apiRows.length > 0 ? apiRows : (payrollResultRows as Array<
            PayrollResultRow & PaymentResultBatchRow
        >);
    }, [state.data]);

    const totals = useMemo(
        () =>
            (state.data?.currency_totals ?? []).map((c) => ({
                currency: c.ccy_cd,
                amount: formatNumber(c.total_amount),
            })),
        [state.data],
    );
    const totalCount = state.data?.total_count ?? rows.length;

    /* ── Print ───────────────────────────────────────────────────── */
    const handlePrint = useCallback(() => {
        const columns: PrintColumn<PayrollResultRow & PaymentResultBatchRow>[] = [
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

    /* ── Excel export — Phase B stub via the shared dialog. ─────── */
    const handleExcelExport = useCallback(() => {
        dialog.open({
            type: "warning",
            title: t("dialog.warning"),
            description: t("payment.request_approval.coming_soon"),
        });
    }, [dialog, t]);

    return (
        <>
            <PaymentResultBatchListPage<PayrollResultRow & PaymentResultBatchRow>
                title={t("payment.payroll.result_title")}
                rows={rows}
                rowDetailHref={(row) =>
                    `/payment/payroll/payment-result/${row.id}`
                }
                totals={totals.length > 0 ? totals : [{ currency: "VND", amount: "1.702.000.000đ" }]}
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
                    onPageChange:     setPage,
                    onPageSizeChange: changePageSize,
                }}
                sort={{ field: sort.sortField, direction: sort.sortDirection }}
                onSort={handleSort}
                onPrint={handlePrint}
                onListView={handleListView}
                onExcelExport={handleExcelExport}
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

/** Mirror of the V144 SYS_SCR_OPTION_WECMS seed for the result list —
 *  paint-time fallback so the popover doesn't flash empty. */
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

/** PeriodKey → backend `from_date` / `to_date` window (yyyyMMdd). */
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
}): PayrollResultRow & PaymentResultBatchRow {
    const status: "completed" | "in_progress" =
        api.trnf_stts === "Y" ? "completed" : "in_progress";
    return {
        id:            api.scdul_pymn_no,
        dateTime:      formatRegDtm(api.reg_dtm),
        fileName:      api.titl,
        txnCount:      Number(api.tot_trns_cnt ?? "0") || 0,
        txnCurrency:   api.ccy_cd,
        totalAmount:   formatNumber(api.total_tran_amt),
        status,
        successCount:  api.tot_trns_succ_cnt  != null ? Number(api.tot_trns_succ_cnt)  : undefined,
        failedCount:   api.tot_trns_error_cnt != null ? Number(api.tot_trns_error_cnt) : undefined,
        approvalRef:   api.appr_seq_no ?? "",
        approvalTitle: api.titl,
        fromBank:      "",
    };
}

function formatRegDtm(raw: string | null | undefined): string {
    if (!raw || raw.length !== 14) return raw ?? "";
    const yyyy = raw.slice(0, 4);
    const mm   = raw.slice(4, 6);
    const dd   = raw.slice(6, 8);
    const HH   = raw.slice(8, 10);
    const MM   = raw.slice(10, 12);
    const SS   = raw.slice(12, 14);
    return `${dd}-${mm}-${yyyy}\n${HH}:${MM}:${SS}`;
}
