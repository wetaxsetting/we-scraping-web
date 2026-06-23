# Bank Account — Component Index (Frontend)

Component / hook / API-client / type / i18n file map. Backend mirror:
[wecms-api/docs/features/settings/bank-account/source-code-index.md](../../../../../wecms-api/docs/features/settings/bank-account/source-code-index.md).

---

## Components (`components/settings/bank-account/`)

| File | Role |
|---|---|
| [BankAccountPanel.tsx](../../../../components/settings/bank-account/BankAccountPanel.tsx) | Main container — `useApiData` list fetch, `useTableSort`, `useViewSetting`, `refreshKey` refetch, dialog orchestration, error/wire-code mapping |
| [BankAccountTable.tsx](../../../../components/settings/bank-account/BankAccountTable.tsx) | View-Setting-aware table + cell renderers + `BANK_ACCOUNT_FIELD_LABEL_KEY` / `BankAccountFieldId` (re-exported via [columns.ts](../../../../components/settings/bank-account/columns.ts)) |
| [BankBrandLogo.tsx](../../../../components/settings/bank-account/BankBrandLogo.tsx) | Bank-logo cell (brand-coloured placeholder until the real PNG asset exists) |
| [EditBankAccountDialog.tsx](../../../../components/settings/bank-account/EditBankAccountDialog.tsx) | Edit one account — nickname, description, account type, maturity, VAS mapping → `PATCH` (diffs against seed) |
| [PermissionDialog.tsx](../../../../components/settings/bank-account/PermissionDialog.tsx) | View / Withdrawal roster editor → `GET`/`PUT …/permissions` (Figma 166:24840 / 166:25059); exports `PermissionKind` |
| [VasAccountPicker.tsx](../../../../components/settings/bank-account/VasAccountPicker.tsx) | Searchable VAS-account selector (seeds the edit dialog's VAS field) |
| [withdrawalPolicy.ts](../../../../components/settings/bank-account/withdrawalPolicy.ts) | 5-bank withdrawal whitelist — FE mirror of backend `WithdrawalBankPolicy` (`isWithdrawalAllowedBank`) |
| [columns.ts](../../../../components/settings/bank-account/columns.ts) | Re-export shim for `BANK_ACCOUNT_FIELD_LABEL_KEY` + `BankAccountFieldId` (canonical defs live in `BankAccountTable.tsx`) |
| [types.ts](../../../../components/settings/bank-account/types.ts) | `BankAccountRow` (in-memory, camelCase) + `BankAccountType` |

Shared components consumed: [`<SettingsModal>`](../../../../components/settings/SettingsModal.tsx) ·
[`<SettingsNav>`](../../../../components/settings/SettingsNav.tsx) ·
[`<ViewSettingPopover>`](../../../../components/shared/view-setting/ViewSettingPopover.tsx) ·
[`<PageActionButtons>`](../../../../components/shared/PageActionButtons.tsx) · the shared audit-log dialog
· `useDialog()`.

## Hooks

- [`useApiData`](../../../../lib/api/useApiData.ts) — `useApiData(() => fetchBankAccounts(sort.sortParams ?? {}), [sortField, sortDirection, refreshKey])`. Lightweight fetch-on-mount + refetch-on-deps; **no** React Query / SWR.
- [`useTableSort`](../../../../hooks/useTableSort.ts) — header sort cycle (default → ASC → DESC → default); `sortParams` flows into the fetch.
- [`useViewSetting`](../../../../components/shared/view-setting/useViewSetting.ts) — `useViewSetting(SCREEN_IDS.SETTINGS_BANK_ACCOUNT, DEFAULT_AREA_ID)`; drives the column visibility/order popover + persistence.

## API client + mappers + types

- [lib/api/bankAccount.ts](../../../../lib/api/bankAccount.ts) — `fetchBankAccounts` · `updateBankAccount` · `fetchBankAccountPermissions` · `updateBankAccountPermissions` · `fetchBankAccountAuditLogs` (+ the `ApiBankAccountUpdateRequest` type). Register is driven by the Login Credentials Add-chain client.
- [lib/api/mappers.ts](../../../../lib/api/mappers.ts) — `mapBankAccountRow` / `mapBankAccountList` (wire → `BankAccountRow`) + `mapBankAccountAuditList` (wire → shared `AuditLogRow`).
- [lib/types/api.ts](../../../../lib/types/api.ts) — `ApiBankAccountRow` · `ApiBankAccountListResponse` · `ApiBankAccountPermissionMember` · `ApiBankAccountPermissionResponse` · `ApiBankAccountPermissionUpdateRequest` · `ApiBankAccountAuditRow` · `ApiBankAccountAuditResponse` (lowercase snake_case wire shapes).
- [lib/viewSettingScreens.ts](../../../../lib/viewSettingScreens.ts) — `SCREEN_IDS.SETTINGS_BANK_ACCOUNT = "bank-account"`.

## i18n

`locales/{en,ko,vi}.json` — namespace `settings.bank_account.*` (+ `settings.nav.bank_account`). See
[ui-specification.md § i18n keys](ui-specification.md#i18n-keys-namespace-settingsbank_account).

## Scroll utility

`<BankAccountPanel>` table uses `custom-scrollbar` (registered consumer in `wecms-web/CLAUDE.md` §6c).

## Not used

- **No route** — modal panel only (no `app/(dashboard)/settings/bank-account/page.tsx`).
- **No create-from-scratch / delete / export / Excel-import** — accounts arrive via the scrape Add-chain
  (`register`); there is no de-register, no XLSX export, no Excel import on this panel.

## Stale-doc note

`wecms-web/CLAUDE.md` §3a labels this panel "Static UI · ViewSetting popover (static defaults)" — stale.
The panel is wired to the live endpoints above with the live `useViewSetting` hook.
