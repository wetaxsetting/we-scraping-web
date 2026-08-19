# Own Account Transfer — Cross-Bank Leg Sent a Blank `transType`, Engine Demanded a Deposit Bank Branch Code (error code 80010222)

**Date:** 2026-08-19
**Type:** BUG FIX | PARITY FIX
**Current Work Classification:** BUG
**Finding Classification:** BUG — wrong wire constant in every bank profile, from a misread legacy assignment
**Investigation Status:** COMPLETE
**Approval Status:** APPROVED — Sonny asked "So we need to fix the code or not?", the recommendation to fix was given, and Sonny then supplied the confirming legacy-UAT dataset. An explicit "implement it" was **not** stated verbatim; recorded honestly rather than asserted.
**Implementation Status:** COMPLETE
**Test Status:** PASS
**Status:** READY FOR MANUAL COMMIT
**Repository:** wecms-web
**Issue:** —
**Paired backend record:** none — no endpoint, DTO, entity, key generation, or table changes. See `## API Impact` and `## Database Impact`.

> **Docs-first sequencing — stated honestly (CLAUDE.md §2a, §16).**
> This record was created **after** the investigation and the code edits, inside the same
> session. The reporter asked for a diagnosis of a live Transfer error; the analysis was
> produced and presented across several turns; the fix was recommended, then applied when the
> reporter supplied the legacy-UAT dataset that closed the causation gap. That ordering does
> **not** satisfy §2a, and the approval was a decision request rather than a verbatim
> authorization — both are recorded here rather than back-dated or overstated. No finding was
> lost: the full investigation is reproduced below from the same evidence (the reporter's
> captured engine payload, two `napas_remit_trns_hstr` datasets, legacy JEX source, and a
> workspace-wide search). Future work on this screen creates the record first.

## Problem

Filling in the Own Account Transfer form and pressing **Next** failed for every cross-bank
(NAPAS) transfer, on every source bank tested. The engine returned:

```
ErrorCode:    80010222
ErrorMessage: No Deposit Bank Branch Code entered. Please check and try it again.
```

The reporter tested three source banks and both a Shinhan and a Vietcom destination. The error
was identical in all four attempts, which ruled out a bank-specific cause early.

## Current Behavior

Reporter's captured engine payload — Vietin → Vietcombank:

```json
{ "Module": "GLOBAL/VNM/BANK_Vietin",
  "Class":  "CORPORATE",
  "Job":    "TRANSFER_ML",
  "Input": { "acctNum": "112002954853", "remitAcctNum": "0441000688210",
             "remitAmt": "10000", "remitBankCode": "970436", "currency": "VND",
             "remitDate": "20260819", "transType": "", "transInfoYN": "Y",
             "memo": "Vietin 853 to Vietcom 210" },
  "Output": { "ErrorCode": "80010222",
              "ErrorMessage": "No Deposit Bank Branch Code entered. …" } }
```

`transType` is empty on a cross-bank remit that also carries a NAPAS bank code — a
self-contradictory payload.

## Expected Behavior

The cross-bank leg sends `transType: "2"` (타행이체 / other-bank), which routes the remit
through NAPAS and requires no receiving-bank branch.

## Scope

`transType` on the cross-bank leg of all six bank profiles in
[bank-profiles.ts](../../components/banking/own-account-transfer/bank-profiles.ts), the two
stale Vietcom doc comments that encoded the misreading, and a regression test.

## Out of Scope

- The `feePaymentType` divergence on Vietin's `TRANSFER_ML` leg — see `## Known Limitations`.
- Backend `NAPAS_REMIT_TRNS_HSTR` persistence, which already derives `TRANS_TYPE` correctly.
- Any other bank profile field.

## Investigation

### 1. The error is entirely engine-side, and no branch field exists to fill

