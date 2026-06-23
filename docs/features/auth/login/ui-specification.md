# Login — UI Specification (Frontend)

The implemented `/login` UI. Backend reference:
[wecms-api/docs/features/auth/login/functional-specification.md](../../../../../wecms-api/docs/features/auth/login/functional-specification.md).

> Login is an **auth-shell** screen, not a `<SettingsModal>` panel — it predates and sits outside the
> Settings §3a/§3b shell contract. It uses the global typography tokens and shared `useDialog()` error
> surface, but its split-screen frame and compact 15px form are Figma-WB365 auth-specific.

---

## Page composition

```
app/(auth)/layout.tsx
  └─ flex-col (mobile) / md:flex-row (tablet+), md:h-screen md:overflow-hidden
       ├─ <LoginForm>      DOM-first; md:order-2 → visual RIGHT, 50% column
       └─ <MarketingPanel> DOM-second; md:order-1 → visual LEFT,  50% column
```

[`app/(auth)/login/page.tsx`](../../../../app/(auth)/login/page.tsx) renders `<LoginForm />` then
`<MarketingPanel />`. DOM order is form-first so mobile readers see the form at the top; CSS `order`
flips the visual columns at `md+` (marketing left, form right — Figma 199:7493 / 199:7230 / 199:6973).

- **Mobile (< md):** single column, form first, marketing band below; `min-h-screen` so the page scrolls.
- **Tablet+ (≥ md):** 50/50 split capped at `h-screen` + `overflow-hidden` so neither the document nor
  the page scrolls — content is sized down to fit the shortest supported viewport (Tablet 992×800).

---

## Login form

[`<LoginForm>`](../../../../components/auth/LoginForm.tsx) — a `360px`-max-width column centred in the
white form section, `gap-32px`:

| Element | Spec |
|---|---|
| **Logo** | `/images/login/wecms-logo.png`, responsive `40px → 44px → 48px` height (mobile / md / xl) |
| **User ID field** | [`<FormField>`](../../../../components/auth/FormField.tsx) (sr-only label) wrapping [`<IconInput>`](../../../../components/auth/IconInput.tsx) — leading `ico-user.svg`, `autoComplete="username"`, `aria-invalid` from `errors.userId` |
| **Password field** | `<FormField>` wrapping [`<PasswordInput>`](../../../../components/auth/PasswordInput.tsx) — leading `ico-lock.svg`, trailing show/hide eye toggle, `autoComplete="current-password"` |
| **Save ID** | shadcn `<Checkbox>` (`18×18`, id `SAVE_ID`) + `<Label>` `login.save_id`; controlled by `saveId` state |
| **Login button** | shadcn `<Button>` `h-40px` `bg-brand` `shadow-wb-brand-btn`; spinner + `login.logging_in` while `isSubmitting`, `disabled` + `aria-busy` |

The form uses `react-hook-form` + `zodResolver(loginSchema)` with camelCase field names
(`userId`, `password`). It is `noValidate` — the Zod schema is the only validation gate.

### Form field components

- **`<FormField>`** — visually-hidden label (sr-only by default) so screen readers announce the field;
  inline error text is intentionally **not** rendered here (all validation feedback flows through
  `useDialog()`). Invalid affordance is the input's `aria-invalid` red-border styling only.
- **`<IconInput>`** — compact 40px-high text field (Figma WB365 1218:15744), `text-wb-15`, leading
  `18px` icon, optional `endAdornment` slot reserving right padding.
- **`<PasswordInput>`** — wraps `<IconInput>` with a lock icon and a local show/hide eye toggle (lucide
  `Eye`/`EyeOff`); toggles `type` between `password`/`text`, carries `aria-pressed` + translated
  `aria-label` (`login.show_password` / `login.hide_password`).

---

## Company chooser (multi-link fallback) — MATCH

