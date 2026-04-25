"use client";

import PaymentResultBatchListPage, {
    type PaymentResultBatchRow,
} from "@/components/payment/shared/PaymentResultBatchListPage";
import { useTranslation } from "@/lib/i18n";

import { vendorResultRows, type VendorResultRow } from "./mockData";

/**
 * Payment > Vendor Payment > Payment Result — Figma 24:5491.
 *
 * Composes the shared `<PaymentResultBatchListPage>`. Per CLAUDE.md §12a
 * every batch-file Result variant except Internal Transfer must render a
 * totals footer.
 */
export default function VendorPaymentResultPage() {
    const { t } = useTranslation();

    return (
        <PaymentResultBatchListPage<VendorResultRow & PaymentResultBatchRow>
            title={t("payment.vendor.result_title")}
            rows={vendorResultRows}
            rowDetailHref={(row) =>
                `/payment/vendor-payment/payment-result/${row.id}`
            }
            totals={[{ currency: "VND", amount: "20.000.000đ" }]}
        />
    );
}
