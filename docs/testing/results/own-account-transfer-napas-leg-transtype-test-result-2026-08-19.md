# Own Account Transfer — NAPAS-Leg `transType` Fix — Test Result

**Date:** 2026-08-19
**Type:** TEST RESULT
**Status:** PARTIAL
**Repository:** wecms-web
**Related Record:** [Own Account Transfer — Cross-Bank Leg Sent a Blank `transType` (80010222)](../../bugs/own-account-transfer-napas-leg-transtype-2026-08-19.md)
**Issue:** —

## Scope

Verifies the six corrected `transType` values on the cross-bank leg of every bank profile in
`components/banking/own-account-transfer/bank-profiles.ts`, and confirms the same-bank leg
behaviour is unchanged for all six.

`Status: PARTIAL` rather than `PASS`: the automated layer is fully green, but the engine-level
confirmation that `transType: "2"` clears error `80010222` **has not been performed** — it needs
the licensed NXiSAS engine plus live bank credentials.

## Environment

LOCAL only. No SIT/UAT verification was performed and none is claimed.

## Code / Build Under Test

- Branch: (working tree, not committed)
- Commit: **NOT COMMITTED** — the change is at `READY FOR MANUAL COMMIT` per CLAUDE.md §15
- API URL/environment: not exercised — this change never reaches `wecms-api`
- Node/test runner: Vitest 2.1.9

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/banking/own-account-transfer` | **PASS** | 8 files passed, **105 tests passed**, 0 failed (92 pre-existing + 13 new) |
| `components/banking/own-account-transfer/bank-profiles.transType.test.ts` | **PASS** | 13 tests passed |
| `npx tsc --noEmit` | **PASS for this change** | 0 errors in `bank-profiles.ts` or the new test file; 2 pre-existing errors elsewhere — see `## Existing Failures` |

New test file is at `components/banking/own-account-transfer/…`, inside Vitest's `components/**`
include glob — it is actually collected, not silently skipped (CLAUDE.md §14c include-glob trap).

## Regression Tests

**Did a regression test cover the original defect? YES**

```
Test file:                        components/banking/own-account-transfer/bank-profiles.transType.test.ts
Test case:                        'sends transType "2" (타행이체) on the cross-bank leg — %s'
                                  (parameterised over shinhan, ibk, vietcom, vietin, woori, fallback)
Original failure reproduced:      YES — executed, see below
Result:                           PASS
```

**Fail-before / pass-after was executed, not assumed:**

1. With the fix in place: `npx vitest run components/banking/own-account-transfer/bank-profiles.transType.test.ts`
   → **13 passed**.
2. All six values reverted in place to their pre-fix form (`internal ? "1" : ""`, and Vietcom's
   `internal ? "" : ""`); values re-read from the file to confirm the revert applied.
3. Same command re-run → **1 test file failed**. The test genuinely detects the defect.
4. Values restored; `npx vitest run components/banking/own-account-transfer` → **8 files passed**.

> Recorded because a first attempt at step 2 was a **no-op**: the `sed` targeted line 293, but the
> earlier comment edits had shifted the line numbers, so the "failing" run actually tested the
> already-fixed file and passed. The line numbers were re-derived from the file and the sequence
> re-run properly. Cited so the executed-verification claim above is auditable rather than
> assumed.

Additional coverage in the same file, guarding the fix against over-reach:

| Case | Asserts |
|---|---|
| `keeps transType "1" on the same-bank leg` (shinhan, ibk, woori, fallback) | same-bank leg untouched |
| `keeps Vietcom's same-bank "" override` | `trns_0001_007.ts:2055` behaviour preserved |
| `keeps Vietin's same-bank transType deletion` | `Job=TRANSFER_INTERNAL_ML`, `transType` undefined, `feePaymentType="2"`, `remitBankCode=""` |
| `still sends the NAPAS bank code alongside transType 2` | `remitBankCode` not collaterally blanked |

## API Verification

