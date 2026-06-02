# Internal Transfer > Scheduled Transfer — Web (Refactor)

**Module:** Payment → Internal Transfer · **Screen:** Scheduled Transfer
**Route:** `/payment/internal-transfer/scheduled-transfer` · **JEX:** `pymn_0009_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
List + create scheduled internal transfer batches (Excel upload, request approval, transfer).

## Route/Page
- `app/(dashboard)/payment/internal-transfer/scheduled-transfer/page.tsx` → `components/payment/internal-transfer/`.

## Components
- Scheduled list table, Excel-upload dialog, Request-Approval / Transfer buttons (mirrors `components/payment/internal-transfer/`).

## Filters
- Date range, keyword, approval status.

## Table Columns
- payee/beneficiary · withdrawal bank · amount · scheduled date · approval status. *(Confirm against the shipped table.)*

## Sorting
- Sortable headers via View Setting FIELD_ID (shared payment sort whitelist).

## Pagination
- Server-side `page`/`size` (payment-module pagination rule — all 5 families).

## Dialogs/Popups
- Excel-upload dialog; request-approval confirm.

## API Integration
- `GET/POST /api/v1/payment/internal-transfer` (+ `/{id}` detail). snake_case wire ↔ camelCase mappers.

## Validation
- Excel rows validated per-row; required fields mirrored from server.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-transfer-details.md](./scheduled-transfer-details.md) · [transfer-result.md](./transfer-result.md) · [transfer-result-details.md](./transfer-result-details.md)
- API counterpart: scheduled-transfer.md _(wecms-api backend repo — not included in this clone)_
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_
