# Internal Transfer > Scheduled Transfer — Web (Refactor)

**Module:** Payment → Internal Transfer · **Screen:** Scheduled Transfer (list)
**Route:** `/payment/internal-transfer/scheduled-transfer` · **JEX:** `pymn_0009_001`
**Component:** `<ScheduledTransferPage>` → shared `<PaymentScheduledBatchListPage>` (`footerMode="paginationWithTotals"`)

> Screen-level doc. Family hub: [README.md](README.md) · flow: [screen-flow.md](screen-flow.md) · UI: [ui-specification.md](ui-specification.md) · API map: [api-consumption.md](api-consumption.md). Supporting flow docs: [upload-create-flow.md](upload-create-flow.md) · [approval-flow.md](approval-flow.md) · [scheduled-transfer-flow.md](scheduled-transfer-flow.md). API counterpart: [wecms-api/.../internal-transfer/](../../../../../wecms-api/docs/features/payment/internal-transfer/README.md).

## Overview
Lists uploaded scheduled internal-transfer **batches** (one row = one Excel file of N transfer lines). Server-driven (page / size / period / status / search / sort). Supports Excel upload → create, Request Approval, per-row Transfer / Delete / Download, and row-click drill-down to [Scheduled Transfer Details](scheduled-transfer-details.md).

## Title-row actions
List icon (shared View Setting popover, CLAUDE.md §13) · Print (`printReport`, §6d) · **Excel Upload** chip (`<InternalTransferUploadDialog>`).

## Filters / toolbar
- **Request Approval** CTA (left; hidden when the `R` action perm is false) — acts on checked rows; enforces single-batch + not-already-submitted guards; opens `<RequestApprovalDialog kind="internal-transfer">`.
- **Period dropdown** — Last 30 / 90 / 180 Days + Enter Manually (shared `<DateRangeFilter>`) → `from_date` / `to_date`; resets page to 0.
- **Approval-status dropdown** — All / per `APPR_TYPE_OPTIONS` → `appr_type`.
- **SearchInput** → `srch_wd` (debounced; page → 0).

## Buttons & per-row actions
Per-row Action chips (gated by `canDelete` / `transferDisabled` / `canDownloadFile`): **Transfer**, **Delete**, **Download**. Header checkbox = select-all of selectable (not-yet-submitted) rows.

## Table (11 columns + Schedule Date)
checkbox · Date/Time (2-line date + time) · File Name · No. of Transactions (`{n} Trx ({ccy})`) · Total Transfer Amount (right, `formatAmount`) · **Schedule Date** (extra column, `PAY_DATE`) · Approval Status (`<StatusBadge>`) · Requestor · Approver (click → approver-chain popover) · Approval Ref (clickable → Approval Details popup when the batch is submitted, else plain text) · Approval Title · Action.
- Visibility / width / order driven by View Setting (`viewSettingItems` + `FIELD_ID_MAP`; `FALLBACK_COLUMNS` paints first).
- Sortable headers via `useTableSort` → DB ORDER BY (`SORTABLE_COLUMNS`).

## Footer totals · pagination · empty state
- **Totals footer** (`paginationWithTotals`): per-currency Total aligned under Total Transfer Amount + document count under Date/Time.
- **Pagination** shared (`[10,20,50,100]`, default 10), outside the scroll container.
- **Empty state:** `payment.internal.scheduled_empty`; shows `common.loading` during the sticky initial fetch.

## Navigation & dialogs
- Row click → `/payment/internal-transfer/scheduled-transfer/[id]`.
- **Transfer** — `validateBankingTime` cutoff pre-check → confirm → `dispatchScheduledTransfer` (VND/FCY success messages).
- **Delete** — `WBE1063` if already submitted; else confirm → `deleteScheduledTransfer`.
- **Download** — `downloadOriginalExcel`.
- **Approval Ref click** — loads detail + approver chain → `<ApprovalDetailsDialog>` (Approve / Reject / Withdraw / Change approval line).
- **Excel Upload** / **Request Approval** dialogs as above.

## API calls
`fetchScheduledTransferList` · `dispatchScheduledTransfer` · `deleteScheduledTransfer` · `downloadOriginalExcel` · `fetchScheduledTransferDetail` · `fetchWithdrawalAccounts` · `fetchNextInternalTransferDocNo` · `actOnInternalTransferApproval` · `withdrawInternalTransferApproval` · `changeInternalTransferApprovalLine` · `downloadApprovalAttachment` (`lib/api/internalTransfer.ts`). Full mapping: [api-consumption.md](api-consumption.md).

## Remaining gaps
- **PARTIAL** — Request Approval submit endpoint not yet ported (dialog shows "coming soon"); withdrawal account is read-only (chosen at upload).
- **PARTIAL** — View Setting reorder persists `DISP_ORD` but visible order stays the legacy sequence until the shell drives ordering dynamically.
- **MISSING** — no automated FE tests (manual / SIT only).
