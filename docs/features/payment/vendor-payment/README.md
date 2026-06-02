# Payment > Vendor Payment — Frontend Page Design

## Screens (this feature)

- [scheduled-payment.md](scheduled-payment.md)
- [scheduled-payment-details.md](scheduled-payment-details.md)
- [payment-result.md](payment-result.md)
- [payment-result-details.md](payment-result-details.md)


**Module:** Payment → Vendor Payment · **Slug:** `vendor-payment`
**Routes:** `/payment/vendor-payment/{scheduled-payment, payment-result}` · **JEX:** `pymn_0001_*` (Scheduled) / `pymn_0002_*` (Result)

- API side: `vendor-payment.md` _(wecms-api backend repo — not included in this clone)_
- Shared pattern baseline: [internal-transfer.md](../internal-transfer/README.md)

## Overview
Vendor batch payments. Same shell as the other payment families: Scheduled Payment (Excel upload → request approval → transfer) + Payment Result, each with a detail drill-down.

## Page Location
`app/(dashboard)/payment/vendor-payment/{scheduled-payment,payment-result}/` → `components/payment/vendor-payment/`.

## Menu sections
- **Scheduled Payment** — list/create scheduled vendor payments.
- **Scheduled Payment Details** — drill-down of a scheduled row.
- **Payment Result** — executed results (status per transaction).
- **Payment Result Details** — per-transaction result detail.

## UI Components
- Scheduled list table + Excel-upload dialog + Request-Approval / Transfer buttons; Result list table; row-detail panels. (Mirrors `components/payment/internal-transfer/`.)

## User Actions
- Upload Excel → review → Request Approval → Transfer; filter results (Completed/In Progress); open row → detail.

## Table Columns
Scheduled: vendor · withdrawal bank · amount · scheduled date · approval status. Result: + result status / message. *(Confirm against shipped tables.)*

## Dialogs / Popups
- Excel-upload dialog; row detail.

## API Integration
- `/api/v1/payment/vendor-payment` (scheduled) + `…/results` (result), following the Internal Transfer two-controller pattern. snake_case wire ↔ camelCase mappers.

## Validation
- Excel rows validated per-row; required vendor/amount/date fields.

## Notes
Implemented in code; API doc is currently a stub pending full-spec backfill (see API counterpart).
