"use client";

import { useCallback, useMemo, useState } from "react";
import { notFound } from "next/navigation";

import PaymentDetailPage from "@/components/payment/shared/PaymentDetailPage";
import {
    SCHEDULED_DETAIL_MIN_WIDTH,
    scheduledDetailColumns,
    type ChartAccountOption,
} from "@/components/payment/shared/detailColumns";
import type {
    DetailTransaction,
    PaymentListColumn,
} from "@/components/payment/shared/types";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    isSpecialViewSettingField,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useBlockedChars } from "@/hooks/useBlockedChars";
import { ApiCallError } from "@/lib/api/banking";
import { fetchChartOfAccounts } from "@/lib/api/chartOfAccounts";
import { useApiData } from "@/lib/api/useApiData";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import {
    downloadOriginalVendorExcel,
    fetchVendorPaymentDetail,
    updateVendorReportingAccount,
} from "@/lib/api/vendorPayment";
import { formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";


type VendorScheduledDetailPageProps = { id: string };

/**
 * Payment > Vendor Payment > Scheduled Payment > Details — Figma 24:4705.
 *
 * Phase B (real backend): wires `GET /api/v1/payment/vendor-payment/{id}`.
 * Falls back to static mock when the API returns nothing (e.g. the user
 * deep-links to a mock-only id during local dev). Mirrors Internal
 * Transfer Scheduled Detail (Figma 8:599).
 */
export default function VendorScheduledPaymentDetailPage({
    id,
}: VendorScheduledDetailPageProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    /* ── View Setting popover state (legacy `pymn_0001_003` view-sort) ─ */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_VENDOR_PAYMENT_SCHEDULED_DETAIL,
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

    /* ── Excel download (legacy `pymn_0001_003` file-card glyph) ─────── */
    const handleDownloadFile = useCallback(async () => {
        try {
            await downloadOriginalVendorExcel(id);
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError
                ? err.message
                : t("payment.internal.download_failed");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        }
    }, [id, dialog, t]);

    const state = useApiData(() => fetchVendorPaymentDetail(id), [id]);
    const detail = state.data;

    /* Sticky-wrapped initial-loading gate — keeps the centered
     * "Loading…" message inside the detail table body visible
     * ≥ 400 ms so the page doesn't flash empty → table on first paint. */
    const stickyInitialLoading = useStickyLoading(state.loading && !detail);

    /* ── Chart-of-accounts list for the Reporting Account picker
     *    (legacy `pymn_0001_003` `#CHART_ACCT_CD` autocomplete). ── */
    const { data: chartData } = useApiData(
        () => fetchChartOfAccounts({ sortField: "CHART_ACCT_CD", sortDir: "ASC" }),
        [],
    );
    const chartAccounts: ChartAccountOption[] = useMemo(
        () => (chartData?.items ?? []).map((a) => ({
            seqNo:  a.chart_acct_seq_no,
            code:   a.chart_acct_cd,
            nameEn: a.chart_acct_nm_en,
        })),
        [chartData],
    );

    /* ── Local override map for picker selections (rowId → code/null).
     *    On select we optimistically update the cell, then PATCH the
     *    backend; rollback on error. The "Clear" action (null code) is
     *    a UI-only no-op until the backend grows a DELETE endpoint —
     *    matches Internal Transfer's surface. */
    const [reportingOverrides, setReportingOverrides] = useState<Record<string, string | null>>({});
    const handleSelectReportingAccount = useCallback(
        async (rowId: string, code: string | null) => {
            // Optimistic UI update — picker closes immediately.
            const prevSnapshot = reportingOverrides[rowId];
            setReportingOverrides((prev) => ({ ...prev, [rowId]: code }));

            // No backend call for "Clear" (null); UI-only for now.
            if (code === null) return;

            // rowId = `${id}-${scdulPymnDetlNo}` — split on the FIRST dash
            // so a multi-dash batch id still keeps the detail-no suffix.
            const dashIdx = rowId.indexOf("-");
            const detlNo  = dashIdx >= 0 ? rowId.slice(dashIdx + 1) : "";
            if (!detlNo) return;

            const account = chartAccounts.find((a) => a.code === code);
            if (!account) return;  // picker only exposes codes from this list

            try {
                await updateVendorReportingAccount(id, detlNo, {
                    chart_acct_seq_no: account.seqNo,
                    chart_acct_cd:     account.code,
                });
            } catch (err) {
                // Rollback the optimistic update on failure.
                setReportingOverrides((prev) => {
                    const next = { ...prev };
                    if (prevSnapshot === undefined) delete next[rowId];
                    else next[rowId] = prevSnapshot;
                    return next;
                });
                const errorCode = err instanceof ApiCallError ? err.code    : "WBE9999";
                const message   = err instanceof ApiCallError ? err.message : t("payment.detail.reporting_account.save_failed");
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: message,
                    errorCode,
                });
            }
        },
        [id, chartAccounts, reportingOverrides, dialog, t],
    );

    if (state.error instanceof ApiCallError && state.error.code === "WBE2060") {
        notFound();
    }

    const subtitle = detail?.titl ?? "";

    const summary = useMemo(() => {
        const bank        = detail?.out_bank_cd  ?? "";
        const acct        = detail?.wdrl_act_no  ?? "";
        const ccy         = detail?.wdrl_ccy_cd ?? detail?.ccy_cd ?? "";
        const totalAmount = detail ? formatNumber(detail.total_tran_amt) : "";
        const approvalRef = detail?.doc_no ?? "";
        const requestor   = detail?.reg_id       ?? "";
        return [
            { label: t("payment.detail.withdrawal_bank"),    value: bank },
            { label: t("payment.detail.account_no"),         value: acct ? `${acct} (${ccy})` : "" },
            { label: t("payment.detail.total_transfer_amount"), value: totalAmount },
            { label: t("payment.detail.approval_ref"),       value: approvalRef },
            { label: t("payment.detail.requestor"),          value: requestor },
        ];
    }, [detail, t]);

    const rows: DetailTransaction[] = useMemo(() => {
        if (!detail?.rows) return [];
        return detail.rows.map((line, idx) => {
            const rowId = `${id}-${line.scdul_pymn_detl_no || idx}`;
            const baseCode = line.chart_acct_cd ?? null;
            const baseReportingAccount = baseCode
                ? (line.chart_acct_seq_no
                    ? `${baseCode} - ${line.chart_acct_seq_no}`
                    : baseCode)
                : "";
            const baseBreadcrumb = line.chart_acct_breadcrumb ?? undefined;
            // Layer the picker's local override on top of the wire value.
            const override = Object.prototype.hasOwnProperty.call(reportingOverrides, rowId)
                ? reportingOverrides[rowId]
                : undefined;
            const effectiveCode = override !== undefined ? override : baseCode;
            const reportingAccount = effectiveCode ?? "";
            // When the user picks a fresh code we don't have a server-side
            // breadcrumb for it — clear the muted sub-line so the cell
            // doesn't render a stale parent chain.
            const reportingAccountBreadcrumb = override !== undefined
                ? undefined
                : baseBreadcrumb;
            return {
                id:                  rowId,
                depositBank:         line.tar_bank_cd ?? "",
                depositBankCode:     line.tar_bank_cd ?? "",
                // Server-resolved bank name (legacy
                // `wb_get_napas_bank_nm_or_citad_bank_nm`). Empty when the
                // lookup misses — `<DepositBankCell>` drops the " - "
                // separator so the cell renders cleanly.
                depositBankName:     line.tar_bank_nm ?? "",
                depositBankCurrency: line.depo_ccy_cd ?? line.ccy_cd ?? detail.ccy_cd ?? "",
                accountNo:           line.finc_mda_no ?? "",
                recipientName:       line.rcpt_nm ?? "",
                transferAmount:      formatNumber(line.tran_amt),
                // Legacy WSVC field mapping (V222 + pymn_0001_003 PROD):
                //   • TRAN_USAG → "Remarks"      column → row.remark
                //   • NOTE      → "Description"  column → row.description
                // V142 had these swapped; fixed alongside the seed update.
                remark:              line.tran_usag ?? "",
                reportingAccount,
                reportingAccountUnassigned: !reportingAccount,
                reportingAccountBreadcrumb,
                description:         line.note ?? "",
                documentNo:          line.doc_no ?? undefined,
                bankingTxnId:        line.bank_trns_short_id ?? undefined,
            };
        });
    }, [detail, id, reportingOverrides]);

    // Resolve visible columns from the live View Setting (filtered to
    // use_yn='Y', dropping CHECKBOX/ETC specials + FIELD_IDs we don't
    // have a renderer for, sorted by disp_ord). Falls back to V222
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

    const fileName = detail?.org_file_nm ?? "";
    const fileSize = detail?.file_size ? `${detail.file_size}` : "";

    // Bank-specific blocked-chars tooltip — drives the Remarks ⓘ +
    // Recipient Name ⓘ glyphs in the shared column factory. Keys on
    // the withdrawal bank + VEND PymnType so the tooltip surfaces
    // exactly what `SpecialCharValidator` rejects for this upload.
    const blockedChars = useBlockedChars(detail?.out_bank_cd, "VEND");

    // Build the column list from the shared `scheduledDetailColumns`
    // factory and override each column's `width` with the live DB SIZE
    // value. The factory already supplies the canonical renderers
    // (DepositBankCell, ReportingAccountCell with the chart-account
    // picker, etc.) and sets `sortable: true` on every column.
    const baseColumns = scheduledDetailColumns(t, {
        blockedChars,
        accounts: chartAccounts,
        onSelectReportingAccount: handleSelectReportingAccount,
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
            // the UI without a frontend deploy (parity with Approval Box).
            return { ...base, width: it.size || base.width };
        })
        .filter((c): c is PaymentListColumn<DetailTransaction> => c !== null);

    // Sum visible column widths so the inner table's min-width tracks
    // the visible set — hiding columns from the popover shrinks the
    // horizontal-scroll trigger point. Falls back to the static
    // SCHEDULED_DETAIL_MIN_WIDTH constant when widths aren't px-suffixed.
    const dynamicMinWidth = (() => {
        const total = visibleViewSettingItems.reduce((sum, it) => {
            const m = (it.size ?? "").match(/^(\d+(?:\.\d+)?)px$/);
            return m ? sum + parseFloat(m[1]) : sum;
        }, 0);
        return total > 0 ? `${total}px` : SCHEDULED_DETAIL_MIN_WIDTH;
    })();

    return (
        <>
            <PaymentDetailPage<DetailTransaction>
                listTitle={t("payment.vendor.scheduled_title")}
                subtitle={subtitle}
                backHref="/payment/vendor-payment/scheduled-payment"
                summary={summary}
                file={{ name: fileName, size: fileSize }}
                columns={columns}
                rows={rows}
                minWidth={dynamicMinWidth}
                // Client-side keyword filter — mirrors legacy
                // `pymn_0001_003` `#SRCH_WD` filter, but operates on
                // the already-loaded line set (the detail endpoint
                // returns every line for the batch). Searchable
                // fields cover the Figma 24:4705 visible cells.
                searchableFields={[
                    "depositBank",
                    "depositBankCode",
                    "depositBankName",
                    "accountNo",
                    "recipientName",
                    "remark",
                    "description",
                    "documentNo",
                    "reportingAccount",
                ]}
                onDownloadFile={handleDownloadFile}
                onListView={handleListView}
                // Client-side sort over the already-fetched per-batch line
                // array — same pattern as Internal Transfer Scheduled Detail.
                // Cycle (default → ASC → DESC → default) owned by the
                // shared `<PaymentDetailPage>` sort manager; per-column
                // `sortable` + `sortValue` come from `scheduledDetailColumns`.
                enableSort
                emptyMessage={t("payment.vendor.scheduled_detail_empty")}
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

/**
 * Mirror of the V222 SYS_SCR_OPTION_WECMS seed for
 * `payment-vendor-payment-scheduled-detail` / `default`. Paint-time
 * fallback used while the API resolves so the popover never renders
 * empty on first click and the table doesn't flash with wrong widths.
 *
 * Aligned with legacy `pymn_0001_003` PROD widths + FIELD_IDs:
 *   TAR_BANK_CD, RCPT_NM, TRAN_AMT, TRAN_USAG (Remarks),
 *   CHART_ACCT_CD (Reporting Account), NOTE (Description), DOC_NO,
 *   BANK_TRAN_ID (Banking Transaction ID).
 *
 * Legacy WSVC label quirks preserved verbatim (same as Internal
 * Transfer Scheduled Detail):
 *   • TRAN_USAG → "Remarks" column (NOT "Description")
 *   • NOTE      → "Description" column (NOT "Remark")
 */
const FALLBACK_DETAIL_COLUMNS: ViewSettingItem[] = [
    { field_id: "TAR_BANK_CD",   field_nm: "Deposit Bank",           disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "RCPT_NM",       field_nm: "Recipient Name",         disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "350px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",      field_nm: "Transfer Amount",        disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "150px", sort_yn: "Y" },
    { field_id: "TRAN_USAG",     field_nm: "Remarks",                disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "300px", sort_yn: "Y" },
    { field_id: "CHART_ACCT_CD", field_nm: "Reporting Account",      disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "NOTE",          field_nm: "Description",            disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "DOC_NO",        field_nm: "Document No.",           disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "BANK_TRAN_ID",  field_nm: "Banking Transaction ID", disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "250px", sort_yn: "Y" },
    { field_id: "ETC",           field_nm: "",                       disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "60px",  sort_yn: "N" },
];

/**
 * Map each View Setting `FIELD_ID` to the matching `PaymentListColumn.key`
 * produced by {@link scheduledDetailColumns}. The page projects visible
 * View Setting items → columns using this map, then overrides each
 * column's `width` with the seed's `size` value (DB-driven, per the
 * Approval Box pattern).
 *
 * Legacy WSVC field-name quirks (also documented in the Internal Transfer
 * Scheduled Detail page):
 *   • `TRAN_USAG` → row.remark slot ("Remarks" column).
 *   • `NOTE`      → row.description slot ("Description" column).
 */
const FIELD_ID_TO_COLUMN_KEY: Record<string, string> = {
    TAR_BANK_CD:   "depositBank",
    RCPT_NM:       "recipientName",
    TRAN_AMT:      "transferAmount",
    TRAN_USAG:     "remark",
    CHART_ACCT_CD: "reportingAccount",
    NOTE:          "description",
    DOC_NO:        "documentNo",
    BANK_TRAN_ID:  "bankingTxnId",
};
