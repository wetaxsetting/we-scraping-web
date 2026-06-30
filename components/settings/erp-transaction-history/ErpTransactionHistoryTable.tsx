"use client";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import type { SortDirection } from "@/hooks/useTableSort";
import { formatUtcDtmByLanguage } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";

import type { ErpTransactionHistoryRow } from "./types";

type ErpTransactionHistoryTableProps = {
    rows: ErpTransactionHistoryRow[];
    /** Currently-sorting FIELD_ID (e.g. `REG_DTM`). */
    sortField: string | null;
    sortDirection: SortDirection;
    /** Click / Enter / Space handler — receives the column's FIELD_ID. */
    onSort: (fieldId: string) => void;
    /** Fires when a row's File cell is clicked. Only invoked when
     *  `fileSize > 0` — batch rows with no physical file render an empty
     *  File cell (no button), mirroring legacy
     *  `comm_0219_001.ts:329-345`. */
    onDownload: (row: ErpTransactionHistoryRow) => void;
};

/**
 * ERP Transaction History table — Figma 134:16546.
 *
 * <p>Bare `<table>` + `table-fixed` + `<colgroup>` so column widths stay
 * stable when the panel is narrower than the table's intrinsic width —
 * the parent scroll container handles horizontal scroll. The header is
 * `sticky top-0` so it stays pinned while the body scrolls; same shape
 * as `<FirmBankingHistoryTable>`.
 *
 * <p>Headers use the shared `<TableHeaderCell>` so the sort glyph + ARIA
 * semantics match every other list page. FIELD_IDs match the backend
 * whitelist `ErpTrnsHistorySortField` (`REG_DTM`, `ERP_TYPE`,
 * `TRNS_TYPE_CD`, `REG_USER`). The `FILE` header is non-sortable
 * (OQ-5 resolved — legacy shows a sort glyph but no IDO column maps to
 * it, so refactor surfaces the column as static).
 *
 * <p>File cell renders as a `<button>` (not an `<a href download>`)
 * because the JWT lives in `localStorage` and a plain anchor wouldn't
 * carry the Bearer header — OQ-FE-1 resolved 2026-05-11 → download
 * flows through `lib/file.ts downloadFile(url, filename)`.
 */
export default function ErpTransactionHistoryTable({
    rows,
    sortField,
    sortDirection,
    onSort,
    onDownload,
}: ErpTransactionHistoryTableProps) {
    const { t } = useTranslation();
    return (
        <table className="w-full min-w-[920px] table-fixed border-collapse">
            <colgroup>
                <col className="w-[146px]" />
                <col className="w-[140px]" />
                <col className="w-[280px]" />
                <col className="w-[280px]" />
                <col className="w-[160px]" />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <TableHeaderCell
                        sortFieldId="REG_DTM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                    >
                        {t("settings.erp_transaction_history.col.date")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="ERP_TYPE"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                    >
                        {t("settings.erp_transaction_history.col.type")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="TRNS_TYPE_CD"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                    >
                        {t("settings.erp_transaction_history.col.transaction_type")}
                    </TableHeaderCell>
                    <TableHeaderCell sortable={false} textSizeClass="text-wb-13">
                        {t("settings.erp_transaction_history.col.file")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="REG_USER"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                    >
                        {t("settings.erp_transaction_history.col.user")}
                    </TableHeaderCell>
                </tr>
            </thead>

            <tbody>
                {rows.map((row) => (
                    <tr
                        key={row.seqNo}
                        className="border-b border-wb-table-border last:border-b-0"
                    >
                        <td className="whitespace-nowrap px-3 py-3 align-top">
                            <DateTimeCell regDtm={row.regDtm} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-wb-13 font-medium text-wb-ink">
                            {row.erpTypeKey ? t(row.erpTypeKey) : row.erpType}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-wb-13 font-medium text-wb-ink">
                            {row.trnsTypeKey ? t(row.trnsTypeKey) : row.trnsTypeCd}
                        </td>
                        <td className="px-3 py-3 align-top">
                            {row.fileSize > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => onDownload(row)}
                                    className="block max-w-full cursor-pointer truncate text-left text-wb-13 font-medium text-brand underline-offset-2 hover:underline"
                                >
                                    {row.orgFileNm}
                                </button>
                            ) : (
                                <span aria-hidden className="text-wb-13" />
                            )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-wb-13 font-medium text-wb-ink">
                            {row.userNm ?? row.regId}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/** Render the `yyyyMMddHHmmss` wire string as a two-line stack: date on
 *  top, time (HH:mm:ss) muted underneath. `REG_DTM` is a UTC instant
 *  (see `ErpTrnsHstr.java:103` "UTC timestamp"), so it is shifted to the
 *  display zone (Asia/Ho_Chi_Minh) AND rendered per the active language
 *  (EN DD-MMM-YYYY / KO YYYY-MM-DD / VI DD-MM-YYYY) via the shared
 *  locale+TZ helper — the same one every Payment/Add-on list uses. */
function DateTimeCell({ regDtm }: { regDtm: string }) {
    const { locale } = useTranslation();
    const { date, time } = formatUtcDtmByLanguage(regDtm, locale);
    return (
        <div className="flex flex-col text-wb-13 font-medium text-wb-ink">
            <span>{date}</span>
            {time ? <span className="text-wb-muted">{time}</span> : null}
        </div>
    );
}
