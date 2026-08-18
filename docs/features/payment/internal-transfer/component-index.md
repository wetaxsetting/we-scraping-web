# Internal Transfer — Component Index (Frontend)

> **API counterpart:** [wecms-api/.../source-code-index.md](../../../../../wecms-api/docs/features/payment/internal-transfer/source-code-index.md) · **Hub:** [README.md](README.md) · **Frontend-first map:** [source-code-index.md](source-code-index.md)

Source-code-verified 2026-06-23. Page components, hooks, API clients, mappers.

---

## Routes — `app/(dashboard)/payment/internal-transfer/`
`scheduled-transfer/page.tsx` + `scheduled-transfer/[id]/page.tsx`; `transfer-result/page.tsx` + `transfer-result/[id]/page.tsx`. Each `[id]` page uses `params: Promise<{ id: string }>`.

## Feature components — `components/payment/internal-transfer/`
| Component | Flow | Role |
|---|---|---|
| `ScheduledTransferPage.tsx` | 1,2,4 | List + upload trigger + Request-Approval + Approval-Details (approve/reject/withdraw/edit) + dispatch/delete/download |
| `ScheduledTransferDetailPage.tsx` | 2 | Per-batch detail (master + lines); View Setting; file download |
| `TransferResultPage.tsx` | 3 | Result list |
| `TransferResultDetailPage.tsx` | 3 | Result detail (status tabs + per-line results) |
| `InternalTransferUploadDialog.tsx` | 1 | Excel upload wrapper over `PaymentExcelUploadDialog` |
| `types.ts` | — | `InternalScheduledRow` etc. |

## Shared components — `components/payment/shared/`
`PaymentScheduledBatchListPage`, `PaymentResultBatchListPage`, `PaymentDetailPage`, `ResultDetailView`, `PaymentExcelUploadDialog`, `RequestApprovalDialog`, `ApprovalDetailsDialog` (+ `chainToDialogApprovers`, `isCurrentUserActiveApprover`, `ApproverOutcomeChip`), `DetailSummary`, `DetailHeader`, `DetailStatusTabs`, `FileCard`, `detailColumns.tsx` (`resultDetailColumns`, `DepositBankCell`), `deriveResultStatus.ts`, `PaymentResultBadge`, `WithdrawalAccountDropdown`, `PaymentListTable`/`Footer`.

Also: `components/payment/corporate-card/EditApprovalLinePicker`, `components/payment/approval-box/StatusBadge`/`types`, `components/shared/excel-upload/ExcelUploadDialog`, `components/shared/view-setting/*`, `components/shared/BlockedCharsTooltip`.

## Hooks
`lib/api/useApiData`, `components/shared/Pagination` `usePagination`, `hooks/useTableSort`, `hooks/useStickyLoading`, `components/shared/view-setting/useViewSetting`, `hooks/useBlockedChars`, `hooks/useExcelExport`, `useDialog`.

## API client — `lib/api/internalTransfer.ts`
`fetchScheduledTransferList`, `fetchScheduledTransferDetail`, `fetchNextInternalTransferDocNo`, `withdrawInternalTransferApproval`, `changeInternalTransferApprovalLine`, `downloadOriginalExcel`, `downloadApprovalAttachment`, `parseAttachmentFilename`, `fetchWithdrawalAccounts`, `parseInternalTransferExcel`, `createScheduledTransfer`, `updateReportingAccount`, `deleteScheduledTransfer`, `dispatchScheduledTransfer`, `submitInternalTransferApproval`, `actOnInternalTransferApproval`, `fetchTransferResultList`, `fetchTransferResultDetail`, banking-match fns (`fetchInternalTransferMatchCandidates`, `matchInternalTransferLine`, `unmatchInternalTransferLine`, `unmatchAllInternalTransferLines`). **No `rerunTransferLine`** (re-run never ported — DEAD LEGACY).

Also: `lib/api/approvalBox.ts` `fetchApprovalBoxApprovers`; `lib/api/banking.ts` `ApiCallError`.

## Mappers — `lib/api/mappers.ts`
`mapScheduledTransferList`, `mapScheduledTransferDetail` (snake_case wire ↔ camelCase).

## Types — `lib/types/api.ts`
`ApiScheduledTransferListResponse`/`…Row`, `ApiScheduledTransferDetailResponse`, `ApiTransferLineDetail`, `ApiTransferResultListResponse`/`…DetailResponse`, `ApiCreateScheduledTransferRequest`/`…Response`, `ApiParseExcelResponse`, `ApiRequestApprovalRequest`/`…Response`, `ApiApprovalActionRequest`, `ApiDispatchRequest`, `ApiUpdateReportingAccountRequest`, `ApiWithdrawalAccountRow`, `ApiApprovalLineRow`, banking-match types.

## Cross-links

[screen-flow.md](screen-flow.md) · [ui-specification.md](ui-specification.md) · [api-consumption.md](api-consumption.md) · [test-scenarios.md](test-scenarios.md)
