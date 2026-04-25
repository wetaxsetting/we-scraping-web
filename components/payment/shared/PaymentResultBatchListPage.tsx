"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import CalendarIconButton from "@/components/shared/CalendarIconButton";
import DataTableFooter from "@/components/shared/DataTableFooter";
import DataTableShell from "@/components/shared/DataTableShell";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { Checkbox } from "@/components/ui/checkbox";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Common batch-file Result row contract — every Payment module's Result
 * list row satisfies this shape. Internal Transfer is the canonical Figma
 * reference (1:11730); Vendor (24:5491), Expense (25:9221), Payroll
 * (27:12877), and Overseas (29:16738) all show the same shape.
 */
export type PaymentResultBatchRowStatus = "completed" | "in_progress";

export type PaymentResultBatchRow = {
    id: string;
    /** Two-line date + time, e.g. `"30-10-2024\n11:39:50"`. */
    dateTime: string;
    fileName: string;
    txnCount: number;
    txnCurrency: string;
    totalAmount: string;
    status: PaymentResultBatchRowStatus;
    /** Inline success counter — only rendered when `status === "completed"`. */
    successCount?: number;
    /** Inline failed counter — only rendered when `status === "completed"`. */
    failedCount?: number;
    approvalRef: string;
    approvalTitle: string;
};

type FooterTotal = { currency: string; amount: string };

export type PaymentResultBatchListPageProps<Row extends PaymentResultBatchRow> = {
    /** Already-translated page title (`t("payment.<module>.result_title")`). */
    title: string;
    rows: Row[];
    /** Builds the row's detail-page route. */
    rowDetailHref: (row: Row) => string;
    /** Min-width of the table — defaults to the canonical 8-column token. */
    tableMinWidth?: string;
    /**
     * Per-currency total amounts rendered in the sibling footer. Pass an
     * empty array (or omit) to use `paginationOnly` mode — Internal
     * Transfer Result is the only Result page that omits the totals row
     * per Figma 1:11730. Every other Payment Result variant must supply
     * at least one total per CLAUDE.md §12a.
     */
    totals?: FooterTotal[];
    /** Searchable string fields — defaults to fileName/approvalRef/approvalTitle. */
    searchableFields?: (keyof Row & string)[];
};

const DEFAULT_TABLE_MIN_WIDTH = "var(--w-wb-tr-table-min)";
const DEFAULT_SEARCHABLE: (keyof PaymentResultBatchRow & string)[] = [
    "fileName",
    "approvalRef",
    "approvalTitle",
];

/**
 * Shared batch-file Payment Result list page. Every Payment module routes
 * through this template — see CLAUDE.md §12a. Visual contract is identical
 * across modules: same toolbar (period dropdown + shared CalendarIconButton
 * + Completed / In Progress checkboxes + SearchInput), same 8-column table
 * (no checkbox, status counters, trailing per-row size-4 download glyph),
 * same `paginationWithTotals` footer aligned under Total Transfer Amount
 * (or `paginationOnly` for Internal Transfer Result).
 */
