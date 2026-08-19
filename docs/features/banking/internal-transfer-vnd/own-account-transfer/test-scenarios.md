# Own Account Transfer — Test Scenarios (Frontend)

Frontend SIT/UAT scenarios. Engine-driven transfer/balance flows need a **licensed origin + real credentials**
(R&D origin is unlicensed — marked **ENGINE-LIVE**). Backend scenarios:
[wecms-api/…/test-scenarios.md](../../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/own-account-transfer/test-scenarios.md).

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
| FE-X5 | **Update Balance, then Next in the SAME open modal** (ENGINE-LIVE) | Transfer runs on the session the balance scrape left open: engine sends **no** second `Open` and **no** second `LOGIN`; transfer completes. Must NOT surface `80002F31` "financial institution`s webpage was modified". |
| FE-X6 | Next → bank rejects → Next again (ENGINE-LIVE) | Second press reuses the same session (no re-`LOGIN`); the bank's own rejection is shown, never `80002F31`. |
| FE-X7 | Woori VN transfer after Update Balance (ENGINE-LIVE) | Woori's balance scrape logs out (`nonLogout:false`), so the transfer performs a fresh `LOGIN` — session reuse must NOT be applied for Woori. |
| FE-X8 | Close the modal after any successful scrape | Composer issues a best-effort engine `LOGOUT`; re-opening the modal starts a clean session (no `80002F31` on the next Update Balance). |
| FE-X9 | Update Balance → wait past the bank's IB idle timeout → Next (ENGINE-LIVE) | The transfer fails on the expired session **once**, the composer logs out, and the **next** press performs a clean `Open + LOGIN` and succeeds. It must NOT keep skipping `LOGIN` on every retry. |
| FE-X10 | **Lockout guard** — count LOGIN attempts across a full Update Balance → Next → retry cycle (ENGINE-LIVE) | At most **one** `LOGIN` per user press, and never two in a row without an intervening `LOGOUT`. Vietcom blocks the login after 3 failures, so a repeat-failing-LOGIN pattern is a defect regardless of the visible error. |
| FE-X11 | Update Balance → **close** the modal → **re-open** → fill the form → Next (no Update Balance this time) (ENGINE-LIVE) | Close issues a `LOGOUT`; the re-opened composer waits for it, then performs exactly **one** `Open` + `LOGIN` and completes the transfer. No `80002F31`, and no `LOGIN` skipped on a stale session. |
| FE-X12 | Close the modal **while** Update Balance is still running, then re-open and press Next (ENGINE-LIVE) | The finished refresh must NOT leave a session behind the closed modal — the bank is logged out when the scrape resolves, so the re-opened composer logs in cleanly. |

## 5. Balance / status (deferred — OQ-FE-1)

| ID | Scenario | Expected |
|---|---|---|
| FE-B1 | Update Balance success (ENGINE-LIVE) | Last-Refresh cell → green Success + datetime; balance updates. |
| FE-B2 | Update Balance failed | Last-Refresh cell → red Failed + datetime. |
| FE-B3 | No inquiry history | Last-Refresh cell blank. |
| FE-B4 | **Update Balance twice in the SAME open modal** (ENGINE-LIVE) | Second click reuses the live session (engine is not re-opened); balance refreshes again without `80002F31`. |
| FE-B5 | Change the From Bank, then Update Balance (ENGINE-LIVE) | Session tracked for the previous bank is discarded; the new bank performs a fresh `LOGIN`. Switching accounts *within the same bank* keeps the session (legacy `trns_0001_007.ts:961`). |

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

---

**Engine session lifecycle (FE-X5–X8, FE-B4–B5)** — added 2026-08-19 with
[the session-reuse fix](../../../../bugs/own-account-transfer-engine-session-reuse-2026-08-19.md).
All six need a licensed NXiSAS origin + real bank credentials, so they are SIT-only; see
[screen-flow.md §6](screen-flow.md) for the behaviour they pin.
