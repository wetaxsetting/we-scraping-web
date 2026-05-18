"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import ReportSection from "@/components/banking/reports/ReportSection";
import CurrencyScopeToggle, {
    type CurrencyScope,
} from "@/components/shared/CurrencyScopeToggle";
import DateField from "@/components/shared/DateField";
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
import {
    printReport,
    escapeHtml,
    type PrintSection,
} from "@/lib/print";
import { reportDateSuffix } from "@/lib/reportExcel";
// `xlsx-js-style` is a fork of `xlsx` that honours cell `.s` styling
// (bold, alignment, fills, borders) on writes. The base `xlsx` package
// silently drops `.s` on the community build, so any styled Excel
// producer in this project routes through `xlsx-js-style` instead.
import * as xlsx from "xlsx-js-style";
import { formatAmount } from "@/lib/currency";
import { cn } from "@/lib/utils";

import {
    mockCurrentAccounts,
    mockFinancialStatus,
} from "./mockData";
import TransactionHistoryDialog from "./TransactionHistoryDialog";
import type {
    CurrentAccountRow,
    FinancialStatus,
} from "./types";

/**
 * Account-type partition for the Daily Financial ledger sections.
 * Mirrors the legacy `wabooks.enums.AcctTypeCd` value set (codes 01-08)
 * and the backend's `CURRENT_ACCOUNT_TYPE_CODES` / `SAVING_ACCOUNT_TYPE_CODES`
 * constants in `ReportService.java`. Code 01 (LOAN) and 02 (Fixed /
 * Time Deposit) are intentionally NOT in either set — the legacy panel
 * doesn't surface them in either ledger section.
 */
const CURRENT_ACCOUNT_TYPES = new Set(["03", "04", "07"]);
const SAVING_ACCOUNT_TYPES = new Set(["05", "06", "08"]);

/** Per-currency totals shape — keyed by CCY in legacy `Map` order so the
 *  Total(VND) / Total(USD) footer rows print in the same order the data
 *  rows appear. */
type LedgerTotals = Map<string, {
    numDebits: number; debit: number;
    numInternalDebits: number; internalDebit: number;
    numCredits: number; credit: number;
    numInternalCredits: number; internalCredit: number;
    balance: number;
}>;

/** Sum every visible account's counters and amounts per currency. Shared
 *  between the on-screen `<CurrentAccountsTable>`, the print pipeline,
 *  and the Excel export pipeline so the three surfaces stay in lockstep. */
function computeTotalsByCurrency(rows: ReadonlyArray<CurrentAccountRow>): LedgerTotals {
    const map: LedgerTotals = new Map();
    for (const r of rows) {
        const acc = map.get(r.currency) ?? {
            numDebits: 0, debit: 0,
            numInternalDebits: 0, internalDebit: 0,
            numCredits: 0, credit: 0,
            numInternalCredits: 0, internalCredit: 0,
            balance: 0,
        };
        acc.numDebits += Number(r.numDebits) || 0;
        acc.debit += parseFloat(r.debit) || 0;
        acc.numInternalDebits += Number(r.numInternalDebits) || 0;
        acc.internalDebit += parseFloat(r.internalDebit) || 0;
        acc.numCredits += Number(r.numCredits) || 0;
        acc.credit += parseFloat(r.credit) || 0;
        acc.numInternalCredits += Number(r.numInternalCredits) || 0;
        acc.internalCredit += parseFloat(r.internalCredit) || 0;
        acc.balance += parseFloat(r.balance) || 0;
        map.set(r.currency, acc);
    }
    return map;
}

/**
 * Daily Financial report — `docs/refactor-wecms/features/daily-financial-report.md`.
 *
 * Same CMC empty-state Search flow as the predecessor Daily Cash page
 * (CLAUDE.md §7b), evolved to add:
 *   - "Active accounts only" + "Include internal transfers" filters
 *
 * Falls back to {@link mockCurrentAccounts} when the live API has not
 * populated the section yet — keeps the page usable while the Sprint-2
 * transactions port lands.
 *
 * Note: the legacy WSVC contract carries a `CURRENCY_FLOW` (REC3) rollup
 * but the live JEX panel doesn't render it; the refactor frontend
 * deliberately omits the section to match the production UI.
 */
type DailyFinancialPageProps = {
    financialStatus?: FinancialStatus[];
    currentAccounts?: CurrentAccountRow[];
    /** Controlled filter wiring. When omitted, the page falls back to
     *  local state and renders rows from props verbatim (legacy mode). */
    asOfDate?: string;
    /** ISO `YYYY-MM-DD` value backing the As-of date picker. */
    asOfIsoDate?: string;
    /** Fires when the user picks a date in the popup. */
    onAsOfIsoDateChange?: (iso: string) => void;
    scope?: CurrencyScope;
    onScopeChange?: (next: CurrencyScope) => void;
    activeOnly?: boolean;
    onActiveOnlyChange?: (next: boolean) => void;
    includeInternalTransfers?: boolean;
    onIncludeInternalTransfersChange?: (next: boolean) => void;
    showNickname?: boolean;
    onShowNicknameChange?: (next: boolean) => void;
    onSearch?: () => void;
    hasSearched?: boolean;
    loading?: boolean;
};

