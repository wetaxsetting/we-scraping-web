"use client";

import { useCallback, useMemo, useState } from "react";
import { notFound } from "next/navigation";

import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import {
    overseasResultDetailColumns,
    OVERSEAS_RESULT_DETAIL_MIN_WIDTH,
} from "@/components/payment/shared/detailColumns";
import { deriveResultStatus } from "@/components/payment/shared/deriveResultStatus";
import { useBlockedChars } from "@/hooks/useBlockedChars";
import type {
    DetailTransaction,
    PaymentListColumn,
    ResultStatus,
} from "@/components/payment/shared/types";
import {
    ViewSettingPopover,
    isSpecialViewSettingField,
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
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { formatAmount } from "@/lib/currency";
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
    masterDispatched: boolean,
): DetailTransaction {
    // Phase 2: prefer the dispatch-result fields populated by
    // `DispatchResultResolver.resolveOverseas` on the backend. Fall back
    // to the legacy `trnf_yn` two-state mapping when proc_stat is null
    // (older batches that pre-date Phase 2 or local fixtures without a
    // bank-side daemon).
    const hasDispatchData =
        line.proc_stat != null || line.proc_stat_key != null || line.rs_cd != null;
    const result: ResultStatus = hasDispatchData
        ? deriveResultStatus(
              {
                  proc_stat:     line.proc_stat     ?? null,
                  proc_stat_key: line.proc_stat_key ?? null,
                  rslt_dttm:     line.rslt_dttm     ?? null,
                  rs_cd:         line.rs_cd         ?? null,
              },
              masterDispatched,
          )
        : trnfYnToResult(line.trnf_yn);
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
        resultDateTime:      line.rslt_dttm ?? undefined,
        result,
    };
}

const SCREEN_ID = SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_RESULT_DETAIL;

/** FALLBACK_COLUMNS — used when the VS API hasn't loaded yet.
 *  Mirrors the V236 legacy seed (pymn_0008_002) exactly. */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "PAY_TRAN_SEQ",  field_nm: "Transaction Seq",         use_yn: "Y", disp_ord: 1,  disp_yn: "Y", sort_yn: "Y", size: "150px" },
    { field_id: "BNFC_NM",       field_nm: "Beneficiary Name",        use_yn: "Y", disp_ord: 2,  disp_yn: "Y", sort_yn: "Y", size: "220px" },
    { field_id: "BNFC_BANK_NM",  field_nm: "Beneficiary Bank Name",   use_yn: "Y", disp_ord: 3,  disp_yn: "Y", sort_yn: "Y", size: "225px" },
    { field_id: "BNFC_ACCT_NO",  field_nm: "Beneficiary Account No.", use_yn: "Y", disp_ord: 4,  disp_yn: "Y", sort_yn: "Y", size: "200px" },
    { field_id: "BNFC_ADDR",     field_nm: "Beneficiary Address",     use_yn: "Y", disp_ord: 5,  disp_yn: "Y", sort_yn: "Y", size: "300px" },
    { field_id: "TRNF_CCY_CD",   field_nm: "Transfer Currency",       use_yn: "Y", disp_ord: 6,  disp_yn: "Y", sort_yn: "Y", size: "150px" },
    { field_id: "TRNF_AMT",      field_nm: "Transfer Amount",         use_yn: "Y", disp_ord: 7,  disp_yn: "Y", sort_yn: "Y", size: "160px" },
    { field_id: "FEE_PAYER",     field_nm: "Fee Payer",               use_yn: "Y", disp_ord: 8,  disp_yn: "Y", sort_yn: "N", size: "120px" },
    { field_id: "MEMO",          field_nm: "Memo",                    use_yn: "Y", disp_ord: 9,  disp_yn: "Y", sort_yn: "Y", size: "300px" },
    { field_id: "CHART_ACCT_CD", field_nm: "Reporting Account",       use_yn: "Y", disp_ord: 10, disp_yn: "Y", sort_yn: "Y", size: "300px" },
    { field_id: "PROC_STAT",     field_nm: "Status",                  use_yn: "Y", disp_ord: 11, disp_yn: "Y", sort_yn: "Y", size: "100px" },
    { field_id: "RSLT_DTTM",     field_nm: "Result Date/Time",        use_yn: "Y", disp_ord: 12, disp_yn: "Y", sort_yn: "Y", size: "130px" },
    { field_id: "BANK_TRAN_ID",  field_nm: "Banking Transaction ID",  use_yn: "Y", disp_ord: 13, disp_yn: "Y", sort_yn: "Y", size: "250px" },
    { field_id: "ETC",           field_nm: "",                        use_yn: "Y", disp_ord: 99, disp_yn: "Y", sort_yn: "N", size: "100px" },
];

/**
 * Map each View Setting `FIELD_ID` to the matching `PaymentListColumn.key`
 * produced by {@link overseasResultDetailColumns}. The page projects
 * visible View Setting items → columns using this map, then overrides
 * each column's `width` with the seed's `size` value.
 */
const FIELD_ID_TO_COLUMN_KEY: Record<string, string> = {
    PAY_TRAN_SEQ:  "trnSeq",
    BNFC_NM:       "recipientName",
    BNFC_BANK_NM:  "depositBankName",
    BNFC_ACCT_NO:  "accountNo",
    BNFC_ADDR:     "bnfcAddr",
    TRNF_CCY_CD:   "depositBankCurrency",
    TRNF_AMT:      "transferAmount",
    FEE_PAYER:     "feePayer",
    MEMO:          "remark",
    CHART_ACCT_CD: "reportingAccount",
    PROC_STAT:     "result",
    RSLT_DTTM:     "resultDateTime",
    BANK_TRAN_ID:  "bankingTxnId",
};

