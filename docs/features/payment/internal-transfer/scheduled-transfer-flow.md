# Flow 2 — Scheduled Transfer (Frontend)

Source-code-verified 2026-06-08. Frontend authority: `ScheduledTransferPage.tsx` + `ScheduledTransferDetailPage.tsx`. Backend: [wecms-api/.../scheduled-transfer-flow.md](../../../../../wecms-api/docs/features/payment/internal-transfer/scheduled-transfer-flow.md).

---

## Purpose

List, filter, open, edit, delete, and dispatch scheduled internal-transfer batches.

---

## User Actions

| Action | Wiring |
|---|---|
| **Search** (date period 7/30/90d or manual range, keyword) | `useApiData(fetchScheduledTransferList)`; each filter setter resets page 0. |
| **Filter** (Approval-Status dropdown `apprType` 00/04/03/01/02) | `APPR_TYPE_OPTIONS` → `appr_type` query param. |
| **View details** | Row click → `/payment/internal-transfer/scheduled-transfer/{id}` (`rowDetailHref`). |
| **Edit** (Reporting Account) | Detail-page line cell → `updateReportingAccount` (PATCH). |
| **Cancel / Delete** (draft only) | Per-row Delete chip → confirmation → `deleteScheduledTransfer` (blocked client-side + server when `approvalRef` set, `WBE1063`/`WBE2062`). |
| **Dispatch / Transfer** | Per-row Transfer chip → `validateBankingTime` pre-flight → confirmation → `dispatchScheduledTransfer(id,{trnf_ccy_cd})`. |
| **Download Excel** | Per-row + detail FileCard → `downloadOriginalExcel`. |
| **Approval status tracking** | status badge + approver cell; Approval-Ref click → Flow 4 dialog. |

---

## Main UI components

- **List**: `ScheduledTransferPage.tsx` → `PaymentScheduledBatchListPage` (shared shell — period dropdown + `CalendarIconButton` + Approval-Status dropdown + `SearchInput` + Request-Approval CTA + canonical 11-column batch table + per-row Transfer/Delete/Download chips + currency totals footer + `extraColumn` Schedule Date). View Setting via `useViewSetting(SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_SCHEDULED)` + `ViewSettingPopover`. Server paging/sort (`useTableSort`); stable-data latch + `useStickyLoading`. Print via `printReport`.
- **Detail**: `ScheduledTransferDetailPage.tsx` → `PaymentDetailPage` (`DetailSummary` Withdrawal Bank/Account No/Total/Approval Ref/Requestor + `FileCard` + line table). Column registry keyed by FIELD_ID (TAR_BANK_CD/RCPT_NM/TRAN_AMT/TRAN_USAG/CHART_ACCT_CD/NOTE/DOC_NO/BANK_TRAN_ID) with `FALLBACK_COLUMNS`; View Setting `…_SCHEDULED_DETAIL`. Reporting-account cell shows "Select Account ⌄" when unassigned, cream `#FFFEDB` cell highlight (legacy parity). Remarks header carries the blocked-chars ⓘ tooltip (`useBlockedChars(outBankCd,"INTR")`).
- **Scheduled Date** column/value reads the list row `scheduleDate` / detail `pay_date` (source `EXPT_RESOL_MSTR.PAY_DATE`).

---

## Hooks
`useApiData`, `useTableSort`, `useStickyLoading`, `useViewSetting`, `useBlockedChars`, `useDialog`.

## API consumption (`lib/api/internalTransfer.ts`)
`fetchScheduledTransferList(query)` GET `…/`; `fetchScheduledTransferDetail(id)` GET `…/{id}`; `updateReportingAccount` PATCH `…/{id}/lines/{lineId}/reporting-account`; `deleteScheduledTransfer` DELETE `…/{id}`; `dispatchScheduledTransfer` POST `…/{id}/dispatch`; `rerunTransferLine` POST `…/{id}/lines/{lineId}/rerun`; `downloadOriginalExcel` GET `…/{id}/file` (blob). Mappers `mapScheduledTransferList`/`mapScheduledTransferDetail`.

## Status display
List status badge from `APPR_STTS` (`detailStatusToOutcome`); the per-row dispatch eligibility (Transfer chip) and `validateBankingTime` pre-flight mirror the legacy cut-off gate.

## Legacy mapping
`pymn_0009_001` (list/dispatch/delete) + `pymn_0009_003` (detail) + `pymn_0009_002_u002` (reporting account) → the endpoints above.

## Legacy parity status — **MATCH** (dispatch local-only: no bank daemon flips `PROC_STAT` — Flow 3 shows the seeded result).
## Refactor status — **Implemented** (live; supersedes the README "Phase B deferred" note).

## Open gaps (source-evidenced)
- View Setting reorder on the Scheduled list shell persists `DISP_ORD` but the visible column order stays in the legacy sequence until a follow-up (`ScheduledTransferPage` comment).
- Reporting-account picker dropdown action on an unassigned detail line is not yet wired (`ReportingAccountCell` comment — CHART_ACCT_INFM picker lands with the approval-box MR).
