"use client";

import { useCallback, useMemo, useState } from "react";

import TransactionHistoryPage from "./TransactionHistoryPage";
import { composeAccountLabel, type TransactionAccount } from "./accounts";
import {
    ApiCallError,
    clearTransactionContact,
    clearTransactionPurpose,
    clearTransactionReportingAccount,
    clearTransactionVasAccount,
    confirmTransaction,
    downloadTransactionHistoryFcyReport,
    downloadTransactionHistoryReport,
    fetchAccounts,
    fetchTransactions,
    fetchTransactionsSummary,
    undoConfirmTransaction,
    updateTransactionContact,
    updateTransactionPurpose,
    updateTransactionReportingAccount,
    updateTransactionVasAccount,
    type FetchTransactionsParams,
} from "@/lib/api/banking";
import { fetchChartOfAccounts } from "@/lib/api/chartOfAccounts";
import { fetchContacts } from "@/lib/api/contacts";
import { fetchPurposeSettings } from "@/lib/api/purposeSettings";
import { fetchVasAccounts } from "@/lib/api/vasAccount";
import { userStorage } from "@/lib/auth/storage";
import { buildReportingAccountOptions } from "./chartOfAccountsOptions";
import { buildContactOptions } from "./contactOptions";
import {
    pushRecentContact,
    readRecentContacts,
} from "./contactRecents";
import { buildPurposeOptions } from "./purposeOptions";
import {
    pushRecentPurpose,
    readRecentPurposes,
} from "./purposeRecents";
import { buildVasAccountOptions } from "./vasAccountOptions";
import {
    pushRecentVasAccount,
    readRecentVasAccounts,
} from "./vasAccountRecents";
import {
    mapTransactionRow,
    mapTransactionSummary,
} from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { useDialog } from "@/components/shared/dialog";
import { useExcelExport, type ExcelExportColumnConfig } from "@/hooks/useExcelExport";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTranslation } from "@/lib/i18n";
import {
    DEFAULT_AREA_ID,
    SCREEN_IDS,
} from "@/lib/viewSettingScreens";
import type { ViewSettingItem } from "@/components/shared/view-setting";
import { todayDmy } from "@/lib/excel";
import type {
    ContactOption,
    PurposeOption,
    ReportingAccountOption,
    TransactionRow,
    TransactionStatusFilter,
    TransactionTypeFilter as TypeFilter,
    VasAccountOption,
} from "./types";

/**
 * Export column registry for Banking > Transaction History. FIELD_IDs
 * mirror the V156 `SYS_SCR_OPTION_WECMS` seed for
 * `web_svc_id = 'banking-transaction-history-vnd'` / `-fcy` (shared — the
 * VND and FCY column sets are currently identical). The shared
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
    MTCH_BY:       { headerKey: "txn_history.col.matched_by",        format: "text", widthChars: 18 },
    CHART_ACCT_CD: { headerKey: "txn_history.col.reporting_account", format: "text", widthChars: 26 },
    PURPOSE:       { headerKey: "txn_history.col.purpose",           format: "text", widthChars: 20 },
    VAS_ACCT_CD:   { headerKey: "txn_history.col.vas_account",       format: "text", widthChars: 26 },
    CONTACT_NM:    { headerKey: "txn_history.col.contact_name",      format: "text", widthChars: 22 },
    CONFIRMED_BY:  { headerKey: "txn_history.col.confirmed_by",      format: "text", widthChars: 18 },
};

/**
 * Fallback column set mirroring the V157 + V159 seed (legacy
 * on-screen-table parity, 12 data columns) — used until the View
 * Setting endpoint resolves so the export request is well-formed even
 * on a cold render.
 */
