"use client";

import { useCallback, useMemo, useState } from "react";
import { notFound } from "next/navigation";

import { deriveResultStatus } from "@/components/payment/shared/deriveResultStatus";
import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import {
    resultDetailColumns,
    RESULT_DETAIL_MIN_WIDTH,
} from "@/components/payment/shared/detailColumns";
import {
    DetailClampCell,
    ResultPlainText,
    ResultReportingAccountClampCell,
} from "@/components/payment/shared/detailCells";
import type {
    DetailTransaction,
    PaymentListColumn,
} from "@/components/payment/shared/types";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    useViewSetting,
    useViewSettingColumns,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useBlockedChars } from "@/hooks/useBlockedChars";
import { ApiCallError } from "@/lib/api/banking";
import {
    downloadPayrollResultReport,
    fetchPayrollPaymentResultDetail,
    unmatchPayrollBatch,
} from "@/lib/api/payrollPayment";
import PayrollMatchDialog from "@/components/payment/payroll/PayrollMatchDialog";
import { useApiData } from "@/lib/api/useApiData";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";


type PayrollPaymentResultDetailPageProps = { id: string };

/**
 * Payment > Payroll Payment > Payment Result > Details — Figma 27:13703.
 *
 * Wires `GET /api/v1/payment/payroll-payment/results/{id}`. View Setting +
 * DB-driven column widths follow the V231 / pymn_0006_002 legacy 8-column
 * set (no Description / Document No. / Banking Transaction ID — Payroll
 * legacy does not render those on the per-payee result line).
 */
