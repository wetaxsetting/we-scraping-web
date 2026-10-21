# Transfer Confirmation Display Fields — Test Result

**Date:** 2026-08-19
**Type:** TEST RESULT
**Status:** PARTIAL
**Repository:** wecms-web
**Related Record:** [Own Account Transfer — Transfer Confirmation Showed Bank-Raw Recipient Bank and Fee Text](../../bugs/own-account-transfer-confirmation-display-fields-2026-08-19.md)
**Issue:** —

## Scope

Verifies that `buildNxisasOrgObj` now emits the two confirmation-popup display fields
(`recpBankNm`, `trnsFeeStts`) legacy sets at `trns_0001_007.ts:2021-2023`, that the fee **label** is
kept distinct from the fee **wire value**, and that the corrected `transfer_fee` locale label
resolves in all three languages.

`Status: PARTIAL` rather than `PASS`: the automated layer is green, but the popup was **never
rendered** — that needs the licensed NXiSAS engine and live bank credentials.

## Environment

LOCAL only. No SIT/UAT verification was performed and none is claimed.

## Code / Build Under Test

- Branch: (working tree, not committed)
- Commit: **NOT COMMITTED** — `READY FOR MANUAL COMMIT` per CLAUDE.md §15
- API URL/environment: not exercised — these fields never reach `wecms-api`
- Test runner: Vitest 2.1.9

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/banking/own-account-transfer` | **PASS** | 9 files passed, **111 tests passed**, 0 failed (105 pre-existing + 6 new) |
| `components/banking/own-account-transfer/bank-profiles.confirmDisplay.test.ts` | **PASS** | 6 tests passed |
| `npx tsc --noEmit` | **PASS for this change** | 0 errors in the changed files; 2 pre-existing elsewhere — see `## Existing Failures` |

Placement check: the new file is under `components/`, so Vitest's include globs actually collect it
(CLAUDE.md §14c include-glob trap — a test under `hooks/` or `app/` would be silently skipped and
would have to be recorded as `NOT RUN`).

## Regression Tests

**Did a regression test cover the original defect? YES**

```
Test file:                   components/banking/own-account-transfer/bank-profiles.confirmDisplay.test.ts
Test cases:                  "sets recpBankNm so the bundle does not fall back to the bank's raw name"
                             "sets trnsFeeStts so the bundle does not fall back to the bank's raw fee text"
Original failure reproduced: YES — executed, see below
Result:                      PASS
```

**Fail-before / pass-after was executed:**

1. Fix in place → `npx vitest run …/bank-profiles.confirmDisplay.test.ts` → **6 passed**.
2. Both assignment guards neutralised in place (`if (args.confirmDisplay?.…)` →
   `if (false && args.confirmDisplay?.…)` at `bank-profiles.ts:515` and `:518`); the edit was
   re-read from the file to confirm it applied.
3. Same command → **1 test file failed**. The test genuinely detects the defect.
4. Guards restored (re-read to confirm); `npx vitest run components/banking/own-account-transfer`
   → **9 files passed**.

Full-case list:

| Case | Asserts |
|---|---|
| sets `recpBankNm` | the WeCMS bank label reaches the org-obj |
| sets `trnsFeeStts` | "Sender pays" / "Recipient pays" reach the org-obj for both fee bearers |
| keeps label and wire value separate | on a **Shinhan** source: `trnsFeeStts` label + `Input.feePaymentType` `"1"`/`"2"` |
| Vietin's wire fee value is deleted | on **Vietin**: `feePaymentType` undefined *and* `trnsFeeStts` still supplied |
| omits both keys when nothing supplied | absent and empty-string `confirmDisplay` both leave the keys unset |
| does not disturb the `transType` fix | cross-bank leg still `TRANSFER_ML` + `transType "2"` |

### A test-authoring error the run caught

The first draft asserted `feePaymentType === "1"` on a **Vietin** source. That failed — the `vietin`
profile *deletes* `feePaymentType` on its `TRANSFER_ML` leg (the documented divergence in
[the transType record](../../bugs/own-account-transfer-napas-leg-transtype-2026-08-19.md), Known
Limitations item 1). The assertion was wrong, not the product code. It was split into two cases: the
label/wire pairing on a Shinhan source, and Vietin's deletion pinned explicitly. Recorded because
the initial run output would otherwise look like a product failure in the history.

## Locale Verification

| Check | Result |
|---|---|
| en/ko/vi parse as JSON after the edit | **PASS** |
| `…confirm_transfer.transfer_fee` resolves in all three | **PASS** — `Transaction Fee` / `거래 수수료` / `Phí giao dịch` |
| No invented translations | **PASS** — ko/vi copied from the existing in-project `own_account_transfer.composer.transaction_fee` |
| Key-count drift | **NONE from this change** — 29 keys missing in ko and 37 in vi are pre-existing; one existing key was edited per file, none added |

## API Verification

