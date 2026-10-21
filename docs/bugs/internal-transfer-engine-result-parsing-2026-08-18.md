# Internal Transfer — Engine Result Parsed at the Wrong Level (error code 99999999)

**Date:** 2026-08-18
**Type:** BUG FIX | PARITY FIX
**Current Work Classification:** BUG
**Status:** READY FOR MANUAL COMMIT
**Repository:** wecms-web
**Issue:** —
**Related audit evidence:** investigation performed 2026-08-18 (see `## Initial Investigation`)
**Paired backend record:** `wecms-api/docs/bugs/internal-transfer-intake-legacy-parity-2026-08-18.md`

## Problem

On Banking → Internal Transfer (Own Account Transfer), pressing **Next** (`Tiếp`) in the
transfer composer shows the error dialog:

```
Lỗi
Ngân hàng báo lỗi và giao dịch chưa được ghi nhận.
(Mã lỗi : 99999999)
```

`99999999` is not a bank / VAN / engine code. Legacy JEX uses it **only** as the
Transfer History "Failed" filter sentinel and never stores it as a transfer result.

## Current Behavior

`parseEngineOutcome()` in
[OwnAccountTransferComposerDialog.tsx](../../components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx)
reads `ErrorCode` / `ErrorMessage` from the **top level** of the engine callback payload.
The NXiSAS bundle resolves its main callback with `_v2nxisas.orgObj` — an ARRAY of org-objs,
each with a `result[]` array of job records, each job record carrying an `Output` object
(`nxisas_v2.js:2073, 2187, 2227, 2245`). The flat read therefore always yields `null`, and
the request builder substituted a hardcoded sentinel:

```ts
trns_stts: outcome.trnsStts ?? "99999999",
```

Consequences:

- The frontend cannot distinguish a **successful** transfer from a failed one.
- Spring persists `NAPAS_REMIT_TRNS_HSTR.TRNS_STTS = '99999999'` and answers
  `status: "failed"`, so a completed bank transfer is recorded as Failed.
- `TRNS_MSG` is `NULL` — the bank's own message is discarded, so the user is shown a
  generic sentence plus a meaningless code.
- `FEE`, `OWAC_NM`, `TRSC_AMT` never receive the bank-echoed values legacy stores.

The identical defect was found and fixed for the **BALANCE** path on 2026-06-01
(`findBalanceOutput()`, same file) — its comment states verbatim that a top-level field read
*"would be persisted as 99999999 (Failed)"*. The **TRANSFER** parser was never given the
same treatment.

## Expected Behavior

Reproduce legacy `trns_0001_007.ts:2144-2175` exactly (identical mapping also at
`trns_0001_001.ts:1767-1799`):

```js
$.each(result, function (ind, obj) {                  // orgObj[]
    $.each(obj.result, function (ind2, obj2) {        // result[]  → last job wins
        let objOutput = obj2.Output;
        transferObj1.TRNS_STTS = objOutput.ErrorCode;      // verbatim, no sentinel
        transferObj1.TRNS_MSG  = objOutput.ErrorMessage;
        if (objOutput.ErrorCode == "00000000" && objOutput.Result.transfer) {
            transferObj1.TRSC_AMT = objOutput.Result.transfer[0].remitAmt;
            transferObj1.FEE      = objOutput.Result.transfer[0].fee;
            transferObj1.RMRK     = objOutput.Result.transfer[0].memo;
            transferObj1.RMRK2    = objOutput.Result.transfer[0].memo2;
            transferObj1.OWAC_NM  = objOutput.Result.transfer[0].acceptName;
            …
        } else { …keeps the composed values… }
    });
});
```

Legacy initializes `TRNS_STTS: ""` and never replaces a missing code. The error popup shows
the bank's own `ErrorMessage` through `getScrapingMessage(code, msg)`, whose single special
case is `80002411` (`trns_0001_007.ts:138-141`).

## Scope

- Fix `parseEngineOutcome()` to walk `orgObj[] → result[] → Output`, last-Output-wins.
- Take `trns_stts` / `trns_msg` verbatim from `Output.ErrorCode` / `Output.ErrorMessage`.
- On success, map `Output.Result.transfer[0]` → `remitAmt` / `fee` / `memo` / `memo2` /
  `acceptName`, exactly the legacy field set.
- Remove the `?? "99999999"` fallback.
- Show the real engine code + message in the error dialog, including legacy's `80002411`
  special case.
- Regression tests for the nested shape.

## Out of Scope

- The engine invocation path, bank profiles, remark policy, fee-bearer radio, cut-off rules,
  Phase-B cert handling — untouched.
- Legacy's OTP / transfer-password **retry affordances** (`errorOTPCode` /
  `errorTrnsPwdCode` re-prompt flows) — recorded as a remaining difference, not implemented.
