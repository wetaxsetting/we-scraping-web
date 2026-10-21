# Vietcom Guard Message + Credential Type Column — Test Result

**Date:** 2026-08-27
**Type:** TEST RESULT
**Status:** PASS
**Repository:** wecms-web
**Related Record:** [own-account-transfer-vietcom-guard-message-2026-08-27.md](../../bugs/own-account-transfer-vietcom-guard-message-2026-08-27.md)

## Scope

1. Reworded the three Vietcom guard messages (tooltip + 2 composer errors) in en / ko / vi.
2. Added a credential **Type** column to the Registered Login Credentials dialog, sourced from the
   existing `login_type` wire field.

No change to the guard predicate, the API, or the database.

## Environment

LOCAL only. Node 20.15.0, vitest 2.1.9.
SIT / UAT verification: **NOT RUN** — deployment is manual and has not happened for this change.

## Code / Build Under Test

Branch: `wecms-ui-fixes` · Commit: **NOT COMMITTED** at time of writing · Build: local vitest/tsc.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/banking components/shared/popups components/settings` | **PASS** | 17 files, 227 tests passed, 0 failed |
| `npx vitest run components/banking/own-account-transfer …` (guard predicate unchanged) | **PASS** | 13 files, 182 tests — incl. `bank-profiles.transferSupport.test.ts` 15/15 |
| `npx tsc --noEmit` | **PASS for this change** | only the 2 pre-existing `engine_80002411` errors remain (see Existing Failures) |
| Locale JSON parse — en / ko / vi | **PASS** | all three parse after edit |

## Regression Tests

New file: `components/shared/popups/RegisteredLoginCredentialsDialog.loginType.test.tsx` (3 tests).

**Did a regression test cover the original defect? YES — for the Type column.**

- Test file: `components/shared/popups/RegisteredLoginCredentialsDialog.loginType.test.tsx`
- Behavior protected: the credential sub-type is rendered, so two same-bank credentials are
  distinguishable; a null/blank sub-type degrades to an em-dash rather than collapsing the column;
  the header key exists in all three locales.
- **Fail-before-fix verified:** the Type `<td>` was temporarily replaced with an empty cell — 2 of
  the 3 tests failed; restoring it returned 3/3. The test can therefore actually fail.
- Fixture note: the em-dash case deliberately uses a **non-blank** `bankAccount`, because the Bank
  Account column renders its own em-dash placeholder when empty — a blank fixture would have made
  the assertion pass even with the Type column removed (the fixture-data trap in `CLAUDE.md` §15c).
  The assertion is `toHaveLength(2)`, not `toBeGreaterThanOrEqual(2)`, for the same reason.

**For the reworded messages: NO dedicated regression test.** Reason: the assertion would restate the
message text, so it would pin the copy rather than any behaviour, and would need rewriting on every
wording change. Locale **presence and parity** for these keys is already enforced by the existing
`OwnAccountTransferComposerDialog.locales.test.ts` (7/7 pass); correctness of the wording is a
review judgement, verified by reading the rendered strings against the confirmed root cause.

## Test Scenarios

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| Two Vietcom credentials, types `DigiBiz` / `Corporate` | both sub-types visible in the dialog | both rendered | PASS |
| Credential with no sub-type (GDT) | em-dash, column keeps its width | em-dash rendered | PASS |
| Credential with whitespace-only sub-type (pre-discriminator row) | em-dash | em-dash rendered | PASS |
| Type header key present in en / ko / vi | all three non-blank | all three non-blank | PASS |
| Guard still blocks Vietcom CORPORATE, allows DIGIBIZ | unchanged behaviour | 15/15 in `bank-profiles.transferSupport.test.ts` | PASS |

## UI Verification

Rendered assertions via Testing Library only. **Visual / browser verification: NOT RUN** — no
browser environment was used. The three reworded strings were read directly from the locale files
and checked against the verified root cause; they were not observed in a running UI.

## Database Verification

NOT APPLICABLE — `Database Impact: NONE`.

## Security / Permission Verification

NOT APPLICABLE — no auth, permission, or sensitive-data surface changed. The Type column exposes
`CERT_INFO_DETL_CON3` (a non-secret label already on the wire); no password material is added to the
render path.

## Existing Failures

Pre-existing, **not** caused by this change and **not** repaired here:

- `OwnAccountTransferComposerDialog.locales.test.ts(92,19)` and `(93,19)` — `tsc` TS2551:
  `own_account_transfer.composer.error.engine_80002411` exists in `en.json` but is absent from
  `ko.json` and `vi.json`. Present before this work (recorded in the 2026-08-26 deployment as a
  category-B failure). Left in place deliberately: supplying KO/VI text would mean **inventing**
  translations for a bank error message, which the project's i18n rule forbids
  (`wecms-api/CLAUDE.md` §"Unresolved translations — do NOT invent"). Needs verified wording.

## New Failures

None.

## Not Tested

- SIT behaviour after re-pointing `ACCT_MSTR.BANK_CERT_SEQ` to the DigiBiz credential — that is an
  operator action on SIT data, not a code path, and has not been performed.
- Visual layout of the widened 4-column dialog at narrow widths.

## Final Result

**PASS**

## Recommendation

READY FOR MANUAL COMMIT.
