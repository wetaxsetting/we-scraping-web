"use client";

import { Check, ChevronDown, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import StatusBadge from "@/components/payment/approval-box/StatusBadge";
import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import CalendarIconButton from "@/components/shared/CalendarIconButton";
import DataTableFooter from "@/components/shared/DataTableFooter";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { Button } from "@/components/ui/button";
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
 * Common batch-file Scheduled row contract — every Payment module's
 * Scheduled list row satisfies this shape. Internal Transfer is the
 * canonical Figma reference (1:9972); Vendor (24:1398), Expense (25:7584),
 * Payroll (27:11294), and Overseas (29:14947) all show the same shape.
 *
 * Modules are free to extend this with module-specific fields (e.g.
 * Overseas's `scheduleDate`) — those are surfaced through the optional
 * `extraColumn` slot and never shoehorned into the canonical column list.
 */
export type ScheduledBatchAction = "transfer" | "document" | "complete";
export type ScheduledBatchRowHighlight = "selected" | "warning";

export type PaymentScheduledBatchRow = {
    id: string;
    /** Two-line date + time, e.g. `"05-07-2025\n11:39:50"`. */
    dateTime: string;
    fileName: string;
    txnCount: number;
    txnCurrency: string;
    totalAmount: string;
    status?: ApprovalStatus;
    statusStep?: string;
    requestor: string;
    approver: string;
    approverCount?: number;
    approvalRef: string;
    approvalTitle: string;
    action?: ScheduledBatchAction;
    rowHighlight?: ScheduledBatchRowHighlight;
};

/**
 * Optional module-specific column inserted between Total Transfer Amount and
 * Approval Status. Currently only used by Overseas Payment for its Schedule
 * Date column (Figma 29:14947). Header label rendering matches the canonical
 * columns; body rendering is the caller's responsibility.
 */
export type ScheduledBatchExtraColumn<Row> = {
    key: string;
    label: React.ReactNode;
    /** CSS width for the `<col>` (e.g. `"140px"`, `"var(--w-wb-st-schedule-date)"`). */
    width: string;
    align?: "left" | "right" | "center";
    render: (row: Row) => React.ReactNode;
};

type FooterTotal = { currency: string; amount: string };

export type PaymentScheduledBatchListPageProps<Row extends PaymentScheduledBatchRow> = {
    /** Already-translated page title (`t("payment.<module>.scheduled_title")`). */
    title: string;
    rows: Row[];
    /** Builds the row's detail-page route. */
    rowDetailHref: (row: Row) => string;
    /** Min-width of the table — bumped by callers that add `extraColumn`. */
    tableMinWidth?: string;
    /**
     * Optional extra column inserted between Total Transfer Amount and
     * Approval Status. Used by Overseas for Schedule Date. When supplied,
     * `tableMinWidth` MUST be wide enough to accommodate the extra width
     * (the shared default token covers the canonical 11-column layout).
     */
    extraColumn?: ScheduledBatchExtraColumn<Row>;
    /**
     * Per-currency total amounts rendered in the sibling footer. Each entry
     * produces one footer row aligned under Total Transfer Amount. Pass an
     * empty array to render only the count cell (rare).
     */
    totals: FooterTotal[];
    /** Pre-translated label for the count cell — e.g. `t("payment.document_count", { count })`. */
    countLabel?: string;
    /** Searchable string fields — defaults to fileName/requestor/approver/approvalRef/approvalTitle. */
    searchableFields?: (keyof Row & string)[];
};

const DEFAULT_TABLE_MIN_WIDTH = "var(--w-wb-st-table-min)";
const DEFAULT_SEARCHABLE: (keyof PaymentScheduledBatchRow & string)[] = [
    "fileName",
    "requestor",
    "approver",
    "approvalRef",
    "approvalTitle",
];

/**
 * Shared batch-file Scheduled Payment list page. Every Payment module
 * (Internal Transfer, Vendor, Expense, Payroll, Overseas) routes through
 * this template — see CLAUDE.md §12a "Payment Module Pagination Rule".
 *
 * Visual contract is identical across modules — Figma 1:9972 / 24:1398 /
 * 25:7584 / 27:11294 / 29:14947 all show the same toolbar (Request Approval
 * CTA + period dropdown + shared CalendarIconButton + status dropdown +
 * SearchInput), the same 11-column table (12 with Overseas's Schedule Date
 * extra), the same `paginationWithTotals` footer aligned under Total
 * Transfer Amount, and the same shared Pagination.
 *
 * Module-specific variation (page title, row shape, total amounts, detail
 * route, Schedule Date column) is supplied via props; chrome stays
 * byte-identical so the system reads as one product.
 */
export default function PaymentScheduledBatchListPage<Row extends PaymentScheduledBatchRow>({
    title,
    rows,
    rowDetailHref,
    tableMinWidth = DEFAULT_TABLE_MIN_WIDTH,
    extraColumn,
    totals,
    countLabel,
    searchableFields,
}: PaymentScheduledBatchListPageProps<Row>) {
    const { t } = useTranslation();
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const filtered = useMemo(() => {
        if (!search.trim()) return rows;
        const q = search.trim().toLowerCase();
        const fields = (searchableFields ?? DEFAULT_SEARCHABLE) as (keyof Row & string)[];
        return rows.filter((r) =>
            fields
                .map((f) => {
                    const v = r[f];
                    return typeof v === "string" ? v : "";
                })
                .join(" ")
                .toLowerCase()
                .includes(q),
        );
    }, [rows, search, searchableFields]);

    const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
    const toggleRow = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const toggleAll = () =>
        setSelected(allChecked ? new Set() : new Set(filtered.map((r) => r.id)));

    const goToDetail = (row: Row) => router.push(rowDetailHref(row));

    return (
        <PageLayout>
            <PageHeader title={title}>
                <ScheduledTitleActionGroup />
            </PageHeader>

            <ScheduledToolbar search={search} onSearchChange={setSearch} />

            <DataTableShell
                footerMode="paginationWithTotals"
                table={
                    <table
                        className="w-full table-fixed border-collapse"
                        style={{ minWidth: tableMinWidth }}
                    >
                        <ScheduledColumns extraColumn={extraColumn} />
                        <TableHeader className="sticky top-0 z-10">
                            <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                                <TableHeaderCell sortable={false}>
                                    <Checkbox
                                        checked={allChecked}
                                        onCheckedChange={toggleAll}
                                        aria-label={t("payment.aria.select_all")}
                                    />
                                </TableHeaderCell>
                                <TableHeaderCell>{t("payment.internal.col.date_time")}</TableHeaderCell>
                                <TableHeaderCell>{t("payment.internal.col.file_name")}</TableHeaderCell>
                                <TableHeaderCell>{t("payment.internal.col.txn_count")}</TableHeaderCell>
                                <TableHeaderCell>{t("payment.internal.col.total_transfer")}</TableHeaderCell>
                                {extraColumn ? (
                                    <TableHeaderCell
                                        align={extraColumn.align === "right" ? "right" : "left"}
                                    >
                                        {extraColumn.label}
                                    </TableHeaderCell>
                                ) : null}
                                <TableHeaderCell>{t("approval.col.status")}</TableHeaderCell>
                                <TableHeaderCell>{t("payment.col.requestor")}</TableHeaderCell>
                                <TableHeaderCell>{t("payment.col.approver")}</TableHeaderCell>
                                <TableHeaderCell>{t("payment.internal.col.approval_ref")}</TableHeaderCell>
                                <TableHeaderCell>{t("payment.internal.col.approval_title")}</TableHeaderCell>
                                <TableHeaderCell sortable={false}>{""}</TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((row) => (
                                <ScheduledRow
                                    key={row.id}
                                    row={row}
                                    extraColumn={extraColumn}
                                    selected={selected.has(row.id)}
                                    onToggle={() => toggleRow(row.id)}
                                    onActivate={() => goToDetail(row)}
                                />
                            ))}
                        </TableBody>
                    </table>
                }
                footer={
                    <DataTableFooter
                        colgroup={<ScheduledColumns extraColumn={extraColumn} />}
                        minWidth={tableMinWidth}
                        className="mt-auto"
                    >
                        {totals.length === 0 ? (
                            <tr>
                                <td colSpan={extraColumn ? 12 : 11} className="px-2.5 py-3">
                                    {countLabel ? (
                                        <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                                            {countLabel}
                                        </span>
                                    ) : null}
                                </td>
                            </tr>
                        ) : (
                            totals.map((total) => (
                                <ScheduledFooterRow
                                    key={total.currency}
                                    total={total}
                                    extraColumn={extraColumn}
                                />
                            ))
                        )}
                    </DataTableFooter>
                }
                pagination={
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
                }
            />
        </PageLayout>
    );
}

/* ─────────────────────────── colgroup ─────────────────────────── */

function ScheduledColumns<Row extends PaymentScheduledBatchRow>({
    extraColumn,
}: {
    extraColumn?: ScheduledBatchExtraColumn<Row>;
}) {
    return (
        <colgroup>
            <col className="w-[var(--w-wb-st-checkbox)]" />
            <col className="w-[var(--w-wb-st-datetime)]" />
            <col className="w-[var(--w-wb-st-filename)]" />
            <col className="w-[var(--w-wb-st-txn-count)]" />
            <col className="w-[var(--w-wb-st-total)]" />
            {extraColumn ? <col style={{ width: extraColumn.width }} /> : null}
            <col className="w-[var(--w-wb-st-status)]" />
            <col className="w-[var(--w-wb-st-requestor)]" />
            <col className="w-[var(--w-wb-st-approver)]" />
            <col className="w-[var(--w-wb-st-approval-ref)]" />
            <col className="w-[var(--w-wb-st-approval-title)]" />
            <col className="w-[var(--w-wb-st-action)]" />
        </colgroup>
    );
}

/* ─────────────────────────── footer row ─────────────────────────── */

function ScheduledFooterRow<Row extends PaymentScheduledBatchRow>({
    total,
    extraColumn,
}: {
    total: FooterTotal;
    extraColumn?: ScheduledBatchExtraColumn<Row>;
}) {
    const { t } = useTranslation();
    // The "Total ({currency})" label sits under columns 2-4 (Date/Time +
    // File Name + No. of Transactions), and the amount sits under Total
    // Transfer Amount (col 5). Trailing columns get one spanning empty cell.
    const trailingColspan = extraColumn ? 7 : 6;
    return (
        <tr>
            <td />
            <td colSpan={3} className="px-2.5 py-3">
                <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                    {t("payment.internal.footer_total", { currency: total.currency })}
                </span>
            </td>
            <td className="px-2.5 py-3">
                <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-ink">
                    {total.amount}
                </span>
            </td>
            <td colSpan={trailingColspan} />
        </tr>
    );
}

/* ─────────────────────────── toolbar ─────────────────────────── */

function ScheduledToolbar({
    search,
    onSearchChange,
}: {
    search: string;
    onSearchChange: (v: string) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" className="h-[var(--h-wb-filter-btn)] px-3">
                    {t("payment.internal.request_approval")}
                </Button>
                <FilterDropdown
                    label={t("payment.internal.filter.last_30_days")}
                    width="var(--w-wb-st-period)"
                />
                <CalendarIconButton />
                <FilterDropdown
                    label={t("payment.internal.filter.all_status")}
                    width="var(--w-wb-st-status-filter)"
                />
            </div>
            <SearchInput value={search} onChange={onSearchChange} />
        </div>
    );
}

function ScheduledTitleActionGroup() {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-2">
            <ToolbarIcon
                src="/assets/common/ico-list.svg"
                label={t("common.open_list")}
            />
            <ToolbarIcon
                src="/assets/common/ico-print.svg"
                label={t("common.print")}
            />
            <ExcelUploadButton />
        </div>
    );
}

