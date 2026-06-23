# Login — API Consumption (Frontend)

The single endpoint the login page calls, both response shapes, the wire ↔ in-memory mapping, and the
error surface. Backend contract:
[wecms-api/docs/features/auth/login/interface-specification.md](../../../../../wecms-api/docs/features/auth/login/interface-specification.md).
All calls go through [`login()`](../../../../lib/auth/client.ts) (the Axios `api` instance with the JWT
interceptor); wire is lowercase snake_case, mapped to camelCase at the boundary.

---

## Endpoint

| Action | Client fn | Method + URL | Request | Response |
|---|---|---|---|---|
| Login (step 1 + step 2) | `login(userId, userPw, bizKey?)` | `POST /api/v1/auth/login` | `LoginRequestRec` | `ApiResponse<LoginResponseRec>` |

`login()` is called twice in the multi-link path: first without `biz_key` (credentials only), then with
the chosen `biz_key` to finalize. Both calls hit the same endpoint.

> Token storage + the `Authorization: Bearer` interceptor are documented in
> [jwt-authentication](../jwt-authentication/README.md). `GET /api/v1/auth/me` (session rehydrate) is
> documented in [session-management](../session-management/README.md). `POST /api/v1/auth/logout` is
> [logout](../logout/README.md). `login()` lives in the same `lib/auth/client.ts` file as those, but
> only the login endpoint is in this module's scope.

---

## Request — `LoginRequestRec`

```ts
interface LoginRequestRec {
  user_id: string;
  user_pw: string;
  biz_key?: string;   // omitted on step 1; the chosen company on step 2
}
```

The form builds the body conditionally — `biz_key` is added only when present, so step 1 sends exactly
`{ user_id, user_pw }`. The frontend never invents a `biz_key`; step 2 sends back only a value the
backend listed in `companies_available`.

---

## Response — `LoginResponseRec` (dual shape)

The same wire type carries **both** outcomes, discriminated by which fields are present:

```ts
interface LoginResponseRec {
  // Authenticated shape — present iff the login resolved to a single company
  access_token?: string;
  token_type?:   string;
  expires_in?:   number;

  user_id: string;
  user_nm: string;

  biz_key?:    string;            // BIZ_KEY the JWT was issued for
  lang_cd?:    string;
  cmpn_nm?:    string;
  auth_gr_cd?: "ADMIN" | "USER";
  prdt_type?:  string | null;     // verbatim BUSI_INFM.PRDT_TYPE
  tax_id?:     string | null;     // verbatim BUSI_INFM.TAX_ID (Lock Screen popup)

  // Chooser shape — non-empty when the user has ≥ 2 active company links
  companies_available?: CompanyOptionRec[];
}

interface CompanyOptionRec {
  biz_key:    string;
  cmpn_nm:    string;
  auth_gr_cd: "ADMIN" | "USER";
  prdt_type?: string | null;      // round-tripped; display-only, no JWT yet
}
```

### Branch discrimination in `login()`

1. **Chooser** — `companies_available` is non-empty **and** there is no `access_token`. Returns
   `{ kind: "chooser", userId, userName, companies: companies_available.map(toCompanyChoice) }`.
2. **Authenticated** — `access_token` is present. Returns
   `{ kind: "authenticated", stored: toStoredUser(payload), accessToken, expiresIn }`.
3. **Neither** — `WBE_CLIENT_PARSE` (`LoginError`).

---

## Mapping (boundary) — `lib/auth/client.ts`

### `toStoredUser(rec)` — authenticated shape → in-memory `StoredUser`

| Wire (snake_case) | `StoredUser` (camelCase) | Notes |
|---|---|---|
| `user_id` | `userId` | |
| `user_nm` | `userName` | |
| `biz_key` | `bizKey` | `?? ""` |
| `lang_cd` | `langCode` | `?? "EN"` |
| `cmpn_nm` | `companyName` | `?? ""` |
| `auth_gr_cd` | `role` | `normaliseRole` → `"ADMIN"` only when exactly `"ADMIN"`, else `"USER"` |
| `prdt_type` | `productType` | `normaliseProductType` → trimmed string, `""` when null (legacy letters preserved verbatim) |
| `tax_id` | `taxId` | `?? ""` — user-facing company tax id (never surface `bizKey` to the user) |
| `all_menus` | `allMenus` | absent on the login response → defaults `role === "ADMIN"`; real value filled by `fetchMe()` |
| `allowed_menu_cds` | `allowedMenuCds` | `?? []`; real value filled by `fetchMe()` |

### `toCompanyChoice(rec)` — chooser option → `CompanyChoice`

`biz_key → bizKey`, `cmpn_nm → companyName`, `auth_gr_cd → role` (`normaliseRole`),
`prdt_type → productType` (`normaliseProductType`). The chooser renders a product label only when
`productType` ∈ `KNOWN_PRODUCT_TYPES`.

---

## Envelope + error handling

Every response is the standard envelope `{ status: { error, code, message }, data?, trace_id? }`.
`login()` checks `status.error` (HTTP 200 ≠ success for business errors) and `data` presence, then
throws `LoginError` carrying `status.code` + `status.message` + `trace_id`. `toLoginError(err)` funnels
**every** failure into a meaningful `LoginError`:

```ts
class LoginError extends Error { code: string; traceId?: string }
```

| Branch | Code | When |
|---|---|---|
| Server responded with `status` | backend code (e.g. `WBE1009`) | business error in the envelope or an Axios error with a parseable response body |
| Network, no response | `WBE_NETWORK` | Axios threw with no response |
| Malformed shape | `WBE_CLIENT_PARSE` | missing `status`, neither token nor companies, or a local JS error (logged to `console.error`) |

### Backend error codes surfaced

| Code | Meaning (localized via the backend message / dialog) |
|---|---|
| `WBI0000` | Success |
| `WBE1009` | Bad credentials · user not provisioned for the tenant · 0 active links · wrong/unknown `biz_key` |
| `WBE1010` | Account not activated (`ACTV_YN = N`) |
| `WBE1011` | Account locked (`LOCK_YN = Y`) |
| `WBE1128` | Account deleted (`DEL_YN = Y`) |

`<LoginForm>` opens a `useDialog()` `type:"error"` dialog with the code, message, and trace id (the
server `traceId`, or the browser-local `localTraceId()` fallback ending `LOCL` for pure network
failures). 401s on other endpoints are handled by the global Axios interceptor — login itself returns
its own error envelope, not a 401, for bad credentials.

---

## Notes

- **No mock fallback** — login is a real auth call against `POST /api/v1/auth/login`; there is no
  static seed.
- **Wire ↔ in-memory translation happens once** at the auth boundary (`toStoredUser` /
  `toCompanyChoice`). Components, storage, and the chooser never read snake_case directly.
- **Parity:** the dual-shape response (auto-pick single link, chooser for ≥ 2) is classified **MATCH**
  against the backend `AuthService.login` flow.
