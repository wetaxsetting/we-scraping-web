"use client";

import { useTranslation } from "@/lib/i18n";

import type { TransactionHistoryRow } from "./types";

type TransactionHistoryTableProps = {
    rows: TransactionHistoryRow[];
    onOpenFile?: (row: TransactionHistoryRow) => void;
};

/**
 * Transaction History table — Figma 134:16546.
 *
 * Bare <table> + table-fixed + <colgroup> so column widths stay stable
 * when the panel is narrower than the table's intrinsic width — the
 * parent scroll container handles horizontal scroll. The header is
 * `sticky top-0` so it stays pinned while the body scrolls; same shape
 * as <FirmBankingHistoryTable>.
 *
 * The File column renders blue-underlined links (no real navigation
 * yet — the click handler is opt-in via `onOpenFile`).
 */
export default function TransactionHistoryTable({
    rows,
    onOpenFile,
}: TransactionHistoryTableProps) {
    const { t } = useTranslation();
    return (
        <table className="w-full min-w-[920px] table-fixed border-collapse">
            <colgroup>
                <col className="w-[140px]" />
                <col className="w-[100px]" />
                <col className="w-[220px]" />
                <col className="w-[300px]" />
                <col className="w-[160px]" />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <HeaderCell sortable>
                        {t("settings.transaction_history.col.date")}
                    </HeaderCell>
                    <HeaderCell sortable>
                        {t("settings.transaction_history.col.type")}
                    </HeaderCell>
                    <HeaderCell sortable>
                        {t("settings.transaction_history.col.transaction_type")}
                    </HeaderCell>
                    <HeaderCell sortable>
                        {t("settings.transaction_history.col.file")}
                    </HeaderCell>
                    <HeaderCell sortable>
                        {t("settings.transaction_history.col.user")}
                    </HeaderCell>
                </tr>
            </thead>

            <tbody>
                {rows.map((row) => (
                    <tr
                        key={row.id}
                        className="border-b border-wb-table-border last:border-b-0"
                    >
                        <td className="whitespace-nowrap px-3 py-3 align-top">
                            <div className="flex flex-col text-wb-13 font-medium text-wb-ink">
                                <span>{formatTransactionDate(row.date)}</span>
                                <span className="text-wb-muted">{row.time}</span>
                            </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-wb-13 font-medium text-wb-ink">
                            {t(`settings.transaction_history.type.${row.type}`)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-wb-13 font-medium text-wb-ink">
                            {t(`settings.transaction_history.transaction_type.${row.transactionType}`)}
                        </td>
                        <td className="px-3 py-3 align-top">
                            <button
                                type="button"
                                onClick={() => onOpenFile?.(row)}
                                title={row.fileName}
                                className="block max-w-full cursor-pointer truncate text-left text-wb-13 font-medium text-brand underline-offset-2 hover:underline"
                            >
                                {row.fileName}
                            </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-wb-13 font-medium text-wb-ink">
                            {row.user}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function HeaderCell({
    children,
    sortable = false,
}: {
    children?: React.ReactNode;
    sortable?: boolean;
}) {
    return (
        <th className="whitespace-nowrap bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark">
            {sortable ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    {children}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/table/ico-sort.svg"
                        alt=""
                        aria-hidden
                        className="h-3 w-2 shrink-0 opacity-60"
                    />
                </span>
            ) : (
                children
            )}
        </th>
    );
}

/** `2023-07-05` → `05-07-2023` to match the Figma cell format (DD-MM-YYYY). */
function formatTransactionDate(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return `${m[3]}-${m[2]}-${m[1]}`;
}

export { formatTransactionDate };
