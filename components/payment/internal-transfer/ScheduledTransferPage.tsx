"use client";

import { useCallback, useMemo, useState } from "react";

import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import PaymentScheduledBatchListPage, {
    type PaymentScheduledBatchRow,
    type PeriodKey,
    type ScheduledBatchSortable,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { fetchScheduledTransferList } from "@/lib/api/internalTransfer";
import {
    mapScheduledTransferList,
    type ScheduledTransferRow,
} from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { formatAmount, formatNumber } from "@/lib/currency";
import { useTableSort } from "@/hooks/useTableSort";
import { useTranslation } from "@/lib/i18n";
import { escapeHtml, printReport, type PrintColumn } from "@/lib/print";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import InternalTransferUploadDialog from "./InternalTransferUploadDialog";
import { type InternalScheduledRow } from "./mockData";

/**
 * Payment > Internal Transfer > Scheduled Transfer — Figma 1:9972.
 *
 * Composes the shared `<PaymentScheduledBatchListPage>` — the canonical
 * batch-file Scheduled list (CLAUDE.md §12a). Server-driven for
 * pagination, sort, and the period dropdown.
 *
 * <p>Default state: page 0 × 10 rows, period "Last 30 Days", default
 * ORDER BY (`reg_dtm DESC, scdul_pymn_no DESC`). The toolbar's period
 * dropdown lets the user widen to 7 / 30 / 90 days; each click resets
 * the page to 0 so the user never lands on an out-of-range page.
 */
export default function ScheduledTransferPage() {
    const { t } = useTranslation();
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadKey, setUploadKey] = useState(0);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [period, setPeriod] = useState<PeriodKey>("30d");
    const [apprType, setApprType] = useState<string>("");      // "" = All
    const [search, setSearch] = useState<string>("");
    const sort = useTableSort();

    // View Setting state — mirrors the canonical Account Inquiry pattern
    // (CLAUDE.md §13). The hook loads `vs.items` keyed by the seeded
    // FIELD_IDs in V85 for `payment-internal-transfer-scheduled`; the
    // shell's `viewSettingItems` prop gates each column's <col>/<th>/<td>
    // by `USE_YN === "Y"`. Reorder is not yet wired on the shell — the
    // popover persists DISP_ORD and Save round-trips it cleanly, but
    // the visible column order stays in the legacy hardcoded sequence
    // until a follow-up MR refactors the shell to drive ordering
    // dynamically.
    const vs = useViewSetting(
        SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_SCHEDULED,
        DEFAULT_AREA_ID,
    );
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    function openUpload() {
        setUploadKey((k) => k + 1);
        setUploadOpen(true);
    }

    // Reset to page 0 whenever the filter / sort / size changes so the
    // user doesn't land on a now-out-of-range page after the result
    // count shrinks. Mirrors the legacy `fn_loadData(option=true)`
    // reset documented in wecms-web-main CLAUDE.md §4.
    function changePeriod(next: PeriodKey) {
        setPeriod(next);
        setPage(0);
    }
    function changePageSize(next: number) {
        setPageSize(next);
        setPage(0);
    }
    function handleSort(fieldId: string) {
        sort.toggleSort(fieldId);
        setPage(0);
    }
    function changeApprType(next: string) {
        setApprType(next);
        setPage(0);
    }
    function changeSearch(next: string) {
        setSearch(next);
        setPage(0);
    }

    const { fromDate, toDate } = useMemo(() => periodToWindow(period), [period]);
    const state = useApiData(
        () =>
            fetchScheduledTransferList({
                fromDate,
                toDate,
                srchWd: search.trim() || undefined,
                apprType: apprType || undefined,
                page,
                size: pageSize,
                sortField: sort.sortParams?.sortField,
                sortDirection: sort.sortParams?.sortDirection,
            }).then(mapScheduledTransferList),
        [
            fromDate,
            toDate,
            search,
            apprType,
            page,
            pageSize,
            sort.sortField,
            sort.sortDirection,
        ],
    );

    const rows: Array<InternalScheduledRow & PaymentScheduledBatchRow> =
        (state.data?.rows ?? []).map(toListRow);
    const totals = (state.data?.currencyTotals ?? []).map((c) => ({
        currency: c.ccyCd,
        amount: formatAmount(c.totalAmount, c.ccyCd, true),
    }));
    const totalCount = state.data?.totalCount ?? 0;

    // Print → opens a clean popup with the 11 visible columns rendered
    // from the current `rows` (already filtered + sorted by the backend
    // for the active page). Calls `printReport` from lib/print.ts per
    // CLAUDE.md §6d — never calls window.print() on the live DOM.
    const handlePrint = useCallback(() => {
        const columns: PrintColumn<InternalScheduledRow & PaymentScheduledBatchRow>[] = [
            {
                header: t("payment.internal.col.date_time"),
                render: (r) => escapeHtml(r.dateTime.replace(/\n/g, " ")),
            },
            { header: t("payment.internal.col.file_name"), render: (r) => escapeHtml(r.fileName) },
            {
                header: t("payment.internal.col.txn_count"),
                align: "right",
                render: (r) =>
                    escapeHtml(
                        t("payment.internal.txn_count_with_currency", {
                            count: String(r.txnCount),
                            currency: r.txnCurrency,
                        }),
                    ),
            },
            {
                header: t("payment.internal.col.total_transfer"),
                align: "right",
                render: (r) => escapeHtml(r.totalAmount),
            },
            {
                header: t("approval.col.status"),
                render: (r) => (r.status ? escapeHtml(t(`payment.status.${r.status}`)) : ""),
            },
            { header: t("payment.col.requestor"), render: (r) => escapeHtml(r.requestor) },
            { header: t("payment.col.approver"), render: (r) => escapeHtml(r.approver) },
            { header: t("payment.internal.col.approval_ref"), render: (r) => escapeHtml(r.approvalRef) },
            { header: t("payment.internal.col.approval_title"), render: (r) => escapeHtml(r.approvalTitle) },
        ];
        const summary = t("common.showing_of", {
            shown: String(rows.length),
            total: String(totalCount),
        });
        printReport({
            title: t("payment.internal.scheduled_title"),
            summary,
            columns,
            rows,
        });
    }, [rows, totalCount, t]);

    // List-icon → open View Setting popover anchored to the trigger.
    // Snapshot `vs.items` into a local draft so checkbox / reorder
    // edits stay reversible until Save. Mirrors the canonical Account
    // Inquiry reference (CLAUDE.md §13).
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

    return (
        <>
            <PaymentScheduledBatchListPage<InternalScheduledRow & PaymentScheduledBatchRow>
                title={t("payment.internal.scheduled_title")}
                rows={rows}
                rowDetailHref={(row) =>
                    `/payment/internal-transfer/scheduled-transfer/${row.id}`
                }
                totals={totals}
                onExcelUpload={openUpload}
                onPrint={handlePrint}
                onListView={handleListView}
                search={search}
                onSearchChange={changeSearch}
                apprType={apprType}
                apprTypeOptions={APPR_TYPE_OPTIONS}
                onApprTypeChange={changeApprType}
                pagination={{
                    page,
                    pageSize,
                    totalCount,
                    onPageChange: setPage,
                    onPageSizeChange: changePageSize,
                }}
                sort={{
                    field: sort.sortField,
                    direction: sort.sortDirection,
                }}
                sortableColumns={SORTABLE_COLUMNS}
                onSort={handleSort}
                period={period}
                onPeriodChange={changePeriod}
                viewSettingItems={vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS}
            />
            {uploadOpen && (
                <InternalTransferUploadDialog
                    key={uploadKey}
                    onClose={() => setUploadOpen(false)}
                />
            )}
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
 * Mirror of the V85 SYS_SCR_OPTION_WECMS seed for
 * `payment-internal-transfer-scheduled` / `default`. Used as the
 * paint-time fallback while the API resolves so the table doesn't
 * flash empty. The authoritative config still comes from the
 * backend; this exists only to bridge first-render.
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "CHECKBOX",       field_nm: "Checkbox",              disp_ord: 0,  disp_yn: "Y", use_yn: "Y", fix_yn: "Y", size: "38px",  sort_yn: "N" },
    { field_id: "REG_DTM",        field_nm: "Date / Time",           disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "150px", sort_yn: "Y" },
    { field_id: "TITL",           field_nm: "File Name",             disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "240px", sort_yn: "Y" },
    { field_id: "TOT_TRNS_CNT",   field_nm: "No. of Transactions",   disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "TOTAL_TRAN_AMT", field_nm: "Total Transfer Amount", disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "APPR_STTS",      field_nm: "Approval Status",       disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "N" },
    { field_id: "REG_ID",         field_nm: "Requestor",             disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "APPR_SEQ_NO",    field_nm: "Approval Ref.",         disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "TRNF_YN",        field_nm: "Transfer Status",       disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "120px", sort_yn: "Y" },
    { field_id: "DOC_NO",         field_nm: "Doc No.",               disp_ord: 9,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "ETC",            field_nm: "",                      disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "60px",  sort_yn: "N" },
];

