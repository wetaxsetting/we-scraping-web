"use client";

import { useCallback, useMemo, useState } from "react";

import TransactionHistoryPage from "./TransactionHistoryPage";
import { composeAccountLabel, type TransactionAccount } from "./accounts";
import {
    ApiCallError,
    confirmTransaction,
    fetchAccounts,
    fetchTransactions,
    fetchTransactionsSummary,
    undoConfirmTransaction,
    type FetchTransactionsParams,
} from "@/lib/api/banking";
import {
    mapTransactionRow,
    mapTransactionSummary,
} from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { useDialog } from "@/components/shared/dialog";
import { useExcelExport, type ExcelExportColumnConfig } from "@/hooks/useExcelExport";
import { useTranslation } from "@/lib/i18n";
import {
    DEFAULT_AREA_ID,
    SCREEN_IDS,
} from "@/lib/viewSettingScreens";
import type { ViewSettingItem } from "@/components/shared/view-setting";
import { todayDmy } from "@/lib/excel";
import type {
    TransactionRow,
    TransactionStatusFilter,
    TransactionTypeFilter as TypeFilter,
} from "./types";

/**
 * Export column registry for Banking > Transaction History. FIELD_IDs
 * mirror the V157 + V159 `SYS_SCR_OPTION_WECMS` seed for
 * `web_svc_id = 'banking-transaction-history'` which is aligned with
 * the legacy on-screen table (12 fields, all FIX_YN='N'). The shared
 * export hook walks the live View Setting items (or FALLBACK_COLUMNS)
 * and ships only the entries that intersect this map; backend
 * re-intersects with the persisted visibility before emitting columns
 * (CLAUDE.md §13b).
 */
const TRANSACTION_HISTORY_EXPORT_COLUMNS: Record<string, ExcelExportColumnConfig> = {
    TRSC_ID:      { headerKey: "txn_history.col.transaction_id", format: "text",   widthChars: 22 },
    TRSC_DTM:     { headerKey: "txn_history.col.date_time",      format: "datetime", widthChars: 22 },
    DEPOSIT_AMT:  { headerKey: "txn_history.col.deposit",        format: "amount", align: "right", widthChars: 22 },
    WITHDRAW_AMT: { headerKey: "txn_history.col.withdraw",       format: "amount", align: "right", widthChars: 22 },
    BAL:          { headerKey: "txn_history.col.balance",        format: "amount", align: "right", widthChars: 22 },
    RMRK:         { headerKey: "txn_history.col.remarks",        format: "text",   widthChars: 30 },
    FILE_NM:      { headerKey: "txn_history.col.file_name",      format: "text",   widthChars: 26 },
    MTCH_DT:      { headerKey: "txn_history.col.matched_date",   format: "date",   widthChars: 16 },
    MTCH_BY:      { headerKey: "txn_history.col.matched_by",     format: "text",   widthChars: 18 },
    PURPOSE:      { headerKey: "txn_history.col.purpose",        format: "text",   widthChars: 20 },
    CONTACT_NM:   { headerKey: "txn_history.col.contact_name",   format: "text",   widthChars: 22 },
    CONFIRMED_BY: { headerKey: "txn_history.col.confirmed_by",   format: "text",   widthChars: 18 },
};

/**
 * Fallback column set mirroring the V157 + V159 seed (legacy
 * on-screen-table parity, 12 data columns) — used until the View
 * Setting endpoint resolves so the export request is well-formed even
 * on a cold render.
 */
const TRANSACTION_HISTORY_FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "TRSC_ID",      field_nm: "Transaction ID", disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "N" },
    { field_id: "TRSC_DTM",     field_nm: "Date/Time",      disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "Y" },
    { field_id: "DEPOSIT_AMT",  field_nm: "Deposit",        disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "WITHDRAW_AMT", field_nm: "Withdrawal",     disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "BAL",          field_nm: "Balance",        disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "RMRK",         field_nm: "Remarks",        disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "240px", sort_yn: "N" },
    { field_id: "FILE_NM",      field_nm: "File Name",      disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "N" },
    { field_id: "MTCH_DT",      field_nm: "Matched Date",   disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "MTCH_BY",      field_nm: "Matched By",     disp_ord: 9,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "120px", sort_yn: "N" },
    { field_id: "PURPOSE",      field_nm: "Purpose",        disp_ord: 10, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "N" },
    { field_id: "CONTACT_NM",   field_nm: "Contact Name",   disp_ord: 11, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "N" },
    { field_id: "CONFIRMED_BY", field_nm: "Confirmed by",   disp_ord: 12, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "N" },
];

type Props = {
    /** Backend `acct_seq_no` (`BANK_CD + "_" + ACCT_NO`) — drives both
     *  the breadcrumb lookup against `/accounts` and the transactions
     *  endpoint path parameter. */
    acctSeqNo: string;
    /** "VND" / "FCY" — chooses the `/accounts?currency=` scope used for
     *  the breadcrumb lookup. */
    scope: "VND" | "FCY";
};

