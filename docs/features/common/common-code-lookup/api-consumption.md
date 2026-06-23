# Common Code Lookup — API Consumption (Frontend)

**Part of:** Common → common-code-lookup
**Last verified:** 2026-06-23

## Country reference fetcher (the one Common endpoint)

`lib/api/countries.ts` — `fetchCountries(): Promise<Country[]>`.

```
fetchCountries()
  → api.get("/api/v1/common/countries")        countries.ts:71-73
  → unwrap ApiResponse<ApiCountryListResponse>  (throws ApiCallError on status.error / network)
  → (data.countries ?? []).map(toCountry)        countries.ts:74
```

| Wire (`ApiCountryRow`) | In-memory (`Country`) | Mapping |
|---|---|---|
| `ntnl_cd` | `iso2` | lowercased (`countries.ts:63`) |
| `natl_nm` | `name` | verbatim |
| `natn_num` | `dial` | dial code without `+` |
| `default_yn` | `isDefault` | `=== "Y"` (`countries.ts:66`) |

- Read-only, single GET. Errors propagate as `ApiCallError(code, message)` so consumers can fall
  back to a static seed (offline-dev graceful degradation) — `PhoneCountryPicker` keeps
  `FALLBACK_COUNTRIES` on error (`PhoneCountryPicker.tsx:132-134`).
- Per-screen allow-lists live on the **consumer**, not the fetcher — `fetchCountries` returns the
  full directory; `PhoneCountryPicker` filters to `{kh,kr,vn}`.

## Purpose / reporting-account options — from owning domains

The `PurposeSelect` / `ReportingAccountSelect` adapters do **not** fetch. The consuming page
fetches options from the owning feature and passes them in as props:

| Select | Options endpoint | Owning feature |
|---|---|---|
| `PurposeSelect` | `GET /api/v1/settings/purpose-settings` (Transaction History) or `GET /api/v1/payment/card-transactions/purpose-options` (Card Transactions) | Settings `purpose-settings` |
| `ReportingAccountSelect` | `GET /api/v1/settings/chart-of-accounts` | Settings `chart-of-accounts` |

See those features' `api-consumption.md` for the contracts — not duplicated here.

## No shared lookup API module

There is **no** `lib/api/lookup.ts`, no `lib/api/common.ts` lookup aggregator, and **no**
`GET /api/v1/common/banks` / `/currencies` consumer. Verified absent. Reference options are
sourced per-domain:

- countries → `lib/api/countries.ts`
- bank names → arrive **pre-resolved inside** Account Inquiry / Payment response rows (the backend
  resolves them server-side; the frontend never calls a bank-lookup endpoint)
- currency → plain string codes inside domain DTOs; formatting via `lib/currency.ts`

## Related

- Component index: [`component-index.md`](component-index.md)
- Backend interface: [`../../../../../wecms-api/docs/features/common/common-code-lookup/interface-specification.md`](../../../../../wecms-api/docs/features/common/common-code-lookup/interface-specification.md)
