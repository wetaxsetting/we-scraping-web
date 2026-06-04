# Daily Cash — UI Specification (Frontend)

Source: `components/banking/reports/daily-cash/DailyCashPage.tsx` (+ shared
`components/shared/*`). Typography follows the workspace [`CLAUDE.md`](../../../../../../CLAUDE.md)
§"Global Typography" tokens; no ad-hoc font sizes.

---

## 1. Page layout

`<PageLayout>` → `<PageHeader title={t("report.daily_cash.title")} />` → `<FilterRow>` → export-button row
→ `<ReportLayout sectioned>` (single continuous-scroll container, `gap-6` section stack). No action toolbar
in the header; Print / Excel live below the filter row.

---

## 2. Filter row (search area)

| Element | Component | Notes |
|---|---|---|
| **Search button** | shadcn `<Button variant="outline">` + lucide `Search` icon + `t("common.search")` | Right slot of `<FilterRow>`; height `var(--h-wb-filter-btn)`; `disabled={loading}`. This is the only "run" trigger. |
| **As-of label** | `<span>{t("report.as_of")}</span>` | — |
| **As-of date** | shared `<DateField value={asOfIsoDate} onChange={…} formatValue={formatDmyChip} />` | Single-date picker; chip shows `DD-MM-YYYY`. Default = today. Changing it does **not** refetch (press Search). |
| **Currency scope** | `<CurrencyScopeToggle value={scope} onChange={setScope} />` | Radio group rendered **All Currency / FCY / VND** (`CurrencyScopeToggle.tsx`), brand-blue dot on active. After first search, changing scope auto-refetches. |

There is **no free-text search input** — the right slot is the Search button, not a `<SearchInput>`.

---

## 3. Summary area (per-currency status)

The summary is **one `<ReportSection>` per currency**, not a single Debit/Credit/Balance triple.

- Each section is titled `"<CCY> Total : <amount>"` where the amount = `cash + current + savings +
  timeDeposit + loan` computed client-side (`currencyTotal(row)`), formatted via `formatAmount(...)` with
  the currency symbol.
- The section body is a **two-column table — Current Accounts / Saving Accounts** (`SummaryTable`), both
  values right-aligned, one value row. `cash / timeDeposit / loan` columns are **hidden** (the legacy VN
  Cash table is commented out — Redmine #42096; `cash` always resolves to `"0"` because the cash source
  `cash_repy_mstr` is not ported).
- **Source of the numbers:** backend `currency_summary` mapped by `toSummaryRow`
  (`current = total_demand_deposit`, `savings = total_savings`); when the backend ships an empty
  `currency_summary`, a **client-side `rollupSummary(accounts)`** fallback groups accounts by
  `currency_cd` and sums `balance` into `current` (03/04) / `savings` (05/06).
- **Ordering:** VND → USD → KRW → others alphabetically (`compareCurrency` / `CURRENCY_PRIORITY`).
- **Zero-data fallback:** if there are no summary rows after search, the block renders zero rows for
  `VND / USD / KRW` so a `Total : 0` always shows. Detail ledgers are **not** fabricated.

> **Recalculation logic.** The per-currency heading total and the Current/Saving split are recomputed on
> the client from the mapped summary rows on every render (`useMemo` keyed on `data`). When the backend
> summary is present it is authoritative; the client rollup is only a fallback for an empty summary tier.

---

## 4. Account tables

Two grids, both rendered by the shared `AccountLedger` component, each wrapped in a `<ReportSection>`:

- **Current Accounts** — `t("report.daily_cash.section.current_accounts")`, rows where
  `acct_type_cd ∈ {"03","04"}`.
- **Savings Accounts** — `t("report.daily_cash.section.savings_accounts")`, rows where
  `acct_type_cd ∈ {"05","06"}`.
- Loan (`01`), term deposit (`02`), and `07`/`08` appear in **neither** grid (legacy parity).

### Columns (identical for BOTH grids)

