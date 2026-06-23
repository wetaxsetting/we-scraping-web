# Payroll > Scheduled Payment — Web (Refactor)

**Module:** Payment → Payroll · **Screen:** Scheduled Payment
**Route:** `/payment/payroll/scheduled-payment` · **JEX:** `pymn_0005_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
List + create scheduled payroll batches (Excel upload, request approval, transfer). Mirrors the Internal Transfer / Vendor / Expense Scheduled baseline (CLAUDE.md §12a) via the shared [`<PaymentScheduledBatchListPage>`](../../../../components/payment/shared/PaymentScheduledBatchListPage.tsx), plus the Payroll-only **Payroll Type** column.

## Route/Page
- `app/(dashboard)/payment/payroll/scheduled-payment/page.tsx` → [`<PayrollScheduledPaymentPage>`](../../../../components/payment/payroll/ScheduledPaymentPage.tsx). Figma 27:11294.

## Components
- Shared `<PaymentScheduledBatchListPage>` (canonical 11-column shell + totals footer + pagination). Payroll supplies the Scheduled Date column via the shared `extraColumn` slot and the Payroll Type column via `extraColumnAfterStatus`.
- [`<PayrollPaymentUploadDialog>`](../../../../components/payment/payroll/PayrollPaymentUploadDialog.tsx) (Excel upload).
- Shared `<RequestApprovalDialog kind="payroll">` and `<ApprovalDetailsDialog kind="payroll">`.

## Filters
- Period dropdown (30/90/180 days + manual range) + calendar chip + **approval-status dropdown** (`All / Not requested / Pending / In Progress / Approved / Rejected`) + SearchInput. The "Request Approval" CTA is in the toolbar. *(Mirror of Internal Transfer Scheduled, Figma 1:9972 — not a generic date-range + search row.)*

## Table Columns
CHECKBOX · Date/Time (`REG_DTM`) · File Name (`FILE_NM`) · No. of Transactions (`TOT_TRNS_CNT`) · Total Transfer Amount (`TOTAL_TRAN_AMT`) · Scheduled Date (`PAY_DATE`) · Approval Status (`APPR_STTS`) · **Payroll Type (`APPR_FUND_TP`)** · Requestor (`DRAFT_USER_NM`) · Approver (`APPRVR_NM`) · Approval Ref. (`APPR_DOC_NO`) · Approval Title (`TITL`) · ETC (action).
- Payroll Type: `"0"` → Salary, `"1"` → Bonus, else blank.
- Per-row action chip: Transfer (approved, not yet transferred) / Complete (transferred). Rows without an approval request render with a `warning` highlight and a Delete affordance.

## Sorting
- Server-side via `useTableSort`; whitelist `SORTABLE_COLUMNS` → backend `PayrollPaymentSortField` (V232-aligned FIELD_IDs). `APPRVR_NM` and `APPR_FUND_TP` are intentionally **not** sortable (project from `EXPT_RESOL_MSTR` / approval-line join — same deferral as the Approver column).

## Pagination
- Server-side `page`/`size` via the shared shell (payment-module pagination rule — CLAUDE.md §12a). Totals footer required.

## Dialogs/Popups
- Excel-upload dialog; Request Approval dialog; Approval Details popup (Approve / Reject / kebab Edit approval-line / Withdraw).

## API Integration
[`lib/api/payrollPayment.ts`](../../../../lib/api/payrollPayment.ts):
- `GET /api/v1/payment/payroll-payment` (list) · `GET …/{id}` (detail for Approval Ref / Request Approval) · `GET …/withdrawal-accounts` · `POST …/uploads/parse` · `POST …` (create draft) · `DELETE …/{id}` · `POST …/{id}/request-approval` · `POST …/{id}/approval-action` · `DELETE …/{id}/approval` · `PUT …/{id}/approval-line` · `POST …/{id}/dispatch` · `GET …/{id}/file`.

## Validation
- Excel rows validated per-row at parse time; pre-flight banking cut-off-time guard on Transfer (`validateBankingTime`); Delete blocked once an approval request exists (`WBE2062`).

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result.md](./payment-result.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: [wecms-api/docs/features/payment/payroll/README.md](../../../../../wecms-api/docs/features/payment/payroll/README.md)
- Shared pattern baseline: [internal-transfer.md](../internal-transfer/README.md)
