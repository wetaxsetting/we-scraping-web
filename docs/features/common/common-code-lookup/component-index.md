# Common Code Lookup — Component Index (Frontend)

**Part of:** Common → common-code-lookup
**Last verified:** 2026-06-23

## Foundation

| Component | File | Role |
|---|---|---|
| `SearchSelect` | `components/shared/SearchSelect.tsx` | Generic inline search-dropdown — the single foundation behind every code+name picker. Label-agnostic: caller supplies `SearchSelectOption = { id, label }`. |

### `SearchSelect` props (`:19-57`)

| Prop | Type | Notes |
|---|---|---|
| `value` | `SearchSelectOption \| null` | currently picked |
| `options` | `SearchSelectOption[]` | already-formatted list |
| `recentIds?` | `string[]` | surfaces a RECENT section (order preserved, intersected with search) |
| `sectionTitle` | `string` | main section heading (title case) |
| `recentTitle?` / `searchPlaceholder?` | `string` | default to `common.recent` / `common.search` |
| `ariaLabel` / `clearAriaLabel?` / `placeholder?` | `string` | a11y + empty-chip placeholder |
| `onChange` | `(opt) => void` | commit |
| `onClear?` | `() => void` | when set + assigned → clear-first × flow; else pencil re-open |
| `alwaysEditable?` | `boolean` | permanent chip (Organizer Settings) |
| `matchTriggerWidth?` | `boolean` | popover matches trigger width |

## Adapters (thin wrappers over `SearchSelect` — options sourced per-domain)

| Component | File | Option type | Options from |
|---|---|---|---|
| `PurposeSelect` | `components/shared/PurposeSelect.tsx` | `PurposeOption { useUsagCd, code, name }` | Settings `purpose-settings` / Card Transactions purpose-options; label = `"<code> <name>"` (`:39`), RECENT via `recentUseUsagCds` |
| `ReportingAccountSelect` | `components/shared/ReportingAccountSelect.tsx` | `ReportingAccountOption { chartAcctSeqNo, code, name, breadcrumb }` | Settings `chart-of-accounts`; label = `"<code> - <name>"` (`:47`); no RECENT section |

Both map their domain option → `{ id, label }`, supply the section title, and map the picked
generic option back to the domain option for `onChange`. They hold **no** data-fetch logic — the
consuming page fetches options from the owning feature and passes them in.

## Filter-row controls

| Component | File | Role |
|---|---|---|
| `FilterSelect<T>` | `components/shared/FilterSelect.tsx` | single-select popover; `FilterSelectOption<T> = { value, label, icon? }`; `triggerPrefix`/`triggerLabel`/`triggerIcon`/`flush`/`hideSelectedCheck` knobs |
| `FilterDropdown` | `components/shared/FilterDropdown.tsx` | click-to-cycle trigger (no built-in popover); `value`/`onClick`/`prefixIcon`/`hideChevron` |

## Reference-data consumers

| Component | File | Role |
|---|---|---|
| `PhoneCountryPicker` | `components/settings/users/PhoneCountryPicker.tsx` | consumes `fetchCountries()` (`lib/api/countries.ts`), filters to `ALLOWED_ISO2 {kh,kr,vn}`, falls back to `FALLBACK_COUNTRIES` offline |

## Notes

- **Options are sourced per-domain.** There is no shared `lib/api/lookup.ts`. Country comes from
  `lib/api/countries.ts`; purpose / chart-account come from their owning feature API wrappers.
- Reuse-before-create: a new picker should reuse `SearchSelect` (or a new adapter over it), never
  fork the popover — `wecms-web/CLAUDE.md` §"Common Reusability Rule".

## Related

- UI spec: [`ui-specification.md`](ui-specification.md) · API: [`api-consumption.md`](api-consumption.md)
- Backend source map: [`../../../../../wecms-api/docs/features/common/common-code-lookup/source-code-index.md`](../../../../../wecms-api/docs/features/common/common-code-lookup/source-code-index.md)
