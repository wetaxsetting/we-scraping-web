# Login Credentials — UI Specification (Frontend)

The implemented Login Credentials panel UI. Follows the Settings shell + panel-composition contract
and the Settings UI consistency rules in `wecms-web/CLAUDE.md` §3a / §3b. Backend reference:
[wecms-api/docs/features/settings/login-credentials/functional-specification.md](../../../../../wecms-api/docs/features/settings/login-credentials/functional-specification.md).

---

## Panel composition

[`<LoginCredentialsPanel>`](../../../../components/settings/login-credentials/LoginCredentialsPanel.tsx)
follows the §3a Settings shell contract:

```
[ Header — title + description (left) · "+ Add" primary button (right) ]
[ Scroll region — bare <table> + sticky <thead> + custom-scrollbar ]
```

- **Header:** title `settings.login_credentials.title` + description `settings.login_credentials.description`.
  Right-side action is the §3b §B canonical brand-pill `bg-brand text-white shadow-wb-brand-btn h-8 px-3
  text-wb-14-tight font-medium` ("+ Add"). No print / export / list-view icons (View Setting not
  adopted).
- **Scroll:** the table body scrolls inside `custom-scrollbar`; the header + Add button stay pinned
  outside the scroll region per the panel composition rule.

## Credentials table

[`<LoginCredentialsTable>`](../../../../components/settings/login-credentials/LoginCredentialsTable.tsx)
— bare `<table>` + sticky `<thead>`, one row per institution group.

| Column | Source field | Notes |
|---|---|---|
| **Institution / bank** | `institution` (bank name lookup, or literal "GDT") | with bank logo where available |
| **Login ID** | first `accounts[].login_id` (+ entries) | siblings disambiguated by `login_type` |
| **Bank Account** | `bank_accounts[]` | first `acct_nick_nm + acct_no` + `+N` badge |
| **Modified** | `modified_by` / `modified_at` | latest across the group |
| (actions) | — | kebab → Edit · Reveal · Delete / Disconnect · Audit Logs ([`<LoginCredentialsRowMenu>`](../../../../components/settings/login-credentials/LoginCredentialsRowMenu.tsx)) |

The row kebab (`size-6` trigger + `size-3.5` icon) opens a portal-positioned menu; the destructive
"Delete" row uses the documented `text-[#bd1822]` exception (pending a `text-wb-red-deep` token).

## Add chain (panel "+ Add")

1. **Institution** — [`<SelectLoginInstitutionDialog>`](../../../../components/shared/popups/SelectLoginInstitutionDialog.tsx) (L1): Bank or GDT.
2. **Bank branch:**
   - [`<SelectBankDialog>`](../../../../components/shared/popups/SelectBankDialog.tsx) (L3) — bank picker (search + list from `GET /banks`).
   - [`<LoginIdPasswordDialog>`](../../../../components/shared/popups/LoginIdPasswordDialog.tsx) (L3) — dynamic form (radio sub-types + localised labels from `GET /banks/{bankCd}/form-info`). "Login" runs the server-side Coocon verify.
   - challenge dialog (OTP / Q&A / CAPTCHA, L4) when the gateway requires it.
   - [`<SelectBankAccountsDialog>`](../../../../components/shared/popups/SelectBankAccountsDialog.tsx) (L3) — picks accounts from the scrape; "Save" calls the atomic register endpoint.
3. **GDT branch:** [`<GdtCredentialsDialog>`](../../../../components/shared/popups/GdtCredentialsDialog.tsx) (L1) — login id + password; client-side local-engine login test driven by `GET /gdt/engine-config`; Save upserts.

## Registered chain (click a bank row / kebab → Edit)

[`<RegisteredLoginCredentialsDialog>`](../../../../components/shared/popups/RegisteredLoginCredentialsDialog.tsx) (L2) lists per-login entries for one bank (`buildRegisteredCredentialEntries` in [registeredCredentials.ts](../../../../components/settings/login-credentials/registeredCredentials.ts)), with:

