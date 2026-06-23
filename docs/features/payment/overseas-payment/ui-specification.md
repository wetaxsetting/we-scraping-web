# Overseas Payment — UI Specification

> Filters, tabs, totals, tables, dialogs, states. Hub: [README.md](README.md). Functional authority: [`wecms-api/.../functional-specification.md`](../../../../../wecms-api/docs/features/payment/overseas-payment/functional-specification.md). Verified 2026-06-23.
>
> **Per-screen docs:** [scheduled-payment.md](scheduled-payment.md) · [scheduled-payment-details.md](scheduled-payment-details.md) · [payment-result.md](payment-result.md) · [payment-result-details.md](payment-result-details.md) · [exchange-rate-inquiry.md](exchange-rate-inquiry.md).

## Scheduled Payment (list)

### Filters
Period dropdown (30/90/180 days / manual) + `<CalendarIconButton>`; Approval Status dropdown (Not Requested / Pending / In Progress / Approved / Rejected → `appr_type_cd[]`); keyword `<SearchInput>`.

### Columns (View-Setting-driven, `payment-overseas-payment-scheduled`)
Checkbox · Date/Time · File Name · No. of Transactions · Total Transfer Amount · Approval Status · Requestor · Approver · Approval Ref · Approval Title · Schedule Date (`extraColumn`) · Action.

### Summary / totals
Per-currency totals footer (`paginationWithTotals`) from `totals[]`.

### Sorting / pagination
Sortable headers (Date/Time, Total Transfer Amount, Status, Requestor) → `sort_field`/`sort_direction`; server-side `page` (0-based)/`size` (default 10).

### Dialogs
Excel-upload modal (`OverseasExcelUploadModal` → shared `<ExcelUploadDialog>`); `<RequestApprovalDialog>`; `ChangeApproverDialog`; approve/reject + delete confirmations via `useDialog()`.

## Scheduled Payment Details
Composes `<PaymentDetailPage>` — breadcrumb header + `<DetailSummary>` + `<FileCard>` + inner table, no pagination footer. Per-line columns (View-Setting-driven `payment-overseas-payment-scheduled-detail`): beneficiary name · beneficiary bank · BIC · beneficiary account · beneficiary address · currency · transfer amount · fee payer · memo · reporting account. Inline reporting-account picker → `saveOverseasReportingAccount`. File-card download → `downloadOverseasPaymentFile`.

## Payment Result (list)

### Filters
Period dropdown + `<CalendarIconButton>`/manual; **Completed / In Progress checkboxes** (→ `proc_stat` CSV: Completed `0,3` / In Progress `6`); keyword.

### Columns (View-Setting-driven, `payment-overseas-payment-result`)
Date/Time · File Name · No. of Transactions · Total Transfer Amount · Transfer Status · **Approval Ref (clickable, F4b)** · Approval Title · Action (download glyph) + Scheduled Date / Approval Status / Requestor / Approver.

### Summary / totals
Per-currency totals footer retained (`paginationWithTotals`). Only Internal Transfer Result omits the footer.

### Status display
`<PaymentResultBadge>` from `proc_stat`-derived status; batch transfer status from derived `trnf_stts` (C/F/P) + `success_count`/`failed_count`/`prs_cnt`.

## Payment Result Details
Composes `<ResultDetailView>` — adds `<DetailStatusTabs>` + Result Date/Time + Results columns over `<PaymentDetailPage>`. Per-line `resultDetailColumns` (Date/Time, Deposit/Beneficiary Bank, Recipient, Transfer Amount, Remarks, Results, Result Date/Time, Reporting Account, Description, Document No., Banking Transaction ID/Match). Per-line banking match/unmatch + header unmatch-all (`VendorExpenseMatchDialog`); per-batch Excel export.

## Multi-currency totals
Footer renders one row per currency (`OverseasCurrencyTotal`: `ccy_cd`, `totl_amt`). Amounts via `formatAmount(value, ccyCd, true)` only.

## Empty / loading / error states
- Loading → skeleton table (list shells) / detail skeleton.
- Empty → `t("common.no_records")` row.
- 404 detail → `notFound()`; 401 → global interceptor → `/login`.
- API errors (`WBE2045`, `WBE2046`, `WBE2063`, `WBE2069`, `WBE2127`, …) → `useDialog().open({ type:"error", ... , errorCode })`. Never silent.

## Typography
All text via workspace Tailwind tokens (`text-page-title`, `text-section-title`, `text-base`, `text-table-header`, etc.) — no raw `text-[Npx]` / `font-[N]` / inline `fontFamily`.

## Cross-links
- [screen-flow.md](screen-flow.md) · [component-index.md](component-index.md) · [api-consumption.md](api-consumption.md)