A workspace-wide search for `80010222` and for `Deposit Bank Branch` returned **zero hits**
across all four JEX trees, `wecms-api/`, `wecms-web/`, docs, and the locale files. The code and
message are produced inside the NXiSAS/Coocon module — consistent with the `8001xxxx` family
(`80010171` is the engine's 2FA error, handled at `nxisas_v2.js:314`).

More importantly, **WeCMS has no deposit-bank-branch surface at all** — no input field, no DTO
property, no `napas_remit_trns_hstr` column, no ML/i18n string. So 80010222 cannot be resolved
by supplying the branch code; the only lever is routing the transfer so the engine never asks.

The single precedent confirms this: Shinhan is the only bank that ever sends branch fields, and
legacy **hardcodes them as literals** (`trns_0001_007.ts:1954-1955`) precisely because there is
no data source. In the Vietin case block, the equivalent lines are deliberately commented out
(`:2006-2007`).

### 2. The payload comes from the refactor, and one constant explains all three banks

Field order and contents match the `vietin` builder exactly, including the absent
`feePaymentType`. `internal` comes from `OwnAccountTransferComposerDialog.tsx:770`
(`draft.transferType === "SAME_BANK"`), so a NAPAS leg yielded `""`.

Every profile had the same defect:

| Profile | Cross-bank `transType` before the fix |
|---|---|
| shinhan | `""` |
| ibk | `""` |
| vietcom | `""` (hardcoded, both legs) |
| vietin | `""` |
| woori | `""` |
| fallback | `""` |

That is why source bank and destination bank both varied in testing and the error never
changed. Not bank-specific — one shared wrong constant, six times.

### 3. Root cause — a misread assignment in legacy

`trns_0001_007.ts:2052-2060`:

```js
if (data.REC.BANK_CD == data.REC2.BANK_CD) {
    transType = "1";
    if (data.REC.BANK_CD == '11704004') transType = "";   // Vietcom
} else if (data.REC.BANK_CD = '11704008') {               // ← ASSIGNMENT, not ==
    transType = "2";
} else {
    transType = "";                                       // ← unreachable
}
```

Line 2056 is an **assignment**. Always truthy, so every cross-bank transfer takes
`transType = "2"` at runtime and the `else` is dead code. Read as `==`, that dead branch looks
like the cross-bank case — which is what all six profiles implemented.

This was already logged as open question **#8** in
`wecms-api/docs/audits/legacy-parity/own-account-transfer-legacy-bank-business-rules.md:439`
("looks like a **latent bug** in legacy; confirm intended behaviour before replicating"). It was
never resolved, and the wrong reading was replicated. **Resolution:** legacy's runtime value is
`"2"`; the `=` is a real typo but produces the semantically correct value, so match runtime
behaviour, not apparent intent.

The same assignment also overwrites `data.REC.BANK_CD` to `'11704008'`, which makes the Vietin
and Woori post-tweak blocks at `:2076` / `:2105` (both testing `=== "11704001"` / `"11704020"`)
dead on the cross-bank path.

### 4. `"2"` is correct — four independent sources

- `WECMS DEV/WECMS/src/wabooks/enums/TransType.java:33-34` — `"1"` = 당행이체 (within-bank),
  `"2"` = 타행이체 (other-bank).
- `trns_0001_001.ts:1399-1410` (the deprecated `RECEIVER_INFO` builder) — `// Default:"",
  1 : Within Bank, 2: Other Bank`, and `remitBankCode = REC2.NAPAS_BANK_CD;` is annotated
  `//* required when transType = 2`.
- `trns_0002_001_c001_act.jsp` — requires `IN_NAPAS_BANK_CODE` only when `TYPE_2`.
- Legacy UAT `napas_remit_trns_hstr` (reporter-supplied) — **all 20 successful cross-bank rows
  carry `TRANS_TYPE='2'`; none carry `''`.** Four are Vietin `11704001` (2025-11-24) and two are
  Vietcom `11704004` — the exact two source banks that reproduced the failure. This closed the
  causation gap: legacy cross-bank works on these banks, works with `"2"`, and never needed a
  branch code.

### 5. Ruled out — a missing `RECEIVER_INFO` pre-scrape

Legacy v2 deliberately dropped it ("Stop use below function because Transfer v2 stop using
scraping module RECEIVER_INFO"), and `trns_0001_007.ts` only ever issues `BALANCE` and
`TRANSFER*`. The refactor is correct to skip it.

### 6. A false lead worth recording — the DB column is not the wire value

The first four `napas_remit_trns_hstr` rows the reporter supplied showed `trans_type='2'`, which
appeared to contradict the diagnosis. It does not: the DB write is computed **independently** of
the engine payload by
`OwnAccountTransferService.java:727-729` (`SAME_BANK ? "1" : "2"`), so the persisted row was
already correct while the engine received `""`. **When diagnosing this class of bug, assert the
captured payload, never the stored row.**

## Root Cause

All six bank profiles sent `transType: ""` on the cross-bank leg, derived from misreading the
`=` assignment at `trns_0001_007.ts:2056` as `==`. A blank `transType` alongside a populated
`remitBankCode` is contradictory; the engine resolved it by falling back to the domestic/CITAD
route, which requires the receiving bank's branch — a field WeCMS cannot supply — producing
`80010222`.

## Implementation

Six `transType` values corrected, plus the two stale Vietcom comments rewritten to document the
dead-code branch so the misreading cannot recur.

```ts
transType: internal ? "1" : "2",   // shinhan, ibk, vietin, woori, fallback
transType: internal ? ""  : "2",   // vietcom — "" survives on the within-bank leg only
```

Vietcom is the one genuine exception: `trns_0001_007.ts:2055` really does force `""`, but only
inside the same-bank branch. Vietin's same-bank leg still deletes `transType` entirely
(`:2106-2110`), which the fix leaves untouched.

## Files Changed

| File | Change |
|---|---|
| [components/banking/own-account-transfer/bank-profiles.ts](../../components/banking/own-account-transfer/bank-profiles.ts) | 6 `transType` values `"" → "2"` on the cross-bank leg (lines 162, 204, 268, 302, 345, 381); Vietcom doc comment + inline comment rewritten |
| [components/banking/own-account-transfer/bank-profiles.transType.test.ts](../../components/banking/own-account-transfer/bank-profiles.transType.test.ts) | **NEW** — 13-case regression test |

## API Impact

None. No endpoint, request shape, or response shape changes. The altered value travels to the
local NXiSAS engine, not to `wecms-api`.

## UI Impact

None visually. Behaviourally, a cross-bank Own Account Transfer now completes instead of failing
at the Next step.

## Database Impact

NONE (frontend) — and no database dependency. `NAPAS_REMIT_TRNS_HSTR.TRANS_TYPE` was already
being written correctly by `OwnAccountTransferService` (`SAME_BANK ? "1" : "2"`); the bug was
confined to the engine payload. No `.sql` in this repository (§12g).

## Integration Impact

NXiSAS engine only. Sending `"2"` also satisfies `trns_0002_001_c001_act.jsp`'s
`TYPE_2 ⇒ IN_NAPAS_BANK_CODE` required-check, which a blank `transType` silently bypassed.

## Verification

### Automated Tests

- Test: `components/banking/own-account-transfer/bank-profiles.transType.test.ts` (13 cases)
- Command: `npx vitest run components/banking/own-account-transfer`
- Result: **PASS** — 8 files, 105 tests passed (92 pre-existing + 13 new), 0 failed

### Regression Test

```
Test file:          components/banking/own-account-transfer/bank-profiles.transType.test.ts
Test case:          'sends transType "2" (타행이체) on the cross-bank leg — %s' (6 profiles)
Behavior protected: the cross-bank leg must never send a blank transType
```

Fail-before/pass-after was **executed, not assumed**: all six values were reverted to `""` in
place, the test file failed, the values were restored, and the folder suite returned green
again. See the test-result record for the exact sequence.

### Type Check

- Command: `npx tsc --noEmit`
- Result: **PASS for this change** — 0 errors in `bank-profiles.ts` or the new test.
- 2 pre-existing errors remain in `OwnAccountTransferComposerDialog.locales.test.ts`
  (missing locale key `own_account_transfer.composer.error.engine_80002411`) — **category B**,
  unrelated to this diff, not repaired here per `feedback_preserve_existing_code`.

### Regression Review

- Areas checked: same-bank leg for all six profiles; Vietcom's `""` same-bank override; Vietin's
  same-bank `transType` deletion + `feePaymentType: "2"` + blank `remitBankCode`; Shinhan's
  hardcoded branch fields; `remitBankCode` still present alongside `transType: "2"`.
- Other consumers of `transType`: **none** — a repo-wide search found no reader outside
  `bank-profiles.ts`, so no call site needed updating.
- Result: all covered by the new test's same-bank describe block; all PASS.

### Manual Verification

- Environment: —
- Result: **NOT RUN** — reproducing 80010222 needs the licensed NXiSAS engine plus live bank
  credentials, which this environment does not have. The reporter must retry a Vietin →
  Vietcombank transfer to confirm the engine accepts the corrected payload.

## Result

Fixed in source and covered by a regression test. **The engine-level confirmation is still
outstanding** (see Manual Verification) — this is the cheapest possible test of the diagnosis:
retry the transfer and the engine response settles it.

## Known Limitations / Follow-up

1. **`feePaymentType` on Vietin's cross-bank leg — deliberately not changed.** The refactor
   deletes it ([bank-profiles.ts](../../components/banking/own-account-transfer/bank-profiles.ts)
   `delete baseInput.feePaymentType`), following legacy's *commented intent*. Legacy at runtime
   **does** send it, because the `:2056` assignment makes the `:2112` deletion block dead on the
   cross-bank path — and every successful legacy cross-bank row carries a populated
   `fee_dfr_sbj`. Left out so the retest changes one variable at a time; fix it if the engine
   then asks for a fee bearer.
2. **Open question #8 should be closed** in
   `wecms-api/docs/audits/legacy-parity/own-account-transfer-legacy-bank-business-rules.md:439`
   with the resolution recorded in §3 above. Not done here — it is a backend-repo doc.
3. Legacy `trns_0001_007.ts:2056` remains buggy, and its side effect silently disables the
   Vietin/Woori post-tweak blocks. **Not fixed** — `WECMS DEV/` is read-only reference for
   refactor work, and the typo happens to produce the correct wire value.

## Test Evidence

Test result:
[Own Account Transfer NAPAS-Leg transType Test Result](../testing/results/own-account-transfer-napas-leg-transtype-test-result-2026-08-19.md)

Final test result:    PASS
Regression coverage:  PASS
