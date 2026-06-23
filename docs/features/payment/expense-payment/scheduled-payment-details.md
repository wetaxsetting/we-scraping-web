# Expense Payment > Scheduled Payment Details — Web (Refactor)

**Module:** Payment → Expense Payment · **Screen:** Scheduled Payment Details
**Route:** `/payment/expense-payment/scheduled-payment/[id]` · **JEX:** `pymn_0003_002`
**Component:** `<ScheduledPaymentDetailPage>` → shared `<PaymentDetailPage>`

> Screen-level doc. Family hub: [README.md](README.md) · flow: [screen-flow.md](screen-flow.md) · UI: [ui-specification.md](ui-specification.md). Parent list: [scheduled-payment.md](scheduled-payment.md). API counterpart: [wecms-api/.../expense-payment/](../../../../../wecms-api/docs/features/payment/expense-payment/README.md). **Implemented full-stack.** Detail is a **route** (`[id]`), not a dialog.

## Overview
Per-batch detail of one scheduled expense payment — master fields, per-line list with the inline reporting-account (chart-of-accounts) picker, and approval attachments. Reached by row-click from the Scheduled Payment list. `params: Promise<{ id }>`; unknown id → `notFound()`.

## Detail header
`<DetailHeader>` — breadcrumb `Scheduled Payment > {fileName}` + **Back** button (deterministic `backHref`).

## Detail summary
`<DetailSummary>` (label + value both `text-wb-13`): Withdrawal Bank · Account No (`"{accountNo} ({currency})"`) · Total Transfer Amount · Approval Ref. · Requestor.

## File card & attachment / download area
`<FileCard>` (original Excel) on the same flex row as the toolbar (list icon + search) — owned by `<PaymentDetailPage>`. Approval attachments (if submitted) stream per-file.

## Inner transaction table
Shared `<PaymentListTable>` per-line columns (Deposit Bank · Recipient · Transfer Amount · Remarks · Reporting Account picker · Description · Document No.). Reporting Account picker persists via `PATCH .../lines/{lineId}/reporting-account`. Sticky `<thead>`; horizontal scroll when wide.

## Pagination · totals · empty state
- **No pagination** (`<Pagination hidden>`) and **no totals footer** (CLAUDE.md §12a).
- `notFound()` when the id doesn't resolve.

## API calls
`fetchExpensePaymentDetail(id)` (accepts `scdul_pymn_no` or `DOC_NO`) · reporting-account PATCH · `GET /{id}/file`. Errors: `WBE2060` (not found/wrong tenant), `WBE2069` (no file), `WBE2064` (reporting-account change blocked once dispatched). See [api-consumption.md](api-consumption.md).

## Remaining gaps
- **PARTIAL** — reporting-account `CHART_ACCT_INFM` existence re-check deferred (bean validation only).
- **MISSING** — no automated FE tests.