- `FEE_DFR_SBJ` code-vocabulary divergence (refactor writes `A`/`B`, legacy writes `1`/`2`)
  — separate finding, needs PO approval, recorded as a remaining difference.
- Balance-refresh path (already correct since 2026-06-01).

## Initial Investigation

Read as source of truth:

| Evidence | What it establishes |
|---|---|
| `WECMS DEV/WECMS_STATIC/web/nxisas/js/nxisas_v2.js:1729` (`callNxisas`), `:2073/2187/2227/2245` (`_v2nxisas.callback(_v2nxisas.orgObj)`), `:2156-2162` (`orgObj[seq].result = res2`) | The callback payload is `orgObj[]`, each entry carrying `result[]` of job records with `Output` |
| `WECMS DEV/WECMS_STATIC/ts-src/js/jex/wabooks/trns/trns_0001_007.ts:2144-2175` | Legacy transfer result mapping — verbatim `ErrorCode`, last-job-wins, `Result.transfer[0]` field set |
| `.../trns_0001_001.ts:1767-1799` | Identical mapping on the sibling bulk screen — confirms it is the module convention, not a one-off |
| `.../trns_0001_007.ts:138-141` + `trns_0001_001.ts:210-213` | `getScrapingMessage` — one special case (`80002411`), otherwise the bank's `ErrorMessage` |
| `WECMS DEV/WECMS/web/view/jex/wabooks/trns/trns_0003_001_view.jsp:158` | `status="99999999"` — the ONLY occurrence of the value in the whole `trns` module; a filter radio |
| `WECMS DEV/WECMS/web/WEB-INF/action/jex/wabooks/trns/trns_0003_001_r001_act.jsp:73-81` | The sentinel translates to `TRNS_STTS <> '00000000'`; never bound to a column |
| `WECMS DEV/WECMS/web/WEB-INF/action/jex/wabooks/trns/trns_0002_001_c001_act.jsp` | Legacy insert: validates required fields + positive amount, then inserts. No status check, no requested-vs-actual comparison |
| `WECMS DEV/WECMS_ETC/xml/service/WSVC/WSVC.trns_0002_001_c001.xml` | Legacy input contract — `TRNS_STTS` length 20, **not** required; `TRS_ID` present for the duplicate check only |
| `wecms-api/docs/features/banking/internal-transfer-vnd/transfer-history/functional-specification.md:30` | The refactor's own spec: *"The `99999999` value is a UI sentinel — it is never stored."* |

Verified root cause: **confirmed** (see `## Root Cause`).

## Root Cause

`parseEngineOutcome()` performed a flat top-level field read on a nested engine payload, so
`trnsStts` was always `null` and the request builder replaced it with the hardcoded
`"99999999"` sentinel. Nothing about the engine, the backend, or the database was wrong.

## Implementation

Single file: `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx`
(plus one EN locale key).

1. **`findTransferOutput(raw, depth)`** — new; transfer twin of the existing
   `findBalanceOutput`. Walks `array → .result[] → .Output`, keeping the LAST job's `Output`
   at each level so legacy's "assign on every iteration" selection is reproduced. Falls back
   to a bare job record and to an already-`Output`-shaped object; depth-bounded, never throws.