/**
 * Approval-status filter options. `value` is the legacy `APPR_TYPE_CD`
 * shipped on the wire as `appr_type` (empty = All). Labels are i18n
 * keys resolved by the shared shell at render time. Codes mirror
 * `wabooks.enums.ApprSts` placeholders documented in OQ-1 / feature
 * spec § 7.2 — final code → label mapping is pending PO confirmation.
 */
const APPR_TYPE_OPTIONS = [
    { value: "",   labelKey: "payment.internal.filter.all_status" },
    { value: "00", labelKey: "payment.appr_stts.draft" },
    { value: "01", labelKey: "payment.appr_stts.approved" },
    { value: "02", labelKey: "payment.appr_stts.rejected" },
    { value: "03", labelKey: "payment.appr_stts.in_progress" },
    { value: "04", labelKey: "payment.appr_stts.pending" },
    { value: "99", labelKey: "payment.appr_stts.cancelled" },
] as const;

/**
 * Per-column FIELD_ID map. Keys are the stable column identifiers the
 * shared shell understands; values are the backend
 * `InternalTransferSortField` enum names. Columns missing from the map
 * (`FILE_NAME`, `STATUS`, `APPROVER`) render without sort wiring —
 * their headers stay non-clickable until the matching backing field /
 * Phase B join lands.
 */
