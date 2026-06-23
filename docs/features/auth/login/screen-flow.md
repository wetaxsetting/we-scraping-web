# Login — Screen Flow (Frontend)

Interaction flow for the `/login` page. Backend flow:
[wecms-api/docs/features/auth/login/business-flow.md](../../../../../wecms-api/docs/features/auth/login/business-flow.md).

```
Visit /login  (public route — edge middleware lets it through; see session-management)
      │
      ▼
app/(auth)/layout.tsx  → split-screen shell (MarketingPanel + LoginForm)
      │
      ▼
<LoginForm> mounts
      │  useEffect: savedIdStorage.get()
      │    ├─ has saved id → setValue("userId", id) + saveId=true + focus password
      │    └─ no saved id  → focus userId
      ▼
STEP 1 — user types userId + password, submits
      │  zodResolver(loginSchema) runs FIRST (client-side)
      │    ├─ invalid → error dialog with t(messageKey); NO network call
      │    └─ valid   → login(userId, password)  →  POST /api/v1/auth/login {user_id,user_pw}
      ▼
result.kind ?
  ├─ "authenticated"  → completeLogin() → tokenStorage.set + userStorage.set
  │                       + (saveId ? savedIdStorage.set : clear) → router.push(HOME_ROUTE)
  │
  └─ "chooser"        → setChooser({userId, password, saveId, userName, companies})
                          render <CompanyChooser>  (credentials stay in React state only)
                              │
                              ▼
                        STEP 2 — user picks a company, clicks Continue
                              │  finalizeChooser(bizKey) → login(userId, password, bizKey)
                              ▼
                        result.kind ?
                          ├─ "authenticated" → completeLogin() → router.push(HOME_ROUTE)
                          └─ "chooser"       → links changed mid-flow → re-seed list, stay in chooser
```

---

## States

| State | Trigger | UI |
|---|---|---|
| **Idle (credentials)** | page mount | `MarketingPanel` + `LoginForm` (logo · User ID · Password · Save ID · Login button) |
| **Save-ID rehydrated** | `savedIdStorage.get()` returns an id on mount | `userId` pre-filled, `saveId` checked, focus jumps to password (`setFocus("password")`) |
| **Submitting (step 1)** | Login pressed, schema valid | button shows `Loader2` spinner + `login.logging_in`, `disabled` + `aria-busy` |
| **Validation error** | Zod rejects | `useDialog()` `type:"error"`, description = `t(messageKey)`, `onClose` re-focuses the offending field. **No network call** (RHF invalid branch) |
| **Login error** | backend `status.error` / network failure | `type:"error"` dialog with backend `code` + `traceId`; `onClose` resets + focuses password |
| **Chooser** | `result.kind === "chooser"` (≥ 2 active links) | `<CompanyChooser>` replaces the form; one radio row per `CompanyChoice`, first option focused + pre-selected |
| **Submitting (step 2)** | Continue pressed in chooser | `submitting` disables radios + buttons; Continue shows spinner |
| **Chooser re-issued** | step-2 `login()` returns `chooser` again (links changed) | list re-seeded, stays in chooser, `submitting` cleared |
| **Cancel chooser** | Back pressed | `setChooser(null)` → back to step 1; password reset + re-focused |
| **Authenticated** | `result.kind === "authenticated"` (either step) | token + user persisted, redirect to `HOME_ROUTE` |

---

## Save ID rehydration

`wecms_saved_user_id` (`savedIdStorage`) persists the last-used login id across sessions **and across
logout** (logout never clears it). On mount:

- present → `userId` is pre-filled, the Save-ID checkbox is checked, and focus jumps straight to the
  password field so a returning user types one field.
- absent → focus lands on `userId`.

On a successful login, `completeLogin` writes the id when Save-ID is checked and clears it otherwise.
The rehydrate runs inside a `useEffect` (browser-only — `localStorage` is unavailable during SSR) and
defers the `saveId` state update via `startTransition`.

---

## Post-login redirect

`completeLogin` is shared by the single-link auto-pick path and the multi-link finalize path. It always:

1. `tokenStorage.set(accessToken)` — localStorage + non-HttpOnly cookie (see
   [jwt-authentication](../jwt-authentication/README.md)).
2. `userStorage.set(stored)` — the camelCase `StoredUser` JSON.
3. `savedIdStorage.set(userId)` or `.clear()` per the Save-ID checkbox.
4. `router.push(HOME_ROUTE)` → `/banking/account-inquiry`.

The login response carries no menus (`allMenus`/`allowedMenuCds` are interim values); the dashboard's
mount `fetchMe()` fills in the real grants before the nav renders — see
[session-management](../session-management/README.md).

---

## Credential handling (security)

- **Plaintext never persisted.** Between step 1 and step 2 the credentials live only in React state
  (`PendingChooser`). A refresh discards them — the user restarts at the credentials step.
- **No interim half-authenticated token.** The chooser holds no token; the JWT is issued only after
  step 2 finalizes a company pick.
- **The frontend never invents a `biz_key`** — the chooser can only submit a value the backend itself
  listed in `companies_available`.
