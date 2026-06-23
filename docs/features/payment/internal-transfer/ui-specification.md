# Internal Transfer — UI Specification (Frontend)

> **API counterpart:** [wecms-api/.../functional-specification.md](../../../../../wecms-api/docs/features/payment/internal-transfer/functional-specification.md) · **Hub:** [README.md](README.md)

Source-code-verified 2026-06-23. Filters, tabs, summary cards, tables/columns, pagination, sorting, empty states, dialogs, upload/download, approval actions — per sub-screen. All four pages are live-wired via `useApiData` + `lib/api/internalTransfer.ts`.

**Per-screen docs:** [scheduled-transfer.md](scheduled-transfer.md) · [scheduled-transfer-details.md](scheduled-transfer-details.md) · [transfer-result.md](transfer-result.md) · [transfer-result-details.md](transfer-result-details.md).

---

## 1. Scheduled Transfer list (`<ScheduledTransferPage>` → `<PaymentScheduledBatchListPage>`)

| Element | Detail |
|---|---|
| **Filters** | Period dropdown (7/30/90d) + `CalendarIconButton` manual range; Approval-Status dropdown (`APPR_TYPE_OPTIONS` → `appr_type` 00/04/03/01/02); `SearchInput` keyword. Each setter resets page 0. |
| **Toolbar** | "Excel Upload" (opens `InternalTransferUploadDialog`); Request-Approval CTA; Print (`printReport`). |
| **Table** | Canonical 11-column batch table + `extraColumn` Schedule Date. Columns: title/doc-no, withdrawal bank, account no, currency, total amount, count, **Scheduled Date** (`scheduleDate`), approval status badge, first approver, per-row action chips. |
| **Per-row actions** | Transfer chip (dispatch), Delete chip (draft only), Download chip (`downloadOriginalExcel`). |
| **Footer** | Per-currency totals (`currencyTotals[]`). |
| **Sorting** | Server-side via `useTableSort`; whitelisted FIELD_ID; default `REG_DTM DESC`. |
| **Pagination** | Server-side `page`/`size` (payment-module rule); stable-data latch + `useStickyLoading`. |
| **View Setting** | `useViewSetting(SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_SCHEDULED)` + `ViewSettingPopover`. |
| **Status badge** | `detailStatusToOutcome` over derived `APPR_STTS`. |
| **Empty state** | shared list empty row. |

---

## 2. Scheduled Transfer detail (`<ScheduledTransferDetailPage>` → `<PaymentDetailPage>`)

| Element | Detail |
|---|---|
| **Summary card** | `DetailSummary` — Withdrawal Bank / Account No / Total / Approval Ref / Requestor. |
| **File card** | `FileCard` → `downloadOriginalExcel`. |
| **Line table** | Columns keyed by FIELD_ID (`TAR_BANK_CD`, `RCPT_NM`, `TRAN_AMT`, `TRAN_USAG`, `CHART_ACCT_CD`, `NOTE`, `DOC_NO`, `BANK_TRAN_ID`) with `FALLBACK_COLUMNS`. View Setting `…_SCHEDULED_DETAIL`. |
| **Reporting Account cell** | Shows "Select Account ⌄" when unassigned; cream `#FFFEDB` highlight (legacy parity). Picker dropdown not yet wired (open gap). |
| **Remarks header** | Blocked-chars ⓘ tooltip (`useBlockedChars(outBankCd,"INTR")`). |

---

## 3. Upload dialog (`<InternalTransferUploadDialog>` → `<PaymentExcelUploadDialog>` → `<ExcelUploadDialog>`)

Steps: Download per-locale template (`public/templates/internal-transfer/`) → Browse → server parse (`parseInternalTransferExcel`) → preview with **per-cell red error highlights** (`err_fld`/`err_fld_caus`) → enter Title + select withdrawal account (`WithdrawalAccountDropdown` ← `fetchWithdrawalAccounts`) → Save Draft (`createScheduledTransfer`). On success → `onSaved(scdulPymnNo)` → list refetch + success dialog.

---

## 4. Transfer Result list (`<TransferResultPage>` → `<PaymentResultBatchListPage>`)

| Element | Detail |
|---|---|
| **Filters** | Period dropdown + `CalendarIconButton` range; Completed / In Progress checkboxes → `trnf_stts` (C/P); `SearchInput`. |
| **Status pills** | counter pills from backend counts. |
| **Table** | per-row trailing download glyph. **Totals footer shown** (`paginationWithTotals`) — page passes a per-currency `totals` array; the earlier `paginationOnly` carve-out (Figma 1:11730) was superseded by the canonical sticky-footer rollout. |
| **Sorting / paging** | server-side; default `TRNF_DTM DESC`. |

---

## 5. Transfer Result detail (`<TransferResultDetailPage>` → `<ResultDetailView>`)

| Element | Detail |
|---|---|
| **Tabs** | `DetailStatusTabs` All / Success / Failed / In-Progress (counts from backend `suc_cnt`/`err_cnt`/`prc_cnt`). |
| **Columns** | Canonical 11-column `resultDetailColumns`: Date/Time, Deposit Bank, Recipient, Transfer Amount, Remarks ⓘ, Results, Result Date/Time, Reporting Account, Description, Document No., Banking Transaction ID. |
| **Per-line status** | `PaymentResultBadge` + `deriveResultStatus.ts` (chip-consistent with backend `countByStatus`). |

---

## 6. Dialogs

| Dialog | Trigger | Action |
|---|---|---|
| `InternalTransferUploadDialog` | "Excel Upload" | parse + create draft |
| `RequestApprovalDialog` | Request-Approval CTA | `submitInternalTransferApproval` |
| `ApprovalDetailsDialog` | Approval-Ref cell click | approve / reject / withdraw / change-line |
| Confirmation dialogs | Transfer / Delete | dispatch / delete |

## Cross-links

[screen-flow.md](screen-flow.md) · [component-index.md](component-index.md) · [api-consumption.md](api-consumption.md) · [test-scenarios.md](test-scenarios.md)
