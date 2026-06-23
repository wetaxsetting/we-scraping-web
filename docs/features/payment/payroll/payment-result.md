# Payroll > Payment Result — Web (Refactor)

**Module:** Payment → Payroll · **Screen:** Payment Result
**Route:** `/payment/payroll/payment-result` · **JEX:** `pymn_0006_001`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Executed payroll results with a two-status filter (**Completed / In Progress**). Mirrors the Internal Transfer / Vendor / Expense Result baseline via the shared [`<PaymentResultBatchListPage>`](../../../../components/payment/shared/PaymentResultBatchListPage.tsx), plus the Payroll-only **Payroll Type** column.

## Route/Page
- `app/(dashboard)/payment/payroll/payment-result/page.tsx` → [`<PayrollPaymentResultPage>`](../../../../components/payment/payroll/PaymentResultPage.tsx). Figma 27:12877.

## Components
- Shared `<PaymentResultBatchListPage>` (canonical 8-column shell + status counter pills + totals footer + pagination + per-row download glyph). Payroll Type rides in the shared `extraColumns` slot between Total Transfer Amount and Transfer Status.

## Filters
- Period dropdown (30/90/180 days + manual range) + calendar chip + **Completed / In Progress checkboxes** + SearchInput. The two checkboxes map to backend `trnf_stts`: only Completed → `C`, only In Progress → `P`, neither/both → no filter (route-aware `PROC_STAT` filter). *(Mirror of Internal Transfer Result, Figma 1:11730 — not a 4-status dropdown.)*

## Table Columns
Date/Time (`TRAN_DT`) · File Name (`FILE_NM`) · No. of Transactions (`SCDUL_PYMN_DETL_NO`) · Total Transfer Amount (`TRAN_AMT`) · **Payroll Type (`APPR_FUND_TP`)** · Transfer Status (`PROC_STAT`) · Approval Ref. (`APPR_DOC_NO`) · Approval Title (`TITL`) · trailing download glyph.
- Status is the legacy two-status rule (`in_progress` until dispatched AND `succ + err >= total`, else `completed`).
- Payroll Type list label map: `"0"` → Salary, `"1"` → Bonus, else blank (no bank override on the list).
- Approval Ref is a clickable Approval-Details link (F4b) when `appr_seq_no` is present.

## Sorting
- Server-side via `useTableSort`; whitelist `SORTABLE_COLUMNS` → backend `PayrollPaymentResultSortField`. `APPR_FUND_TP` sorts via the extra column's own `sortFieldId`.

## Pagination
- Server-side `page`/`size` (CLAUDE.md §12a). Totals footer required for Payroll Result.

## Dialogs/Popups
- Result detail is a route (not a dialog). System dialogs via `useDialog()`.

## API Integration
[`lib/api/payrollPayment.ts`](../../../../lib/api/payrollPayment.ts):
- `GET /api/v1/payment/payroll-payment/results` (list) · `POST …/results/export` (Excel export, via shared `useExcelExport`) · `GET …/{id}/file` (per-row original Excel download).

## Validation
- Filter params validated client-side; export errors surfaced via `useDialog()`.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment.md](./scheduled-payment.md) · [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: [wecms-api/docs/features/payment/payroll/README.md](../../../../../wecms-api/docs/features/payment/payroll/README.md)
- Shared pattern baseline: [internal-transfer.md](../internal-transfer/README.md)
