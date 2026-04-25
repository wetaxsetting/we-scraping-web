"use client";

import PaymentListPage from "@/components/payment/shared/PaymentListPage";
import type { PaymentListColumn } from "@/components/payment/shared/types";
import { useTranslation } from "@/lib/i18n";

import { exchangeRateRows, type ExchangeRateRow } from "./mockData";

const MIN_WIDTH = "var(--w-wb-ap-table-min)";

/**
 * Exchange Rate Inquiry — Sprint 2 Payment page. Looks up bank-published
 * buying / selling / mid rates per currency pair. No totals row (rates are
 * not summable), so the page runs in `paginationOnly` mode.
 */
export default function ExchangeRateInquiryPage() {
    const { t } = useTranslation();

    const columns: PaymentListColumn<ExchangeRateRow>[] = [
        { key: "bank", label: t("payment.col.bank"), width: "var(--w-wb-ap-filename)" },
        { key: "currencyPair", label: t("payment.col.currency_pair"), width: "var(--w-wb-ap-docno)" },
        { key: "buyingRate", label: t("payment.col.buying_rate"), align: "right", width: "var(--w-wb-ap-amount)" },
        { key: "sellingRate", label: t("payment.col.selling_rate"), align: "right", width: "var(--w-wb-ap-amount)" },
        { key: "midRate", label: t("payment.col.mid_rate"), align: "right", width: "var(--w-wb-ap-amount)" },
        { key: "referenceDate", label: t("payment.col.reference_date"), width: "var(--w-wb-ap-scheduled)" },
    ];

    return (
        <PaymentListPage<ExchangeRateRow>
            titleKey="payment.exchange_rate.title"
            columns={columns}
            rows={exchangeRateRows}
            countLabelKey="payment.transaction_count"
            minWidth={MIN_WIDTH}
            footerMode="paginationOnly"
            searchableFields={["bank", "currencyPair"]}
        />
    );
}
