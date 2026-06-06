# User Management — API Consumption (frontend)

Back to [README](README.md) · [component-index](component-index.md) · backend [interface-specification](../../../../../wecms-api/docs/features/settings/user-management/interface-specification.md)

All calls go through `lib/api/userManagement.ts` (base `/api/v1/settings/users`), using the shared
`api` Axios instance (JWT auto-attached) and unwrapping the `{ status, data }` envelope. No mock
fallback — the panel calls live endpoints.

---

## 1. User list

```
GET /api/v1/settings/users
→ ApiUserMgmtListResponse { users: ApiUserMgmtRow[], total_count }
```
`fetchUserMgmtList()` — called on panel mount. Rows → `SettingsUser` via `mapUserRow`.

## 2. User detail

```
GET /api/v1/settings/users/{user_id}
→ ApiUserMgmtRow
```
`fetchUserMgmtDetail(userId)` — available; the panel primarily relies on the list payload.

## 3. Check login-id

```
GET /api/v1/settings/users/check-id?login_id={id}
→ ApiCheckLoginIdResponse { available }
```
`checkLoginId(loginId)` — the Add form's "Check availability" button.

## 4. Create user

```
POST /api/v1/settings/users
body ApiUserMgmtCreateRequest { user_id, user_pw, user_nm, eml, clph_no, posi_nm, dept_nm, set_as_admin }
→ ApiUserMgmtRow
```
`createUserMgmt(body)` — Add form Save (`toCreateRequest(draft)`).

## 5. Update user

```
PUT /api/v1/settings/users/{user_id}
body ApiUserMgmtUpdateRequest { user_nm, eml, clph_no, posi_nm, dept_nm, set_as_admin, user_pw? }
→ ApiUserMgmtRow
```
`updateUserMgmt(userId, body)` — Edit form Save (`toUpdateRequest(draft)`; `user_pw` omitted when blank).

## 6. Delete user

```
DELETE /api/v1/settings/users/{user_id}
→ void
```
`deleteUserMgmt(userId)` — per-tenant unlink. Throws `ApiCallError(code)` on `status.error`
(`WBE_USERS_CANNOT_DELETE_SELF`, `WBE_USERS_CANNOT_DEMOTE_LAST_ADMIN`).

## 7. Menu entitlement

```
GET /api/v1/settings/users/{user_id}/menu-entitlement
→ ApiMenuEntitlementResponse { user_id, menu_auth_cds }

PUT /api/v1/settings/users/{user_id}/menu-entitlement
body ApiMenuEntitlementUpdateRequest { menu_auth_cds }   // full desired set
→ ApiMenuEntitlementResponse
```
`fetchMenuEntitlement(userId)` / `saveMenuEntitlement(userId, body)` — load on tab open; PUT on every
checkbox toggle.

## 8. Avatar

```
POST   /api/v1/settings/users/{user_id}/image     (multipart "file")  → ApiUserMgmtRow
DELETE /api/v1/settings/users/{user_id}/image                          → ApiUserMgmtRow
GET    /api/v1/settings/users/{user_id}/image      (responseType blob) → image bytes | null
```
`uploadUserImage(userId, file)` / `deleteUserImage(userId)` / `fetchUserImageBlob(userId)`.
`fetchUserImageBlob` maps `WBE2113` ("no avatar set") to `null` so the UI shows the initials
placeholder rather than erroring. Refreshed `user_img_url` carries a `?v={saveFileNm}` cache-buster.

## 9. Errors

Every wrapper throws `ApiCallError(code, message)` on `status.error`; pages route non-401 errors to
`useDialog({ type: "error", errorCode })`. 401 is handled globally by the Axios session-expired
interceptor. Avatar-specific codes: `WBE2111/2115/2116/2117/2118` (upload), `WBE2113/2114` (stream).

## 10. Wire ↔ in-memory mapping

| Wire (`ApiUserMgmtRow`) | In-memory (`SettingsUser`) |
|---|---|
| `user_id` | `id` / `loginId` |
| `user_nm` | `name` |
| `eml` | `email` |
| `clph_no` | `phoneNumber` (+ `phoneCountryCode = "84"` hardcoded) |
| `posi_nm` / `dept_nm` | `position` / `department` |
| `is_admin` | `role` (`"admin"` / `"user"`) |
| `is_current_user` | `isCurrentUser` |
| `user_img_url` | `imageUrl` |

Full backend contract (auth gates, error HTTP codes, example envelopes):
[wecms-api interface-specification](../../../../../wecms-api/docs/features/settings/user-management/interface-specification.md).