export default function PaymentResultBatchListPage<Row extends PaymentResultBatchRow>({
    title,
    rows,
    rowDetailHref,
    tableMinWidth = DEFAULT_TABLE_MIN_WIDTH,
    totals,
    searchableFields,
}: PaymentResultBatchListPageProps<Row>) {
    const { t } = useTranslation();
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState({
        completed: false,
        in_progress: false,
    });

    const filtered = useMemo(() => {
        const anyChecked = statusFilter.completed || statusFilter.in_progress;
        const bucket = anyChecked
            ? rows.filter(
                (r) =>
                    (statusFilter.completed && r.status === "completed") ||
                    (statusFilter.in_progress && r.status === "in_progress"),
            )
            : rows;
        if (!search.trim()) return bucket;
        const q = search.trim().toLowerCase();
        const fields = (searchableFields ?? DEFAULT_SEARCHABLE) as (keyof Row & string)[];
        return bucket.filter((r) =>
            fields
                .map((f) => {
                    const v = r[f];
                    return typeof v === "string" ? v : "";
                })
                .join(" ")
                .toLowerCase()
                .includes(q),
        );
    }, [rows, search, statusFilter, searchableFields]);

    const goToDetail = (row: Row) => router.push(rowDetailHref(row));

    const hasTotals = totals != null && totals.length > 0;

    const tableNode = (
        <table
            className="w-full table-fixed border-collapse"
            style={{ minWidth: tableMinWidth }}
        >
            <ResultColumns />
            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell>{t("payment.internal.col.date_time")}</TableHeaderCell>
                    <TableHeaderCell>{t("payment.internal.col.file_name")}</TableHeaderCell>
                    <TableHeaderCell>{t("payment.internal.col.txn_count")}</TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("payment.internal.col.total_transfer")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("payment.internal.result.col.transfer_status")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("payment.internal.col.approval_ref")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("payment.internal.col.approval_title")}
                    </TableHeaderCell>
                    <TableHeaderCell sortable={false}>{""}</TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filtered.map((row) => (
                    <ResultRow key={row.id} row={row} onActivate={() => goToDetail(row)} />
                ))}
            </TableBody>
        </table>
    );

    const paginationNode = (
        <Pagination
            page={1}
            pageCount={Math.max(1, Math.ceil(filtered.length / 10))}
            pageSize={10}
            totalLabel={t("common.showing_of", {
                shown: String(Math.min(filtered.length, 10)),
                total: String(filtered.length),
            })}
            className="shrink-0"
        />
    );

    return (
        <PageLayout>
            <PageHeader title={title}>
                <PageActionButtons showList showPrint showExcel />
            </PageHeader>

            <ResultToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
            />

            {hasTotals ? (
                <DataTableShell
                    footerMode="paginationWithTotals"
                    table={tableNode}
                    footer={
                        <DataTableFooter
                            colgroup={<ResultColumns />}
                            minWidth={tableMinWidth}
                            className="mt-auto"
                        >
                            {totals!.map((total) => (
                                <ResultFooterRow key={total.currency} total={total} />
                            ))}
                        </DataTableFooter>
                    }
                    pagination={paginationNode}
                />
            ) : (
                <DataTableShell
                    footerMode="paginationOnly"
                    table={tableNode}
                    pagination={paginationNode}
                />
            )}
        </PageLayout>
    );
}

/* ─────────────────────────── colgroup ─────────────────────────── */

function ResultColumns() {
    return (
        <colgroup>
            <col className="w-[var(--w-wb-tr-datetime)]" />
            <col className="w-[var(--w-wb-tr-filename)]" />
            <col className="w-[var(--w-wb-tr-txn-count)]" />
            <col className="w-[var(--w-wb-tr-total)]" />
            <col className="w-[var(--w-wb-tr-status)]" />
            <col className="w-[var(--w-wb-tr-approval-ref)]" />
            <col className="w-[var(--w-wb-tr-approval-title)]" />
            <col className="w-[var(--w-wb-tr-action)]" />
        </colgroup>
    );
}

/* ─────────────────────────── footer row ─────────────────────────── */

function ResultFooterRow({ total }: { total: FooterTotal }) {
    const { t } = useTranslation();
    // Result table is 8 cols. "Total ({currency})" sits under columns 1-3
    // (Date/Time + File Name + No. of Transactions); the amount lives
    // under Total Transfer Amount (col 4, right-aligned). Trailing 4
    // columns get one spanning empty cell.
    return (
        <tr>
            <td colSpan={3} className="px-2.5 py-3">
                <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                    {t("payment.internal.footer_total", { currency: total.currency })}
                </span>
            </td>
            <td className="px-2.5 py-3 text-right">
                <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-ink">
                    {total.amount}
                </span>
            </td>
            <td colSpan={4} />
        </tr>
    );
}

/* ─────────────────────────── toolbar ─────────────────────────── */

function ResultToolbar({
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
}: {
    search: string;
    onSearchChange: (v: string) => void;
    statusFilter: { completed: boolean; in_progress: boolean };
    onStatusFilterChange: (next: { completed: boolean; in_progress: boolean }) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
                <PeriodDropdown label={t("payment.internal.filter.last_30_days")} />
                <CalendarIconButton />
                <FilterCheckbox
                    label={t("payment.internal.result.filter.completed")}
                    checked={statusFilter.completed}
                    onChange={(next) =>
                        onStatusFilterChange({ ...statusFilter, completed: next })
                    }
                />
                <FilterCheckbox
                    label={t("payment.internal.result.filter.in_progress")}
                    checked={statusFilter.in_progress}
                    onChange={(next) =>
                        onStatusFilterChange({ ...statusFilter, in_progress: next })
                    }
                />
            </div>
            <SearchInput value={search} onChange={onSearchChange} />
        </div>
    );
}

