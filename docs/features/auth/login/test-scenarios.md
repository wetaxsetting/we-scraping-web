# Login — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the `/login` page. Backend scenarios:
[wecms-api/docs/features/auth/login/test-scenarios.md](../../../../../wecms-api/docs/features/auth/login/test-scenarios.md).

> **Automated FE coverage = MISSING.** There are no `*.test.tsx` / `*.spec.tsx` files for the login
> module (no test runner configured in `wecms-web`). All scenarios below are manual. When a frontend
> test harness lands, the success / failure / chooser / Save-ID cases are the priority targets.

---

## Validation (client-side, no network call)

| # | Scenario | Expected |
|---|---|---|
| V1 | Submit with blank User ID | `type:"error"` dialog, `t("login.user_id_required")`; focus returns to User ID; **no** `POST` fired |
| V2 | Submit with blank password | `type:"error"` dialog, `t("login.password_required")`; focus returns to password; no `POST` |
| V3 | User ID > 50 chars | `login.user_id_max` error dialog |
| V4 | Password > 100 chars | `login.password_max` error dialog |
| V5 | Both fields invalid | first error by `FIELD_ORDER` (`userId` before `password`) surfaces; only one dialog |

## Login success (single active link — normal path)

| # | Scenario | Expected |
|---|---|---|
| S1 | Valid id + password, one active company | `POST /auth/login {user_id,user_pw}` → authenticated; token + user persisted; redirect to `/banking/account-inquiry` |
| S2 | Login button while submitting | button shows spinner + `login.logging_in`, `disabled` + `aria-busy`; no double-submit |
| S3 | After success, sidebar/profile reflect the user | dashboard mount `fetchMe()` fills real menus before nav renders (see session-management) |

## Login failure

| # | Scenario | Expected |
|---|---|---|
| F1 | Wrong password / unknown user | `WBE1009` error dialog; password field reset + re-focused; no redirect |
| F2 | User with 0 active company links | `WBE1009` (treated as bad credentials) |
| F3 | Backend unreachable | `WBE_NETWORK` error dialog; trace id ends `LOCL` (browser-local) |
| F4 | Malformed response shape | `WBE_CLIENT_PARSE` error dialog; original error logged to console |
| F5 | Server sent a `trace_id` | dialog renders that id verbatim (grepable in server logs) |

## Account state gates

| # | Scenario | Expected |
|---|---|---|
| L1 | Locked account (`LOCK_YN=Y`) | `WBE1011` error dialog; no token |
| L2 | Not-activated account (`ACTV_YN=N`) | `WBE1010` error dialog; no token |
| L3 | Deleted account (`DEL_YN=Y`) | `WBE1128` error dialog; no token |

## Company chooser (≥ 2 active links — exceptional path) — MATCH

| # | Scenario | Expected |
|---|---|---|
| C1 | Valid credentials, user has ≥ 2 active links | `<CompanyChooser>` replaces the form; one radio row per company; first option focused + pre-selected; **no token issued yet** |
| C2 | Pick a company → Continue | `POST /auth/login {user_id,user_pw,biz_key}` → authenticated; redirect to `HOME_ROUTE` |
| C3 | Continue while submitting | radios + buttons disabled; Continue shows spinner |
| C4 | Back from chooser | returns to credentials form; password reset + re-focused; in-memory credentials dropped |
| C5 | Refresh during chooser | credentials lost; user restarts at the credentials step (nothing persisted) |
| C6 | Links change between step 1 and step 2 (chooser re-issued) | list re-seeds, stays in chooser, no error |
| C7 | Step-2 sends an unauthorised `biz_key` | backend returns `WBE1009`; error dialog |
| C8 | Company with known product type `F`/`M`/`H` | role pill + product label (`WeCMS` / `WeCMS Lumens` / `HAENGSUNG Electronics`) shown |
| C9 | Company with a deferred legacy product letter | row renders; **no** product badge (display gating only) |

## Save ID

| # | Scenario | Expected |
|---|---|---|
| SI1 | Login with Save ID checked | `wecms_saved_user_id` written on success |
| SI2 | Return to /login after SI1 | User ID pre-filled, Save-ID checked, focus jumps to password |
| SI3 | Login with Save ID unchecked | `wecms_saved_user_id` cleared on success |
| SI4 | Logout then revisit /login | saved id survives (logout never clears `wecms_saved_user_id`) — id still pre-filled |

## Show / hide password

| # | Scenario | Expected |
|---|---|---|
| P1 | Click the eye toggle | password text toggles visible/hidden; `aria-pressed` flips; `aria-label` swaps show/hide |

## Cross-cutting

- Every visible string resolves via `t(...)` in EN / KO / VI.
- All error dialogs are `type:"error"` (red, single OK) titled with the shared `dialog.error` key — never
  `type:"warning"`, never the module name as title.
- The route is public at the edge (middleware lets `/login` through); an already-authenticated visit is
  governed by [session-management](../session-management/README.md), not this page.
- Responsive: verify the split-screen at 375 / 768 / 1024 / 1440 — form-first stack on mobile, marketing
  left / form right at `md+`, no page scroll at `md+`.
