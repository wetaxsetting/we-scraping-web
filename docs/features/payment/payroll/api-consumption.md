# Payroll — API Consumption (Web)

> Frontend feature doc. Hub: [README.md](README.md). All calls go through [`lib/api/payrollPayment.ts`](../../../../lib/api/payrollPayment.ts). Base **`/api/v1/payment/payroll-payment`** (note `-payment`, not `/payroll`). Backend contract: [wecms-api/.../payroll/interface-specification.md](../../../../../wecms-api/docs/features/payment/payroll/interface-specification.md).

Wire format is lowercase snake_case; the page components map snake_case ↔ camelCase. Wire types reuse Internal Transfer shapes from `lib/types/api.ts`.

## Client functions → endpoints

| Client fn (`payrollPayment.ts`) | Endpoint |
|---|---|
| `fetchPayrollScheduledList` | `GET /` |
| `fetchPayrollPaymentDetail` | `GET /{id}` |
| `fetchPayrollPaymentResultList` | `GET /results` |
| `fetchPayrollPaymentResultDetail` | `GET /results/{id}` |
| (`useExcelExport`) | `POST /results/export` |
| `fetchPayrollWithdrawalAccounts` | `GET /withdrawal-accounts` |
| `parsePayrollPaymentExcel` | `POST /uploads/parse` (multipart) |
| `createPayrollPayment` | `POST /` (multipart) |
| `deletePayrollPayment` | `DELETE /{id}` |
| `requestPayrollApproval` | `POST /{id}/request-approval` (multipart, attachments) |
| `actOnPayrollApproval` | `POST /{id}/approval-action` |
| `withdrawPayrollApproval` | `DELETE /{id}/approval` |
| `changePayrollApprovalLine` | `PUT /{id}/approval-line` |
| `updatePayrollReportingAccount` | `PATCH /{id}/lines/{lineId}/reporting-account` |
| `dispatchPayrollPayment` | `POST /{id}/dispatch` |
| `fetchPayrollMatchCandidates` | `GET /{id}/match/candidates` |
| `matchPayrollBatch` | `POST /{id}/match` |
| `unmatchPayrollBatch` | `DELETE /{id}/match` |
| `downloadOriginalPayrollExcel` | `GET /{id}/file` |

## Query params
- Scheduled list (`PayrollScheduledListQuery`): `from_date`, `to_date`, `srch_wd`, `appr_type`, `sort_field`, `sort_direction`, `page`, `size`.
- Result list (`PayrollPaymentResultListQuery`): same minus `appr_type`, plus `trnf_stts` (`"C"` | `"P"`).

## Error handling
`unwrap<T>` extracts `body.data`, throwing `ApiCallError(code, message)` on `status.error` or a network failure (`WBE_NETWORK`). The file-download path parses an error `Blob` body into `ApiCallError` so failures surface a proper message (e.g. `WBE2069` → warning dialog). Errors are surfaced via `useDialog()`.

## Notes
- Per-screen API tables: [scheduled-payment.md](scheduled-payment.md), [scheduled-payment-details.md](scheduled-payment-details.md), [payment-result.md](payment-result.md), [payment-result-details.md](payment-result-details.md).
- **G-PAYR-2 (export gap):** the Result Excel export currently ships the **Payroll Type** column blank — backend follow-up; FE wiring is correct.
