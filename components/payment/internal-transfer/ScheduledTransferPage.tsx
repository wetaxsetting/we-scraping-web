"use client";

import PaymentScheduledBatchListPage, {
    type PaymentScheduledBatchRow,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";
import { useTranslation } from "@/lib/i18n";

import { internalScheduledRows, type InternalScheduledRow } from "./mockData";

/**
 * Payment > Internal Transfer > Scheduled Transfer — Figma 1:9972.
 *
 * Composes the shared `<PaymentScheduledBatchListPage>` — the canonical
 * batch-file Scheduled list (CLAUDE.md §12a). Internal Transfer is the
 * baseline that Vendor / Expense / Payroll / Overseas all mirror; any
 * change to chrome, columns, or footer goes into the shared component
 * so every Payment module stays byte-identical.
 */
export default function ScheduledTransferPage() {
    const { t } = useTranslation();

    return (
        <PaymentScheduledBatchListPage<InternalScheduledRow & PaymentScheduledBatchRow>
            title={t("payment.internal.scheduled_title")}
            rows={internalScheduledRows}
            rowDetailHref={(row) =>
                `/payment/internal-transfer/scheduled-transfer/${row.id}`
            }
            totals={[{ currency: "VND", amount: "20.000.000đ" }]}
        />
    );
}