2. **`parseEngineOutcome(raw)`** — rewritten. `trnsStts` = `Output.ErrorCode` verbatim
   (normalized to `""` when absent, matching legacy's `TRNS_STTS: ""` initializer);
   `trnsMsg` = `Output.ErrorMessage`. Success branch gated on
   `ErrorCode === "00000000" && Result.transfer[0]` exactly as legacy, returning
   `actualAmt` (`remitAmt`), `fee`, `memo`, `memo2`, `acceptName`. `bankTxId` stays `null` —
   legacy maps no engine field to `TRS_ID` on this screen.
3. **`parseEngineAmount(raw)`** — normalizes an engine amount to VND integer digits
   (`"3.362.692"` / `"3,362,692"` / `"3362692.00"` → `"3362692"`); unparseable → `null` so
   the caller falls back to the composed amount, which is what legacy's else-branch stores.
   Required because the intake DTO constrains the amount to `\d{1,15}`, and a 400 here would
   discard the record of a transfer the bank may already have made.
4. **`clampWire(value, maxLen)`** — trims engine strings to the DTO `@Size` ceilings for the
   same reason; blank → `null` so `??` falls through to the composed value.
5. **`toWireFee(raw)`** — `Result.transfer[0].fee` → the wire's numeric `fee`.
6. **Request builder** — `trns_stts: outcome.trnsStts ?? ""` (sentinel deleted);
   `actual_amt` / `fee` / `rmrk` / `rmrk2` / `target_owac_nm` now prefer the bank-echoed
   values and fall back to the composed ones. `source_*` / `target_*` keys and `ccy_cd` stay
   composed deliberately (Spring re-validates ownership on them and pins CCY to VND; echoing
   a bank-formatted variant could only turn a completed transfer into a rejected intake).
7. **`getScrapingMessage(code, msg, t)`** — port of legacy `trns_0001_007.getScrapingMessage`.
   `80002411` → the fixed legacy sentence (new key
   `own_account_transfer.composer.error.engine_80002411`, EN text copied verbatim from the
   legacy ML default); every other code shows the bank's `ErrorMessage`. The generic sentence
   remains only as the last fallback when the engine reported no message at all.
8. **Error dialog** — `description: getScrapingMessage(resp.trns_stts, outcome.trnsMsg, t)`,
   `errorCode: resp.trns_stts` (the verbatim engine code).
9. `parseEngineOutcome` + `getScrapingMessage` exported for the regression tests.

## Files Changed

- `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx`
- `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.engineOutcome.test.ts` (new)
- `locales/en.json` (one key added)
- `lib/types/api.ts` (wire-contract doc comments corrected — no shape change)

## API Impact

No endpoint, method, or field-name change. Field **values** change:
`trns_stts` now carries the verbatim engine code instead of `99999999`; `trns_msg`, `fee`,
`rmrk`, `rmrk2`, `target_owac_nm`, `actual_amt` now carry bank-echoed values on success.
Two paired backend validation relaxations are required so a legacy-shaped payload is
accepted — see the backend record.

## UI Impact

The error dialog now shows the bank's own message and the real engine code. A genuinely
successful transfer now takes the success path (dialog closes, list refreshes) instead of
reporting a false failure.

## Database Impact

NONE (frontend) — database dependency only.

No schema change on either side. `NAPAS_REMIT_TRNS_HSTR` stops receiving the invalid
`TRNS_STTS = '99999999'` value and starts receiving legacy-shaped codes. Backend validation
changes live in
`wecms-api/docs/bugs/internal-transfer-intake-legacy-parity-2026-08-18.md`.

## Integration Impact

NXiSAS engine contract is unchanged — the fix only reads the payload the bundle already
returns. `POST /nxisas/decrypt` round-trip preserves the shape either way (flag-gated
pass-through).

## Verification

See `## Test Evidence`.

### Automated Tests

- Test: `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.engineOutcome.test.ts` (15 cases)
- Result: PASS

### Regression Review

- Areas checked: balance-refresh parser (`findBalanceOutput` / `parseBalanceOutcome`,
  untouched), `isLoginCancelled` cancel path (untouched), Transfer History `99999999`
  failed-filter (untouched — separate module, still a filter-only sentinel), the
  NAPAS `BANK_CD` duplicate fix from `f6031d9`.
- Result: PASS — see the test-result record.

### Manual Verification

- Environment: LOCAL
- Steps: not performed — executing a real transfer requires a licensed NXiSAS engine origin
  plus live bank credentials.
- Result: NOT RUN

## Result

Internal Transfer now records the engine's actual outcome. `99999999` is no longer produced by
this screen. A successful bank transfer takes the success path; a failed one shows the bank's
own message and its real code, and is stored with that code — matching legacy.

Code + tests + docs complete and verified locally (15/15 new cases, red-check confirmed,
typecheck + lint clean, no new suite failures). **READY FOR MANUAL COMMIT** — nothing was
committed, pushed, merged, or deployed. Must ship together with the paired `wecms-api` change.

## Known Limitations / Follow-up

1. **OTP / transfer-password retry affordances not ported.** Legacy branches on
   `trns_0001.errorOTPCode` / `errorTrnsPwdCode` and re-prompts. The refactor shows the code
   and message and keeps the composer open for a manual retry.
2. **`bank_tx_id` intentionally empty.** Legacy maps no engine field to `TRS_ID` on this
   screen, so `TRNS_STLM_ID` stays NULL and the duplicate-settlement guard never fires —
   matching legacy. A future decision could populate it, but that would activate a rejection
   path legacy does not have.
3. **`FEE_DFR_SBJ` vocabulary divergence (pre-existing, NOT fixed here).** Refactor writes
   `A`/`B`; legacy writes `1`/`2` (`FeeDfrSbjType`). Migration-relevant; needs PO approval.
4. **`source_acct_no` / `target_acct_no` / `ccy_cd` stay composed**, where legacy overwrites
   them from `Result.transfer[0]`. Deliberate: Spring validates ownership on those keys.
   Identical values in the normal case.
5. **KO / VI text for `engine_80002411` not added.** The legacy translations live in the DB
   ML table (`trns_0001_007_js80002411`), not in the repo. EN is committed; the provider's
   EN-fallback covers KO/VI until someone with DB access supplies them.

## Test Evidence

Test result:
[Internal Transfer Engine Result Parsing — Test Result](../testing/results/internal-transfer-engine-result-parsing-test-result-2026-08-18.md)

Final test result:    PASS
Regression coverage:  PASS
