# Expense Payment > Payment Result — Web (Refactor)

**Module:** Payment → Expense Payment · **Screen:** Payment Result (list)
**Route:** `/payment/expense-payment/payment-result` · **JEX:** `pymn_0004_001`
**Component:** `<PaymentResultPage>` → shared `<PaymentResultBatchListPage>` (`footerMode="paginationWithTotals"`)

> Screen-level doc. Family hub: [README.md](README.md) · flow: [screen-flow.md](screen-flow.md) · UI: [ui-specification.md](ui-specification.md) · API map: [api-consumption.md](api-consumption.md). API counterpart: [wecms-api/.../expense-payment/](../../../../../wecms-api/docs/features/payment/expense-payment/README.md). **Implemented full-stack** — server-driven, no mock fallback.

## Overview
Executed (dispatched) expense-payment **result batches**. Row click → [Payment Result Details](payment-result-details.md). The list status filter is route-aware `PROC_STAT`; footer currency totals are computed across the full dispatched set regardless of the status filter (R008 parity). **ERP vs Payment Result:** an ERP-bound batch download writes an ERP audit row (type `05`, code 'W') — see F2 below.

## Title-row actions
List icon (View Setting popover) · Print (`printReport`) · **Excel export** (`useExcelExport` → `POST .../results/export`, provider screenId `payment-expense-payment-result`).

## Filters / toolbar
- **Period dropdown** — Last 30 / 90 / 180 Days + Enter Manually → `from_date` / `to_date`.
- **Status checkboxes** — **Completed** (`trnf_stts=C`) / **In Progress** (`trnf_stts=P`); both/neither checked = no filter.
- **SearchInput** → `srch_wd` (page → 0).

## Table (8 columns)
Date/Time (2-line) · File Name · No. of Transactions · Total Transfer Amount (right) · **Transfer Status** (Completed / In Progress; on Completed, success ✓ / failed ! count pills) · Approval Ref (**F4b** — clickable → Approval Details popup; `EXPT_RESOL_MSTR.DOC_NO`) · Approval Title · trailing per-row Download glyph.
- View-Setting-driven; sortable headers via `useTableSort` → `ExpensePaymentResultSortField`.

## Footer totals · pagination · empty state
- **Totals footer** (`paginationWithTotals`): per-currency Total under Total Transfer Amount, computed unfiltered by the status checkboxes.
- **Pagination** shared; **empty state** + `common.loading` during the sticky initial fetch.

## Navigation & behaviour
- Row click → `/payment/expense-payment/payment-result/[id]`.
- **F2 download** — per-row original-Excel download; a dispatched-batch download writes an ERP 'W' / `EXPENSE_PAYMENT_RESULT` audit row (ERP type `05`).
- **Approval Ref click** (F4b) → shared Approval Details popup.

## API calls
`GET /api/v1/payment/expense-payment/results` (list) · `GET /{id}` (detail) · `POST /results/export` (XLSX) · `GET /{id}/file` (download). Client: `lib/api/expensePayment.ts`. Authorization: `payment-expense-result`. Date range `yyyyMMdd` validated server-side (`WBE_VALIDATION`). See [api-consumption.md](api-consumption.md).

## Remaining gaps
- **PARTIAL** — live `PROC_STAT` only flips when the (flag-gated) dispatch path runs; local R&D rows stay In Progress.
- **MISSING** — no automated FE tests.
