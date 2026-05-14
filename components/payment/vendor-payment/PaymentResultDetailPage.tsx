"use client";

import { useMemo } from "react";
import { notFound } from "next/navigation";

import { deriveResultStatus } from "@/components/payment/shared/deriveResultStatus";
import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import type { DetailTransaction } from "@/components/payment/shared/detailMocks";
import { fetchVendorPaymentResultDetail } from "@/lib/api/vendorPayment";
import { useApiData } from "@/lib/api/useApiData";
import { formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

import { vendorResultRows } from "./mockData";

type VendorPaymentResultDetailPageProps = { id: string };

/**
 * Payment > Vendor Payment > Payment Result > Details — Figma 24:6337.
 *
 * Phase B: wires `GET /api/v1/payment/vendor-payment/results/{id}` with the
 * static `vendorResultRows` mock as a paint-time + offline fallback.
 * Mirrors Internal Transfer Result Detail (Figma 1:13476).
 */
export default function VendorPaymentResultDetailPage({
    id,
}: VendorPaymentResultDetailPageProps) {
    const { t } = useTranslation();

    const state = useApiData(() => fetchVendorPaymentResultDetail(id), [id]);
    const detail = state.data;
    const mockRow = vendorResultRows.find((r) => r.id === id);

    if (!state.loading && !detail && !mockRow) notFound();

    const subtitle = detail?.titl
        ?? mockRow?.paymentRef
        ?? `Vendor_Payment_${(mockRow?.fileName ?? "").split("_").pop() ?? "241205"}`;

    const summary = useMemo(() => {
        const bank        = detail?.out_bank_cd ?? mockRow?.fromBank ?? "";
        const acct        = detail?.wdrl_act_no ?? mockRow?.fromAccount ?? "00500044787814";
        const ccy         = detail?.wdrl_ccy_cd ?? detail?.ccy_cd ?? mockRow?.fromCurrency ?? "VND";
        const totalAmount = detail
            ? formatNumber(detail.total_tran_amt)
            : (mockRow?.totalTransferAmount ?? "80.000.000đ");
        const approvalRef = detail?.appr_seq_no ?? mockRow?.approvalRef ?? "";
        const requestor   = detail?.reg_id ?? mockRow?.requestor ?? "";
        return [
            { label: t("payment.detail.withdrawal_bank"), value: bank },
            { label: t("payment.detail.account_no"),      value: `${acct} (${ccy})` },
            { label: t("payment.detail.total_transfer_amount"), value: totalAmount },
            { label: t("payment.detail.approval_ref"),    value: approvalRef },
            { label: t("payment.detail.requestor"),       value: requestor },
        ];
    }, [detail, mockRow, t]);

    // Result rows from the API when present; otherwise the static
    // Figma-24:6337 sample below. Per-row result badge derives from the
    // shared `deriveResultStatus` helper (canonical legacy mapping; see
    // `components/payment/shared/deriveResultStatus.ts`).
    const rows: DetailTransaction[] = useMemo(() => {
        if (detail && detail.rows && detail.rows.length > 0) {
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
        }
        return vendorResultDetailRows;
    }, [detail, id]);

    return (
        <ResultDetailView
            listTitle={t("payment.vendor.result_title")}
            subtitle={subtitle}
            backHref="/payment/vendor-payment/payment-result"
            summary={summary}
            file={{
                name: detail?.org_file_nm ?? "WeCMS_Vendor_Payment_upload_E.....xlsx",
                size: detail?.file_size
                    ? `${detail.file_size}`
                    : (mockRow?.fileSize ?? "108.69 KB"),
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

/**
 * Static 4-row sample matching Figma 24:6337 — same id always produces the
 * same rows. Mirrors the Internal Transfer Result detail layout: the
 * Success row (last) is intentionally left without a `bankingTxnId` so the
 * cell renders the Match CTA.
 */
const vendorResultDetailRows: DetailTransaction[] = [
    {
        id: "vrd-1",
        dateTime: "25-Mar-2026\n11:39:50",
        resultDateTime: "25-Mar-2026\n11:39:50",
        depositBank: "970458 - SHINHAN",
        depositBankCode: "970458",
        depositBankName: "SHINHAN",
        depositBankCurrency: "USD",
        accountNo: "40010023456914",
        recipientName: "NGUYEN NAPAS",
        transferAmount: "20.000.000",
        remark: "",
        reportingAccount: "2001019 - Payables",
        reportingAccountBreadcrumb: "Revenue > Sales",
        description: "",
        result: "failed",
    },
    {
        id: "vrd-2",
        dateTime: "25-Mar-2026\n11:39:50",
        depositBank: "970457 - WooriBank",
        depositBankCode: "970457",
        depositBankName: "WooriBank",
        depositBankCurrency: "USD",
        accountNo: "40010023456914",
        recipientName: "JOHN MICAH",
        transferAmount: "20.000.000",
        remark: "",
        reportingAccount: "2001019 - Payables",
        reportingAccountBreadcrumb: "Revenue > Sales",
        description: "",
        result: "pending",
    },
    {
        id: "vrd-3",
        dateTime: "25-Mar-2026\n11:39:50",
        resultDateTime: "25-Mar-2026\n11:39:50",
        depositBank: "970457 - WooriBank",
        depositBankCode: "970457",
        depositBankName: "WooriBank",
        depositBankCurrency: "USD",
        accountNo: "40010023456914",
        recipientName: "JOHN MICAH",
        transferAmount: "20.000.000",
        remark: "",
        reportingAccount: "",
        description: "",
        result: "failed",
    },
    {
        id: "vrd-4",
        dateTime: "25-Mar-2026\n11:39:50",
        resultDateTime: "25-Mar-2026\n10:07:08",
        depositBank: "970457 - WooriBank",
        depositBankCode: "970457",
        depositBankName: "WooriBank",
        depositBankCurrency: "USD",
        accountNo: "40010023456914",
        recipientName: "JOHN MICAH",
        transferAmount: "20.000.000",
        remark: "",
        reportingAccount: "2001019 - Payables",
        reportingAccountBreadcrumb: "Revenue > Sales",
        description: "",
        result: "success",
    },
];
