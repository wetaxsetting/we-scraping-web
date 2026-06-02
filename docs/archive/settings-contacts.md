# Contacts

> Canonical Settings-menu entry for **Settings → Contacts** (frontend). Detailed wiring lives in the
> linked design doc below.

## Overview
The Contacts panel manages trading partners (counterparties) used as sender/receiver in transfers
and payments, including their addresses and bank accounts. View, add, edit, delete. Slug: `contacts`.

- Frontend design: [../features/contacts-design.md](../features/settings/contacts.md)
- API side: [../../../wecms-api/docs/settings/contacts.md](../../../wecms-api/docs/features/settings/contacts.md)

## Page Location
Settings modal panel — mounted inside `<SettingsModal>` via `<SettingsNav>` ("Contacts").
**No standalone route.** Component folder `components/settings/contacts/`.

## UI Components
- Contacts panel shell + searchable table
- Row + add/edit form (partner name, type, address, bank account, overseas detail)
- RowActions (edit / delete)

## User Actions
- **Search/filter** partners.
- **Add / Edit** a partner (with nested address + account + overseas fields).
- **Delete** a partner (blocked if used by transactions).
- Paginate / sort.

## Table Columns
| Column | Source |
|---|---|
| Partner code / key | `trco_key` |
| Partner name | partner name |
| Account / bank | `TRCO_ACCT_INFO` |
| (actions) | edit · delete |

> Confirm exact column set against the shipped panel + Figma.

## Dialogs / Popups
- Add/Edit partner form (likely multi-section).
- Delete confirmation.

## API Integration
`/api/v1/settings/contacts` — list / detail / create / update / delete (address + account + overseas
handled in the same aggregate). snake_case wire ↔ camelCase mappers.

## Validation
- Partner name + key fields required; account numbers format-checked.
- Duplicate-partner check mirrored from server.

## Notes
Backend MR is expected to ship first for Contacts (per the task plan), so the panel can wire to a
live endpoint rather than mock data.
