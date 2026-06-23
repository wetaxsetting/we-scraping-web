# Session Management — UI Specification (Frontend)

The implemented session-lifecycle UI surfaces. Session management is mostly invisible plumbing; it
has exactly two visible surfaces (the lock screen + the "no menus" notice) and one server-side
redirect. Backend reference:
[wecms-api/docs/features/auth/session-management/functional-specification.md](../../../../../wecms-api/docs/features/auth/session-management/functional-specification.md).

---

## 1. Session-expired lock screen — `<SessionExpiredDialog>`

[`<SessionExpiredDialog>`](../../../../components/auth/SessionExpiredDialog.tsx) is mounted
**unconditionally** by the dashboard layout (always present, idle until a 401). It owns only the
bus subscription, the re-auth logic, and the cancel-redirect path — the visible chrome is the shared
[`<PasswordConfirmationDialog>`](../../../../components/shared/popups/PasswordConfirmationDialog.tsx)
(Figma 83:12764), the WeCMS lock screen / re-authentication popup.

| Aspect | Spec |
|---|---|
| Trigger | Any HTTP 401 (except `/auth/login`, `/auth/logout`) via the `requestReAuth()` bus → `onReAuthRequest` handler |
| Modal level | `stackLevel={5}` — renders above any open Settings → Registered → … chain (max content `z-[91]`); the `useDialog()` system layer at `z-[100]` still stacks above for error toasts |
| Close affordances | `showClose={false}` — **no X**. Only exits are **Enter** (re-auth submit) or **ESC** (cancel → `/login`). Mirrors Figma 83:12764. |
| Body content | `companyName` (`user.companyName`), `companyId` (`user.taxId`, rendered in brackets — the company tax / business-registration number), `userEmail` (`userName` or `userId`) — all read from `userStorage` |
| Identity privacy | The internal `bizKey` (WeCMS tenant key, e.g. `VN_VNM0004_000001`) is **never** user-facing here; only `tax_id` is shown |
| Password field | single password input; `passwordPlaceholder` / `passwordAriaLabel` = `t("session.password_placeholder")` |
| Submit | `onSave` → `login(userId, password, bizKey)` at the **current** company; `saveDisabled` while submitting |
| Success | `tokenStorage.set` + `userStorage.set` + `resolveReAuth("re_authenticated")` + close → interceptor retries the original request once |
| Error (wrong pw / `WBE1009`) | routed through `useDialog().open({ type: "error", … })` (the global system dialog at `z-[100]`); the lock screen stays open for another attempt; `err.traceId` passed as `uuid` for support escalation |
| Cancel (ESC) | `tokenStorage.clear()` + `userStorage.clear()` + `resolveReAuth("cancelled")` + `window.location.assign("/login")` (hard navigation) |
| Concurrency | concurrent 401s collapse onto one in-flight promise + one open dialog (bus dedupes) |

> The dialog re-auths against the user's **current** `bizKey` — even a multi-company user does not see
> the company chooser here. If the user's company memberships changed mid-session (`login` returns
> `kind: "chooser"`), the dialog defensively cancels → full re-login. **MATCH** with legacy
> `comm_0300_001` lock-screen behavior.

### Dev preview affordance (not a route gate)

Appending `?preview=session-expired` to any authenticated route opens the lock screen in **preview
mode** for UI rehearsal: no real `login()` call, no token clear, no redirect. Typing `wrong` simulates
a failure; anything else simulates success. This is a developer affordance only — it is **unrelated**
to the removed `?preview=1` route-guard bypass (see §3, DEAD LEGACY).

---

## 2. "No menus" notice

When `/me` resolves but the user has **zero** granted routes (`isRouteAllowed` false **and**
`firstAllowedRoute` returns `null`), the dashboard layout renders a centered notice instead of
redirecting — this avoids a redirect loop:

```tsx
<div className="flex min-h-screen items-center justify-center p-10 text-center">
    <p className="text-wb-14 font-medium text-wb-ntrl-8">{t("nav.no_menus")}</p>
</div>
```

- i18n key: `nav.no_menus`.
- Admins (`allMenus`) never reach this state; non-module routes (`/`) are not gated.

---

## 3. Redirect behavior

| Situation | Redirect | Owner |
|---|---|---|
| Missing `wecms_token` cookie on a protected route | server-side `307` → `/login?next=<pathname><search>` (the intended URL is preserved in `?next=`; a bare `/` target is not appended) | `proxy.ts` edge middleware — **single source of truth** |
| `/me` fails (revoked / expired token / network) | `router.replace("/login")` (client) | dashboard layout `fetchMe()` catch |
| Route not allowed but a granted route exists | `router.replace(firstAllowedRoute(me))` (client) | dashboard layout route-allowed `useEffect` |
| Re-auth cancelled (ESC on lock screen) | hard `window.location.assign("/login")` | `<SessionExpiredDialog>` cancel path |

> **DEAD LEGACY:** the old client-side route guard with a `?preview=1` bypass inside
> `app/(dashboard)/layout.tsx` was **removed**. The edge middleware `proxy.ts` is now the single
> source of truth for route protection — it cannot be defeated by disabling JS, and the query-string
> bypass was a security hole. Do not reintroduce `?preview=1`.

---

## i18n keys

| Namespace / key | Used by |
|---|---|
| `session.title` | lock-screen accessible title + fallback company name |
| `session.password_placeholder` | lock-screen password field placeholder / aria-label |
| `session.error_generic` | fallback description on a re-auth error |
| `dialog.error` | error-dialog title (shared key — never the module name) |
| `nav.no_menus` | the "no granted menus" notice |

All present in `locales/{en,ko,vi}.json`. (No `km.json` — Khmer not yet supported on web.)

---

## Notes

- The lock screen is the **only** session-management dialog — system error toasts go through the
  shared `useDialog()` (`type: "error"`, titled with the shared `dialog.error` key per project rules),
  never a bespoke per-module error surface.
- No toolbar, no table, no View Setting, no export — session management has no list UI.
