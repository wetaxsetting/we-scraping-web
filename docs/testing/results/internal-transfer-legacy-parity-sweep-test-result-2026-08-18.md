# Internal Transfer Legacy-Parity Sweep — Test Result (Frontend)

**Date:** 2026-08-18
**Type:** TEST RESULT
**Status:** PASS
**Repository:** wecms-web
**Related Record:** [Internal Transfer — Remaining Legacy-Parity Differences (Sweep)](../../bugs/internal-transfer-legacy-parity-sweep-2026-08-18.md)
**Issue:** —

## Scope

The 7-item legacy-parity sweep on Banking → Internal Transfer (Own Account Transfer): OTP /
transfer-password message branches, `FEE_DFR_SBJ` (backend-side), the balance-refresh
`99999999` fallback, bank-echoed account/currency fields, save/notify ordering, `80002411`
multilingual behaviour, and end-to-end verification.

## Environment

LOCAL only. **SIT NOT VERIFIED** — deployment is manual and has not been performed.

## Code / Build Under Test

- Branch: `wecms-ui-fixes`
- Commit: **NOT COMMITTED** — working tree
- Build/artifact: Vitest 2.1.9 (jsdom), `tsc --noEmit`, ESLint 9
- API URL/environment: not used — the tests exercise pure functions, no HTTP

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/banking/own-account-transfer` | **PASS** | 2 files, **52 executed, 52 passed, 0 failed** |
| `npm test` (full suite) | **PASS for this change** | 16 files, **204 executed, 193 passed, 11 failed** — all 11 pre-existing and unrelated (see `## Existing Failures`) |
| `npx tsc --noEmit -p tsconfig.json` | **PASS** | 0 errors in project sources (only the known stale `.next/dev/types/routes.d.ts` artifact, filtered) |
| `npx eslint components/banking/own-account-transfer lib/types/api.ts` | **PASS** | 0 errors; 1 pre-existing warning in `SourceAccountsTable.tsx:86` (`git diff` on that file is empty — not from this change) |

Suite growth: 167 → **204** tests (+30 in the extended `engineOutcome` file, +7 in the new
`locales` file).

### Coverage against the task's required list

| Required case | Test | Result |
|---|---|---|
| successful transfer | `reads a successful transfer from the nested Output` | PASS |
| bank failure | `reads the ACTUAL engine ErrorCode on failure` | PASS |
| OTP failure | `OTP code %s shows the RAW bank message` ×13 | PASS |
| transfer-password failure | `transfer-password code %s shows the RAW bank message` ×6 | PASS |
| OTP retry / password retry | **N/A — legacy has no retry** (see `## Not Tested`) | NOT APPLICABLE |
| balance success | covered by the pre-existing `findBalanceOutput` path + the gate's success branch | PASS |
| balance failure | `resolveBalanceErrorMessage` group (4 cases) | PASS |
| blank engine status | `never returns 99999999 for an unparseable payload`; `returns null when either half is blank` | PASS |
| multiple engine jobs / last-result-wins | `legacy last-wins job selection` group (4 cases) | PASS |
| fee payer 1 / fee payer 2 | backend `scraping_feeBearerA/B_persistsLegacy…PaysCode` | PASS (api record) |
| bank-returned account/currency fields | `bank-echoed account + currency (item 4)` group (4 cases) | PASS |
| amount mismatch | backend `scraping_amountMismatch_persistsLegacyParity` | PASS (api record) |
| real error message | `a generic code keeps the getScrapingMessage behaviour`; `preserves the bank's ErrorMessage` | PASS |
| multilingual 80002411 | `engine_80002411 is EN-only …` + the EN-fallback-chain case | PASS |
| no Internal Transfer persistence of `99999999` | see `## Regression Tests` | PASS |
| Transfer History `99999999` filter still works | backend `TransferHistoryQueryServiceTest` 15/15 | PASS (api record) |
| NAPAS duplicate `BANK_CD` bug remains fixed | backend `targets_user_filtersByGrant_excludesSourceRow` | PASS (api record) |
| target account loading | backend `targets_*` (2 cases) — no frontend test exists for the fetch | PASS (api record) |

