# Daily Financial — Screen Flow

Frontend route → component composition and the runtime navigation flow for both variants.
Backend orchestration is documented in
[wecms-api/.../daily-financial/business-flow.md](../../../../../../wecms-api/docs/features/banking/reports/daily-financial/business-flow.md).

## 1. Routes → page components

| Route | Page file | Renders | Sidebar |
|---|---|---|---|
| `/banking/reports/daily-financial` (CMC) | [app/(dashboard)/banking/reports/daily-financial/page.tsx](../../../../../app/(dashboard)/banking/reports/daily-financial/page.tsx) | `<DailyFinancialClient />` | always shown |
| `/banking/reports/daily-financial-hs` (HS) | [app/(dashboard)/banking/reports/daily-financial-hs/page.tsx](../../../../../app/(dashboard)/banking/reports/daily-financial-hs/page.tsx) | `<DailyFinancialHsClient />` | gated on `BUSI_INFM.PRDT_TYPE = "H"` (`showDailyFinancialHs` in [Sidebar.tsx](../../../../../components/layout/Sidebar.tsx)) |

Both page files are thin server components (set `metadata`, compose the client wrapper) per the
page-responsibility rule.

## 2. CMC variant — search-gated flow (legacy `rept_0015_001` parity)

```
/banking/reports/daily-financial
  └─ DailyFinancialClient  (client wrapper — owns filter state + fetch)
       state: scope (ALL|VND|FCY) · activeOnly=true · includeInternalTransfers=true
              · asOfIsoDate=today · hasSearched=false · searchKey
       │
       ├─ initial render → hasSearched=false
       │     DailyFinancialPage shows: <PageHeader> + <FilterRow> + centered empty placeholder
       │     ("Please click the Search button." — report.daily_financial.empty_message)
       │     NO fetch fires (useApiData loader resolves undefined until hasSearched)
       │
       └─ user clicks Search → hasSearched=true, bumps searchKey
             fetchDailyFinancial({ asOf, currencyScope, activeAccountsOnly, includeInternalTransfers })
             → maps FINANCIAL_STATUS (mapFinancialStatus) + CURRENT_ACCOUNTS (mapCurrentAccountRow)
             → DailyFinancialPage renders the report body inside <ReportLayout sectioned>:
                  • sticky title card ("Daily Financial" + "As of <DD-MMM-YYYY> Currency: <scope>")
                  • one <FinancialStatusTable> per visible currency
                  • <CurrentAccountsTable> for Current Accounts (acct type 03/04/07)
                  • <CurrentAccountsTable> for Saving Accounts (acct type 05/06/08)
```

**Auto-refetch parity:** after the first Search, changing any filter (`scope`, `activeOnly`,
`includeInternalTransfers`, `asOf`) re-fires the fetch via `bumpIfSearched` — mirrors the legacy
`fn_loadData` reset.

### Detail popup navigation (CMC only)

```
Current/Saving ledger row  →  click Bank / Account No. / Nickname cell (<CellLink>)
  └─ opens <TransactionHistoryDialog> (shadcn <Dialog> stackLevel={2}, w-[1024px])
       fetchDailyFinancialTransactions({ asOf, bankCd, acctNo, includeInternalTransfers, page, size })
       → table: Time · Debit · Credit · Balance · Remarks
       → footer summary: "Total {N} transaction(s) / Total Debit … Total Credit … Balance …"
       → own pagination (default size 10; options 10/20/50/100; dropdown opens upward)
       close: X / outside-click → returns to the report (filters preserved, URL stable)
```

> The popup is the **only** drill-down. The legacy inline per-account transaction grid (REC2_1) and
> the receipt/payment (`rept_0015_003`) + cash-book (`rept_0015_004`) detail popups are **not ported**
> (deferred / out of scope — see the backend gap analysis).

## 3. HS variant — eager flow (HAENGSUNG `rept_0017_001`)

```
/banking/reports/daily-financial-hs
  └─ DailyFinancialHsClient  (calls fetchDailyFinancialHs() on mount via useApiData — NO Search gate)
       │   projects flat ROWS (DETAIL/SUBTOTAL/TOTAL) → grouped BankGroup[] via projectHsRows
       │   backend is LIVE (fn_get_haengsung_daily_financial_report, since 2026-06-14) → data.ROWS present; the HS client has **no** mock fallback (empty state on no data)
       └─ DailyFinancialHsPage renders <ReportLayout> wrapping <LedgerTable> (bank-grouped, rowSpan)
             header: title + (list icon · Download Excel) in <PageHeader>
             filters: As-of date chip (STATIC 08-09-2025) + account dropdown (STATIC) + Search (no handler)
```

> HS has **no empty state, no Financial Status section, no currency-scope toggle** — copying any of
> those from CMC is a bug (CLAUDE.md §7c). HS filters are non-functional in the current static UI.

## 4. Shared layout chain (both variants)

```
AppShell (h-screen)
 └─ <main> flex-1 min-h-0
     └─ PageLayout flex-1 min-h-0 flex-col
         ├─ PageHeader   (shrink-0)
         ├─ FilterRow    (shrink-0)
         └─ ReportLayout (flex-1 min-h-0; single continuous-scroll viewport; pb-3)
             └─ wide ledger tables wrapped in custom-scrollbar-x overflow-x-auto (§7d)
```

No `<Pagination>`, no `<DataTableShell>` on either variant (report-page rule §7b). The popup carries
its own bespoke pagination because it is a dialog, not the report body.
