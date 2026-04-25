"use client";

import PaymentScheduledBatchListPage, {
    type PaymentScheduledBatchRow,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";
import { useTranslation } from "@/lib/i18n";

import { expenseScheduledRows, type ExpenseScheduledRow } from "./mockData";

/**
 * Payment > Expense Payment > Scheduled Payment — Figma 25:7584.
 *
 * Composes the shared `<PaymentScheduledBatchListPage>` — same chrome,
 * columns, and totals footer as Internal Transfer Scheduled per CLAUDE.md
 * §12a.
 */
export default function ExpenseScheduledPaymentPage() {
    const { t } = useTranslation();

    return (
        <PaymentScheduledBatchListPage<ExpenseScheduledRow & PaymentScheduledBatchRow>
            title={t("payment.expense.scheduled_title")}
            rows={expenseScheduledRows}
            rowDetailHref={(row) =>
                `/payment/expense-payment/scheduled-payment/${row.id}`
            }
            totals={[{ currency: "VND", amount: "20.000.000đ" }]}
        />
    );
}
