# Settings > Purpose — Frontend Feature (Refactor)

**Status:** ✅ Wired full-stack — panel consumes the live `purpose-settings` API; legacy parity verified; SIT/UAT verified.
**Menu:** Settings → **Purpose** (Settings modal panel — **no standalone route**)
**Slug:** `purpose-settings` (matches the JEX-traceability + backend counterparts)
**Panel key:** `purpose` · **Menu permission:** `settings-core-purpose`
**Backend:** `/api/v1/settings/purpose-settings` (list · detail · create · update · delete · `/order` · `/excel/preview` · `/excel/import`)

> This folder is the **primary frontend documentation home** for Purpose. It consolidates and indexes
> the material previously in the single-file [../purpose.md](../purpose.md) (preserved, cross-linked).
> The matching backend docs are at
> [wecms-api/docs/features/settings/purpose/](../../../../../wecms-api/docs/features/settings/purpose/README.md).
> The JEX-side spec set lives at [docs/jex/features/purpose/](../../../../../docs/jex/features/purpose/README.md).

---

## What this screen is

The per-tenant master list of **transaction purposes**, rendered as a two-level tree table inside the
Settings modal. The admin can search, add, edit in place, soft-delete, drag-reorder, and bulk-upload
purposes from an Excel template. **Purpose is the approved modal baseline** for the whole `wecms-web`
app (one of the four reference screens in `wecms-web/CLAUDE.md` § UI Implementation Baseline) — so its
modal layout, sidebar, scroll behaviour, and collapse-arrow behaviour are the source of truth other
modals copy.

It renders as a **panel inside `<SettingsModal>`** (mounted via `<SettingsNav>`) — there is no
`/settings/purpose` URL. View Setting (column visibility popover) is **not** adopted (OQ-FE-1 — the
panel is the modal baseline and has no toolbar list-icon).

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Open → fetch tree → grid → expand/collapse → add/edit (inline) → delete (with confirm) → reorder → Excel upload |
| [ui-specification.md](ui-specification.md) | Search/filters, grid columns, create/edit form + parent picker, delete flow, Excel dialog, loading/empty/error states, i18n keys |
| [component-index.md](component-index.md) | Component / hook / API-client / type / i18n file map |
| [api-consumption.md](api-consumption.md) | Endpoints, request/response wire shapes, mappers, error-code → dialog mapping |
| [test-scenarios.md](test-scenarios.md) | SIT/UAT scenarios (search, create, edit, delete, reorder, import, authz, errors) |

---

## Quick facts

| Aspect | Value |
|---|---|
| Panel | [`<PurposePanel>`](../../../../components/settings/purpose/PurposePanel.tsx) |
| Mount | [`SettingsModal.tsx`](../../../../components/settings/SettingsModal.tsx) (`panel === "purpose"`) + [`SettingsNav.tsx`](../../../../components/settings/SettingsNav.tsx) |
| Data hook | `useApiData(fetchPurposeSettings, [refreshKey])` (project's lightweight hook — **no** React Query) |
| API client | [lib/api/purposeSettings.ts](../../../../lib/api/purposeSettings.ts) |
| Grid columns | Purpose Code · Purpose Name · Description · (status toggle + edit/delete actions) |
| Hierarchy | two levels; parent picker shows **level-1 only** (OQ-FE-Frontend-1) |
| Delete | leaf = immediate; parent = "removes all sub-purposes" confirm; server `WBE1199` → error dialog |
| Excel | shared [`<ExcelUploadDialog>`](../../../../components/shared/excel-upload/ExcelUploadDialog.tsx); template download = static asset; preview + import call live endpoints |
| View Setting | **not adopted** (OQ-FE-1) |
| Wire convention | lowercase snake_case → camelCase mapping at the API boundary |

---

## Related docs

- **Backend feature folder:** [wecms-api/docs/features/settings/purpose/](../../../../../wecms-api/docs/features/settings/purpose/README.md)
- **Preserved single-file spec (frontend):** [../purpose.md](../purpose.md)
- **JEX legacy spec set (read-only):** [docs/jex/features/purpose/](../../../../../docs/jex/features/purpose/README.md)
- **Page mapping:** [references/page-mapping/page-mapping.md](../../../references/page-mapping/page-mapping.md)
- **Settings feature index:** [../README.md](../README.md)
