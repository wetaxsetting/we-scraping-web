# Flow 3 — Transfer Result (Frontend)

Source-code-verified 2026-06-08. Frontend authority: `TransferResultPage.tsx` + `TransferResultDetailPage.tsx`. Backend: [wecms-api/.../transfer-result-flow.md](../../../../../wecms-api/docs/features/payment/internal-transfer/transfer-result-flow.md).

---

## Purpose

Read-only view of executed internal-transfer batches and their per-line bank-side results.

---

## User Actions

| Action | Wiring |
|---|---|
| **Search** (period + manual range + keyword) | `useApiData(fetchTransferResultList)`; page-reset on filter change. |
| **Filter** (Completed / In Progress checkboxes → `trnf_stts`) | shared `PaymentResultBatchListPage` toolbar. |
| **Detail view** | Row click → `/payment/internal-transfer/transfer-result/{id}` → `fetchTransferResultDetail`. |
| **Download / export** | Per-row download glyph; list export via the shared Excel pipeline (`POST .../results/export`). |

---

## Main UI components

- **List**: `TransferResultPage.tsx` → `PaymentResultBatchListPage` (shared — period dropdown + `CalendarIconButton` + Completed/In-Progress checkboxes + `SearchInput` + status counter pills + trailing per-row download glyph). **Totals footer shown** (`paginationWithTotals`) — `<TransferResultPage>` passes a per-currency `totals` array (code 2026-05-29+). ⚠️ Diverges from CLAUDE.md §12a, which still lists Internal Transfer Result as the sole `paginationOnly` Result list (Figma 1:11730); code is the source of truth — flagged for PO/§12a reconciliation. Live via `useApiData(fetchTransferResultList)`.
- **Detail**: `TransferResultDetailPage.tsx` → `ResultDetailView` (shared — `DetailSummary` + `FileCard` + `DetailStatusTabs` All/Success/Failed/In-Progress + the canonical 11-column `resultDetailColumns`: Date/Time, Deposit Bank, Recipient, Transfer Amount, Remarks ⓘ, Results, Result Date/Time, Reporting Account, Description, Document No., Banking Transaction ID). Per-line status via `PaymentResultBadge` + `deriveResultStatus.ts` (chip-consistent with the backend `countByStatus`).

## Hooks
`useApiData`, `useStickyLoading`, `useViewSetting` (result detail), `useDialog`.

## API consumption
`fetchTransferResultList(query)` GET `…/results`; `fetchTransferResultDetail(id)` GET `…/results/{id}`. Export through the shared `useExcelExport` → `POST …/results/export`.

## Status display
`deriveResultStatus.ts` maps `proc_stat` + `rs_cd` → success / failed / in-progress; `PaymentResultBadge` renders the chip; `DetailStatusTabs` shows the backend-computed `suc_cnt`/`err_cnt`/`prc_cnt`.

## Legacy mapping
`pymn_0010_001` (list) + `pymn_0010_002` (detail; IDO `SCDUL_PYMN_SUMR_R006` per-line result) → the endpoints above; the per-line result fields are resolved by the backend `DispatchResultResolver` (from `TB_PAY_*`/`TB_FIRM_TRAN`).

## Legacy parity status — **MATCH** (read-only `R`-flag surface matches the JEX permission matrix).
## Refactor status — **Implemented** (live; per-line dispatch result fields are resolved, not null).

## Open gaps (source-evidenced)
- On a fresh local DB without dispatch tables, list status chips can be absent (backend `countByBatch` degrades to null counts) and rows read "In Progress" via count-math.
