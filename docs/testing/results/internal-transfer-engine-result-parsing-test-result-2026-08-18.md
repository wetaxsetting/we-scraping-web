# Internal Transfer — Engine Result Parsing — Test Result

**Date:** 2026-08-18
**Type:** TEST RESULT
**Status:** PASS
**Repository:** wecms-web
**Related Record:** [Internal Transfer — Engine Result Parsed at the Wrong Level](../../bugs/internal-transfer-engine-result-parsing-2026-08-18.md)
**Issue:** —

## Scope

Verification of the `parseEngineOutcome` / `getScrapingMessage` fix on Banking → Internal
Transfer (Own Account Transfer): the engine callback is now read at
`orgObj[] → result[] → Output` per legacy `trns_0001_007.ts:2144-2175`, and the hardcoded
`"99999999"` fallback is gone.

## Environment

LOCAL only. SIT / UAT not exercised (deployment is manual and has not happened).

## Code / Build Under Test

- Branch: `wecms-ui-fixes`
- Commit: **NOT COMMITTED** — working tree
- Build/artifact: Vitest 2.1.9 (jsdom), `tsc --noEmit`, ESLint 9
- API URL/environment: not used — the tests exercise pure functions, no HTTP

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/banking/own-account-transfer` | **PASS** | 1 file, **15 executed, 15 passed, 0 failed** |
| `npm test` (full suite) | **PASS for this change** | 15 files, **167 executed, 156 passed, 11 failed** — all 11 failures pre-existing and unrelated (see `## Existing Failures`) |
| `npx tsc --noEmit -p tsconfig.json` | **PASS** | 0 errors in project sources. The only reported errors are in `.next/dev/types/routes.d.ts`, the known stale-artifact pitfall from a concurrent `next dev` — filtered with `grep -v '^\.next/'` |
| `npx eslint <3 changed files>` | **PASS** | no output (0 problems) |

New test file: `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.engineOutcome.test.ts`
(placed under `components/**`, where `vitest.config.ts` actually collects — CLAUDE.md §14c
include-glob trap).

### The 15 cases and what each pins

| # | Case | Pins |
|---|---|---|
| 1 | reads a successful transfer from the nested Output | `00000000` + all five `Result.transfer[0]` fields |
| 2 | reads the ACTUAL engine ErrorCode on failure | real code, explicitly `not.toBe("99999999")` |
| 3 | preserves the bank's ErrorMessage | `trnsMsg` survives |
| 4 | keeps transfer fields null on failure | caller falls back to composed values (legacy else-branch) |
| 5 | ignores `Result.transfer` when the code is not `00000000` | legacy gates on **both** conditions |
| 6 | never returns `99999999` for an unparseable payload | `""` when Output has no code; `null` when no Output |
| 7 | LAST job record of an org-obj wins | legacy assigns on every `$.each` iteration |
| 8 | LAST org-obj wins across threads | same, outer loop |
| 9 | trailing success beats an earlier failure | last-wins is order-based, not severity-based |
| 10 | flatter engine variants still parse | bare job record + bare Output |
| 11–13 | amount normalization | `3.362.692` / `3,362,692` / `3362692.00` / numeric → `3362692` |
| 14 | unparseable amount → `null` | composed amount used instead of a 400 |
| 15 | `getScrapingMessage` | bank message by default · `80002411` special case · generic only when the engine sent no message |

## Regression Tests

**Did a regression test cover the original defect? YES.**

- Test file: `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.engineOutcome.test.ts`
- Test cases: cases 1–10 above (the nested-navigation and last-wins groups)
- **Original failure reproduced:** yes — verified by a deliberate red-check. The single line
  `const out = findTransferOutput(raw);` was temporarily reverted to the pre-fix flat read
  (`const out = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : null;`)
  and the suite was re-run:

  ```
  Test Files  1 failed (1)
       Tests  10 failed | 5 passed (15)
  AssertionError: expected null to be '3362692'
  ```

  The fix line was then restored (`grep -c "TEMP RED-CHECK"` → `0`) and the suite returned to
  15/15 PASS.
- Result: **PASS**

## API Verification

No endpoint / method / field-name change. Request-shape review of
`POST /api/v1/banking/own-account-transfer/scraping-result`:

| Wire field | Before | After | DTO constraint respected |
|---|---|---|---|
| `trns_stts` | always `"99999999"` | `Output.ErrorCode` verbatim, `""` if absent | `@Size(max=20)` — backend `@NotBlank` removed in the paired change |
| `trns_msg` | `null` | `Output.ErrorMessage`, clamped to 255 | `@Size(max=255)` |
| `actual_amt` | `String(draft.amount)` | normalized `remitAmt`, else composed amount | `@Pattern("\\d{1,15}")` — enforced by `parseEngineAmount` |
| `fee` | always `null` | `Result.transfer[0].fee` as a number | `@DecimalMin("0")` |
| `rmrk` / `rmrk2` | composed remarks | bank `memo` / `memo2`, clamped to 500, else composed | `@Size(max=500)` |
| `target_owac_nm` | `acctNickNm` | bank `acceptName`, clamped to 200, else `acctNickNm` | `@Size(max=200)` |
| `bank_tx_id` | `""` | `""` (unchanged — legacy maps no engine field to `TRS_ID` here) | `@Pattern("...{6,64}\|")` |
| `source_*` / `target_*` / `ccy_cd` | composed | composed (unchanged, deliberate) | — |

Every clamp / normalizer exists so a legacy-shaped bank value cannot 400 the intake and
destroy the record of an executed transfer.

Result: **PASS** (static contract review; no live call made)

## UI Verification

- Error dialog now renders the bank's `ErrorMessage` + the verbatim engine code, matching the
  Update-Balance path's existing behaviour.
- Success path is now reachable: a real `00000000` result closes the dialog, fires
  `onRecorded()`, and refreshes the source list.
- Result: **NOT RUN** for visual/browser verification — an actual transfer requires a licensed
  NXiSAS engine origin plus live bank credentials, neither available locally. No screenshot or
  rendered-state claim is made.

## Database Verification

Dependency only — `wecms-web` carries no SQL. No schema change on either side; only the
**values** written to `NAPAS_REMIT_TRNS_HSTR.TRNS_STTS` / `TRNS_MSG` / `FEE` / `TRSC_AMT` /
`OWAC_NM` change. Backend record:
`wecms-api/docs/bugs/internal-transfer-intake-legacy-parity-2026-08-18.md`.

Result: **NOT APPLICABLE** (no DB artifact in this repository)

## Security / Permission Verification

No change to authentication, authorization, or tenant scope. The frontend continues to send
the composed `source_*` / `target_*` keys precisely so Spring's ownership re-validation and
W-grant check operate on values the user actually selected, not on engine-echoed strings.
Engine `ErrorMessage` is rendered into a dialog as text (React escapes it); no credential,
UID, or Action value is logged or surfaced.

Result: **PASS**

## Existing Failures

`components/addon/sales-einvoices/useEInvoiceScrape.test.ts` — **11 failed**.

```
Error: [vitest] No "decryptEInvoiceEngineData" export is defined on the
"@/lib/api/addon" mock. Did you forget to return it from "vi.mock"?
```

**Category B — pre-existing, unrelated.** Documented in CLAUDE.md §14j and
[testing-strategy.md](../testing-strategy.md) as a known stale `vi.mock` factory failure
(recorded there as 11 of 152; the suite has since grown to 167, the same 11 fail). Evidence
that it predates this work: `git diff --stat -- components/addon/` returns **empty** — this
change touches no file in that tree, and the failing module (`@/lib/api/addon`) is unrelated
to Own Account Transfer. Not repaired here, per `feedback_preserve_existing_code`.

## New Failures

None.

## Not Tested

- Live end-to-end transfer through a real bank (needs licensed NXiSAS origin + credentials).
- SIT / UAT behaviour (deployment is manual and has not been performed).
- KO / VI rendering of the new `engine_80002411` key — only EN was added; the provider's
  EN-fallback chain covers the other two until the legacy ML translations are supplied.

## Final Result

**PASS**

## Recommendation

READY FOR MANUAL COMMIT — paired with the `wecms-api` change; both sides must ship together
(a frontend sending a blank `trns_stts` against an unpatched backend would receive HTTP 400).

## Working-tree note

`CLAUDE.md`, `docs/README.md`, and the four `.claude/` + `.agents/` skill files show as
modified in `git status` but were **not** touched by this change — they were already modified
in the working tree when this work started.
