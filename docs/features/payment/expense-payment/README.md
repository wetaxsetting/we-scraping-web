# Payment > Expense Payment — Frontend Page Design

## Screens (this feature)

- [scheduled-payment.md](scheduled-payment.md)
- [scheduled-payment-details.md](scheduled-payment-details.md)
- [payment-result.md](payment-result.md)
- [payment-result-details.md](payment-result-details.md)


**Module:** Payment → Expense Payment · **Slug:** `expense-payment`
**Routes:** `/payment/expense-payment/{scheduled-payment, payment-result}` · **JEX:** `pymn_0003_*` (Scheduled) / `pymn_0004_*` (Result)

- API side: `expense-payment.md` _(wecms-api backend repo — not included in this clone)_
- Shared pattern baseline: [internal-transfer.md](../internal-transfer/README.md)

## Overview
Expense batch payments — same shell as the other families: Scheduled Payment + Payment Result, each with a detail drill-down.

## Page Location
`app/(dashboard)/payment/expense-payment/{scheduled-payment,payment-result}/` → `components/payment/expense-payment/`.

## Menu sections
- **Scheduled Payment** · **Scheduled Payment Details** · **Payment Result** · **Payment Result Details** (as for Vendor).

## UI Components
- Scheduled list + Excel-upload dialog + Request-Approval / Transfer; Result list; row-detail panels.

## User Actions
- Upload Excel → Request Approval → Transfer; filter results; open row → detail.

## Table Columns
Scheduled: payee · withdrawal bank · amount · scheduled date · approval status. Result: + result status. *(Confirm against shipped tables.)*

## Dialogs / Popups
- Excel-upload dialog; row detail.

## API Integration
- `/api/v1/payment/expense-payment` (scheduled) + `…/results` (result). snake_case wire ↔ camelCase mappers.

## Validation
- Excel rows validated per-row; required fields.

## Notes
Implemented in code; API doc currently a stub pending backfill.
