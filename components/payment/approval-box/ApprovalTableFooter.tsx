"use client";

import DataTableFooter from "@/components/shared/DataTableFooter";
import { useTranslation } from "@/lib/i18n";

import { APPROVAL_COLUMN_COUNT } from "./ApprovalTableColumns";
import ApprovalTableColumns from "./ApprovalTableColumns";
import type { CurrencyTotal } from "./types";

type ApprovalTableFooterProps = {
    documentCount: number;
    totals: CurrencyTotal[];
    className?: string;
};

const DOC_COUNT_COLS = 3; // checkbox + date + type columns reserved for the document count cell
const REMAINING_COLS = APPROVAL_COLUMN_COUNT - DOC_COUNT_COLS; // 9

/**
 * Summary row rendered as its own <table> that shares the colgroup with the
 * main table. Each currency total gets its own <td> — no flex/grid inside
 * table cells — so column boundaries stay crisp and the browser's table
 * layout engine handles alignment natively.
 *
 * The remaining 9 columns after the document-count cell are divided evenly
 * among the currency totals; the last total absorbs any remainder so the
 * colspan sum always equals APPROVAL_COLUMN_COUNT.
 */
export default function ApprovalTableFooter({
    documentCount,
    totals,
    className,
}: ApprovalTableFooterProps) {
    const { t } = useTranslation();

    const baseColspan = totals.length > 0
        ? Math.floor(REMAINING_COLS / totals.length)
        : REMAINING_COLS;
    const lastColspan = totals.length > 0
        ? REMAINING_COLS - baseColspan * (totals.length - 1)
        : REMAINING_COLS;

    return (
        <DataTableFooter
            colgroup={<ApprovalTableColumns />}
            minWidth="var(--w-wb-ap-table-min)"
            className={className}
        >
            <tr>
                <td colSpan={DOC_COUNT_COLS} className="px-2.5 py-3">
                    <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                        {t("approval.document_count", { count: documentCount })}
                    </span>
                </td>

                {totals.length === 0 ? (
                    <td colSpan={REMAINING_COLS} />
                ) : (
                    totals.map((total, i) => (
                        <td
                            key={total.currency}
                            colSpan={i === totals.length - 1 ? lastColspan : baseColspan}
                            className="px-2.5 py-3"
                        >
                            <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                                {t("approval.total_label", { currency: total.currency })}
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
