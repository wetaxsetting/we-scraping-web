# Expense Payment — Screen Flow (Web)

> **Frontend doc.** Backend counterpart: [wecms-api/docs/features/payment/expense-payment/business-flow.md](../../../../../wecms-api/docs/features/payment/expense-payment/business-flow.md) _(wecms-api repo)_.
> Source of truth = latest code under `components/payment/expense-payment/**` + `lib/api/expensePayment.ts`. Verified 2026-06-23.

Two sub-modules, each with a list + detail drill-down:
- **Scheduled Payment** — `/payment/expense-payment/scheduled-payment` (+ `[id]`)
- **Payment Result** — `/payment/expense-payment/payment-result` (+ `[id]`)

## Scheduled Payment flow

```
Scheduled list (page.tsx → ExpenseScheduledPaymentPage)
  │  filters: date range, keyword, approval status
  ├─ Upload Excel  → <ExpensePaymentUploadDialog>
  │      parseExpensePaymentExcel → preview/validate → createExpensePayment (draft)
  ├─ row click     → /scheduled-payment/[id] (ExpenseScheduledPaymentDetailPage)
  │      master summary + file card + per-line table (chart-account / reporting-account picker) + approver chain + attachments
  ├─ Request Approval → requestExpenseApproval (multipart + attachments)
  ├─ Approval Details popup (kebab):
  │      Approve/Reject → actOnExpenseApproval
  │      Delete (withdraw) → withdrawExpenseApproval
  │      Edit (change line) → changeExpenseApprovalLine
  ├─ Reporting Account picker → updateExpenseReportingAccount (PATCH)
  ├─ Banking Match (per line) → getExpenseMatchCandidates / matchExpensePaymentLine / unmatch*
  ├─ Transfer (dispatch) → dispatchExpensePayment (cut-off pre-flight; approval gate)
  ├─ Delete draft → deleteExpensePayment
  └─ Download original Excel → downloadOriginalExpenseExcel
```

## Payment Result flow

```
Result list (page.tsx → ExpensePaymentResultPage)
  │  filters: period dropdown + calendar, keyword, status checkboxes (Completed C / In Progress P)
  │  totals footer rendered (Expense renders it, unlike Internal Transfer)
  ├─ Approval Ref (clickable, F4b)
  ├─ per-row download glyph → downloadOriginalExpenseExcel (F2 W ERP audit)
  ├─ Excel export → POST /results/export
  └─ row click → /payment-result/[id] (ExpensePaymentResultDetailPage)
        header tabs: All / Success / Failed / In Progress (countByStatus)
        rows: canonical 11-column resultDetailColumns
```

## Status mapping (FE)
- Approval status badges: approved / rejected (`R`) / pending — derived server-side.
- Result list filter checkboxes → `trnf_stts` Completed (`C`) / In Progress (`P`).
- Result detail per-line chips → Success / Failed / In Progress.

---

Last verified: 2026-06-23. Per-screen detail: [scheduled-payment.md](./scheduled-payment.md) · [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result.md](./payment-result.md) · [payment-result-details.md](./payment-result-details.md).
