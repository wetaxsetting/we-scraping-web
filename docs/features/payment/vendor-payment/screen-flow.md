# Vendor Payment — Screen Flow (Frontend)

> **Backend counterpart:** [wecms-api/docs/features/payment/vendor-payment/business-flow.md](../../../../../wecms-api/docs/features/payment/vendor-payment/business-flow.md). Per-screen detail: [scheduled-payment.md](scheduled-payment.md) · [scheduled-payment-details.md](scheduled-payment-details.md) · [payment-result.md](payment-result.md) · [payment-result-details.md](payment-result-details.md).

Two sub-modules, four routes, one shared shell family. Route protection is the `(dashboard)` layout guard; menu access via `lib/menuAuth.ts` (`payment-vendor-scheduled` / `payment-vendor-result`). **Implemented full-stack** — server-driven pagination/sort/filter; no mock fallback.

| Sub-module | List route | Detail route | Component |
|---|---|---|---|
| Scheduled Payment | `/payment/vendor-payment/scheduled-payment` | `…/[id]` | `VendorScheduledPaymentPage` / `…DetailPage` |
| Payment Result | `/payment/vendor-payment/payment-result` | `…/[id]` | `VendorPaymentResultPage` / `…DetailPage` |

---

## 1. Scheduled Payment — list

1. `VendorScheduledPaymentPage` composes `<PaymentScheduledBatchListPage>` (shared batch-list shell) + the upload / approval dialogs + `<ViewSettingPopover>`.
2. Initial load fires `GET /api/v1/payment/vendor-payment` with the default period preset, no keyword, all-status, page 0.
3. **Filters:** period dropdown (30/90/180d + manual range), keyword, approval-status dropdown (All / Not Requested / Pending / In Progress / Approved / Rejected → `""`/`00`/`04`/`03`/`01`/`02` via `appr_type`). Every setter resets the page to 0.
4. **Sort:** sortable headers via `useTableSort` → View Setting `FIELD_ID` → `VendorPaymentSortField`; DB does the ORDER BY. APPROVER (`APPRVR_NM`) renders a glyph but the backend falls back to default ORDER BY (deferred, PARTIAL).
5. **Pagination + totals footer** rendered server-side.

## 2. Upload → request approval → transfer

1. **Upload** — `<VendorPaymentUploadDialog>` (thin wrapper over the shared Excel-upload preview dialog): pick a withdrawal account → choose a file → `parseVendorPaymentExcel(file, bankCd)` previews + per-line validates → confirm → `createVendorPayment(file, request)` saves the draft.
2. **Request Approval** — `<RequestApprovalDialog>`: pick the approval line + optional attachments → `requestVendorApproval` (multipart, attachments persist to `EXPT_RESOL_FILE`).
3. **Approve / reject / withdraw / change-line** — from the `<ApprovalDetailsDialog>` opened on the clickable Approval Ref (read-only + edit modes via `<EditApprovalLinePicker>`): `actOnVendorApproval` / `withdrawVendorApproval` / `changeVendorApprovalLine`.
4. **Transfer (dispatch)** — `dispatchVendorPayment` (cut-off-time guarded). After any mutation the list refetches.

## 3. Scheduled Payment — detail (`[id]` route)

`VendorScheduledPaymentDetailPage` composes `<PaymentDetailPage>` (DetailHeader breadcrumb + Back, DetailSummary, FileCard, inner line table). The inner per-line table uses `scheduledDetailColumns` with an inline reporting-account (chart-of-accounts) picker → `updateVendorReportingAccount` persists the picked code. `<Pagination hidden>` (detail pages have no footer). `{id}` accepts numeric `scdul_pymn_no` or `DOC_NO`. `GET .../{id}/file` downloads the original Excel.

## 4. Payment Result — list

1. `VendorPaymentResultPage` composes `<PaymentResultBatchListPage>` (**totals footer rendered**, unlike Internal Transfer) + `<ViewSettingPopover>`.
2. `GET .../results`. **Filters:** period, keyword, **Completed / In-Progress checkboxes** → `trnf_stts` `C` / `P` (route-aware `PROC_STAT`; both/neither = no filter).
3. **Footer totals are computed unfiltered** by the status checkboxes (R008 parity) — they stay stable while the row list narrows.
4. **Approval Ref** (`DOC_NO` from `EXPT_RESOL_MSTR`) is clickable (F4b) when the batch carries an `appr_seq_no`.
5. **Export** → `useExcelExport` → `POST .../results/export`. **Per-row download** → `downloadOriginalVendorExcel` (a dispatched-batch download writes the ERP 'W' / `VENDOR_PAYMENT_RESULT` audit row, F2).

## 5. Payment Result — detail (`[id]` route)

`VendorPaymentResultDetailPage` composes `<ResultDetailView>` (DetailHeader + Back, DetailSummary, `<DetailStatusTabs>`, canonical 11-col `resultDetailColumns`). Header tabs (All / Success / Failed / In Progress) filter the line list client-side; counts `[success, failed, inProgress]` are derived server-side (`countByStatus`). Per-line status from the dispatch-result resolver (`proc_stat` / `rs_cd`); `<PaymentResultBadge>` renders the ramp. `GET .../results/{id}`.

## 6. Loading / empty / error / refresh

| State | Behaviour |
|---|---|
| Initial load | shared loading placeholder |
| Empty | shared empty placeholder |
| Refetch after mutation | explicit `refetch()` (no react-query) |
| Error | system `error` dialog with `err.code` + `trace_id` |
| Validation | `WBE2060` not found · `WBE2062` already in approval · `WBE2064` reporting-account locked once dispatched · `WBE2069` no file |
