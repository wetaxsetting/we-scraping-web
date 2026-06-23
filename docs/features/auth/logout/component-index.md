# Logout — Component Index (Frontend)

Component / client / storage file map for logout. Backend mirror:
[wecms-api/docs/features/auth/logout/source-code-index.md](../../../../../wecms-api/docs/features/auth/logout/source-code-index.md).

Logout is a **thin** module — three files carry the whole flow: the trigger UI, the auth
client function, and the storage helpers it clears (and the ones it deliberately does not).

---

## Trigger (UI)

| File | Role |
|---|---|
| [components/layout/ProfileMenu.tsx](../../../../components/layout/ProfileMenu.tsx) | Avatar dropdown. The Logout rail's `onClick={handleLogout}` closes the dropdown, opens the `useDialog()` confirmation, and on confirm runs `startLogout(async () => { await logout(); router.replace("/login"); })`. Owns the `useTransition()` `isPending` → `profile.signing_out` / disabled state. |

## Auth client

| File | Export | Role |
|---|---|---|
| [lib/auth/client.ts](../../../../lib/auth/client.ts) | `logout(): Promise<void>` | Best-effort `POST /api/v1/auth/logout` in a `try`/`catch` (error swallowed), then in `finally`: `tokenStorage.clear()` + `userStorage.clear()`. Documented invariant: only the auth-scoped keys are cleared; never `localStorage.clear()`. |

## Storage helpers

[lib/auth/storage.ts](../../../../lib/auth/storage.ts) — logout calls the first two and **must
not** touch the last two:

| Export | Key | Logout calls it? | Role |
|---|---|---|---|
| `tokenStorage.clear()` | `wecms_token` | **Yes** | Removes the JWT from `localStorage` **and** the mirrored non-HttpOnly cookie (`clearTokenCookie`) so the edge middleware also sees the session as gone |
| `userStorage.clear()` | `wecms_user` | **Yes** | Removes the `StoredUser` JSON |
| `savedIdStorage` | `wecms_saved_user_id` | **No** | "Save ID" preference — preserved so the login form pre-fills |
| (`LocaleProvider`) | `wecms_locale` | **No** | i18n preference — preserved so `/login` renders in the last-chosen language |

## Shared dialog

| File | Role |
|---|---|
| [components/shared/dialog/](../../../../components/shared/dialog/) | `useDialog()` → `<SystemDialog>`. Logout uses `type: "confirmation"` with the shared `dialog.confirmation` / `dialog.yes` / `dialog.no` keys. Not a logout-specific dialog. |

## Routing

| File | Role |
|---|---|
| [lib/routes.ts](../../../../lib/routes.ts) | No logout constant — the redirect target `/login` is a raw string passed to `router.replace("/login")`. `HOME_ROUTE` / `BANKING_HOME` / `PAYMENT_HOME` are the only named route constants; logout's `/login` target is not centralised here. |

## i18n

`locales/{en,ko,vi}.json` — `logout.confirm_description`, `profile.logout`,
`profile.signing_out`, plus the shared `dialog.*` keys. Full list:
[ui-specification.md § i18n keys](ui-specification.md#i18n-keys).

## Not used

- **No route / page** — dropdown row only.
- **No logout-specific dialog component** — goes through shared `useDialog()`.
- **No mappers / wire types** — the request has no body and the response is ignored
  (`ApiResponse<null>`, never read).
- **No View Setting, export, or table** — not a list feature.
