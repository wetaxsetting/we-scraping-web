# Update Balance shows "Balance is required." on SIT — Audit

**Date:** 2026-08-18
**Type:** AUDIT / INVESTIGATION
**Current Work Classification:** AUDIT
**Finding Classification:** BUG (pre-existing, exposed) — root cause CONFIRMED: undecrypted engine payload + UPPER_SNAKE/snake_case wire mismatch on /nxisas/decrypt
**Investigation Status:** COMPLETE
**Approval Status:** APPROVED (2026-08-18, user) — implementation tracked in `docs/bugs/nxisas-decrypt-wire-contract-fix-2026-08-18.md`
**Implementation Status:** COMPLETE (in the separate BUG records — `wecms-web/docs/bugs/nxisas-decrypt-wire-contract-fix-2026-08-18.md` + the `wecms-api` twin); both at READY FOR MANUAL COMMIT, not deployed. The audit itself stays as the evidence of record and is NOT converted.
**Repository:** wecms-web
**Related record (introduced the message):** [internal-transfer-legacy-parity-sweep-2026-08-18.md](../bugs/internal-transfer-legacy-parity-sweep-2026-08-18.md)

## Observed Behavior

SIT (`wecms.kosign.dev/banking/transfer-own-accounts`), Own Account Transfer composer,
Vietcom `0441000688210`. Pressing **Update Balance** — a balance-only scrape, no transfer —
opens an error dialog:

```
Error
Balance is required.
```

The composer still shows `Available Balance 3.362.692` and
`Last updated time: 14-Aug-2026 17:40:48`; the source row still reads `Success · 3d ago`.
So the balance was **not** refreshed.

## Expected Behavior

A successful balance scrape should update `ACCT_MSTR.BAL` / `REAL_AMT` /
`ACCT_BAL_LST_INQ_DTM` and refresh the displayed value.

## Scope

Why the message appears, and whether the underlying condition is a new defect, a pre-existing
one this message merely exposed, or an environment/configuration condition.

## Out of Scope

Any code change — this record stops at findings and a recommendation.

## Initial Evidence

- The exact string `"Balance is required."` is the value of the locale key
  `own_account_transfer.composer.error.balance_required`, added earlier today in the
  legacy-parity sweep (item 3) as the port of legacy `WBE6021` +
  `FIELD_NM = "Balance"` (`trns_0001_007.ts:1711-1715`).
- It renders only from the branch `if (parsed.bal === null)` — i.e. the engine reported
  `ErrorCode == "00000000"` **but no parseable balance value**.

## Investigation Plan

1. Establish whether the SIT build actually contains today's (uncommitted) change, or whether
   the string reaches SIT some other way.
2. Trace why `parseBalanceOutcome(...).bal` is `null` on a successful scrape.
3. Compare against the legacy balance flow, including any decrypt seam.
4. Determine what the pre-change behaviour was in the same situation.

## Findings

### F1 — The message is today's change, and SIT really is running it

