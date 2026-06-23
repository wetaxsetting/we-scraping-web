# Internal Transfer > Scheduled Transfer Details — Web (Refactor)

**Module:** Payment → Internal Transfer · **Screen:** Scheduled Transfer Details
**Route:** `/payment/internal-transfer/scheduled-transfer/[id]` · **JEX:** `pymn_0009_003`
**Component:** `<ScheduledTransferDetailPage>` → shared `<PaymentDetailPage>`

> Screen-level doc. Family hub: [README.md](README.md) · flow: [screen-flow.md](screen-flow.md) · UI: [ui-specification.md](ui-specification.md). Parent list: [scheduled-transfer.md](scheduled-transfer.md). API counterpart: [wecms-api/.../internal-transfer/](../../../../../wecms-api/docs/features/payment/internal-transfer/README.md).

## Overview
Per-batch detail of one scheduled internal transfer — its uploaded line items, withdrawal account, and reporting-account assignment. Reached by row-click from the Scheduled Transfer list. `params: Promise<{ id }>`; unknown id → `notFound()`.

## Detail header
`<DetailHeader>` — breadcrumb `Scheduled Transfer > {fileName}` + **Back** button (deterministic `backHref` to the list, not `router.back()`).

## Detail summary
`<DetailSummary>` (label + value both `text-wb-13`; value `font-semibold`): Withdrawal Bank · Account No (`"{accountNo} ({currency})"`) · Total Transfer Amount · Approval Ref. · Requestor.

## File card & attachment / download area
`<FileCard>` (original uploaded Excel, `ico-excel.svg` `size-5` + download circle `size-5`/icon `size-4`) on the **same flex row** as the toolbar (list icon + search) — owned by `<PaymentDetailPage>`.

## Inner transaction table
Shared `<PaymentListTable>` with the scheduled line columns (Deposit Bank · Recipient Name · Transfer Amount · Remarks · Reporting Account). Reporting Account renders a chart-of-accounts **picker** on unassigned lines (`PATCH .../lines/{lineId}/reporting-account`); assigned rows can be amber-tinted via `getRowClass`. Sticky `<thead>`; horizontal scroll when wider than the viewport.

## Pagination · totals · empty state
- **No pagination** (`<Pagination hidden>`) and **no totals footer** — detail pages never show either (CLAUDE.md §12a).
- Empty/`notFound()` when the id doesn't resolve.

## API calls
`fetchScheduledTransferDetail(id)` (master + lines); reporting-account PATCH; `downloadOriginalExcel`. See [api-consumption.md](api-consumption.md).

## Remaining gaps
- **PARTIAL** — Phase A POI line parsing may return an empty `rows[]`; the inner table shows the empty state until parsing lands.
- **PARTIAL** — reporting-account `CHART_ACCT_INFM` existence re-check deferred (bean validation only).
- **MISSING** — no automated FE tests.
