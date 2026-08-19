# Own Account Transfer — Per-Account Credential Gate — Test Result

**Date:** 2026-08-19
**Type:** TEST RESULT
**Status:** PASS
**Repository:** wecms-web
**Related Record:** [Own Account Transfer — Transfer-Button Credential Gate Is Bank-Level; Legacy Gates Per Account](../../bugs/own-account-transfer-credential-gate-per-account-parity-2026-08-19.md)
**Issue:** —

## Scope

Verification that the source-table Transfer gate resolves credentials **per account**
(`rowHasCredentials(row)` → `hasSavedBankCert(row)`) instead of the previous bank-level
`Set<BANK_CD>`, matching legacy's per-row `_v2nxisas.getCertInfo(BANK_CERT_SEQ)`
(`trns_0001_007.ts:1561-1584`, `:1896-1924`).

## Environment

LOCAL only. **SIT / UAT not exercised** — deployment is manual and has not happened.

## Code / Build Under Test

- Branch: `wecms-ui-fixes`
- Commit: **NOT COMMITTED** — working tree
- Build/artifact: Vitest 2.1.9 (jsdom) + `@testing-library/react`, TypeScript `tsc --noEmit`, ESLint 9
- API URL/environment: not used — the table renders from props; no HTTP

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/banking/own-account-transfer/SourceAccountsTable.credentialGate.test.tsx` | **PASS** | 1 file, **7 executed, 7 passed, 0 failed** |
| `npx vitest run components/banking/own-account-transfer components/banking/internal-transfer` | **PASS** | 8 files, **99 executed, 99 passed, 0 failed** — both screens touched this session |
| `npx tsc --noEmit -p tsconfig.json` | **PASS for this change** | no new errors. The 2 pre-existing `OwnAccountTransferComposerDialog.locales.test.ts:92-93` errors remain (documented in the tooltip fix's test result) |
| `npx eslint components/banking/own-account-transfer/` | **PASS** | 0 errors. 1 pre-existing warning (`emptyMessageKey` unused in `SourceAccountsTable.tsx`) — untouched per `feedback_preserve_existing_code` |
| `git diff --stat` | **PASS** | 3 modified source files (42 insertions(+), 28 deletions(-)) + 1 new test; no stray files |

### The 7 cases and what each pins

| # | Case | Pins |
|---|---|---|
| 1 | enables Transfer on a row that resolves its own cert | the happy path still works |
| 2 | disables Transfer when the row's seq points at a deleted credential | the reported Shinhan state (`bank_cert_seq` set, all cert fields null) |
| 3 | **gates per account, not per bank — same bank, mixed linkage** | **the regression** — under the old Set, the linked row enabled *both* buttons |
| 4 | tooltip appears on the ungated row only | the message follows the row, not the bank |
| 5 | never fires `onTransfer` from a disabled row | the disabled button cannot open the composer |
| 6 | all rows disabled when the whole bank lost its credential | fully-unlinked behaviour unchanged (the audited case) |
| 7 | permission gate stays independent | `canTransfer:false` disables **without** claiming missing credentials |

## Regression Tests

**Did a regression test cover the original defect? YES.**

```
Test file:          components/banking/own-account-transfer/SourceAccountsTable.credentialGate.test.tsx
Test case:          "gates PER ACCOUNT, not per bank — same bank, mixed linkage"
Original failure protected: a bank-level Set enabled Transfer on accounts that resolve no
                    credential, deferring the failure to the composer's pre-flight
Result:             PASS after the fix, FAIL before it (executed)
```

### Fail-before / pass-after — actually executed

1. Backed up the three modified files to the session scratchpad.
2. `git checkout --` restored them to `HEAD` (pre-fix) with the new test in place.
3. `npx vitest run …SourceAccountsTable.credentialGate.test.tsx` → **1 file failed, 7 of 7 failed**
   (the pre-fix component takes `banksWithCredentials: Set<string>`, so the new
   `rowHasCredentials` prop is ignored and no row gates correctly).
4. Restored the fixed files → **7/7 PASS**, and the two-screen run → **99/99**.

No git history was modified — working-tree contents only.

## Test Scenarios

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| Partially-linked bank (1 linked + 1 dangling account) | only the linked row's Transfer is enabled | as expected | **PASS** (jsdom) |
| Fully-unlinked bank (the audited Shinhan case, 4 rows) | all four disabled + tooltip | as expected | **PASS** |
| Rendered pixels / real data on SIT | same states against the live source list | **not run** | **NOT RUN** — see `## Not Tested` |

## API Verification

**NOT APPLICABLE** — no request or response change. `bank_cert_seq` / `cert_info_con` /
`cert_info_detl_con` already ship on `/source-accounts`; only which of them the row gate reads
changed.

## UI Verification

- Static review: **PASS** — no layout, token, or copy change; the disabled state and tooltip are
  the existing ones. Behaviour changes only for a partially-linked bank.
- Rendered/visual verification: **NOT RUN** — the app was not started for this change.

## Database Verification

**NOT APPLICABLE** — no database dependency; no `.sql` added (CLAUDE.md §12g).

The two DB-side follow-ups (clearing `ACCT_MSTR.BANK_CERT_SEQ` on credential delete; the `bank_cd`
guard on cert resolution) were **not implemented at the time this result was written**, and they are
not part of what it verifies. **Both were subsequently approved and implemented in `wecms-api` on the
same day** — backend record
`wecms-api/docs/bugs/bank-credential-delete-leaves-dangling-acct-linkage-2026-08-19.md`, backend
evidence `wecms-api/docs/testing/results/bank-credential-delete-dangling-linkage-test-result-2026-08-19.md`.
That backend work still involves **no `.sql` and no schema change** (it is a data-behaviour change
issued by the application inside the delete transaction), so this section stays NOT APPLICABLE for
this repository.

## Security / Permission Verification

**PASS.** The permission gate (`canTransfer`, from the backend's W-grant check) is untouched and is
verified independent of credentials by case 7. The change only ever *removes* the ability to open the
composer for an account whose credential does not resolve — it cannot enable a row that was
previously blocked by permission. Fewer engine invocations, so no new credential exposure.

## Existing Failures

- `OwnAccountTransferComposerDialog.locales.test.ts:92-93` — 2 **pre-existing** `tsc` errors
  (deliberate `ko[key]` / `vi[key]` indexing; the test passes at runtime). Predates this change;
  full explanation in
  [the tooltip fix's test result](./transfer-history-results-tooltip-test-result-2026-08-19.md)
  § Existing Failures.
- `SourceAccountsTable.tsx:90` — 1 **pre-existing** ESLint warning (`emptyMessageKey` unused).

## New Failures

**None.**

## Not Tested

| Check | Why |
|---|---|
| SIT / UAT | Deployment is manual and has not happened (CLAUDE.md §15). |
| Live partially-linked bank | Needs a tenant where one account of a bank is linked and another is not; the reported tenant has all four Shinhan accounts on the same stale seq. Covered by scenario FE-P6 for the SIT pass. |
| Rendered appearance | App not started; no styling changed. |

## Final Result

**PASS** (LOCAL scope, as defined above).

## Recommendation

**READY FOR MANUAL COMMIT**, then **READY FOR SIT** for scenarios FE-P5 / FE-P6. The user-visible
cure for the reported Shinhan rows is a **data** action, not this code change: re-run
Settings → Login Credentials → Shinhan → Select Bank Accounts.
