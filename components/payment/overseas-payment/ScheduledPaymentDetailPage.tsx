"use client";

import { notFound } from "next/navigation";
import { useCallback, useState } from "react";

import PaymentDetailPage from "@/components/payment/shared/PaymentDetailPage";
import {
    OVERSEAS_SCHEDULED_DETAIL_MIN_WIDTH,
    overseasScheduledDetailColumns,
    buildChartAccountOptions,
    type ChartAccountOption,
} from "@/components/payment/shared/detailColumns";
import type {
    DetailTransaction,
    PaymentListColumn,
} from "@/components/payment/shared/types";
import {
    ViewSettingPopover,
    isSpecialViewSettingField,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useDialog } from "@/components/shared/dialog";
import { useBlockedChars } from "@/hooks/useBlockedChars";
import { fetchChartOfAccounts } from "@/lib/api/chartOfAccounts";
import {
    fetchOverseasScheduledById,
    fetchOverseasPaymentDetail,
    saveOverseasReportingAccount,
    downloadOverseasPaymentReport,
    type ApiOverseasPaymentExcelDetailRow,
} from "@/lib/api/payment";
import { useApiData } from "@/lib/api/useApiData";
import { useStickyLoading } from "@/hooks/useStickyLoading";
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
        townName:      line.bnfc_town_nm || undefined,
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
 *
 * Column projection is fully View-Setting-driven: order, visibility,
 * width, sortability come from `sys_scr_option_wecms` (legacy
 * `pymn_0007_004`, seeded by V234). Sort is client-side over the
 * already-fetched per-batch line array, mirroring Vendor / Expense /
 * Payroll Scheduled Detail.
 */
