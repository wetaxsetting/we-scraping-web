"use client";

import PaymentResultBatchListPage, {
    type PaymentResultBatchRow,
} from "@/components/payment/shared/PaymentResultBatchListPage";
import { useTranslation } from "@/lib/i18n";

import { payrollResultRows, type PayrollResultRow } from "./mockData";

/**
 * Payment > Payroll > Payment Result — Figma 27:12877.
 */
export default function PayrollPaymentResultPage() {
    const { t } = useTranslation();

    return (
        <PaymentResultBatchListPage<PayrollResultRow & PaymentResultBatchRow>
            title={t("payment.payroll.result_title")}
            rows={payrollResultRows}
            rowDetailHref={(row) =>
                `/payment/payroll/payment-result/${row.id}`
            }
            totals={[{ currency: "VND", amount: "1.702.000.000đ" }]}
        />
    );
}
