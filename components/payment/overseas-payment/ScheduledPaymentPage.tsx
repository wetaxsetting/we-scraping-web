"use client";

import PaymentScheduledBatchListPage from "@/components/payment/shared/PaymentScheduledBatchListPage";
import { useTranslation } from "@/lib/i18n";

import { overseasScheduledRows, type OverseasScheduledRow } from "./mockData";

/**
 * Payment > Overseas Payment > Scheduled Payment — Figma 29:14947.
 *
 * Composes the shared `<PaymentScheduledBatchListPage>` — same chrome,
 * columns, and totals footer as Internal Transfer Scheduled per CLAUDE.md
 * §12a. Overseas's only structural variation is the extra "Schedule Date"
 * column (inserted between Total Transfer Amount and Approval Status),
 * supplied through the shared component's `extraColumn` slot. The wider
 * 12-column layout uses `--w-wb-st-table-min-overseas` so the table
 * scrolls horizontally in lockstep with the sibling footer table.
 */
export default function OverseasScheduledPaymentPage() {
    const { t } = useTranslation();

    return (
        <PaymentScheduledBatchListPage<OverseasScheduledRow>
            title={t("payment.overseas.scheduled_title")}
            rows={overseasScheduledRows}
            rowDetailHref={(row) =>
                `/payment/overseas-payment/scheduled-payment/${row.id}`
            }
            tableMinWidth="var(--w-wb-st-table-min-overseas)"
            extraColumn={{
                key: "scheduleDate",
                label: t("payment.internal.col.schedule_date"),
                width: "var(--w-wb-st-schedule-date)",
                render: (row) => (
                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                        {row.scheduleDate}
                    </span>
                ),
            }}
            totals={[{ currency: "VND", amount: "2.000.000đ" }]}
        />
    );
}
