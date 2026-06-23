# Expense Payment > Payment Result Details — Web (Refactor)

**Module:** Payment → Expense Payment · **Screen:** Payment Result Details
**Route:** `/payment/expense-payment/payment-result/[id]` · **JEX:** `pymn_0004_002`
**Component:** `<PaymentResultDetailPage>` → shared `<ResultDetailView>`

> Screen-level doc. Family hub: [README.md](README.md) · flow: [screen-flow.md](screen-flow.md) · UI: [ui-specification.md](ui-specification.md). Parent list: [payment-result.md](payment-result.md). API counterpart: [wecms-api/.../expense-payment/](../../../../../wecms-api/docs/features/payment/expense-payment/README.md). **Implemented full-stack.** Detail is a **route** (`[id]`), not a dialog.

## Overview
Per-batch executed-result detail for one expense payment batch — line-level Results, result timestamps, reporting account, banking match. Reached by row-click from the Payment Result list. `params: Promise<{ id }>`; unknown id → `notFound()`.

## Detail header
`<DetailHeader>` — breadcrumb `Payment Result > {fileName}` + **Back** button (deterministic `backHref`).

## Status tabs / counts
`<DetailStatusTabs>` — All / Success / Failed / In Progress; header tab counts derived server-side (`ExpensePaymentResultService.countByStatus`).

## Inner result table — `resultDetailColumns` (11 columns)
Date/Time (2-line) · Deposit Bank · Recipient Name · Transfer Amount · Remarks ⓘ · **Results** (`<PaymentResultBadge>`) · Result Date/Time (2-line) · Reporting Account · Description · Document No. · **Banking Transaction ID** (Match CTA when `result === "success"` and no id).

## File card & attachment / download area
`<FileCard>` + toolbar (list icon + search) on one row (shared `<ResultDetailView>`).

## Pagination · totals · empty state
- **No pagination** (`<Pagination hidden>`), **no totals footer** (CLAUDE.md §12a).
- `notFound()` when the id doesn't resolve.

## API calls
`GET /api/v1/payment/expense-payment/results/{id}`; banking-transaction match endpoint (shared). Client: `lib/api/expensePayment.ts`. Errors: `WBE2060` (not found / wrong tenant). Authorization: `payment-expense-result`. See [api-consumption.md](api-consumption.md).

## Remaining gaps
- **PARTIAL** — banking-transaction match depends on dispatch results being present (local R&D may lack them).
- **MISSING** — no automated FE tests.