/**
 * Filter state lives HERE (not in the page) so it can feed both the list
 * fetcher and the summary fetcher with the same params and stay in lock-step.
 * The status tab (`all` / `confirmed` / `unconfirmed`) only narrows the LIST
 * — the SUMMARY is computed against the pre-status scope so the tab counters
 * read "All 12 · Confirmed 5 · Unconfirmed 7" instead of all showing the
 * narrowed count.
 *
 * Account slug = backend `acct_seq_no` directly (migrated 2026-05-16
 * — the legacy static-slug list and bank-prefix bridging hack are
 * retired). The breadcrumb account is resolved from a small
 * `/accounts?currency=…` lookup so the page title can show
 * `<bank label> (<currency>)` even on deep-linked entries.
 */
/** Default date window when the page opens — last 30 days inclusive.
 *  Matches the FB History / ERP convention used elsewhere in Settings;
 *  legacy JEX `comm_0186_*.ts` also seeds a 30-day window via
 *  `loadinitializeDate(-30, today)`. ISO format on the JS boundary
 *  ({@code YYYY-MM-DD}); the wrapper normalises to {@code YYYYMMDD}
 *  at the wire boundary below. */
function defaultDateRange(): { start: string; end: string } {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    return { start: toIso(start), end: toIso(today) };
}

