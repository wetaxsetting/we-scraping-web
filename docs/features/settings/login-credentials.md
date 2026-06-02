# Login Credentials

> Canonical Settings-menu entry for **Settings → Login Credentials** (frontend). Full dialog-chain
> detail lives in the linked feature spec below.

## Overview
The Login Credentials panel manages the tenant's bank login credentials (and a GDT tax-authority
variant) used by the firm-banking gateway. It is the first Settings panel that drives a live
external system (Coocon NXISAS) through a multi-step verify-before-save flow. Slug: `login-credentials`.

- Full feature spec (backend + frontend dialog chain): login-credentials.md _(wecms-api backend repo — not included in this clone)_
- API side: login-credentials.md _(wecms-api backend repo — not included in this clone)_

## Page Location
Settings modal panel — `components/settings/login-credentials/LoginCredentialsPanel.tsx`, mounted in
`<SettingsModal>` via `<SettingsNav>`. **No standalone route.** No View-Setting toolbar button
(slug reserved for log/audit consistency only).

## UI Components
- `LoginCredentialsPanel` — list grouped by institution (bank rows + GDT row)
- Shared popups (under `components/shared/popups/`): `SelectLoginInstitutionDialog`,
  `SelectBankDialog`, `LoginIdPasswordDialog`, `OtpChallengeDialog`, `SelectBankAccountsDialog`,
  `RegisteredLoginCredentialsDialog`, `EditLoginIdPasswordDialog`, `PasswordConfirmationDialog`,
  `AuditLogsDialog`

## User Actions
- **Add** a credential via the chain: pick institution → pick bank → enter id/password → backend
  Coocon `verify` → (OTP if `OTP_REQUIRED`) → pick accounts → save.
- **Edit** the password on a registered row (re-verifies, sends `old_password` guard).
- **Reveal** masked password (static UI today — OQ-3).
- **Delete** a credential (static UI today — OQ-4).
- **Audit Logs** per row (mock body today — OQ-2).

## Table Columns
| Column | Source |
|---|---|
| Institution / bank | `BANK_CD` → bank name |
| Login ID | login id |
| Status / registered | per row |
| (actions) | edit · reveal · delete · audit |

## Dialogs / Popups
The full Figma Add chain + Registered/Edit/Confirm/Audit dialogs listed under UI Components.

## API Integration
- `POST /api/v1/banking/scraping/verify` → `POST /api/v1/banking/scraping/{sessionId}/otp`
- `POST /api/v1/login-credentials/bank` (persist) · `PUT /api/v1/login-credentials/bank/{seqNo}` (edit)
- `DELETE /api/v1/banking/credentials/{seqNo}` (not yet wired into the panel)

## Validation
- Bank + id + password required at each step; password never echoed back from the server.
- Gateway `OTP_REQUIRED` drives the OTP dialog; `80000015` = unlicensed origin.

## Notes
**GDT credentials are manual-only** — do not confuse with the server-side bank scraping flow. GDT
branch + live Audit Logs body remain backend-pending.
