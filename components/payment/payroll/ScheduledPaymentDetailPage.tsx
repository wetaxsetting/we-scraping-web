"use client";

import { notFound } from "next/navigation";

import PaymentDetailPage from "@/components/payment/shared/PaymentDetailPage";
import {
    SCHEDULED_DETAIL_MIN_WIDTH,
    scheduledDetailColumns,
} from "@/components/payment/shared/detailColumns";
import { buildDetailTransactions, type DetailTransaction } from "@/components/payment/shared/detailMocks";
import { useTranslation } from "@/lib/i18n";

import { payrollScheduledRows } from "./mockData";

type PayrollScheduledDetailPageProps = { id: string };

/**
 * Payment > Payroll > Scheduled Payment > Details — Figma 27:12163.
 *
 * Mirrors Internal Transfer Scheduled Detail (Figma 8:599), Vendor
 * Scheduled Detail (Figma 24:4705), and Expense Scheduled Detail
 * (Figma 25:8432): same breadcrumb (file name) + Back, same single-line
 * summary card (text-wb-13 values per CLAUDE.md detail summary rule),
 * same FileCard (size-5 wrapper / size-4 download icon), same inner
 * detail table. No pagination, no totals footer (PaymentDetailPage
 * enforces both).
 */
export default function PayrollScheduledPaymentDetailPage({
    id,
}: PayrollScheduledDetailPageProps) {
    const { t } = useTranslation();
    const row = payrollScheduledRows.find((r) => r.id === id);
    if (!row) notFound();

    // Breadcrumb shows just the file name — mirrors Internal/Vendor/Expense.
    const subtitle = row.fileName;

    const summary = [
        { label: t("payment.detail.withdrawal_bank"), value: row.fromBank },
        // Account No format: "00500044787814 (USD)" — number then currency in parens.
        {
            label: t("payment.detail.account_no"),
            value: row.fromAccount ? `${row.fromAccount} (${row.txnCurrency})` : "—",
        },
        { label: t("payment.detail.total_transfer_amount"), value: row.totalAmount },
        { label: t("payment.detail.approval_ref"), value: row.approvalRef },
        { label: t("payment.detail.requestor"), value: row.requestor },
    ];

    const rows = buildDetailTransactions(row.id, 4, {
        documentNoPrefix: row.approvalRef,
    });

    return (
        <PaymentDetailPage<DetailTransaction>
            listTitle={t("payment.payroll.scheduled_title")}
            subtitle={subtitle}
            backHref="/payment/payroll/scheduled-payment"
            summary={summary}
            // File card shows "<fileName>.xlsx" + actual file size.
            file={{ name: `${row.fileName}.xlsx`, size: row.fileSize ?? "108.69 KB" }}
            columns={scheduledDetailColumns(t)}
            rows={rows}
            minWidth={SCHEDULED_DETAIL_MIN_WIDTH}
            // Rows with an assigned reporting account get an amber tint.
            getRowClass={(r) => (r.reportingAccount ? "bg-amber-50" : undefined)}
        />
    );
}
