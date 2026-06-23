# Vendor Payment > Scheduled Payment — Web (Refactor)

**Module:** Payment → Vendor Payment · **Screen:** Scheduled Payment
**Route:** `/payment/vendor-payment/scheduled-payment` · **JEX:** `pymn_0001_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
List + create scheduled vendor payment batches (Excel upload, request approval, transfer, per-line banking match). **Implemented full-stack** — server-driven, no mock fallback.

## Route/Page
- `app/(dashboard)/payment/vendor-payment/scheduled-payment/page.tsx` → default export `VendorScheduledPaymentPage` (`components/payment/vendor-payment/ScheduledPaymentPage.tsx`).

## Components
- `<PaymentScheduledBatchListPage>` (shared batch-list shell), `<VendorPaymentUploadDialog>`, `<RequestApprovalDialog>`, `<ApprovalDetailsDialog>` (read-only + edit via `<EditApprovalLinePicker>`), `<ViewSettingPopover>`.

## Filters
- Period dropdown (30/90/180d + manual range), keyword search, approval-status dropdown (All / Not Requested / Pending / In Progress / Approved / Rejected — codes `""`/`00`/`04`/`03`/`01`/`02`, applied server-side via `appr_type`).

## Table Columns
- View-Setting-driven (V156 seed): Date/Time · File Name · No. of Transactions · Total Transfer Amount · Scheduled Date · Approval Status · Requestor · Approver · Approval Ref · Approval Title. Checkbox + ETC are special non-reorderable columns.

## Sorting
- Sortable headers via `useTableSort` + View Setting FIELD_ID → `VendorPaymentSortField` whitelist. APPROVER (`APPRVR_NM`) is the one deferred column (no whitelist entry — glyph renders but backend falls back to default ORDER BY).

## Pagination
- Server-side `page`/`size` (payment-module pagination rule — all 5 families). Totals footer rendered.

## Dialogs/Popups
- Excel-upload preview dialog; Request Approval dialog (multipart with attachments); Approval Details popup (clickable Approval Ref → withdraw / change-line); transfer + delete confirmation dialogs; View Setting popover.

## API Integration
- `GET /api/v1/payment/vendor-payment` (list) · `GET /{id}` (detail) · `POST /` (create, multipart) · `POST /uploads/parse` · `GET /withdrawal-accounts` · `DELETE /{id}` · `POST /{id}/request-approval` (multipart) · `POST /{id}/approval-action` · `DELETE /{id}/approval` (withdraw) · `PUT /{id}/approval-line` · `PATCH /{id}/lines/{lineId}/reporting-account` · `POST /{id}/dispatch` · `GET /{id}/file` · Banking Match `…/lines/{lineId}/match[/candidates]` + `…/matches`. Client: `lib/api/vendorPayment.ts`. snake_case wire ↔ camelCase. Authorization: `payment-vendor-scheduled`.

## Validation
- Excel rows validated per-row server-side; cut-off-time guard before Transfer; `WBE2062` when deleting/submitting a batch already in approval.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result.md](./payment-result.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: [wecms-api/docs/features/payment/vendor-payment/README.md] (backend feature spec)
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_
