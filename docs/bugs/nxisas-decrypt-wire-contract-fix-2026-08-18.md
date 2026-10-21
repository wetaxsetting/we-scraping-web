# NXiSAS Decrypt Wire Contract — Engine Payload Never Decrypted

**Date:** 2026-08-18
**Type:** BUG FIX | PARITY FIX
**Current Work Classification:** BUG
**Status:** READY FOR MANUAL COMMIT
**Repository:** wecms-web
**Issue:** —
**Audit evidence:** [update-balance-balance-required-audit-2026-08-18.md](../audits/update-balance-balance-required-audit-2026-08-18.md)
**Paired backend record:** `wecms-api/docs/bugs/nxisas-decrypt-wire-contract-fix-2026-08-18.md`

## Problem

On Banking → Internal Transfer (Own Account Transfer), the NXiSAS engine returns
`Output.Result` as Coocon SEED-CBC **ciphertext** — always, even on `ErrorCode == "00000000"`.
Nothing in the refactor decrypts it, so:

- **Update Balance** fails with "Balance is required." (`Result.balance[0]` is unreachable).
- A **successful transfer** records the composed values instead of the bank-echoed ones
  (`Result.transfer[0]` is equally unreachable).

Root cause is fully traced in the audit: the `/nxisas/decrypt` round-trip is broken by an
UPPER_SNAKE-vs-snake_case wire mismatch in **both** directions, and the server-side decrypt is
additionally behind a flag that is off by default and set nowhere.

## Current Behavior

| | Frontend sends / reads | Backend Java component | Wire name the backend uses | Match |
|---|---|---|---|---|
| request | `NXISAS_DATA`, `NXISAS_UID`, `NXISAS_ACTION` (`lib/api/banking.ts:1438-1440`) | `NxisasDecryptRequest(String NXISAS_DATA, …)` | `nxisas_data`, … | ❌ |
| response | reads `res.NXISAS_DATA` (`banking.ts:1444`) | `NxisasDecryptResponse(String NXISAS_DATA)` | `nxisas_data` | ❌ |

Observed on SIT: `{"status":{…"WBI0000"…},"data":{"nxisas_data":null}}` — the request field never
bound, so the endpoint echoed `null`, and the frontend's `res?.NXISAS_DATA` was `undefined`
anyway, falling back to the still-encrypted payload.

## Expected Behavior

Legacy `nxisas_v2.js:2350-2355` decrypts **by default** (the guard fires when `nonDecrypt` is
`undefined`) and **before** the success/fail dispatch, so every consumer reads a plain object.
`nxisas_v2.js:1684-1704` posts the whole job array as `NXISAS_DATA` and replaces `res` with
`JSON.parse(rData.NXISAS_DATA)`.

The refactor keeps that **semantic** contract — send the whole engine array, get the decrypted
array back, replace it before parsing — and fixes only the JSON key names plus the flag.

## Scope

1. `decryptNxisasResult` sends / reads `nxisas_data` · `nxisas_uid` · `nxisas_action`.
2. `readNumber` parses dot-grouped amounts and stops mapping `""` to `0`.
3. Legacy-parity diagnostics: log the engine payload before parsing, as legacy does.
4. Contract test pinning the request/response key names.

`nonDecrypt` stays **unset** — that is what legacy does on this screen.

## Out of Scope

- Any change to the vendor bundle (`nxisas_v2.js`).
- e-Invoice / GDT paths — already correct.
- The Tax Filing XLSX exception, unrelated.

## Initial Investigation

Complete — see the audit's `## Findings` F1–F10. Key citations:
`nxisas_v2.js:1684-1704` (decrypt contract) · `:2345-2355` / `:2373-2383` (decrypt-by-default,
before dispatch) · `trns_0001_007.ts:1645-1656` (balance read) · `:2156-2172` (transfer read) ·
`JacksonConfig:25` (global `SNAKE_CASE`) · `SeedCbcDecryptService:99-140` (walker already correct).

## Root Cause

Legacy's UPPER_SNAKE key names were copied into a framework that renames every field via
`PropertyNamingStrategies.SNAKE_CASE`, with no `@JsonProperty` to pin them. Spring Boot ignores
unknown properties by default, so the mismatch failed silently with an HTTP 200.

## Implementation

Verified first (it settled which side owns each key):

- `public/nxisas/js/nxisas_v2.js` — the refactor ships its own bundle copy, which calls
  `_v2nxisas.nxisas_decrypt(res)` at `:2329` / `:2357`.
- `lib/nxisas/jexjs-adapter.ts:428` short-circuits `nxisas_decrypt` / `nxisas_encrypt` to a synchronous
  client-side pass-through, because the bundle calls them with `async: false`. So the bundle never
  reaches the Spring endpoint, and `decryptNxisasResult` is the **only** real caller — which is what
  made renaming its keys to the project convention safe rather than a vendor-contract break.
