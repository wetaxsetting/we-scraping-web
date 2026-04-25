"use client";

import { notFound } from "next/navigation";

import PaymentDetailPage from "@/components/payment/shared/PaymentDetailPage";
import {
    SCHEDULED_DETAIL_MIN_WIDTH,
    scheduledDetailColumns,
} from "@/components/payment/shared/detailColumns";
import { buildDetailTransactions, type DetailTransaction } from "@/components/payment/shared/detailMocks";
import { useTranslation } from "@/lib/i18n";

import { internalScheduledRows } from "./mockData";

type ScheduledTransferDetailPageProps = { id: string };

export default function ScheduledTransferDetailPage({
    id,
}: ScheduledTransferDetailPageProps) {
    const { t } = useTranslation();
    const row = internalScheduledRows.find((r) => r.id === id);
    if (!row) notFound();

    // Figma 8:599 — breadcrumb shows just the file name, e.g. "Internal_Transfer_241205"
    const subtitle = row.fileName;

    const summary = [
        { label: t("payment.detail.withdrawal_bank"), value: row.fromBank },
        // Figma format: "00500044787814 (USD)" — account number then currency in parens
        { label: t("payment.detail.account_no"), value: row.fromAccount ? `${row.fromAccount} (${row.txnCurrency})` : `—` },
        { label: t("payment.detail.total_transfer_amount"), value: row.totalAmount },
        { label: t("payment.detail.approval_ref"), value: row.approvalRef },
        { label: t("payment.detail.requestor"), value: row.requestor },
    ];

    const rows = buildDetailTransactions(row.id, 4, {
        documentNoPrefix: row.approvalRef,
    });

    return (
        <PaymentDetailPage<DetailTransaction>
            listTitle={t("payment.internal.scheduled_title")}
            subtitle={subtitle}
            backHref="/payment/internal-transfer/scheduled-transfer"
            summary={summary}
            // Figma 8:599 — file card shows "<fileName>.xlsx" and the actual file size
            file={{ name: `${row.fileName}.xlsx`, size: row.fileSize ?? "108.69 KB" }}
            columns={scheduledDetailColumns(t)}
            rows={rows}
            minWidth={SCHEDULED_DETAIL_MIN_WIDTH}
            // Figma 8:599 — rows with an assigned reporting account get an amber tint
            getRowClass={(r) => (r.reportingAccount ? "bg-amber-50" : undefined)}
        />
    );
}
