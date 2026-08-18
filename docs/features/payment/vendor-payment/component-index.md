# Vendor Payment — Component Index (Frontend)

> **Backend counterpart:** [wecms-api/…/source-code-index.md](../../../../../wecms-api/docs/features/payment/vendor-payment/source-code-index.md).

Files under `components/payment/vendor-payment/` + the shared collaborators. Route entries under `app/(dashboard)/payment/vendor-payment/`.

---

## Routes

| Route | page.tsx export | Component (default import) |
|---|---|---|
| `scheduled-payment/page.tsx` | `PaymentVendorScheduledPage` | `VendorScheduledPaymentPage` |
| `scheduled-payment/[id]/page.tsx` | `PaymentVendorScheduledDetailRoute` | `VendorScheduledPaymentDetailPage` |
| `payment-result/page.tsx` | `PaymentVendorResultPage` | `VendorPaymentResultPage` |
| `payment-result/[id]/page.tsx` | `PaymentVendorResultDetailRoute` | `VendorPaymentResultDetailPage` |

## Feature components (`components/payment/vendor-payment/`)

| File | Role |
|---|---|
| `ScheduledPaymentPage.tsx` | Default export `VendorScheduledPaymentPage`. Composes `<PaymentScheduledBatchListPage>` + `<VendorPaymentUploadDialog>` + `<RequestApprovalDialog>` + `<ApprovalDetailsDialog>` (read-only / edit) + `<ViewSettingPopover>`. |
| `ScheduledPaymentDetailPage.tsx` | `VendorScheduledPaymentDetailPage`. `<PaymentDetailPage>` + reporting-account picker (`scheduledDetailColumns`). |
| `PaymentResultPage.tsx` | `VendorPaymentResultPage`. `<PaymentResultBatchListPage>` (totals footer) + `<ViewSettingPopover>`; export via `useExcelExport`. |
| `PaymentResultDetailPage.tsx` | `VendorPaymentResultDetailPage`. `<ResultDetailView>` + canonical 11-col `resultDetailColumns`. |
| `VendorPaymentUploadDialog.tsx` | Thin wrapper over the shared Excel-upload preview dialog; supplies `parseVendorPaymentExcel` / `createVendorPayment`. |
| `types.ts` | Local row types `VendorScheduledRow` / `VendorResultRow` (+ action / highlight unions). |

## Shared components consumed

| Component | Path | Use |
|---|---|---|
| `PaymentScheduledBatchListPage` | `components/payment/shared/` | Scheduled list shell |
| `PaymentResultBatchListPage` | `components/payment/shared/` | Result list shell (totals footer rendered) |
| `PaymentDetailPage` | `components/payment/shared/` | Scheduled detail shell |
| `ResultDetailView` / `DetailStatusTabs` / `PaymentResultBadge` | `components/payment/shared/` | Result detail shell + status ramp |
| `RequestApprovalDialog` / `ApprovalDetailsDialog` / `EditApprovalLinePicker` | `components/payment/shared/` (+ `corporate-card`) | Approval request + details + line-edit |
| `DataTableShell` / `Pagination` / `PageLayout` / `PageHeader` / `PageActionButtons` / `SearchInput` / `DateRangeFilter` | `components/shared/` | Page chrome + table shell |
| `ViewSettingPopover` / `useViewSetting` | `components/shared/view-setting/` | Column visibility/order |
| `useDialog` | `components/shared/dialog/` | System dialogs |

## Hooks & lib helpers

| Symbol | Path | Use |
|---|---|---|
| `lib/api/vendorPayment.ts` | `lib/api/` | Full API client (see [api-consumption.md](api-consumption.md)) |
| `useTableSort` | `hooks/useTableSort.ts` | header sort cycle |
| `useExcelExport` | `hooks/useExcelExport.ts` | Result XLSX export |
| `useViewSetting` | `components/shared/view-setting/` | View Setting |
| `lib/viewSettingScreens.ts` | — | SCREEN_IDS `PAYMENT_VENDOR_PAYMENT_{SCHEDULED,SCHEDULED_DETAIL,RESULT,RESULT_DETAIL}` |
| `lib/menuAuth.ts` | — | route → `payment-vendor-scheduled` / `payment-vendor-result` |
| `lib/types/api.ts` | — | reused `internaltransfer` wire types |

## Cross-feature consumption

`fetchVendorPaymentDetail` from `lib/api/vendorPayment.ts` is also consumed by the **Approval Box** dialog's `pickDetailLoader` (dispatched by `typeKey = vendor`), keyed by `documentNo` — see [approval-box/api-consumption.md §1](../approval-box/api-consumption.md).

## Notes

No dead/unused files in this feature folder (all six files are mounted). No frontend component tests yet (G-VEND-1, MISSING).
