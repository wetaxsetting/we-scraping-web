# Own Account Transfer — Engine Session Reuse — Test Result

**Date:** 2026-08-19
**Type:** TEST RESULT
**Status:** PASS
**Repository:** wecms-web
**Related Record:** [Own Account Transfer — Second Engine Call Re-Runs LOGIN on a Live Bank Session](../../bugs/own-account-transfer-engine-session-reuse-2026-08-19.md)
**Issue:** —

## Scope

Verification of the engine session-reuse fix on Banking → Own Account Transfer: after a
successful **Update Balance**, the transfer fired by **Next** now runs on the still-open bank
session (`nonLogin:true` + `callNxisasWithoutOpenProcess`) instead of re-opening the engine and
re-issuing `LOGIN`, which Vietcom rejected with `80002F31`. Legacy contract under test:
`trns_0001_007.ts:77-83`, `:1607-1613`, `:1654`, `:961`, `:2096-2101`, `:2123-2125`.

## Environment

LOCAL only. **SIT / UAT not exercised** — deployment is manual and has not happened, and the
defect additionally requires a licensed NXiSAS origin plus real Vietcom corporate credentials
(the local R&D origin is unlicensed, so the engine cannot run here at all).

## Code / Build Under Test

- Branch: `wecms-ui-fixes`
- Commit: **NOT COMMITTED** — working tree
- Build/artifact: Vitest 2.1.9 (jsdom), TypeScript `tsc --noEmit`, ESLint 9
- API URL/environment: not used — every test exercises pure functions or the hook against a
  stubbed bundle; no HTTP, no `NXiSAS.exe`

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/banking/own-account-transfer` | **PASS** | 6 files, **85 executed, 85 passed, 0 failed** — final run, after the close/re-open review |
| `npx vitest run components/banking/own-account-transfer components/addon/sales-einvoices components/settings/login-credentials` | **PASS for this change** | 12 files, **122 executed, 111 passed, 11 failed** — all 11 pre-existing; both other `useNxisasEngine` consumers (GDT scrape + GDT credential validation) pass, confirming no cross-consumer regression |
| `npx tsc --noEmit -p tsconfig.json` (piped through `grep -v '^\.next/'`) | **PASS** | no output — 0 errors in project sources |
| `npx eslint components/banking/own-account-transfer/` (whole folder) | **PASS** | 0 errors. One pre-existing warning (`emptyMessageKey` unused in `SourceAccountsTable.tsx`) in a file this change never touched — left alone per `feedback_preserve_existing_code` |
| `git status --short` / `git diff --stat` | **PASS** | exactly 3 modified source files (343 insertions(+), 12 deletions(-)) + 3 new test files + 4 documentation files; no stray, temporary, or generated files |

New test files (all three placed under `components/**`, where `vitest.config.ts` actually collects —
CLAUDE.md §14c include-glob trap; note the hook test sits in
`components/banking/own-account-transfer/hooks/`, which is inside `components/`, **not** the
uncollected top-level `hooks/`):

- `components/banking/own-account-transfer/bank-profiles.sessionReuse.test.ts` — 7 cases
- `components/banking/own-account-transfer/hooks/use-nxisas-engine.sessionReuse.test.tsx` — 5 cases
- `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.sessionLifecycle.test.ts` — 13 cases (added in the hardening pass; +2 for the closed-composer dimension)

### The 25 new cases and what each pins

| # | File | Case | Pins |
|---|---|---|---|
| 1 | bank-profiles | omits `nonLogin` when no session is alive | the engine must still LOGIN on a cold modal |
| 2 | bank-profiles | omits `nonLogin` when `reuseSession:false` | explicit-false is not truthy-coerced |
| 3 | bank-profiles | **sets `nonLogin:true` when a session is alive** | **the regression** — legacy `:2123-2125` |
| 4 | bank-profiles | `nonLogout:true` in every case | legacy `:2096` unchanged by the fix |
| 5 | bank-profiles | Woori VN keeps `nonLogin:false` by default | legacy `:2099-2102` |
| 6 | bank-profiles | session reuse applied **after** the Woori branch | legacy ordering `:2100` → `:2123` cannot be inverted |
| 7 | bank-profiles | cert / job payload unchanged when reusing | the fix touches session flags only |
| 8 | engine hook | `runScraping` → `callNxisas` | the opening entrypoint still opens |
| 9 | engine hook | **`runScrapingWithoutOpen` → `callNxisasWithoutOpenProcess`** | **the regression** — legacy `:77-83`, no second Open+LOGIN |
| 10 | engine hook | falls back to `callNxisas` when the vendor fn is absent | older bundle drops degrade, never throw |
| 11 | engine hook | `progress=true` + job callback forwarded on both runners | the vendor call signature is identical on both paths |
| 12 | engine hook | both runners reject when the bundle is absent | localhost / unlicensed origin behaviour preserved |
| 13 | session rule | keeps the session after `00000000` on all four session-keeping banks | reuse allowed only on a proven-alive session |
| 14–20 | session rule | releases after `80002F31`, `8000F110`, `80003230`, `80003275`, `LOGIN_CAN`, `99999999`, `""` | **the lockout-safety property** — a failure never leaves a session we would skip LOGIN on |
| 21 | session rule | releases when the engine reported no status (`null` / `undefined`) | unparseable payloads fail safe |
| 22 | session rule | never keeps a Woori VN session, even on success | Woori logs out (`:1612-1613`); legacy resets its engine (`:2196-2200`) |
| 23 | session rule | not fooled by `" 00000000"` / `"00000000 "` / `"0"` / `"000000000"` | exact match only — no trimming, no truthiness |
| 24 | session rule | **does NOT keep a session when the composer already closed** | a scrape resolving after close must not leave a session nothing logs out |
| 25 | session rule | closed composer stays false for every non-success code | the closed dimension composes with the status dimension |

## Regression Tests

**Regression test covers the original defect: YES.**

```
Test file:          components/banking/own-account-transfer/bank-profiles.sessionReuse.test.ts
Test case:          "sets nonLogin:true when a session is alive — no second LOGIN, no 80002F31"
Original failure protected: transfer after Update Balance built a LOGIN job into a live session

Test file:          components/banking/own-account-transfer/hooks/use-nxisas-engine.sessionReuse.test.tsx
Test case:          "runScrapingWithoutOpen uses callNxisasWithoutOpenProcess — no second Open+LOGIN"
Original failure protected: the 2nd..nth scrape re-ran CooconiSASNX.open + LOGIN
Result:             PASS after the fix, FAIL before it (both executed — see below)
```

### Fail-before / pass-after — actually executed

1. Backed the three fixed files up to the session scratchpad; md5 verified.
2. `git checkout --` restored them to `HEAD` (pre-fix), leaving the two new test files in place.
3. `npx vitest run <the two new test files>` →
   **2 files failed, 6 of 12 cases failed:**
   - `TypeError: result.current.runScrapingWithoutOpen is not a function` (4 hook cases; the one
     surviving hook case is the `runScraping → callNxisas` invariant, which already held)
   - `expected undefined to be true` on `nonLogin` for cases 3 and 6 (the builder had no
     `reuseSession` arg, so nothing could set the flag)
   - The other 4 builder cases passed pre-fix — they assert invariants the fix must **not**
     break (`nonLogout:true`, Woori default, payload untouched). That split is the intended
     shape: only the defect-specific assertions flip.
4. Restored the fixed files from the backup — md5 re-verified identical
   (`26eaa80a8583d5462867be59fca09fcf` for `bank-profiles.ts`).
5. Re-ran the full screen suite → **5 files, 72/72 PASS.** (That was the state *before* the
   lockout-driven hardening pass added the third test file; the final suite is **6 files, 83/83**,
   the top row of `## Automated Tests`.)

No git history was modified at any point (no stash, no commit, no branch change) — only
working-tree file contents, restored byte-for-byte.

## API Verification

**NOT APPLICABLE** — the change alters no request path, method, payload, or response handling.
The `/balance-refresh` and `/scraping-result` POST bodies are byte-identical to before; only
*when the engine logs in* changed, which is entirely browser-side. No backend record is paired.

## UI Verification

- Static review: **PASS** — no layout, token, copy, locale key, or dialog-variant change is in
  the diff. The `80002F31` error dialog itself is untouched; the fix removes the condition that
  raised it.
- Rendered/visual verification: **NOT RUN** — the engine cannot start on an unlicensed local
  origin, so the modal cannot reach the second scrape locally. Not claimed as verified.

## Database Verification

**NOT APPLICABLE** — no database dependency; no `.sql` added to this repository (CLAUDE.md
§12g). Audit rows written by the unchanged intakes are unaffected.

## Lockout-Risk Verification (bank 3-strike login block)

Raised by Sonny: Vietcom blocks the login after 3 failed attempts and only the Vietnam PO team
can reset it. Findings — each **verified in source**, not assumed:

| Check | Result | Evidence |
|---|---|---|
| Does the fix add any LOGIN? | **No — it removes them.** Reported flow: up to 3 failing LOGINs before, **0** after | `## Automated Tests` cases 3, 9 + the LOGIN-count table in the bug record |
| Automatic retry in the app? | **None** — every scrape is user-initiated | `grep` over all `runScraping` / `runScrapingWithoutOpen` call sites; no loop, no timer, no effect-driven scrape |
| Automatic LOGIN retry in the vendor bundle? | **None for banks** | `nxisas_v2.js:2001-2040` `run_afterLoginFail` counts, stores the result, and may open the 2nd-cert popup — it never re-executes LOGIN |
| Empty / missing credentials reaching the bank? | **Blocked pre-engine** | `hasSavedBankCert` pre-flight on both handlers (`:641`, `:998`), unchanged by this fix |
| Double-submit? | **Locked** | `submitting` (`:634`) / `updating` (`:980`) guards, unchanged |
| Engine probe / banner "try again"? | **No credentials** — license handshake only | `CooconiSASNX.open` payload is License + Uid + Action |
| Can the added LOGOUT lock anything? | **No** — sends no credentials; on a dead session the job simply fails and resolves | `runLogout` contract (best-effort, 10 s cap) |
| Can a LOGIN interleave with a LOGOUT? | **No** — a fresh-login attempt awaits any in-flight logout | `awaitPendingLogout()` before both non-reuse scrapes |
| Stale-session strand (present in the fix's own first version) | **Fixed** — any non-success releases the session | 13 cases in `OwnAccountTransferComposerDialog.sessionLifecycle.test.ts` |
| Session tracked behind a CLOSED modal (scrape finished after close) | **Fixed** — the rule now requires the composer to be open; the caller logs the bank out instead | cases 24–25, plus the walkthrough in the bug record |
| Close → re-open → Next (no Update Balance) | **1 LOGIN, no reuse of a stale session** — close logs out, re-open awaits that logout, then logs in cleanly | verified by source trace (all close paths + mount lifetime); SIT scenario FE-X11 |

**Blast radius:** Own Account Transfer only. `buildNxisasOrgObj` has no other consumer;
`useNxisasEngine`'s two other consumers (e-invoice scrape, GDT credential validation) are
**tax-authority** flows calling the unchanged `runScraping`; the Payment module references
`nxisas` only in comments and the debug logger and never mounts the engine; firm-banking bank
dispatch is server-side in `wecms-api`. Result: **PASS**.

## Security / Permission Verification

**PASS (review only).** No auth, authorization, permission-gating, or JWT change. Credential
exposure is reduced (one bank LOGIN per modal session instead of one per action, plus an
explicit LOGOUT on close). The new session ref holds a BANK_CD only — no credential, token, or
account number — is memory-only for one open dialog, and is never logged or persisted.
`releaseEngineSession()` logs nothing; `runLogout`'s existing catch is already sanitized.

## Performance / Concurrency Verification

**PASS (review only).** Strictly fewer engine round-trips per modal session (one Open + one
LOGIN instead of one per action). The existing `submitting` / `updating` locks still guard
double-submit and are unchanged. The session flag is a ref, so it triggers no re-render and
cannot race a React state update; it is written only after an engine call resolves.

## Existing Failures

`components/addon/sales-einvoices/useEInvoiceScrape.test.ts` — **11 failed**, from a stale
`vi.mock` factory (`decryptEInvoiceEngineData` not exported by the mocked module). This is the
failure CLAUDE.md §14j records as the known pre-existing category-B condition ("11 of 152 tests
fail … stale `vi.mock` factory"), and the count matches exactly. It fails identically with the
three fixed files reverted to `HEAD`, so it predates this work. **Not repaired here** — an
unrelated failure is recorded, not silently fixed inside another change
(`feedback_preserve_existing_code`).

## New Failures

**None.**

## Not Tested

| Check | Why |
|---|---|
| SIT / UAT manual verification | Deployment is manual and has not happened; pushing `sit` is a human release decision (CLAUDE.md §15). |
| Live Update Balance → Next on Vietcom | Requires a licensed NXiSAS origin + real corporate credentials. Local R&D origin is unlicensed. |
| Woori VN balance-then-transfer | Same engine constraint; also needs a Woori account with saved cert material. |
| Full `npm test` after the change | The targeted screen scope (72 tests) plus the 9-file baseline run were used; the remaining suites are untouched by a three-file, screen-scoped change. Recorded rather than implied. |

## Final Result

**PASS** (LOCAL scope, as defined above). Two defects in the *first* version of this fix were
found by the lockout review and corrected before hand-off — see `## Lockout-Risk Verification`
and the bug record's `## Lockout-risk review`.

## Recommendation

**READY FOR MANUAL COMMIT**, then **READY FOR SIT** — SIT verification of scenarios FE-X5 and
FE-B4 against a licensed engine origin is required before the defect can be called closed in a
real environment.
