"use client";

import { useCallback, useMemo, useState } from "react";
import { notFound } from "next/navigation";

import { deriveResultStatus } from "@/components/payment/shared/deriveResultStatus";
import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import {
    resultDetailColumns,
    RESULT_DETAIL_MIN_WIDTH,
} from "@/components/payment/shared/detailColumns";
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
import { ApiCallError } from "@/lib/api/banking";
import {
    downloadOriginalPayrollExcel,
    fetchPayrollPaymentResultDetail,
    rerunPayrollLine,
} from "@/lib/api/payrollPayment";
import { useApiData } from "@/lib/api/useApiData";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { formatAmount, formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";


type PayrollPaymentResultDetailPageProps = { id: string };

/**
 * Payment > Payroll Payment > Payment Result > Details — Figma 27:13703.
 *
 * Wires `GET /api/v1/payment/payroll-payment/results/{id}`. View Setting +
 * DB-driven column widths follow the V231 / pymn_0006_002 legacy 8-column
 * set (no Description / Document No. / Banking Transaction ID — Payroll
 * legacy does not render those on the per-payee result line).
 */
export default function PayrollPaymentResultDetailPage({
    id,
}: PayrollPaymentResultDetailPageProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    /* ── View Setting popover state (legacy `pymn_0006_002`) ─────── */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_PAYROLL_PAYMENT_RESULT_DETAIL,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft]   = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    const handleListView = useCallback((anchorRect: DOMRect) => {
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
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

    const [refreshKey, setRefreshKey] = useState(0);
    const state = useApiData(() => fetchPayrollPaymentResultDetail(id), [id, refreshKey]);
    const detail = state.data;

    /* Sticky-wrapped initial-loading gate. */
    const stickyInitialLoading = useStickyLoading(state.loading && !detail);

    if (state.error instanceof ApiCallError && state.error.code === "WBE2060") {
        notFound();
    }

    const handleRerun = useCallback(
        (rowId: string) => {
            const detlNo = rowId.startsWith(`${id}-`) ? rowId.slice(id.length + 1) : rowId;
            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("payment.detail.rerun_confirm_description"),
                confirmText: t("dialog.continue"),
                cancelText: t("dialog.cancel"),
                onConfirm: async () => {
                    try {
                        await rerunPayrollLine(id, detlNo);
                        setRefreshKey((k) => k + 1);
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t("payment.detail.rerun_success"),
                        });
                    } catch (err) {
                        const code = err instanceof ApiCallError ? err.code : "WBE9999";
                        const message = err instanceof ApiCallError
                            ? err.message
                            : t("payment.detail.rerun_failed");
                        dialog.open({
                            type: "error",
                            title: t("dialog.error"),
                            description: message,
                            errorCode: code,
                        });
                    }
                },
            });
        },
        [id, dialog, t],
    );

    const subtitle = detail?.titl ?? "";

    const summary = useMemo(() => {
        const bank        = detail?.out_bank_cd ?? "";
        const acct        = detail?.wdrl_act_no ?? "";
        const ccy         = detail?.wdrl_ccy_cd ?? detail?.ccy_cd ?? "";
        const totalAmount = detail ? formatAmount(detail.total_tran_amt, ccy, true) : "";
        const approvalRef = detail?.doc_no ?? "";
        const requestor   = detail?.reg_id ?? "";
        return [
            { label: t("payment.detail.withdrawal_bank"), value: bank },
            { label: t("payment.detail.account_no"),      value: acct ? `${acct} (${ccy})` : "" },
            { label: t("payment.detail.total_transfer_amount"), value: totalAmount },
            { label: t("payment.detail.approval_ref"),    value: approvalRef },
            { label: t("payment.detail.requestor"),       value: requestor },
        ];
    }, [detail, t]);

    const rows: DetailTransaction[] = useMemo(() => {
        if (!detail?.rows) return [];
        const dispatched = detail.trnf_yn === "Y";
        return detail.rows.map((line, idx) => ({
            id:                  `${id}-${line.scdul_pymn_detl_no || idx}`,
            dateTime:            formatDttm(line.proc_dttm) ?? "",
            resultDateTime:      formatDttm(line.rslt_dttm),
            depositBank:         line.tar_bank_cd ?? "",
            depositBankCode:     line.tar_bank_cd ?? "",
            depositBankName:     line.tar_bank_nm ?? "",
            depositBankCurrency: line.depo_ccy_cd ?? line.ccy_cd ?? detail.ccy_cd ?? "",
            accountNo:           line.finc_mda_no ?? "",
            recipientName:       line.rcpt_nm ?? "",
            transferAmount:      formatNumber(line.tran_amt),
            // Legacy WSVC field mapping (V231 + pymn_0006_002 PROD):
            //   • TRAN_USAG → "Remarks" column → row.remark
            // Payroll Result Detail legacy does NOT render Description /
            // Document No. / Banking Txn ID columns. `description` and
            // `bankingTxnId` are still populated so the shared
            // `searchableFields` filter has something to match on for
            // pages that surface those fields elsewhere.
            remark:              line.tran_usag ?? "",
            reportingAccount:    line.chart_acct_cd
                ? (line.chart_acct_seq_no
                    ? `${line.chart_acct_cd} - ${line.chart_acct_seq_no}`
                    : line.chart_acct_cd)
                : "",
            reportingAccountBreadcrumb: undefined,
            description:         line.note ?? "",
            bankingTxnId:        line.bank_trns_short_id ?? undefined,
            // Re-run eligibility data (legacy pymn_0006_002.ts:441-449).
            procDttm:            line.proc_dttm ?? undefined,
            rsCd:                line.rs_cd ?? undefined,
            rsMsg:               line.rs_msg ?? undefined,
            linkMatchYn:         undefined,
            result:              deriveResultStatus(line, dispatched),
        }));
    }, [detail, id]);

    // Resolve visible columns from the live View Setting (filtered to
    // use_yn='Y', dropping CHECKBOX/ETC specials + FIELD_IDs we don't
    // have a renderer for, sorted by disp_ord). Falls back to V231
    // legacy widths until the API resolves.
    const liveItems = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
    const visibleViewSettingItems: ViewSettingItem[] = liveItems
        .filter(
            (it) =>
                it.use_yn === "Y" &&
                !isSpecialViewSettingField(it.field_id) &&
                FIELD_ID_TO_COLUMN_KEY[it.field_id] !== undefined,
        )
        .slice()
        .sort((a, b) => a.disp_ord - b.disp_ord);

    // Build the column list from the shared `resultDetailColumns` factory
    // (canonical 11-column renderers — Payroll consumes only 8 of them
    // per the V231 seed) and override each column's `width` with the
    // live DB SIZE value (Approval Box pattern).
    const baseColumns = resultDetailColumns(t, { onRerun: handleRerun });
    const columnByKey = new Map<string, PaymentListColumn<DetailTransaction>>(
        baseColumns.map((c) => [c.key, c]),
    );
    const columns: PaymentListColumn<DetailTransaction>[] = visibleViewSettingItems
        .map((it) => {
            const key = FIELD_ID_TO_COLUMN_KEY[it.field_id];
            const base = columnByKey.get(key);
            if (!base) return null;
            // `it.size` wins when present; falls back to the factory's
            // CSS-var default so admin SQL updates on `size` propagate to
            // the UI without a frontend deploy.
            return { ...base, width: it.size || base.width };
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
        return total > 0 ? `${total}px` : RESULT_DETAIL_MIN_WIDTH;
    })();

    return (
        <>
            <ResultDetailView
                listTitle={t("payment.payroll.result_title")}
                subtitle={subtitle}
                backHref="/payment/payroll/payment-result"
                summary={summary}
                file={{
                    name: detail?.org_file_nm ?? "",
                    size: detail?.file_size ? `${detail.file_size}` : "",
                }}
                rows={rows}
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
                    "bankingTxnId",
                ]}
                onDownloadFile={handleDownloadFile}
                onListView={handleListView}
                onRerun={handleRerun}
                columns={columns}
                tableMinWidth={dynamicMinWidth}
                enableSort
                emptyMessage={t("payment.payroll.result_detail_empty")}
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
 * Mirror of the V231 SYS_SCR_OPTION_WECMS seed for
 * `payment-payroll-payment-result-detail` / `default`. Paint-time
 * fallback used while the API resolves.
 *
 * Aligned with legacy `pymn_0006_002` PROD widths + FIELD_IDs — the
 * Payroll Result Detail legacy renders only 8 user columns (no
 * Description / Document No. / Banking Transaction ID).
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "PROC_DTTM",     field_nm: "Date/Time",         disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "105px", sort_yn: "Y" },
    { field_id: "TAR_BANK_CD",   field_nm: "Deposit Bank",      disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "RCPT_NM",       field_nm: "Recipient Name",    disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "330px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",      field_nm: "Transfer Amount",   disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "110px", sort_yn: "Y" },
    { field_id: "TRAN_USAG",     field_nm: "Remarks",           disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "330px", sort_yn: "Y" },
    { field_id: "RS_CD",         field_nm: "Results",           disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "100px", sort_yn: "Y" },
    { field_id: "RSLT_DTTM",     field_nm: "Result Date/Time",  disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "130px", sort_yn: "Y" },
    { field_id: "CHART_ACCT_CD", field_nm: "Reporting Account", disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "130px", sort_yn: "Y" },
    { field_id: "ETC",           field_nm: "",                  disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "60px",  sort_yn: "N" },
];

