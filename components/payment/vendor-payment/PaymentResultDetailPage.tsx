"use client";

import { useMemo } from "react";
import { notFound } from "next/navigation";

import { deriveResultStatus } from "@/components/payment/shared/deriveResultStatus";
import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import type { DetailTransaction } from "@/components/payment/shared/types";
import { ApiCallError } from "@/lib/api/banking";
import { fetchVendorPaymentResultDetail } from "@/lib/api/vendorPayment";
import { useApiData } from "@/lib/api/useApiData";
import { formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

type VendorPaymentResultDetailPageProps = { id: string };

/**
 * Payment > Vendor Payment > Payment Result > Details — Figma 24:6337.
 *
 * Wires `GET /api/v1/payment/vendor-payment/results/{id}`. Per-row result
 * badge derives from the shared `deriveResultStatus` helper (canonical
 * legacy mapping). 404s only on backend `WBE2060`.
 */
export default function VendorPaymentResultDetailPage({
    id,
}: VendorPaymentResultDetailPageProps) {
    const { t } = useTranslation();

    const state = useApiData(() => fetchVendorPaymentResultDetail(id), [id]);
    const detail = state.data;

    if (state.error instanceof ApiCallError && state.error.code === "WBE2060") {
        notFound();
    }

    const subtitle = detail?.titl ?? "";

    const summary = useMemo(() => {
        const bank        = detail?.out_bank_cd ?? "";
        const acct        = detail?.wdrl_act_no ?? "";
        const ccy         = detail?.wdrl_ccy_cd ?? detail?.ccy_cd ?? "";
        const totalAmount = detail ? formatNumber(detail.total_tran_amt) : "";
        const approvalRef = detail?.appr_seq_no ?? "";
        const requestor   = detail?.reg_id ?? "";
        return [
            { label: t("payment.detail.withdrawal_bank"), value: bank },
            { label: t("payment.detail.account_no"),      value: acct ? `${acct} (${ccy})` : "" },
            { label: t("payment.detail.total_transfer_amount"), value: totalAmount },
            { label: t("payment.detail.approval_ref"),    value: approvalRef },
            { label: t("payment.detail.requestor"),       value: requestor },
        ];
    }, [detail, t]);

    const rows: DetailTransaction[] = useMemo(() => {
        if (!detail?.rows) return [];
        const dispatched = detail.trnf_yn === "Y";
        return detail.rows.map((line, idx) => ({
            id:                  `${id}-${line.scdul_pymn_detl_no || idx}`,
            dateTime:            formatDttm(line.proc_dttm) ?? "",
            resultDateTime:      formatDttm(line.rslt_dttm),
            depositBank:         line.tar_bank_cd ?? "",
            depositBankCode:     line.tar_bank_cd ?? "",
            depositBankName:     "",
            depositBankCurrency: line.depo_ccy_cd ?? line.ccy_cd ?? detail.ccy_cd ?? "",
            accountNo:           line.finc_mda_no ?? "",
            recipientName:       line.rcpt_nm ?? "",
            transferAmount:      formatNumber(line.tran_amt),
            remark:              line.note ?? "",
            reportingAccount:    line.chart_acct_cd
                ? (line.chart_acct_seq_no
                    ? `${line.chart_acct_cd} - ${line.chart_acct_seq_no}`
                    : line.chart_acct_cd)
                : "",
            reportingAccountBreadcrumb: undefined,
            description:         line.tran_usag ?? "",
            bankingTxnId:        line.bank_trns_short_id ?? undefined,
            result:              deriveResultStatus(line, dispatched),
        }));
    }, [detail, id]);

    return (
        <ResultDetailView
            listTitle={t("payment.vendor.result_title")}
            subtitle={subtitle}
            backHref="/payment/vendor-payment/payment-result"
            summary={summary}
            file={{
                name: detail?.org_file_nm ?? "",
                size: detail?.file_size ? `${detail.file_size}` : "",
            }}
            rows={rows}
        />
    );
}

/**
 * `yyyyMMddHHmmss` (14 chars, UTC) → two-line `"DD-MMM-YYYY\nHH:mm:ss"`.
 * Mirrors the Internal Transfer / Payroll formatter so all four Payment
 * Result detail pages render dispatch / result timestamps identically.
 */
function formatDttm(raw: string | null | undefined): string | undefined {
    if (!raw) return undefined;
    if (raw.length !== 14) return raw;
    const yyyy = raw.slice(0, 4);
    const mm   = raw.slice(4, 6);
    const dd   = raw.slice(6, 8);
    const HH   = raw.slice(8, 10);
    const MM   = raw.slice(10, 12);
    const SS   = raw.slice(12, 14);
    const monthIdx = Number(mm) - 1;
    const monthAbbr =
        monthIdx >= 0 && monthIdx < MONTHS.length ? MONTHS[monthIdx] : mm;
    return `${dd}-${monthAbbr}-${yyyy}\n${HH}:${MM}:${SS}`;
}

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
