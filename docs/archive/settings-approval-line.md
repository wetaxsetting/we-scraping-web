# Approval Line

> Canonical Settings-menu entry for **Settings → Approval Line** (frontend). Detailed wiring lives
> in the linked design doc below.

## Overview
The Approval Line panel manages reusable ordered approver chains applied to payment/approval
workflows: view, add, edit, delete. Slug: `approval-line`.

- Frontend design: [../features/approval-line.md](../features/settings/approval-line.md)
- API side: [../../../wecms-api/docs/settings/approval-line.md](../../../wecms-api/docs/features/settings/approval-line.md)

## Page Location
Settings modal panel — mounted inside `<SettingsModal>` via `<SettingsNav>` ("Approval Line").
**No standalone route.** Component folder `components/settings/approval-line/`. Static UI (panel +
dialog + popover + table) already shipped.

## UI Components
- Approval-line panel shell + table (list of lines)
- Add/Edit dialog with an ordered approver builder
- Approver-picker popover (uses the user directory)
- RowActions (edit / delete)

## User Actions
- **Add / Edit** an approval line: name it, then add/reorder/remove approvers.
- **Delete** an approval line.
- Search + sort (by `REG_DTM` / `APPR_LINE_NM` / `MOD_DTM`).

## Table Columns
| Column | Source |
|---|---|
| Approval line name | `appr_line_nm` |
| Registered date | `reg_dtm` |
| (actions) | edit · delete |

## Dialogs / Popups
- Add/Edit approval-line dialog (with ordered approver list).
- Approver-picker popover.
- Delete confirmation.

## API Integration
`/api/v1/settings/approval-line` — `GET` list (`q`, `sort_field`, `sort_dir`), `GET /{id}`, `POST`,
`PUT /{id}`, `DELETE /{id}`. snake_case wire ↔ camelCase mappers.

## Validation
- Name non-blank; approver list non-empty, no duplicates, within max, all in-tenant.
- Server error codes (`WBE_APPROVAL_LINE_*`) mapped to inline messages.

## Notes
Wiring MR replaces mocks with real API calls — no new visual components.
