# Internal Transfer — Remaining Legacy-Parity Differences (Sweep)

**Date:** 2026-08-18
**Type:** PARITY FIX
**Current Work Classification:** BUG
**Status:** IN PROGRESS
**Repository:** wecms-web
**Issue:** —
**Prior record (engine-result parsing fix, same feature):** [internal-transfer-engine-result-parsing-2026-08-18.md](internal-transfer-engine-result-parsing-2026-08-18.md)
**Paired backend record:** `wecms-api/docs/bugs/internal-transfer-legacy-parity-sweep-2026-08-18.md`

## Problem

The 2026-08-18 engine-result-parsing fix closed the `99999999` defect on the TRANSFER path but
left 7 documented differences from legacy JEX. This record covers closing them.

## Scope (the 7 items)

1. OTP / transfer-password retry behaviour (`errorOTPCode` / `errorTrnsPwdCode` branches).
2. `FEE_DFR_SBJ` stored as `A`/`B` where legacy stores `1`/`2`.
3. Balance-refresh `acct_bal_inq_stts: parsed.status ?? "99999999"` synthetic fallback.
4. `source_acct_no` / `target_acct_no` / `ccy_cd` — composed vs engine-echoed.
5. Save-then-notify ordering vs legacy `WBE1135`-then-save.
6. `engine_80002411` EN-only vs legacy ML EN/KO/VI.
7. End-to-end verification as far as the environment allows.

Plus two backend review items: `requested_amt` retention, and the now-unreferenced
`WBE_OAT_AMOUNT_MISMATCH` message key.

## Out of Scope

Anything outside Internal Transfer (Own Account Transfer) and its directly shared logic.

## Expected Behavior

Legacy JEX is the source of truth for every item. Traced from source before any code change —
findings recorded in `## Legacy Investigation` below.

## Legacy Investigation

All findings traced from source on 2026-08-18. Own Account Transfer = legacy `trns_0001_007`;
the sibling bulk screen `trns_0001_001` is quoted where it corroborates.

### The dialog primitive — what `showMessage` / `WBE1135` actually do

This underpins items #1, #3 and #5, so it is established first.

| Fact | Evidence |
|---|---|
| `_v2common.app.showMessage(code, dobj, callback)` derives the dialog *type* from `code.substring(2,3)` — `E`→error icon, `W`→warning, `I`→information, `C`→confirmation | `WECMS_STATIC/web/assets_v2/add.js:598`, `:665-696` |
| Only `C` codes render a **Cancel + Yes pair**. Everything else renders a **single OK** button | `add.js:751-770` |
| `WBE1135` is `E` → single OK. Its body template is literally `#{MSG}` — the dialog text IS the bank's message, nothing else | `add.js:665`; `WECMS_ETC/xml/code/RSPS_CD/CD_WBE1135.xml:6-8` (EN/KM/KO/VI all `#{MSG}`) |
| For `E` codes the primitive appends `<br>(오류코드: <code>)` — and `<code>` at that point is **`WBE1135`**, not the bank code | `add.js:713-717` |
| The `callback(boolean)` contract: **OK → `true`**, **X close → `false`**, Enter-on-primary → `true`, Enter-on-cancel → `false`. No ESC and no overlay-click handler exists for `.alert` | `add.js:404-451` |

So a legacy "error popup" with a save inside `if (response)` means: **OK saves, the X does not.**

### Item 1 — OTP / transfer-password retry

**The retry does not exist.** All three non-cancel branches are byte-identical in behaviour; the
"re-prompt" is an unimplemented `TODO`. Verbatim from `trns_0001_007.ts:857-905`
(identical at `trns_0001_001.ts:706-753`):

| Branch | Condition | Message shown | Saves? |
|---|---|---|---|
| cancel | `TRNS_STTS == "LOGIN_CAN"` (`:862`) | none — `closeProgressBar()` only | **no** |
| transfer password | `trns_0001.errorTrnsPwdCode.includes(...)` (`:865`) | `WBE1135` with `dObj = {dataObj:{MSG: result.TRNS_MSG}}` — the **raw** bank message (`:859`) | yes, `if (response)` → `fnTransferConfirmationCallback` (`:867-871`) |
| OTP | `trns_0001.errorOTPCode.includes(...)` (`:876`) | `WBE1135` with the same **raw** `dObj` | yes, `if (response)` (`:878-882`) |
| `8000F110` | `=== "8000F110"` (`:886`) | `showMessage("WBE9999")` — **no dObj, no callback** | **no** |
| everything else | else (`:889`) | `WBE1135` with `dObj2 = {dataObj:{MSG: getScrapingMessage(TRNS_STTS, TRNS_MSG)}}` (`:893-898`) | yes, `if (response)` (`:900-905`) |

