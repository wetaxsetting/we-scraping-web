"use client";

import { notFound } from "next/navigation";

import PaymentDetailPage from "@/components/payment/shared/PaymentDetailPage";
import {
    SCHEDULED_DETAIL_MIN_WIDTH,
    scheduledDetailColumns,
} from "@/components/payment/shared/detailColumns";
import {
    buildDetailTransactions,
    type DetailTransaction,
} from "@/components/payment/shared/detailMocks";
import { fetchOverseasScheduledById } from "@/lib/api/payment";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";

type OverseasScheduledDetailPageProps = { id: string };

/**
 * Payment > Overseas Payment > Scheduled Payment > Details — Figma 29:15858.
 */
export default function OverseasScheduledPaymentDetailPage({
    id,
}: OverseasScheduledDetailPageProps) {
    const { t } = useTranslation();

    const { data: row, loading, error } = useApiData(
        () => fetchOverseasScheduledById(id),
        [id],
    );

    if (loading) return null;
    if (error || !row) notFound();

    const subtitle = row.file_nm || row.titl || id;

    const fromAccount = row.wdrl_act_no;
    const summary = [
        { label: t("payment.detail.withdrawal_bank"), value: row.out_bank_nm || "-" },
        {
            label: t("payment.detail.account_no"),
            value: fromAccount ? `${fromAccount} (${row.ccy_cd})` : "—",
        },
        { label: t("payment.detail.total_transfer_amount"), value: row.total_tran_amt?.toString() || "-" },
        { label: t("payment.detail.approval_ref"), value: row.doc_no || "-" },
        { label: t("payment.detail.requestor"), value: row.draft_user_nm || row.reg_id || "-" },
    ];

    const rows = buildDetailTransactions(row.ovrs_pymn_no, 4, {
        documentNoPrefix: row.doc_no || undefined,
    });

    return (
        <PaymentDetailPage<DetailTransaction>
            listTitle={t("payment.overseas.scheduled_title")}
            subtitle={subtitle}
            backHref="/payment/overseas-payment/scheduled-payment"
            summary={summary}
            file={{ name: `${subtitle}.xlsx`, size: "108.69 KB" }}
            columns={scheduledDetailColumns(t)}
            rows={rows}
            minWidth={SCHEDULED_DETAIL_MIN_WIDTH}
            getRowClass={(r) => (r.reportingAccount ? "bg-amber-50" : undefined)}
        />
    );
}