**NOT APPLICABLE** — no endpoint, request shape, or response shape changed. The corrected value
travels to the local NXiSAS engine, never to `wecms-api`.

## UI Verification

**NOT RUN** — the change alters an engine payload constant, not rendered output. No visual
surface changed, so no visual verification is claimed.

## Database Verification

**NOT APPLICABLE** — no database dependency. `NAPAS_REMIT_TRNS_HSTR.TRANS_TYPE` was already
written correctly by `OwnAccountTransferService` (`SAME_BANK ? "1" : "2"`), independently of the
engine payload. No `.sql` exists in this repository (CLAUDE.md §12g).

## Legacy Parity Verification

Four-way comparison per CLAUDE.md §14n:

| | Value |
|---|---|
| **Legacy JEX behaviour (runtime)** | `transType = "2"` on every cross-bank leg — `trns_0001_007.ts:2056` is an assignment, always truthy, so the `else { transType = "" }` at `:2058-2059` is dead code |
| **Refactor behaviour BEFORE** | `transType = ""` on the cross-bank leg in all six profiles |
| **Target parity behaviour** | `"2"` cross-bank; same-bank unchanged (`"1"`, `""` for Vietcom, deleted for Vietin) |
| **Final implemented behaviour** | matches target; asserted by 13 automated cases |

Evidence compared: `TransType.java:33-34` (`"2"` = 타행이체); `trns_0001_001.ts:1399-1410`
(`2 : Other Bank`, `remitBankCode` `//* required when transType = 2`);
`trns_0002_001_c001_act.jsp` (`TYPE_2 ⇒ IN_NAPAS_BANK_CODE` required); legacy UAT
`napas_remit_trns_hstr` — **20/20 successful cross-bank rows carry `TRANS_TYPE='2'`, 0 carry
`''`**, including 4 Vietin `11704001` and 2 Vietcom `11704004` rows.

## Security / Permission Verification

**NOT APPLICABLE** — no auth, permission, role, token, or sensitive-data surface touched.

## Performance / Concurrency Verification

**NOT APPLICABLE** — one string constant per payload; no new request, retry, or fan-out.

## Existing Failures

| Failure | Category | Evidence it predates this work |
|---|---|---|
| `npx tsc --noEmit` → 2 × TS2551 in `OwnAccountTransferComposerDialog.locales.test.ts:92,93` — `Property 'own_account_transfer.composer.error.engine_80002411' does not exist` | **B — pre-existing** | Missing locale key in an unrelated test file; not in this diff, which touches only `bank-profiles.ts` and the new test file. Not repaired here per `feedback_preserve_existing_code`. |

The suite-wide pre-existing failure noted in CLAUDE.md §14j (11 tests in
`useEInvoiceScrape.test.ts`) was not exercised — the run was scoped to
`components/banking/own-account-transfer`.

## New Failures

**None.** No test regressed.

## Not Tested

| Check | Why |
|---|---|
| Engine acceptance of `transType: "2"` (does 80010222 clear?) | Requires the licensed NXiSAS engine + live bank credentials, unavailable in this environment. **This is the decisive check** — retry a Vietin → Vietcombank transfer. |
| Full-suite `npm test` | Scoped run only; the change has no consumer outside this folder (repo-wide search found no other `transType` reader). |
| `feePaymentType` parity on Vietin's cross-bank leg | Deliberately deferred so the retest changes one variable — see the implementation record's `## Known Limitations` item 1. |

## Final Result

**PARTIAL** — automated + parity layers PASS; engine-level confirmation NOT RUN.

## Recommendation

**READY FOR MANUAL COMMIT**, then retry the failing transfer to confirm the engine accepts the
payload.

If `80010222` persists after the retry, the next suspect is `feePaymentType` (known-limitation 1
in the implementation record): legacy sends it on Vietin's cross-bank leg, the refactor deletes
it. If a *different* engine error appears, that is progress — the CITAD/branch route was escaped
and the new code should be diagnosed on its own terms.
