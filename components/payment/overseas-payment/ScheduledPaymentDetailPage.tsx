"use client";

import { notFound } from "next/navigation";
import { useCallback, useState } from "react";

import PaymentDetailPage from "@/components/payment/shared/PaymentDetailPage";
import {
    OVERSEAS_SCHEDULED_DETAIL_MIN_WIDTH,
    overseasScheduledDetailColumns,
    type ChartAccountOption,
} from "@/components/payment/shared/detailColumns";
import type { DetailTransaction } from "@/components/payment/shared/types";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useBlockedChars } from "@/hooks/useBlockedChars";
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
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

type OverseasScheduledDetailPageProps = { id: string };

/** Legacy {@code FEE_PAYER_CD} → label mapping (pymn_0007_004.ts:420-424). */
const FEE_PAYER_LABEL: Record<string, string> = {
    B: "Beneficiary charged",
    O: "Ordering Charge",
    S: "Shared",
};

function mapDetailLine(
    line: ApiOverseasPaymentExcelDetailRow,
    batchCcy: string,
    batchId: string,
): DetailTransaction {
    return {
        id:            `${batchId}-${line.trn_seq}`,
        trnSeq:        line.trn_seq ?? undefined,
        depositBank:   line.bnfc_bank_nm || line.bic_cd || "-",
        depositBankCode: line.bic_cd || undefined,
        depositBankName: line.bnfc_bank_nm || undefined,
        depositBankCurrency: line.ccy_cd || batchCcy,
        accountNo:     line.bnfc_acct_no || "-",
        recipientName: line.bnfc_nm || "-",
        bnfcAddr:      line.bnfc_addr || undefined,
        transferAmount: line.trnf_amt?.toString() ?? "0",
        feePayer:      FEE_PAYER_LABEL[line.fee_payer_cd ?? ""] || line.fee_payer_cd || "",
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

    /* ── View Setting popover state (legacy `pymn_0007_004` view-sort) ─ */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_SCHEDULED_DETAIL,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft]   = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    const handleListView = useCallback((anchorRect: DOMRect) => {
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_DETAIL_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    }, [vs.items]);
    const closeViewSetting = useCallback(() => {
        setVsAnchor(null);
        setVsDraft(null);
    }, []);

    const { data: row, loading: loadingRow, error: errorRow } = useApiData(
        () => fetchOverseasScheduledById(id),
        [id],
    );

    const { data: detail, loading: loadingDetail } = useApiData(
        () => fetchOverseasPaymentDetail(id),
        [id],
    );

    const { data: chartData } = useApiData(() => fetchChartOfAccounts(), []);

    const blockedChars = useBlockedChars(row?.out_bank_cd, "OVER");

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
        <>
            <PaymentDetailPage<DetailTransaction>
                listTitle={t("payment.overseas.scheduled_title")}
                subtitle={subtitle}
                backHref="/payment/overseas-payment/scheduled-payment"
                summary={summary}
                file={row.file_nm ? { name: row.file_nm, size: "" } : undefined}
                onDownloadFile={row.file_nm ? handleDownloadFile : undefined}
                columns={overseasScheduledDetailColumns(t, {
                    accounts,
                    onSelectReportingAccount: handleSelectReportingAccount,
                    blockedChars,
                })}
                rows={rows}
                minWidth={OVERSEAS_SCHEDULED_DETAIL_MIN_WIDTH}
                onListView={handleListView}
            />
            {vsAnchor && vsDraft && (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={(next) => setVsDraft(next)}
                    getLabel={(item) => item.field_nm || item.field_id}
                    onSave={async () => {
                        try { await vs.save(vsDraft); }
                        finally { closeViewSetting(); }
                    }}
                    onReset={async () => {
                        const next = await vs.reset();
                        setVsDraft(next.map((it) => ({ ...it })));
                    }}
                    onClose={closeViewSetting}
                />
            )}
        </>
    );
}

/** Mirror of the V214 SYS_SCR_OPTION_WECMS seed — paint-time fallback
 *  so the popover doesn't flash empty while the API resolves. */
const FALLBACK_DETAIL_COLUMNS: ViewSettingItem[] = [
    { field_id: "BNFC_NM",       field_nm: "Beneficiary Name",        disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "N" },
    { field_id: "BNFC_BANK_NM",  field_nm: "Beneficiary Bank Name",   disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "N" },
    { field_id: "BNFC_ACCT_NO",  field_nm: "Beneficiary Account No.", disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "N" },
    { field_id: "BNFC_ADDR",     field_nm: "Beneficiary Address",     disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "220px", sort_yn: "N" },
    { field_id: "TRNF_CCY_CD",   field_nm: "Transfer Currency",       disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "N" },
    { field_id: "TRNF_AMT",      field_nm: "Transfer Amount",         disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "138px", sort_yn: "N" },
    { field_id: "FEE_PAYER_CD",  field_nm: "Fee Payer",               disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "150px", sort_yn: "N" },
    { field_id: "MEMO",          field_nm: "Memo",                    disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "N" },
    { field_id: "CHART_ACCT_CD", field_nm: "Reporting Account",       disp_ord: 9,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "220px", sort_yn: "N" },
    { field_id: "BANK_TRAN_ID",  field_nm: "Banking Transaction ID",  disp_ord: 10, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "175px", sort_yn: "N" },
];
