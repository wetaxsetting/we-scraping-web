# Contacts — Screen Flow (Frontend)

How [`<ContactsPanel>`](../../../../components/settings/contacts/ContactsPanel.tsx) behaves from open
to export. The panel is a Settings-modal panel (key `contacts`), not a route.

---

## Entry

Top nav → **Settings** → `<SettingsModal>` opens → `<SettingsNav>` item `contacts` →
`<ContactsPanel>` renders in the panel column. There is no `/settings/contacts` URL; closing the modal
returns to the underlying dashboard route. Menu visibility gated by `settings-core-contacts`.

## Main flow

```
Open Contacts panel
   ↓
useContactsList(params) → GET /api/v1/settings/contacts   (search, trco_type, sort, page, size)
   ↓
Grid renders (fixed 8 columns)  ──────────────┐
   ↓                                          │ row kebab → Edit / Delete
Search keyword / toggle Local·Overseas         │ header checkbox → select all
   ↓ (resetToFirstPage, refetch)               │ row checkbox → select
Filtered list                                  │
   ↓                                           ▼
 ┌─ Add → AddNewContactDialog (create)    Delete Selected → confirm → POST /bulk-delete
 ├─ Edit → EditContactDialog (loadDetail → AddNewContactDialog edit mode)
 ├─ Excel Upload → ExcelUploadDialog (import)
 └─ Download → DownloadDropdown (Local / Overseas export)
   ↓
Validate (Zod + inline) → POST / PUT → success → list refetch (refreshKey bump)
```

## Search / filter

- **Keyword** — `<SearchInput>`; server matches contact code / name / Tax ID. On change → set keyword +
  `resetToFirstPage()`.
- **Type** — two `FilterCheckbox`es `showLocal` / `showOverseas`. Local-only → `trco_type="L"`;
  Overseas-only → `"O"`; both checked → `undefined` (no filter); **both unchecked** → sentinel
  `search: " __none__"` short-circuits to "show no rows".
- **No status filter** — the backend hard-excludes soft-deleted (`trco_stts='C'`) rows (OQ-5).
- Pagination is server-side (1-based locally, sent zero-based; default page size 10). Sorting via
  `useTableSort` (default → ASC → DESC → default) on Contact Code / Name / Location / Tax ID.

## Create / Edit

- **Add** opens `AddNewContactDialog` (create mode) at `stackLevel=2`.
- **Edit** opens `EditContactDialog`, which seeds a fallback from the row, fires `GET /{trcoKey}`
  (`loadDetail`) → `toFormValues`, then renders `AddNewContactDialog` in edit mode. Same chrome; only
  title, seed, and verb (POST vs PUT) differ.
- Local/Overseas radio swaps the type-specific block (deposit-account cards ↔ beneficiary blocks);
  switching on edit confirms and queues the leaving side's keys for deletion.
- Submit → validation chain (Tax-ID format → overseas dup → build values → inline required → Zod) →
  `create`/`update`. After create, staged attachment files upload sequentially.

## Delete

- **Single** — row kebab → Delete → confirm dialog → `remove(trcoKey)` → `DELETE /{trcoKey}`.
- **Bulk** — "Delete Selected" (visible only when `selectedIds.size > 0`) → confirm → `removeMany` →
  `POST /bulk-delete`.
- Backend `WBE1190` (in use) maps to `settings.contacts.delete_error.in_use`.

## Import

`ExcelUploadDialog` (shared shell): variant radio Local/Overseas → download static template → browse
(template-signature gate) → client parse → preflight (`POST /excel/preflight`) + resolve-recipients
(`POST /excel/resolve-recipients`, Local only) paint duplicate / unknown-bank cells → Upload
(`POST /excel/import`, partial success). See [ui-specification.md](ui-specification.md).

## Export (GAP-01)

`DownloadDropdown` → pick **Local Contacts** / **Overseas Contacts** → `exportContacts({ type,
keyword })` → `POST /api/v1/settings/contacts/export` via shared `lib/excel.ts` → XLSX blob saved.
Real live data, respects the active keyword, active-only + tenant-scoped server-side.

## States

- **Loading** — `initialLoading` on first fetch; subsequent fetches keep previous rows rendered.
- **Empty** — no rows (or both type filters off) → empty grid body.
- **Error** — API failures surface via `useDialog({ type: "error" })`; `WBE1190` is mapped to the
  in-use message; 401 handled globally by the Axios interceptor.

## Refresh model

Plain React state (no react-query). `useContactsList` refetches when params change; mutations bump a
refresh key so the list reloads after create / update / delete / import.

## Authorization & visibility

The Settings nav entry is gated by `settings-core-contacts`; every backend call requires the same menu
grant (403 `WBE1003` otherwise) plus a valid JWT (401 `WBE1009`).
