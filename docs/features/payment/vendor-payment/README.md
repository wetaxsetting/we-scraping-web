# Payment > Vendor Payment — Frontend Feature (Refactor)

> **Backend counterpart:** [wecms-api/docs/features/payment/vendor-payment/README.md](../../../../../wecms-api/docs/features/payment/vendor-payment/README.md) · **Sub-modules:** Scheduled Payment (`pymn_0001_*`) + Payment Result (`pymn_0002_*`).

**Module:** Payment → Vendor Payment · **Slug:** `vendor-payment`
**Routes:** `/payment/vendor-payment/{scheduled-payment, payment-result}` (+ `[id]` detail routes) · **JEX:** `pymn_0001_*` (Scheduled) / `pymn_0002_*` (Result)
**Status:** **Implemented full-stack** (verified 2026-06-23) — server-driven list/sort/filter; no mock fallback.

## Documents in this folder

| Doc | Focus |
|---|---|
| [screen-flow.md](screen-flow.md) | Page behaviour & flows across both sub-modules + 4 routes. |
| [ui-specification.md](ui-specification.md) | Layout, filters, tabs, columns, status badges, dialogs, footer, pagination. |
| [component-index.md](component-index.md) | Routes, feature components, shared collaborators, hooks. |
| [api-consumption.md](api-consumption.md) | Endpoints per screen, `lib/api/vendorPayment.ts` surface, wire shapes, errors. |
| [test-scenarios.md](test-scenarios.md) | Manual/SIT matrix + missing FE coverage. |

### Per-screen design docs (preserved)

- [scheduled-payment.md](scheduled-payment.md) · [scheduled-payment-details.md](scheduled-payment-details.md) · [payment-result.md](payment-result.md) · [payment-result-details.md](payment-result-details.md)

- Shared pattern baseline: [internal-transfer/README.md](../internal-transfer/README.md)

## Overview
Vendor batch payments. Same shell as the other payment families: Scheduled Payment (Excel upload → request approval → transfer) + Payment Result, each with a detail drill-down. **Implemented full-stack** (server-driven pagination/sort/filter; no mock fallback on the list pages).

## Page Location
`app/(dashboard)/payment/vendor-payment/{scheduled-payment,payment-result}/` (+ `[id]` detail routes) → `components/payment/vendor-payment/`. The list components are **default exports** (`VendorScheduledPaymentPage`, `VendorPaymentResultPage`); the detail components are `VendorScheduledPaymentDetailPage` / `VendorPaymentResultDetailPage`.

## Menu sections
- **Scheduled Payment** — list/create scheduled vendor payments (Excel upload, request approval, transfer, per-line banking match).
- **Scheduled Payment Details** — drill-down of a scheduled row (line items, reporting-account picker, approver chain, attachments).
- **Payment Result** — executed results with route-aware Completed / In-Progress filter + totals footer.
- **Payment Result Details** — per-transaction result detail (canonical 11-column `resultDetailColumns`).

## UI Components
- Scheduled: `<PaymentScheduledBatchListPage>` (shared batch-list shell) + `<VendorPaymentUploadDialog>` + `<RequestApprovalDialog>` + `<ApprovalDetailsDialog>` (read-only + edit modes via `<EditApprovalLinePicker>`) + `<ViewSettingPopover>`.
- Result: `<PaymentResultBatchListPage>` (totals footer rendered, unlike Internal Transfer) + `<ViewSettingPopover>`.
- Detail: `<PaymentDetailPage>` (Scheduled) / `<ResultDetailView>` (Result).

## User Actions
- Upload Excel → review → Request Approval (multipart, with attachments) → Transfer (cut-off-time guarded); delete draft; withdraw / change approval line; filter results (Completed/In Progress); open row → detail; download original Excel; per-line banking match.

## Table Columns
Driven by the View Setting registry (FIELD_IDs), not hardcoded. Scheduled (V156 seed): Date/Time · File Name · No. of Transactions · Total Transfer Amount · Scheduled Date · Approval Status · Requestor · Approver · Approval Ref · Approval Title. Result: Date/Time · File Name · No. of Transactions · Total Transfer Amount · Transfer Status · Approval Ref · Approval Title.

## Dialogs / Popups
- Excel-upload preview dialog; Request Approval dialog; Approval Details popup (clickable Approval Ref); View Setting popover.

## API Integration
- `/api/v1/payment/vendor-payment` (scheduled) + `…/results` (result) — **one** backend controller (`VendorPaymentController`), not two. Full client surface in `lib/api/vendorPayment.ts`. snake_case wire ↔ camelCase; reuses the shared `internaltransfer` wire types. Result Excel export → `POST …/results/export`. Authorization: `payment-vendor-scheduled` / `payment-vendor-result` menu permissions (note these differ from the View Setting screenIds `payment-vendor-payment-*`).

## Validation
- Excel rows validated per-row server-side; date range `yyyyMMdd`; cut-off-time guard before Transfer.

## Notes
Both API and WEB are implemented and wired (verified 2026-06-23). See the API counterpart README for the full endpoint + service inventory.
