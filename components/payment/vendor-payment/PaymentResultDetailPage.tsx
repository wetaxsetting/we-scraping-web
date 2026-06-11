"use client";

import { useCallback, useMemo, useState } from "react";
import { notFound } from "next/navigation";

import { deriveResultStatus } from "@/components/payment/shared/deriveResultStatus";
import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import {
    resultDetailColumns,
    RESULT_DETAIL_MIN_WIDTH,
} from "@/components/payment/shared/detailColumns";
import type { DetailTransaction } from "@/components/payment/shared/types";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    useViewSetting,
    useViewSettingColumns,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useBlockedChars } from "@/hooks/useBlockedChars";
import VendorExpenseMatchDialog from "@/components/payment/shared/VendorExpenseMatchDialog";
import { ApiCallError } from "@/lib/api/banking";
import {
    fetchVendorPaymentResultDetail,
    getVendorMatchCandidates,
    matchVendorPaymentLine,
    rerunVendorLine,
    unmatchAllVendorPaymentLines,
    unmatchVendorPaymentLine,
} from "@/lib/api/vendorPayment";
import { useApiData } from "@/lib/api/useApiData";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { formatAmount, formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

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
    const dialog = useDialog();
    const [refreshKey, setRefreshKey] = useState(0);
    // Per-line banking-match popup target (null = closed). Holds the line id.
    const [matchTarget, setMatchTarget] = useState<string | null>(null);

    const state = useApiData(() => fetchVendorPaymentResultDetail(id), [id, refreshKey]);
    const detail = state.data;

    // View Setting popover — mirrors the Approval Box + Internal Transfer
    // Result Detail pattern (CLAUDE.md §13). Loads `vs.items` keyed by
    // V224-seeded FIELD_IDs for `payment-vendor-payment-result-detail`;
    // the table column set is dynamically projected from `vs.items` below
    // — visibility, order, and width all flow from `sys_scr_option_wecms`.
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_VENDOR_PAYMENT_RESULT_DETAIL,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    const handleListView = useCallback(
        (anchorRect: DOMRect) => {
            const seed = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
            setVsDraft(seed.map((it) => ({ ...it })));
            setVsAnchor(anchorRect);
        },
        [vs.items],
    );
    const closeViewSetting = useCallback(() => {
        setVsAnchor(null);
        setVsDraft(null);
    }, []);

    /* Sticky-wrapped initial-loading gate — keeps "Loading…" inside
     * the table body for ≥ 400 ms so re-run / first paint stay smooth. */
    const stickyInitialLoading = useStickyLoading(state.loading && !detail);

    const handleRerun = useCallback(
        (rowId: string) => {
            // rowId format: `${id}-${scdul_pymn_detl_no || idx}` — extract the detl-no.
            const detlNo = rowId.startsWith(`${id}-`) ? rowId.slice(id.length + 1) : rowId;
            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("payment.detail.rerun_confirm_description"),
                confirmText: t("dialog.continue"),
                cancelText: t("dialog.cancel"),
                onConfirm: async () => {
                    try {
                        await rerunVendorLine(id, detlNo);
                        setRefreshKey((k) => k + 1);
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t("payment.detail.rerun_success"),
                        });
                    } catch (err) {
                        const code = err instanceof ApiCallError ? err.code : "WBE9999";
                        const message = err instanceof ApiCallError
                            ? err.message
                            : t("payment.detail.rerun_failed");
                        dialog.open({
                            type: "error",
                            title: t("dialog.error"),
                            description: message,
                            errorCode: code,
                        });
                    }
                },
            });
        },
        [id, dialog, t],
    );

    // Per-line banking match (legacy comm_0197_* domestic path). Row ids are
    // `${id}-${scdul_pymn_detl_no}` — the slice recovers the line id, same as
    // the re-run handler above.
    const lineIdOf = useCallback(
        (rowId: string) => (rowId.startsWith(`${id}-`) ? rowId.slice(id.length + 1) : rowId),
        [id],
    );

    const handleMatch = useCallback(
        (row: DetailTransaction) => setMatchTarget(lineIdOf(row.id)),
        [lineIdOf],
    );

    const handleUnmatch = useCallback(
        (row: DetailTransaction) => {
            const detlNo = lineIdOf(row.id);
            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("payment.match.unmatch_confirm"),
                confirmText: t("dialog.continue"),
                cancelText: t("dialog.cancel"),
                onConfirm: async () => {
                    try {
                        await unmatchVendorPaymentLine(id, detlNo);
                        setRefreshKey((k) => k + 1);
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t("payment.match.unmatch_success"),
                        });
                    } catch (err) {
                        showMatchError(err);
                    }
                },
            });
        },
        [id, dialog, t, lineIdOf],
    );

    const handleUnmatchAll = useCallback(() => {
        dialog.open({
            type: "confirmation",
            title: t("dialog.confirmation"),
            description: t("payment.match.unmatch_all_confirm"),
            confirmText: t("dialog.continue"),
            cancelText: t("dialog.cancel"),
            onConfirm: async () => {
                try {
                    await unmatchAllVendorPaymentLines(id);
                    setRefreshKey((k) => k + 1);
                    dialog.open({
                        type: "success",
                        title: t("dialog.success"),
                        description: t("payment.match.unmatch_success"),
                    });
                } catch (err) {
                    showMatchError(err);
                }
            },
        });
    }, [id, dialog, t]);

    function showMatchError(err: unknown) {
        const code = err instanceof ApiCallError ? err.code : "WBE9999";
        const message = err instanceof ApiCallError ? err.message : t("payment.match.unmatch_failed");
        dialog.open({ type: "error", title: t("dialog.error"), description: message, errorCode: code });
    }

    if (state.error instanceof ApiCallError && state.error.code === "WBE2060") {
        notFound();
    }

    const subtitle = detail?.titl ?? "";
    const currency = detail?.wdrl_ccy_cd ?? detail?.ccy_cd ?? "";

    const summary = useMemo(() => {
        // G6: prefer the resolved withdrawal-bank name, fall back to the raw code.
        const bank        = detail?.out_bank_nm ?? detail?.out_bank_cd ?? "";
        const acct        = detail?.wdrl_act_no ?? "";
        const ccy         = detail?.wdrl_ccy_cd ?? detail?.ccy_cd ?? "";
        const totalAmount = detail ? formatAmount(detail.total_tran_amt, ccy, true) : "";
        const approvalRef = detail?.doc_no ?? "";
        // G2: prefer the resolved requestor name, fall back to reg_id.
        const requestor   = detail?.requestor ?? detail?.reg_id ?? "";
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
            depositBankName:     line.tar_bank_nm ?? "",
            depositBankCurrency: line.depo_ccy_cd ?? line.ccy_cd ?? detail.ccy_cd ?? "",
            accountNo:           line.finc_mda_no ?? "",
            recipientName:       line.rcpt_nm ?? "",
            transferAmount:      formatNumber(line.tran_amt),
            // Legacy WSVC field mapping (V224 + pymn_0002_002 PROD):
            //   • TRAN_USAG → "Remarks"     column → row.remark
            //   • NOTE      → "Description" column → row.description
            // V150 had these swapped; fixed alongside the seed update.
            remark:              line.tran_usag ?? "",
            reportingAccount:    line.chart_acct_cd
                ? (line.chart_acct_seq_no
                    ? `${line.chart_acct_cd} - ${line.chart_acct_seq_no}`
                    : line.chart_acct_cd)
                : "",
            reportingAccountBreadcrumb: undefined,
            description:         line.note ?? "",
            bankingTxnId:        line.bank_trns_short_id ?? undefined,
            // Re-run eligibility data (legacy pymn_0002_002.ts:441-449).
            procDttm:            line.proc_dttm ?? undefined,
            rsCd:                line.rs_cd ?? undefined,
            rsMsg:               line.rs_msg ?? undefined,
            // Per-line banking-match state (Phase 1 read path) — drives the
            // Match-vs-Unmatch CTA in the Banking Transaction ID cell.
            linkMatchYn:         line.link_match_yn ?? undefined,
            result:              deriveResultStatus(line, dispatched),
        }));
    }, [detail, id]);

    // Bank-specific blocked-chars tooltip — drives the Remarks ⓘ +
    // Recipient Name ⓘ glyphs in the shared `resultDetailColumns`
    // factory. Keys on the withdrawal bank + VEND PymnType so the
    // tooltip surfaces exactly what `SpecialCharValidator` rejects.
    const blockedChars = useBlockedChars(detail?.out_bank_cd, "VEND");

    // Project View Setting → table columns through the shared helper
    // (CLAUDE.md §13). DB `size` is the single source of truth — no
    // FALLBACK fallthrough. `columns` is `[]` and `vsLoading` is true
    // until the GET resolves; the shared shell renders "Loading…" until
    // both vsLoading AND stickyInitialLoading clear. This eliminates the
    // FALLBACK→DB width-jump that used to flash on first paint when admin
    // had updated `sys_scr_option_wecms.size` past what the page-shipped
    // FALLBACK listed.
    const { columns, minWidth: dynamicMinWidth, loading: vsLoading } =
        useViewSettingColumns({
            vs,
            baseColumns: resultDetailColumns(t, {
                blockedChars,
                onRerun: handleRerun,
                onMatch: handleMatch,
                onUnmatch: handleUnmatch,
            }),
            fieldIdToColumnKey: FIELD_ID_TO_COLUMN_KEY,
            fallbackMinWidth: RESULT_DETAIL_MIN_WIDTH,
        });

    // Page-level Unmatch-All — visible only when more than one line is matched
    // (legacy pymn_0008_002.ts:277-281: button shows when matchedCnt > 1).
    const matchedCount = rows.filter((r) => r.linkMatchYn === "Y").length;

    return (
        <>
            <ResultDetailView
                listTitle={t("payment.vendor.result_title")}
                subtitle={subtitle}
                backHref="/payment/vendor-payment/payment-result"
                summary={summary}
                blockedChars={blockedChars}
                file={{
                    name: detail?.org_file_nm ?? "",
                    size: detail?.file_size ? `${detail.file_size}` : "",
                }}
                rows={rows}
                onRerun={handleRerun}
                onListView={handleListView}
                columns={columns}
                tableMinWidth={dynamicMinWidth}
                enableSort
                emptyMessage={t("payment.vendor.result_detail_empty")}
                loading={stickyInitialLoading || vsLoading}
                headerActions={
                    matchedCount > 1 ? (
                        <button
                            type="button"
                            onClick={handleUnmatchAll}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-wb-red-04 bg-white px-3 text-wb-14-tight font-medium text-wb-red-07 shadow-wb-btn hover:bg-wb-red-04/10"
                        >
                            {t("payment.match.unmatch_all")}
                        </button>
                    ) : undefined
                }
            />
            {matchTarget && (
                <VendorExpenseMatchDialog
                    scdulPymnNo={id}
                    scdulPymnDetlNo={matchTarget}
                    currency={currency}
                    fetchCandidates={getVendorMatchCandidates}
                    submitMatch={matchVendorPaymentLine}
                    onClose={() => setMatchTarget(null)}
                    onMatched={() => setRefreshKey((k) => k + 1)}
                />
            )}
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
 * Mirror of the V224 SYS_SCR_OPTION_WECMS seed for
 * `payment-vendor-payment-result-detail` / `default`. Paint-time
 * fallback used while the API resolves.
 *
 * Aligned with legacy `pymn_0002_002` PROD widths + FIELD_IDs.
 * Legacy WSVC field-name quirks preserved verbatim:
 *   • TRAN_USAG → "Remarks"     column → row.remark
 *   • NOTE      → "Description" column → row.description
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "PROC_DTTM",     field_nm: "Date/Time",              disp_ord: 1,  disp_yn: "Y", use_yn: "Y", size: "105px", sort_yn: "Y" },
    { field_id: "TAR_BANK_CD",   field_nm: "Deposit Bank",           disp_ord: 2,  disp_yn: "Y", use_yn: "Y", size: "300px", sort_yn: "Y" },
    { field_id: "RCPT_NM",       field_nm: "Recipient Name",         disp_ord: 3,  disp_yn: "Y", use_yn: "Y", size: "350px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",      field_nm: "Transfer Amount",        disp_ord: 4,  disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "TRAN_USAG",     field_nm: "Remarks",                disp_ord: 5,  disp_yn: "Y", use_yn: "Y", size: "250px", sort_yn: "Y" },
    { field_id: "RS_CD",         field_nm: "Results",                disp_ord: 6,  disp_yn: "Y", use_yn: "Y", size: "100px", sort_yn: "Y" },
    { field_id: "RSLT_DTTM",     field_nm: "Result Date/Time",       disp_ord: 7,  disp_yn: "Y", use_yn: "Y", size: "130px", sort_yn: "Y" },
    { field_id: "CHART_ACCT_CD", field_nm: "Reporting Account",      disp_ord: 8,  disp_yn: "Y", use_yn: "Y", size: "150px", sort_yn: "Y" },
    { field_id: "NOTE",          field_nm: "Description",            disp_ord: 9,  disp_yn: "Y", use_yn: "Y", size: "200px", sort_yn: "Y" },
    { field_id: "DOC_NO",        field_nm: "Document No.",           disp_ord: 10, disp_yn: "Y", use_yn: "Y", size: "200px", sort_yn: "Y" },
    { field_id: "BANK_TRAN_ID",  field_nm: "Banking Transaction ID", disp_ord: 11, disp_yn: "Y", use_yn: "Y", size: "250px", sort_yn: "Y" },
    { field_id: "ETC",           field_nm: "",                       disp_ord: 99, disp_yn: "Y", use_yn: "Y", size: "100px", sort_yn: "N" },
];

/**
 * Map each View Setting `FIELD_ID` to the matching `PaymentListColumn.key`
 * produced by {@link resultDetailColumns}. The page projects visible
 * View Setting items → columns using this map, then overrides each
 * column's `width` with the seed's `size` value.
 */
const FIELD_ID_TO_COLUMN_KEY: Record<string, string> = {
    PROC_DTTM:     "dateTime",
    TAR_BANK_CD:   "depositBank",
    RCPT_NM:       "recipientName",
    TRAN_AMT:      "transferAmount",
    TRAN_USAG:     "remark",
    RS_CD:         "result",
    RSLT_DTTM:     "resultDateTime",
    CHART_ACCT_CD: "reportingAccount",
    NOTE:          "description",
    DOC_NO:        "documentNo",
    BANK_TRAN_ID:  "bankingTxnId",
};

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
