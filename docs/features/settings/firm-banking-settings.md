# Firm Banking Settings

> Canonical Settings-menu entry for **Settings → Firm Banking → Firm Banking Settings** (frontend).
> Detailed implementation lives in the linked feature spec below.

## Overview
The Firm Banking Settings panel configures firm-banking registrations: which withdrawal account is
bound to which bank/service, with list / detail / create / update / delete and a per-row audit-log
view. Slug: `firm-banking-settings`. **Frontend wired 2026-05-09.**

- Feature spec (full references): [../../../wecms-api/docs/features/settings/firm-banking-settings.md](../../../../wecms-api/docs/features/settings/firm-banking-settings.md)
- API side: [../../../wecms-api/docs/settings/firm-banking-settings.md](../../../../wecms-api/docs/features/settings/firm-banking-settings.md)

## Page Location
Settings modal panel (Firm Banking group) — mounted inside `<SettingsModal>` via `<SettingsNav>`
("Firm Banking Settings"). **No standalone route.**

## UI Components
- Firm-banking-settings panel shell + list table
- `NewFirmBankingDialog` — create dialog with a **searchable withdrawal-account autocomplete**
  (loads per bank change, client-side filter; displays masked + currency-suffixed account)
- Detail/Edit dialog
- Audit-log view (per-row)
- RowActions (edit / delete)

## User Actions
- **Add** a firm-banking setting (pick bank → pick withdrawal account via autocomplete → fill the
  five required fields → save).
- **Edit / Delete** a setting.
- **View audit log** for a row.

## Table Columns
| Column | Source |
|---|---|
| Bank / service | bank, service |
| Withdrawal account | masked `acct_no` + currency |
| Status / registered | per row |
| (actions) | edit · delete · audit |

> Confirm exact column set against the shipped panel.

## Dialogs / Popups
- `NewFirmBankingDialog` (create, with withdrawal-account autocomplete).
- Detail/Edit dialog.
- Audit-log dialog. Delete confirmation.

## API Integration
`/api/v1/settings/firm-banking-settings` — list / detail / create / update / delete + audit-read.
Withdrawal-account autocomplete: `GET /api/v1/banking/accounts/by-bank`. snake_case wire ↔ camelCase
mappers.

## Validation
- Five required fields on create; bank/account referential check (server).
- Account number submitted raw; displayed masked.

## Notes
Create currently follows OQ-8a Option (c) — provisional/bounded-bank set (Mr. Jung may override).
