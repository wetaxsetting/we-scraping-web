"use client";

import { ChevronDown } from "lucide-react";
import { notFound } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import PaymentDetailPage from "@/components/payment/shared/PaymentDetailPage";
import { SCHEDULED_DETAIL_MIN_WIDTH } from "@/components/payment/shared/detailColumns";
import type { DetailTransaction } from "@/components/payment/shared/types";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    isSpecialViewSettingField,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import {
    downloadOriginalExcel,
    fetchScheduledTransferDetail,
} from "@/lib/api/internalTransfer";
import { ApiCallError } from "@/lib/api/banking";
import {
    mapScheduledTransferDetail,
    type ScheduledTransferDetail,
    type TransferLineDetail,
} from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { formatAmount, formatNumber } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import type { PaymentListColumn } from "@/components/payment/shared/types";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";


type ScheduledTransferDetailPageProps = { id: string };

/* ───────────────────────── View Setting wiring ─────────────────────────
 *
 * Mirrors the canonical Account Inquiry pattern (CLAUDE.md §13). The
 * column registry below is keyed by the `FIELD_ID` values seeded by
 * Flyway V85 for `WEB_SVC_ID = 'payment-internal-transfer-scheduled-detail'`;
 * the table renders columns dynamically from the View Setting hook's
 * `vs.items` (filtered to `USE_YN='Y'`, sorted by `DISP_ORD`), with
 * `FALLBACK_COLUMNS` carrying the table through the first-paint window
 * while the API resolves.
 *
 * Each FIELD_ID maps to a render function that pulls from the
 * `DetailTransaction` row shape produced by `toDetailTransaction()`.
 * Some legacy property names on the row are slightly mismatched
 * relative to the seeded labels (the Figma "Remark" / "Description"
 * pair maps differently to the legacy WSVC `TRAN_USAG` / `NOTE` pair)
 * — the seed wins; the property-name mapping is internal noise.
 * ----------------------------------------------------------------------- */

type DetailColumnDef = {
    /** CSS width — falls back to the seeded SIZE when the user hasn't
     *  resized the column. */
    width: string;
    /** Already-translated header label. */
    label: React.ReactNode;
    /** Cell alignment. */
    align?: "left" | "right" | "center";
    /** Whether the column participates in the shared sort cycle. */
    sortable?: boolean;
    /** Optional projection for sort comparisons (e.g. numeric value
     *  for a column whose displayed value is a formatted string). */
    sortValue?: (row: DetailTransaction) => string | number;
    /** Cell renderer — receives the row + `t`. */
    renderBody: (row: DetailTransaction, t: TranslateFn) => React.ReactNode;
};

type TranslateFn = (key: string, vars?: Record<string, string>) => string;

const COLUMN_REGISTRY: Record<string, DetailColumnDef> = {
    SCDUL_PYMN_DETL_NO: {
        width: "100px",
        label: "Line No.",
        sortable: true,
        renderBody: (row) => <PlainCell>{row.id}</PlainCell>,
    },
    TAR_BANK_CD: {
        width: "180px",
        label: "Deposit Bank",
        sortable: true,
        renderBody: (row) => (
            <PlainCell>
                {row.depositBankCode && row.depositBankName
                    ? `${row.depositBankCode} ${row.depositBankName}`
                    : row.depositBank}
            </PlainCell>
        ),
    },
    RCPT_NM: {
        width: "200px",
        label: "Recipient Name",
        sortable: true,
        renderBody: (row) => <PlainCell>{row.recipientName || "—"}</PlainCell>,
    },
    FINC_MDA_NO: {
        width: "180px",
        label: "Account No.",
        sortable: true,
        renderBody: (row) => <PlainCell>{row.accountNo || "—"}</PlainCell>,
    },
    TRAN_AMT: {
        width: "160px",
        label: "Transfer Amount",
        align: "right",
        sortable: true,
        sortValue: (row) =>
            Number((row.transferAmount ?? "").replace(/[^\d.-]/g, "")) || 0,
        renderBody: (row) => (
            <span className="block text-right text-wb-13 font-medium text-wb-ink">
                {row.transferAmount}
            </span>
        ),
    },
    TRAN_USAG: {
        // V85 seed label — "Description". The DetailTransaction's
        // `remark` slot carries the legacy TRAN_USAG value (mapper in
        // `toDetailTransaction` writes line.tranUsag → row.remark).
        width: "220px",
        label: "Description",
        sortable: true,
        renderBody: (row) => <PlainCell>{row.remark}</PlainCell>,
    },
    CHART_ACCT_CD: {
        width: "180px",
        label: "Reporting Acct.",
        sortable: true,
        renderBody: (row) => <ReportingAccountCell row={row} />,
    },
    DOC_NO: {
        width: "140px",
        label: "Doc No.",
        sortable: true,
        renderBody: (row) => <PlainCell>{row.documentNo ?? ""}</PlainCell>,
    },
    NOTE: {
        // V85 seed label — "Note". The DetailTransaction's `description`
        // slot carries the legacy NOTE value (mapper writes line.note →
        // row.description).
        width: "200px",
        label: "Note",
        sortable: true,
        renderBody: (row) => <PlainCell>{row.description}</PlainCell>,
    },
    DEPO_CCY_CD: {
        width: "120px",
        label: "Deposit Currency",
        sortable: true,
        renderBody: (row) => (
            <PlainCell>{row.depositBankCurrency ?? ""}</PlainCell>
        ),
    },
};

