# Logout — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the logout flow. Backend scenarios:
[wecms-api/docs/features/auth/logout/test-scenarios.md](../../../../../wecms-api/docs/features/auth/logout/test-scenarios.md).

---

## Confirm flow

| # | Scenario | Expected |
|---|---|---|
| LO1 | Open ProfileMenu → click Logout | dropdown closes; `useDialog()` confirmation opens with `logout.confirm_description` ("Are you sure you want to exit WeCMS?"), Yes / No buttons |
| LO2 | Confirm **Yes** | `POST /api/v1/auth/logout` fires; `wecms_token` + `wecms_user` cleared; redirect to `/login` (via `router.replace`, not `push`) |
| LO3 | Confirm **No** | dialog closes; session intact; **no** network call; **no** storage cleared; user stays on the current page |
| LO4 | Dismiss via X (where rendered) | same as No — session untouched |
| LO5 | Signing-out state | between confirm and redirect, the Logout rail shows `profile.signing_out` ("Signing out…") and is `disabled` (cursor-wait, opacity-60) |
| LO6 | Double-click Logout rail while pending | `disabled={isPending}` prevents a second trigger |

## Swallowed-error resilience

| # | Scenario | Expected |
|---|---|---|
| LE1 | Backend unreachable / network error on the POST | error swallowed; `finally` still clears `wecms_token` + `wecms_user`; redirect to `/login` proceeds — user is logged out client-side |
| LE2 | Backend returns 4xx / 5xx | same as LE1 — no error dialog, cleanup + redirect still run |
| LE3 | Backend returns 401 on logout | axios response interceptor excludes `/auth/logout` from the 401 → re-auth flow; no SessionExpired dialog; falls into swallow path → cleanup + redirect |
| LE4 | No error dialog ever shows for a failed logout | confirmed — logout deliberately surfaces no `useDialog()` error (unlike login / change-password) |

## Preserved-keys invariant

| # | Scenario | Expected |
|---|---|---|
| LP1 | User set locale to KO, then logs out | `wecms_locale` survives; `/login` renders in Korean |
| LP2 | User had "Save ID" on (saved `wecms_saved_user_id`), then logs out | `wecms_saved_user_id` survives; login form pre-fills the saved ID |
| LP3 | Inspect `localStorage` after logout | only `wecms_token` + `wecms_user` removed; `wecms_locale` + `wecms_saved_user_id` remain; **`localStorage.clear()` was NOT called** |
| LP4 | Token cookie after logout | the mirrored `wecms_token` cookie is cleared (`tokenStorage.clear()` → `clearTokenCookie`) so the edge middleware treats protected routes as unauthenticated |

## Post-logout navigation

| # | Scenario | Expected |
|---|---|---|
| LN1 | Browser Back after logout | `router.replace` was used, so Back does not return into a half-cleared dashboard |
| LN2 | Navigate to a protected route after logout | edge middleware (`proxy.ts`) sees no `wecms_token` cookie → redirect to `/login?next=<path>` |

## i18n

| # | Scenario | Expected |
|---|---|---|
| LI1 | Verify all visible strings | `logout.confirm_description`, `profile.logout`, `profile.signing_out`, `dialog.confirmation`, `dialog.yes`, `dialog.no` resolve via `t(...)` in EN / KO / VI |

## Automated test coverage

| Layer | Status |
|---|---|
| Frontend unit / integration tests for `logout()` cleanup + preserved-keys invariant | **MISSING** — no FE test file exercises `lib/auth/client.logout()` or the ProfileMenu confirm path today. Recommended first coverage: assert `tokenStorage.clear()` + `userStorage.clear()` run on both the success and the swallowed-error path, and that `wecms_locale` / `wecms_saved_user_id` are untouched. |

## Cross-cutting

- Verify the confirmation dialog uses `type: "confirmation"` (green icon) and the shared
  `dialog.confirmation` title — **not** a module-named title, **not** a warning/error variant.
- Verify the Yes button is the standard blue primary (no `destructive: true`).
- No success dialog is shown — the `/login` redirect is the only completion signal.