export default function OverseasScheduledPaymentDetailPage({
    id,
}: OverseasScheduledDetailPageProps) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();

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

    /* Sticky-wrapped initial-loading gate — keeps "Loading…" inside the
     * detail body for ≥ 400 ms so the page doesn't flash on first paint.
     * Either the row OR the detail fetch being in flight (with no data
     * yet) keeps the gate true. */
    const stickyInitialLoading = useStickyLoading(
        (loadingRow && !row) || (loadingDetail && !detail),
    );

    const { data: chartData } = useApiData(() => fetchChartOfAccounts(), []);

    const blockedChars = useBlockedChars(row?.out_bank_cd, "OVER");

    // Local override map: rowId → rprt_acct_cd (null = cleared)
    const [overrides, setOverrides] = useState<Record<string, string | null>>({});

    const accounts: ChartAccountOption[] = buildChartAccountOptions(chartData?.items ?? []);

    const handleDownloadFile = useCallback(async () => {
        await downloadOverseasPaymentReport(id, locale);
    }, [id, locale]);

    const handleSelectReportingAccount = useCallback(
        async (rowId: string, code: string | null, seqNo: string | null) => {
            // rowId format: "{batchId}-{trnSeq}"
            const trnSeq = parseInt(rowId.split("-").pop() ?? "", 10);
            if (isNaN(trnSeq)) return;
            try {
                // Persist BOTH the code and the seq_no (legacy
                // pymn_0007_001_u001 parity — CHART_ACCT_SEQ_NO is the
                // CHART_ACCT_INFM PK identity, the code alone is non-unique).
                await saveOverseasReportingAccount(id, trnSeq, code, seqNo);
                setOverrides((prev) => ({ ...prev, [rowId]: code }));
            } catch (err) {
                // Surface the failure — never swallow it silently, or the
                // user thinks the assignment saved when it did not.
                const e = err as { code?: string; message?: string; traceId?: string };
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: e.message ?? "Failed to save reporting account",
                    errorCode: e.code,
                    uuid: e.traceId,
                });
            }
        },
        [id, dialog, t],
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
        // Requestor = legacy EXPT_RESOL_MSTR.DRAFT_USER_NM (발의자명). BLANK when
        // null (draft — no approval request yet), matching legacy
        // `null2void(DRAFT_USER_NM)`. Do NOT fall back to reg_id (creator LOGIN
        // id / email) — legacy never shows it in this column.
        { label: t("payment.detail.requestor"), value: row.draft_user_nm || "" },
    ];

    // File card — original uploaded Excel name + size from the DETAIL
    // response (org_file_nm / file_size), matching Payroll / Expense and the
    // Overseas Result detail. The list `row.file_nm` is a fallback only; the
    // size must come from the detail response (was previously hardcoded "").
    const fileName = detail?.org_file_nm || row.file_nm || null;
    const fileSize = detail?.file_size ?? "";

    const rows: DetailTransaction[] = (detail?.rows ?? []).map((line) => {
        const base = mapDetailLine(line, row.ccy_cd, id);
        const rowId = base.id;
        const hasOverride = Object.prototype.hasOwnProperty.call(overrides, rowId);
        const code = hasOverride ? overrides[rowId] : (line.rprt_acct_cd || null);
        // Resolve "code - name" + parent-trail breadcrumb from the shared
        // option list (matches Transaction History).
        const acct = code ? accounts.find((a) => a.code === code) : undefined;
        return {
            ...base,
            reportingAccount: acct ? `${acct.code} - ${acct.nameEn}` : (code ?? ""),
            reportingAccountUnassigned: !code,
            reportingAccountBreadcrumb: acct?.breadcrumb ?? undefined,
        };
    });

    // Resolve visible columns from the live View Setting (filtered to
    // use_yn='Y', dropping CHECKBOX/ETC specials + FIELD_IDs we don't
    // have a renderer for, sorted by disp_ord). Falls back to V234
    // legacy widths until the API resolves.
    const liveItems = vs.items.length > 0 ? vs.items : FALLBACK_DETAIL_COLUMNS;
    const visibleViewSettingItems: ViewSettingItem[] = liveItems
        .filter(
            (it) =>
                it.use_yn === "Y" &&
                !isSpecialViewSettingField(it.field_id) &&
                FIELD_ID_TO_COLUMN_KEY[it.field_id] !== undefined,
        )
        .slice()
        .sort((a, b) => a.disp_ord - b.disp_ord);

    // Build the column list from the shared
    // `overseasScheduledDetailColumns` factory (canonical 10 renderers,
    // all sortable: true with a numeric sortValue for Transfer Amount)
    // and override each column's `width` with the live DB SIZE value
    // (Approval Box pattern).
    const baseColumns = overseasScheduledDetailColumns(t, {
        accounts,
        onSelectReportingAccount: handleSelectReportingAccount,
        blockedChars,
    });
    const columnByKey = new Map<string, PaymentListColumn<DetailTransaction>>(
        baseColumns.map((c) => [c.key, c]),
    );
    const columns: PaymentListColumn<DetailTransaction>[] = visibleViewSettingItems
        .map((it) => {
            const key = FIELD_ID_TO_COLUMN_KEY[it.field_id];
            const base = columnByKey.get(key);
            if (!base) return null;
            // `it.size` wins when present; falls back to the factory's
            // default width so admin SQL updates on `size` propagate to
            // the UI without a frontend deploy.
            return { ...base, width: it.size || base.width };
        })
        .filter((c): c is PaymentListColumn<DetailTransaction> => c !== null);

    // Sum visible-column widths so the inner table's min-width tracks
    // the visible set — hiding columns from the popover shrinks the
    // horizontal-scroll threshold proportionally.
    const dynamicMinWidth = (() => {
        const total = visibleViewSettingItems.reduce((sum, it) => {
            const m = (it.size ?? "").match(/^(\d+(?:\.\d+)?)px$/);
            return m ? sum + parseFloat(m[1]) : sum;
        }, 0);
        return total > 0 ? `${total}px` : OVERSEAS_SCHEDULED_DETAIL_MIN_WIDTH;
    })();

    return (
        <>
            <PaymentDetailPage<DetailTransaction>
                listTitle={t("payment.overseas.scheduled_title")}
                subtitle={subtitle}
                backHref="/payment/overseas-payment/scheduled-payment"
                summary={summary}
                file={fileName ? { name: fileName, size: fileSize } : undefined}
                onDownloadFile={fileName ? handleDownloadFile : undefined}
                // Cap the file card to the same compact width as the other
                // modules — Overseas upload filenames are longer and would
                // otherwise stretch the content-sized card past the summary.
                // The name truncates with a hover tooltip (FileCard `title`).
                fileCardClassName="max-w-[440px]"
                columns={columns}
                rows={rows}
                minWidth={dynamicMinWidth}
                onListView={handleListView}
                // Client-side sort over the already-fetched per-batch
                // line array — same pattern as Vendor / Expense / Payroll
                // Scheduled Detail. Per-column `sortable` + `sortValue`
                // come from `overseasScheduledDetailColumns`.
                enableSort
                emptyMessage={t("payment.overseas.scheduled_detail_empty")}
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

/** Mirror of the V234 SYS_SCR_OPTION_WECMS seed — paint-time fallback
 *  so the popover doesn't flash empty while the API resolves. */
const FALLBACK_DETAIL_COLUMNS: ViewSettingItem[] = [
    { field_id: "BNFC_NM",       field_nm: "Beneficiary Name",        disp_ord: 1,  disp_yn: "Y", use_yn: "Y", size: "180px", sort_yn: "Y" },
    { field_id: "BNFC_BANK_NM",  field_nm: "Beneficiary Bank Name",   disp_ord: 2,  disp_yn: "Y", use_yn: "Y", size: "220px", sort_yn: "Y" },
    { field_id: "BNFC_ACCT_NO",  field_nm: "Beneficiary Account No.", disp_ord: 3,  disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "BNFC_ADDR",     field_nm: "Beneficiary Address",     disp_ord: 4,  disp_yn: "Y", use_yn: "Y", size: "200px", sort_yn: "Y" },
    { field_id: "BNFC_TOWN_NM",  field_nm: "Town Name",               disp_ord: 5,  disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "CHART_ACCT_CD", field_nm: "Reporting Account",       disp_ord: 6,  disp_yn: "Y", use_yn: "Y", size: "200px", sort_yn: "Y" },
    { field_id: "TRNF_CCY_CD",   field_nm: "Transfer Currency",       disp_ord: 7,  disp_yn: "Y", use_yn: "Y", size: "120px", sort_yn: "Y" },
    { field_id: "TRNF_AMT",      field_nm: "Transfer Amount",         disp_ord: 8,  disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "FEE_PAYER_CD",  field_nm: "Fee Payer",               disp_ord: 9,  disp_yn: "Y", use_yn: "Y", size: "80px",  sort_yn: "Y" },
    { field_id: "MEMO",          field_nm: "Memo",                    disp_ord: 10, disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "BANK_TRAN_ID",  field_nm: "Banking Transaction ID",  disp_ord: 11, disp_yn: "Y", use_yn: "Y", size: "250px", sort_yn: "Y" },
];

/**
 * Map each View Setting `FIELD_ID` to the matching `PaymentListColumn.key`
 * produced by {@link overseasScheduledDetailColumns}. The page projects
 * visible View Setting items → columns using this map, then overrides
 * each column's `width` with the seed's `size` value.
 */
const FIELD_ID_TO_COLUMN_KEY: Record<string, string> = {
    BNFC_NM:       "recipientName",
    BNFC_BANK_NM:  "depositBankName",
    BNFC_ACCT_NO:  "accountNo",
    BNFC_ADDR:     "bnfcAddr",
    BNFC_TOWN_NM:  "townName",
    CHART_ACCT_CD: "reportingAccount",
    TRNF_CCY_CD:   "depositBankCurrency",
    TRNF_AMT:      "transferAmount",
    FEE_PAYER_CD:  "feePayer",
    MEMO:          "remark",
    BANK_TRAN_ID:  "bankingTxnId",
};
