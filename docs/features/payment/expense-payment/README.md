# Payment > Expense Payment — Frontend Page Design

> **Frontend feature hub.** Backend counterpart: [wecms-api/docs/features/payment/expense-payment/README.md](../../../../../wecms-api/docs/features/payment/expense-payment/README.md) _(wecms-api repo)_.

## Sub-module map

| Sub-module | Routes | JEX |
|---|---|---|
| **Scheduled Payment** | `/payment/expense-payment/scheduled-payment` (+ `[id]`) | `pymn_0003_*` |
| **Payment Result** | `/payment/expense-payment/payment-result` (+ `[id]`) | `pymn_0004_*` |

## Documentation set (this feature)

| Doc | Purpose |
|---|---|
| [screen-flow.md](screen-flow.md) | End-to-end user flow per sub-module |
| [ui-specification.md](ui-specification.md) | Filters, tabs, summary cards, tables/columns, dialogs, actions |
| [component-index.md](component-index.md) | Routes, components, client, SCREEN_IDS |
| [api-consumption.md](api-consumption.md) | `expensePayment.ts` function ↔ endpoint map |
| [test-scenarios.md](test-scenarios.md) | FE test inventory + scenarios |

## Per-screen detail

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
Both Scheduled and Result lists render through the shared batch-list shells (`<PaymentScheduledBatchListPage>` / `<PaymentResultBatchListPage>`), so columns match the rest of the payment family.

- **Scheduled** (`<PaymentScheduledBatchListPage>` + Expense `extraColumn` Schedule Date): Checkbox · Date/Time · File Name · No. of Transactions · Total Transfer Amount · Scheduled Date (`PAY_DATE`) · Approval Status · Requestor (`DRAFT_USER_NM`) · Approver · Approval Ref (`APPR_DOC_NO`) · Approval Title · Action. Totals footer (currency totals under Total Transfer Amount).
- **Result** (`<PaymentResultBatchListPage>`): Date/Time · File Name · No. of Transactions · Total Transfer Amount · Transfer Status · Approval Ref (clickable, F4b) · Approval Title · per-row download glyph. Totals footer rendered (Expense renders it, unlike Internal Transfer Result).
- **Result detail** uses the canonical 11-column `resultDetailColumns` (shared across all 5 modules).

## Dialogs / Popups
- Excel-upload dialog (`<ExpensePaymentUploadDialog>`), Request Approval dialog, Approval Details dialog (approve/reject/withdraw/edit-approval-line), row → detail route.

## API Integration
- `/api/v1/payment/expense-payment` (Scheduled) + `…/results` (Result) + write/dispatch/match endpoints — full client in [`lib/api/expensePayment.ts`](../../../../lib/api/expensePayment.ts). snake_case wire ↔ camelCase mappers. Backend endpoint table: backend `expense-payment/README.md` §1.1 _(wecms-api repo)_.

## Validation
- Excel rows validated per-row server-side; cut-off-time pre-flight on Transfer.

## Notes
Implemented full-stack (backend + Next.js). Backend README reconciled against code 2026-06-23.