/**
 * Mirror of the V85 SYS_SCR_OPTION_WECMS seed for screenId
 * `payment-internal-transfer-scheduled-detail` / area `default` —
 * used while the API resolves on first paint so the table doesn't
 * flash empty. The authoritative config still comes from the backend.
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "SCDUL_PYMN_DETL_NO", field_nm: "Line No.",         disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "100px", sort_yn: "Y" },
    { field_id: "TAR_BANK_CD",        field_nm: "Deposit Bank",     disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "RCPT_NM",            field_nm: "Recipient Name",   disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "FINC_MDA_NO",        field_nm: "Account No.",      disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "TRAN_AMT",           field_nm: "Transfer Amount",  disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "Y" },
    { field_id: "TRAN_USAG",          field_nm: "Description",      disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "220px", sort_yn: "Y" },
    { field_id: "CHART_ACCT_CD",      field_nm: "Reporting Acct",   disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "DOC_NO",             field_nm: "Doc No.",          disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "NOTE",               field_nm: "Note",             disp_ord: 9,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "DEPO_CCY_CD",        field_nm: "Deposit Currency", disp_ord: 10, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "120px", sort_yn: "Y" },
    { field_id: "ETC",                field_nm: "",                 disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "60px",  sort_yn: "N" },
];

/**
 * Payment > Internal Transfer > Scheduled Transfer > Detail
 * (refactor of legacy `pymn_0009_003`).
 *
 * <p>Fetches the batch master + per-line array via
 * {@code GET /api/v1/payment/internal-transfer/{id}} and renders it
 * through the shared `<PaymentDetailPage>` shell (CLAUDE.md §12).
 *
 * <p>Mock data is consulted only as a last-resort fallback for ids that
 * are explicitly in the static `internalScheduledRows` seed — useful for
 * Figma reviews / offline preview, never as a substitute for a real
 * 404 from the backend.
 *
 * <p>View Setting integration follows the canonical Account Inquiry
 * pattern (CLAUDE.md §13): the list-icon opens
 * {@link ViewSettingPopover} anchored to the trigger; column visibility
 * and order are persisted per-user in `USER_SCR_OPTION_WECMS` keyed by
 * `WEB_SVC_ID='payment-internal-transfer-scheduled-detail'`.
 */
