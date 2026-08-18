# hooks/

Custom React hook design for `wecms-web`.

> **Corrected 2026-08-17.** An earlier version of this page described hooks as "layered on top of the
> API client and **TanStack Query**" and prescribed cache-key conventions, invalidation flow, and
> optimistic-update rules. **That was never true of this codebase.** TanStack Query / react-query is
> on the explicit do-not-introduce list in [`../../../README.md`](../../../README.md) and
> [`../../../CLAUDE.md`](../../../CLAUDE.md), and it appears in neither `package.json` nor any import
> in the tree. There is **no server-cache library, no cache keys, and no invalidation layer**.

## What actually exists

Data fetching is a thin, hand-rolled `useState` + `useEffect` pattern. There is one shared fetch hook
and a set of feature-agnostic utility hooks.

| Hook | Location | Role |
|---|---|---|
| `useApiData(loader, deps)` | [`lib/api/useApiData.ts`](../../../lib/api/useApiData.ts) | The canonical fetch hook. Fires `loader()` on mount, refires when `deps` change, returns `{ data, error, loading, setData }`. **No cache, no dedupe, no invalidation** — refetch is driven by changing `deps` (commonly a `refreshKey` counter the caller bumps after a mutation). |
| `usePagination` + `PAGE_SIZE_OPTIONS` | [`components/shared/Pagination.tsx`](../../../components/shared/Pagination.tsx) | Page / page-size state, page-1 reset, clamping, `{shown} of {total}` count. Co-located with the `<Pagination>` component it drives. |
| `useTableSort` | [`hooks/useTableSort.ts`](../../../hooks/useTableSort.ts) | `default → ASC → DESC → default` cycle; emits `sortParams` for the API call (sorting is DB-side). |
| `useExcelExport` | [`hooks/useExcelExport.ts`](../../../hooks/useExcelExport.ts) | Resolves View Setting columns → posts the export request → saves the XLSX blob. |
| `useServerPagination` | [`hooks/useServerPagination.ts`](../../../hooks/useServerPagination.ts) | Server-paged list state. |
| `useNavigation` | [`hooks/useNavigation.ts`](../../../hooks/useNavigation.ts) | Backend-driven menu tree (`GET /api/v1/navigation`). |
| `useTopMenuItems` | [`hooks/useTopMenuItems.ts`](../../../hooks/useTopMenuItems.ts) | Top-nav entries derived from the navigation tree. |
| `useStickyLoading` | [`hooks/useStickyLoading.ts`](../../../hooks/useStickyLoading.ts) | Minimum-visibility window so fast responses don't flicker a spinner. |
| `useBlockedChars` | [`hooks/useBlockedChars.ts`](../../../hooks/useBlockedChars.ts) | Per-bank blocked-character rules for payment inputs. |
| `useEnvironmentSettings` | [`hooks/useEnvironmentSettings.ts`](../../../hooks/useEnvironmentSettings.ts) | Generic environment/automation toggles. |
| `useEInvoiceDetail` | [`hooks/useEInvoiceDetail.ts`](../../../hooks/useEInvoiceDetail.ts) | e-Invoice detail fetch. |
| `useHaengsungRefresh` | [`hooks/useHaengsungRefresh.ts`](../../../hooks/useHaengsungRefresh.ts) | HAENGSUNG (`H`) payment-refresh action. |
| `useViewSetting`, `useViewSettingColumns` | [`components/shared/view-setting/`](../../../components/shared/view-setting/) | Global column visibility / order / size. |

Feature-scoped hooks stay in their feature folder (e.g. `useApprovalBoxList`, `useContacts`,
`useChartOfAccounts`, `useVasAccount`, `useApprovalLine`, `useTaxFilingActions`). Per the two-call
rule in [`../../../CLAUDE.md`](../../../CLAUDE.md), a hook lifts to top-level `hooks/` when a second
feature needs it.

## Conventions

- **New cross-feature hooks land in top-level [`hooks/`](../../../hooks/)** from day one.
  `usePagination` (inside `Pagination.tsx`) and `useApiData` (inside `lib/api/`) predate that rule
  and deliberately stay where they are.
- **File naming is camelCase `useX.ts`** matching the exported hook — that is what the directory
  actually contains. *(An earlier version of this page prescribed kebab-case `use-<name>.md`; no
  file in `hooks/` follows it.)*
- **Refetch is `deps`-driven, not cache-driven.** After a mutation, bump a `refreshKey` included in
  the `useApiData` deps. Do not reach for cache invalidation — there is no cache.

## What does NOT go here

- Per-hook deep documentation while this page is an index — see the owning feature doc under
  [`../../features/`](../../features/).
- Server-cache strategy — there is none, by design.
