# Payment — Frontend Feature Docs

**Status: CURRENT (index)** — navigation only. Each linked screen doc carries its own status; see [../../README.md § Status vocabulary](../../README.md#status-vocabulary).

Per-screen Next.js design docs for the **Payment** top-menu module. Mirrors the WeCMS Payment menu. Each module folder carries the standard 6-file set: `README.md` · `screen-flow.md` · `ui-specification.md` · `component-index.md` · `api-consumption.md` · `test-scenarios.md`.

## Payment top menu → docs

| Top menu | Sub-screens | Module folder (detailed source of truth) | Root summary |
|---|---|---|---|
| Approval Box | — | [approval-box/](approval-box/README.md) | [approval-box.md](approval-box.md) |
| Internal Transfer | Scheduled Transfer · Transfer Result | [internal-transfer/](internal-transfer/README.md) | — |
| Vendor Payment | Scheduled Payment · Payment Result | [vendor-payment/](vendor-payment/README.md) | — |
| Expense Payment | Scheduled Payment · Payment Result | [expense-payment/](expense-payment/README.md) | — |
| Payroll | Scheduled Payment · Payment Result | [payroll/](payroll/README.md) | — |
| Overseas Payment | Scheduled Payment · Payment Result · Exchange Rate Inquiry | [overseas-payment/](overseas-payment/README.md) · [exchange-rate-inquiry/](exchange-rate-inquiry/README.md) | [exchange-rate-inquiry.md](exchange-rate-inquiry.md) |
| Corporate Card | Card Transactions | [corporate-card/](corporate-card/README.md) | [card-transactions.md](card-transactions.md) |

> Root `.md` files (`approval-box.md`, `card-transactions.md`, `exchange-rate-inquiry.md`) are **high-level summaries only** — the detailed source of truth is the matching module folder.

Each batch-file group (Internal Transfer, Vendor, Expense, Payroll, Overseas) has a **Scheduled** list, a **Result** list, and per-row **detail** pages. See each folder's `screen-flow.md` for the route/detail breakdown.

## Routes

`/payment/approval-box` · `/payment/{internal-transfer,vendor-payment,expense-payment,payroll,overseas-payment}/{scheduled-*,*-result}` (+ `[id]` detail) · `/payment/overseas-payment/exchange-rate-inquiry` · `/payment/corporate-card/card-transactions`

## Related components

- [`components/payment/approval-box/`](../../../components/payment/approval-box/) — tabbed baseline (`ApprovalBoxPage`)
- [`components/payment/shared/`](../../../components/payment/shared/) — `PaymentScheduledBatchListPage`, `PaymentResultBatchListPage`, `PaymentDetailPage`, `ResultDetailView` (shared across all 5 batch modules)
- [`components/payment/corporate-card/`](../../../components/payment/corporate-card/) — Card Transactions page + 16 components
- [`components/payment/overseas-payment/ExchangeRateInquiryPage.tsx`](../../../components/payment/overseas-payment/ExchangeRateInquiryPage.tsx) — Figma-specific currency matrix

Pagination / totals / detail rules: wecms-web/CLAUDE.md §12 + §12a.

## Related backend docs

[`wecms-api/docs/features/payment/`](../../../../wecms-api/docs/features/payment/README.md) — feature-paired API docs (same module slugs).
