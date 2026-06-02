# Banking > Cash Flow — Frontend Page Design

**Module:** Banking → Reports · **Menu:** Cash Flow
**Route:** `/banking/reports/cash-flow` · **Runtime slug:** `cash-flow-report` (file renamed to match the menu)
**JEX twin:** `cash_0001_001` (per the API doc's citation).

- API side: in the separate `wecms-api` backend repo — not included in this clone.

## Overview
Monthly cash-flow report: pick year / currency / bank, see a monthly grid of cash-in / cash-out by
category, with Excel download. Empty-state until first Search (per CLAUDE.md §7b).

## Page Location
`app/(dashboard)/banking/reports/cash-flow/page.tsx` (thin shell) → `components/banking/reports/cash-flow/CashFlowClient.tsx`.

## UI Components
- `CashFlowClient` (filter state, `fetchCashFlow()` via `useApiData`, Excel via `exportExcel()`)
- `CashFlowPage` (empty-state placeholder → `<ReportLayout>` + `<CashFlowMatrix>`)
- `CashFlowMatrix` (monthly grid; quarter selection hides month columns client-side; 7 `row_type` variants)
- `types.ts` (`MONTH_KEYS`, `monthIndicesForQuarter`)

## User Actions
- Select year / currency / bank (+ optional quarter) → Search → view monthly matrix; **Download Excel**.

## Table Columns
Category rows × 12 month columns (cash-in / cash-out / net), with quarter roll-up. Row styling per the 7 `row_type` values. *(Confirm against the API doc + JEX `cash_0001_001`.)*

## Dialogs / Popups
- None (matrix + download).

## API Integration
- `GET /api/v1/banking/reports/cash-flow-report` + `POST .../export` (already shipped — stub seed data). snake_case wire ↔ camelCase mappers.

## Validation
- Year + currency required; quarter optional (client-side column hiding).

## Notes
Backend aggregates five sources (`ACCT_TRNS_HSTR`+`ACCT_TRNS_RCV_PAY_INFM`, `CARD_TRNS_HSTR`, `OVRS_PYMN_MSTR`, `EXPT_RESOL_MSTR`, `SCDUL_PYMN_SUMR`) — see the API hub.
