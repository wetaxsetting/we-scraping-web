"use client";

import PaymentResultBatchListPage, {
    type PaymentResultBatchRow,
} from "@/components/payment/shared/PaymentResultBatchListPage";
import { useTranslation } from "@/lib/i18n";

import { expenseResultRows, type ExpenseResultRow } from "./mockData";

/**
 * Payment > Expense Payment > Payment Result — Figma 25:9221.
 */
export default function ExpensePaymentResultPage() {
    const { t } = useTranslation();

    return (
        <PaymentResultBatchListPage<ExpenseResultRow & PaymentResultBatchRow>
            title={t("payment.expense.result_title")}
            rows={expenseResultRows}
            rowDetailHref={(row) =>
                `/payment/expense-payment/payment-result/${row.id}`
            }
            totals={[{ currency: "VND", amount: "20.000.000đ" }]}
        />
    );
}
