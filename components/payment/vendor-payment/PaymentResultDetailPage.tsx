"use client";

import { notFound } from "next/navigation";

import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import type { DetailTransaction } from "@/components/payment/shared/detailMocks";
import { useTranslation } from "@/lib/i18n";

import { vendorResultRows } from "./mockData";

type VendorPaymentResultDetailPageProps = { id: string };

/**
 * Payment > Vendor Payment > Payment Result > Details — Figma 24:6337.
 *
 * Mirrors Internal Transfer Result Detail (Figma 1:13476): summary "Shinhan
 * / 00500044787814 (VND) / 80.000.000đ / VO_241030_002 / Mr.Kim", FileCard,
 * status tabs (All / Success / Failed / In Progress), and the shared
 * 11-column Result detail table (`resultDetailColumns`) which renders the
 * Match CTA on rows where the bank acknowledged success but no banking
 * transaction ID is matched yet. No pagination, no totals footer.
 */
export default function VendorPaymentResultDetailPage({
    id,
}: VendorPaymentResultDetailPageProps) {
    const { t } = useTranslation();
    const row = vendorResultRows.find((r) => r.id === id);
    if (!row) notFound();

    // Figma 24:6337 — breadcrumb shows the payment reference.
    const subtitle =
        row.paymentRef ?? `Vendor_Payment_${row.fileName.split("_").pop() ?? "241205"}`;
    const summary = [
        { label: t("payment.detail.withdrawal_bank"), value: row.fromBank },
        {
            label: t("payment.detail.account_no"),
            value: `${row.fromAccount ?? "00500044787814"} (${row.fromCurrency ?? "VND"})`,
        },
        {
            label: t("payment.detail.total_transfer_amount"),
            value: row.totalTransferAmount ?? "80.000.000đ",
        },
        { label: t("payment.detail.approval_ref"), value: row.approvalRef },
        { label: t("payment.detail.requestor"), value: row.requestor ?? "Mr.Kim" },
    ];

    return (
        <ResultDetailView
            listTitle={t("payment.vendor.result_title")}
            subtitle={subtitle}
            backHref="/payment/vendor-payment/payment-result"
            summary={summary}
            file={{
                name: "WeCMS_Vendor_Payment_upload_E.....xlsx",
                size: row.fileSize ?? "108.69 KB",
            }}
            rows={vendorResultDetailRows}
        />
    );
}

/**
 * Static 4-row sample matching Figma 24:6337 — same id always produces the
 * same rows. Mirrors the Internal Transfer Result detail layout: the
 * Success row (last) is intentionally left without a `bankingTxnId` so the
 * cell renders the Match CTA.
 */
const vendorResultDetailRows: DetailTransaction[] = [
    {
        id: "vrd-1",
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
        id: "vrd-2",
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
        id: "vrd-3",
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
        id: "vrd-4",
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
