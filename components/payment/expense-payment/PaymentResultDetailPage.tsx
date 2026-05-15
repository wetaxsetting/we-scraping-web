"use client";

import { useCallback, useMemo, useState } from "react";
import { notFound } from "next/navigation";

import { deriveResultStatus } from "@/components/payment/shared/deriveResultStatus";
import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import type { DetailTransaction } from "@/components/payment/shared/detailMocks";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { ApiCallError } from "@/lib/api/banking";
import {
    downloadOriginalExpenseExcel,
    fetchExpensePaymentResultDetail,
} from "@/lib/api/expensePayment";
import { useApiData } from "@/lib/api/useApiData";
import { formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

type ExpensePaymentResultDetailPageProps = { id: string };

/**
 * Payment > Expense Payment > Payment Result > Details — Figma 25:9847.
 *
 * Phase B: wires `GET /api/v1/payment/expense-payment/results/{id}` with the
 * static `expenseResultRows` mock as a paint-time + offline fallback.
 * Mirrors Internal Transfer Result Detail (Figma 1:13476).
 */
export default function ExpensePaymentResultDetailPage({
    id,
}: ExpensePaymentResultDetailPageProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    /* ── View Setting popover state ────────────────────────────────── */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_EXPENSE_PAYMENT_RESULT_DETAIL,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft]   = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    const handleListView = useCallback((anchorRect: DOMRect) => {
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_RESULT_DETAIL_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    }, [vs.items]);
    const closeViewSetting = useCallback(() => {
        setVsAnchor(null);
        setVsDraft(null);
    }, []);

    /* ── Excel download ────────────────────────────────────────────── */
    const handleDownloadFile = useCallback(async () => {
        try {
            await downloadOriginalExpenseExcel(id);
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

    const state = useApiData(() => fetchExpensePaymentResultDetail(id), [id]);
    const detail = state.data;

    if (state.error instanceof ApiCallError && state.error.code === "WBE2060") {
        notFound();
    }

    const subtitle = detail?.titl ?? "";

    const summary = useMemo(() => {
        const bank        = detail?.out_bank_cd ?? "";
        const acct        = detail?.wdrl_act_no ?? "";
        const ccy         = detail?.wdrl_ccy_cd ?? detail?.ccy_cd ?? "";
        const totalAmount = detail ? formatNumber(detail.total_tran_amt) : "";
        const approvalRef = detail?.appr_seq_no ?? "";
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
            depositBankName:     "",
            depositBankCurrency: line.depo_ccy_cd ?? line.ccy_cd ?? detail.ccy_cd ?? "",
            accountNo:           line.finc_mda_no ?? "",
            recipientName:       line.rcpt_nm ?? "",
            transferAmount:      formatNumber(line.tran_amt),
            remark:              line.note ?? "",
            reportingAccount:    line.chart_acct_cd
                ? (line.chart_acct_seq_no
                    ? `${line.chart_acct_cd} - ${line.chart_acct_seq_no}`
                    : line.chart_acct_cd)
                : "",
            reportingAccountBreadcrumb: undefined,
            description:         line.tran_usag ?? "",
            bankingTxnId:        line.bank_trns_short_id ?? undefined,
            result:              deriveResultStatus(line, dispatched),
        }));
    }, [detail, id]);

    return (
        <>
            <ResultDetailView
                listTitle={t("payment.expense.result_title")}
                subtitle={subtitle}
                backHref="/payment/expense-payment/payment-result"
                summary={summary}
                file={{
                    name: detail?.org_file_nm ?? "",
                    size: detail?.file_size ? `${detail.file_size}` : "",
                }}
                rows={rows}
                // Client-side keyword filter across the canonical 11-col
                // result-detail layout — mirrors legacy `pymn_0004_002`
                // search input behaviour over the loaded line set.
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

/** Mirror of the V143 SYS_SCR_OPTION_WECMS seed for
 *  `payment-expense-payment-result-detail` — paint-time fallback so
 *  the popover doesn't flash empty while the API resolves. */
const FALLBACK_RESULT_DETAIL_COLUMNS: ViewSettingItem[] = [
    { field_id: "SCDUL_PYMN_DETL_NO", field_nm: "Line No.",           disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "100px", sort_yn: "Y" },
    { field_id: "PROC_DTTM",          field_nm: "Result Date / Time", disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "N" },
    { field_id: "TAR_BANK_CD",        field_nm: "Deposit Bank",       disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "RCPT_NM",            field_nm: "Recipient Name",     disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",           field_nm: "Transfer Amount",    disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "Y" },
    { field_id: "NOTE",               field_nm: "Remarks",            disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "PROC_STAT",          field_nm: "Results",            disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "120px", sort_yn: "N" },
    { field_id: "CHART_ACCT_CD",      field_nm: "Reporting Acct",     disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "TRAN_USAG",          field_nm: "Description",        disp_ord: 9,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "220px", sort_yn: "Y" },
    { field_id: "DOC_NO",             field_nm: "Document No.",       disp_ord: 10, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "BANK_TRNS_SHORT_ID", field_nm: "Banking Txn ID",     disp_ord: 11, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "Y" },
    { field_id: "ETC",                field_nm: "",                   disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "60px",  sort_yn: "N" },
];

/**
 * `yyyyMMddHHmmss` (14 chars, UTC) → two-line `"DD-MMM-YYYY\nHH:mm:ss"`.
 * Mirrors the Internal Transfer / Vendor / Payroll formatter.
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
