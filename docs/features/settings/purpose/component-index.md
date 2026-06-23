# Purpose — Component Index (Frontend)

Component / hook / API-client / type / i18n file map. Backend mirror:
[wecms-api/docs/features/settings/purpose/source-code-index.md](../../../../../wecms-api/docs/features/settings/purpose/source-code-index.md).

---

## Components (`components/settings/purpose/`)

| File | Role |
|---|---|
| [PurposePanel.tsx](../../../../components/settings/purpose/PurposePanel.tsx) | Main container — state, fetch (`useApiData`), mutation handlers, dialogs, error/wire-code mapping, mock fallback |
| [PurposeTable.tsx](../../../../components/settings/purpose/PurposeTable.tsx) | Read-only tree table renderer |
| [PurposeRow.tsx](../../../../components/settings/purpose/PurposeRow.tsx) | Single row (parent or child) |
| [PurposeTableColumns.tsx](../../../../components/settings/purpose/PurposeTableColumns.tsx) | Shared `<colgroup>` (reused by table + form row) |
| [PurposeFormRow.tsx](../../../../components/settings/purpose/PurposeFormRow.tsx) | Inline Add / Edit form (sticky bottom) |
| [ParentPurposePicker.tsx](../../../../components/settings/purpose/ParentPurposePicker.tsx) | Searchable level-1-only parent dropdown |
| [RowActions.tsx](../../../../components/settings/purpose/RowActions.tsx) | Edit · Delete · status-toggle buttons + delete confirmation |
| [ExcelUploadDialog.tsx](../../../../components/settings/purpose/ExcelUploadDialog.tsx) | Excel wrapper over the shared shell |
| [mockData.ts](../../../../components/settings/purpose/mockData.ts) | Offline-dev fallback tree |
| [types.ts](../../../../components/settings/purpose/types.ts) | `PurposeNode` (in-memory). The snake_case `Api*` wire types live in [lib/api/purposeSettings.ts](../../../../lib/api/purposeSettings.ts), not here. |

Shared shell consumed: [`<ExcelUploadDialog>`](../../../../components/shared/excel-upload/ExcelUploadDialog.tsx) · [`<SettingsModal>`](../../../../components/settings/SettingsModal.tsx) · [`<SettingsNav>`](../../../../components/settings/SettingsNav.tsx) · `useDialog()`.

## Hooks

- [`useApiData`](../../../../lib/api/useApiData.ts) — `useApiData(() => fetchPurposeSettings(), [refreshKey])`. The project does **not** use React Query / SWR; this lightweight hook owns fetch-on-mount + refetch-on-key.

## API client + mappers + types

- [lib/api/purposeSettings.ts](../../../../lib/api/purposeSettings.ts) — `fetchPurposeSettings` · `fetchPurposeSetting` · `createPurposeSetting` · `updatePurposeSetting` · `deletePurposeSetting` · `reorderPurposeSettings` · `previewPurposeExcel` · `importPurposeExcel` · `downloadPurposeTemplate`, plus the snake_case `Api*` wire types and `mapPurposeSettingRow` (wire → `PurposeNode`).
- In-memory type `PurposeNode` (camelCase: `code`, `name`, `description`, `enabled`, `parentSystemCd`, `parentHandCd`, `usedInTransactions`, `dispOrd`, `children`) lives in [components/settings/purpose/types.ts](../../../../components/settings/purpose/types.ts).

## i18n

`locales/{en,ko,vi}.json` — namespace `settings.purpose.*` (+ `settings.nav.purpose`). Full key list:
[ui-specification.md § i18n keys](ui-specification.md#i18n-keys-namespace-settingspurpose).

## Scroll utility

`<PurposePanel>` tree uses `custom-scrollbar-y` (registered consumer in `wecms-web/CLAUDE.md` §6c).

## Not used

- **No route** — modal panel only (no `app/(dashboard)/settings/purpose/page.tsx`).
- **No View Setting** — Purpose does not adopt the column-visibility popover (OQ-FE-1).
- **No data export** — only the static template download.
