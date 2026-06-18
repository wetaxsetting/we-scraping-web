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
- `POST /api/v1/banking/scraping/verify` (inline verify — Add / Registered-add scrape; no credential created)
- `POST /api/v1/login-credentials/bank/register` (atomic Save — creates `BANK_CERT_INFO` + `ACCT_MSTR` + `ACCT_AUTH_INFO` in one transaction)
- `POST /api/v1/banking/accounts/register` (`AccountRegistrationService` — invoked inside the atomic save; also the standalone register path)
- `DELETE /api/v1/login-credentials/{type}/{seqNo}` (guarded safety-net cleanup — see below)

## Validation
- Bank + id + password required at each step; password never echoed back from the server.
- Gateway `OTP_REQUIRED` drives the OTP dialog; `80000015` = unlicensed origin.

## Select Bank Accounts popup — remediation status (Phase 1 + Phase 2, 2026-06-17)

`SelectBankAccountsDialog.tsx` (Figma 1081:25485) opens after a `COMPLETED` scrape. The
following were fixed across two phases; component: `components/shared/popups/SelectBankAccountsDialog.tsx`,
mapper: `components/shared/popups/selectBankAccountsMockData.ts`, host: `LoginCredentialsPanel.tsx`.

| Item | Status | Detail |
|---|---|---|
| **Popup layout** | ✅ COMPLETE | Fixed height = Settings-modal default (`--w-wb-settings-card-h`, viewport-bounded); only the table **body** scrolls (vertical + horizontal); header `sticky top-0`, footer pinned (`shrink-0` + `border-t`). The popup no longer grows with row count. |
| **Account Type auto-mapping** | ✅ **COMPLETE** | Backend resolves the raw scraped type → `ACCT_TYPE_CD` via `NXISAS_ACCT_TYPE_MAPPING` (`acct_type_cd` on the wire). The dropdown shows ONLY 3 business labels (Current / Savings / Fixed Deposit), auto-selects the mapped code (`normalizeAcctTypeCd(acc.acct_type_cd ?? acc.acct_type)`), falls back to blank + manual when unmapped, and never shows raw scraped labels. Selected rows require Account No + Currency + Account Type before Save. |
| **Maturity Date** | ✅ **COMPLETE** | Gateway `maturityDate` mapped end-to-end (`maturity_date` wire → `BankAccountRow.maturityDate`), rendered read-only (`"—"` when blank), **and persisted** to `ACCT_MSTR.EXPI_DT` (backend `normalizeExpiDt` → `yyyyMMdd`; invalid skipped). |
| **VAS Code / VAS Account Name** | ✅ **COMPLETE** | Render for non-`H` product types and **persist** to `ACCT_MSTR.VAS_ACCT_CD` / `VAS_ACCT_NM` (sent in the Save payload). |
| **Product type `H`** | ✅ **COMPLETE** | `showVas = !isProductType(userStorage.get(), "H")` — VAS columns hidden and omitted from the payload for `H` (legacy `comm_0218_nxisas_view.jsp` parity). |
| **Balance / Available Balance** | ✅ Saved, not displayed | `bal` is sent and persisted to `ACCT_MSTR.BAL`; Available Balance is **not** persisted (backend sets `REAL_AMT=0`, matching legacy). Neither is shown (no Balance column — legacy parity). |
| **Atomic save (no orphan `BANK_CERT_INFO`)** | ✅ **COMPLETE** | The Add / Registered-add flows verify the login **inline** (`verifyScrape`, no credential created during the scrape) and hold the verified credential in transient `pendingBankCredential` state. Save calls `createBankLoginCredentialWithAccounts` → `POST /api/v1/login-credentials/bank/register`, which creates `BANK_CERT_INFO` + `ACCT_MSTR` + `ACCT_AUTH_INFO` in ONE backend transaction. Abandoning (Back / X / ESC / overlay / challenge cancel) drops the draft — **no save ⇒ no credential**. Abandon-cleanup retained as a guarded safety net. |

**Readiness:** **SIT Ready — YES**, conditional on the operational follow-ups below. **UAT Ready — NO** until the SIT live-gateway pass and the `VAS_ACCT_SEQ_NO` confirmation.

### Operational Follow-ups

All feature items above are COMPLETE in code. The remaining items are operational, not development:

1. **DBA — run the `NXISAS_ACCT_TYPE_MAPPING` seed** per env (`Claude Code (AI)/sql/nxisas_acct_type_mapping_20260617.sql` — DDL + 18 rows, idempotent; off-inventory → also needs PO baseline sign-off). Account Type auto-select degrades to manual selection until seeded (safe).
2. **PO/DBA — `VAS_ACCT_SEQ_NO` confirmation.** VAS Code/Name persist; the `BUSI_VAS_ACCT_INFM` seq FK is left null (the popup has no seq source). Confirm whether it must be resolved.
3. **SIT — live-gateway verification** on a licensed Windows origin: real `maturityDate` value/format, VAS round-trip, and the atomic Save against the live Coocon gateway (cannot run headless).

Backend counterpart: login-credentials.md _(wecms-api backend repo — not included in this clone)_ (§ Select Bank Accounts registration + OQ-8/9/10/11). Source audits: `docs/audits/login-credentials-legacy-vs-refactor-audit.md`.

## Notes
**GDT credentials are manual-only** — do not confuse with the server-side bank scraping flow. GDT
branch + live Audit Logs body remain backend-pending.
