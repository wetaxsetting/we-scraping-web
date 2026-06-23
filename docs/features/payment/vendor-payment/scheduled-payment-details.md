# Vendor Payment > Scheduled Payment Details — Web (Refactor)

**Module:** Payment → Vendor Payment · **Screen:** Scheduled Payment Details
**Route:** `/payment/vendor-payment/scheduled-payment/[id]` · **JEX:** `pymn_0001_002`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Drill-down detail of one scheduled vendor payment batch — master fields (withdrawal bank/account, total amount, approval ref, requestor), per-line list with the inline reporting-account (chart-of-accounts) picker, and approval attachments. **Implemented full-stack.** Detail is a **route** (`[id]`), not a dialog.

## Route/Page
- `app/(dashboard)/payment/vendor-payment/scheduled-payment/[id]/page.tsx` → `VendorScheduledPaymentDetailPage` (`components/payment/vendor-payment/ScheduledPaymentDetailPage.tsx`), composed through `<PaymentDetailPage>`.

## Components
- `<PaymentDetailPage>` (shared detail shell: DetailHeader breadcrumb + Back, DetailSummary, FileCard, inner line table), the reporting-account picker (`scheduledDetailColumns`), `<ViewSettingPopover>` for the inner table.

## Filters
- None (detail is a single-batch view; no list filters).

## Table Columns
- Inner per-line table from `scheduledDetailColumns` (Deposit Bank, Recipient, Transfer Amount, Remarks, Reporting Account picker, Description, Document No., …). No pagination footer on detail pages.

## Sorting
- Inner detail table is not server-sorted (single batch, line order by `SCDUL_PYMN_DETL_NO`).

## Pagination
- None — detail pages render `<Pagination hidden>` (payment-module rule §12a).

## Dialogs/Popups
- Reporting-account picker; View Setting popover; system confirm/error dialogs.

## API Integration
- `GET /api/v1/payment/vendor-payment/{id}` (detail) · `PATCH /{id}/lines/{lineId}/reporting-account` (persist picked code) · `GET /{id}/file` (download original Excel). Client: `fetchVendorPaymentDetail` / `updateVendorReportingAccount` / `downloadOriginalVendorExcel` in `lib/api/vendorPayment.ts`. Accepts either `scdul_pymn_no` or the `DOC_NO` (`VO_YYMMDD_NNN`) as `{id}`.

## Validation
- `WBE2060` batch not found / wrong tenant; `WBE2069` no file behind the batch; `WBE2064` reporting-account change blocked once dispatched.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment.md](./scheduled-payment.md) · [payment-result.md](./payment-result.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: [wecms-api/docs/features/payment/vendor-payment/README.md] (backend feature spec)
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_
