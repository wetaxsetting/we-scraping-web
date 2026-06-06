# Own Account Transfer — Test Scenarios (Frontend)

Frontend SIT/UAT scenarios. Engine-driven transfer/balance flows need a **licensed origin + real credentials**
(R&D origin is unlicensed — marked **ENGINE-LIVE**). Backend scenarios:
[test-scenarios.md](../../../../../wecms-api/docs/features/banking/own-account-transfer/test-scenarios.md).

---

## 1. List / search / sort

| ID | Scenario | Expected |
|---|---|---|
| FE-L1 | Open `/banking/own-account-transfer` | Source table renders; footer totals match; engine banner shows readiness. |
| FE-L2 | Select a bank in the filter | List filters; pagination resets to page 1; target cache cleared. |
| FE-L3 | Select "All Banks" | Full allowed list returns. |
| FE-L4 | Click a sortable header (BAL) | Cycle default→ASC→DESC; rows re-fetched DB-side (no client sort). |
| FE-L5 | Empty result | "no data" copy; footer zeros. |
| FE-L6 | View Setting popover | Toggle/reorder columns; BANK_CD + ETC locked; Save/Reset persist. |

## 2. Engine lifecycle

| ID | Scenario | Expected |
|---|---|---|
| FE-E1 | Engine ready | Banner hides; Transfer enabled for eligible rows. |
| FE-E2 | Engine not installed | `<EngineNotInstalledDialog>`; Download + Check Installation buttons. |
| FE-E3 | Non-Windows | `<EngineUnsupportedOsDialog>` acknowledge-only. |
| FE-E4 | Probe timeout | Banner with retry; `retry()` re-runs bundle + probe. |
| FE-E5 | Handshake audit | `POST engine-connection-check` fired; failure swallowed (no UI break). |

## 3. Transfer composition (validation — no engine needed)

| ID | Scenario | Expected |
|---|---|---|
| FE-C1 | Open composer from a row | Dialog opens; source chip pre-filled; targets lazy-load. |
| FE-C2 | No target selected | `validateDraft` → target-required error. |
| FE-C3 | Self-transfer (target == source) | same-account error. |
| FE-C4 | Zero / negative amount | amount error. |
| FE-C5 | Remark over byte-limit | per-bank remark error (`bank-profiles.ts`). |
| FE-C6 | NAPAS recipient | `validateNapas` resolves bank; invalid code → error. |

## 4. Transfer execution (ENGINE-LIVE)

| ID | Scenario | Expected |
|---|---|---|
| FE-X1 | Successful transfer | Engine LOGIN→TRANSFER→LOGOUT; `submitScrapingResult` → success dialog; list reloads. |
| FE-X2 | Engine failure | error dialog with code; nothing reloaded. |
| FE-X3 | 2nd-factor (OTP/QnA/Confirm) | Bridged dialog appears; correct input continues, cancel aborts. |
| FE-X4 | Network retry (same idempotency key) | `already_recorded=true`; no duplicate; single success dialog. |

## 5. Balance / status (deferred — OQ-FE-1)

| ID | Scenario | Expected |
|---|---|---|
| FE-B1 | Update Balance success (ENGINE-LIVE) | Last-Refresh cell → green Success + datetime; balance updates. |
| FE-B2 | Update Balance failed | Last-Refresh cell → red Failed + datetime. |
| FE-B3 | No inquiry history | Last-Refresh cell blank. |

## 6. Permissions

| ID | Scenario | Expected |
|---|---|---|
| FE-P1 | ADMIN | All accounts listed; Transfer on all eligible rows. |
| FE-P2 | USER with W grant | Only granted accounts; Transfer on `canTransfer` rows. |
| FE-P3 | USER without grant on a bank | Account not listed / Transfer disabled. |
| FE-P4 | No JWT | Redirect to `/login` (dashboard guard). |

## 7. Responsive / i18n

| ID | Scenario | Expected |
|---|---|---|
| FE-R1 | 375 / 768 / 1024 / 1440 | Sidebar drawer, table horizontal scroll, filter wrap all behave. |
| FE-R2 | Switch EN/KO/VI | All `own_account_transfer.*` strings localise; no raw keys. |
