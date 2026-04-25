"use client";

import PaymentResultBatchListPage from "@/components/payment/shared/PaymentResultBatchListPage";
import { useTranslation } from "@/lib/i18n";

import { overseasResultRows, type OverseasResultRow } from "./mockData";

/**
 * Payment > Overseas Payment > Payment Result — Figma 29:16738.
 *
 * Composes the shared `<PaymentResultBatchListPage>` — same chrome,
 * columns, and totals footer as Internal Transfer Result per CLAUDE.md
 * §12a, with the totals footer required (Internal Transfer Result is the
 * only batch-file Result page exempt from totals).
 */
export default function OverseasPaymentResultPage() {
    const { t } = useTranslation();

    return (
        <PaymentResultBatchListPage<OverseasResultRow>
            title={t("payment.overseas.result_title")}
            rows={overseasResultRows}
            rowDetailHref={(row) =>
                `/payment/overseas-payment/payment-result/${row.id}`
            }
            totals={[{ currency: "VND", amount: "80.000.000đ" }]}
        />
    );
}
