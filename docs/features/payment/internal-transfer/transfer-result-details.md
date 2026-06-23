# Internal Transfer > Transfer Result Details — Web (Refactor)

**Module:** Payment → Internal Transfer · **Screen:** Transfer Result Details
**Route:** `/payment/internal-transfer/transfer-result/[id]` · **JEX:** `pymn_0010_002`
**Component:** `<TransferResultDetailPage>` → shared `<ResultDetailView>`

> Screen-level doc. Family hub: [README.md](README.md) · flow: [screen-flow.md](screen-flow.md) · UI: [ui-specification.md](ui-specification.md). Parent list: [transfer-result.md](transfer-result.md). API counterpart: [wecms-api/.../internal-transfer/](../../../../../wecms-api/docs/features/payment/internal-transfer/README.md).

## Overview
Per-batch executed-result detail — the line-level Results, result timestamps, reporting account, and banking-transaction match. Reached by row-click from the Transfer Result list. `params: Promise<{ id }>`; unknown id → `notFound()`.

## Detail header
`<DetailHeader>` — breadcrumb `Transfer Result > {fileName}` + **Back** button (deterministic `backHref`).

## Status tabs / counts
`<DetailStatusTabs>` — status filter + success / failed / in-progress counts across the batch's lines.

## Inner result table — `resultDetailColumns` (11 columns)
Date/Time (2-line) · Deposit Bank · Recipient Name · Transfer Amount · Remarks ⓘ · **Results** (`<PaymentResultBadge>` success / failed / pending / cancelled) · Result Date/Time (2-line) · Reporting Account (static text + breadcrumb) · Description · Document No. · **Banking Transaction ID** (renders a **Match** CTA when `result === "success"` and no `bankingTxnId`; otherwise the ID as plain text).

## File card & attachment / download area
`<FileCard>` + toolbar (list icon + search) on one row, as in the Scheduled detail.

## Pagination · totals · empty state
- **No pagination** (`<Pagination hidden>`), **no totals footer** (CLAUDE.md §12a).
- `notFound()` when the id doesn't resolve.

## API calls
Per-batch result detail fetch + line rows; banking-transaction match endpoint (shared). See [api-consumption.md](api-consumption.md).

## Remaining gaps
- **PARTIAL** — banking-transaction match depends on dispatch results being present (local R&D may lack them).
- **MISSING** — no automated FE tests.
