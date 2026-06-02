# Payment > Exchange Rate Inquiry — Frontend Page Design

**Module:** Payment → Add-on (Overseas Payment group) · **Slug:** `exchange-rate-inquiry`
**Route:** `/payment/overseas-payment/exchange-rate-inquiry` · **JEX:** `exch_0001_001` (FX rate lookup)

- API side: `exchange-rate-inquiry.md` _(wecms-api backend repo — not included in this clone)_
- Related: [overseas-payment.md](./overseas-payment/README.md) (FX consumer) · [../banking/account-inquiry-fcy.md](../banking/current-savings-fcy/account-inquiry.md) (FCY accounts)

## Overview
Live & historical foreign-exchange rate lookup used when preparing overseas payments and viewing FCY
balances. Pick currency / bank / date and view the rate table.

## Page Location
`app/(dashboard)/payment/overseas-payment/exchange-rate-inquiry/page.tsx` → `components/payment/overseas-payment/` (or a dedicated exchange-rate component — confirm against the shipped UI).

## UI Components
- Filter bar (currency, bank, as-of date / range); FX rate table; (optional) trend/Excel export.

## User Actions
- Select currency / bank / date → view buy/sell/mid rates; use rates when scheduling overseas payments.

## Table Columns
Currency · bank · buy rate · sell rate · mid rate · as-of date/time. *(Confirm against the API doc + JEX `exch_0001_001`.)*

## Dialogs / Popups
- None primary (lookup table).

## API Integration
- FX-rate endpoint (shares the Coocon smart-gateway per the NXiSAS reference). See the API doc for the contract. snake_case wire ↔ camelCase mappers.

## Validation
- Currency required; date range validated.

## Notes
Moved here with the API doc from `features/banking/` (menu authority: Payment → Add-on). Cross-links to
the Overseas Payment flow and FCY account inquiry per the menu relationships.
