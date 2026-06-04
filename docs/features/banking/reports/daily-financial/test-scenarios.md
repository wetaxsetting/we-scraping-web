# Daily Financial — Frontend Test Scenarios (SIT / UAT)

Frontend-facing scenarios for both variants. Pairs with the backend
[test-scenarios.md](../../../../../../wecms-api/docs/features/banking/reports/daily-financial/test-scenarios.md)
(service-level parity cases). Status legend: ✅ expected to pass · ⚠️ known limitation / deferred.

## 1. Search (CMC)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| S-1 | Initial empty state | Open `/banking/reports/daily-financial` | ✅ Filters + centered "Please click the Search button." placeholder; **no** network call fires |
| S-2 | Valid search (today) | Click Search | ✅ `GET …/daily-financial?asOf=<today>&currencyScope=ALL&activeAccountsOnly=true&includeInternalTransfers=true` → report renders (Financial Status + Current + Saving) |
| S-3 | Valid search (past date) | Pick an As-of date with data → Search | ✅ Balances + day debit/credit reflect the chosen date (as-of end-of-day balance) |
| S-4 | No-data date | Pick a date with no transactions → Search | ✅ Ledger shows `common.no_rows`; balances fall back to `ACCT_MSTR.BAL`; Financial Status totals still render |
| S-5 | Auto-refetch on filter change | After S-2, change currency / date / a checkbox | ✅ Fetch re-fires automatically (`bumpIfSearched`), no second Search click needed |
| S-6 | Search button disabled while loading | Click Search, observe button | ✅ `disabled={loading}` prevents double-submit |

## 2. Financial data verification (CMC)

| # | Scenario | Expected |
|---|---|---|
| F-1 | Debit verification | ✅ `No. of Debits` / `Debit` per account row match the day's `INOUT_DV="2"` aggregates |
| F-2 | Credit verification | ✅ `No. of Credits` / `Credit` match `INOUT_DV="1"` aggregates |
| F-3 | Balance verification | ✅ `Balance` = latest `ACCT_TRNS_HSTR.BAL ≤ asOf`; `ACCT_MSTR.BAL` fallback when no history |
| F-4 | Financial Status total | ✅ per-currency `Total = Current + Saving`; matches the sum of the ledger Total rows |
| F-5 | Internal columns split | ✅ internal vs external debit/credit are disjoint (usage-code classification) |
| F-6 | Account-type partition | ✅ accounts `03/04/07` in Current, `05/06/08` in Saving, others in neither |

## 3. Currency handling (CMC)

| # | Scenario | Expected |
|---|---|---|
| C-1 | VND scope | Currency = VND → ✅ only VND accounts + only the VND Financial Status section; `₫` suffix |
| C-2 | FCY scope | Currency = FCY → ✅ every non-VND currency (USD, KRW, …); VND excluded |
| C-3 | USD formatting | ✅ USD amounts use en-US prefix formatting |
| C-4 | KRW section | ✅ KRW current/saving accounts surface their **own** KRW Financial Status section with `₩` (not folded into VND) |
| C-5 | All scope multi-currency | Currency = All → ✅ one Financial Status section per currency present in the data |

## 4. Detail popup (CMC)

| # | Scenario | Expected |
|---|---|---|
| P-1 | Open popup | Click a Bank/Account/Nickname cell | ✅ `<TransactionHistoryDialog>` opens; fetches `…/transactions`; Time·Debit·Credit·Balance·Remarks |
| P-2 | Debit/Credit binding | ✅ `inOutDiv="2"` fills Debit, `"1"` fills Credit |
| P-3 | Blank time | ✅ rows with empty `TRSC_TM` show a blank Time cell (by design — not a defect) |
| P-4 | Pagination | ✅ default size 10; options 10/20/50/100; dropdown opens upward; page-1 reset on size change |
| P-5 | Footer summary | ✅ "Total {N} transaction(s) / Total Debit … Total Credit … Balance …" |
| P-6 | Empty day | ✅ `tx_dialog.empty` centered row |
| P-7 | Fetch error | ⚠️ currently falls back to an empty zeroed table (no error dialog) — flagged limitation |

## 5. Export

| # | Scenario | Expected |
|---|---|---|
| E-1 | CMC export with data | Search → Excel | ✅ `DailyFinancial_<DDMMYYYY>.xlsx`; merged title, as-of subheader, per-currency Financial Status, ledger sections + Total footers; honors nickname + internal toggles |
| E-2 | CMC export honors filters | Toggle nickname/internal off → Excel | ✅ exported columns mirror the on-screen state |
| E-3 | CMC print | Print | ✅ `printReport` multi-section popup |
| E-4 | HS export | HS → Download Excel | ✅ `DailyFinancialHS_<DDMMYYYY>.xlsx`, sheet "Daily Financial HS", inline Sub Total / TOTAL |
| E-5 | Export source | — | ⚠️ both variants export **client-side** (`xlsx-js-style`), not via a backend `/export` endpoint (interim §13b divergence) — verify column parity manually against the on-screen grid |

## 6. Permissions

| # | Scenario | Expected |
|---|---|---|
| A-1 | Authorized user | Logged-in tenant user opens the report | ✅ data scoped to `BIZ_KEY` from the JWT (`TenantContext`) |
| A-2 | Unauthenticated | Token missing/expired | ✅ `lib/axios.ts` 401 interceptor → global session-expired re-auth; route guard redirects to `/login` |
| A-3 | HS visibility | non-`PRDT_TYPE="H"` tenant | ✅ HS sidebar entry hidden (`showDailyFinancialHs`); CMC always available |

## 7. HS variant (current static-UI limitations)

| # | Scenario | Expected |
|---|---|---|
| H-1 | Eager render | Open `/banking/reports/daily-financial-hs` | ✅ ledger renders immediately (no Search gate) |
| H-2 | Static filters | Change date / account dropdown / click Search | ⚠️ **no effect** — filters are inert in the static UI; backend is a stub |
| H-3 | Data source | — | ⚠️ renders `mockLedgerGroups` (backend `dailyFinancialHs` is a fixed 6-row seed, not the real `rept_0017_001` ledger) |

> **Cross-system note:** a separate JEX-system bug exists for the HAENGSUNG report's account-type
> label ([BUG-001](../../../../../../docs/bug-reports/BUG-001_haengsung_daily_financial_wrong_account_type_label.md)) —
> relevant to the HS variant, tracked independently of this refactor package.