/**
 * Map each View Setting `FIELD_ID` to the matching `PaymentListColumn.key`
 * produced by {@link resultDetailColumns}. The page projects visible
 * View Setting items → columns using this map, then overrides each
 * column's `width` with the seed's `size` value.
 *
 * Payroll Result Detail legacy 8-column subset — no NOTE / DOC_NO /
 * BANK_TRAN_ID mapping (those columns are not in the pymn_0006_002 seed).
 */
const FIELD_ID_TO_COLUMN_KEY: Record<string, string> = {
    PROC_DTTM:     "dateTime",
    TAR_BANK_CD:   "depositBank",
    RCPT_NM:       "recipientName",
    TRAN_AMT:      "transferAmount",
    TRAN_USAG:     "remark",
    RS_CD:         "result",
    RSLT_DTTM:     "resultDateTime",
    CHART_ACCT_CD: "reportingAccount",
};

/**
 * `yyyyMMddHHmmss` (14 chars, UTC) → two-line `"DD-MMM-YYYY\nHH:mm:ss"`.
 * Mirrors the Internal Transfer / Vendor / Expense Result Detail formatter.
 */
function formatDttm(raw: string | null | undefined): string | undefined {
    if (!raw) return undefined;
    if (raw.length !== 14) return raw;
    const yyyy = raw.slice(0, 4);
    const mm   = raw.slice(4, 6);
    const dd   = raw.slice(6, 8);
    const HH   = raw.slice(8, 10);
    const MM   = raw.slice(10, 12);
    const SS   = raw.slice(12, 14);
    const monthIdx = Number(mm) - 1;
    const monthAbbr =
        monthIdx >= 0 && monthIdx < MONTHS.length ? MONTHS[monthIdx] : mm;
    return `${dd}-${monthAbbr}-${yyyy}\n${HH}:${MM}:${SS}`;
}

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
