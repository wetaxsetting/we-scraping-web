# Daily Cash — Frontend Test Scenarios (SIT / UAT)

Realistic scenarios for the Daily Cash report page. Pair with the backend
[wecms-api/…/test-scenarios.md](../../../../../../wecms-api/docs/features/banking/reports/daily-cash/test-scenarios.md)
for end-to-end parity coverage. Tenant: `VN_VNM0004_000001` (R&D seed).

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| **F-1** | Load page | Navigate to `/banking/reports/daily-cash` | Filter row renders (Search, As-of=today DD-MM-YYYY, scope=All Currency). **No** summary, grids, or export buttons before first Search. |
| **F-2** | Search by date | Pick an as-of date with data → click **Search** | Single `GET …/daily-cash-report?asOfDate=&currency=ALL`; summary blocks + Current/Savings grids populate; Print/Excel buttons appear. |
| **F-3** | Date change without Search | Change As-of date, do **not** click Search | No refetch; previous results stay until Search is clicked. |
| **F-4** | Verify summary values | After F-2, read each `"<CCY> Total : …"` heading | Heading total = cash+current+savings+timeDeposit+loan (cash always 0); Current = `total_demand_deposit`, Saving = `total_savings`; numbers match the backend `currency_summary`. |
| **F-5** | Verify Current Accounts | Inspect Current Accounts grid | Only `acct_type_cd` 03/04 rows; 8 columns (Bank, Account No., Currency, No. of Debits, Debit, No. of Credits, Credit, Balance); Balance bold; numeric columns right-aligned. |
| **F-6** | Verify Savings Accounts | Inspect Savings Accounts grid | Only 05/06 rows; same 8 columns; loans (01) / term (02) / 07-08 absent from both grids. |
| **F-7** | Multi-currency display | Search a date with VND + USD (+ KRW) accounts | One summary section per currency, ordered VND → USD → KRW → others; each grid groups its rows; currency column shows the right code. |
| **F-8** | Currency scope filter | After search, switch scope to **FCY**, then **VND** | Scope change auto-refetches; FCY excludes VND rows; VND shows only VND rows. |
| **F-9** | Zero-data behavior | Search a date with no accounts | Summary renders zero rows for VND/USD/KRW (`Total : 0`); each grid shows one centered `common.no_rows` row (colSpan 8); **no fabricated detail rows**. |
| **F-10** | Export Excel | After a search with data, click **Excel** | Downloads `Daily Cash_<YYYYMMDDhhmm>.xlsx`; per-currency `● Total` band + Current/(Saving) ledgers with per-currency totals; amounts formatted `#,##0` (VND/KRW) / `#,##0.00` (USD). |
| **F-11** | Print | Click **Print** | A4-landscape print preview with title, As-of/Currency meta, per-currency summary + ledger tables; no live-page chrome. |
| **F-12** | No checkbox / no Cash table | Inspect both grids and the summary | No selection checkbox column anywhere; no physical-cash "Cash" table section (Redmine #42096). |
| **F-13** | Loading state | Trigger a slow Search / scope change | Search, Print, Excel buttons disabled while the fetch is in flight. |
| **F-14** | Permissions | Log in as a user without Daily Cash menu entitlement | Sidebar entry hidden / route guarded per the global menu-entitlement model (backend authority; not a page-local check). |
| **F-15** | Session expiry | Let the JWT expire, then click Search | `401` triggers the global session-expired re-auth dialog (Axios interceptor); no partial render. |

> **Notes.** (1) Ledger Debit/Credit/Balance cells render raw values on screen (no thousands-separators) —
> only summary + exports run through `formatAmount`; do not fail F-5/F-6 on that until the formatting
> follow-up lands. (2) View Setting is **not** adopted on this report — there is no column-visibility
> popover to test.
