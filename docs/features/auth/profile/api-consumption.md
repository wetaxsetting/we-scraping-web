# Auth > Profile — API Consumption (Frontend)

What the profile surface reads, and the gaps. Backend contract (tenant directory):
[wecms-api/docs/features/auth/profile/interface-specification.md](../../../../../wecms-api/docs/features/auth/profile/interface-specification.md).

**Headline: the ProfileMenu surface consumes NO profile endpoint.** The signed-in user's identity is
read from [`userStorage`](../../../../lib/auth/storage.ts) (`StoredUser`), which was populated earlier by
the **login** response and refreshed by **`GET /api/v1/auth/me`** on the dashboard mount. The language
switch is a **client-only** locale change with no HTTP call.

---

## Identity source (no endpoint)

```
POST /api/v1/auth/login   ──┐
GET  /api/v1/auth/me      ──┤→ toStoredUser(...) → userStorage.set(StoredUser) → localStorage["wecms_user"]
                            │
                            ▼
            ProfileMenu: userStorage.get() → { userName, userId, … }
```

| Action | Client fn | Method + URL | Where documented |
|---|---|---|---|
| Identity at login | `login(...)` | `POST /api/v1/auth/login` | [login](../login/api-consumption.md) |
| Identity rehydrate | `fetchMe()` | `GET /api/v1/auth/me` | [session-management](../session-management/api-consumption.md) |
| Logout | `logout()` | best-effort `POST /api/v1/auth/logout` | [logout](../logout/api-consumption.md) |
| Language switch | `setLocale(next)` | **none** (client-only; persists `wecms_locale`) | this module |

`ProfileMenu` itself calls only `userStorage.get()` (sync, local) and `setLocale(...)` (sync, local).
The only HTTP it triggers is `logout()` — owned by the [logout](../logout/README.md) module.

---

## Fields consumed

`ProfileMenu` reads exactly two fields off `StoredUser`:

| UI element | `StoredUser` field | Fallback |
|---|---|---|
| Name (popup title) | `userName` | `t("profile.guest")` → "Guest" |
| Secondary line | `userId` | `""` (line hidden when empty) |

The wire→camelCase translation (`user_nm` → `userName`, `user_id` → `userId`, …) happens once at the
auth boundary in `lib/auth/client.ts#toStoredUser`; `ProfileMenu` never sees snake_case. The other
`StoredUser` fields (`bizKey`, `langCode`, `companyName`, `role`, `productType`, `taxId`, `allMenus`,
`allowedMenuCds`) are present but not rendered by the profile surface.

---

## Gap classification (vocabulary per the shared brief)

| Capability | Classification | Notes |
|---|---|---|
| **Language switch** | **MATCH** | Client-only locale persistence (`wecms_locale`) — no backend round-trip. Mirrors the legacy locale dropdown; no API contract is involved. |
| **Self-profile-edit** (edit own name / email / details from the profile surface) | **MISSING** in auth scope | No self-profile edit UI or endpoint exists on the profile surface. Self-profile / user-record editing lives under backend **Settings > Users** (`domain/setting/users`) — out of scope here. Cross-reference: [wecms-api/docs/features/auth/profile/README.md](../../../../../wecms-api/docs/features/auth/profile/README.md). |
| **Avatar edit** (the pencil button) | **MISSING** | UI-only placeholder — no `onClick`, no upload endpoint. Avatar image CRUD (upload / get / delete) is backend **Settings > Users**; the per-tenant avatar source is `USER_BUSI_CONN_INFM.USER_IMG`. The default avatar `/assets/header/avatar.svg` is a static asset; the surface never fetches a stored avatar. |

> The backend `profile` feature documents `GET /api/v1/users` — the **tenant user directory** (a port of
> legacy `comm_0192_001_r001`, used by approval-line / signer pickers). That endpoint is **not** consumed
> by this frontend profile surface and is **not** a self-profile endpoint. Do not wire the ProfileMenu
> identity block to it.

---

## Envelope + error handling

The profile surface makes no direct API call, so it has no per-call envelope handling of its own. The
`logout()` POST it triggers swallows errors by design (best-effort) — see [logout](../logout/api-consumption.md).
401s on any other call in the app are handled globally by the Axios response interceptor in
[`lib/axios.ts`](../../../../lib/axios.ts) (session-expired re-auth), not by ProfileMenu.

---

## Notes

- **No mock data** — the identity block is driven entirely by `userStorage`; there is no `mockData.ts`.
- **No profile API client** — `lib/api/` has no `profile.ts`; adding one would be a new contract and
  must pair with a backend change per the full-stack ownership rule.
- **`wecms_locale` survives logout** — the language choice is a user preference, never cleared.