const TRANSACTION_HISTORY_FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "TRSC_ID",      field_nm: "Transaction ID", disp_ord: 1,  disp_yn: "Y", use_yn: "Y", size: "160px", sort_yn: "N" },
    { field_id: "TRSC_DTM",     field_nm: "Date/Time",      disp_ord: 2,  disp_yn: "Y", use_yn: "Y", size: "160px", sort_yn: "Y" },
    { field_id: "DEPOSIT_AMT",  field_nm: "Deposit",        disp_ord: 3,  disp_yn: "Y", use_yn: "Y", size: "140px", sort_yn: "Y" },
    { field_id: "WITHDRAW_AMT", field_nm: "Withdrawal",     disp_ord: 4,  disp_yn: "Y", use_yn: "Y", size: "140px", sort_yn: "Y" },
    { field_id: "BAL",          field_nm: "Balance",        disp_ord: 5,  disp_yn: "Y", use_yn: "Y", size: "140px", sort_yn: "Y" },
    { field_id: "RMRK",         field_nm: "Remarks",        disp_ord: 6,  disp_yn: "Y", use_yn: "Y", size: "240px", sort_yn: "N" },
    { field_id: "FILE_NM",      field_nm: "File Name",      disp_ord: 7,  disp_yn: "Y", use_yn: "Y", size: "180px", sort_yn: "N" },
    { field_id: "MTCH_DT",      field_nm: "Matched Date",   disp_ord: 8,  disp_yn: "Y", use_yn: "Y", size: "140px", sort_yn: "Y" },
    { field_id: "MTCH_BY",        field_nm: "Matched By",        disp_ord: 9,  disp_yn: "Y", use_yn: "Y", size: "120px", sort_yn: "N" },
    { field_id: "CHART_ACCT_CD",  field_nm: "Reporting Account", disp_ord: 10, disp_yn: "Y", use_yn: "Y", size: "190px", sort_yn: "N" },
    { field_id: "PURPOSE",        field_nm: "Purpose",           disp_ord: 11, disp_yn: "Y", use_yn: "Y", size: "140px", sort_yn: "N" },
    { field_id: "VAS_ACCT_CD",    field_nm: "VAS Account",       disp_ord: 12, disp_yn: "Y", use_yn: "Y", size: "200px", sort_yn: "N" },
    { field_id: "CONTACT_NM",     field_nm: "Contact Name",      disp_ord: 13, disp_yn: "Y", use_yn: "Y", size: "180px", sort_yn: "N" },
    { field_id: "CONFIRMED_BY",   field_nm: "Confirmed by",      disp_ord: 14, disp_yn: "Y", use_yn: "Y", size: "160px", sort_yn: "N" },
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
    const { t, locale } = useTranslation();

    // View Setting key is split per scope (2026-06-11):
    //   VND -> banking-transaction-history-vnd
    //   FCY -> banking-transaction-history-fcy
    // Same shared column registry/fallback; only the screenId differs.
    const viewSettingScreenId =
        scope === "VND"
            ? SCREEN_IDS.BANKING_TRANSACTION_HISTORY_VND
            : SCREEN_IDS.BANKING_TRANSACTION_HISTORY_FCY;
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

    // Chart of Accounts options for the Reporting Account picker.
    // Loaded once per page mount — settings-managed list rarely
    // changes during a session and the picker reuses one list across
    // every row. Errors fall back to an empty options array (the
    // picker still opens, just with no selectable rows).
    const chartOfAccountsState = useApiData(
        () => fetchChartOfAccounts({ sortField: "CHART_ACCT_CD", sortDir: "ASC" }),
        [],
    );
    const reportingAccountOptions: ReportingAccountOption[] = useMemo(() => {
        const apiRows = chartOfAccountsState.data?.items ?? [];
        return buildReportingAccountOptions(apiRows);
    }, [chartOfAccountsState.data]);

    // Purpose options + per-user recents — backs the Purpose picker.
    const purposeState = useApiData(() => fetchPurposeSettings(), []);
    const purposeOptions: PurposeOption[] = useMemo(() => {
        const apiRows = purposeState.data?.list ?? [];
        return buildPurposeOptions(apiRows);
    }, [purposeState.data]);

    const [recentPurposeUseUsagCds, setRecentPurposeUseUsagCds] = useState<string[]>(
        () => {
            const stored = userStorage.get();
            return readRecentPurposes(
                stored?.bizKey ?? null,
                stored?.userId ?? null,
            );
        },
    );

    // VAS Account options + per-user recents — backs the VAS Account
    // picker. Backend already filters to active rows but the option
    // builder defence-in-depth keeps a stale frontend state safe.
    const vasAccountState = useApiData(
        () => fetchVasAccounts({ statuses: ["A"] }),
        [],
    );
    const vasAccountOptions: VasAccountOption[] = useMemo(() => {
        const apiRows = vasAccountState.data?.list ?? [];
        return buildVasAccountOptions(apiRows);
    }, [vasAccountState.data]);

    const [recentVasAcctCds, setRecentVasAcctCds] = useState<string[]>(() => {
        const stored = userStorage.get();
        return readRecentVasAccounts(
            stored?.bizKey ?? null,
            stored?.userId ?? null,
        );
    });

    // Contact options + per-user recents — backs the Contact Name
    // picker. Backend already filters trashed rows via the list
    // endpoint's hard-coded `trco_stts != 'C'` predicate; the option
    // builder keeps a defence-in-depth filter.
    const contactsState = useApiData(
        () => fetchContacts({ sortField: "HAND_TRCO_KEY", sortDirection: "ASC" }),
        [],
    );
    const contactOptions: ContactOption[] = useMemo(() => {
        const apiRows = contactsState.data?.rows ?? [];
        return buildContactOptions(apiRows);
    }, [contactsState.data]);

    const [recentContactTrcoKeys, setRecentContactTrcoKeys] = useState<string[]>(
        () => {
            const stored = userStorage.get();
            return readRecentContacts(
                stored?.bizKey ?? null,
                stored?.userId ?? null,
            );
        },
    );

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
            const bankName = composeAccountLabel(row.bank_nm, row.acct_no);
            const rawNick = (row.acct_nick_nm ?? "").trim();
            return {
                id: row.acct_seq_no,
                bankName,
                currency: row.ccy_cd,
                nickname: rawNick.length > 0 ? rawNick : bankName,
            };
        }
        // Fallback: derive a best-effort label from the slug itself
        // (`BANK_CD_ACCT_NO`). Last 4 digits of the trailing fragment
        // give a stable identifier while the accounts list loads.
        const tail = acctSeqNo.split("_").slice(-1)[0] ?? acctSeqNo;
        const last4 = tail.replace(/\D/g, "").slice(-4);
        const fallbackName = last4 || acctSeqNo;
        return {
            id: acctSeqNo,
            bankName: fallbackName,
            currency: scope === "VND" ? "VND" : "",
            nickname: fallbackName,
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

    /* Latch the latest non-null txn response so date / type / status /
     * search / pagination / row-mutation refetches don't blank the
     * table chrome between requests. `useApiData` resets `data` to
     * null on every dep change. Pattern mirrors AccountInquiryClient /
     * OperationStatusClient. */
    const [stableTxnData, setStableTxnData] = useState(txnState.data);
    const [prevTxnData, setPrevTxnData] = useState(txnState.data);
    if (txnState.data !== prevTxnData) {
        setPrevTxnData(txnState.data);
        if (txnState.data) setStableTxnData(txnState.data);
    }

    /* Sticky-wrap the initial-fetch gate so the "Loading…" body
     * message stays visible for the minimum-visibility window on
     * first paint and on the very first per-account refetch (where
     * `stableTxnData` is null because the slug changed). Subsequent
     * filter / pagination refetches keep the previous rows visible
     * via the latch above and never trip the sticky window. */
    const stickyInitialLoading = useStickyLoading(
        txnState.loading && !stableTxnData,
    );

    const rows = useMemo(() => {
        const raw = stableTxnData?.rows;
        if (!raw) return [];
        // Join the wire row's `CHART_ACCT_SEQ_NO` against the loaded
        // chart-of-accounts option list so the cell renders the picked
        // account's name + breadcrumb without a per-row API call.
        // Legacy parity: `fnsh_0200_001` reads the level/name from a
        // join already cached client-side.
        const chartBySeq = new Map<string, ReportingAccountOption>();
        for (const opt of reportingAccountOptions) {
            chartBySeq.set(opt.chartAcctSeqNo, opt);
        }
        const purposeByCd = new Map<string, PurposeOption>();
        for (const opt of purposeOptions) {
            purposeByCd.set(opt.useUsagCd, opt);
        }
        const vasByCd = new Map<string, VasAccountOption>();
        for (const opt of vasAccountOptions) {
            vasByCd.set(opt.vasAcctCd, opt);
        }
        return raw.map(mapTransactionRow).map((row: TransactionRow) => {
            let enriched: TransactionRow = row;
            if (enriched.chartAcctSeqNo) {
                const opt = chartBySeq.get(enriched.chartAcctSeqNo);
                if (opt) {
                    enriched = {
                        ...enriched,
                        reportingAccountCode:       opt.code,
                        reportingAccountName:       opt.name,
                        reportingAccountBreadcrumb: opt.breadcrumb,
                    };
                }
            }
            if (enriched.useUsagCd) {
                const opt = purposeByCd.get(enriched.useUsagCd);
                if (opt) {
                    enriched = {
                        ...enriched,
                        purposeCode: opt.code,
                        purposeName: opt.name,
                    };
                }
            }
            if (enriched.vasAcctCd) {
                const opt = vasByCd.get(enriched.vasAcctCd);
                if (opt) {
                    enriched = {
                        ...enriched,
                        vasAcctName: opt.name,
                    };
                }
            }
            return enriched;
        });
    }, [stableTxnData, reportingAccountOptions, purposeOptions, vasAccountOptions]);

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

    const handleReportingAccountChange = useCallback(
        async (rowId: string, next: ReportingAccountOption) => {
            if (!realAcctSeqNo) return;
            const trnsSeqNo = trnsSeqNoForRow(rowId);
            if (!trnsSeqNo) return;
            try {
                await updateTransactionReportingAccount(realAcctSeqNo, trnsSeqNo, {
                    chart_acct_seq_no: next.chartAcctSeqNo,
                    chart_acct_cd:     next.code,
                });
                setRefreshKey((k) => k + 1);
            } catch (err) {
                showErrorDialog(err);
            }
        },
        [realAcctSeqNo, trnsSeqNoForRow, showErrorDialog],
    );

    const handleReportingAccountClear = useCallback(
        async (rowId: string) => {
            if (!realAcctSeqNo) return;
            const trnsSeqNo = trnsSeqNoForRow(rowId);
            if (!trnsSeqNo) return;
            try {
                await clearTransactionReportingAccount(realAcctSeqNo, trnsSeqNo);
                setRefreshKey((k) => k + 1);
            } catch (err) {
                showErrorDialog(err);
            }
        },
        [realAcctSeqNo, trnsSeqNoForRow, showErrorDialog],
    );

    const handlePurposeChange = useCallback(
        async (rowId: string, next: PurposeOption) => {
            if (!realAcctSeqNo) return;
            const trnsSeqNo = trnsSeqNoForRow(rowId);
            if (!trnsSeqNo) return;
            try {
                await updateTransactionPurpose(realAcctSeqNo, trnsSeqNo, {
                    use_usag_cd: next.useUsagCd,
                });
                // Push to per-user recents so the next pick floats the
                // most-recently used codes to the top of the popover.
                const stored = userStorage.get();
                pushRecentPurpose(
                    stored?.bizKey ?? null,
                    stored?.userId ?? null,
                    next.useUsagCd,
                );
                setRecentPurposeUseUsagCds(
                    readRecentPurposes(
                        stored?.bizKey ?? null,
                        stored?.userId ?? null,
                    ),
                );
                setRefreshKey((k) => k + 1);
            } catch (err) {
                showErrorDialog(err);
            }
        },
        [realAcctSeqNo, trnsSeqNoForRow, showErrorDialog],
    );

    const handlePurposeClear = useCallback(
        async (rowId: string) => {
            if (!realAcctSeqNo) return;
            const trnsSeqNo = trnsSeqNoForRow(rowId);
            if (!trnsSeqNo) return;
            try {
                await clearTransactionPurpose(realAcctSeqNo, trnsSeqNo);
                setRefreshKey((k) => k + 1);
            } catch (err) {
                showErrorDialog(err);
            }
        },
        [realAcctSeqNo, trnsSeqNoForRow, showErrorDialog],
    );

    const handleVasAccountChange = useCallback(
        async (rowId: string, next: VasAccountOption) => {
            if (!realAcctSeqNo) return;
            const trnsSeqNo = trnsSeqNoForRow(rowId);
            if (!trnsSeqNo) return;
            try {
                await updateTransactionVasAccount(realAcctSeqNo, trnsSeqNo, {
                    vas_acct_cd: next.vasAcctCd,
                });
                const stored = userStorage.get();
                pushRecentVasAccount(
                    stored?.bizKey ?? null,
                    stored?.userId ?? null,
                    next.vasAcctCd,
                );
                setRecentVasAcctCds(
                    readRecentVasAccounts(
                        stored?.bizKey ?? null,
                        stored?.userId ?? null,
                    ),
                );
                setRefreshKey((k) => k + 1);
            } catch (err) {
                showErrorDialog(err);
            }
        },
        [realAcctSeqNo, trnsSeqNoForRow, showErrorDialog],
    );

    const handleVasAccountClear = useCallback(
        async (rowId: string) => {
            if (!realAcctSeqNo) return;
            const trnsSeqNo = trnsSeqNoForRow(rowId);
            if (!trnsSeqNo) return;
            try {
                await clearTransactionVasAccount(realAcctSeqNo, trnsSeqNo);
                setRefreshKey((k) => k + 1);
            } catch (err) {
                showErrorDialog(err);
            }
        },
        [realAcctSeqNo, trnsSeqNoForRow, showErrorDialog],
    );

    const handleContactChange = useCallback(
        async (rowId: string, next: ContactOption) => {
            if (!realAcctSeqNo) return;
            const trnsSeqNo = trnsSeqNoForRow(rowId);
            if (!trnsSeqNo) return;
            try {
                await updateTransactionContact(realAcctSeqNo, trnsSeqNo, {
                    trco_key: next.trcoKey,
                });
                const stored = userStorage.get();
                pushRecentContact(
                    stored?.bizKey ?? null,
                    stored?.userId ?? null,
                    next.trcoKey,
                );
                setRecentContactTrcoKeys(
                    readRecentContacts(
                        stored?.bizKey ?? null,
                        stored?.userId ?? null,
                    ),
                );
                setRefreshKey((k) => k + 1);
            } catch (err) {
                showErrorDialog(err);
            }
        },
        [realAcctSeqNo, trnsSeqNoForRow, showErrorDialog],
    );

    const handleContactClear = useCallback(
        async (rowId: string) => {
            if (!realAcctSeqNo) return;
            const trnsSeqNo = trnsSeqNoForRow(rowId);
            if (!trnsSeqNo) return;
            try {
                await clearTransactionContact(realAcctSeqNo, trnsSeqNo);
                setRefreshKey((k) => k + 1);
            } catch (err) {
                showErrorDialog(err);
            }
        },
        [realAcctSeqNo, trnsSeqNoForRow, showErrorDialog],
    );

    const [exporting, setExporting] = useState(false);
    /* Sticky mirror — keeps the Print + Excel chrome visibly disabled
     * across the minimum-visibility window so a fast cached download
     * can't be triggered twice and the icons don't flicker
     * enabled → disabled → enabled. */
    const stickyExporting = useStickyLoading(exporting);

    const handleExport = useCallback(async () => {
        if (!realAcctSeqNo) return;
        if (exporting) return; // guard against double-click while a download is in flight

        // VND-only PO override: stream the template-populated `.xls` report
        // (dedicated `GET /accounts/{id}/transactions/report`) instead of the
        // generic from-scratch `POST /accounts/transactions/export`. FCY
        // accounts keep the generic export.
        if (account.currency === "VND") {
            setExporting(true);
            try {
                await downloadTransactionHistoryReport(
                    realAcctSeqNo,
                    {
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
                    locale,
                );
            } catch (err) {
                showErrorDialog(err);
            } finally {
                setExporting(false);
            }
            return;
        }

        // FCY PO override: stream the FCY template-populated `.xls` report
        // (dedicated `GET /accounts/{id}/transactions/report-fcy`). `scope` is
        // the reliable VND/FCY discriminator (account.currency is a concrete CCY
        // like USD/KRW for FCY accounts). Same filter set as the on-screen list.
        if (scope === "FCY") {
            setExporting(true);
            try {
                await downloadTransactionHistoryFcyReport(
                    realAcctSeqNo,
                    {
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
                    locale,
                );
            } catch (err) {
                showErrorDialog(err);
            } finally {
                setExporting(false);
            }
            return;
        }

        // Two distinct strings — filename gets the legacy `_DDMMYYYY`
        // suffix (no inner space); title is the on-screen page header
        // verbatim per CLAUDE.md §13b.
        const scopeLabel = `${account.bankName} (${account.currency})`;
        setExporting(true);
        try {
            await exportXlsx({
                endpoint: "/api/v1/banking/accounts/transactions/export",
                screenId: viewSettingScreenId,
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
        } finally {
            setExporting(false);
        }
    }, [
        realAcctSeqNo,
        account.bankName,
        account.currency,
        exporting,
        exportXlsx,
        t,
        locale,
        startDate,
        endDate,
        typeFilter,
        statusFilter,
        search,
        showErrorDialog,
        viewSettingScreenId,
        scope,
    ]);

    // Toolbar Smart Organizer — legacy `fnsh_0200_001` is a standalone
    // page, not a popup, so this navigates to `/banking/smart-organizer`.
    // Routing is handled by the page component via a Next.js <Link>
    // wrapper; this prop is no longer used.

    return (
        <TransactionHistoryPage
            viewSettingScreenId={viewSettingScreenId}
            account={account}
            rows={rows}
            summary={summary}
            listTotals={
                stableTxnData
                    ? {
                          count: stableTxnData.total_count ?? rows.length,
                          depositTotal: stableTxnData.deposit_total ?? "0",
                          withdrawTotal: stableTxnData.withdraw_total ?? "0",
                      }
                    : null
            }
            loading={stickyInitialLoading}
            exporting={stickyExporting}
            onExport={handleExport}
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
            onMatchChanged={() => setRefreshKey((k) => k + 1)}
            reportingAccountOptions={reportingAccountOptions}
            onReportingAccountChange={handleReportingAccountChange}
            onReportingAccountClear={handleReportingAccountClear}
            purposeOptions={purposeOptions}
            recentPurposeUseUsagCds={recentPurposeUseUsagCds}
            onPurposeChange={handlePurposeChange}
            onPurposeClear={handlePurposeClear}
            vasAccountOptions={vasAccountOptions}
            recentVasAcctCds={recentVasAcctCds}
            onVasAccountChange={handleVasAccountChange}
            onVasAccountClear={handleVasAccountClear}
            contactOptions={contactOptions}
            recentContactTrcoKeys={recentContactTrcoKeys}
            onContactChange={handleContactChange}
            onContactClear={handleContactClear}
        />
    );
}
