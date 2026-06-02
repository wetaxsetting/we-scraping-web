# Payment > Overseas Payment — Frontend Page Design

## Screens (this feature)

- [scheduled-payment.md](scheduled-payment.md)
- [scheduled-payment-details.md](scheduled-payment-details.md)
- [payment-result.md](payment-result.md)
- [payment-result-details.md](payment-result-details.md)


**Module:** Payment → Overseas Payment · **Slug:** `overseas-payment`
**Routes:** `/payment/overseas-payment/{scheduled-payment, payment-result, exchange-rate-inquiry}` · **JEX:** `pymn_0007_*` (Scheduled) / `pymn_0008_*` (Result)

- API side: `overseas-payment.md` _(wecms-api backend repo — not included in this clone)_
- FX lookup: [exchange-rate-inquiry.md](../exchange-rate-inquiry.md)

## Overview
Overseas (foreign) remittance batch payments with beneficiary + FX detail. Same upload → approval →
transfer shell as the other families, but on the **separate** `OVRS_PYMN_*` table family, and bundled
with the Exchange Rate Inquiry screen.

## Page Location
`app/(dashboard)/payment/overseas-payment/{scheduled-payment,payment-result,exchange-rate-inquiry}/` → `components/payment/overseas-payment/`.

## Menu sections
- **Scheduled Payment** — list/create scheduled overseas payments (beneficiary + FX).
- **Scheduled Payment Details** — drill-down (beneficiary, FX, amount, approver chain).
- **Payment Result** — executed results.
- **Payment Result Details** — per-transaction result with beneficiary info + failure reason.

## UI Components
- Scheduled list + Excel-upload dialog + Request-Approval / Transfer; Result list; beneficiary/FX detail panels; Exchange Rate Inquiry sub-screen.

## User Actions
- Upload Excel → Request Approval → Transfer; filter results; open row → detail with beneficiary info; check FX via Exchange Rate Inquiry.

## Table Columns
Scheduled: beneficiary · beneficiary bank · currency/FX · amount · scheduled date · approval status. Result: + result status. *(Confirm against shipped tables.)*

## Dialogs / Popups
- Excel-upload dialog; beneficiary/result detail.

## API Integration
- `/api/v1/payment/overseas-payment` (scheduled) + `…/results` (result) — confirm against `domain.payment.overseas`. snake_case wire ↔ camelCase mappers.

## Validation
- Beneficiary + FX + amount required; Excel rows validated per-row.

## Notes
Newly documented (was a gap). Uses `OVRS_PYMN_MSTR/SUMR/DTLS`, not the shared SCDUL flow.
