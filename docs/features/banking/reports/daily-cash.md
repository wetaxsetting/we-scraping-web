# Banking > Daily Cash — Frontend Page Design

> **This one-pager is the short page-mapping entry. The full frontend feature package lives in
> [`daily-cash/`](daily-cash/)** — README, screen-flow, ui-specification, component-index,
> api-consumption, test-scenarios. Read the package for anything beyond the identity snapshot below.
>
> **Updated 2026-06-04.** The earlier stub left the grid columns as "Confirm exact grid against the API
> + JEX" and predated the UI rework. The grid, summary, removed Cash table, and removed checkbox column
> are now documented precisely in [`daily-cash/ui-specification.md`](daily-cash/ui-specification.md).

**Module:** Banking → Reports · **Menu:** Daily Cash
**Route:** `/banking/reports/daily-cash` · **Runtime slug:** `daily-cash-report`
**JEX twin:** `rept_0009_001`.

## Overview

Daily cash-position report: pick an as-of date and currency scope (All / FCY / VND), click **Search**,
and see per-currency summary blocks plus two account ledgers — **Current Accounts** (`acct_type_cd`
03/04) and **Savings Accounts** (05/06) — each with 8 columns (Bank · Account No. · Currency · No. of
Debits · Debit · No. of Credits · Credit · Balance). Single as-of date, no pagination (report page per
`wecms-web/CLAUDE.md` §7b). Excel + print export via `lib/dailyCashExport.ts`.

- API side: in the separate `wecms-api` backend repo.

## Page Location

`app/(dashboard)/banking/reports/daily-cash/page.tsx` (server) → `DailyCashClient` (state + fetch) →
`DailyCashPage` (presentation). See [`daily-cash/component-index.md`](daily-cash/component-index.md).

## API Integration

`GET /api/v1/banking/reports/daily-cash-report` (slug `daily-cash-report`); snake_case wire mapped to
camelCase locally in `DailyCashClient`. See [`daily-cash/api-consumption.md`](daily-cash/api-consumption.md).

## Notes

- **No checkbox column** and **no physical-cash "Cash" table** (Redmine #42096) — both removed.
- View Setting is **not** adopted on this report page.
- Drill-down to per-transaction detail lives in **Daily Financial** ([daily-financial.md](daily-financial.md)).