**NOT APPLICABLE** — no endpoint, request, or response shape changed. Both fields are consumed by
the local NXiSAS bundle.

## UI Verification

**NOT RUN** — the app was not started and the popup was not rendered. No visual verification is
claimed. The dialog component itself was not modified; it already renders whatever the bridge
scrapes, so the change is upstream of it.

## Database Verification

**NOT APPLICABLE** — no database dependency; no `.sql` in this repository (§12g).

## Legacy Parity Verification

| | Value |
|---|---|
| **Legacy JEX behaviour** | sets `recpBankNm` (`REC2.RCPT_BANK_NM`) + `trnsFeeStts` (`REC3.TRNS_FEE_STTS`) on the org-obj — `trns_0001_007.ts:2021-2023`; fee label rendered from `nxisas_v2_j050` = "Transaction Fee" |
| **Refactor BEFORE** | neither field set → bundle fallback (`nxisas_v2.js:1360-1361`) to `remitBank` / `feePaymentType` raw text; label "Transfer Fee" |
| **Target** | both fields supplied from WeCMS data; label "Transaction Fee" |
| **Final** | both supplied and asserted; label corrected in 3 locales |

**Update (2026-08-19, amendment run): full string parity now implemented.** The recipient-bank label
is `SHORT_NAME | LONG_NAME_EN (NAPAS_BANK_CD)` — e.g.
`SHINHAN BANK | Shinhan Bank Vietnam Limited (970424)`.

The earlier note here said the `SHORT_NAME |` prefix "cannot be produced without a DTO change" —
**that was wrong**. The names were already returned by
`GET /napas-bank-info/{napas_bank_cd}` (backend B9, 2026-06-04) and the lookup already ran on every
cross-bank leg inside `validateNapas`; the two names were simply discarded. Fixed with no backend
change and no extra request. Full detail: the parent record's **Amendment 1**.

| Run | Files | Tests | Result |
|---|---|---|---|
| initial (display fields) | 9 | 111 | PASS |
| amendment (composite label) | 10 | **122** (+11) | PASS |

Fail-before/pass-after was executed for the amendment too: the composite branch in
`resolveRecipientBankLabel` was commented out, `resolveRecipientBankLabel.test.ts` failed, the line
was restored, and the folder suite returned 10/10 green.

**One caveat retained:** the composite is built from the NAPAS dictionary, not copied from a legacy
concatenation — `trns_0001_007.ts` destructures `SHORT_NAME` but never uses it and assigns
`RCPT_BANK_NM = LONG_NAME_EN` (`:604`). The separator and spacing are inferred from the reporter's
screenshot, which is the authority for the target format.

## Security / Permission Verification

**NOT APPLICABLE** — no auth, permission, or sensitive-data surface. Both fields are display labels
already visible on the preceding form.

## Performance / Concurrency Verification

**NOT APPLICABLE** — two optional strings on an existing payload.

## Existing Failures

| Failure | Category | Evidence it predates this work |
|---|---|---|
| `npx tsc --noEmit` → 2 × TS2551 in `OwnAccountTransferComposerDialog.locales.test.ts:92,93` — missing key `own_account_transfer.composer.error.engine_80002411` | **B — pre-existing** | Same two errors were present before this change (recorded in the transType test result earlier today); this diff neither adds nor removes that key |
| 29 ko / 37 vi locale keys missing | **B — pre-existing** | This change edited one existing key per file and added none |

The suite-wide pre-existing failure in `useEInvoiceScrape.test.ts` (CLAUDE.md §14j) was not
exercised — the run was scoped to `components/banking/own-account-transfer`.

## New Failures

**None.** No test regressed.

## Not Tested

| Check | Why |
|---|---|
| The popup actually rendering the corrected values | Needs the licensed NXiSAS engine + live bank credentials. **This is the decisive check** — re-run a Vietin → Shinhan transfer. |
| Exact legacy string parity for the recipient bank | Blocked by the missing short-name field — see Legacy Parity above; needs a PO call, not a test. |
| Full-suite `npm test` | Scoped run only; no consumer of these fields exists outside this folder. |
| Audit Findings 3 (chrome) and 4 (remark labels) | Out of the approved scope; open questions unanswered. |

## Final Result

**PARTIAL** — automated, locale, and parity-reasoning layers PASS; in-app rendering NOT RUN.

## Recommendation

**READY FOR MANUAL COMMIT**, then re-open the Transfer Confirmation modal on a Vietin → Shinhan
transfer and confirm two rows: `Recipient Bank` shows the WeCMS bank label (not `SHBVN_…`) and
`Transaction Fee` shows `Sender pays` (not `Phí ngoài …`).

If the recipient-bank row still shows the bank-raw string, the next suspect is
`resolveRecipientBankLabel`'s scrape-first precedence at
`OwnAccountTransferComposerDialog.tsx:2564` — deliberately left unchanged here because supplying the
bundle with our value should make the scraped value *be* our value.
