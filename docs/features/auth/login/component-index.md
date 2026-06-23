# Login — Component Index (Frontend)

Component / schema / API-client / type / storage file map. Backend mirror:
[wecms-api/docs/features/auth/login/source-code-index.md](../../../../../wecms-api/docs/features/auth/login/source-code-index.md).

---

## Route + page (`app/(auth)/login/`)

| File | Role |
|---|---|
| [page.tsx](../../../../app/(auth)/login/page.tsx) | Thin page — composes `<LoginForm>` + `<MarketingPanel>`; sets `metadata.title`. DOM-first form for mobile reading order |
| [loginSchema.ts](../../../../app/(auth)/login/loginSchema.ts) | Zod `loginSchema` + `LoginFormValues` type. camelCase fields `userId` (trim, 1–50) / `password` (1–100). **Messages are i18n keys** (`login.user_id_required`, …), resolved with `t(...)` by the caller |
| [../layout.tsx](../../../../app/(auth)/layout.tsx) | `AuthLayout` — split-screen flex shell (form / marketing 50-50 at `md+`, capped at `h-screen`) |

## Auth components (`components/auth/`)

| File | Role |
|---|---|
| [LoginForm.tsx](../../../../components/auth/LoginForm.tsx) | **Main container.** Two-step state machine: step-1 credentials submit → `login()`; on `chooser` result swaps to `<CompanyChooser>` (credentials held in `PendingChooser` state); step-2 `finalizeChooser()` re-posts with `biz_key`. Owns Save-ID rehydration, `completeLogin()` (persist + redirect), `reportError()` (`useDialog`), `localTraceId()` fallback |
| [CompanyChooser.tsx](../../../../components/auth/CompanyChooser.tsx) | **Multi-link fallback (MATCH).** Credential-less radio list of `CompanyChoice[]`; first option focused + pre-selected; `onSelect(bizKey)` finalizes, `onCancel()` returns to step 1. Renders product label via `KNOWN_PRODUCT_TYPES` + role pill |
| [FormField.tsx](../../../../components/auth/FormField.tsx) | Label (sr-only by default) + control wrapper. No inline error text — validation flows through `useDialog()`; invalid affordance is the input's `aria-invalid` styling |
| [IconInput.tsx](../../../../components/auth/IconInput.tsx) | Compact 40px icon-input (leading SVG + optional `endAdornment`). `forwardRef`, wraps shadcn `<Input>` |
| [PasswordInput.tsx](../../../../components/auth/PasswordInput.tsx) | `<IconInput>` + local show/hide eye toggle (lucide `Eye`/`EyeOff`); flips `type`, carries `aria-pressed` + translated `aria-label` |
| [MarketingPanel.tsx](../../../../components/auth/MarketingPanel.tsx) | Left/bottom illustration column — hero title, 8-icon cross composition, 4-section feature band. Pure presentational, no auth logic |

## API client (`lib/auth/`)

| File | Role |
|---|---|
| [client.ts](../../../../lib/auth/client.ts) | `login(userId, userPw, bizKey?)` → `POST /api/v1/auth/login`. Returns the `LoginResult` discriminated union (`authenticated` \| `chooser`). `toStoredUser()` maps snake→camel; `toCompanyChoice()` maps each option; `toLoginError()` funnels every failure to a typed `LoginError{code,message,traceId}`. Also exports `fetchMe` / `logout` / `changePassword` / `isAdmin` / `isProductType` (documented in their own modules) |
| [storage.ts](../../../../lib/auth/storage.ts) | `tokenStorage` (`wecms_token`: localStorage + cookie) · `userStorage` (`wecms_user` `StoredUser` JSON) · `savedIdStorage` (`wecms_saved_user_id`). `StoredUser` type + `KNOWN_PRODUCT_TYPES` (`F`/`M`/`H`). **Token storage detail = [jwt-authentication](../jwt-authentication/README.md)** |

## Wire types (`lib/types/api.ts`)

| Type | Role |
|---|---|
| [`LoginRequestRec`](../../../../lib/types/api.ts) | `{ user_id, user_pw, biz_key? }` |
| [`LoginResponseRec`](../../../../lib/types/api.ts) | Dual-shape — authenticated (`access_token` + tenant fields) **or** chooser (`companies_available[]`, no token) |
| [`CompanyOptionRec`](../../../../lib/types/api.ts) | One chooser option: `{ biz_key, cmpn_nm, auth_gr_cd, prdt_type? }` |
| [`ApiResponse<T>`](../../../../lib/types/api.ts) | Standard envelope `{ status:{error,code,message}, data?, trace_id? }` |

## Shared infra (consumed, not owned by login)

- [`useDialog()`](../../../../components/shared/dialog/) — system error dialog.
- [`useTranslation()`](../../../../lib/i18n/LocaleProvider.tsx) — `t(...)` + locale.
- [`api`](../../../../lib/axios.ts) — Axios instance + Bearer interceptor (transport detail =
  [jwt-authentication](../jwt-authentication/README.md)).
- [`HOME_ROUTE`](../../../../lib/routes.ts) — post-login redirect target.

## i18n

`locales/{en,ko,vi}.json` — namespace `login.*` + `auth.prdt_type.*` (full key list in
[ui-specification.md § i18n keys](ui-specification.md#i18n-keys-namespace-login--authprdt_type)).

## Not used

- **No tests** — no `*.test.tsx` / `*.spec.tsx` for the login module (MISSING — see
  [test-scenarios.md](test-scenarios.md)).
- **No signup / forgot-password / provisioning UI** — DBA-only (memory `feedback_wecms_login_ui_shape`).
- **No View Setting / export** — login is not a list page.
