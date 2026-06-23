# Vendor Payment > Payment Result — Web (Refactor)

**Module:** Payment → Vendor Payment · **Screen:** Payment Result
**Route:** `/payment/vendor-payment/payment-result` · **JEX:** `pymn_0002_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Executed (dispatched) vendor payment results. **Implemented full-stack** — server-driven list with a route-aware status filter + totals footer (rendered, unlike Internal Transfer Result).

## Route/Page
- `app/(dashboard)/payment/vendor-payment/payment-result/page.tsx` → default export `VendorPaymentResultPage` (`components/payment/vendor-payment/PaymentResultPage.tsx`).

## Components
- `<PaymentResultBatchListPage>` (totals footer rendered), status badges, `<ViewSettingPopover>`.

## Filters
- Period dropdown (30/90/180d + manual range), keyword search, **Completed / In-Progress checkboxes** → backend `trnf_stts` `C` / `P` (route-aware `PROC_STAT` filter; both/neither checked = no filter). The earlier "Incomplete/Processing/Success/Failed" labels in the stub were wrong — the list filter is Completed / In Progress only.

## Table Columns
- View-Setting-driven: Date/Time · File Name · No. of Transactions · Total Transfer Amount · Transfer Status · Approval Ref · Approval Title. The Approval Ref (`DOC_NO` from `EXPT_RESOL_MSTR`) is clickable (F4b) when the batch carries an `appr_seq_no`.

## Sorting
- Sortable headers via `useTableSort` + `VendorPaymentResultSortField` whitelist (every column maps to a `ScdulPymnSumr` property).

## Pagination
- Server-side `page`/`size`. Totals footer is computed **unfiltered** by the status checkboxes (legacy R008 parity) so it stays stable while the row list narrows.

## Dialogs/Popups
- View Setting popover; per-row original-Excel download (F2: a dispatched-batch download writes an ERP 'W' / `VENDOR_PAYMENT_RESULT` audit row); system dialogs.

## API Integration
- `GET /api/v1/payment/vendor-payment/results` (list) · `GET /{id}` (detail) · `POST /results/export` (XLSX via shared `useExcelExport`; provider `VendorPaymentResultExportProvider`, screenId `payment-vendor-payment-result`) · `GET /{id}/file` (download). Client: `fetchVendorPaymentResultList` / `downloadOriginalVendorExcel`. Authorization: `payment-vendor-result`.

## Validation
- Date range `yyyyMMdd` validated server-side (`WBE_VALIDATION`).

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment.md](./scheduled-payment.md) · [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: [wecms-api/docs/features/payment/vendor-payment/README.md] (backend feature spec)
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_
