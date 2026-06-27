"use client";

import { useCallback, useMemo, useState } from "react";
import { notFound } from "next/navigation";

import PaymentDetailPage from "@/components/payment/shared/PaymentDetailPage";
import {
    SCHEDULED_DETAIL_MIN_WIDTH,
    scheduledDetailColumns,
    type ChartAccountOption,
} from "@/components/payment/shared/detailColumns";
import { DetailClampCell } from "@/components/payment/shared/detailCells";
import type {
    DetailTransaction,
    PaymentListColumn,
} from "@/components/payment/shared/types";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    isSpecialViewSettingField,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useBlockedChars } from "@/hooks/useBlockedChars";
import { ApiCallError } from "@/lib/api/banking";
import { fetchChartOfAccounts } from "@/lib/api/chartOfAccounts";
import { useApiData } from "@/lib/api/useApiData";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import {
    downloadOriginalPayrollExcel,
    fetchPayrollPaymentDetail,
    updatePayrollReportingAccount,
} from "@/lib/api/payrollPayment";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";


type PayrollScheduledDetailPageProps = { id: string };

/**
 * Payment > Payroll Payment > Scheduled Payment > Details — Figma 27:12163.
 *
 * Wires `GET /api/v1/payment/payroll-payment/{id}`. View Setting +
 * DB-driven column widths follow the V229 / pymn_0005_003 legacy
 * 5-column set (no Description / Document No. / Banking Transaction ID
 * — Payroll legacy does not render those on the per-payee line).
 */