- The adapter pass-through keeps reading the bundle UPPER key and was left alone: those are the
  **bundle** keys, not ours.

Implemented:

1. **`decryptNxisasResult` wire keys** (`lib/api/banking.ts`) — sends `nxisas_data` / `nxisas_uid` /
   `nxisas_action` and reads `res.nxisas_data`. The stale "with the backend flag OFF the endpoint echoes
   the input unchanged, so this is behaviour-neutral" paragraph was removed; that flag no longer exists.
2. **`readNumber`** (`OwnAccountTransferComposerDialog.tsx`) — delegates the string case to
   `parseEngineAmount` instead of its own digit-strip-and-Number call. Two behaviours change: a
   dot-grouped amount now parses (it produced NaN before), and a blank string now returns null instead
   of 0, so an absent balance is no longer indistinguishable from a real zero balance.
3. **`parseEngineAmount` all-zero-tail regex** — narrowed so the tail must be 1-2 digits.
   **Not in the approved list — found while writing the tests for item 2**, recorded under
   "Additional defect" below.
4. **Diagnostics** — `decryptNxisasResult` now logs the decrypted payload before returning (mirroring
   legacy `nxisas_v2.js:2345` and `trns_0001_007.ts:1642`), and every best-effort fallback warns with a
   reason: no engine session, an empty response payload, or a thrown error. Previously all three returned
   the raw payload from a bare catch block with no trace at all — which is precisely why a broken decrypt
   looked like a missing balance rather than a failed decrypt.
5. **`parseBalanceOutcome` + `BalanceOutcome` exported** for testability, matching the existing
   convention in that file (`parseEngineOutcome`, `getScrapingMessage`, `resolveTransferErrorMessage`,
   `resolveBalanceErrorMessage` are already exported for their tests).

`nonDecrypt` stays unset — that is what legacy does on this screen.

### Additional defect found during implementation — `parseEngineAmount`

The two comma-grouped assertions added for item 2 **failed on first run**: `"1,200,000"` parsed as
`1200` and `"1.500.000"` as `1500`.

Cause: the all-zero *fractional* tail strip also matched the final **thousands group** of any grouped
amount ending in zeros. `"1,200,000"` → strip `,000` → `"1,200"` → strip separators → `1200`.

This is materially worse than the balance bug it was found next to, because `parseEngineAmount` also
produces `actual_amt` on the transfer path: a genuine 1,500,000 VND transfer would have been recorded as
`actual_amt = 1500`, understating an executed payment by 1000x while every validation passed. A 3-digit
trailing group is grouping and can never be a fraction, so the tail must be 1-2 digits to qualify.

Fixed in the same change with a dedicated regression case, since leaving a known 1000x amount error in
place to preserve scope discipline would be the wrong call.

## Files Changed

| File | Change |
|---|---|
| `lib/api/banking.ts` | `decryptNxisasResult` — lowercase wire keys both directions; empty-session guard; payload log; warning on every fallback; stale flag paragraph removed |
| `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx` | `readNumber` delegates to `parseEngineAmount`; `parseEngineAmount` tail regex narrowed; `parseBalanceOutcome` + `BalanceOutcome` exported |
| `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.balanceParse.test.ts` | **new** — 7 balance-read regression tests |
| `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.engineOutcome.test.ts` | +1 case pinning the grouped-thousands fix on the `actual_amt` path |

## API Impact

`POST /api/v1/banking/own-account-transfer/nxisas/decrypt` — request body keys and the response key this
app reads change from the UPPER form to `nxisas_data` / `nxisas_uid` / `nxisas_action`. The paired
backend change ships in the same MR; neither side works without the other. No other endpoint this app
calls changes.

## UI Impact

No layout, component, token, or string change. Behavioural, once the round-trip works:

- **Update Balance** stops failing with "Balance is required." — `Result.balance[0]` becomes reachable.
- **A successful transfer** records the bank-echoed values (remit amount, fee, memo, accept name)
  instead of composed fallbacks, because `Result.transfer[0]` becomes reachable.
- **A grouped amount is no longer mis-parsed**, so a 1,500,000 VND transfer records as 1500000.

**Not visually verified** — see the test-result record; the browser UI was not run.

## Database Impact

NONE (frontend) — database dependency only.

Database dependency: see the paired backend record
[wecms-api/docs/bugs/nxisas-decrypt-wire-contract-fix-2026-08-18.md](../../../wecms-api/docs/bugs/nxisas-decrypt-wire-contract-fix-2026-08-18.md)
— it confirms no schema change, no migration, and no manual DBA script are required on either side. No
SQL file was added to this repository.

## Integration Impact

The NXiSAS engine contract is unchanged. The `/nxisas/decrypt` **wire** contract changes (key names) —
both ends ship together.

