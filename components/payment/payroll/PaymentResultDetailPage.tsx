"use client";

import { notFound } from "next/navigation";

import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import type { DetailTransaction } from "@/components/payment/shared/detailMocks";
import { useTranslation } from "@/lib/i18n";

import { payrollResultRows } from "./mockData";

type PayrollPaymentResultDetailPageProps = { id: string };

/**
 * Payment > Payroll > Payment Result > Details — Figma 27:13703.
 *
 * Mirrors Internal Transfer Result Detail (Figma 1:13476), Vendor Payment
 * Result Detail (Figma 24:6337), and Expense Payment Result Detail
 * (Figma 25:10047): summary card + FileCard + status tabs (All / Success /
 * Failed / In Progress) + the shared 11-column Result detail table
 * (`resultDetailColumns`) which renders the Match CTA on rows where the
 * bank acknowledged success but no banking transaction ID is matched yet.
 * No pagination, no totals footer.
 */
export default function PayrollPaymentResultDetailPage({
    id,
}: PayrollPaymentResultDetailPageProps) {
    const { t } = useTranslation();
    const row = payrollResultRows.find((r) => r.id === id);
    if (!row) notFound();

    // Breadcrumb shows the payment reference (mirrors Vendor/Expense/Internal).
    const subtitle =
        row.paymentRef ?? `Payroll_Payment_${row.fileName.split("_").pop() ?? "241231"}`;
    const summary = [
        { label: t("payment.detail.withdrawal_bank"), value: row.fromBank },
        {
            label: t("payment.detail.account_no"),
            value: `${row.fromAccount ?? "00500044787814"} (${row.fromCurrency ?? "VND"})`,
        },
        {
            label: t("payment.detail.total_transfer_amount"),
            value: row.totalTransferAmount ?? "820.000.000đ",
        },
        { label: t("payment.detail.approval_ref"), value: row.approvalRef },
        { label: t("payment.detail.requestor"), value: row.requestor ?? "LE THI HAI YEN" },
    ];

    return (
        <ResultDetailView
            listTitle={t("payment.payroll.result_title")}
            subtitle={subtitle}
            backHref="/payment/payroll/payment-result"
            summary={summary}
            file={{
                name: "WeCMS_Payroll_upload_E.....xlsx",
                size: row.fileSize ?? "108.69 KB",
            }}
            rows={payrollResultDetailRows}
        />
    );
}

/**
 * Static 4-row sample matching Figma 27:13703 — same id always produces
 * the same rows. The Success row (last) is intentionally left without a
 * `bankingTxnId` so the cell renders the Match CTA. Mirrors the Internal
 * Transfer / Vendor / Expense Payment Result detail layouts.
 */
const payrollResultDetailRows: DetailTransaction[] = [
    {
        id: "prd-1",
        dateTime: "25-Mar-2026\n11:39:50",
        resultDateTime: "25-Mar-2026\n11:39:50",
        depositBank: "970458 - SHINHAN",
        depositBankCode: "970458",
        depositBankName: "SHINHAN",
        depositBankCurrency: "VND",
        accountNo: "40010023456914",
        recipientName: "NGUYEN VAN A",
        transferAmount: "10.000.000",
        remark: "",
        reportingAccount: "5001019 - Salary Expense",
        reportingAccountBreadcrumb: "Expense > Salary",
        description: "",
        result: "failed",
    },
    {
        id: "prd-2",
        dateTime: "25-Mar-2026\n11:39:50",
        depositBank: "970457 - WooriBank",
        depositBankCode: "970457",
        depositBankName: "WooriBank",
        depositBankCurrency: "VND",
        accountNo: "40010023456914",
        recipientName: "TRAN THI B",
        transferAmount: "10.000.000",
        remark: "",
        reportingAccount: "5001019 - Salary Expense",
        reportingAccountBreadcrumb: "Expense > Salary",
        description: "",
        result: "pending",
    },
    {
        id: "prd-3",
        dateTime: "25-Mar-2026\n11:39:50",
        resultDateTime: "25-Mar-2026\n11:39:50",
        depositBank: "970457 - WooriBank",
        depositBankCode: "970457",
        depositBankName: "WooriBank",
        depositBankCurrency: "VND",
        accountNo: "40010023456914",
        recipientName: "LE VAN C",
        transferAmount: "10.000.000",
        remark: "",
        reportingAccount: "",
        description: "",
        result: "failed",
    },
    {
        id: "prd-4",
        dateTime: "25-Mar-2026\n11:39:50",
        resultDateTime: "25-Mar-2026\n10:07:08",
        depositBank: "970457 - WooriBank",
        depositBankCode: "970457",
        depositBankName: "WooriBank",
        depositBankCurrency: "VND",
        accountNo: "40010023456914",
        recipientName: "PHAM THI D",
        transferAmount: "10.000.000",
        remark: "",
        reportingAccount: "5001019 - Salary Expense",
        reportingAccountBreadcrumb: "Expense > Salary",
        description: "",
        result: "success",
    },
];
