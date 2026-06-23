# Payroll > Scheduled Payment Details — Web (Refactor)

**Module:** Payment → Payroll · **Screen:** Scheduled Payment Details
**Route:** `/payment/payroll/scheduled-payment/[id]` · **JEX:** `pymn_0005_003`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Drill-down detail of one scheduled payroll batch — withdrawal-account summary, the original Excel file card, and the per-payee transaction lines. A **route**, not a dialog (CLAUDE.md §12).

## Route/Page
- `app/(dashboard)/payment/payroll/scheduled-payment/[id]/page.tsx` → [`<PayrollScheduledPaymentDetailPage>`](../../../../components/payment/payroll/ScheduledPaymentDetailPage.tsx). `params: Promise<{ id }>` (Next.js 16); unknown id → `notFound()` (`WBE2060`). Figma 27:12163.

## Components
- Shared [`<PaymentDetailPage>`](../../../../components/payment/shared/PaymentDetailPage.tsx) — DetailSummary + FileCard + inner line table + hidden pagination.
- Column set built from the canonical `scheduledDetailColumns` factory, projected to the Payroll **5-column legacy subset** via View Setting (no Description / Document No. / Banking Transaction ID — Payroll legacy does not render those on the per-payee line).

## Detail summary
Withdrawal Bank · Account No (`accountNumber (currency)`) · Total Transfer Amount · Approval Ref (`DOC_NO`) · Requestor (`DRAFT_USER_NM`, blank for drafts — never `reg_id`).

## Table Columns (5-column Payroll subset, View-Setting driven)
Deposit Bank (`TAR_BANK_CD`) · Recipient Name (`RCPT_NM`) · Transfer Amount (`TRAN_AMT`) · Remarks (`TRAN_USAG`) · Reporting Account (`CHART_ACCT_CD`).
- Reporting Account renders an inline chart-of-accounts picker (`PATCH …/{id}/lines/{lineId}/reporting-account`), sourced from `fetchChartOfAccounts`.

## Sorting
- Client-side over the fetched line array (`enableSort`); per-column `sortable` + `sortValue` from `scheduledDetailColumns`.

## Pagination
- **Hidden** — detail pages never show pagination (CLAUDE.md §12a).

## Dialogs/Popups
- View Setting popover; system dialogs via `useDialog()`.

## API Integration
- `GET /api/v1/payment/payroll-payment/{id}` (master + lines) · `PATCH …/{id}/lines/{lineId}/reporting-account` · `GET …/{id}/file` (download original Excel) · `GET /api/v1/settings/chart-of-accounts` (reporting-account picker options).

## Validation
- Reporting-account save errors surface via `useDialog()` with optimistic rollback of the local override.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment.md](./scheduled-payment.md) · [payment-result.md](./payment-result.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: [wecms-api/docs/features/payment/payroll/README.md](../../../../../wecms-api/docs/features/payment/payroll/README.md)
- Shared pattern baseline: [internal-transfer.md](../internal-transfer/README.md)