1. **OTP codes** — hardcoded array `trns_0001.errorOTPCode` at `trns_0001_001.ts:167-168`:
   `80003270, 80003271, 80003272, 80003273, 80003274, 80003275, 80003276, 80003277, 80003278,
   8000327A, 8000327B, 8000327C, 8000327D` (13 codes).
2. **Transfer-password codes** — `trns_0001.errorTrnsPwdCode` at `trns_0001_001.ts:170-171`:
   `80003230, 80003231, 80003233, 80003234, 80003235, 80003236` (6 codes). **The comment on
   `:169` lists seven and includes `80003232`, but the array omits it** — so `80003232` falls
   through to the generic `else` branch. A legacy quirk to reproduce verbatim, not to "fix".
3. **Hardcoded, not configured, not bank-specific.** Both arrays live on the shared `trns_0001`
   object; no bank code, `PRDT_TYPE`, or config is consulted anywhere in the branch.
4. **UI per code** — see the table. Only two distinct message sources (raw `TRNS_MSG` for
   OTP/password, `getScrapingMessage(...)` for the generic branch) plus the generic `WBE9999`
   for `8000F110`.
5. **No retry request is issued.** `fnTransferConfirmationCallback` posts `trns_0002_001_c001`
   (the history INSERT) — it never re-invokes the engine. Retrying means the user pressing Next
   again by hand.
6. **Values retained between retries:** all of them — the composer stays populated; the
   `TODO: redirect to first page (Transfer Page with the entered data)` on `:889-891` was never
   implemented, so nothing is cleared.
7/8. **Result saved before retry?** The failed row is saved *on OK*, before any manual retry —
   `fnTransferConfirmationCallback(result)` writes `NAPAS_REMIT_TRNS_HSTR` with the failure
   `TRNS_STTS` (`trns_0001_007.ts:2207-2255`).
9. **Retry succeeds** → `TRNS_STTS == "00000000"` → save + `WBI1137` "The transfer request has
   been completed." (`:853-856`, `:2245-2249`; `CD_WBI1137.xml`).
