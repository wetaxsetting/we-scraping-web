# Settings > Contacts — Frontend Feature (Refactor)

**Status:** ✅ Wired full-stack — panel consumes the live `contacts` API; legacy parity verified; **Contacts Export (GAP-01) CLOSED 2026-06-08**; SIT/UAT verified.
**Menu:** Settings → **Contacts** (Settings modal panel — **no standalone route**)
**Slug:** `contacts` (matches the JEX-traceability + backend counterparts)
**Panel key:** `contacts` · **Menu permission:** `settings-core-contacts`
**Backend:** `/api/v1/settings/contacts` (list · detail · create · update · single + bulk delete · `/export` · `/excel/import|preflight|resolve-recipients` · `/by-codes` · `/banks` · `/lookup-recipient` · `/{trcoKey}/files…`)

> This folder is the **primary frontend documentation home** for Contacts. It consolidates and indexes
> the material previously in the single-file [../contacts.md](../contacts.md) (preserved, cross-linked).
> The matching backend docs are at
> [wecms-api/docs/features/settings/contacts/](../../../../../wecms-api/docs/features/settings/contacts/README.md).

---

## What this screen is

The per-tenant master list of **payees / beneficiaries** (legacy 거래처 / `TRCO_INFM`), rendered as a
panel inside the global Settings modal. A contact is **Local** (Vietnam-domestic payee with NAPAS/CITAD
bank accounts) or **Overseas** (foreign beneficiary with SWIFT/BIC details). The admin can search,
filter by type, add, edit, soft-delete (single + bulk), bulk-import from an Excel template, and
**export** the Local or Overseas list to XLSX. Attachments (e.g. business-registration certificate)
are managed per contact.

It renders as a **panel inside `<SettingsModal>`** (mounted via `<SettingsNav>`, key `"contacts"`) —
there is **no `/settings/contacts` URL**. The panel opens at any dashboard route via the top-nav
Settings menu. View Setting (column visibility popover) is **not** adopted for the on-screen grid —
the grid is a fixed 8-column layout. The Excel export path passes two slug screenIds
(`settings-contacts-local` / `settings-contacts-overseas`), but there is **no backend View Setting
seed** for them (the old V247 seed was archived 2026-06-09) — the backend resolves export columns via
the provider allow-list ∩ the requested columns.

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Open → fetch list → grid → search/filter → add/edit dialog → delete (with confirm) → import → export. States, refresh model, authorization |
| [ui-specification.md](ui-specification.md) | Search/filters, grid columns, create/edit dialog (sections, fields, validation, type-specific behaviour), address/bank handling, attachments, import/export UI, i18n keys |
| [component-index.md](component-index.md) | Component / hook / API-client / type / mapper / schema / template file map |
| [api-consumption.md](api-consumption.md) | Endpoints, request/response wire shapes, mappers, error-code → dialog mapping |
| [test-scenarios.md](test-scenarios.md) | SIT/UAT scenarios (search, create, edit, delete, import, export, validation, errors) |

---

## Quick facts

| Aspect | Value |
|---|---|
| Panel | [`<ContactsPanel>`](../../../../components/settings/contacts/ContactsPanel.tsx) |
| Mount | [`SettingsModal.tsx`](../../../../components/settings/SettingsModal.tsx) (`panel === "contacts"`) + [`SettingsNav.tsx`](../../../../components/settings/SettingsNav.tsx) (key `contacts`) |
| Route | **none** — Settings-modal panel, not a URL |
| Data hook | [`useContacts.ts`](../../../../components/settings/contacts/useContacts.ts) — plain React `useState`/`useEffect` (**no react-query**) |
| API client | [lib/api/contacts.ts](../../../../lib/api/contacts.ts) |
| Grid columns (fixed 8) | Checkbox · Contact Code · Contact Name · Location (Local/Overseas) · Tax ID · Deposit Account · Address · kebab |
| Type filter | `showLocal` / `showOverseas` checkboxes → wire `trco_type` (`L` / `O` / both = no filter); both unchecked = "show none" |
| Create/Edit | [`AddNewContactDialog`](../../../../components/settings/contacts/AddNewContactDialog.tsx) (+ [`EditContactDialog`](../../../../components/settings/contacts/EditContactDialog.tsx) wrapper); type-specific deposit-account vs beneficiary blocks |
| Address | current + optional changed/old address with Valid Till; popover shows both ([`AddressPopover`](../../../../components/settings/contacts/AddressPopover.tsx)) |
| Bank | NAPAS/CITAD typeahead picker (Local) · free-text beneficiary (Overseas); Lookup Recipient for NAPAS-VND |
| Attachments | [`AttachmentsSection`](../../../../components/settings/contacts/AttachmentsSection.tsx) — 10 MB cap, extension allow-list |
| Export (GAP-01) | [`DownloadDropdown`](../../../../components/settings/contacts/DownloadDropdown.tsx) → `exportContacts` → `POST /export` (Local 9 cols / Overseas 11 cols) via shared `lib/excel.ts` |
| Import | [`ExcelUploadDialog`](../../../../components/settings/contacts/ExcelUploadDialog.tsx) (shared shell, `stackLevel=2`); template download → parse → preflight + resolve → import |
| Validation | Zod ([`schema.ts`](../../../../components/settings/contacts/schema.ts)) |
| View Setting | **not adopted** for the on-screen grid (fixed layout). The export path passes slug screenIds `settings-contacts-local` / `settings-contacts-overseas`, but there is no backend View Setting seed for them — export columns come from the provider allow-list ∩ request |
| Wire convention | lowercase snake_case → camelCase mapping at the API boundary ([`mappers.ts`](../../../../components/settings/contacts/mappers.ts)) |

---

## Related docs

- **Backend feature folder:** [wecms-api/docs/features/settings/contacts/](../../../../../wecms-api/docs/features/settings/contacts/README.md)
- **Preserved single-file spec (frontend):** [../contacts.md](../contacts.md)
- **Page mapping:** [references/page-mapping/page-mapping.md](../../../references/page-mapping/page-mapping.md)
- **Workspace-root JEX-analysis + audit bundle:** `docs/features/contacts/` (workspace root; incl. the GAP-01 closure evidence) — cross-linked from the backend folder.
- **Settings feature index:** [../README.md](../README.md)
