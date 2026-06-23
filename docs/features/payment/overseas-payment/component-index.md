# Overseas Payment — Component Index

> Page/component map. Hub: [README.md](README.md). Verified against `components/payment/overseas-payment/**` 2026-06-23.

## Routes — `app/(dashboard)/payment/overseas-payment/`
| File | Renders |
|---|---|
| `scheduled-payment/page.tsx` | `<OverseasScheduledPaymentPage>` |
| `scheduled-payment/[id]/page.tsx` | `<OverseasScheduledPaymentDetailPage id={id}>` |
| `payment-result/page.tsx` | `<OverseasPaymentResultPage>` |
| `payment-result/[id]/page.tsx` | `<OverseasPaymentResultDetailPage id={id}>` |
| `exchange-rate-inquiry/page.tsx` | `<ExchangeRateInquiryPage>` (separate doc) |

## Components — `components/payment/overseas-payment/`
| File | Role | Shared composed |
|---|---|---|
| `ScheduledPaymentPage.tsx` | Scheduled list container (filters, sort, pagination, upload, approval workflow) | `PaymentScheduledBatchListPage` |
| `ScheduledPaymentDetailPage.tsx` | Per-line detail, View Setting, inline reporting-account edit | `PaymentDetailPage` |
| `PaymentResultPage.tsx` | Result list (status checkboxes, export) | `PaymentResultBatchListPage` |
| `PaymentResultDetailPage.tsx` | Result detail, status tabs, banking match | `ResultDetailView` |
| `ExchangeRateInquiryPage.tsx` | FX currency-matrix (standalone) | — |
| `OverseasExcelUploadModal.tsx` | Excel template/parse/preview/upload modal | `ExcelUploadDialog` |
| `ChangeApproverDialog.tsx` | Edit approval line on pending batch | — |
| `types.ts` | `OverseasScheduledRow`, `OverseasResultRow`, `ExchangeRate*` types | — |

## Shared components composed (`components/payment/shared/` + `components/shared/`)
`PaymentScheduledBatchListPage`, `PaymentResultBatchListPage`, `PaymentDetailPage`, `ResultDetailView`, `RequestApprovalDialog`, `ApprovalDetailsDialog`, `VendorExpenseMatchDialog` (banking match), `DetailSummary`, `DetailHeader`, `DetailStatusTabs`, `FileCard`, `detailColumns.tsx`/`resultDetailColumns`, `deriveResultStatus`, `PaymentResultBadge`, `StatusBadge`, `WithdrawalAccountDropdown`, `ViewSettingPopover`, `<DateRangePicker>`/`<CalendarIconButton>`/`<SearchInput>`/`<FilterRow>`/`<Pagination>`.

## Hooks
`useApiData`, `useTableSort`, `useViewSetting`, `useBlockedChars`, `useExcelExport`, `useStickyLoading`, `useDialog`, `useTranslation`.

## View Setting screen IDs — `lib/viewSettingScreens.ts`
`PAYMENT_OVERSEAS_PAYMENT_SCHEDULED` · `_SCHEDULED_DETAIL` · `_RESULT` · `_RESULT_DETAIL` (+ `SCREEN_ID_TO_ROUTE`). Default area `"default"`.

## Cross-links
- [api-consumption.md](api-consumption.md) · [ui-specification.md](ui-specification.md) · [screen-flow.md](screen-flow.md)
