# NXiSAS Decrypt Wire Contract — Test Result

**Date:** 2026-08-18
**Type:** TEST RESULT
**Status:** PASS
**Repository:** wecms-web
**Related Record:** [nxisas-decrypt-wire-contract-fix-2026-08-18.md](../../bugs/nxisas-decrypt-wire-contract-fix-2026-08-18.md)
**Issue:** —

## Scope

Frontend half of the `/nxisas/*` wire-contract fix:

1. `decryptNxisasResult` sends / reads `nxisas_data` · `nxisas_uid` · `nxisas_action`.
2. `readNumber` delegates to `parseEngineAmount` (dot-grouped amounts parse; `""` no longer becomes `0`).
3. `parseEngineAmount`'s all-zero-tail strip narrowed from `/[.,]0+$/` to `/[.,]0{1,2}$/` — a bug found
   **during** this change, not part of the approved list (see below).
4. Legacy-parity diagnostics: the decrypted engine payload is logged before parsing, and every
   best-effort fallback now warns instead of failing silently.

## Environment

LOCAL only. No SIT/UAT execution — the change is not deployed and pushing `sit`/`uat` deploys.

## Code / Build Under Test

- Branch: current working tree
- Commit: **NOT COMMITTED** (work stops at `READY FOR MANUAL COMMIT`)
- Build: Vitest 3 via `npm test` / `npx vitest run`, plus `npx tsc --noEmit` and `npx eslint`
- API URL/environment: none — pure unit tests, no running backend

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx tsc --noEmit` | PASS | 0 errors (`.next/` noise filtered per `reference_next_dev_types_build_conflict`) |
| `npx eslint lib/api/banking.ts components/banking/own-account-transfer/` | PASS | 0 errors, 1 pre-existing warning (`SourceAccountsTable.tsx:86` unused `emptyMessageKey` — untouched by this MR) |
| `npx vitest run components/banking/own-account-transfer` | PASS | **60 tests, 3 files, 0 failures** |
| `npm test` (full suite) | **PARTIAL — see Existing Failures** | 212 tests: 201 passed, 11 failed (all pre-existing, one unrelated file) |

### New / changed tests

| File | Tests | Pins |
|---|---|---|
| `OwnAccountTransferComposerDialog.balanceParse.test.ts` (**new**) | 7 | dot-grouped / comma-grouped / decimal-tail / numeric balance formats; blank ≠ zero; key fall-through; **and that a still-encrypted `Output.Result` reads as `bal: null`**, which is what makes the "Balance is required." refusal correct rather than a persisted wrong number |
| `OwnAccountTransferComposerDialog.engineOutcome.test.ts` (**+1 case**) | 45 → 46 in-file (60 total incl. locales) | `keeps a trailing zero thousands-group` — `"1,200,000"` → `1200000`, `"1.500.000"` → `1500000`, `"1.000"` → `1000`, while `"1500000,00"` / `"1500000.0"` still drop the decimal tail |

`parseBalanceOutcome` and its `BalanceOutcome` type were exported for testability, matching the
existing pattern in that file (`parseEngineOutcome`, `getScrapingMessage`, … are already exported for
their tests). Both new test files sit under `components/`, so Vitest's include globs collect them
(the `hooks/`-folder trap in CLAUDE.md §14c was avoided).

## Regression Tests

**Did a regression test cover the original defect? YES — for the parsing defects.**

- Test file: `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.balanceParse.test.ts`
- Test cases: `parses id-ID dot-grouped amounts (the VND wire format)`,
  `treats a blank string as absent, not as zero`,
  `reports the balance as absent when Output.Result is still ciphertext`
- Behaviour protected: the Update Balance read path — grouped-amount parsing, blank-vs-zero, and the
  ciphertext case.

Plus `engineOutcome.test.ts` → `keeps a trailing zero thousands-group` for the `actual_amt` path.

**Red-check performed on the `parseEngineAmount` bug.** It was not hypothesised — the two new
comma-grouped assertions **failed on first run** (`expected 1200 to be 1200000`,
`expected 1500 to be 1500000`), which is how the bug was found. After narrowing the regex the same
assertions pass and all 45 pre-existing `engineOutcome` cases still pass, so the narrowing did not
regress the decimal-tail behaviour they cover.

**No regression test for the wire-key rename itself** on this side. Reason: `decryptNxisasResult`'s
only observable behaviour without a server is its best-effort fallback, and asserting the literal
request body would pin an Axios call shape rather than a behaviour. The key names are pinned on the
**backend** side instead, by `NxisasWireContractTest` (5 cases, red-checked) — which is where a
mismatch would actually be caught, since that is the side that decides the binding.

## API Verification

- Request body keys and the response key read by `decryptNxisasResult` were changed to match the
  backend contract; both ends ship in the same MR.
- 401 handling, envelope unwrapping, and the shared `unwrap()` path are unchanged.
- **Live request verification: NOT RUN** — no running backend + licensed NXiSAS engine available.

## UI Verification

**NOT RUN.** The browser UI was not started, so no visual or interactive verification is claimed. The
user-visible outcome (Update Balance succeeding instead of showing "Balance is required.") is a
consequence of the decrypt round-trip working, which requires a deployed backend and a licensed engine
origin — it cannot be observed from this repository.

## Database Verification

NONE (frontend) — database dependency only, and no DB change on either side. The paired backend record
owns the decrypt behaviour: [wecms-api/docs/bugs/nxisas-decrypt-wire-contract-fix-2026-08-18.md](../../../../wecms-api/docs/bugs/nxisas-decrypt-wire-contract-fix-2026-08-18.md).
No `.sql` file was added to this repository.

## Existing Failures

**11 failures in `components/addon/sales-einvoices/useEInvoiceScrape.test.ts` — pre-existing,
unrelated, category B** per CLAUDE.md §14j.

Evidence they predate this work: the two changed source files were stashed
(`git stash push -- lib/api/banking.ts components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx`)
and that file was re-run on the unmodified baseline → **11 of 11 still failed**. The cause is the
documented stale `vi.mock` factory for `@/components/banking/own-account-transfer/hooks/use-nxisas-engine`
— a file this MR does not touch. Not repaired here: fixing an unrelated failing test inside this MR
would widen scope against `feedback_preserve_existing_code`.

CLAUDE.md §14j records this as "11 of 152 tests"; the suite has since grown, so the count is now
11 of 212. The failing set is unchanged.

## New Failures

None.

## Not Tested

- **UI / visual behaviour** — NOT RUN (see UI Verification).
- **SIT verification** — NOT RUN; deployment is manual and has not happened.
- **Localization** — NOT APPLICABLE; no user-facing string was added or changed.

## Final Result

PASS (with the documented pre-existing failures listed above)

## Recommendation

READY FOR MANUAL COMMIT — must ship together with the backend change; the wire contract moves on both
sides at once.
