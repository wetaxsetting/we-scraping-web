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
import { useTranslation } from "@/lib/i18n";

import { overseasScheduledRows } from "./mockData";

type OverseasScheduledDetailPageProps = { id: string };

/**
 * Payment > Overseas Payment > Scheduled Payment > Details — Figma 29:15858.
 *
 * Mirrors Internal Transfer / Vendor / Expense / Payroll Scheduled Detail:
 * same breadcrumb (file name) + Back, same single-line summary card
 * (text-wb-13 values per CLAUDE.md §12), same FileCard, same inner
 * detail table. No pagination, no totals footer (PaymentDetailPage enforces
 * both per §12a).
 */
export default function OverseasScheduledPaymentDetailPage({
    id,
}: OverseasScheduledDetailPageProps) {
    const { t } = useTranslation();
    const row = overseasScheduledRows.find((r) => r.id === id);
    if (!row) notFound();

    // Breadcrumb shows the file name only — mirrors every other Payment module.
    const subtitle = row.fileName;

    const summary = [
        { label: t("payment.detail.withdrawal_bank"), value: row.fromBank },
        {
            label: t("payment.detail.account_no"),
            value: row.fromAccount ? `${row.fromAccount} (${row.txnCurrency})` : "—",
        },
        { label: t("payment.detail.total_transfer_amount"), value: row.totalAmount },
        { label: t("payment.detail.approval_ref"), value: row.approvalRef },
        { label: t("payment.detail.requestor"), value: row.detailRequestor ?? row.requestor },
    ];

    const rows = buildDetailTransactions(row.id, 4, {
        documentNoPrefix: row.approvalRef,
    });

    return (
        <PaymentDetailPage<DetailTransaction>
            listTitle={t("payment.overseas.scheduled_title")}
            subtitle={subtitle}
            backHref="/payment/overseas-payment/scheduled-payment"
            summary={summary}
            file={{ name: `${row.fileName}.xlsx`, size: row.fileSize ?? "108.69 KB" }}
            columns={scheduledDetailColumns(t)}
            rows={rows}
            minWidth={SCHEDULED_DETAIL_MIN_WIDTH}
            getRowClass={(r) => (r.reportingAccount ? "bg-amber-50" : undefined)}
        />
    );
}