- **Add Login** → `<LoginIdPasswordDialog>` (L3) → verify → `<SelectBankAccountsDialog>` (L3) → save → back.
- **Edit (pencil)** → [`<EditLoginIdPasswordDialog>`](../../../../components/shared/popups/EditLoginIdPasswordDialog.tsx) (L3, read-only id + editable password) → `verify-update` → PUT → success → back.
- **Reveal (eye-slash)** → [`<RevealPasswordConfirmDialog>`](../../../../components/shared/popups/RevealPasswordConfirmDialog.tsx) (L4) → re-auth → `POST .../reveal` → reveal in place.
- **Disconnect** → confirmation → serial delete of all logins at the bank → close.

## Select Bank Accounts popup (remediation state, 2026-06-17)

- Fixed height = Settings-modal default (viewport-bounded); only the table **body** scrolls; sticky
  header, pinned footer.
- **Account Type** dropdown shows only Current / Savings / Fixed Deposit; auto-selects the
  backend-mapped `acct_type_cd` (via `NXISAS_ACCT_TYPE_MAPPING`), blank + manual when unmapped, never
  raw scraped labels. Selected rows require Account No + Currency + Account Type before Save.
- **Maturity Date** read-only (`"—"` when blank), persisted to `ACCT_MSTR.EXPI_DT`.
- **VAS Code / VAS Account Name** render for non-`H` product types and persist; hidden + omitted for
  product type `H` (`showVas = !isProductType(userStorage.get(), "H")`).
- **Balance** sent + persisted to `ACCT_MSTR.BAL`; no Balance column in the UI (legacy parity).
- **Atomic Save** — `createBankLoginCredentialWithAccounts` → `POST /bank/register`. Abandon ⇒ no
  credential.

## Delete / Reveal / Audit dialogs

- **Delete** uses `useDialog()` `type: "confirmation"` (`delete_confirm`) → on success `type:
  "success"` (`delete_success`); a server error → `type: "error"`.
- **Audit Logs** — [`<AuditLogsDialog>`](../../../../components/shared/popups/AuditLogsDialog.tsx) (L2), live `GET .../audit-logs`, latest-first.

## Dialog variants & buttons (project-wide rules)

- API / network / validation failures use `type: "error"` (red, single OK); never `"warning"`.
- Confirmations (Delete / Disconnect) use `type: "confirmation"` (Cancel + Continue pair).
- Success (save / update / delete / reveal) uses `type: "success"`.
- Titles always use the shared `dialog.{error,warning,confirmation,success}` keys — never the module
  name. Buttons follow the §3b §B canonical `h-8 px-3 text-wb-14-tight font-medium` system; secondary
  white + `shadow-wb-btn`, primary `bg-brand` + `shadow-wb-brand-btn`, disabled `bg-wb-ntrl-4`.

## States

Loading / empty / load-error per [screen-flow.md](screen-flow.md). The panel uses `useStickyLoading`
to smooth the loading indicator.

## i18n keys (namespace `settings.login_credentials.*`)

`title` · `description` · `add` · `empty` · `load_error` · `delete_confirm` · `disconnect_confirm` ·
`delete_success` · `disconnect_success` · `edit_success` · `reveal_success` ·
`confirmation.{title,label,required,placeholder,helper}` · `bank_login.unknown_error` ·
`select_bank_accounts.save_success` · `gdt.{save_success,engine_not_installed,engine_unsupported_os,
engine_loading,engine_error,captcha_exceeded,login_failed}` ·
`audit_logs.{title,description,activity.login_credentials}`. Plus the nav label and the shared
`dialog.*` / `common.*` keys. All present in `locales/{en,ko,vi}.json`.

| Wire error code | i18n key / handling |
|---|---|
| `WBE2090` | error dialog (credential not found) |
| `WBE2091` | error dialog (password confirmation failed) |
| `WBE_LOGIN_CREDENTIAL_GDT_EXISTS` | error dialog (GDT already exists) — `gdt.*` |
| `WBE_LOGIN_CREDENTIAL_GDT_VERIFY_FAILED` | error dialog — `gdt.login_failed` |
| `WBE_BANK_ACCOUNT_REGISTER_EMPTY` | error — `bank_login.unknown_error` |
| scrape `error_code` (`WBE_NXISAS`, `WBE6121`, `80000015`, …) | resolved via `lookupScrapingResultMessage` / GDT engine keys, surfaced in the Add/challenge dialog |
| network / other | error · `dialog.error` / generic |
