"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import ReportSection from "@/components/banking/reports/ReportSection";
import CurrencyScopeToggle, {
    type CurrencyScope,
} from "@/components/shared/CurrencyScopeToggle";
import FilterRow from "@/components/shared/FilterRow";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import ReportLayout from "@/components/shared/ReportLayout";
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
import { printReport, escapeHtml } from "@/lib/print";
import {
    exportReportExcel,
    reportDateSuffix,
    type ReportExcelSection,
} from "@/lib/reportExcel";
import { cn } from "@/lib/utils";

import {
    mockCurrencyFlow,
    mockCurrentAccounts,
    mockFinancialStatus,
} from "./mockData";
import type {
    CurrencyFlowRow,
    CurrentAccountRow,
    FinancialStatus,
    TransactionDetailRow,
} from "./types";

/**
 * Daily Financial report — `docs/refactor-wecms/features/daily-financial-report.md`.
 *
 * Same CMC empty-state Search flow as the predecessor Daily Cash page
 * (CLAUDE.md §7b), evolved to add:
 *   - per-account expandable transaction drill-down
 *   - "Active accounts only" + "Include internal transfers" filters
 *   - per-currency flow rollup (REC3)
 *
 * Falls back to {@link mockCurrentAccounts} / {@link mockCurrencyFlow}
 * when the live API has not populated the section yet — keeps the page
 * usable while the Sprint-2 transactions + flow port lands.
 */
type DailyFinancialPageProps = {
    financialStatus?: FinancialStatus[];
    currentAccounts?: CurrentAccountRow[];
    currencyFlow?: CurrencyFlowRow[];
    /** Controlled filter wiring. When omitted, the page falls back to
     *  local state and renders rows from props verbatim (legacy mode). */
    asOfDate?: string;
    scope?: CurrencyScope;
    onScopeChange?: (next: CurrencyScope) => void;
    activeOnly?: boolean;
    onActiveOnlyChange?: (next: boolean) => void;
    includeInternalTransfers?: boolean;
    onIncludeInternalTransfersChange?: (next: boolean) => void;
    onSearch?: () => void;
    hasSearched?: boolean;
    loading?: boolean;
};