## Regression Tests

**Did a regression test cover the original defects? YES.**

| Defect | Test | Original failure protected |
|---|---|---|
| flat engine-result read → `99999999` (previous fix) | `engineOutcome` nested-navigation + last-wins groups | Red-check performed on the prior MR: reverting the one navigation line produced `10 failed / 5 passed` |
| OTP / password branch used the wrong message source | `resolveTransferErrorMessage` group (19 cases) | Asserts the raw bank message for all 19 legacy codes and the generic sentence for `8000F110` — a regression to a single `getScrapingMessage` call fails the `8000F110` case immediately |
| `80003232` wrongly added to the password array | `80003232 is NOT in the legacy password array` | Pins the legacy quirk |
| balance failure persisted a synthesized status | `resolveBalanceErrorMessage` group + a source assertion that `?? "99999999"` is gone | see below |
| bank-normalized account number could reject an intake | backend `scraping_engineEcho_persistsBankReturnedAccountsAndCurrency` (asserts the ownership lookups still used the composed keys) | PASS |

**`99999999` no longer reachable from any Internal Transfer write path** — verified by source
inspection after the change:

```
$ grep -n '99999999' components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx
666:  // comment — explains why the sentinel is not used
1837: // comment — parser docblock
2000: // comment — the 2026-06-01 balance-path fix note
```

Three comment lines, zero code occurrences. (Before this change, line 880 carried the live
`acct_bal_inq_stts: parsed.status ?? "99999999"`.) The only remaining live occurrences in the
repo are the Transfer-History **filter** (`components/banking/internal-transfer/TransferHistoryPage.tsx:26,37`)
and its wire type — exactly where legacy uses it.

## API Verification

Request-shape review of the two affected endpoints (static; no live call made):

| Endpoint | Change | DTO constraint respected |
|---|---|---|
| `POST …/scraping-result` | +3 optional fields `engine_out_acct_no` / `engine_in_acct_no` / `engine_ccy_cd`, clamped client-side to 100/100/3 | `@Size(max=100/100/3)` |
| `POST …/balance-refresh` | now called **only** on success; `acct_bal_inq_stts` always `"00000000"` | `@NotBlank @Size(max=20)` — satisfied |

`fee_dfr_sbj` wire vocabulary unchanged (`A`/`B`); the `1`/`2` conversion is internal to the
backend, so no contract change was required. Field-name casing verified: Java `engineOutAcctNo`
→ global Jackson `SNAKE_CASE` → `engine_out_acct_no`, matching what the client sends.

Result: **PASS**

## UI Verification

Static flow verification of the full chain (code-reading, not a running browser):

```
SourceAccountsTable  →  GET /target-accounts        (findFirstByBankCdOrderByNapasBankCdAsc — bug 1 fix intact)
composer opens       →  data.loadTargets            (unchanged)
Update Balance       →  engine BALANCE job
                        → parseBalanceOutcome (nested Output — unchanged)
                        → LEGACY GATE: non-success → message-or-silence, RETURN (no POST, no reload)
                                       success + null bal → WBE6021 message, RETURN
                                       success + bal → POST /balance-refresh (stts always 00000000)
                        → applyBalanceRefresh → ACCT_MSTR patch → reload
Next (transfer)      →  engine TRANSFER job
                        → decryptNxisasResult (shape-preserving)
                        → parseEngineOutcome (nested; + acctNum/remitAcctNum/currency)
                        → POST /scraping-result (composed keys validated, engine echo recorded)
                        → recordScrapingResult → insertHistoryRow → NAPAS_REMIT_TRNS_HSTR
                        → status success → success dialog, close, reload
                          status failed  → resolveTransferErrorMessage(code, msg) + real code
```

