# Internal Transfer > Transfer Result — Web (Refactor)

**Module:** Payment → Internal Transfer · **Screen:** Transfer Result
**Route:** `/payment/internal-transfer/transfer-result` · **JEX:** `pymn_0010_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Executed internal transfer results with status filter (Incomplete / Processing / Success / Failed).

## Route/Page
- `app/(dashboard)/payment/internal-transfer/transfer-result/page.tsx` → `components/payment/internal-transfer/`.

## Components
- Result list table, status badges (mirrors `components/payment/internal-transfer/`).

## Filters
- Date range, result status (Completed / In Progress / Success / Failed).

## Table Columns
- payee · amount · result status · executed date · result message. *(Confirm against the shipped table.)*

## Sorting
- Sortable headers via View Setting FIELD_ID (shared payment sort whitelist).

## Pagination
- Server-side `page`/`size` (payment-module pagination rule — all 5 families).

## Dialogs/Popups
- Result detail dialog.

## API Integration
- `GET /api/v1/payment/internal-transfer/results` (+ `/{id}` detail). snake_case wire ↔ camelCase mappers.

## Validation
- filter params validated client-side.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-transfer.md](./scheduled-transfer.md) · [scheduled-transfer-details.md](./scheduled-transfer-details.md) · [transfer-result-details.md](./transfer-result-details.md)
- API counterpart: transfer-result.md _(wecms-api backend repo — not included in this clone)_
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_
