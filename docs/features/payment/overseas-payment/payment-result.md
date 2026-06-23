# Overseas Payment > Payment Result — Web (Refactor)

**Module:** Payment → Overseas Payment · **Screen:** Payment Result
**Route:** `/payment/overseas-payment/payment-result` · **JEX:** `pymn_0008_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Executed overseas payment results filtered by `proc_stat` (Completed `0,3` / In-Progress `6`); each row carries a derived transfer status and success/failed counts. Live-wired (no mock).

## Route/Page
- `app/(dashboard)/payment/overseas-payment/payment-result/page.tsx` → `<OverseasPaymentResultPage>` ([PaymentResultPage.tsx](../../../../components/payment/overseas-payment/PaymentResultPage.tsx)).

## Components
- Composes shared `<PaymentResultBatchListPage>` (CLAUDE.md §12a). Module supplies rows/totals + extra columns (Scheduled Date, Approval Status, Requestor, Approver).

## Filters
- Period dropdown + `<CalendarIconButton>`/manual range, **Completed / In Progress checkboxes** (→ `proc_stat`), keyword search.

## Table Columns
- Date/Time · File Name · No. of Transactions · Total Transfer Amount · Transfer Status · Approval Ref · Approval Title · Action (download glyph) + Scheduled Date / Approval Status / Requestor / Approver. View-Setting-driven (`SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_RESULT`).
- **Approval Ref is clickable** (F4b, `appr_seq_no`) → Approval Details popup.

## Sorting
- View Setting FIELD_ID headers (Date/Time, File Name, Txn Count, Amount, Status, Approval Ref, Approval Title) → `sort_field`/`sort_direction`.

## Pagination
- `paginationWithTotals` — server-side `page`/`size` + per-currency totals footer (Overseas keeps the totals footer; only Internal Transfer Result is `paginationOnly`).

## Dialogs/Popups
- Approval Details popup (from Approval Ref); per-row Excel download.

## API Integration
- `GET /api/v1/payment/overseas-payment/result` (`fetchOverseasResultList`) + `/result/{id}` + `GET /result/export` (list XLSX via `OverseasPaymentResultExcelWriter`). snake_case wire ↔ camelCase mappers.

## Validation
- `proc_stat` CSV-of-digits; `from_date`/`to_date` 8-digit (server-validated).

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment.md](./scheduled-payment.md) · [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: payment-result.md _(wecms-api backend repo — not included in this clone)_
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_
