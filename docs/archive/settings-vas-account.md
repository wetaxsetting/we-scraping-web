# VAS Account

> Canonical Settings-menu entry for **Settings → VAS Account** (frontend). Detailed wiring lives in
> the linked design doc below.

## Overview
The VAS Account panel manages value-added-service / virtual accounts: view, add, edit, delete, and
Excel import/export. Slug: `vas-account`.

- Frontend design: [../features/vas-account.md](../features/settings/vas-account.md)
- API side: [../../../wecms-api/docs/settings/vas-account.md](../../../wecms-api/docs/features/settings/vas-account.md)

## Page Location
Settings modal panel — mounted inside `<SettingsModal>` via `<SettingsNav>` ("VAS Account").
**No standalone route.** Component folder `components/settings/vas-account/`.

## UI Components
- VAS Account panel shell + table + row / inline form-row
- RowActions (edit / delete / enable toggle)
- Excel import/export controls

## User Actions
- **Add / Edit / Delete** a VAS account.
- **Enable/disable** toggle.
- **Excel import** (preview → commit) and **export**.
- Paginate / sort.

## Table Columns
| Column | Source |
|---|---|
| VAS Account code | vas account code |
| Name | vas account name |
| Description / detail | per row |
| (actions) | edit · delete · toggle |

> Confirm exact column set against the shipped panel + Figma.

## Dialogs / Popups
- Excel import dialog (preview + error rows).
- Delete confirmation.

## API Integration
`/api/v1/settings/vas-account` — list / detail / create / update / delete + Excel preview/import/
export. snake_case wire ↔ camelCase mappers.

## Validation
- Code + name required; uniqueness mirrored from server.
- Seq number is server-generated (never sent by the client).

## Notes
Panel visibility is gated by the **Use VAS Account** toggle in Preferences. Paired with Purpose in
the transaction setup dialog.
