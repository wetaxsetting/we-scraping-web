# Payroll > Scheduled Payment — Web (Refactor)

**Module:** Payment → Payroll · **Screen:** Scheduled Payment
**Route:** `/payment/payroll/scheduled-payment` · **JEX:** `pymn_0005_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
List + create scheduled payroll batches (Excel upload, request approval, transfer).

## Route/Page
- `app/(dashboard)/payment/payroll/scheduled-payment/page.tsx` → `components/payment/payroll/`.

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
- `GET/POST /api/v1/payment/payroll` (+ `/{id}` detail). snake_case wire ↔ camelCase mappers.

## Validation
- Excel rows validated per-row; required fields mirrored from server.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result.md](./payment-result.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: scheduled-payment.md _(wecms-api backend repo — not included in this clone)_
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_
