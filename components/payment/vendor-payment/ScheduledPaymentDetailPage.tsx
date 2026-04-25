"use client";

import { notFound } from "next/navigation";

import PaymentDetailPage from "@/components/payment/shared/PaymentDetailPage";
import {
    SCHEDULED_DETAIL_MIN_WIDTH,
    scheduledDetailColumns,
} from "@/components/payment/shared/detailColumns";
import { buildDetailTransactions, type DetailTransaction } from "@/components/payment/shared/detailMocks";
import { useTranslation } from "@/lib/i18n";

import { vendorScheduledRows } from "./mockData";

type VendorScheduledDetailPageProps = { id: string };

/**
 * Payment > Vendor Payment > Scheduled Payment > Details — Figma 24:4705.
 *
 * Mirrors Internal Transfer Scheduled Detail (Figma 8:599): same breadcrumb
 * + Back, same single-line summary card (text-wb-13 values per CLAUDE.md
 * detail-summary rule), same FileCard, same inner detail table. No
 * pagination, no totals footer (PaymentDetailPage enforces both).
 */
export default function VendorScheduledPaymentDetailPage({
    id,
}: VendorScheduledDetailPageProps) {
    const { t } = useTranslation();
    const row = vendorScheduledRows.find((r) => r.id === id);
    if (!row) notFound();

    // Figma 24:4705 — breadcrumb shows just the file name.
    const subtitle = row.fileName;

    const summary = [
        { label: t("payment.detail.withdrawal_bank"), value: row.fromBank },
        // Figma format: "00500044787814 (USD)" — account number then currency in parens
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
            listTitle={t("payment.vendor.scheduled_title")}
            subtitle={subtitle}
            backHref="/payment/vendor-payment/scheduled-payment"
            summary={summary}
            // Figma 24:4705 — file card shows "<fileName>.xlsx" and the actual file size
            file={{ name: `${row.fileName}.xlsx`, size: row.fileSize ?? "108.69 KB" }}
            columns={scheduledDetailColumns(t)}
            rows={rows}
            minWidth={SCHEDULED_DETAIL_MIN_WIDTH}
            // Figma 24:4705 — rows with an assigned reporting account get an amber tint
            getRowClass={(r) => (r.reportingAccount ? "bg-amber-50" : undefined)}
        />
    );
}
