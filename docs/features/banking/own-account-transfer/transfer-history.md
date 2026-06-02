# Banking > Transfer History — Frontend Page Design

**Module:** Banking → Internal Transfer · **Menu:** Transfer History
**Route:** `/banking/transfer-history` · **Slug:** `transfer-history`
**Status:** working (backend + frontend landed 2026-05-20).

- API side (hub spec): in the separate `wecms-api` backend repo — not included in this clone.
- Sibling: [own-account-transfer.md](own-account-transfer.md)

## Overview
List of own-account transfer results with status filtering (All / Success / Failed), date range, and
pagination. JEX twin `trns_0003_001`.

## Page Location
`app/(dashboard)/banking/transfer-history/page.tsx` → `components/banking/internal-transfer/TransferHistoryClient.tsx`
+ `TransferHistoryPage.tsx`.

## UI Components
- `TransferHistoryClient` (filter state + fetch), `TransferHistoryPage` (layout + table), status filter (All/Success/Failed), date-range picker, result table, pagination.

## User Actions
- Filter by status / date range; page/sort; view a transfer result row.

## Table Columns
Transfer date/time · from account · to account · amount · status (success/failed) · result message. *(Confirm against the shipped table + JEX `trns_0003_001`.)*

## Dialogs / Popups
- Row detail (if present). Confirm against shipped UI.

## API Integration
- `GET /api/v1/banking/internal-transfer/transfer-history` (the working endpoint; a Sprint-1 interim `/api/v1/banking/transfers/history` also exists — see API hub). snake_case wire ↔ camelCase mappers.

## Validation
- Date range `from ≤ to`; status constrained to All/Success/Failed.

## Notes
Full field-by-field and backend detail live in the API hub (status *working*, 2026-05-20).
