# Vendor Payment > Payment Result Details — Web (Refactor)

**Module:** Payment → Vendor Payment · **Screen:** Payment Result Details
**Route:** `/payment/vendor-payment/payment-result/[id]` · **JEX:** `pymn_0002_002`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Per-transaction result detail for one executed vendor payment batch — master header (withdrawal bank, total, approval ref, requestor), header status tabs (All / Success / Failed / In Progress derived from the per-line statuses), and the canonical 11-column per-line result table. **Implemented full-stack.** Detail is a **route** (`[id]`), not a dialog.

## Route/Page
- `app/(dashboard)/payment/vendor-payment/payment-result/[id]/page.tsx` → `VendorPaymentResultDetailPage` (`components/payment/vendor-payment/PaymentResultDetailPage.tsx`), composed through `<ResultDetailView>`.

## Components
- `<ResultDetailView>` (shared: DetailHeader breadcrumb + Back, DetailSummary, `<DetailStatusTabs>`, `resultDetailColumns` table), `<PaymentResultBadge>` for the success/failed/pending ramp.

## Filters
- None on the detail page (header status tabs filter the line list client-side).

## Table Columns
- Canonical 11-column `resultDetailColumns` (shared across all 5 modules): Date/Time, Deposit Bank, Recipient Name, Transfer Amount, Remarks ⓘ, Results, Result Date/Time, Reporting Account, Description, Document No., Banking Transaction ID. Per-line status from the dispatch-result resolver (`proc_stat` / `rs_cd`).

## Sorting
- Not server-sorted (single batch; line order by `SCDUL_PYMN_DETL_NO`).

## Pagination
- None — `<Pagination hidden>` (payment-module rule §12a).

## Dialogs/Popups
- None beyond system dialogs; the Banking Match CTA appears per-line where applicable.

## API Integration
- `GET /api/v1/payment/vendor-payment/results/{id}`. Client: `fetchVendorPaymentResultDetail` in `lib/api/vendorPayment.ts`. Header tab counts `[success, failed, inProgress]` are derived server-side (`countByStatus`). Authorization: `payment-vendor-result`.

## Validation
- `WBE2060` when the batch is not found / wrong tenant.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment.md](./scheduled-payment.md) · [scheduled-payment-details.md](./scheduled-payment-details.md) · [payment-result.md](./payment-result.md)
- API counterpart: [wecms-api/docs/features/payment/vendor-payment/README.md] (backend feature spec)
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_