8 columns via an explicit `<colgroup>` (widths 18 / 16 / 10 / 10 / 12 / 10 / 12 / 12 %):

| # | Column (i18n) | Align | Body source |
|---|---|---|---|
| 1 | Bank (`…col.bank`) | left | `row.bank` (= `bank_nm \|\| bank_cd`) |
| 2 | Account No. (`…col.account_no`) | left | `row.accountNo` |
| 3 | Currency (`…col.currency`) | left | `row.currency` |
| 4 | No. of Debits (`…col.num_debits`) | right | `row.numDebits` (= `send_count`) |
| 5 | Debit (`…col.debit`) | right | `row.debit` (= `send_amount`) |
| 6 | No. of Credits (`…col.num_credits`) | right | `row.numCredits` (= `receive_count`) |
| 7 | Credit (`…col.credit`) | right | `row.credit` (= `receive_amount`) |
| 8 | Balance (`…col.balance`) | right, **bold** | `row.balance` |

- **Header:** `<TableHeaderCell>`; text columns left, numeric columns right (`align="right"`).
- **Cells:** `CellLeft` = `text-wb-13 font-medium` (truncated); `CellRight` = `text-wb-13`,
  `font-semibold` for the Balance column.
- **Empty state:** `rows.length === 0` → single centered row, `colSpan={8}`, `t("common.no_rows")`.
- **Pagination:** **none** — report page renders all rows in a continuous-scroll `<ReportLayout sectioned>`.

> **Cell value formatting note.** Debit/Credit/Balance ledger cells render the raw mapped string
> (`toAccountRow` does `String(...)`, no `formatAmount`). Only the **summary tables** and the **Excel/Print
> exports** run values through `formatAmount`. If on-screen ledger thousands-separators are desired, that is
> a known formatting follow-up (backend [fix-plan.md #3](../../../../../../wecms-api/docs/features/banking/reports/daily-cash/fix-plan.md)).

---

## 5. Removed legacy functionality (verified)

| Removed element | Evidence | Current state |
|---|---|---|
| **Cash table** (physical-cash holdings) | `DailyCashClient.tsx` + `DailyCashPage.tsx` doc comments cite Redmine #42096 ("legacy VN view's Cash table is commented out … NOT rendered here") | UI fully gone. **Dead remnants remain**: `DailyCashHoldingRow` type, `mockCashRows`, the always-zero `cash` summary field, and API-layer `ApiDailyCashHoldingRow` / `HOLDINGS` / `mapDailyCashHoldingRow` (orphaned). See [component-index.md](component-index.md). |
| **Per-row checkbox column** | No `Checkbox` import / `CHECKBOX` field anywhere in the three daily-cash component files; `AccountLedger` prepends no selection cell | Fully gone — neither grid has a selection column. |
| **Mock data seed** | `DailyCashPage.tsx` comment: "Sprint 1 stabilization removed the mock seed; API is the single source of truth" | `mockData.ts` defined but never imported (dead file). |

---

## 6. Export (UI)

Print + Excel icon row (`/assets/common/ico-print.svg`, `ico-excel.svg`), shown only after Search,
right-aligned, `disabled={loading}`:

- **Excel** — `xlsx-js-style` 10-column styled sheet (title, As-of/Currency meta, per-currency
  `● Total <CCY>` band + Current/Saving mini-table, then Current + (conditional) Saving ledgers with
  per-currency `Total (<CCY>)` footers). Number formats `#,##0` (VND/KRW) vs `#,##0.00` (USD/EUR).
- **Print** — standalone A4-landscape HTML printed via a hidden iframe; same structure, escaped strings.

> **Backend parity note.** This frontend export bypasses the wired backend single-producer endpoint
> (`POST /api/v1/banking/reports/daily-cash-report/export` + `DailyCashReportExportProvider`). Routing the
> export through the backend is the open technical-debt item (backend gap #2 / fix-plan #4); the on-screen
> output is byte-aligned to the legacy `rept_0009_001` Excel either way.
