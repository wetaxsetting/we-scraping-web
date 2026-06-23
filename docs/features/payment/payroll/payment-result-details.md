# Payroll > Payment Result Details — Web (Refactor)

**Module:** Payment → Payroll · **Screen:** Payment Result Details
**Route:** `/payment/payroll/payment-result/[id]` · **JEX:** `pymn_0006_002`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Per-payee result detail (Success / Failed + failure reason) for one executed payroll batch, plus the batch-level **Banking Match** flow. A **route**, not a dialog (CLAUDE.md §12).

## Route/Page
- `app/(dashboard)/payment/payroll/payment-result/[id]/page.tsx` → [`<PayrollPaymentResultDetailPage>`](../../../../components/payment/payroll/PaymentResultDetailPage.tsx). `params: Promise<{ id }>`; unknown id → `notFound()` (`WBE2060`). Figma 27:13703. (Result detail navigates by numeric `SCDUL_PYMN_NO` only — the backend rejects `DOC_NO` here.)

## Components
- Shared [`<ResultDetailView>`](../../../../components/payment/shared/ResultDetailView.tsx) — DetailSummary + FileCard + status tabs + inner result-line table + hidden pagination.
- Column set built from the **canonical `resultDetailColumns` factory** (the same 11-column source every Result detail uses), projected to the Payroll **8-column legacy subset** via View Setting (no Description / Document No. / Banking Transaction ID — `pymn_0006_002` does not render those).
- [`<PayrollMatchDialog>`](../../../../components/payment/payroll/PayrollMatchDialog.tsx) — Banking Match popup.

> **Correction:** the Result detail is **not** a bespoke "5-column Payroll-specific layout". It consumes the shared canonical `resultDetailColumns` and shows 8 of them, gated by the View Setting seed (`payment-payroll-payment-result-detail`). The Scheduled detail is the 5-column subset; the Result detail is the 8-column subset.

## Detail summary
Withdrawal Bank · Account No (`accountNumber (currency)`) · Total Transfer Amount · Approval Ref (`DOC_NO`) · Requestor (`DRAFT_USER_NM`, falls back to `reg_id`).

## Table Columns (8-column Payroll subset, View-Setting driven)
Date/Time (`PROC_DTTM`) · Deposit Bank (`TAR_BANK_CD`) · Recipient Name (`RCPT_NM`) · Transfer Amount (`TRAN_AMT`) · Remarks (`TRAN_USAG`) · Results (`RS_CD`) · Result Date/Time (`RSLT_DTTM`) · Reporting Account (`CHART_ACCT_CD`).
- Per-line result status via `deriveResultStatus`; Reporting Account renders the chart-acct name + level breadcrumb (read-only on the Result detail).

## Banking Match (legacy `pymn_0006_002` + `comm_0197_*` batch path)
Header action by state: matched (`LINK_MATCH_YN='Y'`) → matched-ref link + **Unmatch**; transfer complete (`prc_cnt === 0`) → **Match to Banking Transaction** (opens `<PayrollMatchDialog>`); still processing → no action. Batch-level (1:1); **no Unmatch-All** for Payroll.

## Sorting
- Client-side over the fetched line array (`enableSort`).

## Pagination
- **Hidden** — detail pages never show pagination (CLAUDE.md §12a).

## Dialogs/Popups
- Banking Match popup (`<PayrollMatchDialog>`); View Setting popover; system dialogs via `useDialog()`.

## API Integration
[`lib/api/payrollPayment.ts`](../../../../lib/api/payrollPayment.ts):
- `GET /api/v1/payment/payroll-payment/results/{id}` (detail) · `GET …/{id}/file` (download original Excel) · `GET …/{id}/match/candidates` · `POST …/{id}/match` · `DELETE …/{id}/match` (unmatch).

## Validation
- Unmatch confirmed via `useDialog()` confirmation; match/download errors surfaced via `useDialog()` (`WBE2069` download → warning variant).

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment.md](./scheduled-payment.md) · [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result.md](./payment-result.md)
- API counterpart: [wecms-api/docs/features/payment/payroll/README.md](../../../../../wecms-api/docs/features/payment/payroll/README.md)
- Shared pattern baseline: [internal-transfer.md](../internal-transfer/README.md)
