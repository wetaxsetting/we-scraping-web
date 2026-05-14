"use client";

import { useMemo } from "react";

import PaymentResultBatchListPage, {
    type PaymentResultBatchRow,
} from "@/components/payment/shared/PaymentResultBatchListPage";
import { fetchVendorPaymentResultList } from "@/lib/api/vendorPayment";
import { useApiData } from "@/lib/api/useApiData";
import { formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

import { vendorResultRows, type VendorResultRow } from "./mockData";

/**
 * Payment > Vendor Payment > Payment Result — Figma 24:5491.
 *
 * Phase A: composes the shared `<PaymentResultBatchListPage>` and
 * wires the read path to `GET /api/v1/payment/vendor-payment/results`.
 * Falls back to the static mock when the API returns empty. Detail,
 * dispatch results, and per-batch success/failed counters land in
 * Phase B (deferred dispatch-tables join — backend ships
 * `tot_trns_succ_cnt` / `tot_trns_error_cnt` as null until then).
 *
 * Per CLAUDE.md §12a every batch-file Result variant except Internal
 * Transfer must render a totals footer — Vendor included.
 */
export default function VendorPaymentResultPage() {
    const { t } = useTranslation();

    const { fromDate, toDate } = useMemo(() => defaultWindow(), []);

    const state = useApiData(
        () => fetchVendorPaymentResultList({ fromDate, toDate, page: 0, size: 200 }),
        [fromDate, toDate],
    );

    const rows: Array<VendorResultRow & PaymentResultBatchRow> = useMemo(() => {
        const apiRows = (state.data?.rows ?? []).map(toResultRow);
        return apiRows.length > 0 ? apiRows : (vendorResultRows as Array<
            VendorResultRow & PaymentResultBatchRow
        >);
    }, [state.data]);

    const totals = useMemo(
        () =>
            (state.data?.currency_totals ?? []).map((c) => ({
                currency: c.ccy_cd,
                amount: formatNumber(c.total_amount),
            })),
        [state.data],
    );

    return (
        <PaymentResultBatchListPage<VendorResultRow & PaymentResultBatchRow>
            title={t("payment.vendor.result_title")}
            rows={rows}
            rowDetailHref={(row) =>
                `/payment/vendor-payment/payment-result/${row.id}`
            }
            totals={totals.length > 0 ? totals : [{ currency: "VND", amount: "20.000.000đ" }]}
        />
    );
}

function defaultWindow(): { fromDate: string; toDate: string } {
    const fmt = (d: Date): string => {
        const yyyy = d.getFullYear().toString().padStart(4, "0");
        const mm   = (d.getMonth() + 1).toString().padStart(2, "0");
        const dd   = d.getDate().toString().padStart(2, "0");
        return `${yyyy}${mm}${dd}`;
    };
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    return { fromDate: fmt(start), toDate: fmt(today) };
}

/**
 * Map an `ApiTransferResultListResponse.rows[*]` wire row onto the
 * Vendor Payment Result list-page row shape. `trnf_stts` is `'Y'`
 * (dispatched) or `'N'` (not yet) — the page maps these to the
 * `completed` / `in_progress` row status badge.
 */
function toResultRow(api: {
    scdul_pymn_no:      string;
    titl:               string;
    appr_seq_no:        string | null;
    total_tran_amt:     string;
    tot_trns_cnt:       string;
    tot_trns_succ_cnt:  string | null;
    tot_trns_error_cnt: string | null;
    trnf_stts:          string | null;
    reg_dtm:            string;
    ccy_cd:             string;
}): VendorResultRow & PaymentResultBatchRow {
    const status: "completed" | "in_progress" =
        api.trnf_stts === "Y" ? "completed" : "in_progress";
    return {
        id:            api.scdul_pymn_no,
        dateTime:      formatRegDtm(api.reg_dtm),
        fileName:      api.titl,
        txnCount:      Number(api.tot_trns_cnt ?? "0") || 0,
        txnCurrency:   api.ccy_cd,
        totalAmount:   formatNumber(api.total_tran_amt),
        status,
        successCount:  api.tot_trns_succ_cnt  != null ? Number(api.tot_trns_succ_cnt)  : undefined,
        failedCount:   api.tot_trns_error_cnt != null ? Number(api.tot_trns_error_cnt) : undefined,
        approvalRef:   api.appr_seq_no ?? "",
        approvalTitle: api.titl,
        fromBank:      "",
    };
}

function formatRegDtm(raw: string | null | undefined): string {
    if (!raw || raw.length !== 14) return raw ?? "";
    const yyyy = raw.slice(0, 4);
    const mm   = raw.slice(4, 6);
    const dd   = raw.slice(6, 8);
    const HH   = raw.slice(8, 10);
    const MM   = raw.slice(10, 12);
    const SS   = raw.slice(12, 14);
    return `${dd}-${mm}-${yyyy}\n${HH}:${MM}:${SS}`;
}