const EXPORT_COLUMNS: Record<string, ExcelExportColumnConfig> = {
    PAY_TRAN_SEQ:  { headerKey: "payment.overseas.col.trn_seq",                format: "text",   widthChars: 14 },
    BNFC_NM:       { headerKey: "payment.overseas.col.beneficiary_name",       format: "text",   widthChars: 28 },
    BNFC_BANK_NM:  { headerKey: "payment.overseas.col.beneficiary_bank_name",  format: "text",   widthChars: 28 },
    BNFC_ACCT_NO:  { headerKey: "payment.overseas.col.beneficiary_account_no", format: "text",   widthChars: 24 },
    BNFC_ADDR:     { headerKey: "payment.overseas.col.beneficiary_address",    format: "text",   widthChars: 32 },
    TRNF_CCY_CD:   { headerKey: "payment.overseas.col.transfer_currency",      format: "text",   widthChars: 14 },
    TRNF_AMT:      { headerKey: "payment.overseas.col.transfer_amount",        format: "amount", widthChars: 22 },
    FEE_PAYER:     { headerKey: "payment.overseas.col.fee_payer",              format: "text",   widthChars: 14 },
    MEMO:          { headerKey: "payment.overseas.col.memo",                   format: "text",   widthChars: 32 },
    CHART_ACCT_CD: { headerKey: "payment.overseas.col.reporting_account",      format: "text",   widthChars: 24 },
    PROC_STAT:     { headerKey: "payment.overseas.col.status",                 format: "text",   widthChars: 16 },
    RSLT_DTTM:     { headerKey: "payment.detail.col.result_datetime",          format: "text",   widthChars: 18 },
    BANK_TRAN_ID:  { headerKey: "payment.detail.col.banking_txn_id",           format: "text",   widthChars: 28 },
};

/**
 * Payment > Overseas Payment > Payment Result > Details — Figma 29:17560.
 *
 * Column projection is fully View-Setting-driven (legacy pymn_0008_002,
 * seeded by V236): order from disp_ord, visibility from use_yn, widths
 * from size, sortability from sort_yn. Sort is client-side over the
 * already-fetched per-batch result lines.
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

    /* Sticky-wrapped initial-loading gate. */
    const stickyInitialLoading = useStickyLoading(
        (loadingRow && !row) || (loadingDetail && !detail),
    );

    const blockedChars = useBlockedChars(row?.out_bank_cd, "OVER");

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

    // Resolve visible columns from the live View Setting (filtered to
    // use_yn='Y', dropping CHECKBOX/ETC specials + FIELD_IDs we don't
    // have a renderer for, sorted by disp_ord).
    const liveItems = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
    const visibleViewSettingItems: ViewSettingItem[] = useMemo(
        () =>
            liveItems
                .filter(
                    (it) =>
                        it.use_yn === "Y" &&
                        !isSpecialViewSettingField(it.field_id) &&
                        FIELD_ID_TO_COLUMN_KEY[it.field_id] !== undefined,
                )
                .slice()
                .sort((a, b) => a.disp_ord - b.disp_ord),
        [liveItems],
    );

    // Build the column list from the shared `overseasResultDetailColumns`
    // factory (canonical 13 renderers — 12 sortable, FEE_PAYER is
    // intentionally non-sortable per legacy pymn_0008_002) and override
    // each column's `width` with the live DB SIZE value.
    const columns: PaymentListColumn<DetailTransaction>[] = useMemo(() => {
        const baseColumns = overseasResultDetailColumns(t, { blockedChars });
        const columnByKey = new Map<string, PaymentListColumn<DetailTransaction>>(
            baseColumns.map((c) => [c.key, c]),
        );
        return visibleViewSettingItems
            .map((it) => {
                const key = FIELD_ID_TO_COLUMN_KEY[it.field_id];
                const base = columnByKey.get(key);
                if (!base) return null;
                // `it.size` wins when present; falls back to the factory's
                // default width so admin SQL updates on `size` propagate
                // to the UI without a frontend deploy.
                return { ...base, width: it.size || base.width };
            })
            .filter((c): c is PaymentListColumn<DetailTransaction> => c !== null);
    }, [t, blockedChars, visibleViewSettingItems]);

    // Sum visible-column widths so the inner table's min-width tracks
    // the visible set — hiding columns from the popover shrinks the
    // horizontal-scroll threshold proportionally.
    const dynamicMinWidth = useMemo(() => {
        const total = visibleViewSettingItems.reduce((sum, it) => {
            const m = (it.size ?? "").match(/^(\d+(?:\.\d+)?)px$/);
            return m ? sum + parseFloat(m[1]) : sum;
        }, 0);
        return total > 0 ? `${total}px` : OVERSEAS_RESULT_DETAIL_MIN_WIDTH;
    }, [visibleViewSettingItems]);

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
            value: formatAmount(row.total_tran_amt, row.ccy_cd, true),
        },
        { label: t("payment.detail.approval_ref"), value: row.doc_no || "-" },
        { label: t("payment.detail.requestor"), value: row.draft_user_nm || row.reg_id || "-" },
    ];

    const masterDispatched = row.trnf_yn === "Y";
    const rows: DetailTransaction[] = (detail?.rows ?? []).map((line) =>
        mapDetailLine(line, row.ccy_cd, id, masterDispatched),
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
                columns={columns}
                tableMinWidth={dynamicMinWidth}
                enableSort
                emptyMessage={t("payment.overseas.result_detail_empty")}
                loading={stickyInitialLoading}
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
