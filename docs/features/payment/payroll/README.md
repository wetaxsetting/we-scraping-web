# Payment > Payroll — Frontend Page Design

## Screens (this feature)

- [scheduled-payment.md](scheduled-payment.md)
- [scheduled-payment-details.md](scheduled-payment-details.md)
- [payment-result.md](payment-result.md)
- [payment-result-details.md](payment-result-details.md)


**Module:** Payment → Payroll · **Slug:** `payroll` (audit `WSVC_ID` `payroll-payment`)
**Routes:** `/payment/payroll/{scheduled-payment, payment-result}` · **JEX:** `pymn_0005_*` (Scheduled) / `pymn_0006_*` (Result)

- API side: [`../../../../wecms-api/docs/features/payment/payroll.md`](../../../../../wecms-api/docs/features/payment/payroll/README.md)
- Shared pattern baseline: [internal-transfer.md](../internal-transfer/README.md)

## Overview
Payroll batch payments — same shell as the other families: Scheduled Payment + Payment Result, each with a detail drill-down. Payroll data is typically masked/sensitive.

## Page Location
`app/(dashboard)/payment/payroll/{scheduled-payment,payment-result}/` → `components/payment/payroll/`.

## Menu sections
- **Scheduled Payment** · **Scheduled Payment Details** · **Payment Result** · **Payment Result Details**.

## UI Components
- Scheduled list + Excel-upload dialog + Request-Approval / Transfer; Result list; row-detail panels.

## User Actions
- Upload Excel → Request Approval → Transfer; filter results; open row → detail.

## Table Columns
Scheduled: employee/payee · withdrawal bank · amount · scheduled date · approval status. Result: + result status. *(Confirm against shipped tables; payroll amounts may be masked.)*

## Dialogs / Popups
- Excel-upload dialog; row detail.

## API Integration
- `/api/v1/payment/payroll` (scheduled) + `…/results` (result). snake_case wire ↔ camelCase mappers.

## Validation
- Excel rows validated per-row; required fields.

## Notes
Implemented in code; API doc currently a stub pending backfill. `SCDUL_PYMN_TYPE_CD = "00"`.
