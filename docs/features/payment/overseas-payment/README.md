# Payment > Overseas Payment — Frontend (Next.js)

**Status: CURRENT** — documents shipped frontend behaviour. Per-screen wiring detail is in the tables below. Vocabulary: [../../../README.md § Status vocabulary](../../../README.md#status-vocabulary).

> **Frontend feature hub.** Backend/API counterpart → [`wecms-api/docs/features/payment/overseas-payment/README.md`](../../../../../wecms-api/docs/features/payment/overseas-payment/README.md). Source of truth = the latest implementation code; this hub + companions were re-normalized against `components/payment/overseas-payment/**` + `lib/api/payment.ts` on **2026-06-23**.

| Field | Value |
|---|---|
| Slug | `overseas-payment` |
| Module | Payment → Overseas Payment |
| Route base | `/payment/overseas-payment` |
| Routes | `/scheduled-payment`, `/scheduled-payment/[id]`, `/payment-result`, `/payment-result/[id]`, `/exchange-rate-inquiry` |
| Feature folder | [`components/payment/overseas-payment/`](../../../../components/payment/overseas-payment) |
| API base | `/api/v1/payment/overseas-payment` (single controller, `/result` **singular**) + FX `/api/v1/banking/exchange-rates` |
| JEX | `pymn_0007_*` (Scheduled) / `pymn_0008_*` (Result) |
| Status | **Implemented — all screens wired to live endpoints (no mock fallback).** |

## Overview
Overseas (foreign) remittance batch payments with beneficiary + FX detail. Same upload → approval →
transfer → result shell as the sibling families, but on the **separate** `OVRS_PYMN_*` table family,
and bundled with the **Exchange Rate Inquiry** screen. Approval status derives from
`EXPT_RESOL_MSTR.APPR_TYPE_CD` (no `appr_stts` column on `OVRS_PYMN_SUMR`); detail table is
`OVRS_PYMN_SUMR_DETL` (not the old `OVRS_PYMN_DTLS` name).

## Screens (per-screen docs preserved)
- [scheduled-payment.md](scheduled-payment.md) — list + create scheduled overseas payments.
- [scheduled-payment-details.md](scheduled-payment-details.md) — per-line beneficiary/FX drill-down + reporting account.
- [payment-result.md](payment-result.md) — executed results, status checkboxes, F4b Approval Ref.
- [payment-result-details.md](payment-result-details.md) — per-transaction result + banking match.
- [exchange-rate-inquiry.md](exchange-rate-inquiry.md) — FX rate matrix lookup (screen-level; full detail in the dedicated [`../exchange-rate-inquiry/`](../exchange-rate-inquiry/README.md) module folder).

**Screen flow:** Scheduled Payment → Scheduled Payment Details · Payment Result → Payment Result Details · Overseas Payment → Exchange Rate Inquiry (sibling FX lookup under the same menu group).

## Companion docs (this folder)
| Doc | Contents |
|---|---|
| [screen-flow.md](screen-flow.md) | Navigation + interaction flow across the four screens |
| [ui-specification.md](ui-specification.md) | Filters, tabs, summary cards, totals, tables/columns, pagination, sorting, empty states, dialogs, upload/download, approval actions, result inquiry |
| [component-index.md](component-index.md) | Page/component map + shared components composed |
| [api-consumption.md](api-consumption.md) | Every API client function → endpoint, mappers, hooks, View Setting IDs |
| [test-scenarios.md](test-scenarios.md) | Frontend test coverage (currently a gap) |

## Page → component map
- `scheduled-payment/page.tsx` → `<OverseasScheduledPaymentPage>` ([ScheduledPaymentPage.tsx](../../../../components/payment/overseas-payment/ScheduledPaymentPage.tsx)) → shared `<PaymentScheduledBatchListPage>`
- `scheduled-payment/[id]/page.tsx` → `<OverseasScheduledPaymentDetailPage>` → shared `<PaymentDetailPage>`
- `payment-result/page.tsx` → `<OverseasPaymentResultPage>` → shared `<PaymentResultBatchListPage>`
- `payment-result/[id]/page.tsx` → `<OverseasPaymentResultDetailPage>` → shared `<ResultDetailView>`
- `exchange-rate-inquiry/page.tsx` → `<ExchangeRateInquiryPage>` (standalone)

## Cross-links
- API hub: [`wecms-api/.../overseas-payment/README.md`](../../../../../wecms-api/docs/features/payment/overseas-payment/README.md)
- FX lookup: [exchange-rate-inquiry.md](exchange-rate-inquiry.md) (screen-level) · [../exchange-rate-inquiry/](../exchange-rate-inquiry/README.md) (detailed module folder)
- Sibling FE features: [internal-transfer](../internal-transfer/README.md) · [vendor-payment](../vendor-payment/README.md) · [expense-payment](../expense-payment/README.md) · [payroll](../payroll/README.md)
