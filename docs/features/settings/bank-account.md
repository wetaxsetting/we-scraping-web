# Bank Account

> Canonical Settings-menu entry for **Settings → Bank Account** (frontend). **Confirmed against
> source 2026-06-01** — panel `components/settings/bank-account/`.

## Overview
The Bank Account panel manages the tenant's registered bank-account master rows: list/sort, edit
maintenance fields (nickname, description, account type, maturity, VAS-account mapping), manage
per-user **View / Withdrawal permissions**, and register accounts pulled from a Coocon scrape.
Slug: `bank-account`.

- API side: [../../../wecms-api/docs/settings/bank-account.md](../../../../wecms-api/docs/features/settings/bank-account.md)

### Confirmed source files (`wecms-web/components/settings/bank-account/`)
- `BankAccountPanel.tsx` — panel shell
- `BankAccountTable.tsx` + `columns.ts` — table + column defs
- `BankBrandLogo.tsx` — bank logo cell
- `EditBankAccountDialog.tsx` — edit one account
- `PermissionDialog.tsx` — View / Withdrawal permission editor (Figma **166:24840** / **166:25059**)
- `VasAccountPicker.tsx` — VAS-account mapping picker
- `types.ts`

## Page Location
Settings modal panel — mounted inside `<SettingsModal>` via `<SettingsNav>` ("Bank Account", in the
nav between **Login Credentials** and **Preferences**). **No standalone Next.js route.**

## UI Components
- `BankAccountPanel` (list + toolbar), `BankAccountTable` (View-Setting-aware columns), `BankBrandLogo`
- `EditBankAccountDialog` — nickname, description, account type, maturity, VAS mapping
- `PermissionDialog` — checkbox roster for View / Withdrawal permission
- `VasAccountPicker` — searchable VAS-account selector
- Sort headers driven by View Setting `FIELD_ID` (e.g. `BANK`, `BALANCE`; VAS-name sort enabled by
  backend V193)

## User Actions
- **List / sort** accounts.
- **Edit** an account (`EditBankAccountDialog`) → `PATCH /{bankCd}/{acctNo}`.
- **Map a VAS account** via `VasAccountPicker` (validated server-side).
- **Manage permissions** (`PermissionDialog`): set View (`type=V`) / Withdrawal (`type=W`) grantees →
  `PUT /{bankCd}/{acctNo}/permissions`.
- **Register** accounts picked from a scrape (Login Credentials add-chain) → `POST /register`.

## Table Columns
| Column | Source (`BankAccountRow`) |
|---|---|
| Bank (logo + name) | `bankCd` / `bankName` |
| Account No | `acctNo` |
| Currency | `currency` |
| Nickname | `nickname` |
| Description | `description` |
| Account Type | `accountTypeCd` → current / saving / fixed |
| Maturity Date | `maturityDate` (ISO) |
| VAS Account | `vasAcctNm` / `vasAccountBank` |
| Balance | `bal` / `realAmt` |
| View Permission | aggregate label (link / "X" / count) |
| Last modified | `lastModifiedBy` / `lastModifiedAt` |

> Column visibility/order/sort is governed by **View Setting** (`/api/v1/screen-options/`).

## Dialogs / Popups
- `EditBankAccountDialog` (edit maintenance fields + VAS mapping).
- `PermissionDialog` (View / Withdrawal permission roster — Figma 166:24840 / 166:25059).
- `VasAccountPicker` (VAS-account selection).

## API Integration
- `GET /api/v1/settings/bank-account` (`sortField`, `sortDirection`)
- `PATCH /api/v1/settings/bank-account/{bankCd}/{acctNo}`
- `GET` / `PUT /api/v1/settings/bank-account/{bankCd}/{acctNo}/permissions?type=`
- `POST /api/v1/settings/bank-account/register`
- Lookups: `fetchVasAccountLookup` → `/api/v1/settings/vas-account/lookup`;
  `fetchLoginCredentialBanks` → `/api/v1/login-credentials/bank`;
  scrape → `/api/v1/banking/scraping/account-list`, `/api/v1/banking/accounts/register`;
  View Setting → `/api/v1/screen-options/`. snake_case wire ↔ camelCase mappers.

## Validation
Mirrors server: `nickname` ≤20, `description` ≤200, account-type code, maturity date (ISO), VAS FK
validated server-side. Server error codes (`WBE_BANK_ACCOUNT_*`) mapped to inline messages.

## Feature status (verified against code 2026-06-01)
- **Implemented now:** list/sort, `EditBankAccountDialog` (incl. VAS mapping via `VasAccountPicker`),
  `PermissionDialog` (View `V` / Withdrawal `W` — backed by the live permission endpoints), account
  registration from the scrape add-chain.
- **Placeholder / planned:** the per-row **Audit Logs dialog body uses mock rows** (no backend
  audit-read endpoint yet); the VAS-name composite column echoes the VAS name until the backend ships
  the full "BANK_NM(CCY)" form; `BankBrandLogo` shows a brand-coloured placeholder until the real PNG
  asset exists (cosmetic).
- **Needs confirmation:** a third `AUTH_TYPE = 'F'` exists in the DDL — confirm whether the UI exposes
  it (the dialog currently handles View/Withdrawal only).

## Notes
Maturity datepicker is intentionally disabled for current accounts (ACCT_TYPE 03/04) — JEX parity, not
a gap. Backend counterpart: [../../../wecms-api/docs/settings/bank-account.md](../../../../wecms-api/docs/features/settings/bank-account.md).
