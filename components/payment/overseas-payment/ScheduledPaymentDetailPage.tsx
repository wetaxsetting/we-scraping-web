"use client";

import { notFound } from "next/navigation";
import { useCallback, useState } from "react";

import PaymentDetailPage from "@/components/payment/shared/PaymentDetailPage";
import {
    SCHEDULED_DETAIL_MIN_WIDTH,
    scheduledDetailColumns,
    type ChartAccountOption,
} from "@/components/payment/shared/detailColumns";
import type { DetailTransaction } from "@/components/payment/shared/types";
import { fetchChartOfAccounts } from "@/lib/api/chartOfAccounts";
import {
    fetchOverseasScheduledById,
    fetchOverseasPaymentDetail,
    saveOverseasReportingAccount,
    downloadOverseasPaymentFile,
    type ApiOverseasPaymentExcelDetailRow,
} from "@/lib/api/payment";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";

type OverseasScheduledDetailPageProps = { id: string };

function mapDetailLine(
    line: ApiOverseasPaymentExcelDetailRow,
    batchCcy: string,
    batchId: string,
): DetailTransaction {
    return {
        id:            `${batchId}-${line.trn_seq}`,
        depositBank:   line.bnfc_bank_nm || line.bic_cd || "-",
        depositBankCode: line.bic_cd || undefined,
        depositBankName: line.bnfc_bank_nm || undefined,
        depositBankCurrency: line.ccy_cd || batchCcy,
        accountNo:     line.bnfc_acct_no || "-",
        recipientName: line.bnfc_nm || "-",
        transferAmount: line.trnf_amt?.toString() ?? "0",
        remark:        line.memo || "",
        reportingAccount: line.rprt_acct_cd || "",
        reportingAccountUnassigned: !line.rprt_acct_cd,
        description:   line.memo || "",
    };
}

/**
 * Payment > Overseas Payment > Scheduled Payment > Details — Figma 29:15858.
 */
export default function OverseasScheduledPaymentDetailPage({
    id,
}: OverseasScheduledDetailPageProps) {
    const { t } = useTranslation();

    const { data: row, loading: loadingRow, error: errorRow } = useApiData(
        () => fetchOverseasScheduledById(id),
        [id],
    );

    const { data: detail, loading: loadingDetail } = useApiData(
        () => fetchOverseasPaymentDetail(id),
        [id],
    );

    const { data: chartData } = useApiData(() => fetchChartOfAccounts(), []);

    // Local override map: rowId → rprt_acct_cd (null = cleared)
    const [overrides, setOverrides] = useState<Record<string, string | null>>({});

    const accounts: ChartAccountOption[] = (chartData?.items ?? []).map((a) => ({
        seqNo:  a.chart_acct_seq_no,
        code:   a.chart_acct_cd,
        nameEn: a.chart_acct_nm_en,
    }));

    const handleDownloadFile = useCallback(async () => {
        await downloadOverseasPaymentFile(id);
    }, [id]);

    const handleSelectReportingAccount = useCallback(
        async (rowId: string, code: string | null) => {
            // rowId format: "{batchId}-{trnSeq}"
            const trnSeq = parseInt(rowId.split("-").pop() ?? "", 10);
            if (isNaN(trnSeq)) return;
            try {
                await saveOverseasReportingAccount(id, trnSeq, code);
                setOverrides((prev) => ({ ...prev, [rowId]: code }));
            } catch {
                // silently ignore — user stays on the page
            }
        },
        [id],
    );

    if (loadingRow || loadingDetail) return null;
    if (errorRow || !row) notFound();

    const subtitle = row.file_nm || row.titl || id;

    const fromAccount = row.wdrl_act_no;
    const summary = [
        { label: t("payment.detail.withdrawal_bank"), value: row.out_bank_nm || "-" },
        {
            label: t("payment.detail.account_no"),
            value: fromAccount ? `${fromAccount} (${row.ccy_cd})` : "—",
        },
        { label: t("payment.detail.total_transfer_amount"), value: row.total_tran_amt?.toString() || "-" },
        { label: t("payment.detail.approval_ref"), value: row.doc_no || "-" },
        { label: t("payment.detail.requestor"), value: row.draft_user_nm || row.reg_id || "-" },
    ];

    const rows: DetailTransaction[] = (detail?.rows ?? []).map((line) => {
        const base = mapDetailLine(line, row.ccy_cd, id);
        const rowId = base.id;
        if (Object.prototype.hasOwnProperty.call(overrides, rowId)) {
            const code = overrides[rowId];
            return { ...base, reportingAccount: code ?? "", reportingAccountUnassigned: !code };
        }
        return base;
    });

    return (
        <PaymentDetailPage<DetailTransaction>
            listTitle={t("payment.overseas.scheduled_title")}
            subtitle={subtitle}
            backHref="/payment/overseas-payment/scheduled-payment"
            summary={summary}
            file={row.file_nm ? { name: row.file_nm, size: "" } : undefined}
            onDownloadFile={row.file_nm ? handleDownloadFile : undefined}
            columns={scheduledDetailColumns(t, {
                accounts,
                onSelectReportingAccount: handleSelectReportingAccount,
            })}
            rows={rows}
            minWidth={SCHEDULED_DETAIL_MIN_WIDTH}
            getRowClass={(r) => (r.reportingAccount ? "bg-amber-50" : undefined)}
        />
    );
}