10. **Retries keep failing** → one more failure row per confirmed dialog. No escalation.
11. **No attempt limit** anywhere in the transfer flow. (Engine-side OTP retry limits are the
    bank's; JEX counts nothing.)
12. **No bank-specific branch** in the error handling. Bank-specific code exists only in the
    *request* build (`:1900-2015` job/field selection per `BANK_CD`).

### Item 2 — `FEE_DFR_SBJ`

Legacy persists **`"1"` / `"2"`**, and the same value feeds the engine.

| Step | Evidence |
|---|---|
| View radios carry `value="1"` (Sender pays, `data-jex-ml=trns_0001_007_m012`, default `checked`) and `value="2"` (Recipient pays, `m013`) | `WECMS/web/view/jex/wabooks/trns/trns_0001_007_view.jsp:177-183` |
| `trns_fee_val = "1"` when the sender radio is checked, else `"2"`; the disabled-recipient path hardcodes `"2"` | `trns_0001_007.ts:596-600` |
| carried as `REC3.TRNS_FEE_VAL` → `feePaymentType` | `:787`, `:1904` |
| **engine** input: `_input_bal.feePaymentType = feePaymentType` | `:2086` |
| **DB**: `transferObj1.FEE_DFR_SBJ = feePaymentType` | `:2182` |
| enum: `SENDER_PAYS("1")`, `RECEIPIENT_PAYS("2")` — only two values, no split | `WECMS/src/wabooks/enums/FeeDfrSbjType.java:8-9` |
| server validation: `validateFeeDfrSbjType` → `FeeDfrSbjType.fromValue(str)`; null → `WBE0001` | `trns_0002_001_c001_act.jsp:49-51`; `ValidationHelper.java:5019-5025` |
| column: `NAPAS_REMIT_TRNS_HSTR.FEE_DFR_SBJ`, `length="1"` on the wire rule | `WSVC.trns_0002_001_c001.xml:41` |

So **one value, `1`/`2`, for both the engine and the column.** No legacy reader expects `A`/`B`.

### Item 3 — Balance refresh: legacy NEVER persists a failure status

This is the biggest correction to the earlier assumption. Legacy **returns before the save call**
on any non-success status, so `ACCT_MSTR.ACCT_BAL_INQ_STTS` is only ever written as `00000000`.

`trns_0001_007.ts:1709-1734` (identical logic at `trns_0001_001.ts:1305-1323`):

```js
if (input.ACCT_BAL_INQ_STTS == "00000000") {
    if (common.app.isEmpty(input.BAL)) {                       // :1711
        _v2common.app.showMessage('WBE6021', {dataObj:{FIELD_NM:"Balance"}});
        return;                                                // ← no save
    }
} else {
    if (input.ACCT_BAL_INQ_STTS === "8000F110") {              // :1722
        _v2common.app.showMessage("WBE9999");
    } else if (STTS != "" && MSG != "") {                      // :1724
        _v2common.app.showMessage("WBW1103", {dataObj:{ERR_MSG:"["+STTS+"] : "+MSG}});
    }
    return;                                                    // ← no save
}
const jexAjax = jexjs.createAjaxUtil("trns_0001_001_u001");    // :1736 — success only
```

1. **Where called** — the Update Balance button → `runScraping` with a `BALANCE` job →
   `trns_0001_007.ts:1635-1660` callback.
2. **Response structure** — `orgObj[] → obj.result[] → obj2.Output`, with `ErrorCode` /
   `ErrorMessage` and, on success, `Output.Result.balance[0]` (`:1639-1656`).
3. **Who reads `ErrorCode`** — `balObj.ACCT_BAL_INQ_STTS = objOutput.ErrorCode` verbatim
   (`trns_0001_007.ts:1645`; `trns_0001_001.ts:1264`). Success fields:
   `Result.balance[0].{acctNum, availableBal, balance, currency}` (`:1650-1653`).
4. **DB field** — `ACCT_MSTR.ACCT_BAL_INQ_STTS` / `_MSG` / `_LST_INQ_DTM` via
   `trns_0001_001_u001` (`trns_0001_001_u001_act.jsp:93-99`).
5. **Blank `ErrorCode`** → not `"00000000"` → else branch → **no save**, and with a blank message
   too, the `STTS != "" && MSG != ""` guard fails so **no dialog is shown at all**.
6. **`99999999` is never stored** — it appears nowhere in the balance path.
7. **`99999999` in the whole `trns` module = one occurrence**, the Transfer History Failed filter
   radio (`trns_0003_001_view.jsp:158` → `trns_0003_001_r001_act.jsp:73-81` → `TRNS_STTS <> '00000000'`).
8. **Balance errors show the raw code AND raw message**: `WBW1103` renders
   "An error occurred during the Online Account Inquiry process.`<br>`[`<code>`] : `<message>`".
   `8000F110` is the one exception → generic `WBE9999`.
9. **Success requires `ErrorCode == "00000000"` *and* a non-empty `BAL`** — otherwise `WBE6021`
   ("Balance is required.") and no save.

> The `trns_0001_001_u001_act.jsp` action *would* store a failure code if it were ever called
> (`:93-99` patch STTS/MSG/DTM unconditionally, then gate the balance patch on `00000000` at
> `:105`) — and the Korean spec comment on `:101-103` says exactly that. But **no caller passes a
> failure**: both screens return first. The gate is on the client.

### Item 4 — which fields legacy overwrites from the engine result

`trns_0001_007.ts:2156-2172` (identical at `trns_0001_001.ts:1776-1798`):

| Column | On success (`ErrorCode=="00000000" && Result.transfer`) | On failure (else) |
|---|---|---|
| `OUT_ACCT_NO` | `Result.transfer[0].acctNum` (`:2157`) | composed `acct_no` (`:2167`) |
| `IN_ACCT_NO` | `Result.transfer[0].remitAcctNum` (`:2163`) | composed `remitAcctNum` (`:2168`) |
| `CCY_CD` | `Result.transfer[0].currency` (`:2158`) | composed `ccyCd` (`:2170`) |
| `TRSC_AMT` | `.remitAmt` (`:2159`) | composed `remitAmt` (`:2171`) |
| `FEE` | `.fee` (`:2160`) | *not set* |
| `RMRK` / `RMRK2` | `.memo` / `.memo2` (`:2161-2162`) | `memo` only (`:2172`) |
| `OWAC_NM` | `.acceptName` (`:2164`) | composed `acceptNm` (`:2169`) |

3. **Always present?** Guarded by `objOutput.Result.transfer` being truthy — legacy assumes the
   array and `[0]` exist once that guard passes.
4. **Formatting differs** — deliberately, for product `H`: the request converts
   `100…`→`DDA…` for bank `11704020` before the scrape (`:2036-2044`), the bank echoes the `DDA`
   form, and `fnTransferConfirmationCallback` converts it **back** to `100…` before the INSERT
   (`:2218-2228`). For non-`H` tenants the echoed value equals the requested one.
5. **Overwrites on success only** — the else-branch restores the composed values.
6. See the table's failure column.
7. **Inserted into DB:** whichever of the two the branch selected, after the `H` re-conversion.
8. **No post-engine ownership re-validation.** `trns_0002_001_c001_act.jsp:27-56` (`valiateInput`)
   checks required-ness, `TransType`, `CcyCd`, positive amount and `FeeDfrSbjType` — it never
   looks the account up in `ACCT_MSTR`.
9. Therefore legacy can never reject a completed transfer on account formatting; the refactor's
   ownership re-validation is a refactor-only addition and must not be fed engine-echoed values.

### Item 5 — save/notify ordering

Established by the primitive analysis above:

```
engine finishes → callback evaluates TRNS_STTS
  ├─ "00000000"        → closeProgressBar → SAVE   → WBI1137 success dialog
  ├─ "LOGIN_CAN"       → closeProgressBar          (no dialog, no save)
  ├─ "8000F110"        → WBE9999 dialog            (no save)
  └─ any other code    → WBE1135 error dialog → user clicks
                              OK (true)  → SAVE
                              X  (false) → NOTHING SAVED
```

1. Engine finishes at the `runScraping` callback (`:2127`), resolved with `_v2nxisas.orgObj`
   (`nxisas_v2.js:2073/2187/2227/2245`).
2. Success/failure evaluated at `trns_0001_007.ts:853`.
3. `WBE1135` displayed **before** the save on every failure branch.
4. It is an **error popup with a single OK**, not a confirm — but its callback still distinguishes
   OK (`true`) from the X (`false`) (`add.js:404-421`).
5. **Yes — the user must click OK before the failure row is written.**
6. The save is `trns_0002_001_c001` via `fnTransferConfirmationCallback` (`:2207-2255`).
7. **Failure history is NOT always saved** — see 5, and `8000F110` / `LOGIN_CAN` never save.
8. **Yes — dismissing with the X prevents the save entirely.**
9. **Success is a different order**: save first, then `WBI1137` (`:854-855`, `:2245-2249`).
10. No bank-specific branch in this sequence.

### Item 6 — `trns_0001_007_js80002411` multilingual source

- `getScrapingMessage` is a 3-line function: `if (code == "80002411") return ML.get('trns_0001_007_js80002411', "<EN default>"); else return msg;`
  — `trns_0001_007.ts:138-141`, identical at `trns_0001_001.ts:210-213` (which uses the key
  `trns_0001_001_js80002411`) and `trns_0001_001_v001.ts:227`.
- **EN** is verifiable: the inline `ML.get` default —
  `"The sender account cannot be transferred.Please use another sender account."` (missing space
  after the period is in the source; reproduced verbatim).
- **KO / VI are NOT in the repository.** `ML.get` reads the JEX ML table at runtime.
  `WECMS_SYNC/dbSync/AD_DST_MGNT/{ML_COM,ML_DIC,ML_NOMAL}` contains 157 + n files and **none**
  for `trns_0001_007` (`ML_NOMAL` holds only `bltb_0001_001.json`); a repo-wide
  `grep -rl "trns_0001_007_js" --include=*.json` finds nothing. No Postgres MCP is wired in this
  session, so the ML rows cannot be read either.
- **Language is selected client-side** — `ML.get(key, default)` resolves against the
  page's pre-loaded `multiLanguagesObj` for the session language.
- **`80002411` is the only special case** in `getScrapingMessage`. Two *other* codes get bespoke
  handling elsewhere in the same flow: `8000F110` → `WBE9999`, and `LOGIN_CAN` → silence.
- **Missing translation** → `ML.get` returns the inline EN default.
- Equivalent refactor mechanism already exists: `locales/{en,ko,vi}.json` with an EN fallback
  chain at `lib/i18n/LocaleProvider.tsx:99-101`
  (`MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key`).

**Verified EN/KO/VI *are* available for the three RSPS_CD messages this sweep needs**, straight
from the repo — so those get real translations rather than fallbacks:

| Code | EN | KO | VI |
|---|---|---|---|
| `WBE9999` | ✅ | ✅ | ✅ (`CD_WBE9999.xml`) |
| `WBW1103` | ✅ | ✅ | ❌ **absent** — the XML has EN/KM/KO only (`CD_WBW1103.xml`) |
| `WBE6021` | ✅ | ✅ | ✅ (`CD_WBE6021.xml`) |

## Root Cause

Per-item; see `## Legacy Investigation`. Two findings overturned assumptions carried into this
task:

- **There is no OTP re-prompt in legacy** — the branches are `TODO` stubs that behave identically
  to the generic error branch. Nothing to port.
- **Legacy never persists a failed balance-inquiry status** — the client returns before the save
  call, so `ACCT_MSTR.ACCT_BAL_INQ_STTS` only ever holds `00000000`. The refactor was writing
  failure codes (and a synthesized `99999999`) that cannot occur in legacy data.

## Implementation

`components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx`:

1. **Legacy code tables ported verbatim** — `OTP_ERROR_CODES` (13) and
   `TRANSFER_PASSWORD_ERROR_CODES` (6, `80003232` deliberately absent) from
   `trns_0001_001.ts:167-171`, plus `ENGINE_CODE_UNEXPECTED = "8000F110"`.
2. **`resolveTransferErrorMessage(code, msg, t)`** — reproduces legacy's three-way message
   selection: `8000F110` → generic sentence; OTP / transfer-password → the **raw** bank
   `ErrorMessage`; everything else → `getScrapingMessage` (so `80002411` substitutes). Wired into
   the failure dialog in place of the unconditional `getScrapingMessage` call.
3. **`resolveBalanceErrorMessage(code, msg, t)`** — `8000F110` → generic; code AND message
   non-blank → the `WBW1103` sentence with the raw `[code] : message` detail; otherwise `null`
   (legacy shows no dialog at all).
4. **Balance refresh now gates the POST** exactly where legacy gates the AJAX: non-success status
   → message (or silence) and `return`; success with `bal === null` → the `WBE6021` "Balance is
   required." message and `return`; only a success-with-balance reaches
   `postBalanceRefresh`, with `acct_bal_inq_stts` hard-set to `"00000000"`. The
   `?? "99999999"` fallback is **deleted** — the last synthesized status in the feature.
   No list reload on the failure paths (legacy returns before it).
5. **`EngineOutcome` gains `outAcctNo` / `inAcctNo` / `ccyCd`** from
   `Result.transfer[0].{acctNum, remitAcctNum, currency}`, shipped as the new optional wire
   fields `engine_out_acct_no` / `engine_in_acct_no` / `engine_ccy_cd`. The composed
   `source_*` / `target_*` / `ccy_cd` stay exactly as they were, so the backend's ownership and
   VND checks keep running on user-selected values.

`locales/{en,ko,vi}.json` — three keys added, text lifted **verbatim** from the legacy RSPS_CD
XML by a script (`scratchpad/addLocaleKeys.js`) rather than hand-typed:
`engine_unexpected` ← `CD_WBE9999.xml` (EN/KO/VI), `balance_inquiry_failed` ← `CD_WBW1103.xml`
(EN/KO — the XML has no VI), `balance_required` ← `CD_WBE6021.xml` (EN/KO/VI).

`lib/types/api.ts` — the three `engine_*` fields plus a note that `fee_dfr_sbj` stays `A`/`B` on
the wire and is converted at the DB boundary.

## Files Changed

- `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx`
- `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.engineOutcome.test.ts` (extended 15 → 45 cases)
- `components/banking/own-account-transfer/OwnAccountTransferComposerDialog.locales.test.ts` (new, 7 cases)
- `locales/en.json` · `locales/ko.json` · `locales/vi.json`
- `lib/types/api.ts`

## API Impact

Additive only. Three new **optional** request fields on
`POST /api/v1/banking/own-account-transfer/scraping-result`. No field removed, no field renamed,
no response change. `POST /balance-refresh` is now called **less often** (success only) with
`acct_bal_inq_stts` always `"00000000"` — a strict subset of what it already accepted.

## UI Impact

- Failure dialogs now show the message legacy shows for that code class.
- A failed balance inquiry no longer overwrites the account's stored inquiry status, so the
  source-list **"Last refresh"** column (`source-accounts-columns.tsx:79` ←
  `mappers.ts:51` ← `acct_bal_inq_stts`) keeps the last **successful** result instead of
  flipping to "Failed" — matching legacy, and explaining the "Thất bại" the reporter saw.
- Blank-code/blank-message balance failures are now silent, as in legacy.

## Database Impact

NONE (frontend) — database dependency only.

Stored **values** change (no schema change): `FEE_DFR_SBJ` starts receiving `1`/`2`, and
`ACCT_BAL_INQ_STTS` stops receiving failure codes / `99999999`. Detection SQL for pre-existing
drift and the backend half live in
`wecms-api/docs/bugs/internal-transfer-legacy-parity-sweep-2026-08-18.md`.

## Integration Impact

None. The NXiSAS contract is unchanged — the fix only reads fields the bundle already returns
(`acctNum`, `remitAcctNum`, `currency`) and reorders local control flow.

## Verification

See `## Test Evidence`.

### Automated Tests

- Test: `OwnAccountTransferComposerDialog.engineOutcome.test.ts` (45) +
  `OwnAccountTransferComposerDialog.locales.test.ts` (7)
- Result: PASS — 52/52

### Regression Review

- Areas checked: `parseBalanceOutcome` / `findBalanceOutput` (untouched), `isLoginCancelled`
  cancel path (untouched), Transfer History `99999999` filter (separate module, untouched),
  the `f6031d9` NAPAS duplicate-`BANK_CD` fix.
- Result: PASS — see the test-result record.

### Manual Verification

- Environment: LOCAL
- Steps: not performed — a real transfer or balance inquiry needs a licensed NXiSAS engine
  origin plus live bank credentials.
- Result: NOT RUN — **SIT NOT VERIFIED**

## Result

Six of the seven items are matched or closed with evidence; item 5 is a deliberate, documented
safety divergence and item 6 is partially blocked on DB-only ML text. `99999999` is now absent
from every Internal Transfer write path.

Code + tests + docs complete and verified locally. **READY FOR MANUAL COMMIT** — nothing
committed, pushed, merged, or deployed. Ships together with the paired `wecms-api` change.

## Known Limitations / Follow-up

1. **Item 5 — save/notify ordering: intentionally NOT matched.** Legacy gates the failure INSERT
   on the user clicking OK, so dismissing the dialog with the X discards the record of an
   executed transfer (`add.js:404-421` + `trns_0001_007.ts:867-905`). The refactor persists
   first, then notifies — it saves a superset of what legacy saves and can never lose a row.
   Changing this would knowingly introduce data loss; per the task's own instruction it is
   documented rather than silently altered.
2. **`8000F110` still persists** in the refactor where legacy skips the INSERT. The *display* is
   now legacy-faithful (generic sentence, bank text suppressed). The skip looks incidental in
   legacy — its sibling flows (`fnsh_0001_001.ts:1262-1276`) do persist on `8000F110` — and
   suppressing a history row for a code that may follow a real bank action is the unsafe
   direction. Flagged, not silently adopted.
3. **`engine_80002411` KO/VI remain EN fallbacks.** The text is an ML-table row
   (`trns_0001_007_js80002411`); it is in neither the repo nor a reachable DB this session.
   Needs one DB read to close — `SELECT` the ML row for that key.
4. **Dialog variant vs legacy chrome.** Legacy renders balance failures through `WBW1103`
   (a *warning*) and prints its own `(오류코드: WBE1135)` rather than the bank code. The refactor
   uses the `error` variant per `wecms-web/CLAUDE.md` §"Dialog variant" and shows the real engine
   code (explicitly requested). Cosmetic, deliberate.
5. **Product-`H` DDA↔100 conversion not ported** (`trns_0001_007.ts:1702-1706`, `:2036-2044`,
   `:2218-2228`). It is a `PRDT_TYPE='H'` gate and belongs with the HAENGSUNG work, not this
   sweep. The engine-echo channel now records whatever form the bank returns, so nothing is lost.

## Test Evidence

Test result:
[Internal Transfer Legacy-Parity Sweep — Test Result](../testing/results/internal-transfer-legacy-parity-sweep-test-result-2026-08-18.md)

Final test result:    PASS
Regression coverage:  PASS
