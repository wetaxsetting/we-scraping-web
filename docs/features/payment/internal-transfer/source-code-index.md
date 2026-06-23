# Internal Transfer — Source Code Index (Frontend-first)

Complete Legacy → Backend → Frontend file map, source-code-verified 2026-06-23. Backend-detailed twin: [wecms-api/.../source-code-index.md](../../../../../wecms-api/docs/features/payment/internal-transfer/source-code-index.md).

---

## Frontend (`wecms-web`)

### Routes — `app/(dashboard)/payment/internal-transfer/`
| Path | File | Renders |
|---|---|---|
| `/payment/internal-transfer/scheduled-transfer` | `scheduled-transfer/page.tsx` | `<ScheduledTransferPage>` |
| `…/scheduled-transfer/[id]` | `scheduled-transfer/[id]/page.tsx` | `<ScheduledTransferDetailPage>` (`params: Promise<{id}>`) |
| `/payment/internal-transfer/transfer-result` | `transfer-result/page.tsx` | `<TransferResultPage>` |
| `…/transfer-result/[id]` | `transfer-result/[id]/page.tsx` | `<TransferResultDetailPage>` |

### Components — `components/payment/internal-transfer/`
| File | Flow | Role |
|---|---|---|
| `ScheduledTransferPage.tsx` | 1,2,4 | List + upload trigger + Request-Approval + Approval-Details (approve/reject/withdraw/edit) + dispatch/delete/download. |
| `ScheduledTransferDetailPage.tsx` | 2 | Per-batch detail (master + lines); View Setting; file download. |
| `TransferResultPage.tsx` | 3 | Result list. |
| `TransferResultDetailPage.tsx` | 3 | Result detail (status tabs + per-line results). |
| `InternalTransferUploadDialog.tsx` | 1 | Excel upload wrapper over `PaymentExcelUploadDialog`. |
| `types.ts` | — | `InternalScheduledRow` etc. |

### Shared components — `components/payment/shared/`
`PaymentScheduledBatchListPage`, `PaymentResultBatchListPage`, `PaymentDetailPage`, `ResultDetailView`, `PaymentExcelUploadDialog`, `RequestApprovalDialog`, `ApprovalDetailsDialog` (`chainToDialogApprovers`, `isCurrentUserActiveApprover`, `ApproverOutcomeChip`), `DetailSummary`, `DetailHeader`, `DetailStatusTabs`, `FileCard`, `detailColumns.tsx` (`resultDetailColumns`, `DepositBankCell`), `deriveResultStatus.ts`, `PaymentResultBadge`, `WithdrawalAccountDropdown`, `PaymentListTable`/`Footer`. Plus `components/payment/corporate-card/EditApprovalLinePicker`, `components/payment/approval-box/StatusBadge`/`types`, `components/shared/excel-upload/ExcelUploadDialog`, `components/shared/view-setting/*`, `components/shared/BlockedCharsTooltip`.

### Hooks
`lib/api/useApiData`, `components/shared/Pagination` `usePagination`, `hooks/useTableSort`, `hooks/useStickyLoading`, `components/shared/view-setting/useViewSetting`, `hooks/useBlockedChars`, `hooks/useExcelExport`.

### API client — `lib/api/internalTransfer.ts`
`fetchScheduledTransferList`, `fetchScheduledTransferDetail`, `fetchNextInternalTransferDocNo`, `withdrawInternalTransferApproval`, `changeInternalTransferApprovalLine`, `downloadOriginalExcel`, `downloadApprovalAttachment`, `parseAttachmentFilename`, `fetchWithdrawalAccounts`, `parseInternalTransferExcel`, `createScheduledTransfer`, `updateReportingAccount`, `deleteScheduledTransfer`, `dispatchScheduledTransfer`, `submitInternalTransferApproval`, `actOnInternalTransferApproval`, `fetchTransferResultList`, `fetchTransferResultDetail`, + banking-match fns (`fetchInternalTransferMatchCandidates`, `matchInternalTransferLine`, `unmatchInternalTransferLine`, `unmatchAllInternalTransferLines`). No `rerunTransferLine` (re-run was never ported — DEAD LEGACY). Also `lib/api/approval-box.ts` `fetchApprovalBoxApprovers`; `lib/api/mappers.ts` `mapScheduledTransferList`/`mapScheduledTransferDetail`; `lib/api/banking.ts` `ApiCallError`.

### Types — `lib/types/api.ts`
`ApiScheduledTransferListResponse`/`…Row`, `ApiScheduledTransferDetailResponse`, `ApiTransferLineDetail`, `ApiTransferResultListResponse`/`…DetailResponse`, `ApiCreateScheduledTransferRequest`/`…Response`, `ApiParseExcelResponse`, `ApiRequestApprovalRequest`/`…Response`, `ApiApprovalActionRequest`, `ApiDispatchRequest`, `ApiUpdateReportingAccountRequest`, `ApiWithdrawalAccountRow`, `ApiApprovalLineRow`, banking-match types.

---

## Backend (`wecms-api`) — summary
Controllers `InternalTransferController` + `TransferResultController`; services `InternalTransferService`, `InternalTransferResultService`, `InternalTransferDispatchService`, `InternalTransferDispatchExecutor`, `InternalTransferExcelParser`, `InternalTransferKeyGenerator`, `CutoffValidator`; repos `ScdulPymnSumrRepository`/`ScdulPymnSumrDetlRepository`/`ExptResolFileRepository`; entities `ScdulPymnSumr`/`ScdulPymnSumrDetl`/`ExptResolFile`; delegates to `approvalbox/ApprovalBoxService` + `ApprovalBoxFanoutService`. Full list in the backend index.

---

## Legacy (JEX, read-only)
| Legacy | → |
|---|---|
| `pymn_0009_001` (list/dispatch/delete `_r001`/`_c001`/`_d001`) | Scheduled list + dispatch + delete |
| `pymn_0009_002` (`_r001` parse / `_c001` save / `_u002` reporting acct) | Upload/Create + reporting-account edit |
| `pymn_0009_003` (detail) | Scheduled detail |
| `pymn_0010_001` / `pymn_0010_002` | Result list / detail |
| `comm_1001_001` | withdrawal-account picker |
| `comm_0194_001`→`comm_0192_001_c005` | Request Approval |
| `comm_0195_001` (+ `bltb_0001_003_u001`) | Approval Details approve/reject/withdraw/edit |
| Permission matrix `comm_0190_003_view.jsp:530-547` | `pymn_0009_001` R/U/D/T · `pymn_0010_001` R |
