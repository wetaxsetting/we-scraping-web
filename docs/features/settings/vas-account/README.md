# Settings > VAS Account — Refactor Frontend Feature Hub

**Module:** Settings → VAS Account
**Route:** **None** — VAS Account renders as a panel inside the shared `<SettingsModal>` shell (Settings popup → "VAS Account" submenu). There is no standalone Next.js route.
**Screen ID (View Setting `screenId`):** `vas-account` (`SCREEN_IDS.SETTINGS_VAS_ACCOUNT`) — reserved for a future popover; the panel does not currently render the View Setting popover.
**Feature-folder slug (matches JEX + backend):** `vas-account`
**JEX counterpart:** `comm_0217_001` family + `comm_1002_001` (picker) — [docs/jex/features/vas-account/](../../../../../docs/jex/features/vas-account/README.md)
**Backend counterpart:** [wecms-api/docs/features/settings/vas-account/](../../../../../wecms-api/docs/features/settings/vas-account/README.md)

> **Status — Refactor complete (full-stack).** The panel is wired to the live backend (no mock
> fallback): list with Active/Inactive status filter + keyword search, Add / Edit dialog, single-row
> soft-delete (confirmation dialog), and the Excel template-download → preview → import flow
> (Append / Reset-and-replace) all round-trip to `/api/v1/settings/vas-account`. The bank-account Edit
> dialog's VAS picker consumes the `/lookup` endpoint. SIT/UAT completed.
>
> **What the panel deliberately does NOT have** (matching the backend + legacy): no parent/hierarchy
> editing (the grid renders a **display-only two-level prefix grouping** via `buildTree`; the parent
> chevron is present but inert — expand/collapse is not wired and all rows always render); no
> display-order column; no row-selection checkbox; no bulk activate/deactivate/delete; no Excel
> **export** button (export is backend-only today — OQ-VAS-1); no View Setting popover (the toolbar
> list-icon is not rendered).
>
> This folder is the **primary frontend documentation home**. The older single-file spec at
> [vas-account.md](../vas-account.md) predates this folder and describes the *planned* surface — it
> still shows a routed `VasAccountPage`, a `useVasAccountExcel.validateCell` hook, in-memory
> `ACTIVE`/`INACTIVE` enums, and the legacy `tot_cnt`/`suc_cnt`/`rec` Excel-preview shape, none of
> which match the as-built code. It is preserved and cross-linked but superseded by this folder.

---

## Document map (this folder)

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Entry (Settings nav), initial load, search/filter, add/edit, delete-confirm, Excel template/preview/import, picker consumption — interaction flows. |
| [ui-specification.md](ui-specification.md) | Panel layout, filter row, grid columns + prefix-tree rendering, status badge, dialog forms, Excel upload modal, states, typography tokens. |
| [component-index.md](component-index.md) | Panel host, components, dialogs, hooks, mappers, API client, types — file-by-file. |
| [api-consumption.md](api-consumption.md) | Endpoints consumed, request params, wire → in-memory mapping, mutations, error handling. |
| [test-scenarios.md](test-scenarios.md) | Frontend SIT/UAT scenarios. |

## Companion references (preserved — cross-linked)

| Doc | Location |
|---|---|
| Original frontend design (stale — planned surface) | [vas-account.md](../vas-account.md) |
| Settings frontend index | [features/settings/README.md](../README.md) |
| Page mapping (JEX `_view.jsp` → host) | [references/page-mapping/page-mapping.md](../../../references/page-mapping/page-mapping.md) |
| Backend feature hub | [wecms-api/docs/features/settings/vas-account/README.md](../../../../../wecms-api/docs/features/settings/vas-account/README.md) |
| Backend interface spec (endpoints) | [wecms-api/docs/features/settings/vas-account/interface-specification.md](../../../../../wecms-api/docs/features/settings/vas-account/interface-specification.md) |
| JEX functional spec (source of truth) | [docs/jex/features/vas-account/](../../../../../docs/jex/features/vas-account/README.md) |

---

## Quick facts

- **Host:** `components/settings/vas-account/VasAccountPanel.tsx`, mounted by `SettingsModal.tsx`
  (`panel === "vas_account"`), reached via the `SettingsNav.tsx` entry (key `vas_account`, menu code
  `settings-core-vas-account`). No `app/.../page.tsx`.
- **Data:** `useVasAccountList({ searchWd, statuses, all: true })` + `useVasAccountMutations()` from
  `components/settings/vas-account/useVasAccount.ts` (manual `useState`/`useEffect` — no react-query/SWR).
- **API client:** `lib/api/vasAccount.ts` (base `/api/v1/settings/vas-account`).
- **Wire ↔ in-memory:** `components/settings/vas-account/mappers.ts` (snake_case → camelCase +
  `buildTree` prefix grouping); wire types in `lib/types/api.ts` (`ApiVasAccount*`).
- **Dialogs:** `AddVasAccountDialog` (Add + Edit, `mode` prop, `stackLevel={2}`); `ExcelUploadDialog`
  (wraps shared `components/shared/excel-upload/ExcelUploadDialog.tsx`); delete via shared
  `useDialog({ type: "confirmation" })`; row menu `VasAccountRowMenu`.
- **Picker consumer:** `components/settings/bank-account/VasAccountPicker.tsx` calls `/lookup`.
- **Pagination:** none — `all: true` loads the full filtered set (small per-tenant counts).
- **Typography:** `text-wb-*` tokens only; Excel-action chip uses the sanctioned brand-green
  `bg-[#1f7a4d]` (documented exception in wecms-web CLAUDE.md §3b/F).

## Migration status

**Refactor Status: 100% Complete (full-stack).** Every legacy `comm_0217_*` + `comm_1002_001`
user-facing capability is implemented and wired to live endpoints. See the backend
[wecms-api/…/refactor-gap-analysis.md](../../../../../wecms-api/docs/features/settings/vas-account/refactor-gap-analysis.md)
for the line-by-line parity table and the two open questions (frontend export button OQ-VAS-1; sequence
retry OQ-VAS-2).
