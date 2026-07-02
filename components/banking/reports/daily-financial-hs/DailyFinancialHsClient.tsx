"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import type { BankFilterOption, BankFilterValue } from "@/components/shared/BankFilterPopover";
import {
    ApiCallError,
    downloadDailyFinancialHsReport,
    fetchDailyFinancialHs,
    updateDailyFinancialHsEntry,
} from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";

import DailyFinancialHsPage, { type HsEntryPatch } from "./DailyFinancialHsPage";
import { deriveBankOptions, projectHsRows } from "./projectRows";

/**
 * Client wrapper for Banking > Daily Financial (HS) — legacy `rept_0017_001`.
 *
 * Wires the report to the real API (`GET .../daily-financial-hs`), projects the
 * flat function row stream into bank groups, and orchestrates the four legacy
 * behaviours:
 *  - **Search** (date + bank/account filter) — refetch on demand (legacy does
 *    not auto-search on date/filter change; only the Search button reloads).
 *  - **Bank dropdown** — options derived from the unfiltered ("ALL") report's
 *    HEADER rows (legacy sourced these from `cash_0001_001_r003`).
 *  - **Per-field save** — blur/Enter PATCH of the edited cell (`rept_0017_001_u001`).
 *  - **Excel download** — streams the backend `.xlsx` (`rept_0017_001_r002_excel`).
 */
export default function DailyFinancialHsClient() {
    const { t, locale } = useTranslation();
    const dialog = useDialog();

    // As-of date (ISO yyyy-MM-dd). Defaults to today, matching legacy page load.
    const [asOf, setAsOf] = useState<string>(() => todayIso());
    const [bankFilters, setBankFilters] = useState<BankFilterValue[]>([]);
    // Bumped by Search so the loader refetches with the current filters.
    const [searchKey, setSearchKey] = useState(0);
    const [bankOptions, setBankOptions] = useState<BankFilterOption[]>([]);

    const loader = useCallback(
        () =>
            fetchDailyFinancialHs({
                asOf: toPeriodDate(asOf),
                accountFilter: toAccountFilter(bankFilters),
            }),
        // Refetch only on Search (searchKey) — captures the current asOf/filters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [searchKey],
    );

    const { data, loading } = useApiData(loader, [searchKey]);

    const groups = useMemo(() => (data ? projectHsRows(data.rows) : []), [data]);

    // Populate the dropdown once on mount from the unfiltered ("ALL") report so
    // it always lists every account the report covers, regardless of the active
    // filter (legacy sourced this list from `cash_0001_001_r003`). Non-fatal on
    // error — the popover degrades to "All Banks" only.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetchDailyFinancialHs({
                    asOf: toPeriodDate(asOf),
                    accountFilter: "ALL",
                });
                if (!cancelled) setBankOptions(deriveBankOptions(res.rows));
            } catch {
                if (!cancelled) setBankOptions([]);
            }
        })();
        return () => {
            cancelled = true;
        };
        // Mount-only: the account set is date-independent (HEADER rows exist for
        // every active account regardless of the period's transactions).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearch = useCallback(() => {
        setSearchKey((k) => k + 1);
    }, []);

    const handleSaveEntry = useCallback(
        async (acctSeqNo: string, patch: HsEntryPatch) => {
            try {
                await updateDailyFinancialHsEntry(acctSeqNo, patch);
            } catch (err) {
                const code = err instanceof ApiCallError ? err.code : "UNKNOWN";
                const message = err instanceof Error ? err.message : String(err);
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: message,
                    errorCode: code,
                });
            }
        },
        [dialog, t],
    );

    const handleDownloadExcel = useCallback(async () => {
        try {
            await downloadDailyFinancialHsReport({
                asOf: toPeriodDate(asOf),
                accountFilter: toAccountFilter(bankFilters),
                lang: locale.toLowerCase(),
            });
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "UNKNOWN";
            const message = err instanceof Error ? err.message : String(err);
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        }
    }, [asOf, bankFilters, locale, dialog, t]);

    return (
        <DailyFinancialHsPage
            groups={groups}
            loading={loading}
            asOfDate={asOf}
            onAsOfChange={setAsOf}
            bankOptions={bankOptions}
            bankFilters={bankFilters}
            onBankFiltersChange={setBankFilters}
            onSearch={handleSearch}
            onSaveEntry={handleSaveEntry}
            onDownloadExcel={handleDownloadExcel}
        />
    );
}

/** Today as an ISO `yyyy-MM-dd` string (local date). */
function todayIso(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO `yyyy-MM-dd` → `yyyyMMdd` (the backend period-date format). */
function toPeriodDate(iso: string): string {
    return iso.replaceAll("-", "");
}

/** Selected banks → the legacy `ACCT_NO` contract: `ALL` or a JSON array of
 *  `{BANK_CD, ACCT_NO}` objects (verbatim `rept_0017_001.js`). */
function toAccountFilter(filters: BankFilterValue[]): string {
    if (filters.length === 0) return "ALL";
    return JSON.stringify(filters.map((f) => ({ BANK_CD: f.bankCd, ACCT_NO: f.acctNo })));
}
