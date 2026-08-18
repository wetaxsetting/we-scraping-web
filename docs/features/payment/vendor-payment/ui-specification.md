# Vendor Payment — UI Specification (Frontend)

> **Backend counterpart:** [wecms-api/…/interface-specification.md](../../../../../wecms-api/docs/features/payment/vendor-payment/interface-specification.md). Per-screen detail: [scheduled-payment.md](scheduled-payment.md) · [scheduled-payment-details.md](scheduled-payment-details.md) · [payment-result.md](payment-result.md) · [payment-result-details.md](payment-result-details.md).

Vendor Payment uses the shared payment batch-list / detail shells. All sizing goes through the shared `text-wb-*` / `wb-status-*` tokens — no inline px. Vendor mirrors the Internal Transfer shape and reuses its shared components; the one visible divergence is that the **Result totals footer is rendered** (Internal Transfer omits it).

---

## 1. Scheduled Payment — list

```
PageLayout
├── PageHeader  title="Scheduled Payment"  → PageActionButtons (Upload · List/ViewSetting · Print · Excel)
├── FilterBar   (period dropdown · keyword · approval-status dropdown)
└── DataTableShell footerMode="paginationWithTotals"
    ├── PaymentScheduledBatchListPage (shared shell)
    ├── footer:  totals bar
    └── Pagination
+ VendorPaymentUploadDialog · RequestApprovalDialog · ApprovalDetailsDialog · ViewSettingPopover
```

- **Filters:** period (30/90/180d + manual range), keyword `SearchInput`, approval-status dropdown (All / Not Requested / Pending / In Progress / Approved / Rejected → `""`/`00`/`04`/`03`/`01`/`02`).
- **Columns** (View-Setting-driven, V156 seed): Date/Time · File Name · No. of Transactions · Total Transfer Amount · Scheduled Date · Approval Status · Requestor · Approver · Approval Ref · Approval Title. CHECKBOX + ETC are special non-reorderable columns.
- **Sorting:** sortable headers (`useTableSort` → `VendorPaymentSortField`). APPROVER renders a glyph but is the deferred column (backend default ORDER BY).
- **Pagination:** server-side; **totals footer rendered**.
- **Status badge:** `wb-status-*` token map (draft / pending / in_progress / approved / rejected); renders `"{label} {step}"` for in-progress (e.g. "In Progress 1/3").

## 2. Scheduled Payment — detail

`<PaymentDetailPage>` shell: DetailHeader breadcrumb + Back · DetailSummary (withdrawal bank/account, total, requestor, **Approval Ref**) · FileCard (download glyph) · inner per-line table (`scheduledDetailColumns`: Deposit Bank, Recipient, Transfer Amount, Remarks, **Reporting Account picker**, Description, Document No.). No pagination footer (`<Pagination hidden>`). The reporting-account picker is an inline chart-of-accounts tree popover.

## 3. Payment Result — list

```
PageLayout
├── PageHeader  title="Payment Result"  → PageActionButtons (List/ViewSetting · Print · Excel)
├── FilterBar   (period · keyword · Completed/In-Progress checkboxes)
└── DataTableShell footerMode="paginationWithTotals"
    ├── PaymentResultBatchListPage (shared shell — totals footer rendered)
    └── Pagination
+ ViewSettingPopover
```

- **Filters:** period, keyword, **Completed / In-Progress checkboxes** → `trnf_stts` `C` / `P`.
- **Columns:** Date/Time · File Name · No. of Transactions · Total Transfer Amount · Transfer Status · Approval Ref · Approval Title. Approval Ref is a `<button class="text-brand hover:underline">` (F4b) when `appr_seq_no` present.
- **Footer totals** computed **unfiltered** by the status checkboxes (R008).
- **Row action:** original-Excel download (F2 'W' audit on dispatched batches).

## 4. Payment Result — detail

`<ResultDetailView>` shell: DetailHeader + Back · DetailSummary · `<DetailStatusTabs>` (All / Success / Failed / In Progress — client-side filter; counts from `countByStatus`) · canonical 11-column `resultDetailColumns` table (Date/Time, Deposit Bank, Recipient Name, Transfer Amount, Remarks ⓘ, Results, Result Date/Time, Reporting Account, Description, Document No., Banking Transaction ID). `<PaymentResultBadge>` for the success/failed/pending ramp. No pagination footer.

## 5. Dialogs / popups

| Dialog | Trigger | Action |
|---|---|---|
| Excel-upload preview (`VendorPaymentUploadDialog`) | Upload button | parse → confirm → create draft |
| Request Approval (`RequestApprovalDialog`) | row/detail action | multipart submit with attachments |
| Approval Details (`ApprovalDetailsDialog`) | clickable Approval Ref | read-only + edit (withdraw / change-line via `EditApprovalLinePicker`) |
| View Setting (`ViewSettingPopover`) | List icon | column visibility/order |
| Confirm / error (`useDialog`) | transfer / delete | system dialogs |

## 6. Empty / loading / pagination

- Loading + empty use the shared placeholders (`text-wb-13`).
- Pagination is server-side on the list pages; detail pages render `<Pagination hidden>` (payment-module rule §12a).

## 7. i18n / typography

All copy via `t(...)`. Tables use `text-wb-13` (header `font-semibold`, body `font-medium`). Sizing through shared tokens only — no inline px (root `CLAUDE.md` Global Typography).
