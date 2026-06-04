# Banking > Daily Financial — Frontend Page Design (one-page stub)

> **Superseded — see the full package.** Implementation-accurate frontend docs now live in
> [`daily-financial/`](daily-financial/README.md) (README · screen-flow · ui-specification ·
> component-index · api-consumption · test-scenarios). This stub is kept as the short index entry;
> when it disagrees with the package, **the package wins**. Two drifts the stub carried are corrected
> below: the slug is **`daily-financial`** (not `daily-financial-report`), and the refactor
> **live-computes** from operational tables (Strategy B) — it does **not** consume materialized
> summary tables.

**Module:** Banking → Reports · **Menu:** Daily Financial (CMC) + Daily Financial HS (HAENGSUNG)
**Route:** `/banking/reports/daily-financial` (CMC) · `/banking/reports/daily-financial-hs` (HS)
**Slug:** `daily-financial` · **JEX twin:** `rept_0015_001` (CMC) · `rept_0017_001` (HS).

- API side: separate `wecms-api` backend repo — see [wecms-api/docs/features/banking/reports/daily-financial/](../../../../../wecms-api/docs/features/banking/reports/daily-financial/README.md).

## Overview
Daily financial as-of snapshot with per-currency Financial Status + Current/Saving account ledgers,
and a per-account transaction-history drill-down popup. The CMC report is **search-gated** (renders
after Search). Data is **live-computed** by the backend from `ACCT_TRNS_HSTR` / `ACCT_TRNS_RCV_PAY_INFM`
/ `ACCT_MSTR` (the materialized summary tables + nightly recompute are out of PROD scope, not consumed).

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
- `GET /api/v1/banking/reports/daily-financial` (+ `/transactions`, `/daily-financial-hs`). UPPER_SNAKE wire holdovers ↔ camelCase mappers. Full mapping: [daily-financial/api-consumption.md](daily-financial/api-consumption.md).

## Validation
- As-of date required (`REF_DATE`); currency + option checkboxes.

## Notes
Refactor reads summary tables only; the nightly recompute (`d001`/`c002`) migrates separately.
