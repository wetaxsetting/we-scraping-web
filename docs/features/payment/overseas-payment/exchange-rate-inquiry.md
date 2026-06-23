# Overseas Payment > Exchange Rate Inquiry — Web (Refactor)

**Module:** Payment → Overseas Payment · **Screen:** Exchange Rate Inquiry
**Route:** `/payment/overseas-payment/exchange-rate-inquiry` · **Slug:** `exchange-rate-inquiry`
**Component:** `<ExchangeRateInquiryPage>` (standalone Figma-specific component — Figma 38:13376)
**JEX:** read = IDO `BANK_EXCH_RATE_INFM_R002`; write = batch `EXCH_0001_001` · **Menu authz:** `payment-overseas-exchange`

> Screen-level doc for the Exchange Rate Inquiry screen as it sits under the **Overseas Payment** menu group. The **detailed source of truth** is the dedicated module folder ➡️ [`../exchange-rate-inquiry/`](../exchange-rate-inquiry/README.md) (full 6-doc set). Family hub: [README.md](README.md) · flow: [screen-flow.md](screen-flow.md). API counterpart: [wecms-api/.../exchange-rate-inquiry/](../../../../../wecms-api/docs/features/payment/exchange-rate-inquiry/README.md).

## Overview
Foreign-exchange rate lookup populated by a daily Coocon/Shinhan batch (`EXCH_0001_001`) and read on demand from `BANK_EXCH_RATE_INFM`. Pick bank / reference date / notification round (`seq_no`) and view a currency-matrix table; optionally compare a second bank side-by-side. Live-wired (no mock fallback). **Not** a list/detail screen — it does NOT use `<PaymentListPage>` / `<DataTableShell>` and has **no pagination** (documented exception, CLAUDE.md §12 / §12a).

## Filters / toolbar
Bank dropdown (backend-driven, `/banks`) · notification-round / `seq_no` dropdown · reference-date `<DateField>` · compare toggle + compare-bank dropdown · currency search.

## Table (currency matrix)
One row per currency (flag + code); columns = rate types **Cash Buy · Cash Sell · T/T Buy · T/T Sell** (13-column layout when compare is on). Custom width tokens `--w-wb-er-*`. "Inquired on" timestamp footer. No pagination, no totals footer.

## Empty state / errors
Errors surface via `useDialog()`; no row-selection, no detail drill-down (read-only lookup).

## API calls
`fetchExchangeRates({ refDate, bankCd, seqNo, sortField, sortDirection })` → `GET /api/v1/banking/exchange-rates` · bank list `GET /api/v1/banking/exchange-rates/banks` · currency rows `GET /api/v1/banking/exchange-rates/currencies`. Compare fires a second `fetchExchangeRates`. Clients: `lib/api/banking.ts` (+ `lib/api/payment.ts`); mappers in `lib/api/mappers.ts`. Validation: `ref_date` 8-digit, `seq_no` 1–2 digits, `bank_cd` ≤20 (server-side `@Pattern`/`@Size`).

## Remaining gaps
- **APPROVED DEVIATION** — no OpenAPI/Springdoc annotations (Springdoc not wired project-wide).
- **⚠️ Re-verify** — `resolveDate` timezone (UTC+7) and error-dialog wiring against the live build.
- **MISSING** — no automated FE tests for the exchange-rate screen.
