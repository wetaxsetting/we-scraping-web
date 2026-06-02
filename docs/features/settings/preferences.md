# Preferences

> Canonical Settings-menu entry for **Settings → Preferences** (frontend). **Backend confirmed
> against source 2026-06-01** (`comm_0215_001`; refactor `domain/setting/preferences/` +
> `domain/setting/environmentsettings/`). Confirm exact panel components against the shipped UI + Figma.

## Overview
The Preferences panel carries the **company profile** (logo, Vietnamese name, display name, Tax ID,
representative e-mail, address) and the system-wide **feature toggles** *Use Purpose* and
*Use VAS Account*. Slug: `preferences` (replaces legacy `comm_0215_001`).

- API side: in the separate `wecms-api` backend repo — not included in this clone.

## Page Location
Settings modal panel — mounted inside `<SettingsModal>` via `<SettingsNav>` ("Preferences", between
Bank Account and Users). **No standalone route.** Component folder `components/settings/preferences/`.

## UI Components
- Company-profile form (logo upload disc, VN name, display name, Tax ID, representative e-mail,
  address fields)
- Two feature toggles: *Use Purpose*, *Use VAS Account*
- Save / Edit controls

## User Actions
- **Edit + Save** the company profile.
- **Upload / clear** the company logo (and QR).
- **Toggle** *Use Purpose* / *Use VAS Account* (each an independent upsert).

## Table Columns
*Not a table — this panel is a form.* (Profile fields + two toggles.)

## Dialogs / Popups
- Logo upload / crop control (multipart).
- Possibly a confirmation on toggle-off (hides the corresponding panel).

## API Integration
- Company profile: `GET` / `PUT /api/v1/settings/preferences`; logo `POST` / `DELETE` / `GET`
  `/api/v1/settings/preferences/logo` (multipart upload).
- Feature toggles: `GET` / `PUT /api/v1/settings/environment-settings/{env_set_inf}` (one toggle per
  call) — backed by **`BUSI_ENV_SET_INFM`** (✅ confirmed; *not* `ENV_SETN_INFM`).
- snake_case wire ↔ camelCase mappers (`lib/api/environmentSettings.ts`, `hooks/useEnvironmentSettings.ts`).

## Validation
- Tax ID / representative e-mail format-checked; required fields non-blank.
- Logo file type/size constrained.

## Notes
The toggles here control whether the **Purpose** and **VAS Account** panels (and their
transaction-setup fields) are shown.
