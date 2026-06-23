# Preferences — Component Index (Frontend)

Component / hook / API-client / type / i18n file map. Backend mirror:
[wecms-api/docs/features/settings/preferences/source-code-index.md](../../../../../wecms-api/docs/features/settings/preferences/source-code-index.md).

---

## Components (`components/settings/preferences/`)

| File | Role |
|---|---|
| [PreferencesPanel.tsx](../../../../components/settings/preferences/PreferencesPanel.tsx) | Main container — state (`isEditing`, `draft`, `saving`, `logoBusy`, `refreshKey`), profile fetch (`useApiData`), logo blob effect, two env-toggle effects, save/cancel/upload/delete handlers, dialogs |
| └ `PreferencesHeader` (in-file) | Header — title + Edit ↔ Cancel/Save button swap |
| └ `CompanySection` (in-file) | Company heading + `<LogoBlock>` + read list / edit form switch |
| └ `LogoBlock` (in-file) | 3-state logo card (present / empty-read / empty-edit) + drag-drop + trash |
| └ `EmptyLogoViewState` / `EmptyLogoEditState` (in-file) | Placeholder card contents |
| └ `CompanyFieldList` (in-file) | Read-mode `<dl>` of 5 profile rows |
| └ `CompanyEditForm` / `FormField` / `TextInput` / `AddressTextarea` (in-file) | Edit-mode input grid |
| └ `PurposeVasSection` (in-file) | Two always-editable toggle rows |
| [types.ts](../../../../components/settings/preferences/types.ts) | `PreferencesCompanyFieldKey` · `PreferencesToggleKey` · `PreferencesToggleRow` (panel-local types) |

The panel is a **single component file with co-located sub-components** (the helpers above live inside
`PreferencesPanel.tsx`), plus `types.ts`. There is **no `mockData.ts`** — the company-profile path is
fully API-wired with no mock seed (a notable difference from the static-UI Settings panels).

Shared components consumed: [`<SettingsModal>`](../../../../components/settings/SettingsModal.tsx) ·
[`<SettingsNav>`](../../../../components/settings/SettingsNav.tsx) ·
[`<ToggleSwitch>`](../../../../components/settings/ToggleSwitch.tsx) · `useDialog()` from
[components/shared/dialog](../../../../components/shared/dialog/) · lucide `Pencil` / `Trash2` /
`ImageOff` / `UploadCloud` (utility chrome).

---

## Hooks

- [`useApiData`](../../../../lib/api/useApiData.ts) — `useApiData(() => fetchPreferences(), [refreshKey])`. Profile fetch on mount + refetch on key bump.
- [`useStickyLoading`](../../../../hooks/useStickyLoading.ts) — smooths the loading / saving / logo-busy indicators so a fast cached round-trip doesn't flicker.
- (no shared `useViewSetting` / `useTableSort` — Preferences is a form, not a list)

---

## API clients + wire types

- [lib/api/preferences.ts](../../../../lib/api/preferences.ts) — `fetchPreferences` ·
  `updatePreferences` · `uploadPreferencesLogo` · `deletePreferencesLogo` · `fetchPreferencesLogoBlob`.
  All go through Axios `api` (JWT interceptor); each unwraps the `ApiResponse<T>` envelope and throws
  `ApiCallError` on `status.error`.
- [lib/api/environmentSettings.ts](../../../../lib/api/environmentSettings.ts) — `fetchEnvironmentSetting`
  · `updateEnvironmentSetting`, plus `ENV_USE_PURPOSE_CD` (`00077`) / `ENV_USE_VAS_ACCOUNT_CD` (`00074`)
  constants. (Toggle half — see [api-consumption.md](api-consumption.md).)
- Wire types in [lib/types/api.ts](../../../../lib/types/api.ts): `ApiPreferencesResponse` ·
  `ApiPreferencesUpdateRequest` · `ApiPreferencesAddress` (lowercase snake_case). The panel consumes
  these directly + a local `DraftState` (camelCase) for the edit form; `toDraft` / `toRequest` /
  `composeAddress` / `emptyToNull` are the in-file boundary helpers (no shared `mappers.ts` entry for
  this feature).

---

## i18n

`locales/{en,ko,vi}.json` — namespace `settings.preferences.*` (+ `settings.nav.preferences`,
`dialog.error`, `common.loading`). Full key list:
[ui-specification.md § i18n keys](ui-specification.md#i18n-keys-namespace-settingspreferences).

## Scroll utility

`<PreferencesPanel>` body uses `custom-scrollbar` on the inner scroll region (per `wecms-web/CLAUDE.md`
§6c).

## Not used

- **No route** — modal panel only (no `app/(dashboard)/settings/preferences/page.tsx`).
- **No View Setting** — Preferences is a form, no column-visibility popover.
- **No mock data file** — the company-profile path is live-API-only (no `mockData.ts`).
- **No data export / pagination / table** — single-row form.
