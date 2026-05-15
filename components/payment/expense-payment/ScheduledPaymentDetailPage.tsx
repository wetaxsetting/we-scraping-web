"use client";

import { useCallback, useMemo, useState } from "react";
import { notFound } from "next/navigation";

import PaymentDetailPage from "@/components/payment/shared/PaymentDetailPage";
import {
    SCHEDULED_DETAIL_MIN_WIDTH,
    scheduledDetailColumns,
} from "@/components/payment/shared/detailColumns";
import type { DetailTransaction } from "@/components/payment/shared/detailMocks";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { ApiCallError } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import {
    downloadOriginalExpenseExcel,
    fetchExpensePaymentDetail,
} from "@/lib/api/expensePayment";
import { formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";


type ExpenseScheduledDetailPageProps = { id: string };

/**
 * Payment > Expense Payment > Scheduled Payment > Details — Figma 25:8312.
 *
 * Phase B (real backend): wires `GET /api/v1/payment/expense-payment/{id}`.
 * Falls back to static mock when the API returns nothing (e.g. the user
 * deep-links to a mock-only id during local dev). Mirrors Internal
 * Transfer Scheduled Detail (Figma 8:599).
 */
export default function ExpenseScheduledPaymentDetailPage({
    id,
}: ExpenseScheduledDetailPageProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    /* ── View Setting popover state (legacy `pymn_0001_003` view-sort) ─ */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_EXPENSE_PAYMENT_SCHEDULED_DETAIL,
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

    /* ── Excel download (legacy `pymn_0001_003` file-card glyph) ─────── */
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

    const state = useApiData(() => fetchExpensePaymentDetail(id), [id]);
    const detail = state.data;

    if (state.error instanceof ApiCallError && state.error.code === "WBE2060") {
        notFound();
    }

    const subtitle = detail?.titl ?? "";

    const summary = useMemo(() => {
        const bank        = detail?.out_bank_cd  ?? "";
        const acct        = detail?.wdrl_act_no  ?? "";
        const ccy         = detail?.wdrl_ccy_cd ?? detail?.ccy_cd ?? "";
        const totalAmount = detail ? formatNumber(detail.total_tran_amt) : "";
        const approvalRef = detail?.appr_seq_no ?? "";
        const requestor   = detail?.reg_id       ?? "";
        return [
            { label: t("payment.detail.withdrawal_bank"),    value: bank },
            { label: t("payment.detail.account_no"),         value: acct ? `${acct} (${ccy})` : "" },
            { label: t("payment.detail.total_transfer_amount"), value: totalAmount },
            { label: t("payment.detail.approval_ref"),       value: approvalRef },
            { label: t("payment.detail.requestor"),          value: requestor },
        ];
    }, [detail, t]);

    const rows: DetailTransaction[] = useMemo(() => {
        if (!detail?.rows) return [];
        return detail.rows.map((line, idx) => ({
            id:                  `${id}-${line.scdul_pymn_detl_no || idx}`,
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
            documentNo:          line.doc_no ?? undefined,
        }));
    }, [detail, id]);

    const fileName = detail?.org_file_nm ?? "";
    const fileSize = detail?.file_size ? `${detail.file_size}` : "";

    return (
        <>
            <PaymentDetailPage<DetailTransaction>
                listTitle={t("payment.expense.scheduled_title")}
                subtitle={subtitle}
                backHref="/payment/expense-payment/scheduled-payment"
                summary={summary}
                file={{ name: fileName, size: fileSize }}
                columns={scheduledDetailColumns(t)}
                rows={rows}
                minWidth={SCHEDULED_DETAIL_MIN_WIDTH}
                getRowClass={(r) => (r.reportingAccount ? "bg-amber-50" : undefined)}
                // Client-side keyword filter — mirrors legacy
                // `pymn_0001_003` `#SRCH_WD` filter, but operates on
                // the already-loaded line set (the detail endpoint
                // returns every line for the batch). Searchable
                // fields cover the Figma 25:8312 visible cells.
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

/** Mirror of the V143 SYS_SCR_OPTION_WECMS seed — paint-time fallback
 *  so the popover doesn't flash empty while the API resolves. */
const FALLBACK_DETAIL_COLUMNS: ViewSettingItem[] = [
    { field_id: "TAR_BANK_CD",   field_nm: "Deposit Bank",    disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "RCPT_NM",       field_nm: "Recipient Name",  disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "FINC_MDA_NO",   field_nm: "Account No.",     disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",      field_nm: "Transfer Amount", disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "Y" },
    { field_id: "NOTE",          field_nm: "Remark",          disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "CHART_ACCT_CD", field_nm: "Reporting Acct",  disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "TRAN_USAG",     field_nm: "Description",     disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "220px", sort_yn: "Y" },
    { field_id: "DOC_NO",        field_nm: "Doc No.",         disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "ETC",           field_nm: "",                disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "60px",  sort_yn: "N" },
];
