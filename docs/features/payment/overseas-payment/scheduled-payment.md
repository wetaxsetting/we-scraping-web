# Overseas Payment > Scheduled Payment — Web (Refactor)

**Module:** Payment → Overseas Payment · **Screen:** Scheduled Payment
**Route:** `/payment/overseas-payment/scheduled-payment` · **JEX:** `pymn_0007_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
List + create scheduled overseas payment batches (Excel upload, request approval, approve/reject, dispatch, delete draft). Live-wired (no mock) as of 2026-06-23.

## Route/Page
- `app/(dashboard)/payment/overseas-payment/scheduled-payment/page.tsx` → `<OverseasScheduledPaymentPage>` ([ScheduledPaymentPage.tsx](../../../../components/payment/overseas-payment/ScheduledPaymentPage.tsx)).

## Components
- Composes shared `<PaymentScheduledBatchListPage>` (CLAUDE.md §12a — the single canonical batch table). Module supplies rows/totals + the `extraColumn` Schedule Date slot. Excel upload via `OverseasExcelUploadModal`; approver editing via `ChangeApproverDialog`; Request Approval via shared `<RequestApprovalDialog>`.

## Filters
- Period dropdown (30/90/180 days / manual) + shared `<CalendarIconButton>`, Approval Status dropdown (Not Requested / Pending / In Progress / Approved / Rejected → `appr_type_cd[]`), keyword search.

## Table Columns
- Checkbox · Date/Time · File Name · No. of Transactions · Total Transfer Amount · Approval Status · Requestor · Approver · Approval Ref · Approval Title · Schedule Date · Action. View-Setting-driven (`SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_SCHEDULED`).

## Sorting
- Sortable headers via View Setting FIELD_ID (Date/Time, Total Transfer Amount, Status, Requestor) → `sort_field` / `sort_direction`.

## Pagination
- `paginationWithTotals` — server-side `page` (0-based) / `size` (default 10) + per-currency totals footer.

## Dialogs/Popups
- Excel-upload modal; Request Approval / Change Approver; approve/reject confirmation via `useDialog()`.

## API Integration
- `GET /api/v1/payment/overseas-payment/scheduled` (`fetchOverseasScheduledList`) + `/scheduled/{id}` + write endpoints (`/{id}/request-approval`, `/{id}/approval-line`, `/{id}/approval-action`, `/{id}/dispatch`, `/{id}` delete, `/excel-preview`, `/excel-upload`). snake_case wire ↔ camelCase mappers.

## Validation
- Excel rows validated per-row server-side (`previewOverseasPaymentExcel`); `from_date`/`to_date` 8-digit.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result.md](./payment-result.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: scheduled-payment.md _(wecms-api backend repo — not included in this clone)_
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_