export default function DailyFinancialPage({
    financialStatus,
    currentAccounts,
    asOfDate: asOfDateProp,
    asOfIsoDate: asOfIsoDateProp,
    onAsOfIsoDateChange,
    scope: scopeProp,
    onScopeChange,
    activeOnly: activeOnlyProp,
    onActiveOnlyChange,
    includeInternalTransfers: includeInternalProp,
    onIncludeInternalTransfersChange,
    showNickname: showNicknameProp,
    onShowNicknameChange,
    onSearch,
    hasSearched: hasSearchedProp,
    loading = false,
}: DailyFinancialPageProps = {}) {
    const { t } = useTranslation();
    const [localScope, setLocalScope] = useState<CurrencyScope>("all");
    const [localActiveOnly, setLocalActiveOnly] = useState(true);
    const [localIncludeInternal, setLocalIncludeInternal] = useState(true);
    const [localShowNickname, setLocalShowNickname] = useState(true);
    const [localSearched, setLocalSearched] = useState(false);
    const [localAsOfIso, setLocalAsOfIso] = useState(() =>
        new Date().toISOString().slice(0, 10),
    );

    /* Transaction History Details popup state — `null` = closed, otherwise
       carries the row the user clicked (Bank / Account No. / Account
       Nickname cell in either the Current Accounts or Saving Accounts
       table). The popup fetches its own data via
       `fetchDailyFinancialTransactions(...)` keyed on bankCd + acctNo. */
    const [txDialogAccount, setTxDialogAccount] = useState<CurrentAccountRow | null>(null);

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

    const showNickname = showNicknameProp ?? localShowNickname;
    const setShowNickname = (next: boolean) =>
        onShowNicknameChange ? onShowNicknameChange(next) : setLocalShowNickname(next);

    const hasSearched = hasSearchedProp ?? localSearched;
    const handleSearch = () =>
        onSearch ? onSearch() : setLocalSearched(true);

    const asOfIsoDate = asOfIsoDateProp ?? localAsOfIso;
    const setAsOfIsoDate = (next: string) =>
        onAsOfIsoDateChange ? onAsOfIsoDateChange(next) : setLocalAsOfIso(next);
    const asOfDate = asOfDateProp ?? formatIsoToDmy(asOfIsoDate);

    const sourceStatus = financialStatus ?? mockFinancialStatus;
    const sourceAccounts =
        currentAccounts && currentAccounts.length > 0
            ? currentAccounts
            : mockCurrentAccounts;

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

    /* Account-type partition — mirrors legacy AcctTypeCd enum + the
       backend's `CURRENT_ACCOUNT_TYPE_CODES` / `SAVING_ACCOUNT_TYPE_CODES`
       constants in `ReportService.java`. The legacy panel renders two
       tables ("Current Accounts" + "Saving Accounts"); the backend ships
       both row types together and the frontend partitions here. */
    const visibleCurrent = useMemo(
        () => visibleAccounts.filter((r) => CURRENT_ACCOUNT_TYPES.has(r.accountTypeCd)),
        [visibleAccounts],
    );
    const visibleSavings = useMemo(
        () => visibleAccounts.filter((r) => SAVING_ACCOUNT_TYPES.has(r.accountTypeCd)),
        [visibleAccounts],
    );

    /* Ledger column set for print / Excel — mirrors the on-screen table
       built by `<CurrentAccountsTable>`. Defined once and consumed by both
       the Current Accounts and Saving Accounts sections to keep the three
       surfaces (screen / print / Excel) in lockstep. The Account Nickname
       column toggles with the on-screen `Show account nickname` filter so
       all three surfaces honour the same user preference. */
    const printLedgerColumns = (
        [
            { header: t("report.daily_financial.col.bank"), align: "left", render: (r: CurrentAccountRow) => escapeHtml(r.bank) },
            { header: t("report.daily_financial.col.account_no"), align: "left", render: (r: CurrentAccountRow) => escapeHtml(r.accountNo) },
            ...(showNickname ? [{ header: t("report.daily_financial.col.account_nickname"), align: "left" as const, render: (r: CurrentAccountRow) => escapeHtml(r.accountNickname) }] : []),
            { header: t("report.daily_financial.col.currency"), align: "left", render: (r: CurrentAccountRow) => escapeHtml(r.currency) },
            { header: t("report.daily_financial.col.num_debits"), align: "right", render: (r: CurrentAccountRow) => escapeHtml(String(r.numDebits)) },
            { header: t("report.daily_financial.col.debit"), align: "right", render: (r: CurrentAccountRow) => escapeHtml(formatAmount(r.debit, r.currency, true)) },
            { header: t("report.daily_financial.col.num_internal_debits"), align: "right", render: (r: CurrentAccountRow) => escapeHtml(String(includeInternalTransfers ? r.numInternalDebits : 0)) },
            { header: t("report.daily_financial.col.internal_debit"), align: "right", render: (r: CurrentAccountRow) => escapeHtml(formatAmount(includeInternalTransfers ? r.internalDebit : "0", r.currency, true)) },
            { header: t("report.daily_financial.col.num_credits"), align: "right", render: (r: CurrentAccountRow) => escapeHtml(String(r.numCredits)) },
            { header: t("report.daily_financial.col.credit"), align: "right", render: (r: CurrentAccountRow) => escapeHtml(formatAmount(r.credit, r.currency, true)) },
            { header: t("report.daily_financial.col.num_internal_credits"), align: "right", render: (r: CurrentAccountRow) => escapeHtml(String(includeInternalTransfers ? r.numInternalCredits : 0)) },
            { header: t("report.daily_financial.col.internal_credit"), align: "right", render: (r: CurrentAccountRow) => escapeHtml(formatAmount(includeInternalTransfers ? r.internalCredit : "0", r.currency, true)) },
            { header: t("report.daily_financial.col.balance"), align: "right", render: (r: CurrentAccountRow) => escapeHtml(formatAmount(r.balance, r.currency, true)) },
        ] as ReadonlyArray<{ header: string; align?: "left" | "right"; render: (r: CurrentAccountRow) => string }>
    );

    /** Number of leading non-numeric columns (Bank, Account No,
     *  [Nickname], Currency) — used to position the "Total(CCY)" label
     *  in the footer rows. */
    const leadingColCount = showNickname ? 4 : 3;

    /** Build per-currency Total footer rows for a section. The label
     *  spans the leading non-numeric columns; the numeric totals align
     *  under their data columns. */
    const buildLedgerFooters = (rows: ReadonlyArray<CurrentAccountRow>) => {
        const totals = Array.from(computeTotalsByCurrency(rows).entries());
        return totals.map(([ccy, s]) => {
            const cells: { html: string; align?: "left" | "right" }[] = [];
            // Leading "Total(CCY)" label cell + filler cells for the
            // remaining leading columns so column widths align with the
            // table body.
            cells.push({
                html: escapeHtml(t("report.daily_financial.total_currency", { currency: ccy })),
                align: "left",
            });
            for (let i = 1; i < leadingColCount; i++) cells.push({ html: "", align: "left" });
            // Numeric totals
            cells.push({ html: escapeHtml(String(s.numDebits)), align: "right" });
            cells.push({ html: escapeHtml(formatAmount(s.debit, ccy, true)), align: "right" });
            cells.push({ html: escapeHtml(String(includeInternalTransfers ? s.numInternalDebits : 0)), align: "right" });
            cells.push({ html: escapeHtml(formatAmount(includeInternalTransfers ? s.internalDebit : 0, ccy, true)), align: "right" });
            cells.push({ html: escapeHtml(String(s.numCredits)), align: "right" });
            cells.push({ html: escapeHtml(formatAmount(s.credit, ccy, true)), align: "right" });
            cells.push({ html: escapeHtml(String(includeInternalTransfers ? s.numInternalCredits : 0)), align: "right" });
            cells.push({ html: escapeHtml(formatAmount(includeInternalTransfers ? s.internalCredit : 0, ccy, true)), align: "right" });
            cells.push({ html: escapeHtml(formatAmount(s.balance, ccy, true)), align: "right" });
            return cells;
        });
    };

    const handlePrint = () => {
        const title = t("report.daily_financial.title");
        const asOfDmy = formatIsoToDmy(asOfIsoDate);
        const scopeLabel = t(`report.daily_financial.scope.${scope}`);
        const summary = `${t("report.as_of")} : ${asOfDmy}  ${t("report.currency_label")} ${scopeLabel}`;

        const sections: PrintSection<unknown>[] = [];

        /* Financial Status — one mini-table per currency. Title carries
           the per-currency total ("Financial Status   Total VND :
           39.120.863.733₫"); body is the Current / Saving split. */
        for (const status of visibleStatus) {
            const titleText = `${t("report.daily_financial.section.financial_status")}   ${t("report.daily_financial.status_total", { currency: status.currency })} ${formatAmount(status.total, status.currency, true)}`;
            sections.push({
                title: titleText,
                columns: [
                    { header: t("report.daily_financial.col.current_accounts"), align: "right", render: (r) => escapeHtml(formatAmount((r as FinancialStatus).currentAccounts, (r as FinancialStatus).currency, true)) },
                    { header: t("report.daily_financial.col.saving_accounts"), align: "right", render: (r) => escapeHtml(formatAmount((r as FinancialStatus).savingAccounts, (r as FinancialStatus).currency, true)) },
                ],
                rows: [status as unknown],
            });
        }

        /* Current Accounts ledger. */
        sections.push({
            title: t("report.daily_financial.section.current_accounts"),
            columns: printLedgerColumns as unknown as PrintSection<unknown>["columns"],
            rows: visibleCurrent as unknown as ReadonlyArray<unknown>,
            footers: buildLedgerFooters(visibleCurrent),
        });

        /* Saving Accounts ledger. */
        sections.push({
            title: t("report.daily_financial.section.saving_accounts"),
            columns: printLedgerColumns as unknown as PrintSection<unknown>["columns"],
            rows: visibleSavings as unknown as ReadonlyArray<unknown>,
            footers: buildLedgerFooters(visibleSavings),
        });

        printReport({
            title,
            summary,
            sections,
        });
    };

    const handleExportExcel = () => {
        const title = t("report.daily_financial.title");
        const asOfDmy = formatIsoToDmy(asOfIsoDate);
        const scopeLabel = t(`report.daily_financial.scope.${scope}`);

        /* ----------------------------------------------------------------
           Custom AoA / merge construction. The Daily Financial export
           mirrors the legacy `rept_0015_001` Excel layout exactly:
             1. Title row 1 — "Daily Financial" centered, merged across
                every ledger column.
             2. Sub-header row — "As of : DD-MM-YYYY  Currency : <scope>"
             3. Per-currency Financial Status mini-tables — column A
                empty (indent), "Current Accounts" header merged B:C,
                "Saving Accounts" header merged D:E, value row same
                merges.
             4. "Current Accounts" section title row.
             5. Header row + body rows + Total(CCY) rows.
             6. "Saving Accounts" section title row.
             7. Header row + body rows + Total(CCY) rows.
           The standard `exportReportExcel` helper enforces a single
           "title + header + body + footer" shape per section, which
           can't express the indented mini-table merges, so this handler
           builds the workbook directly. */

        // Ledger columns (re-used for the two account-type ledgers).
        type LedgerCol = {
            header: string;
            value: (r: CurrentAccountRow) => string | number | null;
            widthChars: number;
            align?: "left" | "right";
        };
        const ledgerColumns: LedgerCol[] = [
            { header: t("report.daily_financial.col.bank"), value: (r) => r.bank, widthChars: 14 },
            { header: t("report.daily_financial.col.account_no"), value: (r) => r.accountNo, widthChars: 20 },
            ...(showNickname ? [{ header: t("report.daily_financial.col.account_nickname"), value: (r: CurrentAccountRow) => r.accountNickname, widthChars: 22 } as LedgerCol] : []),
            { header: t("report.daily_financial.col.currency"), value: (r) => r.currency, widthChars: 10 },
            { header: t("report.daily_financial.col.num_debits"), value: (r) => r.numDebits, widthChars: 12, align: "right" },
            { header: t("report.daily_financial.col.debit"), value: (r) => formatAmount(r.debit, r.currency, true), widthChars: 18, align: "right" },
            { header: t("report.daily_financial.col.num_internal_debits"), value: (r) => includeInternalTransfers ? r.numInternalDebits : 0, widthChars: 14, align: "right" },
            { header: t("report.daily_financial.col.internal_debit"), value: (r) => formatAmount(includeInternalTransfers ? r.internalDebit : "0", r.currency, true), widthChars: 18, align: "right" },
            { header: t("report.daily_financial.col.num_credits"), value: (r) => r.numCredits, widthChars: 12, align: "right" },
            { header: t("report.daily_financial.col.credit"), value: (r) => formatAmount(r.credit, r.currency, true), widthChars: 18, align: "right" },
            { header: t("report.daily_financial.col.num_internal_credits"), value: (r) => includeInternalTransfers ? r.numInternalCredits : 0, widthChars: 14, align: "right" },
            { header: t("report.daily_financial.col.internal_credit"), value: (r) => formatAmount(includeInternalTransfers ? r.internalCredit : "0", r.currency, true), widthChars: 18, align: "right" },
            { header: t("report.daily_financial.col.balance"), value: (r) => formatAmount(r.balance, r.currency, true), widthChars: 18, align: "right" },
        ];
        const totalCols = ledgerColumns.length;

        /* Style helpers — shared border / fill primitives so the
           Financial Status mini-tables and the ledger tables read with
           the same chrome the legacy `rept_0015_001` Excel emits. */
        const THIN_BORDER = { style: "thin" as const, color: { rgb: "B7B7B7" } };
        const BORDER_BOX = {
            top: THIN_BORDER,
            bottom: THIN_BORDER,
            left: THIN_BORDER,
            right: THIN_BORDER,
        };
        const HEADER_FILL = { patternType: "solid", fgColor: { rgb: "F2F2F2" } };

        type BorderSide = { style: "thin"; color: { rgb: string } };
        type CellStyle = {
            font?: { bold?: boolean; sz?: number; color?: { rgb: string } };
            alignment?: { horizontal?: "left" | "center" | "right"; vertical?: "top" | "center" | "bottom"; wrapText?: boolean };
            fill?: typeof HEADER_FILL;
            border?: { top?: BorderSide; bottom?: BorderSide; left?: BorderSide; right?: BorderSide };
        };

        // AoA accumulator + merges + per-cell style map.
        const aoa: (string | number | null)[][] = [];
        const merges: xlsx.Range[] = [];
        const styleByAddr = new Map<string, CellStyle>();

        const setStyle = (r: number, c: number, style: CellStyle) => {
            styleByAddr.set(xlsx.utils.encode_cell({ r, c }), style);
        };

        const pushRow = (cells: (string | number | null)[]) => {
            const row = [...cells];
            while (row.length < totalCols) row.push(null);
            aoa.push(row);
            return aoa.length - 1; // 0-based row index
        };

        // 1. Title row (merged across every column).
        const titleRowIdx = pushRow([title]);
        setStyle(titleRowIdx, 0, {
            font: { bold: true, sz: 16 },
            alignment: { horizontal: "center", vertical: "center" },
        });
        if (totalCols > 1) {
            merges.push({ s: { r: titleRowIdx, c: 0 }, e: { r: titleRowIdx, c: totalCols - 1 } });
        }
        // Blank row for visual breathing room (matches screenshot).
        pushRow([]);

        // 2. Sub-header — "As of : DD-MM-YYYY  Currency : <scope>".
        const subHeaderRowIdx = pushRow([`${t("report.as_of")} : ${asOfDmy}  ${t("report.currency_label")} ${scopeLabel}`]);
        setStyle(subHeaderRowIdx, 0, {
            font: { bold: true },
            alignment: { vertical: "center" },
        });
        pushRow([]);

        /* 3. Per-currency Financial Status mini-tables — narrow fixed
              layout (4 columns wide). Mirrors the target old-project
              Excel: "Current Accounts" header merged across A:B,
              "Saving Accounts" header merged across C:D, remaining
              columns left empty. Value row uses the same merges so each
              figure occupies its own 2-column cell. */
        const STATUS_CURRENT_LEFT = 0;
        const STATUS_CURRENT_RIGHT = 1;
        const STATUS_SAVING_LEFT = 2;
        const STATUS_SAVING_RIGHT = 3;
        for (const status of visibleStatus) {
            const totalLabel = `${t("report.daily_financial.section.financial_status")}   ${t("report.daily_financial.status_total", { currency: status.currency })} ${formatAmount(status.total, status.currency, true)}`;
            const statusRowIdx = pushRow([totalLabel]);
            setStyle(statusRowIdx, 0, {
                font: { bold: true },
                alignment: { vertical: "center" },
            });

            // Header row — "Current Accounts" merged A:B, "Saving
            // Accounts" merged C:D. Cells E onwards stay empty.
            const headerCells: (string | number | null)[] = Array(totalCols).fill(null);
            headerCells[STATUS_CURRENT_LEFT] = t("report.daily_financial.col.current_accounts");
            headerCells[STATUS_CURRENT_RIGHT] = "";
            headerCells[STATUS_SAVING_LEFT] = t("report.daily_financial.col.saving_accounts");
            headerCells[STATUS_SAVING_RIGHT] = "";
            const headerRowIdx = pushRow(headerCells);
            merges.push({ s: { r: headerRowIdx, c: STATUS_CURRENT_LEFT }, e: { r: headerRowIdx, c: STATUS_CURRENT_RIGHT } });
            merges.push({ s: { r: headerRowIdx, c: STATUS_SAVING_LEFT }, e: { r: headerRowIdx, c: STATUS_SAVING_RIGHT } });
            for (const c of [STATUS_CURRENT_LEFT, STATUS_CURRENT_RIGHT, STATUS_SAVING_LEFT, STATUS_SAVING_RIGHT]) {
                setStyle(headerRowIdx, c, {
                    font: { bold: true },
                    alignment: { horizontal: "center", vertical: "center" },
                    fill: HEADER_FILL,
                    border: BORDER_BOX,
                });
            }

            // Value row — same merges, right-aligned amounts anchored
            // to the far edge of each 2-column cell.
            const valueCells: (string | number | null)[] = Array(totalCols).fill(null);
            valueCells[STATUS_CURRENT_LEFT] = formatAmount(status.currentAccounts, status.currency, true);
            valueCells[STATUS_CURRENT_RIGHT] = "";
            valueCells[STATUS_SAVING_LEFT] = formatAmount(status.savingAccounts, status.currency, true);
            valueCells[STATUS_SAVING_RIGHT] = "";
            const valueRowIdx = pushRow(valueCells);
            merges.push({ s: { r: valueRowIdx, c: STATUS_CURRENT_LEFT }, e: { r: valueRowIdx, c: STATUS_CURRENT_RIGHT } });
            merges.push({ s: { r: valueRowIdx, c: STATUS_SAVING_LEFT }, e: { r: valueRowIdx, c: STATUS_SAVING_RIGHT } });
            for (const c of [STATUS_CURRENT_LEFT, STATUS_CURRENT_RIGHT, STATUS_SAVING_LEFT, STATUS_SAVING_RIGHT]) {
                setStyle(valueRowIdx, c, {
                    alignment: { horizontal: "right", vertical: "center" },
                    border: BORDER_BOX,
                });
            }

            pushRow([]);
        }

        // Helper: emit one ledger section (Current Accounts / Saving Accounts).
        const emitLedger = (
            sectionTitle: string,
            rows: ReadonlyArray<CurrentAccountRow>,
        ) => {
            // Section title bar (col A only, bold, no merge — matches screenshot).
            const sectionTitleRowIdx = pushRow([sectionTitle]);
            setStyle(sectionTitleRowIdx, 0, {
                font: { bold: true },
                alignment: { vertical: "center" },
            });

            // Header row — bold, light-grey fill, full borders, centred.
            const headerRowIdx = pushRow(ledgerColumns.map((c) => c.header));
            for (let c = 0; c < ledgerColumns.length; c++) {
                setStyle(headerRowIdx, c, {
                    font: { bold: true },
                    alignment: { horizontal: "center", vertical: "center", wrapText: true },
                    fill: HEADER_FILL,
                    border: BORDER_BOX,
                });
            }

            // Body rows — borders, per-column alignment.
            for (const r of rows) {
                const rowIdx = pushRow(ledgerColumns.map((col) => col.value(r)));
                for (let c = 0; c < ledgerColumns.length; c++) {
                    setStyle(rowIdx, c, {
                        alignment: {
                            horizontal: ledgerColumns[c].align === "right" ? "right" : "left",
                            vertical: "center",
                        },
                        border: BORDER_BOX,
                    });
                }
            }

            /* Per-currency Total(CCY) footer rows — bold + light-grey
               fill across the whole row. The row reads as a single
               continuous band: a top + bottom border closes it off from
               the body and the trailing blank row, but vertical borders
               are dropped between cells so the fill is uninterrupted
               (matches the legacy `rept_0015_001` Excel chrome). */
            const totals = Array.from(computeTotalsByCurrency(rows).entries());
            const TOTAL_ROW_BORDER = { top: THIN_BORDER, bottom: THIN_BORDER };
            for (const [ccy, s] of totals) {
                const totalLabel = t("report.daily_financial.total_currency", { currency: ccy });
                /* Footer row: label spans the leading columns, numeric
                   totals align with their data columns. Filler cells in
                   the leading columns use `""` not `null` — `aoa_to_sheet`
                   skips `null` entries (no cell is created), which
                   silently drops the styling for that column and leaves
                   a visible gap in the grey total-row band. Empty strings
                   create a real cell that carries the fill + border. */
                const cells: (string | number | null)[] = [
                    totalLabel,
                    ...Array(leadingColCount - 1).fill(""),
                    s.numDebits,
                    formatAmount(s.debit, ccy, true),
                    includeInternalTransfers ? s.numInternalDebits : 0,
                    formatAmount(includeInternalTransfers ? s.internalDebit : 0, ccy, true),
                    s.numCredits,
                    formatAmount(s.credit, ccy, true),
                    includeInternalTransfers ? s.numInternalCredits : 0,
                    formatAmount(includeInternalTransfers ? s.internalCredit : 0, ccy, true),
                    formatAmount(s.balance, ccy, true),
                ];
                const footerRowIdx = pushRow(cells);
                for (let c = 0; c < ledgerColumns.length; c++) {
                    /* Balance column (rightmost) is the legacy "highlight"
                       cell — emphasised slightly via the same bold weight
                       but rendered against the same grey band as the rest
                       of the row. */
                    setStyle(footerRowIdx, c, {
                        font: { bold: true },
                        alignment: {
                            horizontal: c < leadingColCount ? "left" : "right",
                            vertical: "center",
                        },
                        fill: HEADER_FILL,
                        border: TOTAL_ROW_BORDER,
                    });
                }
            }

            pushRow([]);
        };

        emitLedger(t("report.daily_financial.section.current_accounts"), visibleCurrent);
        emitLedger(t("report.daily_financial.section.saving_accounts"), visibleSavings);

        const ws = xlsx.utils.aoa_to_sheet(aoa);

        // Column widths — sized for the ledger columns; the Financial
        // Status mini-table inherits these widths so its merged cells
        // line up cleanly under the ledger header above.
        const colWidths: xlsx.ColInfo[] = ledgerColumns.map((c) => ({ wch: c.widthChars }));
        ws["!cols"] = colWidths;
        ws["!merges"] = merges;

        // Apply the per-cell style map. `xlsx-js-style` honours `.s`
        // (font / alignment / fill / border) on writes; the community
        // `xlsx` package silently drops it.
        for (const [addr, style] of styleByAddr) {
            const cell = ws[addr];
            if (cell) cell.s = style;
        }

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Daily Financial");
        const fileName = `DailyFinancial_${reportDateSuffix()}.xlsx`;
        xlsx.writeFile(wb, fileName);
    };

    return (
        <PageLayout>
            <PageHeader title={t("report.daily_financial.title")} />

            <FilterRow
                right={
                    <div className="flex flex-wrap items-center gap-4">
                        <FilterCheckbox
                            checked={showNickname}
                            onChange={setShowNickname}
                            label={t("report.daily_financial.opt.nickname")}
                        />
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
                <DateField
                    value={asOfIsoDate}
                    onChange={setAsOfIsoDate}
                    formatValue={formatIsoToDmy}
                />

                <span className="text-wb-14-tight font-medium text-wb-ntrl-8">
                    {t("report.daily_financial.currency_filter_label")}
                </span>
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

            {hasSearched && (
                <div className="flex shrink-0 items-center justify-end gap-2">
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
                    <span className="h-4 w-px bg-wb-ntrl-4" aria-hidden />
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
                </div>
            )}

            {hasSearched ? (
                <ReportLayout sectioned>
                    {/* Title + As-of summary stay pinned to the top of the
                        report scroll viewport so they remain visible while
                        the ledger below scrolls. The wrapper is a single
                        sticky <div> with white background so scrolling
                        content below cannot bleed through. No negative
                        margin — `top-0` pins it flush to the scroll
                        viewport's top edge so the boundary with the filter
                        row above stays clean (no hairline artefact from a
                        partial overlap into the page-level gap). */}
                    <div className="sticky top-0 z-10 bg-white pb-3">
                        <h2 className="text-center text-[36px] font-semibold tracking-wb-tight text-black">
                            {t("report.daily_financial.title")}
                        </h2>

                        <div className="mt-6 flex items-center rounded-md bg-wb-bg-sidebar p-4">
                            <p className="text-wb-14-tight font-medium text-black">
                                <span>{t("report.as_of")} </span>
                                <span className="text-wb-13 text-wb-ntrl-8">
                                    {formatIsoToDmmmY(asOfIsoDate)}
                                </span>
                                <span> {t("report.currency_label")} </span>
                                <span className="text-wb-13 text-wb-ntrl-8">
                                    {t(`report.daily_financial.scope.${scope}`)}
                                </span>
                            </p>
                        </div>
                    </div>

                    {visibleStatus.map((status) => (
                        <ReportSection
                            key={status.currency}
                            title={t("report.daily_financial.status_title", {
                                currency: status.currency,
                                total: formatAmount(status.total, status.currency, true),
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
                                rows={visibleCurrent}
                                includeInternalTransfers={includeInternalTransfers}
                                showNickname={showNickname}
                                onAccountClick={setTxDialogAccount}
                            />
                        </div>
                    </ReportSection>

                    <ReportSection
                        title={t("report.daily_financial.section.saving_accounts")}
                    >
                        <div className="custom-scrollbar-x w-full overflow-x-auto">
                            <CurrentAccountsTable
                                rows={visibleSavings}
                                includeInternalTransfers={includeInternalTransfers}
                                showNickname={showNickname}
                                onAccountClick={setTxDialogAccount}
                            />
                        </div>
                    </ReportSection>

                </ReportLayout>
            ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center pb-3">
                    <p className="text-wb-13 font-normal text-wb-muted">
                        {t("report.daily_financial.empty_message")}
                    </p>
                </div>
            )}

            {txDialogAccount && (
                <TransactionHistoryDialog
                    account={txDialogAccount}
                    asOfIsoDate={asOfIsoDate}
                    includeInternalTransfers={includeInternalTransfers}
                    onClose={() => setTxDialogAccount(null)}
                />
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
                    <SumCell>{formatAmount(status.currentAccounts, status.currency, true)}</SumCell>
                    <SumCell>{formatAmount(status.savingAccounts, status.currency, true)}</SumCell>
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
    includeInternalTransfers,
    showNickname,
    onAccountClick,
}: {
    rows: CurrentAccountRow[];
    includeInternalTransfers: boolean;
    showNickname: boolean;
    /** Click handler for the Bank / Account No. / Account Nickname cells —
     *  opens the Transaction History Details popup for the clicked row. */
    onAccountClick: (row: CurrentAccountRow) => void;
}) {
    const { t } = useTranslation();
    /* Column set mirrors the legacy Daily Financial table. The previous
       refactor had a leading 36px expander column for the per-account
       transaction drill-down; removed to match the live old project
       which renders a flat ledger only. */
    const dataColCount = showNickname ? 13 : 12;
    const minWidth = showNickname ? 1944 : 1764;

    /* Per-currency totals row — sums every visible account's counters
       and amounts per currency. Mirrors the live "Total(VND)" /
       "Total(USD)" rows the old project pins to the bottom of the
       ledger. `internalCounters` is the optional toggle from
       "Include internal transfers" — when off, internal columns
       collapse to zero in the totals so the row matches the masked
       ledger. */
    const totalsByCurrency = useMemo(
        () => Array.from(computeTotalsByCurrency(rows).entries()),
        [rows],
    );

    return (
        <table className="w-full table-fixed border-collapse" style={{ minWidth }}>
            <colgroup>
                <col className="w-[110px]" />
                <col className="w-[150px]" />
                {showNickname && <col className="w-[180px]" />}
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
                    <TableHeaderCell sortable={false}>{t("report.daily_financial.col.bank")}</TableHeaderCell>
                    <TableHeaderCell sortable={false}>{t("report.daily_financial.col.account_no")}</TableHeaderCell>
                    {showNickname && (
                        <TableHeaderCell sortable={false}>
                            {t("report.daily_financial.col.account_nickname")}
                        </TableHeaderCell>
                    )}
                    <TableHeaderCell sortable={false}>
                        {t("report.daily_financial.col.currency")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.num_debits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.debit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.num_internal_debits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.internal_debit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.num_credits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.credit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.num_internal_credits")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.internal_credit")}
                    </TableHeaderCell>
                    <TableHeaderCell align="right" sortable={false}>
                        {t("report.daily_financial.col.balance")}
                    </TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow
                        key={row.id}
                        className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                    >
                        <CellLink onClick={() => onAccountClick(row)}>{row.bank}</CellLink>
                        <CellLink onClick={() => onAccountClick(row)}>{row.accountNo}</CellLink>
                        {showNickname && (
                            <CellLink onClick={() => onAccountClick(row)}>
                                {row.accountNickname}
                            </CellLink>
                        )}
                        <CellLeft>{row.currency}</CellLeft>
                        <CellRight>{row.numDebits}</CellRight>
                        <CellRight>{formatAmount(row.debit, row.currency, true)}</CellRight>
                        <CellRight>{includeInternalTransfers ? row.numInternalDebits : 0}</CellRight>
                        <CellRight>{formatAmount(includeInternalTransfers ? row.internalDebit : "0", row.currency, true)}</CellRight>
                        <CellRight>{row.numCredits}</CellRight>
                        <CellRight>{formatAmount(row.credit, row.currency, true)}</CellRight>
                        <CellRight>{includeInternalTransfers ? row.numInternalCredits : 0}</CellRight>
                        <CellRight>{formatAmount(includeInternalTransfers ? row.internalCredit : "0", row.currency, true)}</CellRight>
                        <CellRight strong>{formatAmount(row.balance, row.currency, true)}</CellRight>
                    </TableRow>
                ))}
                {rows.length === 0 && (
                    <TableRow className="h-[var(--h-wb-table-row)] border-b border-wb-table-border">
                        <TableCell
                            colSpan={dataColCount}
                            className="px-2.5 text-center text-wb-13 text-wb-muted"
                        >
                            {t("common.no_rows")}
                        </TableCell>
                    </TableRow>
                )}
                {totalsByCurrency.map(([ccy, sums]) => {
                    const labelSpan = showNickname ? 4 : 3;
                    return (
                        <TableRow
                            key={`total-${ccy}`}
                            className="h-[var(--h-wb-table-row)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar last:border-b-0"
                        >
                            <TableCell
                                colSpan={labelSpan}
                                className="px-2.5 py-2.5 align-middle"
                            >
                                <span className="text-wb-13 font-semibold text-wb-ink">
                                    {t("report.daily_financial.total_currency", { currency: ccy })}
                                </span>
                            </TableCell>
                            <CellRight strong>{sums.numDebits}</CellRight>
                            <CellRight strong>{formatAmount(sums.debit, ccy, true)}</CellRight>
                            <CellRight strong>{includeInternalTransfers ? sums.numInternalDebits : 0}</CellRight>
                            <CellRight strong>{formatAmount(includeInternalTransfers ? sums.internalDebit : 0, ccy, true)}</CellRight>
                            <CellRight strong>{sums.numCredits}</CellRight>
                            <CellRight strong>{formatAmount(sums.credit, ccy, true)}</CellRight>
                            <CellRight strong>{includeInternalTransfers ? sums.numInternalCredits : 0}</CellRight>
                            <CellRight strong>{formatAmount(includeInternalTransfers ? sums.internalCredit : 0, ccy, true)}</CellRight>
                            <CellRight strong>{formatAmount(sums.balance, ccy, true)}</CellRight>
                        </TableRow>
                    );
                })}
            </TableBody>
        </table>
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

/**
 * Left-aligned cell rendered as a clickable underlined link. Used for
 * the Bank / Account No. / Account Nickname columns in the Daily
 * Financial ledger — clicking any of them opens the Transaction
 * History Details popup (mirrors legacy `rept_0015_001` behaviour at
 * `rept_0015_001.ts:146-150` where `.view-details` cells open
 * `rept_0015_002.act`).
 */
function CellLink({
    children,
    onClick,
}: {
    children: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <TableCell className="px-2.5 py-2.5 align-middle">
            <button
                type="button"
                onClick={onClick}
                style={{ color: "#494949" }}
                className="block max-w-full cursor-pointer truncate text-left text-wb-13 font-medium underline underline-offset-2"
            >
                {children}
            </button>
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

/** `YYYY-MM-DD` → `DD-MM-YYYY` for the As-of chip. */
function formatIsoToDmy(iso: string): string {
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${d}-${m}-${y}`;
}

const MONTH_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** `YYYY-MM-DD` → `DD-MMM-YYYY` (e.g. `17-Aug-2017`) for the summary card. */
function formatIsoToDmmmY(iso: string): string {
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    const mi = Number(m) - 1;
    if (mi < 0 || mi > 11) return iso;
    return `${d}-${MONTH_SHORT[mi]}-${y}`;
}
