"use client";

import PaymentScheduledBatchListPage, {
    type PaymentScheduledBatchRow,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";
import { useTranslation } from "@/lib/i18n";

import { vendorScheduledRows, type VendorScheduledRow } from "./mockData";

/**
 * Payment > Vendor Payment > Scheduled Payment — Figma 24:1398.
 *
 * Composes the shared `<PaymentScheduledBatchListPage>` — same chrome,
 * columns, and totals footer as Internal Transfer Scheduled per CLAUDE.md
 * §12a "Payment Module Pagination Rule".
 */
export default function VendorScheduledPaymentPage() {
    const { t } = useTranslation();

    return (
        <PaymentScheduledBatchListPage<VendorScheduledRow & PaymentScheduledBatchRow>
            title={t("payment.vendor.scheduled_title")}
            rows={vendorScheduledRows}
            rowDetailHref={(row) =>
                `/payment/vendor-payment/scheduled-payment/${row.id}`
            }
            totals={[{ currency: "VND", amount: "20.000.000đ" }]}
        />
    );
}
