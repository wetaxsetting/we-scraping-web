"use client";

import PaymentScheduledBatchListPage from "@/components/payment/shared/PaymentScheduledBatchListPage";
import { fetchOverseasScheduledList, type ApiOverseasScheduledRow } from "@/lib/api/payment";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";

import { type OverseasScheduledRow } from "./mockData";

// Helper to format YYYYMMDDHHmmss to "DD-MM-YYYY\nHH:mm:ss"
function formatApiDateTime(dtm: string) {
    if (!dtm || dtm.length < 14) return dtm;
    const date = `${dtm.slice(6, 8)}-${dtm.slice(4, 6)}-${dtm.slice(0, 4)}`;
    const time = `${dtm.slice(8, 10)}:${dtm.slice(10, 12)}:${dtm.slice(12, 14)}`;
    return `${date}\n${time}`;
}

// Helper to format YYYYMMDD to "DD-MM-YYYY"
function formatApiDate(dt: string) {
    if (!dt || dt.length < 8) return dt;
    return `${dt.slice(6, 8)}-${dt.slice(4, 6)}-${dt.slice(0, 4)}`;
}

function mapApiRow(api: ApiOverseasScheduledRow): OverseasScheduledRow {
    return {
        id: api.ovrs_pymn_no,
        dateTime: formatApiDateTime(api.reg_dtm),
        fileName: api.file_nm || api.bnfc_nm,
        txnCount: api.tot_trns_cnt,
        txnCurrency: api.ccy_cd,
        totalAmount: api.total_tran_amt.toString(),
        status: api.appr_stts === "APPROVED" ? "approved" : "pending", // simplified status mapping
        statusStep: "Step 1",
        requestor: api.draft_user_nm || api.reg_id,
        approver: "-",
        approvalRef: api.doc_no || "-",
        approvalTitle: api.titl || "-",
        action: "transfer",
        scheduleDate: formatApiDate(api.pay_date),
    };
}

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

    // Default to a 1-year window for the initial fetch
    const { data, loading, error } = useApiData(
        () => fetchOverseasScheduledList({ from_dt: "20240101", to_dt: "20251231" }),
        []
    );

    // Use API rows directly. If loading or no data, show empty array.
    const displayRows = data && data.rows
        ? data.rows.map(mapApiRow)
        : [];

    const displayTotals = data && data.totals
        ? data.totals.map((tot) => ({
              currency: tot.ccy_cd,
              amount: tot.total_tran_amt.toString(),
          }))
        : [];

    return (
        <PaymentScheduledBatchListPage<OverseasScheduledRow>
            title={t("payment.overseas.scheduled_title")}
            rows={displayRows}
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
            totals={displayTotals}
        />
    );
}