[`<CompanyChooser>`](../../../../components/auth/CompanyChooser.tsx) replaces `<LoginForm>` when the
backend returns `companies_available[]`. It is **credential-less** by design — the parent keeps the
credentials in memory. Classified **MATCH**: the UI exists and consumes the backend chooser response
verbatim (the root docs' "no BIZ_KEY chooser UI" claim is STALE).

| Element | Spec |
|---|---|
| **Header** | `login.chooser_title` (`text-page-title`) + `login.chooser_description` (`text-body`) + `userName · userId` helper line |
| **Company list** | `role="radiogroup"`; one `role="radio"` `<button>` per `CompanyChoice`. First option focused on mount + pre-selected. Selected row: `border-brand bg-brand/5` |
| **Row content** | company name (or `bizKey` fallback) · product label + `bizKey` sub-line · role pill (Admin / User) |
| **Product label** | `t("auth.prdt_type.{f\|m\|h}")` — only when `productType` ∈ `KNOWN_PRODUCT_TYPES` (`F`/`M`/`H`); deferred legacy letters round-trip but render no badge (display gating only, never security) |
| **Buttons** | `login.chooser_back` (outline, `flex-1`) + `login.chooser_continue` (`bg-brand`, `flex-[2]`, spinner while `submitting`, disabled when no selection) |

---

## Error & dialog handling

All login feedback routes through the shared `useDialog()` system dialog — never a bespoke per-page
banner. Per the project-wide variant rule, **API / network / validation failures use `type:"error"`**
(red, single OK) — never `"warning"`:

| Failure | Dialog |
|---|---|
| Zod validation (blank / too long) | `type:"error"`, title `t("dialog.error")`, description `t(messageKey)`, `onClose` → re-focus the field. No network call. |
| Backend business error (`WBE1009/1010/1011/1128`) | `type:"error"`, `errorCode` = backend code, `uuid` = server `traceId` (or `localTraceId()` fallback), description = backend message; `onClose` resets + focuses password |
| Network failure (no response) | `type:"error"`, `WBE_NETWORK`, `uuid` = `localTraceId()` (browser-local — ends `LOCL`, not grepable in server logs) |
| Malformed response shape | `type:"error"`, `WBE_CLIENT_PARSE` |

The server-supplied `trace_id` renders verbatim in the dialog so the user can quote it to support. Titles
always use the shared `dialog.*` keys — never the module name.

---

## Typography tokens

Per the global typography rules + Figma WB365 auth tokens:

- Inputs / Save-ID label / Login button: `text-wb-15` (compact auth form pass).
- Marketing hero: `text-wb-28 font-semibold`; section titles `text-wb-14 font-bold`; check items
  `text-wb-12 font-medium`.
- Chooser: semantic component classes (`text-page-title`, `text-body`, `text-section-title`,
  `text-helper`, `text-button`) mapped to the WeCMS scale.

No raw `text-[Npx]` / `font-[N]` / inline `style={{ fontFamily }}` for type — the small inline pixel
values present (`pl-[36px]`, `h-[40px]`, `tracking-[-0.15px]`, breakpoint sizing) are layout/asset
geometry from the Figma auth frames, not typography overrides.

---

## i18n keys (namespace `login.*` + `auth.prdt_type.*`)

`login.user_id_label` · `login.user_id_placeholder` · `login.password_label` ·
`login.password_placeholder` · `login.save_id` · `login.login_button` · `login.logging_in` ·
`login.show_password` · `login.hide_password` · `login.user_id_required` · `login.user_id_max` ·
`login.password_required` · `login.password_max` · `login.chooser_title` · `login.chooser_description` ·
`login.chooser_continue` · `login.chooser_back` · `login.chooser_role_admin` ·
`login.chooser_role_user` · `auth.prdt_type.f` · `auth.prdt_type.m` · `auth.prdt_type.h`. Plus the
shared `dialog.error` / `dialog.unexpected_error`. All present in `locales/{en,ko,vi}.json`.
