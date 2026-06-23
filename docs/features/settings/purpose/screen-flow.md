# Purpose — Screen Flow (Frontend)

Interaction flow for the Purpose panel. JEX behaviour reference (read-only):
[docs/jex/features/purpose/business-flow.md](../../../../../docs/jex/features/purpose/business-flow.md).
Backend flow: [wecms-api/docs/features/settings/purpose/business-flow.md](../../../../../wecms-api/docs/features/settings/purpose/business-flow.md).

```
Top nav → Settings → <SettingsModal> opens → SettingsNav → "Purpose" (visible only when the
session has the settings-core-purpose grant or is admin)
      │
      ▼
<PurposePanel> mounts
      │  useApiData(() => fetchPurposeSettings(), [refreshKey])
      ▼
GET /api/v1/settings/purpose-settings
      │  map ApiPurposeSettingRow[] → PurposeNode[]  (snake_case → camelCase; nest children)
      ▼
Tree table renders (level-1 rows; expandable to level-2 children), ordered by disp_ord
```

---

## States

| State | Trigger | UI |
|---|---|---|
| **List (idle)** | panel mount, GET resolves | two-level tree; chevron toggles per parent; per-row edit / delete / status-toggle; "+ Add Purpose" + "Excel Upload" chips |
| **Loading** | GET in flight | `settings.purpose.list.loading` notice + chrome |
| **Empty** | GET resolves with no rows | `settings.purpose.list.empty` ("Purpose Not Found") |
| **Error / offline** | GET fails | error dialog via `useDialog()`; falls back to `mockPurposeTree` so the panel still paints |
| **Add (inline)** | click "+ Add Purpose" | `<PurposeFormRow mode=add>` mounts sticky at the bottom; Save → POST → success dialog + refetch; Cancel → discard |
| **Edit (inline)** | click row pencil | `<PurposeFormRow mode=edit>` seeded from the row; Save → PUT → refetch; Cancel → discard |
| **Delete (leaf)** | click trash on a child/leaf | immediate `performDelete()` → DELETE → refetch |
| **Delete (parent)** | click trash on a parent | confirmation dialog ("removes all sub-purposes") → DELETE → refetch |
| **Delete blocked** | server returns `WBE1199` | error dialog ("this purpose or one of its sub-purposes is in use") |
| **Reorder** | (not wired in the panel) | the `reorderPurposeSettings` client fn + `PUT /order` endpoint exist in [lib/api/purposeSettings.ts](../../../../lib/api/purposeSettings.ts) but `<PurposePanel>` does not import them and no drag-reorder UI is implemented yet |
| **Status toggle** | click row toggle | optimistic `disp_yn` flip; persisted via the row update |
| **Excel — template** | open Excel dialog | "Download Template" → static `/templates/purpose/WeCMS_Purpose_Bulk_Upload_{EN|KO|VI}.xlsx` |
| **Excel — preview** | choose a file | multipart POST `/excel/preview`; per-cell error highlights + completed/error counts |
| **Excel — import** | click Upload | POST `/excel/import` (preview rows); success → refetch; row errors keep the dialog open |

---

## Refresh model

Mutations bump a `refreshKey` that `useApiData` watches, re-running the list fetch. There is no
optimistic source-row mutation before the server confirms (except the transient toggle/drag visual
feedback, which reverts on error). The whole tree is re-fetched and re-assembled after every successful
Create / Update / Delete / Reorder / Import.

---

## Authorization & visibility

The Purpose entry appears in `<SettingsNav>` only when the session is admin (`allMenus`) or the
granted `allowedMenuCds` includes `settings-core-purpose` (`isSettingsPanelVisible`). The backend
independently enforces `@menuAuthz.canAccess('settings-core-purpose')` on every endpoint — the
frontend gate is UX, the backend gate is the security boundary.