## Verification

Summary — full detail in the test-result record linked below.

### Automated Tests

- Test: `npx vitest run components/banking/own-account-transfer`
- Result: **PASS** — 60 tests, 3 files, 0 failures
- Test: `npx tsc --noEmit` and `npx eslint` on the changed paths
- Result: **PASS** — 0 type errors; 0 lint errors (1 pre-existing unrelated warning)
- Test: `npm test` (full suite)
- Result: **PARTIAL** — 201/212 pass; the 11 failures are pre-existing in
  `components/addon/sales-einvoices/useEInvoiceScrape.test.ts` and were confirmed to fail identically on
  the unmodified baseline (changes stashed). Category B per CLAUDE.md §14j.

### Regression Test

Test file:          `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.balanceParse.test.ts`
Test cases:         `parses id-ID dot-grouped amounts (the VND wire format)` · `treats a blank string as absent, not as zero` · `reports the balance as absent when Output.Result is still ciphertext`
Behavior protected: the Update Balance read path — grouped-amount parsing, blank-vs-zero, and the still-encrypted case

Plus `engineOutcome.test.ts` → `keeps a trailing zero thousands-group` for the `actual_amt` path. The
`parseEngineAmount` fix was red-checked by construction: its assertions failed before the fix and pass
after, and all 45 pre-existing `engineOutcome` cases still pass.

The wire-key rename itself has **no** frontend regression test — pinning the literal Axios request body
would assert a call shape, not a behaviour. It is pinned on the backend instead, by
`NxisasWireContractTest` (5 cases, red-checked), which is the side that decides the binding.

### Regression Review

- Areas checked: the adapter pass-through (still reads the bundle UPPER keys — unchanged);
  the 45 existing `parseEngineOutcome` cases (all still pass, so the regex narrowing did not disturb the
  decimal-tail behaviour); the e-Invoice scrape path, which shares
  `own-account-transfer/hooks/use-nxisas-engine` but neither changed file.
- Result: no regression found. The 11 pre-existing failures are unchanged in count and cause.

### Manual Verification

- Environment: LOCAL
- Steps: typecheck, lint, targeted suite, full suite, baseline-stash comparison for the pre-existing
  failures
- Result: **PASS** for what is testable here. UI and SIT verification are **NOT RUN**.

## Test Evidence

Test result:
[NXiSAS Decrypt Wire Contract — Test Result](../testing/results/nxisas-decrypt-wire-contract-test-result-2026-08-18.md)

Final test result:    PASS
Regression coverage:  PASS (8 new/changed cases; the amount fix was red-checked by construction)

## Result

The engine payload now completes a real decrypt round-trip, so both `Result.balance[0]` and
`Result.transfer[0]` are reachable — the semantic contract legacy always had. Two amount-parsing defects
on the same read path are fixed, one of which was silently understating executed transfer amounts by
1000x whenever the amount ended in a zero thousands group.

The silent catch block that concealed all of this now logs, so the next failure on this path is visible
in a browser console rather than presenting as a missing balance.

## Known Limitations / Follow-up

1. **Not verified in a browser, and not verified on SIT.** The symptom was observed on
   `wecms.kosign.dev`; confirming the fix there requires a manual deploy, and pushing `sit` deploys. No
   visual verification is claimed.
2. **A non-zero decimal fraction is still mishandled** by `parseEngineAmount` — `"1234.56"` parses as
   `123456`. Pre-existing and out of scope here (the intake DTO constrains these fields to VND integer
   digits, and no observed engine payload carries a non-zero fraction), but it is a real latent 100x
   error if a currency with a minor unit ever reaches this path. Worth a scoped decision rather than a
   silent assumption.
3. **The console diagnostics log the decrypted engine payload** — balance and transfer figures — to the
   browser console, matching what legacy already does. No cipher key, UID, or action value is logged. If
   that is judged too much for a deployed environment, gate it behind a debug flag; do not simply delete
   it and restore the silent failure mode.
4. **The 11 pre-existing `useEInvoiceScrape` failures are still failing.** Not repaired here — fixing an
   unrelated failing test inside this MR would widen scope. Already tracked in CLAUDE.md §14j.
5. **SIT will keep showing "Balance is required." until this is deployed.** SIT runs commit `1947524`,
   which contains the legacy-parity balance gate but not the decrypt fix — the exact combination that
   surfaces the dialog. Confirmed 2026-08-18: `WBE6021` exists **only** in the frontend locale files
   (extracted from legacy `CD_WBE6021.xml`); it is absent from the backend entirely, so no Spring
   validation is involved and the POST is never sent. Full trace: the audit's
   [Addendum F11-F14](../audits/update-balance-balance-required-audit-2026-08-18.md). The gate itself is
   correct and is **not** changed by this MR — a null balance must not be persisted.
