"use client";

import { notFound } from "next/navigation";

import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import type { DetailTransaction } from "@/components/payment/shared/detailMocks";
import { useTranslation } from "@/lib/i18n";

import { internalResultRows } from "./mockData";

type TransferResultDetailPageProps = { id: string };

/**
 * Payment > Internal Transfer > Transfer Result > Details — Figma 1:13476.
 *
 * Summary mirrors Figma exactly: Withdrawal Bank "Shinhan", Account No.
 * "00500044787814 (VND)", Total Transfer Amount "80.000.000đ", Approval Ref
 * "VO_241030_002", Requestor "Mr.Kim". The breadcrumb subtitle is the
 * batch's parent identifier ("Payment_241205") — not a generated upload
 * filename.
 *
 * Inner table is the shared 11-column Result detail (`resultDetailColumns`)
 * which renders the Match CTA on rows where the bank acknowledged success
 * but no banking transaction ID is matched yet.
 */
export default function TransferResultDetailPage({
    id,
}: TransferResultDetailPageProps) {
    const { t } = useTranslation();
    const row = internalResultRows.find((r) => r.id === id);
    if (!row) notFound();

    // Figma 1:13476 — breadcrumb shows the payment reference, not the upload
    // file name. Falls back to the trailing serial of the file name when a
    // row hasn't been authored with a paymentRef yet.
    const subtitle =
        row.paymentRef ?? `Payment_${row.fileName.split("_").pop() ?? "241205"}`;
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
            listTitle={t("payment.internal.result_title")}
            subtitle={subtitle}
            backHref="/payment/internal-transfer/transfer-result"
            summary={summary}
            file={{
                name: "WeCMS_Internal_Transfer_upload_E.....xlsx",
                size: row.fileSize ?? "108.69 KB",
            }}
            rows={transferResultDetailRows}
        />
    );
}

/**
 * Static 4-row sample matching Figma 1:13476 — same id always produces the
 * same rows, no random generation. The Success row (last) is intentionally
 * left without a `bankingTxnId` so the cell renders the Match CTA.
 */
const transferResultDetailRows: DetailTransaction[] = [
    {
        id: "trd-1",
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
        id: "trd-2",
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
        id: "trd-3",
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
        id: "trd-4",
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
