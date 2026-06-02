# Chart of Accounts

> Canonical Settings-menu entry for **Settings → Chart of Accounts** (frontend). Detailed wiring
> lives in the linked design doc below.

## Overview
The Chart of Accounts panel manages the tenant's hierarchical account tree: view (list + tree),
add, edit, delete, with a parent-picker. Slug: `chart-of-accounts`.

- Frontend design: [../features/chart-of-accounts.md](../features/settings/chart-of-accounts.md)
- API side: [../../../wecms-api/docs/settings/chart-of-accounts.md](../../../wecms-api/docs/features/settings/chart-of-accounts.md)

## Page Location
Settings modal panel — mounted inside `<SettingsModal>` via `<SettingsNav>` ("Chart of Accounts").
**No standalone route.** Component folder `components/settings/chart-of-accounts/`. Static UI
(`ChartOfAccountsPanel`, `ChartOfAccountsTable`, `ExcelUploadDialog`) already exists.

## UI Components
- `ChartOfAccountsPanel` shell + `ChartOfAccountsTable` (tree-aware, level/indent, has-children)
- Add/Edit form with parent-picker tree
- RowActions (edit / delete)
- `ExcelUploadDialog`

## User Actions
- **Add / Edit** an account (code, names, parent, cal rule P/M, status A/I).
- **Delete** an account (blocked if it has children).
- Expand/collapse tree; **Excel upload**.

## Table Columns
| Column | Source |
|---|---|
| Account code | `chart_acct_cd` |
| Account name (EN) | `chart_acct_nm_en` |
| Status | `stts` (A/I) |
| (actions) | edit · delete |

## Dialogs / Popups
- Add/Edit account dialog (with parent-picker tree).
- Excel upload dialog.
- Delete confirmation.

## API Integration
`/api/v1/settings/chart-of-accounts` — `GET /` list `{ items, total, restricted_codes }`, `GET /tree`,
`POST`, `PUT /{id}`, `DELETE /{id}`. snake_case wire ↔ camelCase mappers.

## Validation
- Code + name required; restricted codes rejected; cycle / self-parent / depth guarded (mirrors
  server).

## Notes
Phase 1 wires the live backend into the existing static shell.
