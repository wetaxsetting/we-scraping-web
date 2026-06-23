# Expense Payment > Scheduled Payment — Web (Refactor)

**Module:** Payment → Expense Payment · **Screen:** Scheduled Payment (list)
**Route:** `/payment/expense-payment/scheduled-payment` · **JEX:** `pymn_0003_001`
**Component:** `<ScheduledPaymentPage>` → shared `<PaymentScheduledBatchListPage>` (`footerMode="paginationWithTotals"`)

> Screen-level doc. Family hub: [README.md](README.md) · flow: [screen-flow.md](screen-flow.md) · UI: [ui-specification.md](ui-specification.md) · API map: [api-consumption.md](api-consumption.md). API counterpart: [wecms-api/.../expense-payment/](../../../../../wecms-api/docs/features/payment/expense-payment/README.md). **Implemented full-stack** — server-driven, no mock fallback.

## Overview
Lists uploaded scheduled expense-payment **batches** (one row = one Excel file of N lines). Excel upload → create, Request Approval, per-row Transfer / Delete / Download, and row-click drill-down to [Scheduled Payment Details](scheduled-payment-details.md). Expense dispatch is handled by the dedicated `ExpenseDispatchExecutor` (flag-gated, inert by default) — the result of a dispatched batch surfaces on [Payment Result](payment-result.md).

## Title-row actions
List icon (View Setting popover) · Print (`printReport`) · **Excel Upload** chip.

## Filters / toolbar
- **Request Approval** CTA (left) → `<RequestApprovalDialog kind="expense-payment">`.
- **Period dropdown** — Last 30 / 90 / 180 Days + Enter Manually → `from_date` / `to_date`.
- **Approval-status dropdown** → `appr_type` (All / Not Requested / Pending / In Progress / Approved / Rejected).
- **SearchInput** → `srch_wd` (page → 0).

## Table (11 columns + Schedule Date)
checkbox · Date/Time (2-line) · File Name · No. of Transactions (`{n} Trx ({ccy})`) · Total Transfer Amount (right) · **Schedule Date** (extra column, `PAY_DATE`) · Approval Status (`<StatusBadge>`) · Requestor · Approver (popover chain) · Approval Ref (clickable → Approval Details popup when submitted) · Approval Title · Action (Transfer / Delete / Download).
- Visibility / width / order via View Setting; sortable headers via `useTableSort` → DB ORDER BY (`ExpensePaymentSortField`).

## Footer totals · pagination · empty state
- **Totals footer** (`paginationWithTotals`): per-currency Total under Total Transfer Amount + document count under Date/Time.
- **Pagination** shared (`[10,20,50,100]`, default 10).
- **Empty state** + `common.loading` during the sticky initial fetch.

## Navigation & dialogs
- Row click → `/payment/expense-payment/scheduled-payment/[id]`.
- **Transfer** — cutoff pre-check → confirm → dispatch (gates `WBE2089` missing `TB_FIRM_CONF`, `WBE2088` VCB USD→other-bank).
- **Delete** — blocked once submitted; else confirm → delete.
- **Download** — original Excel.
- **Approval Ref click** → `<ApprovalDetailsDialog>` (Approve / Reject / Withdraw / Change line).

## API calls
List / detail / create (multipart) / parse / withdrawal-accounts / delete / request-approval / approval-action / withdraw / change-approval-line / reporting-account PATCH / dispatch / file / banking-match — `lib/api/expensePayment.ts` (~18 fns). ERP result audit type `05`. Authorization: `payment-expense-scheduled`. See [api-consumption.md](api-consumption.md).

## Remaining gaps
- **PARTIAL** — dispatch is flag-gated (`efs.enabled`/`sftp.enabled`/`auto-receive`/`realtime-dispatch` default false); local R&D rows stay In Progress.
- **DEAD LEGACY (code comment only)** — `expensePayment.ts` / `ExpensePaymentResultService` carry copied "Vendor / `'01'`" docstrings; code uses `'02'`.
- **MISSING** — no automated FE tests.
