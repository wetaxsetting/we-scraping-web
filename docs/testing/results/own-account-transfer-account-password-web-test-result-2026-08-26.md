# Own Account Transfer — account-password collection (WEB) — Test Result

**Date:** 2026-08-26
**Type:** TEST RESULT
**Status:** PASS
**Repository:** wecms-web
**Related Record:** [../../bugs/own-account-transfer-account-password-2026-08-26.md](../../bugs/own-account-transfer-account-password-2026-08-26.md)

## Scope

Frontend half of the `80002420` fix: the per-bank password matrix, the two bank-gated
password rows with eye toggle + anti-autofill, and `acct_pwd` / `trns_pwd` on the
`/scraping-result` POST.

## Environment

LOCAL only — Vitest (jsdom). The application was **not started**.
SIT / UAT: **NOT RUN.**

## Code / Build Under Test

- Branch: working tree
- Commit: **NOT COMMITTED** — work stops at `READY FOR MANUAL COMMIT`
- Toolchain: Vitest 2.1.9, TypeScript 5
- API URL / environment: n/a (no network calls; the engine and API are mocked)

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx tsc --noEmit` | **PASS for this change** | 0 errors attributable to the diff; 2 pre-existing errors remain — see *Existing Failures* |
| `npx vitest run components/banking/own-account-transfer/bank-profiles.acctPassword.test.ts` | **PASS** | 17 tests |
| `npx vitest run components/banking/own-account-transfer` | **PASS** | 11 files, **139 tests**, 0 failures (122 pre-existing + 17 new) |

## Regression Tests

New file [`bank-profiles.acctPassword.test.ts`](../../../components/banking/own-account-transfer/bank-profiles.acctPassword.test.ts) — 17 cases.

| Group | Behaviour protected |
|---|---|
| Account-password matrix | IBK / Shinhan / Woori / KEB Hana require it; Vietcom / Vietin do not |
| 🔴 IBK specifically | `isPasswordRequiredFor("11704003") === true` — the exact assertion that was false before the fix, which disabled the input and produced `acctNumPWD: ""` |
| Null-safety | `null` / `undefined` / unknown bank code return `false` without throwing |
| Transfer-password matrix | KEB Hana only; **no bank in the current allow-list needs one** |
| Engine payload | A typed password actually arrives as `Input.acctNumPWD` — the specific link that was broken |
| Failing shape documented | An empty password still serialises as `""`, so a future refactor that reintroduces a disabled input fails loudly here rather than at the bank |

**Did a regression test cover the original defect? YES** — the IBK matrix case plus the
engine-payload case together reproduce the exact `80002420` chain.

## Test Scenarios

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| IBK source selected → Account Password row renders enabled + required | field editable, red asterisk | — | **NOT RUN** (UI not started) |
| Vietcom / Vietin source → no password row at all | row absent | — | **NOT RUN** |
| Blank password on IBK → Next blocked, engine never called | validation error | — | **NOT RUN** |
| Eye toggle reveals / masks the typed value | `type` flips text ↔ password | — | **NOT RUN** |
| Browser password manager does not silently fill the field | field stays empty until focused | — | **NOT RUN** — needs a real browser + saved credential |

The permanent scenario suite for this screen lives in
[`docs/features/banking/internal-transfer-vnd/own-account-transfer/test-scenarios.md`](../../features/banking/internal-transfer-vnd/own-account-transfer/test-scenarios.md);
it is **not** updated by this record — that update is owed once the SIT run confirms the
observable behaviour.

## Regression Review

- Areas checked: the 122 pre-existing OAT tests (all pass); the three `bank-profiles.*.test.ts` draft fixtures (extended with `trnsPassword: ""` — mechanical, type-driven); `tsc` across the whole app.
- Result: **PASS.** Vietcom / Vietin behaviour is unchanged (no password sent before or after). Shinhan / Woori keep their typed field and gain only the eye toggle plus the anti-autofill attributes.

## UI Verification

**NOT RUN.** The app was never started, so no visual claim is made about the two rows, the
eye glyph, or the `h-8` rhythm against the sibling inputs.

## Database Verification

**NONE (frontend) — dependency only.** The write path is owned by
[wecms-api/docs/testing/results/own-account-transfer-account-password-api-test-result-2026-08-26.md](../../../../wecms-api/docs/testing/results/own-account-transfer-account-password-api-test-result-2026-08-26.md).

## Not Tested

| Check | Why |
|---|---|
| Manual / SIT end-to-end | UI not started; no NXiSAS engine |
| Visual / responsive | UI not started |
| EN / KO / VI rendering of the 5 new keys | UI not started — keys added and JSON validated in all three files |

## Existing Failures

**2 pre-existing `tsc` errors, NOT caused by this change and NOT fixed here.**

```
OwnAccountTransferComposerDialog.locales.test.ts(92,19) TS2551
OwnAccountTransferComposerDialog.locales.test.ts(93,19) TS2551
  Property 'own_account_transfer.composer.error.engine_80002411' does not exist
```

`engine_80002411` is present in `en.json` and absent from `ko.json` / `vi.json`. Confirmed
at HEAD before this change:

```
$ git show HEAD:locales/en.json | grep -c engine_80002411   → 1
$ git show HEAD:locales/ko.json | grep -c engine_80002411   → 0
$ git show HEAD:locales/vi.json | grep -c engine_80002411   → 0
```

Category **B** per CLAUDE.md §14j — recorded, not repaired in an unrelated MR
(`feedback_preserve_existing_code`). The Vitest suite is green because the assertion is a
type-level index, not a runtime one.

## New Failures

None.

## Final Result

**PASS**

## Recommendation

**READY FOR MANUAL COMMIT** — then SIT verification. Not `COMPLETE`: every UI and
end-to-end scenario above is `NOT RUN`.