Control-flow audit of the changed balance block: `setUpdating(false)` fires on **every** early
return (both new gates and the existing catch), so no path can leave the button stuck.

Downstream read verified: the source-list "Last refresh" column renders from
`acct_bal_inq_stts` (`source-accounts-columns.tsx:79` ← `mappers.ts:51`), so suppressing the
failure write means that column keeps the last **successful** status — legacy behaviour, and the
explanation for the "Thất bại" in the original report.

- Result: **NOT RUN** for visual/browser verification — a real transfer or balance inquiry needs a
  licensed NXiSAS engine origin plus live bank credentials, neither available locally. No
  screenshot or rendered-state claim is made.

## Database Verification

Dependency only — `wecms-web` carries no SQL, and **no `.sql` file was added**. No schema change
on either side; stored *values* change. Read-only detection SQL for pre-existing drift
(`FEE_DFR_SBJ = A/B`, `TRNS_STTS = '99999999'`, non-success `ACCT_BAL_INQ_STTS`) is in the backend
record's `## Database Impact`. **Nothing was executed.**

Result: **NOT APPLICABLE** (no DB artifact in this repository)

## Security / Permission Verification

The item-4 change is the security-relevant one and was designed around it: the backend's
ownership re-validation and VND guard continue to run on the **composed** `source_*` / `target_*` /
`ccy_cd` values the user selected. The new `engine_*` fields are write-only record fields — never
used in a lookup, a predicate, or an authorization decision — which is asserted directly by
`scraping_engineEcho_persistsBankReturnedAccountsAndCurrency` (it verifies the two `AcctMstr`
lookups still received the composed account numbers). No change to auth, tenant scope, or
permission gating. Engine messages are rendered as React text (escaped); no credential, UID, or
Action value is logged or surfaced.

Result: **PASS**

## Existing Failures

`components/addon/sales-einvoices/useEInvoiceScrape.test.ts` — **11 failed**.

```
Error: [vitest] No "decryptEInvoiceEngineData" export is defined on the
"@/lib/api/addon" mock. Did you forget to return it from "vi.mock"?
```

**Category B — pre-existing, unrelated.** Documented in `wecms-web/CLAUDE.md` §14j and
[testing-strategy.md](../testing-strategy.md) (recorded there as 11 of 152; the suite has since
grown to 204, the same 11 fail). Evidence it predates this work:
`git diff --stat -- components/addon/` is **empty**. Not repaired here, per
`feedback_preserve_existing_code`.

## New Failures

None.

## Not Tested

- **OTP retry / transfer-password retry** — `NOT APPLICABLE`, not skipped. The legacy branches are
  unimplemented `TODO` stubs that behave exactly like the generic error branch
  (`trns_0001_007.ts:876-882` vs `:889-905`); there is no retry request, no auto-reopened OTP
  popup, and no attempt counter anywhere in the flow. Testing a retry would mean testing behaviour
  legacy does not have. What the codes *do* affect — the message source — is covered by 19 cases.
- Live end-to-end transfer / balance inquiry through a real bank (licensed NXiSAS origin +
  credentials required).
- SIT / UAT behaviour — **SIT NOT VERIFIED**; deployment is manual and has not happened.
- KO / VI rendering of `engine_80002411` — the source text is a DB-only ML row; the locale test
  asserts the EN-fallback behaviour instead of inventing translations.

## Final Result

**PASS**

## Recommendation

READY FOR MANUAL COMMIT — paired with the `wecms-api` change; both sides ship together (the
frontend sends three fields the unpatched backend would reject as unknown-property only if
`FAIL_ON_UNKNOWN_PROPERTIES` were enabled, and relies on the backend's `A`/`B`→`1`/`2` mapping for
item 2).

## Working-tree note

`CLAUDE.md`, `docs/README.md`, and the four `.claude/` + `.agents/` skill files show as modified in
`git status` but were **not** touched by this change — they were already modified in the working
tree when this work started.
