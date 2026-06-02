# Payroll > Payment Result — Web (Refactor)

**Module:** Payment → Payroll · **Screen:** Payment Result
**Route:** `/payment/payroll/payment-result` · **JEX:** `pymn_0006_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Executed payroll results with status filter (Incomplete / Processing / Success / Failed).

## Route/Page
- `app/(dashboard)/payment/payroll/payment-result/page.tsx` → `components/payment/payroll/`.

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
- `GET /api/v1/payment/payroll/results` (+ `/{id}` detail). snake_case wire ↔ camelCase mappers.

## Validation
- filter params validated client-side.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment.md](./scheduled-payment.md) · [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: payment-result.md _(wecms-api backend repo — not included in this clone)_
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_
