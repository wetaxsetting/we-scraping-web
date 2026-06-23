"use client";

import DataTableFooter from "@/components/shared/DataTableFooter";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import EInvoiceTableColumns from "./EInvoiceTableColumns";
import type { EInvoiceCurrencyTotal } from "./types";

type EInvoiceTableFooterProps = {
    totals: EInvoiceCurrencyTotal[];
    /**
     * i18n key prefix — `sales_einvoices` for outbound customer invoices,
     * `expenses_einvoices` for inbound supplier invoices. Matches the prefix
     * passed to the main `<EInvoiceTable>` so both share translation copy.
     */
    translationPrefix?: "sales_einvoices" | "expenses_einvoices";
    className?: string;
};

/**
 * Summary rows rendered as a sibling `<table>` that imports the same
 * `<EInvoiceTableColumns>` as the main table. Kept as a sibling (not an
 * inline `<tfoot>`) so the page can pin it to the bottom of the scroll
 * container via `mt-auto` — the Approval Box canonical pattern (CLAUDE.md
 * §7a).
 *
 * Renders one `<tr>` per currency in `totals` — Sales / Expenses both
 * show VND + USD simultaneously. Columns covered:
 *   col 0 — Date/Time:  "Total (VND)" label
 *   col 1 — Invoice No: "N transaction(s)" count
 *   col 4 — Total:      total amount
 *   col 6 — Tax:        tax total
 *   col 7 — Pre-tax:    amount-before-tax total
 * The currency, buyer, and status columns stay blank on footer rows.
 */
/** Canonical zero totals shown when the result set is empty — so the
 *  footer always renders (VND + USD), matching Approval Box's
 *  `EMPTY_CURRENCY_TOTALS` and the batch footers' always-show set. */
const EMPTY_TOTALS: EInvoiceCurrencyTotal[] = [
    { currency: "VND", count: 0, total: "0", taxAmount: "0", pretaxAmount: "0" },
    { currency: "USD", count: 0, total: "0", taxAmount: "0", pretaxAmount: "0" },
];

export default function EInvoiceTableFooter({
    totals,
    translationPrefix = "sales_einvoices",
    className,
}: EInvoiceTableFooterProps) {
    const { t } = useTranslation();
    const k = (suffix: string) => `${translationPrefix}.${suffix}`;

    // Always render a footer — fall back to the canonical VND + USD zero
    // rows when the current result set has no totals, so the summary never
    // disappears on an empty page (mirrors Approval Box).
    const rows = totals.length > 0 ? totals : EMPTY_TOTALS;

    return (
        <DataTableFooter
            colgroup={<EInvoiceTableColumns />}
            minWidth="var(--w-wb-si-table-min)"
            className={cn("sticky bottom-0 z-20", className)}
        >
            {rows.map((total) => (
                <tr key={total.currency} className="h-[50px] bg-white">
                    <td className="px-2.5 py-3 align-middle">
                        <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                            {t(k("total_label"), { currency: total.currency })}
                        </span>
                    </td>
                    <td className="px-2.5 py-3 align-middle">
                        <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                            {t(k("transaction_count"), { count: total.count })}
                        </span>
                    </td>
                    <td aria-hidden />
                    <td aria-hidden />
                    <td className="px-2.5 py-3 text-right align-middle">
                        <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-ink">
                            {formatAmount(total.total, total.currency, false)}
                        </span>
                    </td>
                    <td aria-hidden />
                    <td className="px-2.5 py-3 text-right align-middle">
                        <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-ink">
                            {formatAmount(total.taxAmount, total.currency, false)}
                        </span>
                    </td>
                    <td className="px-2.5 py-3 text-right align-middle">
                        <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-ink">
                            {formatAmount(total.pretaxAmount, total.currency, false)}
                        </span>
                    </td>
                </tr>
            ))}
        </DataTableFooter>
    );
}
