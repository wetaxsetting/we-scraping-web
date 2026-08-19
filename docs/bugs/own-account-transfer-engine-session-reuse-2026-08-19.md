# Own Account Transfer — Second Engine Call Re-Runs LOGIN on a Live Bank Session (error code 80002F31)

**Date:** 2026-08-19
**Type:** BUG FIX | PARITY FIX
**Current Work Classification:** BUG
**Finding Classification:** BUG — missing legacy session-reuse state in the refactor composer
**Investigation Status:** COMPLETE
**Approval Status:** APPROVED — requested by Sonny in-session ("Please follow the claude rule. then fix it to correct.") after the impact analysis was presented
**Implementation Status:** COMPLETE
**Test Status:** PASS
**Status:** READY FOR MANUAL COMMIT
**Repository:** wecms-web
**Issue:** —
**Paired backend record:** none — this change touches no endpoint, DTO, entity, or key generation. See `## API Impact`.

> **Docs-first sequencing — stated honestly (CLAUDE.md §2a, §12f).**
> This record was created **after** the investigation and the code edits, inside the same
> session: the reporter asked for a diagnosis of a live SIT error first, the analysis was
> produced and presented, implementation was then explicitly approved, and the governance
> record was written during the quality gate. That ordering does **not** satisfy §2a and is
> recorded here rather than back-dated. No finding was lost — the full investigation is
> reproduced below from the same evidence (engine console logs + legacy source + vendor
> bundle). Future work on this screen creates the record before the detailed investigation.

## Problem

On SIT (`wecms.kosign.dev`) → Banking → Own Account Transfer, inside **one** open Transfer
modal:

