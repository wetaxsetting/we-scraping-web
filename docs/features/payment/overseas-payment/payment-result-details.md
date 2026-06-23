# Overseas Payment > Payment Result Details — Web (Refactor)

**Module:** Payment → Overseas Payment · **Screen:** Payment Result Details
**Route:** `/payment/overseas-payment/payment-result/[id]` · **JEX:** `pymn_0008_*` (Result family) · **Component:** `<OverseasPaymentResultDetailPage>` → shared `<ResultDetailView>`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Per-transaction result detail (Success / Failed + per-line result) for one executed overseas payment batch, with banking-match (link/unlink) on each line. Live-wired (no mock).

## Route/Page
- `app/(dashboard)/payment/overseas-payment/payment-result/[id]/page.tsx` → `<OverseasPaymentResultDetailPage id={id}>` ([PaymentResultDetailPage.tsx](../../../../components/payment/overseas-payment/PaymentResultDetailPage.tsx)).

## Components
- Composes shared `<ResultDetailView>` (CLAUDE.md §12 — adds `<DetailStatusTabs>` + Result Date/Time + Results columns over `<PaymentDetailPage>`). Columns View-Setting-driven (`SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_RESULT_DETAIL`).

## Filters
- None on the detail page; in-page searchable fields + status tabs.

## Table Columns
- Per-line result columns from the shared `resultDetailColumns` set (Date/Time, Deposit/Beneficiary Bank, Recipient, Transfer Amount, Remarks, Results, Result Date/Time, Reporting Account, Description, Document No., Banking Transaction ID/Match).

## Sorting
- Optional header sort over in-page rows (enableSort).

## Pagination
- None — `<Pagination hidden>` (CLAUDE.md §12a).

## Dialogs/Popups
- Per-line banking-match / unmatch; unmatch-all header action; per-batch Excel export.

## API Integration
- Detail loads via `GET /api/v1/payment/overseas-payment/scheduled/{id}/details` (`fetchOverseasPaymentDetail`, shared with Scheduled detail; carries per-line `proc_stat` / result fields for result rows). Per-batch export via `POST /api/v1/payment/overseas-payment/result/{id}/export` (shared `ExcelExportService` + `OverseasPaymentResultDetailExportProvider`, screenId `payment-overseas-payment-result-detail`). Banking match/unmatch via the shared payment-line match endpoints.

## Validation
- Match requires a selected bank transaction.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment.md](./scheduled-payment.md) · [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result.md](./payment-result.md)
- API counterpart: payment-result-details.md _(wecms-api backend repo — not included in this clone)_
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_
