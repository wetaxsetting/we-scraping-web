# Exchange Rate Inquiry — Frontend (wecms-web)

**Status: CURRENT** — documents shipped frontend behaviour. Per-screen wiring detail is in the tables below. Vocabulary: [../../../README.md § Status vocabulary](../../../README.md#status-vocabulary).

> **Audience: frontend.** For the Spring Boot backend see the API counterpart:
> [`wecms-api/docs/features/payment/exchange-rate-inquiry/README.md`](../../../../../wecms-api/docs/features/payment/exchange-rate-inquiry/README.md).
> These folder docs are the **detailed source of truth**; the root summary
> [`../exchange-rate-inquiry.md`](../exchange-rate-inquiry.md) is a high-level pointer.

**Feature slug:** `exchange-rate-inquiry`
**Route:** `/payment/overseas-payment/exchange-rate-inquiry`
**Menu / authz slug:** `payment-overseas-exchange`
**Module:** Payment → **Overseas Payment**
**JEX:** read = IDO `BANK_EXCH_RATE_INFM_R002`; write = batch `EXCH_0001_001` (legacy `pymn_0010_002`)

---

## 1. Overview

Foreign-exchange rate lookup populated by daily Coocon / Shinhan + Woori batches and read on
demand. The user picks a bank, reference date, and notification round (`seq_no`), then views a
currency-matrix table — one row per currency (flag + code), columns = rate types (Cash Buy /
Cash Sell / T/T Buy / T/T Sell). An optional "Compare with" toggle overlays a second bank's
rates side-by-side (13-column layout with a Diff column per rate type). An "Inquired on"
timestamp footer shows the source update time. Live-wired (no mock fallback).

This page belongs to the **Overseas Payment** menu group. It is a **Figma-specific component**
(Figma 38:13376) — it does **NOT** use `PaymentListPage`, `DataTableShell`, or any shared
list table; the currency-matrix shape can't be expressed through those templates. It uses
custom column-width tokens (`--w-wb-er-*`) and has no pagination.

## 2. Page location

- Route page: `app/(dashboard)/payment/overseas-payment/exchange-rate-inquiry/page.tsx` → renders `<ExchangeRateInquiryPage>`.
- Component: `components/payment/overseas-payment/ExchangeRateInquiryPage.tsx`.

## 3. API integration (at a glance)

| Call | Endpoint |
|---|---|
| `fetchExchangeRates({ refDate, bankCd, seqNo, sortField, sortDirection })` | `GET /api/v1/banking/exchange-rates` (note: `banking` base, not `payment`) |
| `fetchExchangeRateBanks()` | `GET /api/v1/banking/exchange-rates/banks` |
| `fetchExchangeRateCurrencies()` | `GET /api/v1/banking/exchange-rates/currencies` |

snake_case wire ↔ camelCase via `lib/api/mappers.ts` (`toExchangeRateListResult`).
Backend controller is in the `domain.banking` package despite the Payment menu placement.
Full contract in [api-consumption.md](api-consumption.md).

## 4. Status

| Concern | Status |
|---|---|
| Route + page component | ✅ Done |
| Bank dropdown (backend-driven + static fallback) | ✅ Done |
| Round (`seq_no`) dropdown (Shinhan "Last/1st time"; Woori HH:MM:SS [Nth]) | ✅ Done |
| Date picker (shared `<DateField>`) | ✅ Done |
| Compare-bank (real second fetch, 13-col matrix) | ✅ Done |
| Currency search (client-side) | ✅ Done |
| Column sort (cycle, nulls-last) | ✅ Done |
| Mapper at boundary / `formatExchangeRate` in `lib/currency.ts` | ✅ Done |
| Error dialog (`useDialog`), no mock fallback | ✅ Done |
| Frontend tests | ❌ MISSING |

## 5. Related docs

- [screen-flow.md](screen-flow.md) — user flow + state
- [ui-specification.md](ui-specification.md) — layout, selectors, table, compare, empty/error states
- [component-index.md](component-index.md) — page + hooks + lib files
- [api-consumption.md](api-consumption.md) — endpoints + wire/in-memory shapes
- [test-scenarios.md](test-scenarios.md) — FE scenarios (currently unimplemented)

## 6. Cross-links — the other Overseas-Payment-group frontend features

| Feature | Doc |
|---|---|
| Overseas Payment (FX consumer) | [`../overseas-payment/`](../overseas-payment/) |
| Approval Box | [`../approval-box/`](../approval-box/) |
| Internal Transfer | [`../internal-transfer/`](../internal-transfer/) |
| Vendor Payment | [`../vendor-payment/`](../vendor-payment/) |
| Payroll Payment | [`../payroll/`](../payroll/) |
