# Exchange Rate Inquiry — Component Index

Every frontend file with line citations (validated against the build read 2026-06-23).
Paths are repo-relative.

---

## Route + page

- `app/(dashboard)/payment/overseas-payment/exchange-rate-inquiry/page.tsx` — thin route
  wrapper; sets `metadata`, renders `<ExchangeRateInquiryPage>` (lines 1–9).

## Main component

- `components/payment/overseas-payment/ExchangeRateInquiryPage.tsx`
  - `RATE_COLS` (4 rate types + sort field ids) — lines 45–50
  - `RATE_COL_TO_RAW` (display key → raw field for Diff) — lines 53–58
  - `BANK_LOGO_MAP` / `STATIC_BANK_OPTIONS` / `WOORI_BANK_CD` — lines 61–72
  - `FLAG_MAP` — lines 75–90
  - `LEGACY_CURRENCIES` (fixed 12-currency display set) — lines 96–99
  - `formatDiff(...)` — lines 103–109
  - `getDisplayCcy(...)` / `toDisplayRow(...)` — lines 116–131
  - `ExchangeRateInquiryPage` — lines 142–763
    - sort state via `useTableSort()` — line 147
    - filter state (`refDate`, `bankCd`, `seqNo`, `compareEnabled`, `compareBankCd`, `search`) — lines 152–158
    - banks via `useApiData(fetchExchangeRateBanks)` + static fallback — lines 166–180
    - compare-bank auto-sync `useEffect` — lines 189–193
    - primary fetch `useApiData(fetchExchangeRates)` — lines 196–204
    - stable-data latch — lines 209–215
    - sticky-loading gate — line 219
    - round dropdown options (Shinhan vs Woori) — lines 223–260
    - `apiError` → `useDialog` error — lines 274–282
    - compare fetch `useEffect` — lines 287–309
    - matrix build (12-currency) — lines 335–352
    - `inquiredOn` — lines 355–363
    - client-side `sortedRows` — lines 373–398
    - filter row JSX — lines 422–535
    - matrix table JSX (colgroup / thead / tbody) — lines 538–732
    - empty-state + footer — lines 745–760
  - `RateSortGlyph` helper — lines 766–786
  - `DropdownPopover` helper — lines 788–837

## Types

- `components/payment/overseas-payment/types.ts` — `ExchangeRateRow`, `ExchangeRateDisplayRow`,
  `ExchangeRateListResult`, `ExchangeRateBankOption` (camelCase in-memory shapes).

## API client

- `lib/api/banking.ts`
  - `fetchExchangeRates(params)` → `GET /api/v1/banking/exchange-rates` — line 913
  - `fetchExchangeRateBanks()` → `.../banks` — line 940
  - `fetchExchangeRateCurrencies()` → `.../currencies` — line 956
  - imports `toExchangeRateListResult` from `lib/api/mappers` (line 42), `ApiExchangeRate*` wire types from `lib/types/api.ts` (lines 11–12)

## Wire types + mapper

- `lib/types/api.ts` — `ApiExchangeRateListResponse`, `ApiExchangeRateRow`, `ApiExchangeRateBankItem` (snake_case).
- `lib/api/mappers.ts` — `toExchangeRateListResult` (boundary translation snake → camel).

## Shared modules consumed

| Module | Use |
|---|---|
| `lib/currency.ts` → `formatExchangeRate` | rate + diff number formatting |
| `lib/datetime.ts` → `todayLocalIso` | initial `refDate` (local day) |
| `lib/api/useApiData.ts` → `useApiData` | fetch-on-mount + refetch |
| `hooks/useTableSort.ts` → `useTableSort`, `SortDirection` | sort cycle + `sortParams` |
| `hooks/useStickyLoading.ts` → `useStickyLoading` | ≥ 400 ms initial loading gate |
| `components/shared/DateField.tsx` | reference-date chip + calendar |
| `components/shared/FilterDropdown.tsx` / `FilterRow.tsx` | filter chrome |
| `components/shared/SearchInput.tsx` | currency search |
| `components/shared/PageHeader.tsx` / `PageLayout.tsx` | shell |
| `components/shared/TableHeaderCell.tsx` | sortable currency header |
| `components/shared/dialog` → `useDialog` | error dialog |
| `components/ui/table` | `TableBody/Cell/Head/Header/Row` primitives |

## Tokens

- Column widths: `--w-wb-er-currency`, `--w-wb-er-rate`, `--w-wb-er-diff` (page-specific, in `app/globals.css`).
- Diff pill colors: `wb-status-approved-*` / `wb-status-rejected-*`.

## Tests

- **None.** No `*.test.*` for this component (MISSING — see [test-scenarios.md](test-scenarios.md)).
