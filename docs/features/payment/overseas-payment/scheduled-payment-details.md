# Overseas Payment > Scheduled Payment Details — Web (Refactor)

**Module:** Payment → Overseas Payment · **Screen:** Scheduled Payment Details
**Route:** `/payment/overseas-payment/scheduled-payment` → row → detail view · **JEX:** `pymn_0007_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Drill-down detail of one scheduled payment batch/row — line items, amounts, withdrawal account, and the approver chain.

## Route/Page
- `app/(dashboard)/payment/overseas-payment/scheduled-payment/page.tsx` → `components/payment/overseas-payment/`. Detail via row click → detail panel/route.

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
- `GET/POST /api/v1/payment/overseas-payment` (+ `/{id}` detail). snake_case wire ↔ camelCase mappers.

## Validation
- Excel rows validated per-row; required fields mirrored from server.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment.md](./scheduled-payment.md) · [payment-result.md](./payment-result.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: [scheduled-payment-details.md](../../../../../wecms-api/docs/features/payment/overseas-payment/scheduled-payment-details.md)
- Cross-sibling index: [_payment-module-overview.md](../../../../../wecms-api/docs/features/payment/_payment-module-overview.md)
- JEX reference: [screen-flows/payments.md](../../../../../docs/jex/screen-flows/payments.md) · [business-rules/payment.md](../../../../../docs/jex/business-rules/payment.md)
