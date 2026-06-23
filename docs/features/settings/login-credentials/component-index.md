# Login Credentials — Component Index (Frontend)

Component / hook / API-client / type / popup file map. Backend mirror:
[wecms-api/docs/features/settings/login-credentials/source-code-index.md](../../../../../wecms-api/docs/features/settings/login-credentials/source-code-index.md).

---

## Components (`components/settings/login-credentials/`)

| File | Role |
|---|---|
| [LoginCredentialsPanel.tsx](../../../../components/settings/login-credentials/LoginCredentialsPanel.tsx) | Main container — list fetch (`useApiData`), the Add + Registered chain state machines, all mutation handlers, dialog orchestration, error→dialog mapping, refresh model |
| [LoginCredentialsTable.tsx](../../../../components/settings/login-credentials/LoginCredentialsTable.tsx) | Grouped credentials table (one row per institution) |
| [LoginCredentialsRowMenu.tsx](../../../../components/settings/login-credentials/LoginCredentialsRowMenu.tsx) | Per-row kebab menu → Edit / Reveal / Delete / Disconnect / Audit Logs (portal-positioned) |
| [LoginIdPwPopover.tsx](../../../../components/settings/login-credentials/LoginIdPwPopover.tsx) | Inline login-id/password popover variant |
| [registeredCredentials.ts](../../../../components/settings/login-credentials/registeredCredentials.ts) | `RegisteredCredentialEntry` + `buildRegisteredCredentialEntries()` — builds the per-login entries for the Registered dialog |
| [auditLogs.ts](../../../../components/settings/login-credentials/auditLogs.ts) | `LoginCredentialAuditActivity` + `LoginCredentialAuditLogRow` view types |
| [types.ts](../../../../components/settings/login-credentials/types.ts) | `LoginCredentialRow` · `LoginCredentialAccount` · `LoginCredentialBankAccount` (in-memory camelCase) |
| [useGdtCredentialValidation.ts](../../../../components/settings/login-credentials/useGdtCredentialValidation.ts) | GDT validation / local-engine probe hook (enabled only while the GDT dialog is open) |

## Shared popups (`components/shared/popups/`)

| File | Stack level | Role |
|---|---|---|
| [SelectLoginInstitutionDialog.tsx](../../../../components/shared/popups/SelectLoginInstitutionDialog.tsx) | L1 | Add-flow entry — Bank vs GDT |
| [SelectBankDialog.tsx](../../../../components/shared/popups/SelectBankDialog.tsx) | L3 | Bank picker (search + `GET /banks`) |
| [LoginIdPasswordDialog.tsx](../../../../components/shared/popups/LoginIdPasswordDialog.tsx) | L3 | Dynamic login form (radio sub-types + localised labels); "Login" → Coocon verify |
| [SelectBankAccountsDialog.tsx](../../../../components/shared/popups/SelectBankAccountsDialog.tsx) | L3 | Account picker after a COMPLETED scrape; "Save" → atomic register |
| [RegisteredLoginCredentialsDialog.tsx](../../../../components/shared/popups/RegisteredLoginCredentialsDialog.tsx) | L2 | Registered-credentials list (Add Login / Edit / Reveal / Disconnect) |
| [EditLoginIdPasswordDialog.tsx](../../../../components/shared/popups/EditLoginIdPasswordDialog.tsx) | L3 | Edit one credential (read-only id, editable password) |
| [RevealPasswordConfirmDialog.tsx](../../../../components/shared/popups/RevealPasswordConfirmDialog.tsx) | L4 | Reveal re-auth (confirm the credential's own password) |
| [GdtCredentialsDialog.tsx](../../../../components/shared/popups/GdtCredentialsDialog.tsx) | L1 | GDT credential entry + local-engine login test |
| [AuditLogsDialog.tsx](../../../../components/shared/popups/AuditLogsDialog.tsx) | L2 | Per-row audit history (live) |
| OTP / Q&A / CAPTCHA challenge dialog | L4 | NXiSAS challenge response (mutually exclusive; resumes the scrape session) |

> Per `wecms-web/CLAUDE.md` §"Modal stacking convention": each level declares its `stackLevel` on
> `<DialogContent>`; never ship a Settings child at the default `stackLevel={1}`. The two Add-flow
> entry dialogs (`SelectLoginInstitutionDialog`, `GdtCredentialsDialog`) sit at L1 because they open
> directly from the panel "+ Add" before any L2 chain.

## Hooks

- [`useApiData`](../../../../lib/api/useApiData.ts) — `useApiData(() => fetchLoginCredentials(), [refreshTick])` (fetch on mount + refetch on key).
- `useStickyLoading()` — smooths the loading indicator.
- `useGdtCredentialValidation(gdtDialogOpen)` — GDT local-engine validation (component-local).
- `useDialog()` / `useTranslation()` — shared system dialog + i18n.

## API client + mappers + types

- [lib/api/loginCredentials.ts](../../../../lib/api/loginCredentials.ts) — `fetchLoginCredentials` ·
  `deleteLoginCredential` · `revealLoginCredential` · `fetchLoginCredentialAuditLogs` ·
  `createBankLoginCredential` · `createBankLoginCredentialWithAccounts` · `updateBankLoginCredential` ·
  `verifyBankPasswordUpdate` · `createGdtLoginCredential` · `updateGdtLoginCredential` ·
  `fetchGdtEngineConfig` · `fetchLoginCredentialBanks` · `fetchLoginCredentialBankFormInfo`. Each
  `unwrap`s the `ApiResponse<T>` envelope and throws `ApiCallError(code, message)` on `status.error`.
- Wire types in [lib/types/api.ts](../../../../lib/types/api.ts) — `ApiLoginCredential*` family (see
  [api-consumption.md](api-consumption.md)).
- In-memory camelCase types in [components/settings/login-credentials/types.ts](../../../../components/settings/login-credentials/types.ts).

## i18n

`locales/{en,ko,vi}.json` — namespace `settings.login_credentials.*` (+ the nav label + shared
`dialog.*` / `common.*`). Full key list: [ui-specification.md § i18n keys](ui-specification.md#i18n-keys-namespace-settingslogin_credentials).

## Scroll utility

`<LoginCredentialsPanel>` table uses `custom-scrollbar` per `wecms-web/CLAUDE.md` §6c.

## Not used

- **No route** — modal panel only.
- **No View Setting** — no toolbar list-icon (slug reserved for log/audit consistency only).
- **No data export** — credentials have no Excel export.
