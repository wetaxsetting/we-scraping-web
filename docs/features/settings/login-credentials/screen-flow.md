# Login Credentials — Screen Flow (Frontend)

Interaction flow for the Login Credentials panel. Backend flow:
[wecms-api/docs/features/settings/login-credentials/business-flow.md](../../../../../wecms-api/docs/features/settings/login-credentials/business-flow.md).

```
Top nav → Settings → <SettingsModal> opens → SettingsNav → "Login Credentials"
   (visible when the session has the settings-core-login-credentials grant or is admin)
      │
      ▼
<LoginCredentialsPanel> mounts
      │  useApiData(() => fetchLoginCredentials(), [refreshTick])
      ▼
GET /api/v1/login-credentials
      │  map ApiLoginCredentialGroup[] → LoginCredentialRow[]  (snake_case → camelCase)
      ▼
Table renders: one row per bank (logins + linked accounts) + one GDT row
```

---

## States

| State | Trigger | UI |
|---|---|---|
| **List (idle)** | panel mount, GET resolves | grouped table; per-row kebab (`LoginCredentialsRowMenu`) → Edit / Reveal / Delete / Disconnect / Audit Logs; "+ Add" primary button in header |
| **Loading** | GET in flight | `common.loading` notice (smoothed via `useStickyLoading`) |
| **Empty** | GET resolves with no rows | `settings.login_credentials.empty` |
| **Load error** | GET fails | error dialog (`settings.login_credentials.load_error`) |
| **Add — institution** | "+ Add" | `<SelectLoginInstitutionDialog>` (L1) → choose Bank or GDT |
| **Add — bank** | institution = Bank | `<SelectBankDialog>` → `<LoginIdPasswordDialog>` → verify → (challenge) → `<SelectBankAccountsDialog>` → Save |
| **Add — GDT** | institution = GDT | `<GdtCredentialsDialog>` (L1) → local-engine login test → Save |
| **Verify (scrape)** | Login pressed | `POST /banking/scraping/verify`; **no credential created** during the scrape; transient `pendingBankCredential` held in React state |
| **Challenge** | verify returns `OTP_REQUIRED` / `QNA_REQUIRED` / `CAPTCHA_REQUIRED` | OTP/QnA/CAPTCHA dialog (mutually exclusive) → resume the same session |
| **Atomic Save** | Save in Select Bank Accounts | `POST /api/v1/login-credentials/bank/register` (credential + accounts + auth in one backend tx); empty selection rejected |
| **Registered** | click a bank row / kebab → entries | `<RegisteredLoginCredentialsDialog>` (L2) — lists per-login entries for the bank, with Edit / Disconnect / Add-Login / Reveal-eye affordances |
| **Add a sibling login** | Registered → Add Login | `<LoginIdPasswordDialog>` (L3) → verify → `<SelectBankAccountsDialog>` → save → back to Registered |
| **Edit password** | Registered → pencil (or panel kebab → Edit) | `<EditLoginIdPasswordDialog>` (read-only id, editable password) → `verify-update` → PUT → success → back to Registered |
| **Reveal** | Registered → eye-slash | `<RevealPasswordConfirmDialog>` (L4) → re-auth → `POST .../reveal` → password shown (cached in `revealedByLoginId`) |
| **Delete** | kebab → Delete | confirmation (`delete_confirm`) → `DELETE .../{type}/{seqNo}` → success → refetch |
| **Disconnect** | Registered → Disconnect | confirmation (`disconnect_confirm`) → serial delete loop (not parallel) → success → refetch; closes Registered |
| **Audit Logs** | kebab → Audit Logs | `<AuditLogsDialog>` (L2) → `GET .../audit-logs` (live, no mock) |

---

## Modal stack levels (per the §"Modal stacking convention")

| Layer | Dialogs |
|---|---|
| **L1** | Settings shell (`<SettingsModal>`); plus the Add-flow entry dialogs `SelectLoginInstitutionDialog` + `GdtCredentialsDialog` |
| **L2** | `RegisteredLoginCredentialsDialog`, `AuditLogsDialog` |
| **L3** | `LoginIdPasswordDialog`, `SelectBankDialog`, `SelectBankAccountsDialog`, `EditLoginIdPasswordDialog` |
| **L4** | OTP / Q&A / CAPTCHA challenge dialog, `RevealPasswordConfirmDialog` |
| **System feedback (`z-[100]`)** | `useDialog()` success / error — appears above any chain depth |

> Stack-level labels reflect the open chain in `LoginCredentialsPanel`'s state machine. Both chains
> are **mutually exclusive at the child level** — opening one child closes any other in the same chain
> via a single `setState` swap. Cancel / Back / X / ESC dismisses **only the top-most** layer; the
> Settings shell rejects outside-click + ESC while any child is open. Body scroll lock lives on L1 and
> covers the whole stack.

---

## Refresh model

Every successful mutation bumps `refreshTick` (`setRefreshTick(n => n + 1)`), which `useApiData`
watches and re-runs the list fetch. There is no optimistic source-row mutation before the server
confirms. Two in-flight gates prevent duplicate requests: `mutationInFlight` (Add/Edit/GDT/Delete) and
`revealInFlight` (Reveal). A Disconnect that removes the last login on a bank row closes the Registered
dialog after the refetch.

---

## Authorization & visibility

The Login Credentials entry appears in `<SettingsNav>` only when the session is admin or the granted
menu codes include `settings-core-login-credentials`. The backend independently enforces
`@menuAuthz.canAccess('settings-core-login-credentials')` on every endpoint — the frontend gate is UX,
the backend gate is the security boundary.

---

## Security notes (frontend)

- **Password ciphertext never reaches the client** — the list/registered shapes carry login id only;
  the plaintext is returned solely by `POST .../reveal` after a successful re-auth.
- **Plaintext password in transit** is HTTPS-only; the transient `pendingBankCredential` / edit-draft
  state lives in React state, never `localStorage` / `sessionStorage`.
- **Verify-before-save** is the design guarantee: a credential row only lands in `BANK_CERT_INFO` after
  Coocon confirms the login works (atomic Save), so abandoning the Add flow (Back / X / ESC / overlay /
  challenge cancel) leaves **no** credential behind.