`git show 1947524 --stat` (commit **`1947524` "fix(transfer): align internal transfer behavior with
legacy"**, 2026-08-18 15:32, on `wecms-ui-fixes`, in sync with `origin`) contains **all 17 files**
of the legacy-parity sweep, including `locales/en.json` (+4) and the
`if (parsed.bal === null)` gate at `OwnAccountTransferComposerDialog.tsx:928`. The only
uncommitted file in the tree is this audit. So SIT is running the **complete** change, not a
partial one — the dialog is genuinely reachable from the new gate and nothing else in the repo
produces the string `"Balance is required."`.

### F2 — The gate is legacy-correct; it is exposing a pre-existing failure, not causing one

The dialog renders **only** when the engine reported `ErrorCode == "00000000"` **and**
`parseBalanceOutcome(...).bal === null`. That is legacy `WBE6021`
(`trns_0001_007.ts:1711-1715`): success code but no usable `BAL` ⇒ show the message, **do not
save**.

What happened in the same situation **before** today's change:

| | Before | After |
|---|---|---|
| POST `/balance-refresh` | sent, with `bal: null` | not sent |
| `ACCT_MSTR.BAL` / `REAL_AMT` | **not** updated (`hasBalDelta` requires `req.bal() != null`, `OwnAccountTransferService:314-317`) | not updated |
| `ACCT_BAL_LST_INQ_DTM` | **advanced** — the row looked freshly refreshed | unchanged |
| User feedback | **none — silent no-op** | explicit error |

So the balance has been failing to refresh all along; the old code hid it by stamping a new
"last refreshed" timestamp on an unchanged balance. The screenshot corroborates this: the
composer still shows `Last updated time: 14-Aug-2026 17:40:48` and the row still says
`Success · 3d ago` — i.e. nothing has actually refreshed since 14 Aug.

**This is not a regression introduced today.** It is a pre-existing defect that the legacy-parity
gate made visible.

### F3 — Root cause candidate A: the engine payload is never decrypted (STRUCTURAL)

`parseBalanceOutcome` needs `Output.Result.balance[0].balance`
(`OwnAccountTransferComposerDialog.tsx:2100-2120`). If `Output.Result` is a **string** rather than
an object, `Array.isArray(result.balance)` is false, `balRow` falls back to the `Output` itself,
and `readNumber(out, ["balance","bal","BAL"])` finds nothing ⇒ **`bal === null`**, while
`ErrorCode` — which is plaintext — still reads `00000000`. Exactly the observed symptom.

Three independent facts say `Output.Result` most likely *is* still a ciphertext string here:

1. **The engine always encrypts `Output.Result`.** Established 2026-07-14 while fixing the
   identical symptom class on e-Invoice ("scrape success but no data"): the local NXiSAS engine
   returns `Output.Result` as Coocon SEED-CBC ciphertext **even for `00000000` successes** (proven
   from a PROD console capture). Recorded in memory `project_einvoice_scrape_seed_cbc_decrypt`.
2. **Client-side decrypt cannot work.** The vendor `nxisas_decrypt` (`nxisas_v2.js:1672`) routes
   through `lib/nxisas/jexjs-adapter.ts`'s `createAjaxUtil`, which **short-circuits
   `nxisas_decrypt` / `nxisas_encrypt` to a pass-through** (sync-XHR is banned and there is no
   Coocon JS cipher).
3. **OAT's server-side decrypt is switched off.** `decryptNxisasResult` POSTs to
   `/api/v1/banking/own-account-transfer/nxisas/decrypt`, which returns `NXISAS_DATA`
   **unchanged** unless `wecms.oat.seed-decrypt.enabled` is true
   (`OatSeedDecryptProperties:27-28` — `@DefaultValue("false")`; `OatNxisasService.decrypt:139-141`).
   No profile or env file sets it: `application.yml:84` and every `.env*.example` list it only as
   a commented default. The e-Invoice path was deliberately made **unconditional** for this exact
   reason, while OAT was left flag-gated on the assumption that "VND payloads mostly arrive
   plaintext there" — an assumption this SIT run appears to contradict.

Additionally, **OAT never sets `nonDecrypt` at all** — `grep -rn "nonDecrypt"` over
`components/banking/own-account-transfer/` and `lib/nxisas/` matches only `einvoiceScrape.ts`
(`true`) and `gdtCredentialValidate.ts` (`false`). `buildNxisasOrgObj` omits the field, so the
request does not even express an intent about who decrypts.

The 2026-07-14 memory's own closing warning applies verbatim: *"Any NEW scrape flow that reads
engine `Output.Result` MUST decrypt server-side; the client adapter cannot decrypt."*

### F4 — Root cause candidate B: `readNumber` cannot parse a dot-grouped amount (CONFIRMED BUG)

Even if the payload *is* plaintext, `readNumber`
(`OwnAccountTransferComposerDialog.tsx:2204-2214`) strips everything except digits, `.` and `-`,
then calls `Number(...)`. Reproduced exactly:

```
"3362692"      -> 3362692
"3,362,692"    -> 3362692
"3.362.692"    -> null        ← VND dot-grouping, the format the UI itself displays
"3362692.00"   -> 3362692
3362692        -> 3362692
""             -> 0           ← empty string becomes ZERO, not null
```

A VND balance formatted `3.362.692` therefore yields `null` and triggers the same dialog. Note the
inconsistency introduced by today's work: the TRANSFER path's new `parseEngineAmount` **does**
handle `"3.362.692"` correctly, while the BALANCE path's pre-existing `readNumber` does not.

The `"" -> 0` row is a separate latent hazard: an empty balance would be persisted as `0` rather
than refused — legacy explicitly guards this with `common.app.isEmpty(input.BAL)`
(`trns_0001_007.ts:1711`).

### F5 — No runtime diagnostics exist on this path (why we cannot yet pick A or B)

Legacy logs the raw engine payload before parsing it —
`console.log("objOutput >> ", objOutput)` (`trns_0001_007.ts:1642`; likewise
`trns_0001_001.ts:1263`). The refactor logs nothing in the balance path: the only `console.*`
calls in the feature are four `console.warn`s in `use-nxisas-engine.ts` for bundle-load failures.
So the payload that would settle A-vs-B is currently invisible.

**It is observable without any code change, however** — via the network round-trip that already
exists:

> On SIT, open DevTools → Network, click **Update Balance**, and inspect the
> `POST …/own-account-transfer/nxisas/decrypt` call.
> - **Request** `NXISAS_DATA` is the JSON-stringified raw engine result. If `Output.Result` is a
>   base64-looking string (possibly `ENC=`-prefixed) → **candidate A**.
> - If `Output.Result` is an object containing `balance[0]`, read `balance`'s formatting: dots as
>   thousands separators → **candidate B**.
> - Compare the **response** `NXISAS_DATA` with the request: byte-identical confirms the
>   flag-gated pass-through.

### F6 — Candidate A CONFIRMED from the SIT payload (2026-08-18, user-supplied)

The engine response captured on SIT (`nxisas_v2.js:2361` console dump, Vietcom
`GLOBAL/VNM/BANK_Vietcom` / `CORPORATE` / `BALANCE`):

```json
"Output": {
    "ErrorCode": "00000000",
    "ErrorMessage": "",
    "Result": "wKRY1V5sNJzjmcEojRJWlOlpPKCLkg818BLDR/pWw1/CdFPs+4IJyoHHtluBh0R2Mwsk…"
}
```

`Output.Result` is a **base64 SEED-CBC ciphertext string**, not an object. `ErrorCode` is plaintext
`00000000`. This is **exactly** the F3 shape, so:

`Array.isArray((result as {balance?}).balance)` → false → `balRow` falls back to the `Output` →
`readNumber(out, ["balance","bal","BAL"])` → **`bal === null`** → the `WBE6021` gate fires.

**Candidate B (F4) is NOT the active cause here** — the value never reaches a number parser at
all. F4 remains a real latent bug for whenever the payload does arrive plaintext.

### F7 — Why the decrypt round-trip does nothing: UPPER_SNAKE vs snake_case, in BOTH directions

The `POST …/nxisas/decrypt` response captured on SIT:

```json
{"status":{"error":false,"code":"WBI0000","message":"Success"},"data":{"nxisas_data":null}}
```

`nxisas_data: null` is the tell. The endpoint echoes its own input when the flag is off
(`OatNxisasService.decrypt:139-141`), so a `null` echo means **the request field never bound**:

| | Frontend sends / reads | Backend Java component | Wire name the backend actually uses | Match? |
|---|---|---|---|---|
| request | `NXISAS_DATA`, `NXISAS_UID`, `NXISAS_ACTION` (`lib/api/banking.ts:1438-1440`) | `NxisasDecryptRequest(String NXISAS_DATA, …)` | `nxisas_data`, `nxisas_uid`, `nxisas_action` | ❌ |
| response | reads `res.NXISAS_DATA` (`banking.ts:1444`) | `NxisasDecryptResponse(String NXISAS_DATA)` | `nxisas_data` | ❌ |

The global `PropertyNamingStrategies.SNAKE_CASE` (`JacksonConfig:25`) rewrites the Java component
`NXISAS_DATA` to the wire name `nxisas_data`, and **no `@JsonProperty` exists anywhere under
`ownaccounttransfer/dto/`** to pin the UPPER form. Spring Boot disables
`FAIL_ON_UNKNOWN_PROPERTIES` by default, so the UPPERCASE keys are silently discarded rather than
rejected — hence a `200 Success` with a null payload.

The DTO's own Javadoc asserts *"The endpoint accepts the UPPER_SNAKE form verbatim"* — **that claim
is false**; nothing implements it.

Consequence: **flipping `wecms.oat.seed-decrypt.enabled` would not fix this.** The service would
receive `null` as ciphertext, and even a successful decrypt would be unreadable because the
frontend looks for `res.NXISAS_DATA` while the backend emits `nxisas_data`. Both ends must be
aligned first.

**Proof by contrast — the e-Invoice decrypt path that was fixed on 2026-07-14 and works:**

| | e-Invoice (works) | OAT (broken) |
|---|---|---|
| Java components | `nxisasData` / `nxisasUid` / `nxisasAction` (camelCase → `nxisas_data` …) | `NXISAS_DATA` / … (UPPER → also `nxisas_data`, but the FE doesn't send that) |
| Frontend sends | `nxisas_data`, `nxisas_uid`, `nxisas_action` (`lib/api/addon.ts:183-185`) | `NXISAS_DATA`, … |
| Frontend reads | `res.nxisas_data` (`addon.ts:194`) | `res.NXISAS_DATA` |
| Decrypt gating | **unconditional** | flag, default **off** |

Same cipher, same engine, same `Output.Result` shape — the only differences are the casing and the
flag. That is why e-Invoice scraping returns data and OAT balance does not.

### F8 — The same casing bug silently disables two more OAT endpoints

`grep` for UPPER_SNAKE record components under `ownaccounttransfer/dto/` (none of which carry
`@JsonProperty`):

1. **`NxisasLoggingRequest(String JSON_STR)`** — the vendor bundle posts `JSON_STR`
   (`lib/nxisas/jexjs-adapter.ts:233` documents exactly that); the backend binds `json_str` → null →
   `OatNxisasService.recordLogging` hits its `req.JSON_STR() == null` guard and **returns without
   writing anything**. So the per-job `NXSIAS_MODULE_TRAN_LOG_HIS` audit rows have never been
   written from this screen. The SIT console confirms the call is made
   (`[nxisas] legacy JEX action "nxisas_logging" requested sync execution…`).
2. **`NxisasCertAcctListResponse`** — 2 UPPER_SNAKE components; any frontend reading them by the
   UPPER name gets `undefined`. Latent (not exercised by this flow).

### F9 — Legacy DOES decrypt, and the legacy console proves the before/after (2026-08-18, user-supplied)

Captured on legacy UAT `test.wecms.vn/trns_0001_001.act`, Shinhan
(`GLOBAL/GBL/BANK_Shinhan` / `COMMON` / `BALANCE`, acct `700022964690`). Two consecutive log
lines from the same bundle:

**`res before decrypt::` (`nxisas_v2.js:2345` / `:2373`)** — `Output.Result` is ciphertext:

```
"Result":"ZgN69QK239PBmaVhU7+GIBYDhs5kmAhiRA/plYaT3tmWWtm56IJ201YGvShaOWrblrQ/F4n+cqA/…"
```

**`thread(0) output` (`nxisas_v2.js:2385-2387`)** — the same field, now a parsed object:

```json
"Output": { "ErrorCode": "00000000", "ErrorMessage": "",
  "Result": { "balance": [ {
      "availableBal": "3553015", "balance": "3553015",
      "acctNum": "700022964690", "acctType": "DEMAND DEPOSIT-VND",
      "currency": "VND", "acctName": "CONG TY TNHH WEBCASH VIET NAM",
      "openDate": "20220823" } ] } }
```

The step between them is `nxisas_v2.js:2350-2355` (duplicated at `:2379-2383`):

```js
console.log("res before decrypt:: ", res);
…
/** Insert log and Decrypt data */
if ( (nonDecrypt undefined) || (!nonDecrypt) || 'LOGIN'==res[0].Job || 'CAPTCHA'==… || 'OTP'==…
     || 'QNA'==… || 'LOGOUT'==… ) {
    res = _v2nxisas.nxisas_decrypt( res );      // ← reassigns res with the decrypted array
}
console.log('---- thread('+thread+') output ----'); console.log(res);
if (res[0].Output.ErrorCode == '00000000') { callback_suc(res, seq) } else { callback_fail(…) }
```

Two consequences worth pinning:

- **Decrypt is the DEFAULT.** The guard fires when `nonDecrypt` is `undefined` — so OAT omitting
  `nonDecrypt` is *legacy-correct*, not a bug. (F3's "OAT never sets `nonDecrypt`" therefore needs
  softening: setting `nonDecrypt: true` would be the e-Invoice pattern, not the OAT one. Either
  works provided the server decrypts; leaving it undefined matches this screen's legacy.)
- **Decrypt happens BEFORE the success/fail dispatch** (`:2389`), so by the time
  `trns_0001_001.ts` / `trns_0001_007.ts` read `Result.balance[0].balance`, it is always a plain
  object.

Legacy's own decrypt contract (`nxisas_v2.js:1684-1704`):

```js
nxisas_decrypt : function(res){
    var jexAjax = jexjs.createAjaxUtil("nxisas_decrypt");
    _input['NXISAS_DATA']   = JSON.stringify(res);        // the WHOLE job array
    _input['NXISAS_UID']    = CooconiSASNX.OpenUid;
    _input['NXISAS_ACTION'] = CooconiSASNX.OpenAction;
    jexAjax.setting('async', false);                       // SYNCHRONOUS
    jexAjax.execute(function (rData) { _rtn = JSON.parse(rData.NXISAS_DATA); });
    return _rtn;
}
```

So legacy really does use **UPPER_SNAKE keys in both directions** — because JEX has no naming
strategy: `NXISAS_DATA` is the literal WSVC field id. **The refactor copied those key names into a
framework that renames them** (global `SNAKE_CASE`), which is precisely the F7 defect. The intent
was right; the mechanism silently rewrote it.

Also note: legacy's plaintext balance is `"3553015"` — **plain digits, no grouping**. So `readNumber`
would have parsed this bank's value correctly; **F4 is confirmed as not the active cause**, only a
latent robustness gap.

### F10 — The refactor's decrypt *service* is already correct; only the plumbing is broken

`SeedCbcDecryptService.walkAndDecrypt` (`common/nxisas/SeedCbcDecryptService.java:99-140`)
**recurses through arrays and object fields at any depth**, and its Javadoc explicitly calls out the
org-obj → `result[]` → `Output` shape. So it can decrypt the refactor's payload (which is the
assembled `orgObj` array, one level deeper than legacy's per-thread job array).

It also short-circuits on empty input (`:72-74` — `if (nxisasData == null || isBlank()) return
nxisasData;`), which is the final confirmation that a null-bound `NXISAS_DATA` produces nothing
**even with the flag on**.

Net: the cipher, the walker and the endpoint all exist and work. Only the **wire-name binding**
(F7) and the **flag** (F3.3) stand between the refactor and the same result legacy gets.

The refactor's async placement is fine, incidentally: legacy's sync XHR is impossible in a modern
browser (the console warning `[nxisas] legacy JEX action "nxisas_logging" requested sync execution;
running async` shows the adapter already handles that), and `decryptNxisasResult` is correctly
`await`ed before parsing.

## Root Cause

**CONFIRMED, three layers deep:**

1. **Surface:** the `WBE6021` "Balance is required." dialog is correct legacy behaviour — it fires
   because no balance could be extracted from a `00000000`-success response (**F2**, **F6**).
2. **Why extraction fails:** the engine returns `Output.Result` as SEED-CBC **ciphertext**, always,
   even on success — and nothing decrypts it (**F6**, corroborating the 2026-07-14 e-Invoice
   finding).
3. **Why nothing decrypts it:** the `/nxisas/decrypt` round-trip is broken by an
   **UPPER_SNAKE vs snake_case wire mismatch in both directions** (**F7**), so the request field
   binds `null` and the response field is unreadable — independently of the
   `wecms.oat.seed-decrypt.enabled` flag, which is additionally off by default.

Pre-existing, not introduced today; today's gate only made it visible. `readNumber`'s dot-grouping
defect (**F4**) is real but not the active cause. Two sibling endpoints are broken the same way
(**F8**).

## Recommended Implementation

Not started — awaiting approval. The diagnosis step is now done (F6/F7), so this is the concrete
fix set, smallest first. It is an **API + WEB pair** and needs its own BUG record per §9f.

1. **Align the decrypt wire contract** (the actual blocker, F7/F9). Legacy's semantic contract —
   *send the whole engine array, get the decrypted array back, replace it before parsing* — is
   already what the refactor does; only the JSON key names fail to bind. Follow the e-Invoice
   precedent, which is the same cipher, engine and payload shape, and works:
   - `wecms-api`: rename the `NxisasDecryptRequest` / `NxisasDecryptResponse` components to
     camelCase (`nxisasData` / `nxisasUid` / `nxisasAction`) so the global strategy produces the
     lowercase wire names, **or** pin the UPPER form with `@JsonProperty` — pick one and delete the
     Javadoc claim that is currently false. Prefer camelCase: it matches the project-wide rule and
     the working e-Invoice DTO.
   - `wecms-web`: send `nxisas_data` / `nxisas_uid` / `nxisas_action` and read `res.nxisas_data` in
     `decryptNxisasResult` (`lib/api/banking.ts:1429-1449`).
   - **Add a contract test** on both sides — this class of bug is invisible to `tsc` and to the
     Java compiler, and it failed silently for months.
2. **Make the decrypt actually run.** With the contract aligned, either enable
   `wecms.oat.seed-decrypt.enabled` on SIT or — better, matching e-Invoice — make the OAT decrypt
   **unconditional**. The `Result` is *always* ciphertext (F6 + the 2026-07-14 finding), so the flag
   guards nothing useful; the "VND payloads mostly arrive plaintext" premise it was built on is now
   disproved for Vietcom BALANCE (and for Shinhan — F9). **Leave `nonDecrypt` unset**: legacy's
   guard at `nxisas_v2.js:2353` decrypts precisely *when `nonDecrypt` is undefined*, so OAT omitting
   it already matches legacy exactly. (Setting `nonDecrypt: true` is the e-Invoice pattern, needed
   there for a different reason; copying it here would diverge from this screen's legacy.)
3. **Fix `readNumber` (F4)** — reuse the TRANSFER path's `parseEngineAmount` so `"3.362.692"`
   parses, and stop mapping `""` to `0` (legacy refuses an empty `BAL`). Independent of 1–2 and
   worth doing regardless.
4. **Fix `NxisasLoggingRequest.JSON_STR` (F8)** so the per-job audit rows start being written, and
   review `NxisasCertAcctListResponse`.
5. **Add legacy-parity diagnostics (F5)** — log the resolved job `Output` before parsing, as legacy
   does at `trns_0001_007.ts:1642`.

**Interim expectation:** the error dialog stays. It is refusing to record a refresh that did not
happen; suppressing it would restore the silent no-op (fresh timestamp on a stale balance), which
is strictly worse and a legacy-parity regression.

**Also worth a PO note:** the same decrypt gap affects the **transfer** path on this screen, not
just balance. A transfer whose `Output.Result` is ciphertext parses as
`ErrorCode = "00000000"` with no `Result.transfer[0]`, so the success branch is skipped and the row
is recorded with the composed values instead of the bank-echoed ones. Fixing item 1–2 closes that
too.

## Affected Repositories

`wecms-web` — F4 (`readNumber`), F5 (diagnostics), and the decrypt request/response key names (F7).
`wecms-api` — the DTO component names + the decrypt flag (F7, F3.3), plus `JSON_STR` and the
cert-acct-list response (F8).

## Database Impact

NONE from this audit. No `ACCT_MSTR` row is written on this path any more (that is the point of the
gate). Rows written **before** today may carry an advanced `ACCT_BAL_LST_INQ_DTM` with a stale
`BAL` — cosmetic, self-healing on the first successful refresh, detection SQL already supplied in
`wecms-api/docs/bugs/internal-transfer-legacy-parity-sweep-2026-08-18.md`.

## Risks

- Leaving it as-is: Update Balance stays non-functional for this account/bank on SIT, but it is now
  **honest** about it.
- Reverting the gate: returns to silently stamping a fresh timestamp on an unchanged balance —
  worse, and a legacy-parity regression.
- Enabling SEED decrypt: touches a flag that has never been exercised in this environment; needs
  its own verification (the cipher path is `SeedCbcDecryptService`, already proven for e-Invoice).

## Investigation Status

COMPLETE — root cause narrowed to two candidates, both evidenced; the discriminating observation is
specified and requires no code change.

## Approval Status

PENDING — no application code was modified by this audit.

## Implementation Status

NOT STARTED.


---

## Addendum (2026-08-18, later same day) — which layer raises the dialog on SIT, and why "required" is correct

Re-opened on a follow-up question: *why does the dialog appear on Update Balance, and why is a balance
required for a balance-only scrape?* The answer needed one fact this audit had not pinned down — **which
layer emits the message on the deployed SIT build.**

### F11 · `WBE6021` does not exist in the backend — the dialog is raised by the FRONTEND gate

```
grep -rn "WBE6021" wecms-api/src/main/resources/messages*.properties   → no match
grep -rn "WBE6021" wecms-api/src/main/java                             → no match
```

`WBE6021` is a **legacy JEX ML code** (`CD_WBE6021.xml`), from which the string was extracted verbatim
into `wecms-web/locales/{en,ko,vi}.json` as
`own_account_transfer.composer.error.balance_required`. The refactor backend has no such code and no
`@NotNull` on a balance field that would produce it. **The Spring API never rejected the request** —
the request was never sent.

### F12 · The gate that fires is the one added in commit `1947524`

`git show HEAD:locales/en.json` contains `own_account_transfer.composer.error.balance_required`
("Balance is required."), and `1947524` — *"fix(transfer): align internal transfer behavior with
legacy"*, authored 2026-08-18 15:32 — carries the 500-line `OwnAccountTransferComposerDialog.tsx`
change that introduced the legacy-parity balance gate (`trns_0001_007.ts:1709-1734`).

So the SIT build **already contains the gate but not the decrypt fix**, which is precisely the
combination that surfaces this dialog:

```
engine returns ErrorCode 00000000  →  gate's first branch passes (not an engine failure)
Output.Result is still ciphertext  →  parsed.bal === null
                                   →  gate's second branch fires  →  WBE6021 "Balance is required."
                                   →  NO POST is sent, NO reload  (legacy parity)
```

This is why the dialog says "Balance is required." rather than showing a bank error message: the scrape
**succeeded**; only the payload was unreadable.

### F13 · Why a balance IS required — the gate is correct, not the defect

Update Balance exists solely to persist a refreshed balance into `ACCT_MSTR.BAL` / `REAL_AMT`. A null
balance means the scrape produced nothing usable, so the two alternatives to refusing are both worse:

| Alternative | Consequence |
|---|---|
| POST `bal: null` | overwrites a previously-good stored balance with nothing |
| POST `bal: 0` | persists a **false zero balance** for a funded account, and (pre-fix) `readNumber` mapped `""` → `0`, so this was a live risk |

Legacy applies the same guard at `trns_0001_007.ts:1709-1734`. The requirement is therefore **correct
behaviour on bad upstream data** — the defect is entirely upstream, in the decrypt round-trip.

### F14 · The key material the fix needs IS available at the source legacy uses

Checked because it decides whether the implemented fix can actually work on SIT:

- `public/nxisas/js/isasscaping.js:7` — `var CooconiSASNX = new iBASENXModule();` → a real page global,
  which is what `decryptNxisasResult` reads via `window.CooconiSASNX`.
- `:35` — `this.encMode = true;` → encryption is **on by default**, which is *why* `Output.Result`
  always arrives as ciphertext (confirming F1/F5 from the engine side rather than only from the capture).
- `:429-435` — on `Open` the engine self-generates `setUidAction(randomString(40), randomString(40))`
  and stores both on that global, then sends them in the `Open` message as the SEED key/IV.
- `hooks/use-nxisas-engine.ts:193` loads `isasscaping.js` and the page calls `openNxisas` on mount, so
  `Open` has run before any Update Balance click.
- Legacy reads the identical source — `nxisas_v2.js:1677-1678`:
  `_input['NXISAS_UID'] = CooconiSASNX.OpenUid; _input['NXISAS_ACTION'] = CooconiSASNX.OpenAction;`

So the implemented fix reads the same key material, from the same object, that legacy does. **Not yet
proven end-to-end** — that requires the SIT run (see the limitation below).

### Conclusion of the addendum

No further code defect was found. The dialog is a correct guard reporting an upstream failure that has
already been fixed in the two BUG records; **SIT still shows it because SIT runs `1947524`, which
contains the guard but not the decrypt fix.** The remaining action is a deploy, which is a manual
human step (pushing `sit` deploys).

Residual risk, stated rather than assumed: `encMode`'s guard at `:429` reads
`encMode && OpenUid == "" || OpenAction == ""` — with `&&` binding tighter than `||`, keys are
regenerated on the *first* `Open` but not on subsequent ones. If a later `Open` in the same page
session were to re-key on the engine side without updating the global, the decrypt would fail with a
stale key and the dialog would return. That is vendor behaviour that cannot be settled by reading the
bundle; the new `console.warn` diagnostics on every fallback path are what will identify it in one SIT
run if it happens.
