# Logout — Screen Flow (Frontend)

Interaction flow for the logout action. Backend flow:
[wecms-api/docs/features/auth/logout/business-flow.md](../../../../../wecms-api/docs/features/auth/logout/business-flow.md).

```
Header → ProfileMenu (avatar dropdown) → "Logout" rail
      │  handleLogout(): close the dropdown, open the confirmation dialog
      ▼
useDialog().open({ type: "confirmation", description: t("logout.confirm_description") })
      │
      ├── No / Cancel / dismiss ────────────────► dialog closes, nothing happens (still logged in)
      │
      └── Yes / Confirm
              │  startLogout(async () => { … })   ← useTransition; row → "Signing out…", disabled
              ▼
        lib/auth/client.logout()
              │  try:    POST /api/v1/auth/logout      (best-effort; NO body)
              │  catch:  swallow — cleanup still runs
              │  finally:
              │     tokenStorage.clear()   → removes wecms_token  (+ token cookie)
              │     userStorage.clear()    → removes wecms_user
              ▼
        router.replace("/login")            ← replace, not push (no back-into-session)
```

---

## States

| State | Trigger | UI |
|---|---|---|
| **Idle** | dropdown open | Logout rail shows `profile.logout` ("Logout") |
| **Confirm** | click Logout rail | `useDialog()` confirmation dialog (`logout.confirm_description`), Yes / No |
| **Signing out** | confirm Yes | `useTransition` pending — rail label flips to `profile.signing_out` ("Signing out…"), rail `disabled` (`disabled:cursor-wait disabled:opacity-60`) |
| **Done** | cleanup + redirect | `router.replace("/login")` — login page renders in the preserved locale, saved ID pre-filled |
| **Cancelled** | confirm No / dismiss | dialog closes, session intact, no network call, no cleanup |

---

## What survives logout

Logout clears **only the two auth-scoped keys**; the cleanup is in `logout()`'s `finally`,
so it runs whether or not the server call succeeds.

| Key | Owner | Cleared on logout? | Why |
|---|---|---|---|
| `wecms_token` | `tokenStorage` | **Yes** | Auth state — also clears the mirrored token cookie |
| `wecms_user` | `userStorage` | **Yes** | Auth state — the `StoredUser` JSON |
| `wecms_locale` | `LocaleProvider` | **No** | User preference — login page must render in the last-chosen language |
| `wecms_saved_user_id` | `savedIdStorage` | **No** | User preference — "Save ID" must survive so the login form pre-fills |

**Invariant (do not regress):** `logout()` never calls `localStorage.clear()`. Removing only
`wecms_token` + `wecms_user` is deliberate — see the comment block in
[lib/auth/client.ts](../../../../lib/auth/client.ts) and `wecms-web/CLAUDE.md` § Auth Rules →
Logout / localStorage keys (owned).

---

## Error / resilience model

- The `POST /api/v1/auth/logout` call is wrapped in `try { … } catch { /* swallow */ }`. A
  network failure, 4xx, 5xx, or any thrown error **does not** block logout — the `finally`
  block clears storage regardless. A user can always log out client-side even when the
  backend is unreachable.
- No error dialog is shown for a failed logout POST (deliberate — the local cleanup is the
  effective logout). This differs from `login` / `change-password`, which surface
  `LoginError` via `useDialog()`.
- `router.replace` (not `push`) is used so the browser back button does not return the user
  into a half-cleared dashboard.

---

## Authorization & visibility

The Logout rail is always present in `<ProfileMenu>` for an authenticated session (the
dropdown only renders inside the dashboard shell). The endpoint itself is **permit-all** on
the backend — logout requires no valid token, which is what lets the swallow-on-error path
stay safe.
