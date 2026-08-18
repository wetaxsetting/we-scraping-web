# routes/

App Router structure for `wecms-web`. Verified against source 2026-08-17.

**Normative rules live in [`../../../CLAUDE.md`](../../../CLAUDE.md)** — §"Architecture Rules →
Directory Layout", §"Rules for New Menu Pages → Routing", and §12 (Payment detail routes). This page
is the inventory and the entry point; it does not restate those rules.

## Shape

```
app/
├── layout.tsx                     ← <LocaleProvider><DialogProvider>
├── page.tsx                       ← redirect('/login')
├── (auth)/login/                  ← split-screen login
├── (dashboard)/                   ← auth-gated; <AppShell> chrome
│   ├── banking/     · payment/     · addon/
├── api/v1/payment/overseas-payment/excel-preview/route.ts
└── memo-preview/
```

Route groups `(auth)` and `(dashboard)` are Next.js parenthesis grouping — they do **not** appear in
the URL. `app/(dashboard)/…` is a valid Markdown link target: the parentheses are balanced, so no
escaping is needed.

## Inventory

| Kind | Count | Notes |
|---|---|---|
| Dashboard pages under `app/(dashboard)/` | **42** | banking · payment · addon |
| Dynamic segments | **12** | 10 Payment `[id]` detail routes + 2 Transaction History `[accountId]` |
| Route handlers | **1** | overseas-payment Excel preview — **not on the runtime path**, see [../../README.md § Architecture facts](../../README.md#architecture-facts) |
| Server actions | **0** | `"use server"` appears nowhere |
| Settings routes | **0** | Settings is a modal (`<SettingsModal>`), not a route |

Dynamic segments: `payment/{internal-transfer,vendor-payment,expense-payment,payroll,overseas-payment}/{scheduled-*,*-result}/[id]`
and `banking/transaction-history{,-fcy}/[accountId]`.

## Auth gate — edge `proxy.ts`, not a client guard

[`proxy.ts`](../../../proxy.ts) at the repo root is the single sanctioned authentication gate. Two
things about it matter and are easy to get wrong:

- **Next.js 16 renamed the `middleware` convention to `proxy`.** The file is `proxy.ts`, not
  `middleware.ts`.
- **The old client-side guard in `app/(dashboard)/layout.tsx` and its `?preview=1` bypass were
  deliberately removed** — a client guard can be defeated by disabling JS, and the query-string
  bypass was a real security hole. Do not reintroduce either.

The gate reads the presence of the non-HttpOnly `wecms_token` cookie mirrored by the login flow; it
never inspects the token's contents.

## Conventions in one line each

- Path is `/{feature}/{screen}`, lowercase kebab-case; the page file is thin and composes one feature
  component.
- **Never derive a route from a legacy JEX WSVC id** (`comm_0220_001`, …). Routes carry slugs.
- A new route lands with its Sidebar/Header entry and its `lib/menuAuth.ts` mapping in the same MR.
- Detail views are routes, not modals — except where a Figma frame explicitly shows a dialog. Tax
  Filing's declaration form is a documented exception: it is a full-screen overlay with no route of
  its own.

## Related

- Route ↔ permission map: [`lib/menuAuth.ts`](../../../lib/menuAuth.ts)
- Sidebar/menu config: [`components/layout/sidebarNav.ts`](../../../components/layout/sidebarNav.ts)
- Route constants: [`lib/routes.ts`](../../../lib/routes.ts)
- JEX `_view.jsp` → Next.js route map: [../../references/page-mapping/page-mapping.md](../../references/page-mapping/page-mapping.md)
- Per-screen design: [../../features/](../../features/)
