# Authorization — UI Specification (Frontend)

Authorization is a **pure-logic framework**, not a screen. It has almost no UI surface of its own —
its visible effects are (1) a "no menus" notice, (2) a silent redirect off an ungranted route, and
(3) hidden routes simply not rendering. This doc documents that minimal surface honestly; the column
visibility / table chrome rules in the Settings template do not apply here. Backend reference:
[wecms-api/docs/features/auth/authorization/functional-specification.md](../../../../../wecms-api/docs/features/auth/authorization/functional-specification.md).

---

## UI surface (minimal — this is logic)

| Surface | Where | What renders |
|---|---|---|
| **"No menus" notice** | [`app/(dashboard)/layout.tsx`](<../../../../app/(dashboard)/layout.tsx>) | A centered single-line message when the user has **no granted route** (`firstAllowedRoute` returns `null` and the current route is not allowed) |
| **Silent redirect** | layout guard `useEffect` | `router.replace(landing)` to `firstAllowedRoute` when the current route is ungranted but the user has at least one granted route — **no visible chrome**, the page is never painted |
| **Hidden routes** | nav tree (sibling menu-authorization) + the guard | An ungranted route's page component **does not mount** — there is no "access denied" page, the user is bounced before any content renders |

There is **no** authorization settings page, no permission editor in this scope (the per-user
entitlement editor lives under Settings → Users — sibling **menu-authorization**), no badge, no banner.

---

## "No menus" notice

Rendered by the dashboard layout when `ready && !allowed && !landing`:

```tsx
<div className="flex min-h-screen items-center justify-center p-10 text-center">
    <p className="text-wb-14 font-medium text-wb-ntrl-8">{t("nav.no_menus")}</p>
</div>
```

- Full-viewport centered, single line, muted (`text-wb-ntrl-8`), `text-wb-14 font-medium` — per the
  shared typography tokens (no inline px / hex).
- Copy is `t("nav.no_menus")` — present in `locales/{en,ko,vi}.json`.
- Shown **instead of** a redirect, deliberately, to avoid a redirect loop for a session with zero
  granted routes. The `<AppShell>` (sidebar / header) does **not** mount in this state.

---

## Redirect behaviour (no UI)

```tsx
const allowed = !me || isRouteAllowed(pathname, me);
const landing = me ? firstAllowedRoute(me) : null;

useEffect(() => {
    if (!ready || !me || allowed) return;
    if (landing) router.replace(landing);
}, [ready, me, allowed, landing, pathname, router]);
```

- When the current route is ungranted but a granted landing route exists, the guard calls
  `router.replace(landing)` — the user lands on their first allowed page. Nothing is painted for the
  blocked route in the interim (the render branch returns `null` until `allowed` is true).
- For an **admin** (`allMenus`), `firstAllowedRoute` returns `null` and `isRouteAllowed` is always
  `true`, so the admin never redirects — the requested page renders directly.

---

## Hidden routes are not rendered

- The dashboard layout's render is gated: `ready && allowed ? <AppShell>{children}</AppShell> : …`.
  A disallowed route falls through to either the redirect branch or the "no menus" notice — the
  `children` (page component) is **never** rendered, so a hidden route fetches no data and flashes no
  chrome.
- In the nav itself, an ungranted top-nav module or sidebar item is simply absent (driven by
  `isSectionAllowed` / `isMenuAllowed` via the resolved tree — sibling **menu-authorization**). There is
  no greyed-out / disabled affordance for ungranted menus in this framework.

---

## Product-type UX (variant selection, not chrome)

Product-type gating changes **which variant** of an already-allowed page renders — it has no standalone
UI element. Pages call `isProductType(user, "H")` and branch their own JSX. Canonical example:
Login Credentials → Select Bank Accounts hides the VAS columns for product type `H`. This framework
provides the predicate; the consuming page owns the conditional markup. See
[screen-flow.md § Product-type UX gating](screen-flow.md#product-type-ux-gating).

---

## States

| State | Condition | UI |
|---|---|---|
| **Resolving** | `!ready` (fetchMe in flight) | nothing rendered (no shell, no notice) |
| **Allowed** | `ready && allowed` | `<AppShell>{page}</AppShell>` |
| **Blocked, has landing** | `ready && !allowed && landing` | nothing painted; `router.replace(landing)` fires |
| **Blocked, no landing** | `ready && !allowed && !landing` | `nav.no_menus` centered notice |

---

## i18n keys

`nav.no_menus` (the only string this framework owns). All product-type / menu labels are owned by the
sibling **menu-authorization** (`nav.*`, `auth.prdt_type.{f,m,h}`). Present in
`locales/{en,ko,vi}.json`; no `km.json` yet (KM falls back to EN).

---

## Not applicable

- **No View Setting / column popover** — not a list page.
- **No data table / pagination / filter row** — no records to list.
- **No `useDialog()` surface** — authorization redirects silently; it does not open a system dialog.
  (401 / session-expired re-auth dialog is the sibling **session-management** concern.)
