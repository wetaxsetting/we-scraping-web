# Vendor Payment > Scheduled Payment — Web (Refactor)

**Module:** Payment → Vendor Payment · **Screen:** Scheduled Payment
**Route:** `/payment/vendor-payment/scheduled-payment` · **JEX:** `pymn_0001_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
List + create scheduled vendor payment batches (Excel upload, request approval, transfer).

## Route/Page
- `app/(dashboard)/payment/vendor-payment/scheduled-payment/page.tsx` → `components/payment/vendor-payment/`.

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
- `GET/POST /api/v1/payment/vendor-payment` (+ `/{id}` detail). snake_case wire ↔ camelCase mappers.

## Validation
- Excel rows validated per-row; required fields mirrored from server.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result.md](./payment-result.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: [scheduled-payment.md](../../../../../wecms-api/docs/features/payment/vendor-payment/scheduled-payment.md)
- Cross-sibling index: [_payment-module-overview.md](../../../../../wecms-api/docs/features/payment/_payment-module-overview.md)
- JEX reference: [screen-flows/payments.md](../../../../../docs/jex/screen-flows/payments.md) · [business-rules/payment.md](../../../../../docs/jex/business-rules/payment.md)