function PeriodDropdown({ label }: { label: string }) {
    return (
        <button
            type="button"
            className="flex h-[var(--h-wb-filter-btn)] items-center justify-between gap-2 rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-13 font-medium text-wb-ink hover:bg-neutral-50"
            style={{ width: "var(--w-wb-st-period)" }}
        >
            <span className="truncate">{label}</span>
            <ChevronDown
                aria-hidden
                className="size-4 shrink-0 text-wb-ntrl-6"
                strokeWidth={1.8}
            />
        </button>
    );
}

function FilterCheckbox({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-2 text-wb-13 font-medium text-wb-ink">
            <Checkbox
                checked={checked}
                onCheckedChange={(v) => onChange(v === true)}
                aria-label={label}
            />
            {label}
        </label>
    );
}

/* ─────────────────────────── row ─────────────────────────── */

function ResultRow<Row extends PaymentResultBatchRow>({
    row,
    onActivate,
}: {
    row: Row;
    onActivate: () => void;
}) {
    const { t } = useTranslation();
    const [date, time] = row.dateTime.split("\n");

    return (
        <TableRow
            role="link"
            tabIndex={0}
            onClick={onActivate}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onActivate();
                }
            }}
            className={cn(
                "h-[var(--h-wb-table-row)] cursor-pointer border-b border-wb-table-border last:border-b-0 hover:bg-wb-bg-active",
            )}
        >
            <TableCell className="px-2.5 py-2.5">
                <span className="block text-wb-13 font-medium text-wb-ink">{date}</span>
                {time ? (
                    <span className="mt-0.5 block text-wb-12 font-normal text-wb-ntrl-6">
                        {time}
                    </span>
                ) : null}
            </TableCell>
            <TableCell className="px-2.5 py-2.5">
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {row.fileName}
                </span>
            </TableCell>
            <TableCell className="px-2.5 py-2.5">
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {row.txnCount} Trx ({row.txnCurrency})
                </span>
            </TableCell>
            <TableCell className="px-2.5 py-2.5 text-right">
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {row.totalAmount}
                </span>
            </TableCell>
            <TableCell className="px-2.5 py-2.5">
                <ResultStatusCell row={row} />
            </TableCell>
            <TableCell className="px-2.5 py-2.5">
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {row.approvalRef}
                </span>
            </TableCell>
            <TableCell className="px-2.5 py-2.5">
                <span className="block text-wb-13 font-medium leading-snug text-wb-ink">
                    {row.approvalTitle}
                </span>
            </TableCell>
            <TableCell className="px-2.5 py-2.5">
                <button
                    type="button"
                    aria-label={t("payment.internal.result.aria.download_file")}
                    onClick={(e) => e.stopPropagation()}
                    className="flex size-6 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-download.svg"
                        alt=""
                        aria-hidden
                        className="size-4"
                    />
                </button>
            </TableCell>
        </TableRow>
    );
}

function ResultStatusCell({ row }: { row: PaymentResultBatchRow }) {
    const { t } = useTranslation();
    if (row.status === "in_progress") {
        return (
            <span className="text-wb-13 font-semibold text-wb-status-progress-text">
                {t("payment.internal.result.status.in_progress")}
            </span>
        );
    }
    return (
        <div className="flex items-center gap-2">
            <span className="text-wb-13 font-semibold text-wb-status-approved-text">
                {t("payment.internal.result.status.completed")}
            </span>
            {row.successCount != null && (
                <CountPill kind="success" count={row.successCount} />
            )}
            {row.failedCount != null && (
                <CountPill kind="failed" count={row.failedCount} />
            )}
        </div>
    );
}

function CountPill({
    kind,
    count,
}: {
    kind: "success" | "failed";
    count: number;
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 text-wb-13 font-semibold",
                kind === "success"
                    ? "text-wb-status-approved-text"
                    : "text-wb-status-rejected-text",
            )}
        >
            {count}
            {kind === "success" ? (
                <span
                    aria-hidden
                    className="inline-flex size-3.5 items-center justify-center rounded-full bg-wb-status-approved-text text-white"
                >
                    <CheckGlyph />
                </span>
            ) : (
                <span
                    aria-hidden
                    className="inline-flex size-3.5 items-center justify-center rounded-full bg-wb-status-rejected-text text-white text-[9px] font-bold leading-none"
                >
                    !
                </span>
            )}
        </span>
    );
}

function CheckGlyph() {
    return (
        <svg
            viewBox="0 0 12 12"
            className="size-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M2.5 6.5L5 9l4.5-5" />
        </svg>
    );
}
