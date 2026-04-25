"use client";

import PaymentResultBatchListPage, {
    type PaymentResultBatchRow,
} from "@/components/payment/shared/PaymentResultBatchListPage";
import { useTranslation } from "@/lib/i18n";

import { internalResultRows, type InternalResultRow } from "./mockData";

/**
 * Payment > Internal Transfer > Transfer Result — Figma 1:11730.
 *
 * Composes the shared `<PaymentResultBatchListPage>`. Internal Transfer is
 * the only Payment Result variant exempt from the totals footer per
 * CLAUDE.md §12a — Figma 1:11730 shows pagination only. Every other Result
 * page (Vendor / Expense / Payroll / Overseas) supplies a `totals` array.
 */
export default function TransferResultPage() {
    const { t } = useTranslation();

    return (
        <PaymentResultBatchListPage<InternalResultRow & PaymentResultBatchRow>
            title={t("payment.internal.result_title")}
            rows={internalResultRows}
            rowDetailHref={(row) =>
                `/payment/internal-transfer/transfer-result/${row.id}`
            }
        />
    );
}