export default function DailyFinancialPage({
    financialStatus,
    currentAccounts,
    currencyFlow,
    asOfDate: asOfDateProp,
    scope: scopeProp,
    onScopeChange,
    activeOnly: activeOnlyProp,
    onActiveOnlyChange,
    includeInternalTransfers: includeInternalProp,
    onIncludeInternalTransfersChange,
    onSearch,
    hasSearched: hasSearchedProp,
    loading = false,
}: DailyFinancialPageProps = {}) {
    const { t } = useTranslation();
    const [localScope, setLocalScope] = useState<CurrencyScope>("all");
    const [localActiveOnly, setLocalActiveOnly] = useState(true);
    const [localIncludeInternal, setLocalIncludeInternal] = useState(true);
    const [localSearched, setLocalSearched] = useState(false);

    const scope = scopeProp ?? localScope;
    const setScope = (next: CurrencyScope) =>
        onScopeChange ? onScopeChange(next) : setLocalScope(next);

    const activeOnly = activeOnlyProp ?? localActiveOnly;
    const setActiveOnly = (next: boolean) =>
        onActiveOnlyChange ? onActiveOnlyChange(next) : setLocalActiveOnly(next);

    const includeInternalTransfers = includeInternalProp ?? localIncludeInternal;
    const setIncludeInternalTransfers = (next: boolean) =>
        onIncludeInternalTransfersChange
            ? onIncludeInternalTransfersChange(next)
            : setLocalIncludeInternal(next);

    const hasSearched = hasSearchedProp ?? localSearched;
    const handleSearch = () =>
        onSearch ? onSearch() : setLocalSearched(true);

    const asOfDate = asOfDateProp ?? "25-04-2026";
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const sourceStatus = financialStatus ?? mockFinancialStatus;
    const sourceAccounts =
        currentAccounts && currentAccounts.length > 0
            ? currentAccounts
            : mockCurrentAccounts;
    const sourceFlow =
        currencyFlow && currencyFlow.length > 0 ? currencyFlow : mockCurrencyFlow;

    const matchesScope = (currency: string) =>
        scope === "all"
            ? true
            : scope === "vnd"
                ? currency === "VND"
                : currency !== "VND";

    const visibleStatus = useMemo(
        () => sourceStatus.filter((s) => matchesScope(s.currency)),
        [sourceStatus, scope],
    );

    const visibleAccounts = useMemo(
        () =>
            sourceAccounts.filter((row) => {
                if (!matchesScope(row.currency)) return false;
                if (activeOnly && row.activeYn !== "Y") return false;
                return true;
            }),
        [sourceAccounts, scope, activeOnly],
    );

    const visibleFlow = useMemo(
        () => sourceFlow.filter((f) => matchesScope(f.currency)),
        [sourceFlow, scope],
    );

    const toggleExpanded = (id: string) =>
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    const handlePrint = () => {
        const title = t("report.daily_financial.title");
        const summary = `${t("report.as_of")} ${asOfDate}  |  ${t("report.currency_label")} ${t(`report.daily_financial.scope.${scope}`)}`;
        printReport({
            title,
            summary,
            columns: [
                { header: t("report.daily_financial.col.bank"), render: (r) => escapeHtml(r.bank) },
                { header: t("report.daily_financial.col.account_no"), render: (r) => escapeHtml(r.accountNo) },
                { header: t("report.daily_financial.col.account_nickname"), render: (r) => escapeHtml(r.accountNickname) },
                { header: t("report.daily_financial.col.currency"), render: (r) => escapeHtml(r.currency) },
                { header: t("report.daily_financial.col.num_debits"), align: "right", render: (r) => escapeHtml(String(r.numDebits)) },
                { header: t("report.daily_financial.col.debit"), align: "right", render: (r) => escapeHtml(r.debit) },
                { header: t("report.daily_financial.col.num_credits"), align: "right", render: (r) => escapeHtml(String(r.numCredits)) },
                { header: t("report.daily_financial.col.credit"), align: "right", render: (r) => escapeHtml(r.credit) },
                { header: t("report.daily_financial.col.balance"), align: "right", render: (r) => escapeHtml(r.balance) },
            ],
            rows: visibleAccounts,
        });
    };

    const handleExportExcel = () => {
        const title = t("report.daily_financial.title");
        const sections: ReportExcelSection<unknown>[] = [];

        if (visibleStatus.length > 0) {
            sections.push({
                title: t("report.daily_financial.col.current_accounts") + " / " + t("report.daily_financial.col.saving_accounts"),
                columns: [
                    { header: t("report.daily_financial.col.currency"), value: (r: unknown) => (r as FinancialStatus).currency, widthChars: 12 },
                    { header: t("report.daily_financial.col.current_accounts"), value: (r: unknown) => (r as FinancialStatus).currentAccounts, widthChars: 24, align: "right" },
                    { header: t("report.daily_financial.col.saving_accounts"), value: (r: unknown) => (r as FinancialStatus).savingAccounts, widthChars: 24, align: "right" },
                ],
                rows: visibleStatus,
            });
        }

        sections.push({
            title: t("report.daily_financial.section.current_accounts"),
            columns: [
                { header: t("report.daily_financial.col.bank"), value: (r: unknown) => (r as CurrentAccountRow).bank, widthChars: 18 },
                { header: t("report.daily_financial.col.account_no"), value: (r: unknown) => (r as CurrentAccountRow).accountNo, widthChars: 22 },
                { header: t("report.daily_financial.col.account_nickname"), value: (r: unknown) => (r as CurrentAccountRow).accountNickname, widthChars: 26 },
                { header: t("report.daily_financial.col.currency"), value: (r: unknown) => (r as CurrentAccountRow).currency, widthChars: 10 },
                { header: t("report.daily_financial.col.num_debits"), value: (r: unknown) => (r as CurrentAccountRow).numDebits, widthChars: 14, align: "right" },
                { header: t("report.daily_financial.col.debit"), value: (r: unknown) => (r as CurrentAccountRow).debit, widthChars: 22, align: "right" },
                { header: t("report.daily_financial.col.num_credits"), value: (r: unknown) => (r as CurrentAccountRow).numCredits, widthChars: 14, align: "right" },
                { header: t("report.daily_financial.col.credit"), value: (r: unknown) => (r as CurrentAccountRow).credit, widthChars: 22, align: "right" },
                { header: t("report.daily_financial.col.balance"), value: (r: unknown) => (r as CurrentAccountRow).balance, widthChars: 22, align: "right" },
            ],
            rows: visibleAccounts,
        });

        if (visibleFlow.length > 0) {
            sections.push({
                title: t("report.daily_financial.section.currency_flow"),
                columns: [
                    { header: t("report.daily_financial.flow.currency"), value: (r: unknown) => (r as CurrencyFlowRow).currency, widthChars: 12 },
                    { header: t("report.daily_financial.flow.before_balance"), value: (r: unknown) => (r as CurrencyFlowRow).beforeDateBalance, widthChars: 22, align: "right" },
                    { header: t("report.daily_financial.flow.balance"), value: (r: unknown) => (r as CurrencyFlowRow).balance, widthChars: 22, align: "right" },
                    { header: t("report.daily_financial.flow.send_count"), value: (r: unknown) => (r as CurrencyFlowRow).sendCount, widthChars: 14, align: "right" },
                    { header: t("report.daily_financial.flow.send_amount"), value: (r: unknown) => (r as CurrencyFlowRow).sendAmount, widthChars: 22, align: "right" },
                    { header: t("report.daily_financial.flow.receive_count"), value: (r: unknown) => (r as CurrencyFlowRow).receiveCount, widthChars: 14, align: "right" },
                    { header: t("report.daily_financial.flow.receive_amount"), value: (r: unknown) => (r as CurrencyFlowRow).receiveAmount, widthChars: 22, align: "right" },
                ],
                rows: visibleFlow,
            });
        }

        exportReportExcel({
            title,
            subHeader: [
                { left: `${t("report.as_of")} ${asOfDate}` },
                { left: `${t("report.currency_label")} ${t(`report.daily_financial.scope.${scope}`)}` },
            ],
            sections,
            fileName: `DailyFinancial_${reportDateSuffix()}`,
            sheetName: "Daily Financial",
        });
    };

    return (
        <PageLayout>
            <PageHeader title={t("report.daily_financial.title")}>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        aria-label={t("common.print")}
                        onClick={handlePrint}
                        className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-print.svg"
                            alt=""
                            aria-hidden
                            className="size-5"
                        />
                    </button>
                    <button
                        type="button"
                        aria-label={t("common.export_excel")}
                        onClick={handleExportExcel}
                        className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-excel.svg"
                            alt=""
                            aria-hidden
                            className="size-5"
                        />
                    </button>
                </div>
            </PageHeader>

            <FilterRow
                right={
                    <div className="flex flex-wrap items-center gap-4">
                        <FilterCheckbox
                            checked={activeOnly}
                            onChange={setActiveOnly}
                            label={t("report.daily_financial.opt.active_only")}
                        />
                        <FilterCheckbox
                            checked={includeInternalTransfers}
                            onChange={setIncludeInternalTransfers}
                            label={t("report.daily_financial.opt.internal_transfers")}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleSearch}
                            disabled={loading}
                            className="h-[var(--h-wb-filter-btn)] gap-2 px-4 text-wb-14 text-brand"
                        >
                            <Search className="size-4" strokeWidth={2} />
                            {t("common.search")}
                        </Button>
                    </div>
                }
            >
                <span className="text-wb-14-tight font-medium text-black">
                    {t("report.as_of")}
                </span>
                <div className="flex h-[var(--h-wb-filter-btn)] items-center gap-2 overflow-clip rounded-md bg-white p-2 shadow-wb-btn">
                    <span className="whitespace-nowrap text-wb-14-tight font-medium text-wb-ntrl-8">
                        {asOfDate}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-calendar-outline.svg"
                        alt=""
                        aria-hidden
                        className="size-4"
                    />
                </div>
                <CurrencyScopeToggle
                    value={scope}
                    onChange={setScope}
                    labels={{
                        all: t("report.daily_financial.scope.all"),
                        vnd: t("report.scope.vnd"),
                        fcy: t("report.scope.fcy"),
                    }}
                />
            </FilterRow>

            {hasSearched ? (
                <ReportLayout sectioned>
                    <h2 className="text-center text-wb-18 font-semibold tracking-wb-tight text-black">
                        {t("report.daily_financial.title")}
                    </h2>

                    <div className="flex items-center rounded-md border border-wb-ntrl-4 bg-white p-4">
                        <p className="text-wb-14-tight font-medium text-black">
                            <span>{t("report.as_of")} </span>
                            <span className="text-wb-13 text-wb-ntrl-8">
                                {asOfDate}
                            </span>
                            <span> {t("report.currency_label")} </span>
                            <span className="text-wb-13 text-wb-ntrl-8">
                                {t(`report.daily_financial.scope.${scope}`)}
                            </span>
                        </p>
                    </div>

                    {visibleStatus.map((status) => (
                        <ReportSection
                            key={status.currency}
                            title={t("report.daily_financial.status_title", {
                                currency: status.currency,
                                total: status.total,
                            })}
                        >
                            <FinancialStatusTable status={status} />
                        </ReportSection>
                    ))}

                    <ReportSection
                        title={t("report.daily_financial.section.current_accounts")}
                    >
                        <div className="custom-scrollbar-x w-full overflow-x-auto">
                            <CurrentAccountsTable
                                rows={visibleAccounts}
                                expanded={expanded}
                                onToggle={toggleExpanded}
                                includeInternalTransfers={includeInternalTransfers}
                            />
                        </div>
                    </ReportSection>

                    {visibleFlow.length > 0 && (
                        <ReportSection
                            title={t("report.daily_financial.section.currency_flow")}
                        >
                            <CurrencyFlowTable rows={visibleFlow} />
                        </ReportSection>
                    )}
                </ReportLayout>
            ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center pb-3">
                    <p className="text-wb-13 font-medium text-black">
                        {t("report.daily_financial.empty_message")}
                    </p>
                </div>
            )}
        </PageLayout>
    );
}

