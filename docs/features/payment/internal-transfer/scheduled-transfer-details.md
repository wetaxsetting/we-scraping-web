# Internal Transfer > Scheduled Transfer Details — Web (Refactor)

**Module:** Payment → Internal Transfer · **Screen:** Scheduled Transfer Details
**Route:** `/payment/internal-transfer/scheduled-transfer` → row → detail view · **JEX:** `pymn_0009_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Drill-down detail of one scheduled transfer batch/row — line items, amounts, withdrawal account, and the approver chain.

## Route/Page
- `app/(dashboard)/payment/internal-transfer/scheduled-transfer/page.tsx` → `components/payment/internal-transfer/`. Detail via row click → detail panel/route.

## Components
- Scheduled list table, Excel-upload dialog, Request-Approval / Transfer buttons, detail panel (line items / beneficiary / approver chain) (mirrors `components/payment/internal-transfer/`).

## Filters
- Date range, keyword, approval status.

## Table Columns
- payee/beneficiary · withdrawal bank · amount · scheduled date · approval status. *(Confirm against the shipped table.)*

## Sorting
- Sortable headers via View Setting FIELD_ID (shared payment sort whitelist).

## Pagination
- Server-side `page`/`size` (payment-module pagination rule — all 5 families).

## Dialogs/Popups
- Excel-upload dialog; request-approval confirm; detail drill-down.

## API Integration
- `GET/POST /api/v1/payment/internal-transfer` (+ `/{id}` detail). snake_case wire ↔ camelCase mappers.

## Validation
- Excel rows validated per-row; required fields mirrored from server.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-transfer.md](./scheduled-transfer.md) · [transfer-result.md](./transfer-result.md) · [transfer-result-details.md](./transfer-result-details.md)
- API counterpart: scheduled-transfer-details.md _(wecms-api backend repo — not included in this clone)_
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_
