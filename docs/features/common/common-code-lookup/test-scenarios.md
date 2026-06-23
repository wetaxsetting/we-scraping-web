# Common Code Lookup — Test Scenarios (Frontend)

**Part of:** Common → common-code-lookup
**Last verified:** 2026-06-23

## `SearchSelect` foundation

| # | Scenario | Expected |
|---|---|---|
| S-1 | Open from empty | hover pencil → click → editing chip + popover; search autofocused |
| S-2 | Type a query | both RECENT and main section filter by `label` (case-insensitive); non-matching rows drop |
| S-3 | Empty result | `common.no_rows` shown; no main rows |
| S-4 | RECENT section | when `recentIds` non-empty, RECENT renders first in given order; ids that no longer resolve are dropped; intersected with the active search |
| S-5 | Pick a row | `onChange(option)` fires; popover closes; editing exits; active row had `bg-wb-bg-active` |
| S-6 | Clear-first (`onClear` set) | assigned cell shows hover ×; click clears via `onClear` |
| S-7 | Re-open (no `onClear`) | assigned cell shows hover pencil; click re-opens to re-pick |
| S-8 | ESC / outside-click | popover closes, no commit |
| S-9 | `matchTriggerWidth` | popover width equals trigger measured width |
| S-10 | Ellipsis | long label truncates with native `title` tooltip |

## Adapters

| # | Scenario | Expected |
|---|---|---|
| A-1 | `PurposeSelect` label | row renders `"<code> <name>"` (e.g. `"40 Loan Repaid"`); pick maps back to `PurposeOption` |
| A-2 | `ReportingAccountSelect` label | row renders `"<code> - <name>"` (e.g. `"ACC-01 - REVENUE"`); no RECENT section |
| A-3 | Options sourced per-domain | adapter renders only the options passed in (no internal fetch) |

## Filter controls

| # | Scenario | Expected |
|---|---|---|
| F-1 | `FilterSelect` pick | `onChange(value)` + close; selected row `text-brand` (+ check unless `hideSelectedCheck`) |
| F-2 | `FilterSelect` outside-click | closes without change |
| F-3 | `FilterDropdown` click | fires `onClick`; no built-in popover |

## Country list / picker

| # | Scenario | Expected |
|---|---|---|
| CT-1 | `fetchCountries` success | returns mapped `Country[]` (`iso2` lowercase, `isDefault` from `default_yn`) |
| CT-2 | `PhoneCountryPicker` render | list filtered to `{kh,kr,vn}`; selected dial shipped via hidden input |
| CT-3 | API error | picker keeps `FALLBACK_COUNTRIES` (offline-dev graceful degradation) |
| CT-4 | Default resolution | when no `defaultValue`, picker resolves to Vietnam (WeCMS default locale) |

## Coverage status

⚠️ **UNVERIFIED** — no component test files were located for these shared selects this pass.
Scenarios above are the intended coverage; confirm/author alongside the components.

## Related

- Screen flow: [`screen-flow.md`](screen-flow.md) · API: [`api-consumption.md`](api-consumption.md)
- Backend tests: [`../../../../../wecms-api/docs/features/common/common-code-lookup/test-scenarios.md`](../../../../../wecms-api/docs/features/common/common-code-lookup/test-scenarios.md)