export default function ScheduledTransferDetailPage({
    id,
}: ScheduledTransferDetailPageProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    const state = useApiData(
        () => fetchScheduledTransferDetail(id).then(mapScheduledTransferDetail),
        [id],
    );

    const apiDetail = state.data ?? null;

    // View Setting state — the popover anchors below the list icon; the
    // working draft is a local copy of `vs.items` so toggle / reorder
    // edits remain reversible until Save.
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_SCHEDULED_DETAIL,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    // File download → streams the original Excel uploaded with the
    // batch from `GET /api/v1/payment/internal-transfer/{id}/file`.
    // Backend writes the file under
    // `<storage-root>/<biz_key>/internal-transfer/<save_file_nm>` on
    // createDraft, so refactor-saved batches always have a file to
    // re-download. Legacy DEV-imported batches (no save_file_nm on
    // the row) surface as `WBE2069`; we route that to a warning
    // dialog so the user sees a clear "file unavailable" message
    // rather than a network error.
    const handleDownloadFile = useCallback(async () => {
        try {
            await downloadOriginalExcel(id);
        } catch (err) {
            if (err instanceof ApiCallError) {
                dialog.open({
                    type:        err.code === "WBE2069" ? "warning" : "error",
                    title:       err.code === "WBE2069"
                        ? t("dialog.warning")
                        : t("dialog.error"),
                    description: err.message,
                    errorCode:   err.code,
                });
                return;
            }
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: t("common.error.unknown"),
            });
        }
    }, [id, dialog, t]);

    // List-icon → open View Setting popover anchored to the trigger.
    // Snapshot `vs.items` (or `FALLBACK_COLUMNS` while the API resolves)
    // into a local draft so checkbox / reorder edits stay reversible
    // until Save. Mirrors CLAUDE.md §13 reference impl.
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

    if (state.loading) return null;
    if (
        state.error instanceof ApiCallError &&
        (state.error.code === "WBE2060" ||
            state.error.code === "WBE0404" ||
            state.error.code === "NOT_FOUND")
    ) {
        notFound();
    }

    const summary = apiDetail ? summaryFromApi(apiDetail, t) : [];
    const subtitle = apiDetail?.titl ?? "";
    const fileName = apiDetail?.orgFileNm ?? "";
    const fileSize = apiDetail?.fileSize ?? "";

    const rows: DetailTransaction[] = apiDetail
        ? apiDetail.rows.map(toDetailTransaction)
        : [];

    // Visible columns from View Setting, ordered by DISP_ORD. Until the
    // backend resolves we render against `FALLBACK_COLUMNS` so the table
    // doesn't flash empty on first paint. Filter out:
    //   • USE_YN='N' (user hid it via the popover)
    //   • CHECKBOX / ETC special FIELD_IDs (never rendered as data columns)
    //   • FIELD_IDs we don't have a renderer for (defensive — op-side
    //     could reseed with an unknown id)
    const liveItems = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
    const visibleViewSettingItems: ViewSettingItem[] = liveItems
        .filter(
            (it) =>
                it.use_yn === "Y" &&
                !isSpecialViewSettingField(it.field_id) &&
                COLUMN_REGISTRY[it.field_id],
        )
        .slice()
        .sort((a, b) => a.disp_ord - b.disp_ord);

    // Map View Setting items → `<PaymentDetailPage>` column shape. Width
    // comes from the user-resized SIZE when present, falling back to the
    // registry default.
    const columns: PaymentListColumn<DetailTransaction>[] =
        visibleViewSettingItems.map((it) => {
            const def = COLUMN_REGISTRY[it.field_id];
            return {
                key: it.field_id,
                width: it.size || def.width,
                label: def.label,
                align: def.align,
                sortable: def.sortable && it.sort_yn === "Y",
                sortValue: def.sortValue,
                render: (row) => def.renderBody(row, t),
            };
        });

    // Compute the table min-width from the visible columns so horizontal
    // scroll kicks in only when the columns genuinely overflow. Falls
    // back to the static `SCHEDULED_DETAIL_MIN_WIDTH` constant when no
    // px-suffixed widths can be parsed (defensive — `var(--…)` widths
    // wouldn't be summable here).
    const dynamicMinWidth = (() => {
        const total = visibleViewSettingItems.reduce((sum, it) => {
            const m = (it.size || COLUMN_REGISTRY[it.field_id].width).match(
                /^(\d+(?:\.\d+)?)px$/,
            );
            return m ? sum + parseFloat(m[1]) : sum;
        }, 0);
        return total > 0 ? `${total}px` : SCHEDULED_DETAIL_MIN_WIDTH;
    })();

    return (
        <>
            <PaymentDetailPage<DetailTransaction>
                listTitle={t("payment.internal.scheduled_title")}
                subtitle={subtitle}
                backHref="/payment/internal-transfer/scheduled-transfer"
                summary={summary}
                file={{ name: fileName, size: fileSize }}
                onDownloadFile={handleDownloadFile}
                onListView={handleListView}
                columns={columns}
                rows={rows}
                minWidth={dynamicMinWidth}
                // Figma 8:599 — rows with an assigned reporting account get an amber tint.
                getRowClass={(r) => (r.reportingAccount ? "bg-amber-50" : undefined)}
                // Client-side filter + sort against the in-memory batch lines.
                searchableFields={DETAIL_SEARCHABLE_FIELDS}
                enableSort
            />
            {vsAnchor && vsDraft && (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={(next) => setVsDraft(next)}
                    getLabel={(item) => {
                        // V85 seed ships English labels (`field_nm`).
                        // Prefer those; fall back to the registry label
                        // for any client-only entries (FALLBACK_COLUMNS
                        // path).
                        if (item.field_nm) return item.field_nm;
                        const def = COLUMN_REGISTRY[item.field_id];
                        return def
                            ? typeof def.label === "string"
                                ? def.label
                                : item.field_id
                            : item.field_id;
                    }}
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
 * Substring-matched fields for the detail-page search box. Covers the
 * recipient, account number, reporting account, document number, and
 * the two free-text columns — every visible text column on a Scheduled
 * detail row, independent of which View Setting columns the user has
 * chosen to display.
 */
const DETAIL_SEARCHABLE_FIELDS = [
    "depositBank",
    "depositBankCode",
    "depositBankName",
    "accountNo",
    "recipientName",
    "remark",
    "reportingAccount",
    "description",
    "documentNo",
    "bankingTxnId",
] as const satisfies ReadonlyArray<keyof DetailTransaction>;

/* ─────────────────── summary builders ─────────────────── */

function summaryFromApi(
    d: ScheduledTransferDetail,
    t: TranslateFn,
): Array<{ label: string; value: string }> {
    const accountLabel = d.wdrlActNo
        ? `${d.wdrlActNo} (${d.wdrlCcyCd ?? d.ccyCd})`
        : "—";
    return [
        { label: t("payment.detail.withdrawal_bank"), value: d.outBankCd },
        { label: t("payment.detail.account_no"), value: accountLabel },
        {
            label: t("payment.detail.total_transfer_amount"),
            value: formatAmount(d.totalTranAmt, d.ccyCd, true),
        },
        { label: t("payment.detail.approval_ref"), value: d.apprSeqNo ?? "—" },
        { label: t("payment.detail.requestor"), value: d.regId },
    ];
}

/* ─────────────────── line → row adapter ─────────────────── */

/**
 * Project the API's per-line shape onto the shared `DetailTransaction`
 * row consumed by `<PaymentDetailPage>`. Where the API does not yet
 * supply a value (e.g. resolved bank name, reporting-account
 * breadcrumb), the column renders an empty cell — matching the Figma
 * "Select Account" placeholder for the reporting-account column.
 */
function toDetailTransaction(line: TransferLineDetail): DetailTransaction {
    const reportingAccount = line.chartAcctCd ?? "";
    return {
        id:                          line.scdulPymnDetlNo,
        depositBank:                 line.tarBankCd ?? "—",
        // The list IDO does not currently surface the resolved counterparty
        // bank name + currency split; populate the legacy single-line
        // `depositBank` only and leave the multi-line slots empty until the
        // backend ships the resolved fields.
        depositBankCode:             line.tarBankCd ?? "",
        depositBankName:             "",
        depositBankCurrency:         line.ccyCd,
        accountNo:                   line.fincMdaNo,
        recipientName:               line.rcptNm ?? "—",
        transferAmount:              formatNumber(line.tranAmt),
        // Legacy WSVC field mapping: TRAN_USAG → row.remark (carries
        // the free-text purpose that V85 labels "Description").
        remark:                      line.tranUsag ?? "",
        reportingAccountUnassigned:  !reportingAccount,
        reportingAccount,
        // Legacy WSVC field mapping: NOTE → row.description (carries
        // the line note that V85 labels "Note").
        description:                 line.note ?? "",
        documentNo:                  line.docNo ?? undefined,
        bankingTxnId:                line.bankTrnsShortId ?? undefined,
    };
}

/* ─────────────────── cell renderers ─────────────────── */

function PlainCell({ children }: { children: React.ReactNode }) {
    return (
        <span className="block truncate text-wb-13 font-medium text-wb-ink">
            {children || " "}
        </span>
    );
}

/**
 * Reporting-account cell — renders the assigned account code with a
 * sub-line breadcrumb when one is present. When unassigned, surfaces
 * the Figma "Select Account ↓" placeholder so a user can spot rows
 * that still need an ERP linkage. The dropdown action itself is not
 * yet wired (CHART_ACCT_INFM picker lands with the approval-box MR).
 */
function ReportingAccountCell({ row }: { row: DetailTransaction }) {
    if (row.reportingAccountUnassigned) {
        return (
            <span className="inline-flex items-center gap-1 text-wb-13 font-medium text-brand">
                Select Account
                <ChevronDown
                    aria-hidden
                    className="size-4 shrink-0"
                    strokeWidth={1.8}
                />
            </span>
        );
    }
    return (
        <div className="flex flex-col">
            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                {row.reportingAccount}
            </span>
            {row.reportingAccountBreadcrumb && (
                <span className="block truncate text-wb-12 font-normal text-wb-ntrl-6">
                    {row.reportingAccountBreadcrumb}
                </span>
            )}
        </div>
    );
}
