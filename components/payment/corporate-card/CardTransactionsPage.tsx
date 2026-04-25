"use client";

import PaymentResultBadge from "@/components/payment/shared/PaymentResultBadge";
import PaymentListPage from "@/components/payment/shared/PaymentListPage";
import type { PaymentListColumn } from "@/components/payment/shared/types";
import { useTranslation } from "@/lib/i18n";

import { cardTransactionRows, type CardTransactionRow } from "./mockData";

const MIN_WIDTH = "var(--w-wb-ap-table-min)";

export default function CardTransactionsPage() {
    const { t } = useTranslation();

    const columns: PaymentListColumn<CardTransactionRow>[] = [
        { key: "dateTime", label: t("payment.col.date_time"), width: "var(--w-wb-ap-scheduled)" },
        { key: "cardNumber", label: t("payment.col.card_number"), width: "var(--w-wb-ap-filename)" },
        { key: "merchant", label: t("payment.col.merchant"), width: "var(--w-wb-ap-title)" },
        { key: "category", label: t("payment.col.category"), width: "var(--w-wb-ap-filename)" },
        { key: "currency", label: t("payment.col.currency"), width: "var(--w-wb-ap-currency)" },
        { key: "amount", label: t("payment.col.amount"), align: "right", width: "var(--w-wb-ap-amount)" },
        {
            key: "status",
            label: t("payment.col.status"),
            width: "var(--w-wb-ap-status)",
            render: (row) => (
                <PaymentResultBadge
                    status={row.status}
                    label={t(`payment.result.${row.status}`)}
                />
            ),
        },
    ];

    return (
        <PaymentListPage<CardTransactionRow>
            titleKey="payment.card.title"
            columns={columns}
            rows={cardTransactionRows}
            totals={[
                { currency: "USD", total: "9.99" },
                { currency: "VND", total: "7.175.000" },
                { currency: "KRW", total: "0" },
            ]}
            formatTotal={(c) => ({
                prefix: t("payment.total_label", { currency: c.currency }),
                value: c.total,
            })}
            countLabelKey="payment.transaction_count"
            minWidth={MIN_WIDTH}
            searchableFields={["cardNumber", "merchant", "category"]}
        />
    );
}
