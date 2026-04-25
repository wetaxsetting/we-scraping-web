"use client";

import PaymentScheduledBatchListPage, {
    type PaymentScheduledBatchRow,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";
import { useTranslation } from "@/lib/i18n";

import { payrollScheduledRows, type PayrollScheduledRow } from "./mockData";

/**
 * Payment > Payroll > Scheduled Payment — Figma 27:11294.
 *
 * Composes the shared `<PaymentScheduledBatchListPage>` — same chrome,
 * columns, and totals footer as Internal Transfer Scheduled per CLAUDE.md
 * §12a.
 */
export default function PayrollScheduledPaymentPage() {
    const { t } = useTranslation();

    return (
        <PaymentScheduledBatchListPage<PayrollScheduledRow & PaymentScheduledBatchRow>
            title={t("payment.payroll.scheduled_title")}
            rows={payrollScheduledRows}
            rowDetailHref={(row) =>
                `/payment/payroll/scheduled-payment/${row.id}`
            }
            totals={[{ currency: "VND", amount: "1.048.000.000đ" }]}
        />
    );
}
