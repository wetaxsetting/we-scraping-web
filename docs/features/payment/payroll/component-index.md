# Payroll — Component Index (Web)

> Frontend feature doc. Hub: [README.md](README.md). Paths verified 2026-06-23. Backend index: [wecms-api/.../payroll/source-code-index.md](../../../../../wecms-api/docs/features/payment/payroll/source-code-index.md).

## Routes (`app/(dashboard)/payment/payroll/`)

| Route | page.tsx export | Component |
|---|---|---|
| `scheduled-payment/page.tsx` | `PaymentPayrollScheduledPage` | `<PayrollScheduledPaymentPage>` |
| `scheduled-payment/[id]/page.tsx` | `PaymentPayrollScheduledDetailRoute` | `<PayrollScheduledPaymentDetailPage>` |
| `payment-result/page.tsx` | `PaymentPayrollResultPage` | `<PayrollPaymentResultPage>` |
| `payment-result/[id]/page.tsx` | `PaymentPayrollResultDetailRoute` | `<PayrollPaymentResultDetailPage>` |

## Feature components (`components/payment/payroll/`)

| File | Role |
|---|---|
| `ScheduledPaymentPage.tsx` | Scheduled list — composes `<PaymentScheduledBatchListPage>`; Payroll Type via `extraColumnAfterStatus`, Scheduled Date via `extraColumn` |
| `ScheduledPaymentDetailPage.tsx` | Scheduled detail — composes `<PaymentDetailPage>`; 5-column subset of `scheduledDetailColumns` via View Setting |
| `PaymentResultPage.tsx` | Result list — composes `<PaymentResultBatchListPage>`; Payroll Type via `extraColumns`; Excel export + per-row download |
| `PaymentResultDetailPage.tsx` | Result detail — composes `<ResultDetailView>`; 8-column subset of `resultDetailColumns` via View Setting; Banking Match |
| `PayrollPaymentUploadDialog.tsx` | Excel-upload dialog (template → browse → preview → save) |
| `PayrollMatchDialog.tsx` | Result-detail Banking Match popup |
| `types.ts` | Local row types (`PayrollScheduledRow`, `PayrollResultRow`) |

## Shared components consumed (`components/payment/shared/`)
`PaymentScheduledBatchListPage`, `PaymentDetailPage`, `PaymentResultBatchListPage`, `ResultDetailView`, `RequestApprovalDialog` (`kind="payroll"`), `ApprovalDetailsDialog` (`kind="payroll"`), `PaymentExcelUploadDialog`, `deriveResultStatus`.

## Hooks / lib
- `useViewSetting` + `<ViewSettingPopover>` (keyed by `lib/viewSettingScreens.ts`).
- `useTableSort` (list sorting), `useExcelExport` (result export), `useDialog` (system dialogs).
- Wire types: `lib/types/api.ts` (reuses Internal Transfer shapes — `ApiScheduledTransferRow`, `ApiTransferResultRow`, etc., plus `appr_fund_tp`).

## API client
[`lib/api/payrollPayment.ts`](../../../../lib/api/payrollPayment.ts) — see [api-consumption.md](api-consumption.md).
