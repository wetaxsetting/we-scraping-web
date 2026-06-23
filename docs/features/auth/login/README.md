# Auth > Login — Frontend Feature (Refactor)

**Status:** ✅ Working — `/login` runs real JWT auth against `POST /api/v1/auth/login`, with Save ID,
show/hide password, Zod validation (translation-key messages), the two-step **CompanyChooser** fallback
for multi-link users, and a post-login redirect to `HOME_ROUTE`.
**Route:** `/login` (route group `app/(auth)/login/` — `(auth)` is invisible in the URL)
**Slug:** `login` (matches the backend counterpart + the cross-module slug set)
**Backend base path:** `POST /api/v1/auth/login`

> This folder is the standardized frontend documentation home for the **login** module. The stale
> single-file root note ([../login-auth.md](../login-auth.md)) and the root group index
> ([../README.md](../README.md)) both claim **"no BIZ_KEY chooser"** — that is **STALE**.
> [`CompanyChooser.tsx`](../../../../components/auth/CompanyChooser.tsx) exists and is the wired
> multi-link fallback; this folder documents it as the source of truth and classifies it **MATCH**
> against the backend chooser response.

---

## What this screen is

The split-screen login page (Figma 199:6973 / 199:7230 / 199:7493 / 199:7830). A `MarketingPanel`
(left at `md+`, bottom on mobile) sits beside a `LoginForm` (right at `md+`). The user submits
`userId` + `password`; the backend resolves the tenant from `USER_BUSI_CONN_INFM`:

- **0 active links** → `WBE1009` (treated as bad credentials).
- **1 active link** → backend auto-picks it and issues the JWT in the same call — the **normal
  production path** (one user = one company).
- **≥ 2 active links** with no `biz_key` → backend returns a **chooser** envelope
  (`companies_available[]`, no token). `LoginForm` swaps to `<CompanyChooser>`, holds the credentials
  in memory, and re-posts them with the chosen `biz_key`. This is the **exceptional path** — kept
  implemented so multi-link users don't error out, not promoted as routine UX.

On a successful (authenticated) response the form persists the token + user, optionally stores the
Save-ID, and `router.push(HOME_ROUTE)`.

What the page does **not** carry (per memory `feedback_wecms_login_ui_shape`): no signup, no
forgot-password, no account provisioning. Those are DBA-only and out of scope.

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Two-step user flow (credentials → optional chooser → finalize), Save-ID rehydration, post-login redirect, error/cancel paths |
| [ui-specification.md](ui-specification.md) | Split-screen layout, form fields, typography tokens, the chooser UI, error-dialog handling, i18n keys |
| [component-index.md](component-index.md) | Component / schema / API-client / type / storage file map |
| [api-consumption.md](api-consumption.md) | `POST /api/v1/auth/login` request + both response shapes, wire types, `toStoredUser` / `toCompanyChoice` mapping, `LoginError`, error codes |
| [test-scenarios.md](test-scenarios.md) | Manual login scenarios (success / failure / locked / deleted / chooser / Save-ID); automated FE coverage = MISSING |

---

## Quick facts

| Aspect | Value |
|---|---|
| Page | [`app/(auth)/login/page.tsx`](../../../../app/(auth)/login/page.tsx) — composes `<LoginForm>` + `<MarketingPanel>` |
| Layout | [`app/(auth)/layout.tsx`](../../../../app/(auth)/layout.tsx) — split-screen grid |
| Form | [`<LoginForm>`](../../../../components/auth/LoginForm.tsx) — two-step state machine |
| Chooser | [`<CompanyChooser>`](../../../../components/auth/CompanyChooser.tsx) — multi-link fallback (MATCH) |
| Schema | [`loginSchema.ts`](../../../../app/(auth)/login/loginSchema.ts) — Zod; messages are i18n keys; `userId` 1–50, `password` 1–100 |
| API client | [`login()`](../../../../lib/auth/client.ts) in `lib/auth/client.ts` |
| Wire types | [`lib/types/api.ts`](../../../../lib/types/api.ts) — `LoginRequestRec` / `LoginResponseRec` / `CompanyOptionRec` |
| Storage | [`lib/auth/storage.ts`](../../../../lib/auth/storage.ts) — `tokenStorage` / `userStorage` / `savedIdStorage` |
| Redirect | `HOME_ROUTE` = `/banking/account-inquiry` (`lib/routes.ts`) |
| Error surface | `useDialog()` `type:"error"`; `LoginError{code,message,traceId}` |

---

## Related docs

- **Backend counterpart:** [wecms-api/docs/features/auth/login/README.md](../../../../../wecms-api/docs/features/auth/login/README.md)
- **Sibling web modules:** [logout](../logout/README.md) · [change-password](../change-password/README.md) · [profile](../profile/README.md) · [jwt-authentication](../jwt-authentication/README.md) · [authorization](../authorization/README.md) · [menu-authorization](../menu-authorization/README.md) · [session-management](../session-management/README.md)
- **Cross-links:** token storage + Bearer transport → [jwt-authentication](../jwt-authentication/README.md); route guard + `fetchMe()` → [session-management](../session-management/README.md); sign-out → [logout](../logout/README.md)
- **Auth group index (carries the stale "no chooser" line):** [../README.md](../README.md)
- **Stale single-file note:** [../login-auth.md](../login-auth.md)
