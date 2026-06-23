# Expense Payment — UI Specification (Web)

> **Frontend doc.** Backend counterpart: [wecms-api/docs/features/payment/expense-payment/functional-specification.md](../../../../../wecms-api/docs/features/payment/expense-payment/functional-specification.md) _(wecms-api repo)_.
> Source of truth = latest code. Verified 2026-06-23. Both lists render through the shared payment batch-list shells, so column/typography conventions match the rest of the payment family.

**Per-screen docs:** [scheduled-payment.md](scheduled-payment.md) · [scheduled-payment-details.md](scheduled-payment-details.md) · [payment-result.md](payment-result.md) · [payment-result-details.md](payment-result-details.md).

## Scheduled Payment (list)

- **Filters:** date range, keyword (`srch_wd`), approval status.
- **Shell:** `<PaymentScheduledBatchListPage>` + Expense `extraColumn` Schedule Date slot.
- **Columns:** Checkbox · Date/Time · File Name · No. of Transactions · Total Transfer Amount · Scheduled Date (`PAY_DATE`) · Approval Status · Requestor (`DRAFT_USER_NM`) · Approver · Approval Ref (`EXPT_RESOL_MSTR.DOC_NO`) · Approval Title · Action.
- **Summary / footer:** currency totals footer under Total Transfer Amount.
- **Sorting:** sortable headers via View Setting FIELD_ID (shared payment sort whitelist).
- **Pagination:** server-side `page`/`size` (payment-module rule, all 5 families).
- **Empty state:** shared empty-list placeholder.
- **Dialogs:** Excel-upload (`<ExpensePaymentUploadDialog>`), request-approval confirm, Approval Details popup.
- **Upload/download:** Excel upload via dialog; original-file download glyph per row.
- **Approval actions:** Request Approval, Approve/Reject, Withdraw (Delete), Edit (change line) on the Approval Details popup.

## Scheduled Payment Details

- **Shell:** `<PaymentDetailPage>`.
- **Master summary:** Withdrawal Bank · Account No · Total Transfer Amount · Approval Ref · Requestor.
- **File card:** original Excel download.
- **Per-line table:** chart-account breadcrumb + inline Reporting Account picker (PATCH late-bind).
- **Approver chain** + combined attachments (`EXPT_RESOL_FILE ∪ EXPT_RESOL_PAY_EVID_FILE`).

## Payment Result (list)

- **Filters:** period dropdown + calendar, keyword, status checkboxes → `trnf_stts` Completed (`C`) / In Progress (`P`).
- **Shell:** `<PaymentResultBatchListPage>`.
- **Columns:** Date/Time · File Name · No. of Transactions · Total Transfer Amount · Transfer Status · Approval Ref (**clickable, F4b**) · Approval Title · per-row download glyph.
- **Summary / footer:** totals footer **rendered** (Expense renders it, unlike Internal Transfer); computed across the full dispatched set regardless of filter.
- **Sorting / pagination:** as Scheduled.
- **Download:** per-row original-Excel download (F2 — `W` ERP audit); list Excel export.

## Payment Result Details

- **Shell:** `<ResultDetailView>` with canonical 11-column `resultDetailColumns`.
- **Header tabs:** All / Success / Failed / In Progress — counts from `ExpensePaymentResultService.countByStatus`; filter the per-line rows in place.
- **Columns (11):** Date/Time · Deposit Bank · Recipient Name · Transfer Amount · Remarks ⓘ · Results · Result Date/Time · Reporting Account · Description · Document No. · Banking Transaction ID.

## Typography
All text uses the shared WeCMS Tailwind tokens (see workspace CLAUDE.md Global Typography). No ad-hoc font sizes.

---

Last verified: 2026-06-23.
