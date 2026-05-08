"use client";

import DataTableFooter from "@/components/shared/DataTableFooter";
import { useTranslation } from "@/lib/i18n";

import { CT_COLUMN_COUNT } from "./CardTransactionsTableColumns";
import CardTransactionsTableColumns from "./CardTransactionsTableColumns";
import type { CurrencyTotal } from "./types";

type CardTransactionsTableFooterProps = {
    transactionCount: number;
    totals: CurrencyTotal[];
    className?: string;
};

// Columns reserved for the transaction-count cell (checkbox + datetime).
const COUNT_COLS = 2;
const REMAINING = CT_COLUMN_COUNT - COUNT_COLS; // 9

export default function CardTransactionsTableFooter({
    transactionCount,
    totals,
    className,
}: CardTransactionsTableFooterProps) {
    const { t } = useTranslation();

    const baseSpan = totals.length > 0
        ? Math.floor(REMAINING / totals.length)
        : REMAINING;
    const lastSpan = totals.length > 0
        ? REMAINING - baseSpan * (totals.length - 1)
        : REMAINING;

    return (
        <DataTableFooter
            colgroup={<CardTransactionsTableColumns />}
            minWidth="var(--w-wb-ct-table-min)"
            className={className}
        >
            <tr>
                <td colSpan={COUNT_COLS} className="px-2.5 py-3">
                    <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                        {t("payment.card.transaction_count", { count: transactionCount })}
                    </span>
                </td>

                {totals.length === 0 ? (
                    <td colSpan={REMAINING} />
                ) : (
                    totals.map((total, i) => (
                        <td
                            key={total.currency}
                            colSpan={i === totals.length - 1 ? lastSpan : baseSpan}
                            className="px-2.5 py-3"
                        >
                            <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                                {t("payment.card.total_label", { currency: total.currency })}
                                {" : "}
                                <span className="font-semibold">{total.total}</span>
                            </span>
                        </td>
                    ))
                )}
            </tr>
        </DataTableFooter>
    );
}
