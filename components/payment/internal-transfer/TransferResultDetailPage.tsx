"use client";

import { notFound } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { deriveResultStatus } from "@/components/payment/shared/deriveResultStatus";
import ResultDetailView from "@/components/payment/shared/ResultDetailView";
import {
    resultDetailColumns,
    RESULT_DETAIL_MIN_WIDTH,
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
import { ApiCallError } from "@/lib/api/banking";
import { fetchTransferResultDetail, rerunTransferLine } from "@/lib/api/internalTransfer";
import {
    mapTransferResultDetail,
    type TransferResultDetail,
    type TransferResultLine,
} from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { formatAmount, formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

type TransferResultDetailPageProps = { id: string };

/**
 * Fields the file-row SearchInput matches against (case-insensitive
 * substring match on the in-memory rows). Mirrors the columns visible
 * in Figma 1:13476 minus the formatted-display-only ones (date stacks
 * and the result badge).
 */
const SEARCHABLE_FIELDS = [
    "recipientName",
    "depositBank",
    "depositBankCode",
    "depositBankName",
    "accountNo",
    "remark",
    "reportingAccount",
    "description",
    "documentNo",
    "bankingTxnId",
] as const satisfies ReadonlyArray<keyof DetailTransaction & string>;

/**
 * Payment > Internal Transfer > Transfer Result > Details — Figma 1:13476.
 *
 * Mirrors legacy `pymn_0010_002_r001`. Fetches the live batch via
 * `GET /api/v1/payment/internal-transfer/results/{id}`, maps the wire
 * shape into the shared `<ResultDetailView>` summary + rows, and lets
 * the shared shell render the 11-column Result detail table + status
 * tab strip (`all / success / failed / in_progress`).
 *
 * <p>Backend Phase A populates the core fields; per-line `proc_stat`
 * drives the per-row `result` badge via {@link deriveResult}. Unknown
 * accounts/banks render as the raw code — the deposit-bank name lookup
 * is deferred until a follow-up MR ships the bank dictionary join on
 * the wire (mirrors the Scheduled detail page's stance).
 */
export default function TransferResultDetailPage({
    id,
}: TransferResultDetailPageProps) {
    const { t } = useTranslation();
    const dialog = useDialog();
    // Refresh-key — bumped after a successful per-row Re-run so the
    // detail re-fetches and the row's status badge / Banking Txn ID
    // cell reflect the cleared RS_CD.
    const [refreshKey, setRefreshKey] = useState(0);
    const state = useApiData(
        () => fetchTransferResultDetail(id).then(mapTransferResultDetail),
        [id, refreshKey],
    );

    const handleRerun = useCallback(
        (lineId: string) => {
            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("payment.detail.rerun_confirm_description"),
                confirmText: t("dialog.continue"),
                cancelText: t("dialog.cancel"),
                onConfirm: async () => {
                    try {
                        await rerunTransferLine(id, lineId);
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

    // View Setting popover state — mirrors the canonical Approval Box +
    // Scheduled Transfer Detail pattern (CLAUDE.md §13). The hook loads
    // `vs.items` keyed by the V220-seeded FIELD_IDs for
    // `payment-internal-transfer-result-detail`; the table column set is
    // dynamically projected from `vs.items` below — visibility, order, and
    // width all flow from `sys_scr_option_wecms` on every load.
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_RESULT_DETAIL,
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

    // 404 for tenant-mismatch / missing batch. The backend surfaces
    // `WBE2060` (not-found-or-wrong-tenant) for both cases; treat both
    // as the route not existing so the user lands on the Next.js
    // not-found page. Other error codes (network, server fault) keep
    // the placeholder shell — there's no upstream dialog handler
    // available in a server-route page component, and the placeholder
    // is preferable to crashing the route.
    const detail = state.data;
    if (state.error instanceof ApiCallError && state.error.code === "WBE2060") {
        notFound();
    }

    /* Sticky-wrapped initial-loading gate — keeps the centered
     * "Loading…" message inside the table body visible ≥ 400 ms so the
     * Result detail view doesn't flash empty → table on first paint. */
    const stickyInitialLoading = useStickyLoading(state.loading && !detail);

    const rows: DetailTransaction[] = useMemo(
        () => (detail?.rows ?? []).map((line) =>
            toDetailTransaction(line, detail?.trnfYn === "Y"),
        ),
        [detail?.rows, detail?.trnfYn],
    );

    // Bank-specific blocked-characters tooltip — replaces legacy
    // `_v2common.app.addHeaderInfoIcon`. The hook keys on the
    // withdrawal bank (`outBankCd`) + PymnType so the Remarks header
    // shows exactly the chars the server-side `SpecialCharValidator`
    // rejects for this upload. Empty map (no rule registered for the
    // bank, or batch still loading) → static info icon, no tooltip.
    const blockedChars = useBlockedChars(detail?.outBankCd, "INTR");

    // Summary uses the live wire fields where available; falls back to
    // blank strings while the request is in flight so the layout
    // doesn't jump on resolve. The detail subtitle is the file name
    // (mirrors the Scheduled detail's breadcrumb rule).
    const summary = [
        { label: t("payment.detail.withdrawal_bank"), value: detail?.outBankCd ?? "" },
        {
            label: t("payment.detail.account_no"),
            value: detail
                ? `${detail.wdrlActNo} (${detail.wdrlCcyCd ?? detail.ccyCd})`
                : "",
        },
        {
            label: t("payment.detail.total_transfer_amount"),
            value: detail
                ? formatAmount(detail.totalTranAmt, detail.ccyCd, true)
                : "",
        },
        {
            label: t("payment.detail.approval_ref"),
            value: detail?.apprSeqNo ?? "",
        },
        {
            label: t("payment.detail.requestor"),
            value: "", // Phase B — approval-line join surfaces the requestor name
        },
    ];

    const subtitle = detail?.orgFileNm ?? detail?.titl ?? "";

    // Resolve the visible column set from the live View Setting (filtered
    // to use_yn='Y', dropping CHECKBOX/ETC specials + FIELD_IDs we don't
    // have a renderer for, sorted by disp_ord). Falls back to V220
    // legacy widths until the API resolves.
    const liveItems = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
    const visibleViewSettingItems: ViewSettingItem[] = liveItems
        .filter(
            (it) =>
                it.use_yn === "Y" &&
                !isSpecialViewSettingField(it.field_id) &&
                FIELD_ID_TO_COLUMN_KEY[it.field_id] !== undefined,
        )
        .slice()
        .sort((a, b) => a.disp_ord - b.disp_ord);

    // Build the column list from the shared `resultDetailColumns` factory
    // (canonical 11-column renderers — DepositBankCell, DateTimeStack,
    // ResultBadgeCell, ResultReportingAccountCell, BankingTxnIdCell) and
    // override each column's `width` with the live DB SIZE value.
    const baseColumns = resultDetailColumns(t, { blockedChars, onRerun: handleRerun });
    const columnByKey = new Map<string, PaymentListColumn<DetailTransaction>>(
        baseColumns.map((c) => [c.key, c]),
    );
    const columns: PaymentListColumn<DetailTransaction>[] = visibleViewSettingItems
        .map((it) => {
            const key = FIELD_ID_TO_COLUMN_KEY[it.field_id];
            const base = columnByKey.get(key);
            if (!base) return null;
            // `it.size` wins when present; falls back to the factory's
            // CSS-var default so admin SQL updates on `size` propagate to
            // the UI without a frontend deploy (parity with Approval Box).
            return { ...base, width: it.size || base.width };
        })
        .filter((c): c is PaymentListColumn<DetailTransaction> => c !== null);

    // Sum visible column widths so the inner table's min-width tracks the
    // visible set — hiding columns from the popover shrinks the
    // horizontal-scroll trigger point. Falls back to the static
    // RESULT_DETAIL_MIN_WIDTH constant when widths aren't px-suffixed.
    const dynamicMinWidth = (() => {
        const total = visibleViewSettingItems.reduce((sum, it) => {
            const m = (it.size ?? "").match(/^(\d+(?:\.\d+)?)px$/);
            return m ? sum + parseFloat(m[1]) : sum;
        }, 0);
        return total > 0 ? `${total}px` : RESULT_DETAIL_MIN_WIDTH;
    })();

    return (
        <>
            <ResultDetailView
                listTitle={t("payment.internal.result_title")}
                subtitle={subtitle}
                backHref="/payment/internal-transfer/transfer-result"
                summary={summary}
                file={
                    detail?.orgFileNm
                        ? {
                              name: detail.orgFileNm,
                              size: formatFileSize(detail.fileSize),
                          }
                        : undefined
                }
                rows={rows}
                onListView={handleListView}
                searchableFields={SEARCHABLE_FIELDS}
                enableSort
                blockedChars={blockedChars}
                onRerun={handleRerun}
                columns={columns}
                tableMinWidth={dynamicMinWidth}
                emptyMessage={t("payment.internal.result_detail_empty")}
                loading={stickyInitialLoading}
            />
            {vsAnchor && vsDraft && (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={(next) => setVsDraft(next)}
                    getLabel={(item) => item.field_nm || item.field_id}
                    onSave={async () => {
                        try {
                            await vs.save(vsDraft);
                        } finally {
                            closeViewSetting();
                        }
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
 * Mirror of the V220 SYS_SCR_OPTION_WECMS seed for
 * `payment-internal-transfer-result-detail` / `default`. Paint-time
 * fallback used while the API resolves so the popover never renders
 * empty on first click and the table doesn't flash with wrong widths.
 *
 * Aligned with legacy `pymn_0010_002` PROD widths + FIELD_IDs:
 *   PROC_DTTM (Date/Time — the row's request-processing time),
 *   RSLT_DTTM (Result Date/Time — when the bank's response came back),
 *   RS_CD (Results — the bank-side response code drives the badge),
 *   BANK_TRAN_ID (Banking Transaction ID — the matched bank-side txn).
 *   TRAN_USAG → "Remarks" + NOTE → "Description" (legacy WSVC labels).
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "PROC_DTTM",     field_nm: "Date/Time",              disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "105px", sort_yn: "Y" },
    { field_id: "TAR_BANK_CD",   field_nm: "Deposit Bank",           disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "260px", sort_yn: "Y" },
    { field_id: "RCPT_NM",       field_nm: "Recipient Name",         disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "350px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",      field_nm: "Transfer Amount",        disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "TRAN_USAG",     field_nm: "Remarks",                disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "350px", sort_yn: "Y" },
    { field_id: "RS_CD",         field_nm: "Results",                disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "100px", sort_yn: "Y" },
    { field_id: "RSLT_DTTM",     field_nm: "Result Date/Time",       disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "130px", sort_yn: "Y" },
    { field_id: "CHART_ACCT_CD", field_nm: "Reporting Account",      disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "150px", sort_yn: "Y" },
    { field_id: "NOTE",          field_nm: "Description",            disp_ord: 9,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "DOC_NO",        field_nm: "Document No.",           disp_ord: 10, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "150px", sort_yn: "Y" },
    { field_id: "BANK_TRAN_ID",  field_nm: "Banking Transaction ID", disp_ord: 11, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "250px", sort_yn: "Y" },
    { field_id: "ETC",           field_nm: "",                       disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "Y", size: "100px", sort_yn: "N" },
];

/**
 * Map each View Setting `FIELD_ID` to the matching `PaymentListColumn.key`
 * produced by {@link resultDetailColumns}. The page projects visible
 * View Setting items → columns using this map, then overrides each
 * column's `width` with the seed's `size` value (DB-driven, per the
 * Approval Box pattern).
 *
 * Legacy WSVC field-name quirks preserved verbatim (also documented in
 * the Scheduled detail page):
 *   • `TRAN_USAG` → row.remark slot ("Remarks" column).
 *   • `NOTE` → row.description slot ("Description" column).
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

/* ----------------------------------------------------------------------------
 *  Wire line → DetailTransaction adapter
 *
 *  Maps one `TransferResultLine` (snake_case wire shape, camelCased by
 *  the mapper) into the `DetailTransaction` shape the shared 11-column
 *  Result detail table consumes. Result badge per row derives from
 *  `procStat` / `procStatKey` / `rsCd` / `rsltDttm` via {@link deriveResult}.
 * -------------------------------------------------------------------------- */

function toDetailTransaction(
    line: TransferResultLine,
    masterDispatched: boolean,
): DetailTransaction {
    return {
        id:                  line.scdulPymnDetlNo,
        dateTime:            formatDttm(line.procDttm),
        resultDateTime:      formatDttm(line.rsltDttm),
        // Single-line legacy fallback used by Scheduled detail — Result
        // detail uses the multi-line `depositBank{Code,Name,Currency}`
        // triple instead.
        depositBank:         line.tarBankCd ?? "",
        depositBankCode:     line.tarBankCd ?? undefined,
        depositBankName:     line.tarBankNm ?? undefined,
        depositBankCurrency: line.depoCcyCd ?? line.trnfCcyCd ?? line.ccyCd,
        accountNo:           line.fincMdaNo,
        recipientName:       line.rcptNm ?? "",
        transferAmount:      formatNumber(line.tranAmt),
        remark:              line.tranUsag ?? "",
        reportingAccount:    line.chartAcctCd ?? "",
        description:         line.note ?? "",
        documentNo:          line.docNo ?? undefined,
        bankingTxnId:        line.bankTrnsShortId ?? undefined,
        // Re-run eligibility data — surfaces to the Banking Transaction ID
        // cell's Re-run branch. Legacy parity (pymn_0010_002.ts:441-449).
        procDttm:            line.procDttm ?? undefined,
        rsCd:                line.rsCd ?? undefined,
        rsMsg:               line.rsMsg ?? undefined,
        // LINK_MATCH_YN drives the Unmatch CTA (legacy
        // pymn_0010_002.ts:452-455). Refactor wire DTO doesn't carry
        // this yet — falls back to undefined so only the Match path
        // renders. Populated when the match-table integration lands.
        linkMatchYn:         undefined,
        result:              deriveResultStatus(
            {
                proc_stat:     line.procStat     ?? null,
                proc_stat_key: line.procStatKey  ?? null,
                rslt_dttm:     line.rsltDttm     ?? null,
                rs_cd:         line.rsCd         ?? null,
            },
            masterDispatched,
        ),
    };
}

/**
 * `yyyyMMddHHmmss` (14 chars, UTC) → two-line `"DD-MMM-YYYY\nHH:mm:ss"`.
 * Matches Figma 1:13476's "25-Mar-2026 / 11:39:50" format. Falls back
 * to the raw string when the wire value isn't the expected length, and
 * to an empty string when null so the cell renders cleanly.
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
 * Format the wire `file_size` (bytes, as a string) into a human-readable
 * label for the file-card chip. Mirrors the legacy detail's "108.69 KB"
 * shape — KB / MB / GB depending on magnitude.
 */
function formatFileSize(raw: string | null | undefined): string {
    if (!raw) return "";
    const bytes = Number(raw);
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
