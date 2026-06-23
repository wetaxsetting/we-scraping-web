# Login Credentials — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the Login Credentials panel. Backend scenarios:
[wecms-api/docs/features/settings/login-credentials/test-scenarios.md](../../../../../wecms-api/docs/features/settings/login-credentials/test-scenarios.md).

---

## List

| # | Scenario | Expected |
|---|---|---|
| L1 | Open the panel | grouped table loads (one row per bank + one GDT row); no password shown |
| L2 | Two logins at one bank, different sub-type | both appear under the bank's Registered dialog, disambiguated by sub-type label |
| L3 | Linked accounts | first account nickname + number shown with a `+N` badge |
| L4 | Empty tenant | empty-state message (`settings.login_credentials.empty`) |

## Add — bank

| # | Scenario | Expected |
|---|---|---|
| AB1 | "+ Add" → Institution → Bank | `SelectBankDialog` opens (L3) |
| AB2 | Pick bank → Login ID/PW | `LoginIdPasswordDialog` renders radio sub-types + localised labels from `/banks/{bankCd}/form-info` |
| AB3 | Login → verify COMPLETED | `SelectBankAccountsDialog` opens with scraped accounts; **no credential created yet** |
| AB4 | verify `OTP_REQUIRED` | OTP dialog (L4) → submit → COMPLETED → accounts |
| AB5 | verify `ERROR` (wrong password / `80000015` unlicensed) | error dialog with the resolved message; flow collapses; no credential |
| AB6 | Pick accounts → Save | atomic `POST /bank/register`; success toast `select_bank_accounts.save_success`; refetch |
| AB7 | Save with no account selected | `WBE_BANK_ACCOUNT_REGISTER_EMPTY` error; no credential written |
| AB8 | Abandon (Back / X / ESC / overlay / challenge cancel) | draft dropped — no credential created |
| AB9 | Product type `H` | VAS Code / VAS Account Name columns hidden + omitted from the Save payload |

## Add — GDT

| # | Scenario | Expected |
|---|---|---|
| AG1 | Institution → GDT | `GdtCredentialsDialog` (L1) opens |
| AG2 | Enter id + password → Save (first GDT) | success; GDT row appears after refetch |
| AG3 | Add a second GDT credential | `WBE_LOGIN_CREDENTIAL_GDT_EXISTS` error |
| AG4 | GDT local engine not installed / unsupported OS / loading | the matching `gdt.engine_*` dialog (error or warning) |
| AG5 | GDT captcha exceeded (3 tries) | `WBE6121` → `gdt.captcha_exceeded` error |

## Edit

| # | Scenario | Expected |
|---|---|---|
| E1 | Registered → pencil → change password | `EditLoginIdPasswordDialog` (read-only id); verify-update → PUT → `edit_success` |
| E2 | Edit verify returns ERROR / wrong new password | error dialog; existing password preserved (no PUT) |
| E3 | Edit `old_password` mismatch on PUT | `WBE2091` error; row untouched |
| E4 | Edit verify `OTP_REQUIRED` | OTP dialog → COMPLETED → PUT |

## Delete / Disconnect

| # | Scenario | Expected |
|---|---|---|
| D1 | kebab → Delete | confirmation (`delete_confirm`) → DELETE → `delete_success` → refetch |
| D2 | Registered → Disconnect (all logins at a bank) | confirmation (`disconnect_confirm`) → serial deletes → `disconnect_success`; Registered closes |
| D3 | Delete a bank credential | the bank's accounts remain on Account Inquiry, shown as "disconnected" (no cascade) |
| D4 | Double-click Delete | `mutationInFlight` gate prevents a duplicate request |

## Reveal

| # | Scenario | Expected |
|---|---|---|
| RV1 | Registered → eye-slash → correct credential password | `RevealPasswordConfirmDialog` → `POST .../reveal` → password shown; `reveal_success` |
| RV2 | Reveal wrong password | `WBE2091` error |
| RV3 | Reveal twice | `revealInFlight` gate prevents a duplicate; cached in `revealedByLoginId` |

## Audit Logs

| # | Scenario | Expected |
|---|---|---|
| AU1 | kebab → Audit Logs | `AuditLogsDialog` (L2) opens; live `GET .../audit-logs`, latest-first (no mock) |
| AU2 | Rows include live JEX-written events (shared DB) | surface too (backend reads slug + legacy `comm_0218_*` ids) |

## Authorization

| # | Scenario | Expected |
|---|---|---|
| Z1 | User with `settings-core-login-credentials` | entry visible; all actions work |
| Z2 | User without the grant | entry hidden from `<SettingsNav>`; direct API attempts 403 server-side |
| Z3 | Session expired (401) | global Axios interceptor triggers the re-auth dialog |

## Error handling

| # | Scenario | Expected |
|---|---|---|
| ER1 | Backend unreachable on load | error dialog (`load_error`) |
| ER2 | API failure on a mutation | `type: "error"` dialog with the mapped message/code (never `warning` for API/validation failures) |
| ER3 | All success dialogs | `type: "success"`, titled with the shared `dialog.success` key (never the module name) |

## Cross-cutting

- Verify the modal stack: Settings L1 → Registered L2 → child L3 → challenge/reveal L4; dim compounds
  per level; only the top layer is interactive; `useDialog()` feedback (`z-[100]`) appears above the
  chain.
- ESC / X / Back / overlay dismiss only the **top-most** layer; the Settings shell never closes from
  outside-click while a child is open.
- Verify every visible string resolves via `t(...)` in EN / KO / VI.
- No data export (Login Credentials has none — no Excel scenario).
