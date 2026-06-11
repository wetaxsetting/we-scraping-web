# Settings > VAS Account — Component Index (Frontend)

File-by-file map. Backend source index:
[wecms-api/docs/features/settings/vas-account/source-code-index.md](../../../../../wecms-api/docs/features/settings/vas-account/source-code-index.md).

---

## 1. Routes (App Router)

**None.** VAS Account is a Settings-modal panel, not a route. There is no
`app/(dashboard)/settings/vas-account/page.tsx`. The View Setting registry comment in
`lib/viewSettingScreens.ts` documents this explicitly.

## 2. Host & nav integration

| File | Role |
|---|---|
| `components/settings/SettingsModal.tsx` | Shell; renders `<VasAccountPanel />` when `panel === "vas_account"` |
| `components/settings/SettingsNav.tsx` | Left-rail entry (key `vas_account`, label `settings.nav.vas_account`, icons `ico-vas-account.svg` / `ico-vas-account-box.svg`); maps to menu code `settings-core-vas-account`; `isSettingsPanelVisible` gate |
| `components/settings/types.ts` | `"vas_account"` member of `SettingsPanelKey` |

## 3. Components (`components/settings/vas-account/`)

| File | Role |
|---|---|
| `VasAccountPanel.tsx` | Composition root — header, filter row (search + Active/Inactive + Excel + Add), scroll region, dialog wiring, delete-confirm, error surfacing |
| `VasAccountTable.tsx` | Bare `<table>` (`table-fixed`); parent/child prefix-tree rendering by `row.kind`; status pill; row kebab |
| `VasAccountTableColumns.tsx` | Shared `<colgroup>` (220/600/120/60px); `VAS_ACCOUNT_TABLE_MIN_WIDTH` |
| `AddVasAccountDialog.tsx` | Add **and** Edit (shared `mode` prop), `stackLevel={2}`; Zod `vasAccountSchema`; fields VAS Code / Name / Status |
| `ExcelUploadDialog.tsx` | Per-feature wrapper around the shared excel-upload shell; owns state + API; Add/Replace option; preview filtering |
| `VasAccountRowMenu.tsx` | Portal-rendered kebab popover (Edit / Delete); ESC + outside-click dismiss |

## 4. Hooks (`useVasAccount.ts`)

| Hook | Returns | Notes |
|---|---|---|
| `useVasAccountList(params)` | `{ rows, rawRows, totalCount, initialLoading, fetching, error, refetch }` | manual `useState`/`useEffect` (no react-query/SWR); empty `statuses` → short-circuit empty, no wire call; `rows = buildTree(res.list)` |
| `useVasAccountMutations()` | `{ create, update, remove, submitting, error, clearError }` | wraps `createVasAccount` / `updateVasAccount` / `deleteVasAccount`; never refetches itself (parent calls `refetch`) |

## 5. Mappers & types

| File | Role |
|---|---|
| `mappers.ts` | `statusFromCode`/`statusToCode`, `typeFromCode`, `buildTree` (prefix grouping mirroring legacy `comm_0217_001.ts buildHierarchy`), `toCreateRequest`/`toUpdateRequest` (omit type/enm/cont) |
| `types.ts` | `VasAccountStatus` (`active`/`inactive`), `VasAccountType` (`dual`/`credit`/`debit`), `VasAccountRow` (discriminated union on `kind`; child adds `parentCode`), `VasAccountFormValues` (`{ vasCode, accountName, status }`) |
| `lib/types/api.ts` | Wire types `ApiVasAccountRow`, `ApiVasAccountListResponse`, `ApiVasAccountLookupRow`/`Response`, `ApiVasAccountCreateRequest`/`UpdateRequest` |

## 6. API client (`lib/api/vasAccount.ts`)

| Function | Method · endpoint |
|---|---|
| `fetchVasAccounts(params)` | GET `/api/v1/settings/vas-account` |
| `fetchVasAccount(seqNo)` | GET `…/{seqNo}` |
| `fetchVasAccountLookup(searchWd?)` | GET `…/lookup` |
| `createVasAccount(body)` | POST `…` |
| `updateVasAccount(seqNo, body)` | PUT `…/{seqNo}` |
| `deleteVasAccount(seqNo)` | DELETE `…/{seqNo}` |
| `previewVasAccountExcel(file)` | POST `…/excel/preview` (multipart) |
| `importVasAccountExcel(body)` | POST `…/excel/import` |
| `downloadVasAccountTemplate(locale)` | client-side `<a download>` (static asset, no HTTP) |

Excel types (`ApiVasAccountExcelPreview`/`PreviewRow`/`FieldError`/`ImportRequest`/`ImportResult`) and
`FetchVasAccountsParams` also live here. See [api-consumption.md](api-consumption.md) for payload
shapes.

## 7. Shared components consumed

| Concern | Shared component |
|---|---|
| Excel upload shell | `components/shared/excel-upload/ExcelUploadDialog.tsx` |
| Search field | `components/shared/SearchInput.tsx` |
| System dialog (confirm / error / success) | `useDialog()` from `components/shared/dialog` |
| Template header validation | `templateValidator.ts` (`VAS_ACCOUNT_TEMPLATE_SPEC`) |

## 8. Cross-feature consumer

| File | Role |
|---|---|
| `components/settings/bank-account/VasAccountPicker.tsx` | Typeahead combobox for the Edit Bank Account dialog; calls `fetchVasAccountLookup()` once, caches, client-side filters; `VasAccountSelection = { seqNo:number, code, name }` |

## 9. Settings-modal integration (not a sidebar)

The panel mounts inside `<SettingsModal>` and inherits the modal's auth guard, Esc/X, and z-index
stack management (panel actions are `stackLevel 2` over the modal's `stackLevel 1`). No top-level
route, no AppShell sidebar entry — VAS Account is reached only through the Settings popup.
