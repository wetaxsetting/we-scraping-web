# Change Password — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the Change Password feature dialog. Backend scenarios:
[wecms-api/docs/features/auth/change-password/test-scenarios.md](../../../../../wecms-api/docs/features/auth/change-password/test-scenarios.md).

> **Automated test coverage — MISSING.** No `*.test.tsx` / `*.spec.tsx` covers
> `<ChangePasswordDialog>`, the `changePassword` client, or `changePasswordSchema` (verified
> 2026-06-23 — no test file references `change-password` / `changePassword` / `ChangePasswordDialog`).
> The scenarios below are manual until a unit/integration suite lands.

---

## Open / close

| # | Scenario | Expected |
|---|---|---|
| O1 | Header avatar → ProfileMenu → Change Password row | profile popup closes; `<ChangePasswordDialog>` opens blank (three empty password fields), title "Change Password" |
| O2 | Cancel button | dialog closes; on reopen all three fields are blank (`reset()` on `!open`) |
| O3 | X close icon | dialog closes; fields cleared on reopen |
| O4 | ESC key | dialog closes (ESC enabled); fields cleared on reopen |
| O5 | Click the dimmed backdrop | dialog does **not** close (`closeOnOutsideClick={false}`) — a stray click never discards a typed password |
| O6 | Type into all fields, then Cancel, then reopen | fields are blank — no typed password leaks across opens |

## Client validation (Zod — API must NOT fire)

| # | Scenario | Expected |
|---|---|---|
| V1 | Submit with Current blank | error dialog `change_password.current_required`; focus → Current; no POST |
| V2 | Current filled, New blank | error dialog `change_password.new_required`; focus → New; no POST |
| V3 | Current + New filled, Confirm blank | error dialog `change_password.confirm_required`; focus → Confirm; no POST |
| V4 | **New ≠ Confirm** | error dialog `change_password.mismatch` (attached to Confirm, fires after required checks); no POST |
| V5 | A field > 100 chars | error dialog `login.password_max`; no POST |
| V6 | First-error precedence | with multiple invalid fields, only the **first** error in `FIELD_ORDER` (Current → New → Confirm) is shown |

## Submit — success

| # | Scenario | Expected |
|---|---|---|
| S1 | Valid Current + matching New/Confirm (not reused) | Save shows spinner + `change_password.saving`; POST `{current_password,new_password,confirm_password}`; success dialog `change_password.success`; ack → dialog closes; fields cleared |
| S2 | Submitting state | Save is `disabled` + `aria-busy` while in flight; no double-submit |

## Submit — backend errors (no client backstop / API path)

| # | Scenario | Expected |
|---|---|---|
| E1 | Wrong current password | `WBE2091` → error dialog ("Password confirmation failed."); row untouched; fields retained for retry |
| E2 | New password reused (within last 3) | `WBE_CHANGE_PASSWORD_REUSED` → error dialog; no client backstop, surfaces from API |
| E3 | New ≠ confirm reaches the server (client bypassed) | `WBE_CHANGE_PASSWORD_MISMATCH` → error dialog |
| E4 | Blank field reaches the server (client bypassed) | `WBE_VALIDATION` → error dialog |
| E5 | Backend unreachable | `WBE_NETWORK` → error dialog (`dialog.unexpected_error` fallback when no `LoginError` message) |
| E6 | Malformed response shape | `WBE_CLIENT_PARSE` → error dialog; `console.error` logs the original |

## Authorization / session

| # | Scenario | Expected |
|---|---|---|
| Z1 | Any signed-in user | Change Password row visible (self-service, no per-grant gate); dialog works |
| Z2 | Session expired (401) during submit | global Axios interceptor triggers the session-expired re-auth dialog (`WBE1401`) — not handled inside this dialog |

## Dialog-variant compliance (project-wide rule)

| # | Scenario | Expected |
|---|---|---|
| DV1 | Any validation or API failure | `type: "error"` (red) — never `type: "warning"` for validation/API errors |
| DV2 | Every dialog title | uses the shared `dialog.{error,success}` key — never the module name |
| DV3 | Success | `type: "success"` (blue check), titled `dialog.success` |

## i18n

| # | Scenario | Expected |
|---|---|---|
| I1 | Switch locale to KO / VI | every visible string (title, labels, placeholders, validation messages, success, Saving…, Cancel/Save) resolves via `t(...)` — all 13 `change_password.*` keys exist in en/ko/vi |
| I2 | No Khmer | KM not supported by `wecms-web` (no `km.json`) — out of scope |
