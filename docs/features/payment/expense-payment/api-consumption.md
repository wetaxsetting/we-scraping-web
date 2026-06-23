# Expense Payment — API Consumption (Web)

> **Frontend doc.** Client = [`lib/api/expensePayment.ts`](../../../../lib/api/expensePayment.ts). Backend contract: [wecms-api/docs/features/payment/expense-payment/interface-specification.md](../../../../../wecms-api/docs/features/payment/expense-payment/interface-specification.md) _(wecms-api repo)_.
> Wire format = lowercase snake_case ↔ camelCase mappers. Verified 2026-06-23.

Base: `/api/v1/payment/expense-payment`. **Full client implemented** (~18 functions — not a stub).

## Scheduled Payment

| Function | Endpoint |
|---|---|
| `fetchExpenseScheduledList` | `GET /` |
| `fetchExpensePaymentDetail` | `GET /{id}` |
| `fetchExpenseWithdrawalAccounts` | `GET /withdrawal-accounts` |
| `parseExpensePaymentExcel` | `POST /uploads/parse` (multipart) |
| `createExpensePayment` | `POST /` (multipart) |
| `deleteExpensePayment` | `DELETE /{id}` |
| `requestExpenseApproval` | `POST /{id}/request-approval` (multipart) |
| `actOnExpenseApproval` | `POST /{id}/approval-action` |
| `withdrawExpenseApproval` | `DELETE /{id}/approval` |
| `changeExpenseApprovalLine` | `PUT /{id}/approval-line` |
| `updateExpenseReportingAccount` | `PATCH /{id}/lines/{lineId}/reporting-account` |
| `dispatchExpensePayment` | `POST /{id}/dispatch` |
| `downloadOriginalExpenseExcel` | `GET /{id}/file` |
| `getExpenseMatchCandidates` | `GET /{id}/lines/{lineId}/match/candidates` |
| `matchExpensePaymentLine` | `POST /{id}/lines/{lineId}/match` |
| `unmatchExpensePaymentLine` | `DELETE /{id}/lines/{lineId}/match` |
| `unmatchAllExpensePaymentLines` | `DELETE /{id}/matches` |

## Payment Result

| Function | Endpoint |
|---|---|
| `fetchExpensePaymentResultList` | `GET /results` |
| `fetchExpensePaymentResultDetail` | `GET /results/{id}` |
| (Excel export) | `POST /results/export` |
| `downloadOriginalExpenseExcel` | `GET /{id}/file` (F2 `W` ERP audit) |

## Notes
- Result list status checkboxes map to `trnf_stts` Completed (`C`) / In Progress (`P`).
- Approval Ref + Title come from `EXPT_RESOL_MSTR` (`DOC_NO` / `TITL`), surfaced on each row.
- **Stale comment (code-comment cleanup MR, do not edit in docs pass):** the client's header Javadoc + several docstrings carry "Vendor / Phase A / `'01'` vs `'03'`" copy-paste artifacts — code is correct (`SCDUL_PYMN_TYPE_CD = "02"`).

---

Last verified: 2026-06-23.