function FilterCheckbox({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
                checked={checked}
                onCheckedChange={(v) => onChange(v === true)}
                className="size-[18px]"
            />
            <span className="text-wb-14-tight font-medium text-wb-ntrl-8">
                {label}
            </span>
        </label>
    );
}

function FinancialStatusTable({ status }: { status: FinancialStatus }) {
    const { t } = useTranslation();
    return (
        <table className="w-full min-w-[560px] table-fixed border-collapse">
            <colgroup>
                <col />
                <col />
            </colgroup>
            <TableHeader>
                <TableRow className="h-[var(--h-wb-table-head)] border-y border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.current_accounts")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.saving_accounts")}
                    </TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow className="h-[var(--h-wb-table-row)]">
                    <SumCell>{status.currentAccounts}</SumCell>
                    <SumCell>{status.savingAccounts}</SumCell>
                </TableRow>
            </TableBody>
        </table>
    );
}

/**
 * Current Accounts ledger with per-row transaction drill-down. The
 * expand chevron lives in the leading cell; clicking it inserts a
 * sub-grid `<tr>` directly below the row.
 */
function CurrentAccountsTable({
    rows,
    expanded,
    onToggle,
    includeInternalTransfers,
}: {
    rows: CurrentAccountRow[];
    expanded: Record<string, boolean>;
    onToggle: (id: string) => void;
    includeInternalTransfers: boolean;
}) {
    const { t } = useTranslation();
    /* Sum of <col> widths == 1980px (matches min-w). Leading expander
       column is 36px; the rest mirror the legacy Daily Financial column
       set. */
    const colCount = 13;
    return (
        <table className="w-full min-w-[1980px] table-fixed border-collapse">
            <colgroup>
                <col className="w-[36px]" />
                <col className="w-[110px]" />
                <col className="w-[150px]" />
                <col className="w-[180px]" />
                <col className="w-[100px]" />
                <col className="w-[140px]" />
                <col className="w-[130px]" />
                <col className="w-[200px]" />
                <col className="w-[150px]" />
                <col className="w-[140px]" />
                <col className="w-[130px]" />
                <col className="w-[200px]" />
                <col className="w-[150px]" />
                <col className="w-[160px]" />
            </colgroup>
            <TableHeader>
                <TableRow className="h-[var(--h-wb-table-head)] border-y border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell sortable={false}>
                        <span className="sr-only">{t("common.expand")}</span>
                    </TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_financial.col.bank")}</TableHeaderCell>
                    <TableHeaderCell>{t("report.daily_financial.col.account_no")}</TableHeaderCell>
                    <TableHeaderCell>
                        {t("report.daily_financial.col.account_nickname")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("report.daily_financial.col.currency")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.num_debits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.debit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.num_internal_debits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.internal_debit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.num_credits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.credit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.num_internal_credits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.internal_credit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right">
                        {t("report.daily_financial.col.balance")}
                    </TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => {
                    const isOpen = !!expanded[row.id];
                    const hasTx = row.transactions.length > 0;
                    const txRows = includeInternalTransfers
                        ? row.transactions
                        : row.transactions.filter(
                              (tx) => tx.rcvPayUsageCd !== "09",
                          );
                    return (
                        <ExpandableAccountRow
                            key={row.id}
                            row={row}
                            isOpen={isOpen}
                            hasTx={hasTx}
                            txRows={txRows}
                            colCount={colCount}
                            onToggle={onToggle}
                        />
                    );
                })}
                {rows.length === 0 && (
                    <TableRow className="h-[var(--h-wb-table-row)] border-b border-wb-table-border">
                        <TableCell
                            colSpan={colCount + 1}
                            className="px-2.5 text-center text-wb-13 text-wb-muted"
                        >
                            {t("common.no_rows")}
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </table>
    );
}

function ExpandableAccountRow({
    row,
    isOpen,
    hasTx,
    txRows,
    colCount,
    onToggle,
}: {
    row: CurrentAccountRow;
    isOpen: boolean;
    hasTx: boolean;
    txRows: TransactionDetailRow[];
    colCount: number;
    onToggle: (id: string) => void;
}) {
    return (
        <>
            <TableRow
                className={cn(
                    "h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0",
                    hasTx && "cursor-pointer hover:bg-black/[0.02]",
                )}
                onClick={hasTx ? () => onToggle(row.id) : undefined}
            >
                <TableCell className="px-1 align-middle text-center">
                    {hasTx ? (
                        isOpen ? (
                            <ChevronDown
                                className="mx-auto size-4 text-wb-ntrl-8"
                                strokeWidth={2}
                            />
                        ) : (
                            <ChevronRight
                                className="mx-auto size-4 text-wb-ntrl-8"
                                strokeWidth={2}
                            />
                        )
                    ) : null}
                </TableCell>
                <CellLeft>{row.bank}</CellLeft>
                <CellLeft>{row.accountNo}</CellLeft>
                <CellLeft>{row.accountNickname}</CellLeft>
                <CellLeft>{row.currency}</CellLeft>
                <CellRight>{row.numDebits}</CellRight>
                <CellRight>{row.debit}</CellRight>
                <CellRight>{row.numInternalDebits}</CellRight>
                <CellRight>{row.internalDebit}</CellRight>
                <CellRight>{row.numCredits}</CellRight>
                <CellRight>{row.credit}</CellRight>
                <CellRight>{row.numInternalCredits}</CellRight>
                <CellRight>{row.internalCredit}</CellRight>
                <CellRight strong>{row.balance}</CellRight>
            </TableRow>
            {isOpen && (
                <TableRow className="border-b border-wb-table-border bg-wb-bg-sidebar/40 hover:bg-wb-bg-sidebar/40">
                    <TableCell colSpan={colCount + 1} className="p-0">
                        <TransactionsSubGrid rows={txRows} />
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

function TransactionsSubGrid({ rows }: { rows: TransactionDetailRow[] }) {
    const { t } = useTranslation();
    if (rows.length === 0) {
        return (
            <div className="px-6 py-3 text-wb-13 text-wb-muted">
                {t("report.daily_financial.tx.no_rows")}
            </div>
        );
    }
    return (
        <div className="px-6 py-3">
            <table className="w-full table-fixed border-collapse">
                <colgroup>
                    <col className="w-[80px]" />
                    <col className="w-[100px]" />
                    <col className="w-[160px]" />
                    <col className="w-[160px]" />
                    <col className="w-[80px]" />
                    <col />
                    <col className="w-[160px]" />
                </colgroup>
                <TableHeader>
                    <TableRow className="h-9 border-b border-wb-table-border bg-white hover:bg-white">
                        <TableHeaderCell sortable={false}>
                            {t("report.daily_financial.tx.seq")}
                        </TableHeaderCell>
                        <TableHeaderCell sortable={false}>
                            {t("report.daily_financial.tx.time")}
                        </TableHeaderCell>
                        <TableHeaderCell align="right" sortable={false}>
                            {t("report.daily_financial.tx.amount")}
                        </TableHeaderCell>
                        <TableHeaderCell align="right" sortable={false}>
                            {t("report.daily_financial.tx.balance_after")}
                        </TableHeaderCell>
                        <TableHeaderCell sortable={false}>
                            {t("report.daily_financial.tx.inout")}
                        </TableHeaderCell>
                        <TableHeaderCell sortable={false}>
                            {t("report.daily_financial.tx.remark")}
                        </TableHeaderCell>
                        <TableHeaderCell sortable={false}>
                            {t("report.daily_financial.tx.usage")}
                        </TableHeaderCell>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((tx, i) => (
                        <TableRow
                            key={`${tx.accountSeqNo}-${i}`}
                            className="h-10 border-b border-wb-table-border last:border-b-0"
                        >
                            <CellLeft>{tx.accountSeqNo}</CellLeft>
                            <CellLeft>{tx.transactionTime}</CellLeft>
                            <CellRight>{tx.amount}</CellRight>
                            <CellRight>{tx.balanceAfter}</CellRight>
                            <CellLeft>{tx.inOutDiv}</CellLeft>
                            <CellLeft>{tx.remark}</CellLeft>
                            <CellLeft>{tx.rcvPayUsageNm}</CellLeft>
                        </TableRow>
                    ))}
                </TableBody>
            </table>
        </div>
    );
}

function CurrencyFlowTable({ rows }: { rows: CurrencyFlowRow[] }) {
    const { t } = useTranslation();
    return (
        <div className="custom-scrollbar-x w-full overflow-x-auto">
            <table className="w-full min-w-[960px] table-fixed border-collapse">
                <colgroup>
                    <col className="w-[120px]" />
                    <col className="w-[180px]" />
                    <col className="w-[180px]" />
                    <col className="w-[120px]" />
                    <col className="w-[180px]" />
                    <col className="w-[120px]" />
                    <col className="w-[180px]" />
                </colgroup>
                <TableHeader>
                    <TableRow className="h-[var(--h-wb-table-head)] border-y border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                        <TableHeaderCell sortable={false}>
                            {t("report.daily_financial.flow.currency")}
                        </TableHeaderCell>
                        <TableHeaderCell align="right" sortable={false}>
                            {t("report.daily_financial.flow.before_balance")}
                        </TableHeaderCell>
                        <TableHeaderCell align="right" sortable={false}>
                            {t("report.daily_financial.flow.balance")}
                        </TableHeaderCell>
                        <TableHeaderCell align="right" sortable={false}>
                            {t("report.daily_financial.flow.send_count")}
                        </TableHeaderCell>
                        <TableHeaderCell align="right" sortable={false}>
                            {t("report.daily_financial.flow.send_amount")}
                        </TableHeaderCell>
                        <TableHeaderCell align="right" sortable={false}>
                            {t("report.daily_financial.flow.receive_count")}
                        </TableHeaderCell>
                        <TableHeaderCell align="right" sortable={false}>
                            {t("report.daily_financial.flow.receive_amount")}
                        </TableHeaderCell>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow
                            key={row.currency}
                            className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                        >
                            <CellLeft>{row.currency}</CellLeft>
                            <CellRight>{row.beforeDateBalance}</CellRight>
                            <CellRight strong>{row.balance}</CellRight>
                            <CellRight>{row.sendCount}</CellRight>
                            <CellRight>{row.sendAmount}</CellRight>
                            <CellRight>{row.receiveCount}</CellRight>
                            <CellRight>{row.receiveAmount}</CellRight>
                        </TableRow>
                    ))}
                </TableBody>
            </table>
        </div>
    );
}

function CellLeft({ children }: { children: React.ReactNode }) {
    return (
        <TableCell className="px-2.5 py-2.5 align-middle">
            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                {children}
            </span>
        </TableCell>
    );
}

function CellRight({
    children,
    strong = false,
}: {
    children: React.ReactNode;
    strong?: boolean;
}) {
    return (
        <TableCell className="px-2.5 py-2.5 text-right align-middle">
            <span
                className={cn(
                    "block truncate text-wb-13",
                    strong
                        ? "font-semibold text-wb-ink"
                        : "font-medium text-wb-ink",
                )}
            >
                {children}
            </span>
        </TableCell>
    );
}

function SumCell({ children }: { children: React.ReactNode }) {
    return (
        <TableCell className="px-2.5 py-2.5 text-right align-middle">
            <span className="text-wb-14 font-semibold text-wb-ink">{children}</span>
        </TableCell>
    );
}
