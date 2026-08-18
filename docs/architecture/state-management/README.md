# state-management/

State-management design for `wecms-web`.

> **Corrected 2026-08-17.** An earlier version of this page described a "layered state model:
> server cache (**TanStack Query**), URL state, session/auth state, and client-only stores
> (**Zustand**)", and prescribed cache-key hierarchies and invalidation rules. **None of that exists
> here.** Both libraries are on the explicit do-not-introduce list in
> [`../../../README.md`](../../../README.md) and [`../../../CLAUDE.md`](../../../CLAUDE.md), and
> neither appears in `package.json` or in any import in the tree — along with Redux and SWR.

## What actually exists

There is **no global store and no server-cache library**. State lives in four places:

| Layer | Mechanism | Where |
|---|---|---|
| **Server data** | `useApiData(loader, deps)` — fetch on mount, refetch when `deps` change. No cache, no dedupe, no invalidation; a `refreshKey` counter in `deps` is how a mutation triggers a reload. | [`lib/api/useApiData.ts`](../../../lib/api/useApiData.ts) |
| **App-wide UI concerns** | Two React Context providers, mounted once at the root: `<LocaleProvider>` (locale + `t(…)`) wrapping `<DialogProvider>` (the single system dialog surface, via `useDialog()`). `<SettingsModalProvider>` is mounted lower, in `<AppShell>`, and owns Settings-modal open/close for every dashboard route. | [`app/layout.tsx`](../../../app/layout.tsx) · [`lib/i18n/LocaleProvider.tsx`](../../../lib/i18n/LocaleProvider.tsx) · [`components/shared/dialog/DialogProvider.tsx`](../../../components/shared/dialog/DialogProvider.tsx) · [`components/settings/SettingsModalProvider.tsx`](../../../components/settings/SettingsModalProvider.tsx) |
| **Persisted client state** | `localStorage` behind typed helpers — exactly four keys: `wecms_token`, `wecms_user` (cleared on logout) and `wecms_locale`, `wecms_saved_user_id` (**preserved** across logout). Never call `localStorage.clear()`. | [`lib/auth/storage.ts`](../../../lib/auth/storage.ts) |
| **Everything else** | Component-local `useState` in the page's client wrapper (filters, selection, page/size, dialog-open flags), passed down as props. Shared shapes are extracted into hooks — see [`../hooks/`](../hooks/). | per feature |

## URL state

There is **no project-wide URL-state convention**. `useSearchParams` is used in exactly two places —
[`OwnAccountTransferPage`](../../../components/banking/own-account-transfer/OwnAccountTransferPage.tsx)
and [`SmartOrganizerPage`](../../../components/banking/smart-organizer/SmartOrganizerPage.tsx) — for
deep-link entry parameters (e.g. `?sourceAccountNo=…`). Filters, sort, and pagination are **not**
reflected in the URL anywhere. Do not document a search-param naming scheme that the code does not
implement.

## Auth / session state

Login writes the token + user to `localStorage`; [`app/(dashboard)/layout.tsx`](../../../app/(dashboard)/layout.tsx)
is a client guard that reads the token on mount and calls `fetchMe()` to rehydrate. A 401 on any
in-page call is handled centrally by the [`lib/axios.ts`](../../../lib/axios.ts) response
interceptor via the `requestReAuth` bus in [`lib/auth/sessionExpired.ts`](../../../lib/auth/sessionExpired.ts) —
never per call site. Full rules: [`../../../CLAUDE.md`](../../../CLAUDE.md) § Auth Rules.

## Rules

- **Do not introduce a state library.** Redux, Zustand, react-query/SWR, and MobX are prohibited;
  adding one requires a written decision, not a PR note.
- **Lift state to a Context provider only for genuinely app-wide concerns** (locale, system dialog,
  Settings modal). Everything else stays local to the feature's client wrapper.
- **A new `localStorage` key must be registered** in the owned-keys table in
  [`../../../CLAUDE.md`](../../../CLAUDE.md) § Auth Rules before use.

## What does NOT go here

- Hook-level detail → [`../hooks/`](../hooks/)
- Component-internal `useState` patterns → [`../components/`](../components/)