function toIso(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

/** ISO {@code YYYY-MM-DD} → wire {@code YYYYMMDD} accepted by the
 *  backend's `from` / `to` query params. */
function toWireDate(iso: string): string {
    return iso.replaceAll("-", "");
}

export default function TransactionHistoryClient({ acctSeqNo, scope }: Props) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const exportXlsx = useExcelExport();
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [statusFilter, setStatusFilter] = useState<TransactionStatusFilter>("all");
    const [search, setSearch] = useState("");
    const initialRange = useMemo(defaultDateRange, []);
    const [startDate, setStartDate] = useState(initialRange.start);
    const [endDate, setEndDate] = useState(initialRange.end);
    // Bumped after every Confirm / Undo to force `useApiData` to refire
    // the list + summary fetchers so the row chrome (yellow → white,
    // Confirm → Undo) and the tab counters update without a full reload.
    const [refreshKey, setRefreshKey] = useState(0);

    // Resolve the breadcrumb account from the live `/accounts` list so
    // the page title reads `<bank label> (<currency>)`. Falls back to a
    // synthetic label derived from the slug while in flight — the
    // transactions request below does NOT depend on this resolution
    // (the slug IS the wire `acct_seq_no` already).
    const accountsState = useApiData(() => fetchAccounts(scope), [scope]);
    const account: TransactionAccount = useMemo(() => {
        const row = (accountsState.data?.accounts ?? []).find(
            (a) => a.acct_seq_no === acctSeqNo,
        );
        if (row) {
            return {
                id: row.acct_seq_no,
                bankName: composeAccountLabel(row.bank_nm, row.acct_no),
                currency: row.ccy_cd,
            };
        }
        // Fallback: derive a best-effort label from the slug itself
        // (`BANK_CD_ACCT_NO`). Last 4 digits of the trailing fragment
        // give a stable identifier while the accounts list loads.
        const tail = acctSeqNo.split("_").slice(-1)[0] ?? acctSeqNo;
        const last4 = tail.replace(/\D/g, "").slice(-4);
        return {
            id: acctSeqNo,
            bankName: last4 || acctSeqNo,
            currency: scope === "VND" ? "VND" : "",
        };
    }, [accountsState.data, acctSeqNo, scope]);

    // Slug equals the backend's `acct_seq_no` — no bridging.
    const realAcctSeqNo = acctSeqNo;

    // Server-side filter params shared by list + summary. Status tab is
    // intentionally excluded from `summaryParams` so the tab counters reflect
    // the full pre-status scope.
    const listParams: FetchTransactionsParams = useMemo(
        () => ({
            from: toWireDate(startDate),
            to: toWireDate(endDate),
            type: typeFilter === "all" ? undefined : typeFilter.toUpperCase(),
            cnfmYn:
                statusFilter === "confirmed"
                    ? "Y"
                    : statusFilter === "unconfirmed"
                      ? "N"
                      : undefined,
            keyword: search.trim() || undefined,
        }),
        [startDate, endDate, typeFilter, statusFilter, search],
    );

    const summaryParams: FetchTransactionsParams = useMemo(
        () => ({
            from: toWireDate(startDate),
            to: toWireDate(endDate),
            type: typeFilter === "all" ? undefined : typeFilter.toUpperCase(),
            keyword: search.trim() || undefined,
        }),
        [startDate, endDate, typeFilter, search],
    );

    const txnState = useApiData(
        () =>
            realAcctSeqNo
                ? fetchTransactions(realAcctSeqNo, listParams)
                : Promise.resolve(null),
        [realAcctSeqNo, listParams, refreshKey],
    );

    const summaryState = useApiData(
        () =>
            realAcctSeqNo
                ? fetchTransactionsSummary(realAcctSeqNo, summaryParams)
                : Promise.resolve(null),
        [realAcctSeqNo, summaryParams, refreshKey],
    );

    const rows = useMemo(() => {
        const raw = txnState.data?.ROWS;
        return raw ? raw.map(mapTransactionRow) : [];
    }, [txnState.data]);

    const summary = useMemo(
        () => (summaryState.data ? mapTransactionSummary(summaryState.data) : null),
        [summaryState.data],
    );

    // Find the live row by its rendered id and return the surrogate
    // (`trnsSeqNo` = backend `ACCT_SEQ_NO` of the row). Confirm / Undo
    // bail with no-op when either piece is missing — callers should not
    // reach here, but guard defensively.
    const trnsSeqNoForRow = useCallback(
        (rowId: string): string | null => {
            const row = rows.find((r: TransactionRow) => r.id === rowId);
            return row?.trnsSeqNo ?? null;
        },
        [rows],
    );

    const showErrorDialog = useCallback(
        (err: unknown) => {
            const e = err instanceof ApiCallError ? err : null;
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: e?.message ?? (err instanceof Error ? err.message : String(err)),
                errorCode: e?.code,
            });
        },
        [dialog, t],
    );

    const handleConfirmRow = useCallback(
        async (rowId: string) => {
            if (!realAcctSeqNo) return;
            const trnsSeqNo = trnsSeqNoForRow(rowId);
            if (!trnsSeqNo) return;
            try {
                await confirmTransaction(realAcctSeqNo, trnsSeqNo);
                setRefreshKey((k) => k + 1);
                dialog.open({
                    type: "success",
                    title: t("dialog.success"),
                    description: t("txn_history.confirm_success"),
                });
            } catch (err) {
                showErrorDialog(err);
            }
        },
        [realAcctSeqNo, trnsSeqNoForRow, dialog, t, showErrorDialog],
    );

    const handleUndoRow = useCallback(
        async (rowId: string) => {
            if (!realAcctSeqNo) return;
            const trnsSeqNo = trnsSeqNoForRow(rowId);
            if (!trnsSeqNo) return;
            try {
                await undoConfirmTransaction(realAcctSeqNo, trnsSeqNo);
                setRefreshKey((k) => k + 1);
                dialog.open({
                    type: "success",
                    title: t("dialog.success"),
                    description: t("txn_history.undo_success"),
                });
            } catch (err) {
                showErrorDialog(err);
            }
        },
        [realAcctSeqNo, trnsSeqNoForRow, dialog, t, showErrorDialog],
    );

    const handleExport = useCallback(async () => {
        if (!realAcctSeqNo) return;
        // Two distinct strings — filename gets the legacy `_DDMMYYYY`
        // suffix (no inner space); title is the on-screen page header
        // verbatim per CLAUDE.md §13b.
        const scopeLabel = `${account.bankName} (${account.currency})`;
        try {
            await exportXlsx({
                endpoint: "/api/v1/banking/accounts/transactions/export",
                screenId: SCREEN_IDS.BANKING_TRANSACTION_HISTORY,
                dymAreaId: DEFAULT_AREA_ID,
                fileName: `${t("txn_history.export_title")}_${todayDmy()}`,
                title: t("txn_history.breadcrumb", { account: scopeLabel }),
                items: TRANSACTION_HISTORY_FALLBACK_COLUMNS,
                columnConfig: TRANSACTION_HISTORY_EXPORT_COLUMNS,
                t,
                filters: {
                    acctSeqNo: realAcctSeqNo,
                    from: toWireDate(startDate),
                    to: toWireDate(endDate),
                    type: typeFilter === "all" ? undefined : typeFilter.toUpperCase(),
                    cnfmYn:
                        statusFilter === "confirmed"
                            ? "Y"
                            : statusFilter === "unconfirmed"
                              ? "N"
                              : undefined,
                    keyword: search.trim() || undefined,
                },
                sort: null,
            });
        } catch (err) {
            showErrorDialog(err);
        }
    }, [
        realAcctSeqNo,
        account.bankName,
        account.currency,
        exportXlsx,
        t,
        startDate,
        endDate,
        typeFilter,
        statusFilter,
        search,
        showErrorDialog,
    ]);

    const handleSmartOrganize = useCallback(() => {
        dialog.open({
            type: "warning",
            title: t("dialog.warning"),
            description: t("txn_history.smart_organizer_coming_soon"),
        });
    }, [dialog, t]);

    return (
        <TransactionHistoryPage
            account={account}
            rows={rows}
            summary={summary}
            listTotals={
                txnState.data
                    ? {
                          count: txnState.data.TOTAL_COUNT ?? rows.length,
                          depositTotal: txnState.data.DEPOSIT_TOTAL ?? "0",
                          withdrawTotal: txnState.data.WITHDRAW_TOTAL ?? "0",
                      }
                    : null
            }
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={(range) => {
                setStartDate(range.start);
                setEndDate(range.end);
            }}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            search={search}
            onSearchChange={setSearch}
            onConfirmRow={handleConfirmRow}
            onUndoRow={handleUndoRow}
            onExport={handleExport}
            onSmartOrganize={handleSmartOrganize}
            onMatchChanged={() => setRefreshKey((k) => k + 1)}
        />
    );
}
