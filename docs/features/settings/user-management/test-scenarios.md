# User Management — Test Scenarios (frontend SIT/UAT)

Back to [README](README.md) · [ui-specification](ui-specification.md) · backend [test-scenarios](../../../../../wecms-api/docs/features/settings/user-management/test-scenarios.md)

Frontend behaviour of the Settings → Users panel. Run as ADMIN unless noted.

---

## 1. List & search

| ID | Scenario | Expected |
|---|---|---|
| FE-L1 | Open Settings → Users | Panel loads list via `GET /settings/users`; subtitle shows active count |
| FE-L2 | Search by name/login/email | Rows filter in-memory, case-insensitive |
| FE-L3 | Sort | Admin rows appear before user rows |
| FE-L4 | Current user row | Shows "(You)" suffix |
| FE-L5 | Avatar | Image when set, initials disc otherwise |

## 2. Create

| ID | Scenario | Expected |
|---|---|---|
| FE-C1 | Open Add form | "+ Add a user" → ADD pane with empty fields, country code `+84` default |
| FE-C2 | Check availability (free) | Success dialog "available" |
| FE-C3 | Check availability (taken) | Error dialog "taken" |
| FE-C4 | Empty password | Save blocked, error dialog |
| FE-C5 | Password ≠ confirm | Save blocked, error dialog |
| FE-C6 | Valid save | `POST /settings/users`; list refreshes; new row present |
| FE-C7 | Duplicate id at save | Backend `WBE_USERS_DUPLICATE_LOGIN_ID` → error dialog |
| FE-C8 | Set as Admin | New user shows Admin badge |

## 3. Edit

| ID | Scenario | Expected |
|---|---|---|
| FE-E1 | Open Edit | VIEW → "Edit"; login id field disabled; password placeholder "optional" |
| FE-E2 | Change profile, blank password | `PUT`; password unchanged |
| FE-E3 | Change password mismatched | Save blocked, error dialog |
| FE-E4 | Toggle admin on | `set_as_admin=true`; badge flips to Admin |
| FE-E5 | Cancel | Draft discarded (form unmounts), back to VIEW |
| FE-E6 | Switch selected user | Form reseeds (key) — no stale draft |

## 4. Delete

| ID | Scenario | Expected |
|---|---|---|
| FE-D1 | Delete other user | Confirmation → `DELETE`; row gone after refresh |
| FE-D2 | Delete self | Backend `WBE_USERS_CANNOT_DELETE_SELF` → error dialog |
| FE-D3 | Delete last admin | Backend `WBE_USERS_CANNOT_DEMOTE_LAST_ADMIN` → error dialog |

## 5. Menu entitlement

| ID | Scenario | Expected |
|---|---|---|
| FE-M1 | Open tab (non-admin target) | Tab visible; grants loaded checked |
| FE-M2 | Toggle a checkbox | Immediate `PUT .../menu-entitlement`; optimistic check |
| FE-M3 | PUT fails | Checkbox rolls back; error dialog |
| FE-M4 | Admin target | Menu Entitlement tab hidden |
| FE-M5 | Granted user re-login | Menu shows only granted items (Menu Authorization) |

## 6. Read-only viewer (non-admin with `settings-core-users`)

| ID | Scenario | Expected |
|---|---|---|
| FE-R1 | Open panel | List + detail visible (read-only) |
| FE-R2 | "+ Add a user" | Row **not rendered** |
| FE-R3 | Edit button | **Not rendered** in VIEW |
| FE-R4 | "Set as Admin" | Visible but **disabled** |
| FE-R5 | Password fields | Masked `************`, read-only |
| FE-R6 | Menu Entitlement tab | **Hidden** |
| FE-R7 | Avatar | Inert disc — no click/drag, no Remove |
| FE-R8 | Direct write attempt (devtools) | Backend returns **403 / WBE1003** regardless of UI |
| FE-R9 | No grant + non-admin | Panel shows `<PanelPlaceholder>`, not the user UI |

## 7. Validation & errors

| ID | Scenario | Expected |
|---|---|---|
| FE-V1 | Invalid email | Backend `WBE_VALIDATION` → error dialog |
| FE-V2 | Weak/short password | Backend `WBE_VALIDATION` → error dialog |
| FE-V3 | Avatar > 2 MB | Client blocks (or backend `WBE2117`) → error dialog |
| FE-V4 | Avatar wrong type | Client blocks (or backend `WBE2118`) → error dialog |
| FE-V5 | Network failure | `error` dialog with trace id; never a bespoke banner |
| FE-V6 | Session expired (401) | Global interceptor → re-login dialog |

## 8. i18n / a11y

| ID | Scenario | Expected |
|---|---|---|
| FE-I1 | EN/KO/VI | All labels via `t(...)`; no hardcoded strings |
| FE-I2 | Dialog variants | error/confirmation/success per the §3 dialog rules |
| FE-I3 | Keyboard | List rows focusable; disabled controls not focusable in VIEW |

Backend-side equivalents (CRUD, permission, security, validation):
[wecms-api test-scenarios](../../../../../wecms-api/docs/features/settings/user-management/test-scenarios.md).
