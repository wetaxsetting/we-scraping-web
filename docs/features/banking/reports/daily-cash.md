# Banking > Daily Cash — Frontend Page Design

**Module:** Banking → Reports · **Menu:** Daily Cash
**Route:** `/banking/reports/daily-cash` · **Runtime slug:** `daily-cash-report` (file renamed to match the menu)
**JEX twin:** `rept_0009_001` (per the API doc's citation).

- API side: [`../../../../wecms-api/docs/features/banking/daily-cash.md`](daily-cash.md)

## Overview
Daily cash-position report: pick an as-of date and currency scope, see the multi-bank / multi-account
cash position grid. Single as-of date (no multi-day range), matching JEX.

## Page Location
`app/(dashboard)/banking/reports/daily-cash/page.tsx` (Next.js `(dashboard)` group).

## UI Components
- Filter form: **as-of date** input + **currency radio** (All / FCY / VND); cash-position grid; (likely) Excel export.

## User Actions
- Select as-of date + currency → Search → view the cash position grid; export.

## Table Columns
Bank / account rows × cash-position columns (balances aggregated per bank/account). *(Confirm exact grid against the API doc + JEX `rept_0009_001`.)*

## Dialogs / Popups
- None primary (report grid). Confirm if a detail drill-down exists.

## API Integration
- `GET /api/v1/banking/reports/daily-cash-report`. snake_case wire ↔ camelCase mappers.

## Validation
- As-of date required; currency one of All/FCY/VND.

## Notes
Drill-down to per-transaction detail lives in **Daily Financial** ([daily-financial.md](daily-financial.md)).