export default function PayrollPaymentResultDetailPage({
    id,
}: PayrollPaymentResultDetailPageProps) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();

    /* ── View Setting popover state (legacy `pymn_0006_002`) ─────── */
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_PAYROLL_PAYMENT_RESULT_DETAIL,
        DEFAULT_AREA_ID,
    );
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

    const handleDownloadFile = useCallback(async () => {
        try {
            await downloadPayrollResultReport(id, locale);
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
    }, [id, dialog, t, locale]);

    const [refreshKey, setRefreshKey] = useState(0);
    const [matchOpen, setMatchOpen] = useState(false);
    const state = useApiData(() => fetchPayrollPaymentResultDetail(id), [id, refreshKey]);
    const detail = state.data;

    /* Sticky-wrapped initial-loading gate. */
    const stickyInitialLoading = useStickyLoading(state.loading && !detail);

    if (state.error instanceof ApiCallError && state.error.code === "WBE2060") {
        notFound();
    }

    const subtitle = detail?.titl ?? "";

    const summary = useMemo(() => {
        // Issue-1: prefer the resolved withdrawal-bank name, fall back to the raw code.
        const bank        = detail?.out_bank_nm ?? detail?.out_bank_cd ?? "";
        const acct        = detail?.wdrl_act_no ?? "";
        const ccy         = detail?.wdrl_ccy_cd ?? detail?.ccy_cd ?? "";
        const totalAmount = detail ? formatAmount(detail.total_tran_amt, ccy, true) : "";
        const approvalRef = detail?.doc_no ?? "";
        // G2: prefer the resolved requestor name (DRAFT_USER_NM), fall back to reg_id.
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
            dateTimeRaw:         line.proc_dttm ?? undefined,
            resultDateTimeRaw:   line.rslt_dttm ?? undefined,
            depositBank:         line.tar_bank_cd ?? "",
            depositBankCode:     line.tar_bank_cd ?? "",
            depositBankName:     line.tar_bank_nm ?? "",
            depositBankCurrency: line.depo_ccy_cd ?? line.ccy_cd ?? detail.ccy_cd ?? "",
            accountNo:           line.finc_mda_no ?? "",
            recipientName:       line.rcpt_nm ?? "",
            transferAmount:      formatAmount(line.tran_amt, line.ccy_cd ?? detail.ccy_cd, false),
            // Legacy WSVC field mapping (V231 + pymn_0006_002 PROD):
            //   • TRAN_USAG → "Remarks" column → row.remark
            // Payroll Result Detail legacy does NOT render Description /
            // Document No. / Banking Txn ID columns. `description` and
            // `bankingTxnId` are still populated so the shared
            // `searchableFields` filter has something to match on for
            // pages that surface those fields elsewhere.
            remark:              line.tran_usag ?? "",
            // Reporting Account (legacy pymn_0006_002.ts:475-479): when
            // CHART_ACCT_CD is present, show wb_get_chart_acct_nm on the
            // primary line ("Code0011 - SALES TEST") and wb_get_chart_acct_lv_nm
            // as the grey level line ("REVENUE > SALES"); blank otherwise. The
            // backend resolves both via the legacy funnel and nulls them when
            // CHART_ACCT_CD is absent.
            reportingAccount:    line.chart_acct_nm ?? "",
            reportingAccountBreadcrumb: line.chart_acct_level_nm ?? undefined,
            description:         line.note ?? "",
            bankingTxnId:        line.bank_trns_short_id ?? undefined,
            // Re-run eligibility data (legacy pymn_0006_002.ts:441-449).
            procDttm:            line.proc_dttm ?? undefined,
            rsCd:                line.rs_cd ?? undefined,
            rsMsg:               line.rs_msg ?? undefined,
            linkMatchYn:         undefined,
            result:              deriveResultStatus(line, dispatched),
        }));
    }, [detail, id]);

    // Bank-specific blocked-chars tooltip — drives the Remarks ⓘ +
    // Recipient Name ⓘ glyphs in the shared `resultDetailColumns`
    // factory. Keys on the withdrawal bank + PAYR PymnType so the
    // tooltip surfaces exactly what `SpecialCharValidator` rejects.
    const blockedChars = useBlockedChars(detail?.out_bank_cd, "PAYR");

    // Project View Setting → table columns through the shared helper
    // (CLAUDE.md §13). DB `size` is the single source of truth.
    // Legacy `pymn_0006_002` parity overrides on the shared factory columns:
    //   • Results → plain coloured text (no badge) — `ResultPlainText`.
    //   • Recipient Name / Remarks → 2-line clamp + ellipsis + shared
    //     tooltip — `DetailClampCell` (Payroll's 8-col subset has no
    //     Description / Document No. column to clamp).
    //   • Reporting Account (read-only) → 2-line name+level stack.
    // NOTE: Payroll uses HEADER-LEVEL batch matching (PayrollMatchDialog
    // below), not the per-line Banking Transaction ID Match CTA — so the
    // factory is called WITHOUT onMatch/onUnmatch and BANK_TRAN_ID is not
    // in FIELD_ID_TO_COLUMN_KEY. Do not add per-line match here.
    const RESULT_CLAMP_KEYS = useMemo(
        () => new Set(["recipientName", "remark", "description", "documentNo"]),
        [],
    );
    const baseColumns: PaymentListColumn<DetailTransaction>[] = useMemo(() => {
        const cols = resultDetailColumns(t, { blockedChars });
        return cols.map((c) => {
            if (RESULT_CLAMP_KEYS.has(c.key)) {
                return {
                    ...c,
                    render: (row: DetailTransaction) => (
                        <DetailClampCell
                            text={String((row as Record<string, unknown>)[c.key] ?? "")}
                        />
                    ),
                };
            }
            if (c.key === "reportingAccount") {
                return {
                    ...c,
                    render: (row: DetailTransaction) => (
                        <ResultReportingAccountClampCell row={row} />
                    ),
                };
            }
            if (c.key === "result") {
                return {
                    ...c,
                    render: (row: DetailTransaction) => (
                        <ResultPlainText row={row} t={t} />
                    ),
                };
            }
            return c;
        });
    }, [t, blockedChars, RESULT_CLAMP_KEYS]);

    const { columns, minWidth: dynamicMinWidth, loading: vsLoading } =
        useViewSettingColumns({
            vs,
            baseColumns,
            fieldIdToColumnKey: FIELD_ID_TO_COLUMN_KEY,
            fallbackMinWidth: RESULT_DETAIL_MIN_WIDTH,
        });

    /* ── Banking match (legacy pymn_0006_002 header button) ──────────
       Visibility (parity — payroll-banking-match-visibility-parity.md):
         • matched (LINK_MATCH_YN='Y')      → Unmatch + matched-ref link
         • else transfer complete (prc===0) → Match to Banking Transaction
         • else (still processing)          → nothing                       */
    const matched          = detail?.link_match_yn === "Y";
    const transferComplete = detail != null && Number(detail.prc_cnt ?? "") === 0;
    const matchedRef       = detail?.bank_trns_short_id || detail?.acct_seq_no || "";

    const handleUnmatch = useCallback(() => {
        dialog.open({
            type: "confirmation",
            title: t("dialog.confirmation"),
            description: t("payment.payroll.match.unmatch_confirm"),
            confirmText: t("dialog.continue"),
            cancelText: t("dialog.cancel"),
            onConfirm: async () => {
                try {
                    await unmatchPayrollBatch(id);
                    setRefreshKey((k) => k + 1);
                    dialog.open({
                        type: "success",
                        title: t("dialog.success"),
                        description: t("payment.payroll.match.unmatch_success"),
                    });
                } catch (err) {
                    const code = err instanceof ApiCallError ? err.code : "WBE9999";
                    const message = err instanceof ApiCallError
                        ? err.message
                        : t("payment.payroll.match.unmatch_failed");
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description: message,
                        errorCode: code,
                    });
                }
            },
        });
    }, [id, dialog, t]);

    const headerActions = !detail ? null : matched ? (
        <>
            <span className="text-wb-13 font-medium text-wb-ink">
                {t("payment.payroll.match.matched_to")}:{" "}
                <span className="text-brand">{matchedRef}</span>
            </span>
            <button
                type="button"
                onClick={handleUnmatch}
                className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-wb-red-04 bg-white px-3 text-wb-14-tight font-medium text-wb-red-07 shadow-wb-btn hover:bg-wb-red-04/10"
            >
                {t("payment.payroll.match.unmatch")}
            </button>
        </>
    ) : transferComplete ? (
        <button
            type="button"
            onClick={() => setMatchOpen(true)}
            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
        >
            {t("payment.payroll.match.match_button")}
        </button>
    ) : null;

    /* Summary echo for the match popup header (from the loaded detail). */
    const matchDialogCurrency = detail?.wdrl_ccy_cd ?? detail?.ccy_cd ?? "";
    const matchDialogSummary = (() => {
        const [transferDate = "", transferTime = ""] =
            (formatDttm(detail?.trnf_dtm) ?? "").split("\n");
        return {
            transferDate,
            transferTime,
            withdrawalBankName:  detail?.out_bank_nm ?? detail?.out_bank_cd ?? "",
            withdrawalAccountNo: detail?.wdrl_act_no ?? "",
            withdrawalAmount:    detail
                ? formatAmount(detail.total_tran_amt, matchDialogCurrency, true)
                : "",
            fileName:            detail?.org_file_nm ?? "",
        };
    })();

    return (
        <>
            <ResultDetailView
                listTitle={t("payment.payroll.result_title")}
                subtitle={subtitle}
                backHref="/payment/payroll/payment-result"
                summary={summary}
                blockedChars={blockedChars}
                headerActions={headerActions}
                headerActionsInline
                file={{
                    name: detail?.org_file_nm ?? "",
                    size: detail?.file_size ? `${detail.file_size}` : "",
                }}
                rows={rows}
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
                    "bankingTxnId",
                ]}
                onDownloadFile={handleDownloadFile}
                onListView={handleListView}
                // Colour the status-tab counts per legacy pymn_0006_002
                // (Success green / Failed red / In Progress blue / All
                // default), matching Vendor / Expense / Internal Transfer.
                colorTabCounts
                columns={columns}
                tableMinWidth={dynamicMinWidth}
                enableSort
                emptyMessage={t("payment.payroll.result_detail_empty")}
                loading={stickyInitialLoading || vsLoading}
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
            {matchOpen && detail && (
                <PayrollMatchDialog
                    scdulPymnNo={id}
                    summary={matchDialogSummary}
                    currency={matchDialogCurrency}
                    onClose={() => setMatchOpen(false)}
                    onMatched={() => setRefreshKey((k) => k + 1)}
                />
            )}
        </>
    );
}

