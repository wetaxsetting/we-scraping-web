"use client";

import { notFound } from "next/navigation";

import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import type { DetailTransaction } from "@/components/payment/shared/detailMocks";
import { useTranslation } from "@/lib/i18n";

import { expenseResultRows } from "./mockData";

type ExpensePaymentResultDetailPageProps = { id: string };

/**
 * Payment > Expense Payment > Payment Result > Details — Figma 25:10047.
 *
 * Mirrors Internal Transfer Result Detail (Figma 1:13476) and Vendor
 * Payment Result Detail (Figma 24:6337): summary card + FileCard + status
 * tabs (All / Success / Failed / In Progress) + the shared 11-column
 * Result detail table (`resultDetailColumns`) which renders the Match CTA
 * on rows where the bank acknowledged success but no banking transaction
 * ID is matched yet. No pagination, no totals footer.
 */
export default function ExpensePaymentResultDetailPage({
    id,
}: ExpensePaymentResultDetailPageProps) {
    const { t } = useTranslation();
    const row = expenseResultRows.find((r) => r.id === id);
    if (!row) notFound();

    // Breadcrumb shows the payment reference (mirrors Vendor/Internal).
    const subtitle =
        row.paymentRef ?? `Expense_Payment_${row.fileName.split("_").pop() ?? "241205"}`;
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
            listTitle={t("payment.expense.result_title")}
            subtitle={subtitle}
            backHref="/payment/expense-payment/payment-result"
            summary={summary}
            file={{
                name: "WeCMS_Expense_Payment_upload_E.....xlsx",
                size: row.fileSize ?? "108.69 KB",
            }}
            rows={expenseResultDetailRows}
        />
    );
}

/**
 * Static 4-row sample matching Figma 25:10047 — same id always produces
 * the same rows. The Success row (last) is intentionally left without a
 * `bankingTxnId` so the cell renders the Match CTA. Mirrors the Internal
 * Transfer / Vendor Payment Result detail layouts.
 */
const expenseResultDetailRows: DetailTransaction[] = [
    {
        id: "erd-1",
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
        id: "erd-2",
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
        id: "erd-3",
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
        id: "erd-4",
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
