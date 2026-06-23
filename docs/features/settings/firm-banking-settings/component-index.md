# Firm Banking Settings — Component Index (Frontend)

Component / hook / API-client / type / mapper / i18n file map. Backend mirror:
[wecms-api/docs/features/settings/firm-banking-settings/source-code-index.md](../../../../../wecms-api/docs/features/settings/firm-banking-settings/source-code-index.md).

---

## Components (`components/settings/firm-banking-settings/`)

| File | Role |
|---|---|
| [FirmBankingSettingsPanel.tsx](../../../../components/settings/firm-banking-settings/FirmBankingSettingsPanel.tsx) | Main container — state, list fetch (`useApiData`), env hook, delete handler + in-flight guard, dialog orchestration, error-dialog mapping |
| [FirmBankingAutomationSettings.tsx](../../../../components/settings/firm-banking-settings/FirmBankingAutomationSettings.tsx) | Two immediate-save toggles (Environment Settings — separate feature) |
| [FirmBankingLinkedAccounts.tsx](../../../../components/settings/firm-banking-settings/FirmBankingLinkedAccounts.tsx) | Linked-accounts list renderer |
| [FirmBankingAccountItem.tsx](../../../../components/settings/firm-banking-settings/FirmBankingAccountItem.tsx) | Single linked-account row (logo · account · status · last-updated · kebab) |
| [BankLogo.tsx](../../../../components/settings/firm-banking-settings/BankLogo.tsx) | Bank mark resolver (by NAPAS code / brand; initials fallback) |
| [FirmBankingDetailsDialog.tsx](../../../../components/settings/firm-banking-settings/FirmBankingDetailsDialog.tsx) | Detail + per-row audit-log dialog (fetches detail + audit by PK) |
| [NewFirmBankingDialog.tsx](../../../../components/settings/firm-banking-settings/NewFirmBankingDialog.tsx) | Create dialog (withdrawal-account autocomplete + 5 fields → POST) |
| [EditFirmBankingDetailsDialog.tsx](../../../../components/settings/firm-banking-settings/EditFirmBankingDetailsDialog.tsx) | Edit dialog (3 editable fields → PUT) |
| [FirmBankingRowMenu.tsx](../../../../components/settings/firm-banking-settings/FirmBankingRowMenu.tsx) | Portal-rendered kebab menu (Edit / Delete) |
| [types.ts](../../../../components/settings/firm-banking-settings/types.ts) | In-memory types (`FirmBankingLinkedAccount`, `FirmBankingAutomationSetting`, `AccountLookupOption`, `FirmBankingAuditLogRow`, `BankBrand`) |
| `mockData.ts` | Offline-dev fallback rows |

Shared shells consumed: [`<SettingsModal>`](../../../../components/settings/SettingsModal.tsx) ·
[`<SettingsNav>`](../../../../components/settings/SettingsNav.tsx) · `useDialog()` · shadcn `<Dialog>`.

## Hooks

- [`useApiData`](../../../../lib/api/useApiData.ts) — `useApiData(fetchFirmBankingSettings, [refetchToken])`
  for the list (and `fetchFirmBankingSetting` / `fetchFirmBankingSettingAudit` inside the Details dialog).
- [`useEnvironmentSettings`](../../../../hooks/useEnvironmentSettings.ts) — drives the two Automation
  toggles (env codes `00078` / `00079`), optimistic update + revert.
- [`useStickyLoading`](../../../../hooks/useStickyLoading.ts) — smooths the list-loading notice.

## API client + wire types + mappers

- [lib/api/firmBankingSettings.ts](../../../../lib/api/firmBankingSettings.ts) —
  `fetchFirmBankingSettings` · `fetchFirmBankingSetting` · `fetchFirmBankingSettingAudit` ·
  `createFirmBankingSetting` · `updateFirmBankingSetting` · `deleteFirmBankingSetting`, plus the
  `ApiFirmBankingSettingCreateRequest` / `…UpdateRequest` wire bodies.
- Wire types in [lib/types/api.ts](../../../../lib/types/api.ts): `ApiFirmBankingSettingRow`,
  `ApiFirmBankingSettingListResponse`, `ApiFirmBankingSettingDetail`, `ApiFirmBankingAuditEntry`,
  `ApiFirmBankingAuditListResponse` (lowercase snake_case mirroring the backend DTOs).
- Mappers in [lib/api/mappers.ts](../../../../lib/api/mappers.ts): `mapFirmBankingSettingRow` (wire row →
  `FirmBankingLinkedAccount`, masks the account number + resolves brand/name), `mapFirmBankingAuditEntry`
  (splits `reg_dtm` → date/time), `mapAccountLookupOption` (Create autocomplete option).

## i18n

`locales/{en,ko,vi}.json` — namespace `settings.firm_banking_settings.*` (+ `settings.nav.firm_banking_settings`).
Full key list: [ui-specification.md § i18n keys](ui-specification.md#i18n-keys-namespace-settingsfirm_banking_settings).

## Scroll utility

The panel scroll region uses `custom-scrollbar`; the audit-log body uses `custom-scrollbar-y`.

## Not used

- **No route** — modal panel only (no `app/(dashboard)/settings/firm-banking-settings/page.tsx`).
- **No View Setting** — Firm Banking Settings does not adopt the column-visibility popover.
- **No Excel export / import.**
