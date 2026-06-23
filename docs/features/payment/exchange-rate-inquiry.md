# Exchange Rate Inquiry — Frontend (high-level summary)

> ⚠️ This document is a high-level feature summary.
> The detailed source of truth is located in:
> `docs/features/payment/exchange-rate-inquiry/`

**Module:** Payment → Overseas Payment · **Menu:** Exchange Rate Inquiry
**Route:** `/payment/overseas-payment/exchange-rate-inquiry` · **Slug:** `exchange-rate-inquiry`

Foreign-exchange rate lookup populated by a daily Coocon/Shinhan batch and read on demand. Pick bank / reference date / notification round (`seq_no`) and view a currency-matrix table; optionally compare a second bank's rates side-by-side. Standalone Figma-specific component (Figma 38:13376) — does NOT use `PaymentListPage` / `DataTableShell`. Live-wired (no mock fallback). Backend base is `/api/v1/banking/exchange-rates` (the controller lives in the `domain.banking` package despite the Payment menu placement).

## Detailed docs (source of truth) — `exchange-rate-inquiry/`

| Doc | Focus |
|---|---|
| [exchange-rate-inquiry/README.md](exchange-rate-inquiry/README.md) | Overview, route, doc index |
| [exchange-rate-inquiry/screen-flow.md](exchange-rate-inquiry/screen-flow.md) | Select bank/date/round → view; compare toggle |
| [exchange-rate-inquiry/ui-specification.md](exchange-rate-inquiry/ui-specification.md) | Bank/currency selectors, compare-bank, matrix table, sort |
| [exchange-rate-inquiry/component-index.md](exchange-rate-inquiry/component-index.md) | `ExchangeRateInquiryPage`, hooks, API client |
| [exchange-rate-inquiry/api-consumption.md](exchange-rate-inquiry/api-consumption.md) | `/exchange-rates`, `/banks`, `/currencies` consumed shapes |
| [exchange-rate-inquiry/test-scenarios.md](exchange-rate-inquiry/test-scenarios.md) | FE test scenarios + coverage gap |

Backend counterpart: [`wecms-api/docs/features/payment/exchange-rate-inquiry/`](../../../../wecms-api/docs/features/payment/exchange-rate-inquiry/README.md). Related: [overseas-payment/README.md](overseas-payment/README.md).
