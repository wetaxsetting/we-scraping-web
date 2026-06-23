# Expense Payment — Component Index (Web)

> **Frontend doc.** Source of truth = latest code under `wecms-web/`. Verified 2026-06-23.
> Backend counterpart: [wecms-api/docs/features/payment/expense-payment/source-code-index.md](../../../../../wecms-api/docs/features/payment/expense-payment/source-code-index.md) _(wecms-api repo)_.

## Routes — `app/(dashboard)/payment/expense-payment/`

| Route | page export | Component |
|---|---|---|
| `scheduled-payment/page.tsx` | `PaymentExpenseScheduledPage` | `ExpenseScheduledPaymentPage` |
| `scheduled-payment/[id]/page.tsx` | `PaymentExpenseScheduledDetailRoute` | `ExpenseScheduledPaymentDetailPage` |
| `payment-result/page.tsx` | `PaymentExpenseResultPage` | `ExpensePaymentResultPage` |
| `payment-result/[id]/page.tsx` | `PaymentExpenseResultDetailRoute` | `ExpensePaymentResultDetailPage` |

## Components — `components/payment/expense-payment/`

| File | Role | Composes |
|---|---|---|
| `ScheduledPaymentPage.tsx` | Scheduled list (exports `ExpenseScheduledPaymentPage`) | `<PaymentScheduledBatchListPage>` (Expense `extraColumn` Schedule Date) |
| `ScheduledPaymentDetailPage.tsx` | Scheduled detail | `<PaymentDetailPage>` |
| `PaymentResultPage.tsx` | Result list (totals footer rendered) | `<PaymentResultBatchListPage>` |
| `PaymentResultDetailPage.tsx` | Result detail | `<ResultDetailView>` (11-column `resultDetailColumns`) |
| `ExpensePaymentUploadDialog.tsx` | Excel-upload dialog (Expense column set + parse/upload handlers) | `<PaymentExcelUploadDialog>` |
| `types.ts` | Local component types | — |

## API client / config

| File | Role |
|---|---|
| `lib/api/expensePayment.ts` | ~18 functions — see [api-consumption.md](./api-consumption.md) |
| `lib/viewSettingScreens.ts` | 4 SCREEN_IDS: `PAYMENT_EXPENSE_PAYMENT_SCHEDULED`, `…_SCHEDULED_DETAIL`, `…_RESULT`, `…_RESULT_DETAIL` |
| `lib/types/api.ts` | Shared wire DTOs (`SCDUL_PYMN_SUMR` table shared with Internal Transfer/Vendor) |

## Shared payment components reused (do not fork)
`<PaymentScheduledBatchListPage>`, `<PaymentResultBatchListPage>`, `<PaymentDetailPage>`, `<ResultDetailView>`, `<PaymentExcelUploadDialog>`, Approval Details popup, `deriveResultStatus.ts` classifier.

---

Last verified: 2026-06-23.