function FilterDropdown({ label, width }: { label: string; width?: string }) {
    return (
        <button
            type="button"
            className="flex h-[var(--h-wb-filter-btn)] items-center justify-between gap-2 rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-13 font-medium text-wb-ink hover:bg-neutral-50"
            style={width ? { width } : undefined}
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

function ToolbarIcon({ src, label }: { src: string; label: string }) {
    return (
        <button
            type="button"
            aria-label={label}
            className="flex size-8 items-center justify-center rounded-md hover:bg-black/5"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" aria-hidden className="size-5" />
        </button>
    );
}

function ExcelUploadButton() {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            className="flex h-[var(--h-wb-filter-btn)] items-center gap-2 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium text-wb-ink hover:bg-neutral-50"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/assets/common/ico-excel.svg"
                alt=""
                aria-hidden
                className="size-4"
            />
            {t("payment.internal.excel_upload")}
        </button>
    );
}

/* ─────────────────────────── row ─────────────────────────── */

function ScheduledRow<Row extends PaymentScheduledBatchRow>({
    row,
    extraColumn,
    selected,
    onToggle,
    onActivate,
}: {
    row: Row;
    extraColumn?: ScheduledBatchExtraColumn<Row>;
    selected: boolean;
    onToggle: () => void;
    onActivate: () => void;
}) {
    const { t } = useTranslation();
    const [date, time] = row.dateTime.split("\n");

    return (
        <TableRow
            className={cn(
                "h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0",
                row.rowHighlight === "selected" && "bg-wb-status-progress-bg",
                row.rowHighlight === "warning" && "bg-wb-status-pending-bg",
            )}
        >
            <TableCell className="px-2.5 py-2.5">
                <Checkbox
                    checked={selected}
                    onCheckedChange={onToggle}
                    aria-label={t("payment.aria.select_file", { fileName: row.fileName })}
                />
            </TableCell>

            <BodyCell onClick={onActivate}>
                <span className="block text-wb-13 font-medium text-wb-ink">{date}</span>
                {time ? (
                    <span className="mt-0.5 block text-wb-12 font-normal text-wb-ntrl-6">
                        {time}
                    </span>
                ) : null}
            </BodyCell>

            <BodyCell onClick={onActivate}>
                <TextSpan>{row.fileName}</TextSpan>
            </BodyCell>

            <BodyCell onClick={onActivate}>
                <TextSpan>
                    {t("payment.internal.txn_count_with_currency", {
                        count: String(row.txnCount),
                        currency: row.txnCurrency,
                    })}
                </TextSpan>
            </BodyCell>

            <BodyCell onClick={onActivate}>
                <TextSpan>{row.totalAmount}</TextSpan>
            </BodyCell>

            {extraColumn ? (
                <TableCell
                    onClick={onActivate}
                    className={cn(
                        "cursor-pointer px-2.5 py-2.5",
                        extraColumn.align === "right" && "text-right",
                        extraColumn.align === "center" && "text-center",
                    )}
                >
                    {extraColumn.render(row)}
                </TableCell>
            ) : null}

            <TableCell className="px-2.5 py-2.5">
                {row.status ? (
                    <StatusBadge
                        status={row.status}
                        step={row.statusStep}
                        label={t(`payment.status.${row.status}`)}
                    />
                ) : null}
            </TableCell>

            <BodyCell onClick={onActivate}>
                <TextSpan>{row.requestor}</TextSpan>
            </BodyCell>

            <TableCell className="px-2.5 py-2.5">
                <div className="flex items-center gap-1">
                    <span className="truncate text-wb-13 font-medium text-wb-ink">
                        {row.approver}
                    </span>
                    {row.approverCount != null ? (
                        <>
                            <span className="inline-flex items-center justify-center rounded-[4px] border border-wb-ntrl-4 bg-wb-ntrl-3 px-1 text-wb-10 font-medium uppercase text-black/70">
                                {row.approverCount}
                            </span>
                            <ChevronDown
                                aria-hidden
                                className="size-[18px] shrink-0 text-wb-ntrl-6"
                                strokeWidth={1.8}
                            />
                        </>
                    ) : null}
                </div>
            </TableCell>

            <BodyCell onClick={onActivate}>
                <TextSpan>{row.approvalRef}</TextSpan>
            </BodyCell>

            <BodyCell onClick={onActivate}>
                <span className="block text-wb-13 font-medium leading-snug text-wb-ink">
                    {row.approvalTitle}
                </span>
            </BodyCell>

            <TableCell className="px-2.5 py-2.5">
                <RowAction action={row.action} onPrimary={onActivate} />
            </TableCell>
        </TableRow>
    );
}

function BodyCell({
    children,
    onClick,
}: {
    children: React.ReactNode;
    onClick?: () => void;
}) {
    return (
        <TableCell
            onClick={onClick}
            className={cn("px-2.5 py-2.5", onClick && "cursor-pointer")}
        >
            {children}
        </TableCell>
    );
}

function TextSpan({ children }: { children: React.ReactNode }) {
    return (
        <span className="block truncate text-wb-13 font-medium text-wb-ink">
            {children}
        </span>
    );
}

function RowAction({
    action,
    onPrimary,
}: {
    action?: ScheduledBatchAction;
    onPrimary: () => void;
}) {
    const { t } = useTranslation();

    if (action === "transfer") {
        return (
            <div className="flex items-center justify-end gap-1.5">
                <button
                    type="button"
                    onClick={onPrimary}
                    className="flex h-7 items-center rounded-md border border-wb-ntrl-4 bg-white px-2 text-wb-13 font-medium text-wb-ink hover:bg-neutral-50"
                >
                    {t("payment.internal.transfer_action")}
                </button>
                <DocumentIcon onClick={onPrimary} />
            </div>
        );
    }
    if (action === "complete") {
        return (
            <div className="flex items-center justify-end gap-1.5">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-wb-status-approved-text text-white">
                    <Check className="size-3" strokeWidth={3} />
                </span>
                <DocumentIcon onClick={onPrimary} />
            </div>
        );
    }
    return (
        <div className="flex items-center justify-end">
            <DocumentIcon onClick={onPrimary} />
        </div>
    );
}

function DocumentIcon({ onClick }: { onClick: () => void }) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={t("payment.aria.open_detail")}
            className="flex size-6 items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5"
        >
            <FileText className="size-4" strokeWidth={1.8} />
        </button>
    );
}
