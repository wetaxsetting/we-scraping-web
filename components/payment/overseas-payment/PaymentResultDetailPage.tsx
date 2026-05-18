"use client";

import { useCallback, useMemo, useState } from "react";
import { notFound } from "next/navigation";

import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import { overseasResultDetailColumns, OVERSEAS_RESULT_DETAIL_MIN_WIDTH } from "@/components/payment/shared/detailColumns";
import type { DetailTransaction } from "@/components/payment/shared/detailMocks";
import type { ResultStatus } from "@/components/payment/shared/types";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import {
    fetchOverseasResultById,
    fetchOverseasPaymentDetail,
    downloadOverseasPaymentFile,
    type ApiOverseasPaymentExcelDetailRow,
} from "@/lib/api/payment";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";
import { todayDmy } from "@/lib/excel";
import { useExcelExport, type ExcelExportColumnConfig } from "@/hooks/useExcelExport";
import { SCREEN_IDS, DEFAULT_AREA_ID } from "@/lib/viewSettingScreens";

type OverseasPaymentResultDetailPageProps = { id: string };

/**
 * "Y" = transferred (success), "N" = failed (not transferred after dispatch),
 * anything else = pending / in-progress.
 */
function trnfYnToResult(trnfYn: string | undefined): ResultStatus {
    if (trnfYn === "Y") return "success";
    if (trnfYn === "N") return "failed";
    return "pending";
}

function mapDetailLine(
    line: ApiOverseasPaymentExcelDetailRow,
    batchCcy: string,
    batchId: string,
): DetailTransaction {
    return {
        id:                  `${batchId}-${line.trn_seq}`,
        trnSeq:              line.trn_seq,
        depositBank:         line.bnfc_bank_nm || line.bic_cd || "-",
        depositBankCode:     line.bic_cd || undefined,
        depositBankName:     line.bnfc_bank_nm || undefined,
        depositBankCurrency: line.ccy_cd || batchCcy,
        accountNo:           line.bnfc_acct_no || "-",
        recipientName:       line.bnfc_nm || "-",
        transferAmount:      line.trnf_amt?.toString() ?? "0",
        remark:              line.memo || "",
        bnfcAddr:            line.bnfc_addr || undefined,
        feePayer:            line.fee_payer_cd || undefined,
        reportingAccount:    line.rprt_acct_cd || "",
        reportingAccountUnassigned: !line.rprt_acct_cd,
        description:         line.memo || "",
        result:              trnfYnToResult(line.trnf_yn),
    };
}

const SCREEN_ID = SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_RESULT_DETAIL;

/** FALLBACK_COLUMNS — used when the VS API hasn't loaded yet.
 *  Mirrors the V163 corrective seed exactly. */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "TRN_SEQ",      field_nm: "Transaction Seq",         use_yn: "Y", fix_yn: "N", disp_ord: 1,  disp_yn: "Y" },
    { field_id: "BNFC_NM",      field_nm: "Beneficiary Name",        use_yn: "Y", fix_yn: "N", disp_ord: 2,  disp_yn: "Y" },
    { field_id: "BNFC_BANK_NM", field_nm: "Beneficiary Bank Name",   use_yn: "Y", fix_yn: "N", disp_ord: 3,  disp_yn: "Y" },
    { field_id: "BNFC_ACCT_NO", field_nm: "Beneficiary Account No.", use_yn: "Y", fix_yn: "N", disp_ord: 4,  disp_yn: "Y" },
    { field_id: "BNFC_ADDR",    field_nm: "Beneficiary Address",     use_yn: "Y", fix_yn: "N", disp_ord: 5,  disp_yn: "Y" },
    { field_id: "CCY_CD",       field_nm: "Transfer Currency",       use_yn: "Y", fix_yn: "N", disp_ord: 6,  disp_yn: "Y" },
    { field_id: "TRNF_AMT",     field_nm: "Transfer Amount",         use_yn: "Y", fix_yn: "N", disp_ord: 7,  disp_yn: "Y" },
    { field_id: "FEE_PAYER_CD", field_nm: "Fee Payer",               use_yn: "Y", fix_yn: "N", disp_ord: 8,  disp_yn: "Y" },
    { field_id: "MEMO",         field_nm: "Memo",                    use_yn: "Y", fix_yn: "N", disp_ord: 9,  disp_yn: "Y" },
    { field_id: "RPRT_ACCT_CD", field_nm: "Reporting Account",       use_yn: "Y", fix_yn: "N", disp_ord: 10, disp_yn: "Y" },
    { field_id: "TRNF_YN",      field_nm: "Status",                  use_yn: "Y", fix_yn: "N", disp_ord: 11, disp_yn: "Y" },
];