1. User clicks **Update Balance** → the balance scrape succeeds
   (`ErrorCode 00000000`, available balance `3.369.311` rendered, "Last updated time:
   18-Aug-2026 17:38:56").
2. Without closing the modal, the user fills the transfer form and clicks **Next**.
3. The engine fails:

```
Error
The transaction failed, since the financial institution`s webpage was modified.
please check and try again later.
(Error Code : 80002F31)
```

The engine payload shows the failure is on the **LOGIN** job, not on TRANSFER:

```json
{ "Module": "GLOBAL/VNM/BANK_Vietcom", "Class": "CORPORATE", "Job": "LOGIN",
  "Input":  { "loginType": "ID", "loginID": "9744496G111", "loginPWD": "***********" },
  "Output": { "ErrorCode": "80002F31",
              "ErrorMessage": "The transaction failed, since the financial institution`s webpage was modified. please check and try again later." } }
```

The same credentials had logged in successfully five minutes earlier for the BALANCE job, so
this is **not** a credential, input, or cert problem.

## Current Behavior (before the fix)

Both engine calls ran through the same runner, `engine.runScraping(...)` →
`_v2nxisas.callNxisas(...)`, which **always** calls `CooconiSASNX.open(...)` and then
executes a `LOGIN` job (`public/nxisas/js/nxisas_v2.js:1717-1795`). Evidence in the reporter's
console dump — both scrapes begin with `{"Msg":"Open","ThreadLength":"1", …}` followed by
`Job: "LOGIN"`, at `17:38:47` and again at `17:43:27`.

Meanwhile the balance org-obj carried `nonLogout: true`
([OwnAccountTransferComposerDialog.tsx](../../components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx)),
and with that flag the bundle appends **no** `LOGOUT` job
(`nxisas_v2.js:1056-1080`, `makeLogOutInput`). So the Vietcom IB session from Update Balance
was still authenticated when the transfer re-opened the engine and re-submitted LOGIN. The
scraper landed on a page that is not the login page and answered with its generic
page-mismatch code, `80002F31`.

Sequence actually executed:

```
Update Balance :  Open → LOGIN → BALANCE            (no LOGOUT — nonLogout:true)
Next (transfer):  Open → LOGIN  ← 80002F31          (session still logged in)
```

Two further consequences of the same gap:

- **Retry path.** The transfer org-obj also ships `nonLogout: true`
  ([bank-profiles.ts](../../components/banking/own-account-transfer/bank-profiles.ts)), so the
  documented retry-on-error contract (composer stays open after a bank rejection → user
  presses **Next** again) hit the identical failure on the second press.
- **Orphaned sessions.** The composer never called the existing `runLogout` seam, so closing
  the modal after Update Balance left a logged-in bank session behind — the same class of
  issue that was already fixed for GDT (D1).

## Expected Behavior (legacy JEX)

Legacy tracks a "a scrape already left this bank logged in" flag and reuses the session
instead of logging in again — `WECMS DEV/WECMS_STATIC/ts-src/js/jex/wabooks/trns/trns_0001_007.ts`:

| Step | Legacy line | Behaviour |
|---|---|---|
| BALANCE org-obj | `:1607-1608` | `nonLogin = false`, `nonLogout = true` — log in, keep the session |
| Woori VN exception | `:1612-1613` | `nonLogin = false`, **`nonLogout = false`** — engine appends LOGOUT |
| BALANCE success | `:1654` | `trns_0001.runScrapingJob = true` |
| Sender bank changed | `:961` | `runScrapingJob = false` (per-bank session) |
| TRANSFER org-obj | `:2096` | `nonLogout = true` |
| TRANSFER + live session | `:2123-2125` | `nonLogin = true` — **no LOGIN job is built** |
| Engine entrypoint | `:77-83` | `runScrapingJob ? callNxisasWithoutOpenProcess : callNxisas` |
| Woori after transfer | `:2196-2200` | `trns_0001.resetNxisas()` from the unit-callback |

`callNxisasWithoutOpenProcess` is the vendor's own entrypoint for this case — its comment
reads *"기존 NXISAS 프로세스가 오픈된 상황에서 사용하는 함수(스크래핑을 한 번에 2회 이상 호출해야 할 경우 사용.)"*
("used when the NXISAS process is already open — when scraping must be called 2+ times") —
`nxisas_v2.js:1795-1796`. It performs **no** `CooconiSASNX.open`, and with `nonLogin:true` it
skips LOGIN entirely and jumps to `run_afterLoginSuccess`, running the jobs on the live
session (`nxisas_v2.js:1839-1854`; the skip test is at `:943`).

So legacy executes:

```
Update Balance :  Open → LOGIN → BALANCE            (no LOGOUT)
Next (transfer):  TRANSFER on the same session      (no Open, no LOGIN)
```

The same pattern already exists elsewhere in this repository and works — the e-invoice scrape
runs phase 2 with `nonLogin: true` to reuse the phase-1 GDT session
([lib/nxisas/einvoiceScrape.ts:239](../../lib/nxisas/einvoiceScrape.ts)). Own Account Transfer
simply never got it.

## Root Cause (verified)

The refactor composer has **no equivalent of legacy `trns_0001.runScrapingJob`**. Without that
state:

1. the transfer org-obj could never receive `nonLogin: true` (legacy `:2123-2125` had no port), and
2. the engine hook exposed only one runner, `runScraping` → `callNxisas`, so the
   `callNxisasWithoutOpenProcess` branch of legacy `:77-83` had no port either.

Every engine call therefore re-opened the engine and re-issued LOGIN. A secondary parity gap
compounded it: the refactor's BALANCE org-obj sent `nonLogout: true` for **every** bank,
including Woori VN, where legacy sends `nonLogout: false` (`:1612-1613`).

## Scope

- Session-lifecycle state in the Own Account Transfer composer (per-bank, per-open-modal).
- A second engine entrypoint on `useNxisasEngine` mapping to the vendor's
  `callNxisasWithoutOpenProcess`.
- `nonLogin` emission on the transfer org-obj.
- Woori VN `nonLogout` parity on the BALANCE job.
- Best-effort LOGOUT when the composer closes with a tracked session.

## Out of Scope

- Any backend change — no endpoint, DTO, entity, SQL, or key generation is touched.
- The legacy Woori `resetNxisas()` engine reset from the transfer **unit-callback**
  (`:2196-2200`). The refactor's `runScraping` does not wire the bundle's unit callback, so
  there is nowhere to hang it today. Mitigated (not fixed) by never tracking a reusable
  session for Woori. Recorded in `## Known Limitations / Follow-up`.
- Other engine-driven screens (e-invoice scrape already reuses correctly; Bank Transaction
  Sync uses the Spring REST path, not this bundle).

## Investigation

Read, in this order:

1. **Reporter evidence** — two engine console dumps (`17:38` balance, `17:43` transfer) plus
   two screenshots (success state with "Last updated time", then the `80002F31` dialog). The
   decisive detail is the second `{"Msg":"Open"}` + `Job:"LOGIN"` pair.
2. **Refactor call sites** — `handleUpdateBalance` (balance org-obj, `nonLogout:true`) and
   `handleConfirm` (transfer org-obj) in `OwnAccountTransferComposerDialog.tsx`;
   `buildNxisasOrgObj` in `bank-profiles.ts`; `runScraping` / `runLogout` in
   `hooks/use-nxisas-engine.ts`. No session state anywhere; `runLogout` had no caller on this
   screen.
3. **Vendor bundle** — `public/nxisas/js/nxisas_v2.js`: `makeLogOutInput` (`:1056-1080`,
   `nonLogout` suppresses LOGOUT), `makeLoginInput` (`:943`, `nonLogin` suppresses LOGIN),
   `callNxisas` (`:1717`, always opens), `callNxisasWithoutOpenProcess` (`:1796`, never opens).
4. **Legacy source** — `trns_0001_007.ts` lines cited in the table above, cross-checked
   against `trns_0001_001.ts` (`:1272`, `:1511`, `:1748-1750` — same flag, same branch).
5. **Existing refactor precedent** — `lib/nxisas/einvoiceScrape.ts:239` (`nonLogin:true` for
   phase 2) confirming the intended shape.

## Implementation

Three files, frontend only.

### 1. `hooks/use-nxisas-engine.ts` — a second entrypoint

- Added `runScrapingWithoutOpen(orgObj, onJob?)` to `UseNxisasEngineState`, the port of the
  legacy `runScrapingJob` branch (`:77-83`).
- Extracted a shared `driveScraping(orgObj, onJob, reuseSession)`; `reuseSession` selects
  `callNxisasWithoutOpenProcess` when the bundle exposes it and falls back to `callNxisas`
  otherwise, so an older vendor drop degrades to the previous behaviour instead of throwing.
- Declared `callNxisasWithoutOpenProcess?` on the `window._v2nxisas` typing (optional — absent
  on older drops).
- `runScraping` is unchanged in behaviour (it now delegates to the shared driver).

### 2. `bank-profiles.ts` — `nonLogin` on the transfer org-obj

- `buildNxisasOrgObj({ …, reuseSession? })`. When set, emits `nonLogin: true`.
- Applied **after** the Woori VN `nonLogin:false` branch, matching legacy's own ordering
  (`:2100` then `:2123`), so the ordering cannot be silently inverted later.

### 3. `OwnAccountTransferComposerDialog.tsx` — the session state

- `keepsEngineSessionAlive(bankCd)` module helper (Woori VN excluded) + `WOORI_VN_BANK_CD`.
- `liveSessionBankCdRef` — a `useRef<string | null>` holding the BANK_CD whose IB session is
  still logged in for this open modal. A ref, not state: it is read inside engine callbacks
  and must not re-render (legacy holds it on the `trns_0001` singleton).
- **BALANCE path:** `nonLogout` now comes from `keepsEngineSessionAlive(bankCd)`, restoring
  legacy `:1612-1613` for Woori. The entrypoint switches to `runScrapingWithoutOpen` when a
  session is already alive for this bank (a second Update Balance click); the job itself keeps
  `nonLogin:false` verbatim per legacy `:1607`. On `ErrorCode 00000000` the ref is set — placed
  before the empty-BAL guard, exactly where legacy flips the flag (`:1654`).
- **TRANSFER path:** `reuseSession = liveSessionBankCdRef.current === currentSource.bankCd`
  feeds both `buildNxisasOrgObj({ reuseSession })` and the entrypoint choice
  (`runScrapingWithoutOpen` vs `runScraping`) — legacy switches both together.
- Session invalidated when the user moves to a **different bank** (legacy `:961`; switching
  accounts within the same bank keeps the session, as in legacy).
- `resetState()` now calls `releaseEngineSession()` — best-effort `engine.runLogout(bankCd)`
  through the already-shipped D1 seam, then forgets the ref. Covers composer close and the
  close that follows a recorded transfer.

### Deliberate divergences from legacy (both documented in code comments)

| # | Divergence | Why |
|---|---|---|
| D1 | The session is marked live **after a SUCCESSFUL transfer** too (Woori excluded), via the shared `shouldKeepEngineSession` rule. Legacy sets its flag only after a successful BALANCE / RECEIVER_INFO (`:1654`, `trns_0001_001.ts:1511`). | The transfer org-obj carries `nonLogout:true`, so the bank is still logged in. Legacy's own retry click re-opens and re-logs-in — the same defect, on a path the refactor explicitly supports. **Revised in the hardening pass:** the first version marked the session live after *any* outcome, which is unsafe — see §"Lockout-risk review". |
| D2 | Best-effort LOGOUT whenever a tracked session is released — composer close, source-bank change, and **any non-success outcome**. Legacy only drops its flag and leaves the bank logged in. | Legacy's popup is a separate window whose script state dies with it (its flag resets while the bank session does not). In the SPA the composer is a dialog inside a long-lived page, so a dangling session would greet the next open with the same `80002F31`. Uses the existing `runLogout` seam; resolves on success, failure, and with no bundle present. |
| D3 | Woori VN is never marked as a reusable session, so it never receives `nonLogin:true`. Legacy `:2123` would set it for Woori too. | Woori's BALANCE runs `nonLogout:false` (session closed) and legacy resets its engine after a transfer, so a `nonLogin:true` transfer for Woori would run without a login — a latent legacy bug. The builder still honours legacy ordering if a caller ever does pass `reuseSession` for Woori (pinned by test). |

## Lockout-risk review (added 2026-08-19, after Sonny raised it)

> **The constraint.** Vietcom blocks the login after **3 failed attempts**, and only the
> Vietnam PO team can reset the password — days of downtime. Any change on this screen is
> therefore judged first on *how many LOGIN attempts it causes, and into what page state*.

Re-auditing the first version of this fix against that constraint found **two real problems in
the fix itself**. Both are now corrected.

### Problem 1 — the first version could strand a dead session (fixed)

The session was marked live after **any** transfer outcome, and was left untouched when the
engine threw, when the user cancelled the 2nd-cert, and when a BALANCE failed. Bank IB sessions
expire on their own (typically 5–15 min idle), so a user who filled the form slowly would hit:

```
10:00  Update Balance → LOGIN ok, session tracked
10:20  Next           → session expired at the bank → skips LOGIN → fails
10:21  Next again     → still "tracked" → skips LOGIN again → fails again … indefinitely
```

Every retry fails on a logged-out page with no route back to a fresh login short of closing the
modal — the exact frustration loop that makes a user hammer the button.

### Problem 2 — deciding to log in again is the actual lockout hazard (fixed)

Re-running LOGIN while a session may still be open submits saved credentials into an unknown
page state, and whether the bank counts that as a failed attempt is **not knowable from the
client**. The rule is therefore: **never log in on top of a session we opened — log out first,
then log in into a real login page.**

### The corrected rules

| Event | Session | Rationale |
|---|---|---|
| Job returns `00000000` | **keep** (Woori excluded) | Provably alive — we just used it |
| Any non-success code (`80002F31`, `8000F110`, OTP / transfer-password errors, `""`, …) | **release** — best-effort LOGOUT, then forget | Aliveness unknowable; the next attempt logs in cleanly |
| Engine threw / produced no outcome | **release** | Same |
| Scrape resolves after the composer CLOSED | **release** (log the bank out explicitly) | Nothing else would ever log it out — see §"Scenario walkthrough" Problem 3 |
| User cancelled the 2nd-cert (`LOGIN_CAN`) | **release** | Same |
| Source bank changed | **release** (first version: forget only) | Logging out prevents a dangling session at the old bank |
| Composer closed | **release** | Nothing authenticated survives a closed dialog |

One shared exported rule implements the first four —
`shouldKeepEngineSession(bankCd, jobStatus)` — so the two engine paths cannot drift apart. A
fresh-login attempt also `await`s any in-flight LOGOUT (`awaitPendingLogout`), so a LOGIN can
never interleave with a LOGOUT on the same engine and fail on the page shape.

### LOGIN attempts at the bank — before vs after

Vietcom `0441000688210`, the reported flow:

| User action | Before the fix | After the fix |
|---|---|---|
| Update Balance | 1 LOGIN — succeeds | 1 LOGIN — succeeds |
| **Next** (transfer) | 1 LOGIN — **fails `80002F31`** | **0 LOGIN** — runs on the live session |
| Next again (natural retry) | 1 LOGIN — **fails again** | n/a — the transfer went through |
| Next a third time | 1 LOGIN — **fails again** | n/a |
| **Failing LOGIN attempts in this flow** | **up to 3** | **0** |
| Retry after a genuine bank rejection | 1 LOGIN into an unknown page state | LOGOUT, then 1 LOGIN into the real login page |
| Update Balance twice | 2 LOGINs, the second on an authenticated page | 1 LOGIN, then session reuse |

**The old code was the lockout exposure** — it drove precisely the repeat-failing-LOGIN pattern
the 3-strike rule punishes. The fix removes those repeats and adds no LOGIN anywhere.

### What cannot cause a login (verified in source, not assumed)

| Checked | Finding |
|---|---|
| Automatic retry in the app | **None.** Every scrape is user-initiated (`grep` over all `runScraping` / `runScrapingWithoutOpen` call sites); no loop, no timer, no effect-driven scrape. |
| Automatic retry in the vendor bundle | **None for banks.** `run_afterLoginFail` (`nxisas_v2.js:2001-2040`) counts, stores the result, and may open the 2nd-cert popup — it never re-executes LOGIN. |
| Missing / empty credentials | Blocked before the engine runs — `hasSavedBankCert(currentSource)` pre-flight on **both** handlers (`:641`, `:998`), unchanged by this fix. |
| Double-submit | `submitting` / `updating` locks on both handlers (`:634`, `:980`), unchanged. |
| Engine probe / banner "try again" (`engine.retry()`) | License + Uid + Action handshake with the local `NXiSAS.exe` (`CooconiSASNX.open`) — **no bank credentials are sent**. |
| The added LOGOUT | Sends no credentials. On an already-dead session the job simply fails and `runLogout` resolves (best-effort, 10 s cap). It cannot increment a bank's failed-login counter. |

### Blast radius — what else in WeCMS talks to a bank

| Surface | Uses this code? | Impact |
|---|---|---|
| `buildNxisasOrgObj` | Own Account Transfer only (2 call sites, both in this composer) | Confined |
| `useNxisasEngine` → e-invoice scrape (`components/addon/sales-einvoices`) | Yes — but **GDT tax authority**, not a bank, and it calls the unchanged `runScraping` | No behaviour change (its 11 pre-existing test failures are identical before and after) |
| `useNxisasEngine` → GDT credential validation (`components/settings/login-credentials`) | Yes — tax authority, unchanged `runScraping` | No behaviour change |
| Payment module (all 5 modules, Card Transactions) | **No.** `components/payment/corporate-card/*` references `nxisas` only in comments and the `nxisas-debug` logger; no `useNxisasEngine`, no `buildNxisasOrgObj` | Untouched |
| Top menu / navigation | No engine usage | Untouched |
| Firm-banking dispatch to banks | Server-side in `wecms-api` (batch / dispatch), not this bundle | Untouched |

`runScraping` keeps its exact previous behaviour — the hook only gained a second member — so the
two GDT consumers are unaffected by construction.

## Scenario walkthrough — close and re-open (reviewed 2026-08-19)

Sonny asked what happens in this sequence, which crosses the modal boundary:

```
1. Open the Transfer modal → Update Balance → success
2. Close the modal
3. Re-open the modal
4. Fill the form and press Next directly (no Update Balance this time)
```

**Traced outcome — one clean LOGIN, no `80002F31`.**

| Step | What runs | Session state |
|---|---|---|
| 1 | `Open` → `LOGIN` → `BALANCE`, `nonLogout:true` (no LOGOUT job) | tracked: `11704004` |
| 2 | Close → `handleClose` → `resetState()` → `releaseEngineSession()` fires a best-effort `LOGOUT` and clears the ref; the promise is parked in `pendingLogoutRef` | not tracked; bank being logged out |
| 3 | Re-open — the ref is already null | not tracked |
| 4 | `reuseSession === false` → **`await awaitPendingLogout()`** → `runScraping` → `Open` + `LOGIN` → `TRANSFER` | tracked again only if the transfer succeeded |

Two structural facts this depends on, both verified in source rather than assumed:

- **Every close path releases the session.** `<DialogContent>` is configured
  `closeOnOutsideClick={false}` + `closeOnEscape={false}`, and
  `onOpenChange` routes the X button to `handleCancelClick` → `handleClose` →
  `resetState()`. Cancel uses the same handler. There is no close path that
  skips the logout.
- **The refs survive close → re-open.** `OwnAccountTransferPage` renders the
  composer **unconditionally** (`source={composerSource}`), so closing only
  nulls the prop — the component instance stays mounted. That is what lets
  step 4 await the LOGOUT started in step 2 instead of racing it. (Had the
  page conditionally mounted the dialog, `pendingLogoutRef` would die with it
  and step 4's LOGIN could interleave with step 2's LOGOUT.)

The engine process itself stays open between runs — the bundle has no
`CooconiSASNX.close()` anywhere; the only teardown is the explicit
`stopAllNxisas` abort path (`nxisas_v2.js:2377`). That is both why
`callNxisasWithoutOpenProcess` is usable at all and why the LOGOUT in step 2
can still reach the live thread after the balance run finished.

### Problem 3 — a scrape that finishes AFTER the modal closes (fixed)

Reviewing this scenario surfaced a third hole. **Cancel and X are only blocked
during a transfer** (`handleClose` guards on `submitting`), not during an
Update Balance refresh, so this is reachable:

```
Update Balance (in flight) → user closes the modal → close releases nothing
                                                     (nothing tracked yet)
                           → the scrape then SUCCEEDS
                           → the old code marked the session live
```

The result was a tracked, logged-in session behind a closed modal that
**nothing would ever log out** — the modal's own close had already run. A
re-open minutes later would then skip LOGIN against a session the bank may
have expired.

Fixed by making the rule aware of the composer's state:
`shouldKeepEngineSession(bankCd, jobStatus, composerOpen)` — a scrape that
resolves while the composer is closed never keeps its session; the caller logs
that bank out instead. `composerOpen` is read from a ref
(`composerOpenRef`) so an engine callback sees the live value, not the value
captured when the scrape started.

`releaseEngineSession(explicitBankCd?)` also now accepts the bank explicitly,
so cleanup happens even when nothing was tracked — the closed-mid-scrape case,
a job that failed after LOGIN succeeded, and a 2nd-cert cancel. Logging out a
bank we never tracked is harmless: no credentials are sent, and the job simply
fails if there is no session.

### Residual risk in this scenario — honest statement

If the step-2 LOGOUT itself fails (the engine was already torn down, the bank
ignored it, the page shape changed), the bank may still hold the session when
step 4 logs in — and that LOGIN can still meet `80002F31`. **That failure mode
is not new**: it is exactly what the pre-fix code did on every re-open, and it
is what legacy does too (legacy's popup is a separate window whose
`runScrapingJob` dies with it, so legacy always re-opens with a fresh LOGIN
against a possibly-live session). The fix strictly improves it by attempting
the logout first; it cannot guarantee the bank complied.

The measurable guarantee is the one that matters for the lockout rule: **at
most one LOGIN per user press, and never two in a row without an intervening
LOGOUT attempt.** Scenario FE-X11 in the screen's `test-scenarios.md` exercises
this exact close → re-open → Next sequence on SIT.

## Files Changed

| File | Change |
|---|---|
| [components/banking/own-account-transfer/hooks/use-nxisas-engine.ts](../../components/banking/own-account-transfer/hooks/use-nxisas-engine.ts) | `runScrapingWithoutOpen` + shared `driveScraping` + vendor typing |
| [components/banking/own-account-transfer/bank-profiles.ts](../../components/banking/own-account-transfer/bank-profiles.ts) | `reuseSession` arg → `nonLogin: true`, applied in legacy order |
| [components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx](../../components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx) | session ref + pending-logout ref + composer-open ref, both entrypoint switches, Woori `nonLogout` parity, exported `shouldKeepEngineSession` rule, release on every failure / cancel / bank-change / close, `awaitPendingLogout` serialization |
| [components/banking/own-account-transfer/bank-profiles.sessionReuse.test.ts](../../components/banking/own-account-transfer/bank-profiles.sessionReuse.test.ts) | **new** — 7 regression cases |
| [components/banking/own-account-transfer/hooks/use-nxisas-engine.sessionReuse.test.tsx](../../components/banking/own-account-transfer/hooks/use-nxisas-engine.sessionReuse.test.tsx) | **new** — 5 regression cases |
| [components/banking/own-account-transfer/OwnAccountTransferComposerDialog.sessionLifecycle.test.ts](../../components/banking/own-account-transfer/OwnAccountTransferComposerDialog.sessionLifecycle.test.ts) | **new** — 13 cases pinning the keep-vs-release safety rule, incl. the closed-composer dimension |

Nothing outside the requested scope is in the diff — `git status` shows exactly these files
plus the four documentation files. The single ESLint warning in the OAT folder
(`emptyMessageKey` unused in `SourceAccountsTable.tsx`) is **pre-existing** and untouched per
`feedback_preserve_existing_code`.

## API Impact

**NONE.** No endpoint, request/response shape, field name, or key format changes. The engine
runs in the browser against the bank site; Spring is strictly post-scrape
(`/balance-refresh`, `/scraping-result`) and both payloads are byte-identical to before. No
paired `wecms-api` record is required (CLAUDE.md §9f applies only when both sides change).

## UI Impact

No visual change — no layout, token, copy, or locale key is touched. The behavioural change is
that the second engine call in one open modal now succeeds instead of surfacing the
`80002F31` error dialog. The error dialog itself, its variant, and its wording are unchanged.

## Database Impact

**NONE (frontend)** — no database dependency. No `.sql` is added to this repository
(CLAUDE.md §12g). The audit rows written by the unchanged `/balance-refresh` and
`/scraping-result` intakes are unaffected.

## Integration Impact

Coocon NXiSAS local engine only, and in the direction of *fewer* bank logins per modal
session: one LOGIN per bank instead of one per action, plus an explicit LOGOUT on close.
No gateway URL, license origin, or vendor contract changes.

## Verification

### Automated Tests

- Test: `npx vitest run components/banking/own-account-transfer`
- Result: **PASS** — 6 files, **85 executed, 85 passed, 0 failed** (final run, after the close/re-open review)
- Test: `npx vitest run components/banking/own-account-transfer components/addon/sales-einvoices` (pre-change baseline run)
- Result: **PASS for this change** — 9 files, 99 executed, 88 passed, **11 failed, all pre-existing** (see `## Test Evidence` → Existing Failures)
- Test: `npx tsc --noEmit -p tsconfig.json` (filtered `grep -v '^\.next/'`)
- Result: **PASS** — 0 errors in project sources
- Test: `npx eslint <5 changed/new files>`
- Result: **PASS** — 0 problems

### Regression Test

```
Test file:          components/banking/own-account-transfer/bank-profiles.sessionReuse.test.ts
Test case:          "sets nonLogin:true when a session is alive — no second LOGIN, no 80002F31"
Behavior protected: a transfer following a successful balance scrape must not build a LOGIN job

Test file:          components/banking/own-account-transfer/hooks/use-nxisas-engine.sessionReuse.test.tsx
Test case:          "runScrapingWithoutOpen uses callNxisasWithoutOpenProcess — no second Open+LOGIN"
Behavior protected: the 2nd..nth scrape in one session must not re-open the engine

Test file:          components/banking/own-account-transfer/OwnAccountTransferComposerDialog.sessionLifecycle.test.ts
Test case:          "releases the session after code <X>" (7 non-success codes) + Woori +
                    no-status + "does NOT keep a session when the composer already closed"
Behavior protected: only a job that returned 00000000 may keep the session — every other
                    outcome logs out, so the next attempt logs in cleanly instead of
                    skipping LOGIN on a dead session or logging in blind
```

**Fails before the fix — actually executed, not assumed.** The three source files were
restored to `HEAD` (`git checkout --`) with the two new test files left in place: **6 of 12
cases failed** (`TypeError: result.current.runScrapingWithoutOpen is not a function`;
`expected undefined to be true` on `nonLogin`). The fix was restored from a byte-verified
backup (md5 match) and the suite returned to 72/72. Full transcript in the test-result record.

### Regression Review

- Areas checked: `runScraping`'s existing callers — the balance and transfer paths on this
  screen (both re-verified by the 72-test suite) and the e-invoice scrape
  (`components/addon/sales-einvoices`, `lib/nxisas/einvoiceScrape.ts`), which consumes
  `useNxisasEngine` and was **not** modified: `runScraping` keeps its exact previous
  behaviour, and the hook's return object simply gains one member.
- Result: no behavioural change outside Own Account Transfer. The 11 failing
  `useEInvoiceScrape` tests fail identically before and after this change (stale `vi.mock`
  factory — CLAUDE.md §14j category B).

### Security / Permission Review

- No change to authentication, authorization, permission gating, or JWT handling.
- Credential exposure is **reduced**: one bank LOGIN per modal session instead of one per
  action, and the added logout closes the session sooner. `releaseEngineSession()` logs
  nothing; `runLogout`'s own catch is already sanitized (never credentials / UID / Action).
- The new session ref holds a BANK_CD only — no credential, token, or account number — lives
  in memory for the lifetime of one open dialog, and is never persisted or logged.

### Manual Verification

- Environment: LOCAL
- Steps: not performed — reproducing this defect needs a **licensed NXiSAS origin plus real
  Vietcom corporate credentials** (the local R&D origin is unlicensed; see
  `reference_nxisas_local_engine_origin`). The engine cannot run here.
- Result: **NOT RUN** — SIT verification by Mr. Youvita is required to close the loop
  (scenario FE-X5 / FE-B4 below).

## Result

The Update Balance → Next sequence now runs the transfer on the session the balance scrape
left open, matching legacy `trns_0001_007.ts` exactly: no second `CooconiSASNX.open`, no
second `LOGIN`, and therefore no `80002F31`. Repeat **Next** presses after a bank rejection
reuse the same session (D1), Woori VN keeps its legacy logout-after-balance behaviour, and
closing the modal no longer leaves an authenticated bank session behind (D2).

**Code + tests + documentation are complete. Nothing is committed, pushed, or deployed**
(CLAUDE.md §15) — and SIT verification against a licensed origin has not happened yet.

## Test Evidence

Test result:
[Own Account Transfer — Engine Session Reuse — Test Result](../testing/results/own-account-transfer-engine-session-reuse-test-result-2026-08-19.md)

```
Final test result:    PASS
Regression coverage:  PASS (fail-before/pass-after executed)
Manual / SIT:         NOT RUN — licensed engine origin required
```

## Known Limitations / Follow-up

1. **SIT verification outstanding.** The defect is only reproducible on a licensed origin with
   real bank credentials. Test scenarios FE-X5 (transfer after Update Balance) and FE-B4
   (second Update Balance click) were added to the screen's
   [test-scenarios.md](../features/banking/internal-transfer-vnd/own-account-transfer/test-scenarios.md)
   for the SIT pass.
2. **Woori VN engine reset not ported.** Legacy calls `trns_0001.resetNxisas()` from the
   transfer **unit-callback** for Woori (`trns_0001_007.ts:2196-2200`). The refactor's
   `runScraping` passes `undefined` for the bundle's unit callback, so there is no seam for it.
   Mitigated by never tracking a reusable session for Woori (D3). Wiring the unit callback is a
   separate, scoped change — not bundled here per `feedback_preserve_existing_code`.
3. **Cross-screen session sharing is not modelled.** The ref is scoped to one open composer.
   If a future screen runs its own engine scrape for the same bank while this modal is open,
   neither side knows about the other's session. Legacy has the same limitation (per-page
   singleton). If that combination ever ships, the state belongs in a shared engine-session
   module, not duplicated per screen.
4. **Docs-first ordering was not met for this task** — see the note under the title. Recorded,
   not excused.
