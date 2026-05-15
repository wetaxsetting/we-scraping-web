"use client";

import { notFound } from "next/navigation";

import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import type { DetailTransaction } from "@/components/payment/shared/detailMocks";
import { fetchOverseasResultById } from "@/lib/api/payment";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";

type OverseasPaymentResultDetailPageProps = { id: string };

/**
 * Payment > Overseas Payment > Payment Result > Details — Figma 29:17560.
 */
export default function OverseasPaymentResultDetailPage({
    id,
}: OverseasPaymentResultDetailPageProps) {
    const { t } = useTranslation();

    const { data: row, loading, error } = useApiData(
        () => fetchOverseasResultById(id),
        [id],
    );

    if (loading) return null;
    if (error || !row) notFound();

    const subtitle = row.file_nm || id;
    const summary = [
        { label: t("payment.detail.withdrawal_bank"), value: row.out_bank_nm || "-" },
        {
            label: t("payment.detail.account_no"),
            value: `${row.wdrl_act_no || "—"} (${row.ccy_cd})`,
        },
        {
            label: t("payment.detail.total_transfer_amount"),
            value: row.total_tran_amt?.toString() || "-",
        },
        { label: t("payment.detail.approval_ref"), value: row.approvalRef },
        { label: t("payment.detail.requestor"), value: row.requestor ?? "" },
    ];

    return (
        <ResultDetailView
            listTitle={t("payment.overseas.result_title")}
            subtitle={subtitle}
            backHref="/payment/overseas-payment/payment-result"
            summary={summary}
            file={{
                name: `${subtitle}.xlsx`,
                size: "108.69 KB",
            }}
            rows={DETAIL_ROWS}
        />
    );
}

/**
 * Static sample rows matching Figma 29:17560.
 * Replace with a real per-batch transaction endpoint when the backend
 * OVRS_PYMN_DTLS table is ported in a future sprint.
 */
const DETAIL_ROWS: DetailTransaction[] = [
    {
        id: "ord-1",
        dateTime: "25-Mar-2026\n11:39:50",
        resultDateTime: "25-Mar-2026\n11:39:50",
        depositBank: "970458 - SHINHAN",
        depositBankCode: "970458",
        depositBankName: "SHINHAN",
        depositBankCurrency: "USD",
        accountNo: "40010023456914",
        recipientName: "NGUYEN NAPAS",
        transferAmount: "20.000.000",
        remark: "",
        reportingAccount: "2001019 - Payables",
        reportingAccountBreadcrumb: "Revenue > Sales",
        description: "",
        result: "failed",
    },
    {
        id: "ord-2",
        dateTime: "25-Mar-2026\n11:39:50",
        depositBank: "970457 - WooriBank",
        depositBankCode: "970457",
        depositBankName: "WooriBank",
        depositBankCurrency: "USD",
        accountNo: "40010023456914",
        recipientName: "JOHN MICAH",
        transferAmount: "20.000.000",
        remark: "",
        reportingAccount: "2001019 - Payables",
        reportingAccountBreadcrumb: "Revenue > Sales",
        description: "",
        result: "pending",
    },
    {
        id: "ord-3",
        dateTime: "25-Mar-2026\n11:39:50",
        resultDateTime: "25-Mar-2026\n11:39:50",
        depositBank: "970457 - WooriBank",
        depositBankCode: "970457",
        depositBankName: "WooriBank",
        depositBankCurrency: "USD",
        accountNo: "40010023456914",
        recipientName: "JOHN MICAH",
        transferAmount: "20.000.000",
        remark: "",
        reportingAccount: "",
        description: "",
        result: "failed",
    },
    {
        id: "ord-4",
        dateTime: "25-Mar-2026\n11:39:50",
        resultDateTime: "25-Mar-2026\n10:07:08",
        depositBank: "970457 - WooriBank",
        depositBankCode: "970457",
        depositBankName: "WooriBank",
        depositBankCurrency: "USD",
        accountNo: "40010023456914",
        recipientName: "JOHN MICAH",
        transferAmount: "20.000.000",
        remark: "",
        reportingAccount: "2001019 - Payables",
        reportingAccountBreadcrumb: "Revenue > Sales",
        description: "",
        result: "success",
    },
];
