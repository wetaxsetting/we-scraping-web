# Common Code Lookup (shared selects + reference data) — Frontend Feature Hub

**Part of:** Common → common-code-lookup
**Last verified:** 2026-06-23

**Status:** Working — shared select foundation (`SearchSelect`) + adapters + filter dropdowns are
on disk; the one Common reference fetcher (`fetchCountries`) calls `GET /api/v1/common/countries`.
Bank / currency are resolved inside owning-domain responses; reporting-account / purpose **options
come from their owning features**.

> **Key framing.** This slug covers the **shared select foundation** and the country reference
> fetcher. It does **not** own reporting-account or purpose data — those selects are adapters whose
> options are fetched from Settings `chart-of-accounts` / `purpose-settings`. Cross-link, never
> duplicate.

## What lives here

| Concern | Component / module | Options sourced from |
|---|---|---|
| Generic search dropdown foundation | `components/shared/SearchSelect.tsx` | n/a (label-agnostic — caller supplies `{ id, label }`) |
| Purpose picker (adapter) | `components/shared/PurposeSelect.tsx` | Settings `purpose-settings` / Card Transactions purpose-options |
| Reporting-account picker (adapter) | `components/shared/ReportingAccountSelect.tsx` | Settings `chart-of-accounts` |
| Filter single-select | `components/shared/FilterSelect.tsx` | per-page option arrays |
| Filter click-to-cycle dropdown | `components/shared/FilterDropdown.tsx` | per-page |
| Country reference fetcher | `lib/api/countries.ts` (`fetchCountries`) | `GET /api/v1/common/countries` |
| Country/phone picker (consumer) | `components/settings/users/PhoneCountryPicker.tsx` | `fetchCountries` + per-screen allow-list `{kh,kr,vn}` |

> There is **no** shared `lib/api/lookup.ts` — verified absent. Reference options are sourced
> per-domain.

## Documents

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | open select → search / RECENT → pick → commit |
| [ui-specification.md](ui-specification.md) | `SearchSelect` trigger states + popover; `FilterSelect` / `FilterDropdown` |
| [component-index.md](component-index.md) | `SearchSelect` foundation + adapters + filter components + props |
| [api-consumption.md](api-consumption.md) | countries fetcher; purpose / chart-account options from owning domains; no shared lookup module |
| [test-scenarios.md](test-scenarios.md) | select search / empty / RECENT, country list render |

## Related

- Category hub: [`../README.md`](../README.md)
- Backend twin: [`../../../../../wecms-api/docs/features/common/common-code-lookup/README.md`](../../../../../wecms-api/docs/features/common/common-code-lookup/README.md)
- Owning feature — reporting-account data: [`../../settings/chart-of-accounts/README.md`](../../settings/chart-of-accounts/README.md)
- Owning feature — purpose codes: [`../../settings/purpose/README.md`](../../settings/purpose/README.md)
- Reuse rules: `wecms-web/CLAUDE.md` §"Common Reusability Rule" + §"Shared Components"