const SORTABLE_COLUMNS: ScheduledBatchSortable = {
    DATE_TIME:      "REG_DTM",
    TXN_COUNT:      "TOT_TRNS_CNT",
    TOTAL_AMOUNT:   "TOTAL_TRAN_AMT",
    REQUESTOR:      "REG_ID",
    APPROVAL_REF:   "APPR_SEQ_NO",
    APPROVAL_TITLE: "TITL",
};

/* ----------------------------------------------------------------------------
 *  Wire row → list-page row adapter
 *
 *  Backend Phase A populates only a subset of the rich Figma mock:
 *  `appr_stts` / `appr_stts_key` / `trnf_stts` / approver are null
 *  until EXPT_RESOL_MSTR + approval-line join land in a follow-up
 *  (backend doc §15.6). Until then those columns render empty, which
 *  matches Figma's "warning row" treatment.
 * -------------------------------------------------------------------------- */

function toListRow(
    api: ScheduledTransferRow,
): InternalScheduledRow & PaymentScheduledBatchRow {
    return {
        id:            api.scdulPymnNo,
        dateTime:      formatRegDtm(api.regDtm),
        fileName:      api.fileNm ?? api.titl,
        txnCount:      Number(api.totTrnsCnt ?? "0") || 0,
        txnCurrency:   api.ccyCd,
        totalAmount:   formatNumber(api.totalTranAmt),
        // `appr_stts` and the i18n key are null until Phase B — leave
        // status undefined so the shared shell renders the "warning"
        // (no badge) treatment. When the backend ships the resolved
        // status we'll switch on `apprSttsKey` here.
        status:        deriveStatus(api),
        requestor:     api.regId,
        approver:      "",            // Phase B — approval-line join
        approvalRef:   api.apprSeqNo ?? "",
        approvalTitle: api.titl,
        action:        api.trnfYn === "Y" ? "complete" : "transfer",
        fromBank:      api.outBankCd,
        fromAccount:   api.wdrlActNo,
    };
}

/**
 * `yyyyMMddHHmmss` (14 chars, UTC) → two-line `"DD-MM-YYYY\nHH:mm:ss"`.
 * Matches the mock-row formatting so the shared table cell renders
 * byte-for-byte regardless of source. Falls back to the raw string
 * when the wire value isn't the expected length so we never throw.
 */
function formatRegDtm(raw: string | null | undefined): string {
    if (!raw || raw.length !== 14) return raw ?? "";
    const yyyy = raw.slice(0, 4);
    const mm   = raw.slice(4, 6);
    const dd   = raw.slice(6, 8);
    const HH   = raw.slice(8, 10);
    const MM   = raw.slice(10, 12);
    const SS   = raw.slice(12, 14);
    return `${dd}-${mm}-${yyyy}\n${HH}:${MM}:${SS}`;
}

/**
 * Best-effort status derivation while Phase B approval-status join is
 * still pending. `trnfYn === 'Y'` reliably means the batch has been
 * dispatched (so the user has already approved it); other states
 * default to undefined and the shared shell renders an empty status
 * cell. This logic is replaced once the backend ships
 * {@code appr_stts_key}.
 */
function deriveStatus(api: ScheduledTransferRow): ApprovalStatus | undefined {
    if (api.trnfYn === "Y") return "approved";
    if (api.apprSeqNo) return "in_progress";
    return undefined;
}

/**
 * Map a {@link PeriodKey} to the backend `from_date / to_date`
 * window. Always ends today; start is N days back. Output format is
 * {@code yyyyMMdd} per the controller's `@RequestParam` contract.
 */
function periodToWindow(period: PeriodKey): { fromDate: string; toDate: string } {
    const fmt = (d: Date): string => {
        const yyyy = d.getFullYear().toString().padStart(4, "0");
        const mm   = (d.getMonth() + 1).toString().padStart(2, "0");
        const dd   = d.getDate().toString().padStart(2, "0");
        return `${yyyy}${mm}${dd}`;
    };
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    return { fromDate: fmt(start), toDate: fmt(today) };
}
