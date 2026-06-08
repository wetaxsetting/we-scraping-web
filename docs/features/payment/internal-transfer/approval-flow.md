# Flow 4 — Approval / Approval Box (Frontend)

Source-code-verified 2026-06-08. Frontend authority: `ScheduledTransferPage.tsx` (Request-Approval + Approval-Details wiring) + shared `RequestApprovalDialog` / `ApprovalDetailsDialog`. Backend: [wecms-api/.../approval-flow.md](../../../../../wecms-api/docs/features/payment/internal-transfer/approval-flow.md).

---

## Purpose

Submit a scheduled batch for approval, track its approval status, and act on it (approve / reject / withdraw / change approval line) from the Approval Details popup — the same popup the cross-feature Approval Box opens.

---

## User Actions

| Action | Wiring |
|---|---|
| **Submit** (Request Approval) | Toolbar CTA → select rows → `RequestApprovalDialog` (`kind="internal-transfer"`) → `submitInternalTransferApproval(id, request, attachments)`. Pre-guards: empty selection / already-submitted (`approvalRef`) → warning dialog. |
| **View approval status** | List status badge + Approver cell; opens `ApprovalDetailsDialog`. |
| **Approve** / **Reject** | Dialog footer → `actOnInternalTransferApproval(id,{action})`; shown only when `isCurrentUserActiveApprover(approvers, userId)` and not final/in-flight. |
| **Open Approval Details** | Approval-Ref cell click → `handleApprovalRefClick` → `fetchScheduledTransferDetail(id)` then `fetchApprovalBoxApprovers(detail.appr_seq_no)` → `ApprovalDetailsDialog`. |
| **Withdraw** (kebab Delete) | confirmation → `withdrawInternalTransferApproval(id)`. |
| **Change approval line** (kebab Edit) | inline `EditApprovalLinePicker` → `changeInternalTransferApprovalLine(id, apprLineNo)`. |

On every success: dialog closes + `refreshKey` bump → list refetch + status badge flips.

---

## Special verification (source-evidenced)

1. **Approval Details integration — both directions:**
   - *Internal Transfer → Approval Details:* `handleApprovalRefClick` fetches the master detail then the real approver chain (`fetchApprovalBoxApprovers`) and opens `ApprovalDetailsDialog` with `content`, `scheduledDate`, `withdrawalAccount`, `transactions`, `attachments`, `approvers`.
   - *Approval Box → Internal Transfer details:* the Approval Box page's `pickDetailLoader('internal_transfer')` calls `fetchScheduledTransferDetail(documentNo)` to render the batch's per-line transactions inside its own `ApprovalDetailsDialog`.
2. **Scheduled Date:** `ApprovalDetailsDialog scheduledDate={detailsView.row.scheduleDate}` — sourced from `EXPT_RESOL_MSTR.PAY_DATE` (list `pay_date`). Both entry points render the same value.
3. **Approval Content + attachment:** `content={detailsView.detail.cont ?? ""}` (empty-state when blank); `attachments` mapped from `detail.attachments` (`EXPT_RESOL_FILE`), each chip downloading via `downloadApprovalAttachment(id, apprSeqNo, file_id)`. The batch's source Excel is deliberately NOT shown here (it belongs to the Scheduled detail FileCard).
4. **Approval line rendering:** `approvers = chainToDialogApprovers(fetchApprovalBoxApprovers(...))` — per-approver `outcome` (P/A/R/W), numbered chips with verb + `apprDtm` date (`ApproverOutcomeChip`); `isCurrentUserActiveApprover` gates Approve/Reject to the first-pending approver.
5. **File attachment handling:** upload via `submitInternalTransferApproval(..., attachments)` (multipart); download via `downloadApprovalAttachment` / `downloadOriginalExcel` (blob + `parseAttachmentFilename`); Approval Details displays attachment chips.

---

## Main UI components

- `RequestApprovalDialog` (shared) — `kind="internal-transfer"`, read-only `fixedWithdrawalAccount` (chosen at upload, resolved via `fetchWithdrawalAccounts`), `documentNo` preview from `fetchNextInternalTransferDocNo`, `loadTransactions` from `fetchScheduledTransferDetail`.
- `ApprovalDetailsDialog` (shared) — status badge (`detailStatusToOutcome`), General Information (withdrawal account / total / scheduled date), **Approval Content** section (content + attachment chips), **Approver** chips (`ApproverOutcomeChip`, P/A/R/W verbs + dates), Transaction Details, footer Approve/Reject + kebab Edit/Delete/Re-submit. Edit-mode swaps approver chips for `EditApprovalLinePicker`.

## API consumption (`lib/api/internalTransfer.ts` + `lib/api/approval-box.ts`)
`fetchNextInternalTransferDocNo` GET `…/next-doc-no`; `submitInternalTransferApproval` POST `…/{id}/request-approval` (multipart); `actOnInternalTransferApproval` POST `…/{id}/approval-action`; `withdrawInternalTransferApproval` DELETE `…/{id}/approval`; `changeInternalTransferApprovalLine` PUT `…/{id}/approval-line`; `downloadApprovalAttachment` GET `…/{id}/approval/{apprSeqNo}/attachments/{fileId}`; `fetchApprovalBoxApprovers(apprSeqNo)` GET `…/payment/approval-box/{apprSeqNo}/approvers`.

## Status / code model
`detailStatusToOutcome`/`rowStatusToOutcome` map `APPR_STTS` `P/I/C/X` (+ `01/02/03/04`) → `pending/in_progress/approved/rejected`. `isFinalApprovalState` suppresses Approve/Reject on `C`/`X`. Approver outcome `P/A/R/W/S` via `chainToDialogApprovers`.

## Legacy mapping
`comm_0194_001`→`comm_0192_001_c005` (request) → `submitInternalTransferApproval`; `comm_0195_001` footer/kebab → `actOnInternalTransferApproval`/`withdrawInternalTransferApproval`/`changeInternalTransferApprovalLine`.

## Legacy parity status — **MATCH** (full request fan-out + chain-aware approve/reject + withdraw + change-line, live).
## Refactor status — **Implemented**, except Re-submit-after-reject.

## Open gaps (source-evidenced)
- **Re-submit after reject — NOT a gap (intentional match).** Legacy never supported re-submitting a rejected Internal Transfer (reject is terminal: `EXPT_RESOL_MSTR.APPR_TYPE_CD=REJECT` + `PAY_END_YN=YES`, `SCDUL_PYMN_SUMR.APPR_SEQ_NO` retained → list disables Request Approval, hides Delete/Edit). The refactor matches. The kebab **"Re-submit"** entry here (`approval.action.resubmit_not_implemented` warning) is a refactor-only inert placeholder with no legacy counterpart — recommend removal. Source trace: [wecms-api refactor-gap-analysis.md](../../../../../wecms-api/docs/features/payment/internal-transfer/refactor-gap-analysis.md).
- `RequestApprovalDialog.onSubmitted` carries a stale "backend endpoint not yet ported / coming soon" comment, but the live `submitInternalTransferApproval` + `POST .../request-approval` path is implemented; the Approval-Details approve/reject/withdraw/edit path is fully wired and live.
