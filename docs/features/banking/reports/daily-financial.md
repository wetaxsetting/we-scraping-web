# Banking > Daily Financial — Frontend Page Design

**Module:** Banking → Reports · **Menu:** Daily Financial
**Route:** `/banking/reports/daily-financial` · **Runtime slug:** `daily-financial-report` (file renamed to match the menu)
**JEX twin:** `rept_0015_001` (per the API doc's citation).

- API side: [`../../../../wecms-api/docs/features/banking/daily-financial.md`](daily-financial.md)

## Overview
Daily financial summary with account-level detail for a chosen as-of date and currency. The refactor
consumes the materialized summary tables (nightly recompute is a separate feature).

## Page Location
`app/(dashboard)/banking/reports/daily-financial/page.tsx`.

## UI Components
- Filter form: **as-of date** input + **currency** + two checkboxes (per JEX `rept_0015_001_view.jsp`); account-level detail grid.

## User Actions
- Select as-of date / currency / options → Search → view account-level financial detail; export.

## Table Columns
Account-level detail rows (per-account financial summary columns). *(Confirm exact set against the API doc + JEX `rept_0015_001`.)*

## Dialogs / Popups
- None primary. Confirm drill-down behavior.

## API Integration
- `GET /api/v1/reports/daily-financial`. snake_case wire ↔ camelCase mappers.

## Validation
- As-of date required (`REF_DATE`); currency + option checkboxes.

## Notes
Refactor reads summary tables only; the nightly recompute (`d001`/`c002`) migrates separately.
