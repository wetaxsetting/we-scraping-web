"use client";

import { useCallback, useMemo, useState } from "react";
import { notFound } from "next/navigation";

import PaymentDetailPage from "@/components/payment/shared/PaymentDetailPage";
import {
    SCHEDULED_DETAIL_MIN_WIDTH,
    scheduledDetailColumns,
    type ChartAccountOption,
} from "@/components/payment/shared/detailColumns";
import type { DetailTransaction } from "@/components/payment/shared/types";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useBlockedChars } from "@/hooks/useBlockedChars";
import { ApiCallError } from "@/lib/api/banking";
import { fetchChartOfAccounts } from "@/lib/api/chartOfAccounts";
import { useApiData } from "@/lib/api/useApiData";
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
                remark:              line.note ?? "",
                reportingAccount,
                reportingAccountUnassigned: !reportingAccount,
                reportingAccountBreadcrumb,
                description:         line.tran_usag ?? "",
                documentNo:          line.doc_no ?? undefined,
            };
        });
    }, [detail, id, reportingOverrides]);

    const fileName = detail?.org_file_nm ?? "";
    const fileSize = detail?.file_size ? `${detail.file_size}` : "";

    // Bank-specific blocked-chars tooltip — drives the Remarks ⓘ +
    // Recipient Name ⓘ glyphs in the shared column factory. Keys on
    // the withdrawal bank + VEND PymnType so the tooltip surfaces
    // exactly what `SpecialCharValidator` rejects for this upload.
    const blockedChars = useBlockedChars(detail?.out_bank_cd, "VEND");

    return (
        <>
            <PaymentDetailPage<DetailTransaction>
                listTitle={t("payment.vendor.scheduled_title")}
                subtitle={subtitle}
                backHref="/payment/vendor-payment/scheduled-payment"
                summary={summary}
                file={{ name: fileName, size: fileSize }}
                columns={scheduledDetailColumns(t, {
                    blockedChars,
                    accounts: chartAccounts,
                    onSelectReportingAccount: handleSelectReportingAccount,
                })}
                rows={rows}
                minWidth={SCHEDULED_DETAIL_MIN_WIDTH}
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

/** Mirror of the V142 SYS_SCR_OPTION_WECMS seed — paint-time fallback
 *  so the popover doesn't flash empty while the API resolves. */
const FALLBACK_DETAIL_COLUMNS: ViewSettingItem[] = [
    { field_id: "TAR_BANK_CD",   field_nm: "Deposit Bank",    disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "RCPT_NM",       field_nm: "Recipient Name",  disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "FINC_MDA_NO",   field_nm: "Account No.",     disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",      field_nm: "Transfer Amount", disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "Y" },
    { field_id: "NOTE",          field_nm: "Remark",          disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "CHART_ACCT_CD", field_nm: "Reporting Acct",  disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "TRAN_USAG",     field_nm: "Description",     disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "220px", sort_yn: "Y" },
    { field_id: "DOC_NO",        field_nm: "Doc No.",         disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "ETC",           field_nm: "",                disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "60px",  sort_yn: "N" },
];