/**
 * Mirror of the V231 SYS_SCR_OPTION_WECMS seed for
 * `payment-payroll-payment-result-detail` / `default`. Paint-time
 * fallback used while the API resolves.
 *
 * Aligned with legacy `pymn_0006_002` PROD widths + FIELD_IDs — the
 * Payroll Result Detail legacy renders only 8 user columns (no
 * Description / Document No. / Banking Transaction ID).
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "PROC_DTTM",     field_nm: "Date/Time",         disp_ord: 1,  disp_yn: "Y", use_yn: "Y", size: "105px", sort_yn: "Y" },
    { field_id: "TAR_BANK_CD",   field_nm: "Deposit Bank",      disp_ord: 2,  disp_yn: "Y", use_yn: "Y", size: "200px", sort_yn: "Y" },
    { field_id: "RCPT_NM",       field_nm: "Recipient Name",    disp_ord: 3,  disp_yn: "Y", use_yn: "Y", size: "330px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",      field_nm: "Transfer Amount",   disp_ord: 4,  disp_yn: "Y", use_yn: "Y", size: "110px", sort_yn: "Y" },
    { field_id: "TRAN_USAG",     field_nm: "Remarks",           disp_ord: 5,  disp_yn: "Y", use_yn: "Y", size: "330px", sort_yn: "Y" },
    { field_id: "RS_CD",         field_nm: "Results",           disp_ord: 6,  disp_yn: "Y", use_yn: "Y", size: "100px", sort_yn: "Y" },
    { field_id: "RSLT_DTTM",     field_nm: "Result Date/Time",  disp_ord: 7,  disp_yn: "Y", use_yn: "Y", size: "130px", sort_yn: "Y" },
    { field_id: "CHART_ACCT_CD", field_nm: "Reporting Account", disp_ord: 8,  disp_yn: "Y", use_yn: "Y", size: "130px", sort_yn: "Y" },
    { field_id: "ETC",           field_nm: "",                  disp_ord: 99, disp_yn: "Y", use_yn: "Y", size: "60px",  sort_yn: "N" },
];

/**
 * Map each View Setting `FIELD_ID` to the matching `PaymentListColumn.key`
 * produced by {@link resultDetailColumns}. The page projects visible
 * View Setting items → columns using this map, then overrides each
 * column's `width` with the seed's `size` value.
 *
 * Payroll Result Detail legacy 8-column subset — no NOTE / DOC_NO /
 * BANK_TRAN_ID mapping (those columns are not in the pymn_0006_002 seed).
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
};

/**
 * `yyyyMMddHHmmss` (14 chars, UTC) → two-line `"DD-MMM-YYYY\nHH:mm:ss"`.
 * Mirrors the Internal Transfer / Vendor / Expense Result Detail formatter.
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