export default function PayrollScheduledPaymentDetailPage({
    id,
}: PayrollScheduledDetailPageProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    /* ── View Setting popover state (legacy `pymn_0005_003`) ─────────── */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_PAYROLL_PAYMENT_SCHEDULED_DETAIL,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft]   = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    const handleListView = useCallback((anchorRect: DOMRect) => {
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_DETAIL_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    }, [vs.items]);
    const closeViewSetting = useCallback(() => {
        setVsAnchor(null);
        setVsDraft(null);
    }, []);

    const handleDownloadFile = useCallback(async () => {
        try {
            await downloadOriginalPayrollExcel(id);
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError
                ? err.message
                : t("payment.internal.download_failed");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        }
    }, [id, dialog, t]);

    const state = useApiData(() => fetchPayrollPaymentDetail(id), [id]);
    const detail = state.data;

    /* Sticky-wrapped initial-loading gate. */
    const stickyInitialLoading = useStickyLoading(state.loading && !detail);

    const { data: chartData } = useApiData(
        () => fetchChartOfAccounts({ sortField: "CHART_ACCT_CD", sortDir: "ASC" }),
        [],
    );
    const chartAccounts: ChartAccountOption[] = useMemo(
        () => (chartData?.items ?? []).map((a) => ({
            seqNo:  a.chart_acct_seq_no,
            code:   a.chart_acct_cd,
            nameEn: a.chart_acct_nm_en,
        })),
        [chartData],
    );
    const [reportingOverrides, setReportingOverrides] = useState<Record<string, string | null>>({});
    const handleSelectReportingAccount = useCallback(
        async (rowId: string, code: string | null) => {
            const prevSnapshot = reportingOverrides[rowId];
            setReportingOverrides((prev) => ({ ...prev, [rowId]: code }));
            if (code === null) return;
            const dashIdx = rowId.indexOf("-");
            const detlNo  = dashIdx >= 0 ? rowId.slice(dashIdx + 1) : "";
            if (!detlNo) return;
            const account = chartAccounts.find((a) => a.code === code);
            if (!account) return;
            try {
                await updatePayrollReportingAccount(id, detlNo, {
                    chart_acct_seq_no: account.seqNo,
                    chart_acct_cd:     account.code,
                });
            } catch (err) {
                setReportingOverrides((prev) => {
                    const next = { ...prev };
                    if (prevSnapshot === undefined) delete next[rowId];
                    else next[rowId] = prevSnapshot;
                    return next;
                });
                const errorCode = err instanceof ApiCallError ? err.code    : "WBE9999";
                const message   = err instanceof ApiCallError ? err.message : t("payment.detail.reporting_account.save_failed");
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: message,
                    errorCode,
                });
            }
        },
        [id, chartAccounts, reportingOverrides, dialog, t],
    );

    if (state.error instanceof ApiCallError && state.error.code === "WBE2060") {
        notFound();
    }

    const subtitle = detail?.titl ?? "";

    const summary = useMemo(() => {
        // Issue-1: prefer the resolved withdrawal-bank name, fall back to the raw code.
        const bank        = detail?.out_bank_nm ?? detail?.out_bank_cd ?? "";
        const acct        = detail?.wdrl_act_no  ?? "";
        const ccy         = detail?.wdrl_ccy_cd ?? detail?.ccy_cd ?? "";
        const totalAmount = detail ? formatAmount(detail.total_tran_amt, ccy, true) : "";
        const approvalRef = detail?.doc_no ?? "";
        // Requestor = legacy EXPT_RESOL_MSTR.DRAFT_USER_NM (발의자명). BLANK when
        // null (draft — no approval request yet), matching legacy
        // `null2void(DRAFT_USER_NM)`. Do NOT fall back to reg_id (creator LOGIN
        // id / email) — legacy never shows it in this column.
        const requestor   = detail?.requestor ?? "";
        return [
            { label: t("payment.detail.withdrawal_bank"),       value: bank },
            { label: t("payment.detail.account_no"),            value: acct ? `${acct} (${ccy})` : "" },
            { label: t("payment.detail.total_transfer_amount"), value: totalAmount },
            { label: t("payment.detail.approval_ref"),          value: approvalRef },
            { label: t("payment.detail.requestor"),             value: requestor },
        ];
    }, [detail, t]);

    const rows: DetailTransaction[] = useMemo(() => {
        if (!detail?.rows) return [];
        return detail.rows.map((line, idx) => {
            const rowId = `${id}-${line.scdul_pymn_detl_no || idx}`;
            const baseCode = line.chart_acct_cd ?? null;
            const baseBreadcrumb = line.chart_acct_breadcrumb ?? undefined;
            const override = Object.prototype.hasOwnProperty.call(reportingOverrides, rowId)
                ? reportingOverrides[rowId]
                : undefined;
            const effectiveCode = override !== undefined ? override : baseCode;
            const reportingAccount = effectiveCode ?? "";
            const reportingAccountBreadcrumb = override !== undefined
                ? undefined
                : baseBreadcrumb;
            return {
                id:                  rowId,
                depositBank:         line.tar_bank_cd ?? "",
                depositBankCode:     line.tar_bank_cd ?? "",
                depositBankName:     line.tar_bank_nm ?? "",
                depositBankCurrency: line.depo_ccy_cd ?? line.ccy_cd ?? detail.ccy_cd ?? "",
                accountNo:           line.finc_mda_no ?? "",
                recipientName:       line.rcpt_nm ?? "",
                transferAmount:      formatAmount(line.tran_amt, line.ccy_cd ?? detail.ccy_cd, false),
                // Legacy WSVC field mapping (V229 + pymn_0005_003 PROD):
                //   • TRAN_USAG → "Remarks" column → row.remark
                // Payroll legacy does NOT render a Description column,
                // so `row.description` is unused by the column registry;
                // we keep `line.note` populated for searchableFields parity.
                remark:              line.tran_usag ?? "",
                reportingAccount,
                reportingAccountUnassigned: !reportingAccount,
                reportingAccountBreadcrumb,
                description:         line.note ?? "",
                documentNo:          line.doc_no ?? undefined,
            };
        });
    }, [detail, id, reportingOverrides]);

    // Resolve visible columns from the live View Setting (filtered to
    // use_yn='Y', dropping CHECKBOX/ETC specials + FIELD_IDs we don't
    // have a renderer for, sorted by disp_ord). Falls back to V229
    // legacy widths until the API resolves.
    const liveItems = vs.items.length > 0 ? vs.items : FALLBACK_DETAIL_COLUMNS;
    const visibleViewSettingItems: ViewSettingItem[] = liveItems
        .filter(
            (it) =>
                it.use_yn === "Y" &&
                !isSpecialViewSettingField(it.field_id) &&
                FIELD_ID_TO_COLUMN_KEY[it.field_id] !== undefined,
        )
        .slice()
        .sort((a, b) => a.disp_ord - b.disp_ord);

    const fileName = detail?.org_file_nm ?? "";
    const fileSize = detail?.file_size ? `${detail.file_size}` : "";

    // Bank-specific blocked-chars tooltip — drives the Remarks ⓘ +
    // Recipient Name ⓘ glyphs in the shared column factory. Keys on
    // the withdrawal bank + PAYR PymnType so the tooltip surfaces
    // exactly what `SpecialCharValidator` rejects for this upload.
    const blockedChars = useBlockedChars(detail?.out_bank_cd, "PAYR");

    // Build the column list from the shared `scheduledDetailColumns`
    // factory (canonical 8 renderers — DepositBankCell, chart-of-accounts
    // picker, etc., all `sortable: true` with a numeric `sortValue` for
    // Transfer Amount) and override each column's `width` with the live
    // DB SIZE value. Payroll's 5-column legacy subset projects only the
    // columns we have FIELD_ID mappings for.
    const baseColumns = scheduledDetailColumns(t, {
        blockedChars,
        accounts: chartAccounts,
        onSelectReportingAccount: handleSelectReportingAccount,
    });
    const columnByKey = new Map<string, PaymentListColumn<DetailTransaction>>(
        baseColumns.map((c) => [c.key, c]),
    );
    const columns: PaymentListColumn<DetailTransaction>[] = visibleViewSettingItems
        .map((it) => {
            const key = FIELD_ID_TO_COLUMN_KEY[it.field_id];
            const base = columnByKey.get(key);
            if (!base) return null;
            // `it.size` wins when present; falls back to the factory's
            // default width so admin SQL updates on `size` propagate to
            // the UI without a frontend deploy.
            const width = it.size || base.width;
            // Long-text columns clamp to 2 lines + ellipsis + shared
            // tooltip (audit section B). Reporting Account keeps its
            // interactive picker; Deposit Bank keeps its multi-line cell.
            // Of Payroll's 5-col subset only recipientName / remark match.
            if (SCHEDULED_DETAIL_CLAMP_KEYS.has(key)) {
                return {
                    ...base,
                    width,
                    render: (row: DetailTransaction) => (
                        <DetailClampCell
                            text={String((row as Record<string, unknown>)[key] ?? "")}
                        />
                    ),
                };
            }
            if (key === "reportingAccount") {
                // Drop the shared factory's cream-yellow cell highlight
                // (`bg-[#FFFEDB]`) so the Reporting Account cell uses the clean
                // common-select style — matches Internal Transfer's scheduled
                // detail (the legacy pymn_0005_003 #FFFEDB highlight is retired).
                return { ...base, width, cellClassName: undefined };
            }
            return { ...base, width };
        })
        .filter((c): c is PaymentListColumn<DetailTransaction> => c !== null);

    // Sum visible-column widths so the inner table's min-width tracks
    // the visible set — hiding columns from the popover shrinks the
    // horizontal-scroll threshold proportionally.
    const dynamicMinWidth = (() => {
        const total = visibleViewSettingItems.reduce((sum, it) => {
            const m = (it.size ?? "").match(/^(\d+(?:\.\d+)?)px$/);
            return m ? sum + parseFloat(m[1]) : sum;
        }, 0);
        return total > 0 ? `${total}px` : SCHEDULED_DETAIL_MIN_WIDTH;
    })();

    return (
        <>
            <PaymentDetailPage<DetailTransaction>
                listTitle={t("payment.payroll.scheduled_title")}
                subtitle={subtitle}
                backHref="/payment/payroll/scheduled-payment"
                summary={summary}
                file={{ name: fileName, size: fileSize }}
                columns={columns}
                rows={rows}
                minWidth={dynamicMinWidth}
                searchableFields={[
                    "depositBank",
                    "depositBankCode",
                    "depositBankName",
                    "accountNo",
                    "recipientName",
                    "remark",
                    "description",
                    "documentNo",
                    "reportingAccount",
                ]}
                onDownloadFile={handleDownloadFile}
                onListView={handleListView}
                // Client-side sort over the already-fetched per-batch
                // line array — same pattern as Internal Transfer /
                // Vendor / Expense Scheduled Detail. Per-column `sortable`
                // + `sortValue` come from `scheduledDetailColumns`.
                enableSort
                emptyMessage={t("payment.payroll.scheduled_detail_empty")}
                loading={stickyInitialLoading}
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
 * Mirror of the V229 SYS_SCR_OPTION_WECMS seed for
 * `payment-payroll-payment-scheduled-detail` / `default`. Paint-time
 * fallback used while the API resolves.
 *
 * Aligned with legacy `pymn_0005_003` PROD widths + FIELD_IDs — the
 * Payroll Scheduled Detail legacy renders only 5 user columns (no
 * Description, no Document No., no Banking Transaction ID).
 */
const FALLBACK_DETAIL_COLUMNS: ViewSettingItem[] = [
    { field_id: "TAR_BANK_CD",   field_nm: "Deposit Bank",      disp_ord: 1,  disp_yn: "Y", use_yn: "Y", size: "180px", sort_yn: "Y" },
    { field_id: "RCPT_NM",       field_nm: "Recipient Name",    disp_ord: 2,  disp_yn: "Y", use_yn: "Y", size: "360px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",      field_nm: "Transfer Amount",   disp_ord: 3,  disp_yn: "Y", use_yn: "Y", size: "110px", sort_yn: "Y" },
    { field_id: "TRAN_USAG",     field_nm: "Remarks",           disp_ord: 4,  disp_yn: "Y", use_yn: "Y", size: "360px", sort_yn: "Y" },
    { field_id: "CHART_ACCT_CD", field_nm: "Reporting Account", disp_ord: 5,  disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "ETC",           field_nm: "",                  disp_ord: 99, disp_yn: "N", use_yn: "Y", size: "60px",  sort_yn: "N" },
];

/**
 * Map each View Setting `FIELD_ID` to the matching `PaymentListColumn.key`
 * produced by {@link scheduledDetailColumns}. The page projects visible
 * View Setting items → columns using this map, then overrides each
 * column's `width` with the seed's `size` value (DB-driven, per the
 * Approval Box pattern).
 *
 * Payroll legacy 5-column subset — no NOTE/DOC_NO/BANK_TRAN_ID mapping
 * (those columns are not in the pymn_0005_003 seed).
 */
const FIELD_ID_TO_COLUMN_KEY: Record<string, string> = {
    TAR_BANK_CD:   "depositBank",
    RCPT_NM:       "recipientName",
    TRAN_AMT:      "transferAmount",
    TRAN_USAG:     "remark",
    CHART_ACCT_CD: "reportingAccount",
};

/** Long-text columns that clamp to 2 lines + ellipsis + shared tooltip
 *  (audit section B). Deposit Bank (multi-line cell), Reporting Account
 *  (interactive picker), and Transfer Amount (numeric) are excluded.
 *  Payroll's 5-col legacy subset only renders recipientName / remark of
 *  these, so the others are inert. */
const SCHEDULED_DETAIL_CLAMP_KEYS = new Set([
    "recipientName",
    "remark",
    "description",
    "documentNo",
]);
