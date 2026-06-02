# Purpose

> Canonical Settings-menu entry for **Settings → Purpose** (frontend). Detailed wiring lives in the
> linked design doc below.

## Overview
The Purpose panel lets a tenant administrator manage transaction purpose codes (Deposit, Sale, …):
view, add, inline-edit, enable/disable, delete, and bulk-import via Excel. Hierarchical rows
(parent `P01` → child `P1.1`) are expandable. Slug: `purpose-settings`.

- Frontend design (wiring contract): [../screen-flows/settings/purpose-settings.md](../features/settings/purpose.md)
- API side: [../../../wecms-api/docs/settings/purpose.md](../../../wecms-api/docs/features/settings/purpose.md)

## Page Location
Settings modal panel — mounted inside `<SettingsModal>` via `<SettingsNav>` ("Purpose", first item).
**No standalone Next.js route.** Component folder `components/settings/purpose/`. Figma 9438:19204
(read state) + 9448:19960 (inline add/edit) — the approved Settings-modal baseline.

## UI Components
- `<PurposePanel>` — panel shell (title "Purpose", subtitle, Excel Upload button)
- `<PurposeTable>` / `<PurposeTableColumns>` — table + column defs
- `<PurposeRow>` (display) / `<PurposeFormRow>` (inline add/edit)
- `<RowActions>` — per-row edit / delete / enable toggle
- `<ExcelUploadDialog>` — bulk import
- pagination footer (e.g. "10 of 22")

## User Actions
- **Add Purpose** (bottom button) → inline form row.
- **Edit** (pencil) → inline edit row → save.
- **Delete** (trash) → confirm → remove (blocked if in use).
- **Enable/disable** (toggle) → flips active flag.
- **Excel Upload** → import dialog → preview → commit.
- Expand/collapse hierarchical rows; paginate.

## Table Columns
| Column | Source |
|---|---|
| Purpose Code | `use_usag_cd` |
| Purpose Name | purpose name |
| Description | description |
| (actions) | edit · delete · enable toggle |

## Dialogs / Popups
- Excel Upload dialog (with preview + error rows).
- Delete confirmation.

## API Integration
`/api/v1/settings/purpose-settings` — list / detail / create / update / delete / reorder / upload.
Wire is snake_case; translated to camelCase in `lib/api/mappers.ts`. (Phase 3 swaps `mockData.ts`
for live API.)

## Validation
- Purpose code + name required; client mirrors server uniqueness + reorder contiguity.
- Excel preview surfaces per-row errors before commit.

## Notes
Panel visibility is gated by the **Use Purpose** toggle in Preferences. Typography via Tailwind
tokens only.