const EXPORT_COLUMNS: Record<string, ExcelExportColumnConfig> = {
    TRN_SEQ:       { headerKey: "payment.overseas.col.trn_seq",                format: "text",   widthChars: 14 },
    BNFC_NM:       { headerKey: "payment.overseas.col.beneficiary_name",       format: "text",   widthChars: 28 },
    BNFC_BANK_NM:  { headerKey: "payment.overseas.col.beneficiary_bank_name",  format: "text",   widthChars: 28 },
    BNFC_ACCT_NO:  { headerKey: "payment.overseas.col.beneficiary_account_no", format: "text",   widthChars: 24 },
    BNFC_ADDR:     { headerKey: "payment.overseas.col.beneficiary_address",    format: "text",   widthChars: 32 },
    CCY_CD:        { headerKey: "payment.overseas.col.transfer_currency",      format: "text",   widthChars: 14 },
    TRNF_AMT:      { headerKey: "payment.overseas.col.transfer_amount",        format: "amount", widthChars: 22 },
    FEE_PAYER_CD:  { headerKey: "payment.overseas.col.fee_payer",              format: "text",   widthChars: 14 },
    MEMO:          { headerKey: "payment.overseas.col.memo",                   format: "text",   widthChars: 32 },
    RPRT_ACCT_CD:  { headerKey: "payment.overseas.col.reporting_account",      format: "text",   widthChars: 24 },
    TRNF_YN:       { headerKey: "payment.overseas.col.status",                 format: "text",   widthChars: 16 },
};

/**
 * Payment > Overseas Payment > Payment Result > Details — Figma 29:17560.
 */
export default function OverseasPaymentResultDetailPage({
    id,
}: OverseasPaymentResultDetailPageProps) {
    const { t } = useTranslation();

    const vs = useViewSetting(SCREEN_ID, DEFAULT_AREA_ID);
    const [vsDraft, setVsDraft]   = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    const handleListView = useCallback((anchorRect: DOMRect) => {
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    }, [vs.items]);

    const closeViewSetting = useCallback(() => {
        setVsAnchor(null);
        setVsDraft(null);
    }, []);

    const triggerExport = useExcelExport();

    const { data: row, loading: loadingRow, error: errorRow } = useApiData(
        () => fetchOverseasResultById(id),
        [id],
    );

    const { data: detail, loading: loadingDetail } = useApiData(
        () => fetchOverseasPaymentDetail(id),
        [id],
    );

    const handleDownloadFile = useCallback(async () => {
        await downloadOverseasPaymentFile(id);
    }, [id]);

    const handleExport = useCallback(async () => {
        const items: ViewSettingItem[] = vs.items.length > 0
            ? vs.items
            : FALLBACK_COLUMNS;

        await triggerExport({
            endpoint: `/api/v1/payment/overseas-payment/result/${encodeURIComponent(id)}/export`,
            screenId: SCREEN_ID,
            dymAreaId: DEFAULT_AREA_ID,
            fileName: `OverseasPaymentResultDetail_${todayDmy()}`,
            title: t("payment.overseas.result_title"),
            items,
            columnConfig: EXPORT_COLUMNS,
            t,
            filters: { ovrsPymnNo: id },
        });
    }, [id, vs.items, triggerExport, t]);

    if (loadingRow || loadingDetail) return null;
    if (errorRow || !row) notFound();

    const subtitle = row.file_nm || row.titl || id;

    const summary = [
        { label: t("payment.detail.withdrawal_bank"), value: row.out_bank_nm || "-" },
        {
            label: t("payment.detail.account_no"),
            value: `${row.wdrl_act_no || "—"} (${row.ccy_cd})`,
        },
        {
            label: t("payment.detail.total_transfer_amount"),
            value: row.total_tran_amt?.toString() || "-",
        },
        { label: t("payment.detail.approval_ref"), value: row.doc_no || "-" },
        { label: t("payment.detail.requestor"), value: row.draft_user_nm || row.reg_id || "-" },
    ];

    const rows: DetailTransaction[] = (detail?.rows ?? []).map((line) =>
        mapDetailLine(line, row.ccy_cd, id),
    );

    // Use org_file_nm (original uploaded file name) from detail response; file_size from same.
    const fileName = detail?.org_file_nm || row.file_nm || null;
    const fileSize = detail?.file_size ?? "";

    return (
        <>
            <ResultDetailView
                listTitle={t("payment.overseas.result_title")}
                subtitle={subtitle}
                backHref="/payment/overseas-payment/payment-result"
                summary={summary}
                file={fileName ? { name: fileName, size: fileSize } : undefined}
                onDownloadFile={fileName ? handleDownloadFile : undefined}
                rows={rows}
                onExcelExport={handleExport}
                onListView={handleListView}
                searchableFields={[
                    "recipientName",
                    "accountNo",
                    "depositBankName",
                    "depositBank",
                    "remark",
                    "bnfcAddr",
                    "feePayer",
                    "reportingAccount",
                ]}
                columns={overseasResultDetailColumns(t)}
                tableMinWidth={OVERSEAS_RESULT_DETAIL_MIN_WIDTH}
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
