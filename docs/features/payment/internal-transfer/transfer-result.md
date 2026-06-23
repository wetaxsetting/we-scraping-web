# Internal Transfer > Transfer Result — Web (Refactor)

**Module:** Payment → Internal Transfer · **Screen:** Transfer Result (list)
**Route:** `/payment/internal-transfer/transfer-result` · **JEX:** `pymn_0010_001`
**Component:** `<TransferResultPage>` → shared `<PaymentResultBatchListPage>` (`footerMode="paginationWithTotals"`)

> Screen-level doc. Family hub: [README.md](README.md) · flow: [screen-flow.md](screen-flow.md) · UI: [ui-specification.md](ui-specification.md) · API map: [api-consumption.md](api-consumption.md). Supporting: [transfer-result-flow.md](transfer-result-flow.md). API counterpart: [wecms-api/.../internal-transfer/](../../../../../wecms-api/docs/features/payment/internal-transfer/README.md).

## Overview
Executed internal-transfer **result batches** (Phase A read path of legacy `pymn_0010_001_r001`). Server-driven (page / size / period / status / search / sort). Row click → [Transfer Result Details](transfer-result-details.md).

## Title-row actions
List icon (View Setting popover) · Print (`printReport`) · **Excel export** (`useExcelExport` → `POST /api/v1/payment/internal-transfer/results/export`).

## Filters / toolbar
- **Period dropdown** — Last 30 / 90 / 180 Days + Enter Manually → `from_date` / `to_date`.
- **Status checkboxes** — **Completed** / **In Progress** (the only two states; the legacy "Incomplete / Processing / Success / Failed" set does NOT exist). Both unchecked or both checked = no filter; one checked → `trnf_stts` `Y` (Completed) / `N` (In Progress).
- **SearchInput** → `srch_wd` (page → 0).

## Table (8 columns)
Date/Time (2-line) · File Name · No. of Transactions (`{n} Transaction ({ccy})` — `txnUnitLabel="Transaction"`) · Total Transfer Amount (right) · **Transfer Status** (Completed / In Progress; on Completed, inline success ✓ and failed ! count pills) · Approval Ref (**F4b** — clickable → Approval Details popup when `approvalRefId` is set) · Approval Title · trailing per-row Download glyph (`size-4`).
- Visibility / width via View Setting (`FALLBACK_COLUMNS` mirrors V219; `FIELD_ID_MAP` = `TRAN_DT` / `FILE_NM` / `SCDUL_PYMN_DETL_NO` / `TRAN_AMT` / `PROC_STAT` / `APPR_DOC_NO` / `TITL`).
- Sortable headers via `useTableSort` (`SORTABLE_COLUMNS`).

## Footer totals · pagination · empty state
- **Totals footer** (`paginationWithTotals`): per-currency Total under Total Transfer Amount. (Note: the original Figma 1:11730 showed pagination only; the canonical sticky-footer rollout supplies totals here, so the page now matches Vendor / Expense / Payroll / Overseas Result.)
- **Pagination** shared, outside the scroll container.
- **Empty state:** `payment.internal.result_empty`; `common.loading` during the sticky initial fetch.

## Navigation & behaviour
- Row click → `/payment/internal-transfer/transfer-result/[id]`.
- **Download** — `downloadOriginalExcel`; `WBE2069` (no `save_file_nm` on legacy DEV rows) surfaces as a warning, not an error.
- **Approval Ref click** (F4b) → `<CommonApprovalDetailsDialog>` (read-only approval details).
- Status derivation: `trnf_stts === 'Y'` AND succ+err ≥ total → Completed (with count pills); else In Progress.

## API calls
`fetchTransferResultList` · `downloadOriginalExcel` (`lib/api/internalTransfer.ts`); export via `useExcelExport`. See [api-consumption.md](api-consumption.md).

## Remaining gaps
- **PARTIAL** — live `PROC_STAT` only flips when the bank dispatch daemon runs; in local R&D rows may stay In Progress.
- **MISSING** — no automated FE tests (manual / SIT only).
