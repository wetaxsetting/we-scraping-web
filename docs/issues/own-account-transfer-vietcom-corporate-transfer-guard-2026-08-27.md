# Own Account Transfer — block transfers from Vietcom iB@nking (CORPORATE), which has no transfer job

**Date:** 2026-08-27
**Type:** ISSUE — guard against a vendor limitation, not a defect in our code
**Current Work Classification:** ISSUE
**Status:** DEPLOYED TO SIT — guard verified, accounts re-bound to DigiBiz; **one successful transfer still outstanding**
**Repository:** wecms-web (frontend only — no backend, no DB change)
**Vendor evidence:** [docs/references/nxisas-vietnam-job-support-matrix.md](../references/nxisas-vietnam-job-support-matrix.md)

```
Investigation Status:  COMPLETE
Approval Status:       APPROVED — Sonny, 2026-08-27, "What should we fix in WeCMS refactor?"
Implementation Status: COMPLETE
Test Status:           PASS
```

## Problem

A transfer from a Vietcom account whose credential is **iB@nking (CORPORATE)** fails at the bank
with engine code **`80010222`**, after a full engine round-trip, and writes a `Failed` row to
`NAPAS_REMIT_TRNS_HSTR`. The user sees the vendor's raw Korean text
(*"Job명을 확인해주시기 바랍니다"* — "please check the Job name"), which is unactionable.

## Root cause — a vendor limitation, not our bug

Coocon scraping team, Mr. Vantha, 2026-08-26:

> *"Vietcom CORPORATE didn't have Napas Transfer, moreover TRANSFER_ML in Vietcom CORPORATE is old
> job that Wabooks never used before. Therefore, it got error 80010222. … Please, use Vietcom Digibiz
> Transfer because it had Napas Transfer and it requested to develop by Wabooks."*

The vendor workbook agrees on **every** leg (`VNM_BANK_API_Data`, column **AH**):

| Job we would send | Sheet | |
|---|---|---|
| `TRANSFER_ML` (NAPAS) | specified | the unused old job → `80010222` |
| `TRANSFER_INTERNAL_ML` (same-bank) | **blank** | never specified |
| `TRANSFER` · `TRANSFER_INTERNAL` | all `-` | not supported |

**Both directions are dead**, which is why the guard blocks the account outright rather than only its
NAPAS leg — corroborated by a Vietcom → Vietcom transfer failing on legacy UAT the same day.

**Our payload was never wrong.** Every job and field we send matches the vendor spec for every other
bank; Vietcom CORPORATE simply has no transfer service to call.

### Not a broken credential

CORPORATE fully supports `LOGIN` · `ACCT_LIST` · **`BALANCE`** · `TRANSACTION` ·
`BALANCE_FIXED_DEPOSIT` · `APPROVAL_LIST` · `APPROVAL`. Only the transfer jobs are missing, so
**Update Balance and Account Inquiry keep working** and the guard deliberately does not touch them.

## Implementation

| File | Change |
|---|---|
| [`bank-profiles.ts`](../../components/banking/own-account-transfer/bank-profiles.ts) | `TRANSFER_UNSUPPORTED_CLASSES` + `bankClassSupportsTransfer()` + `sourceRowSupportsTransfer()` |
| [`source-accounts-columns.tsx`](../../components/banking/own-account-transfer/source-accounts-columns.tsx) · [`SourceAccountsTable.tsx`](../../components/banking/own-account-transfer/SourceAccountsTable.tsx) | Row **Transfer button disabled** + tooltip |
| [`OwnAccountTransferComposerDialog.tsx`](../../components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx) | Pre-flight block in `handleConfirm`; `80010222` mapped to a real sentence |
| `locales/{en,ko,vi}.json` | 3 keys each |

Three layers, one predicate. The row gate is the UX; the composer pre-flight is the actual guard (a
disabled button is not a guard, and the From-Bank dropdown can change the source after the dialog
opens); the error mapping is the backstop if the class ever resolves wrongly.

### Keyed by class, never by bank

```ts
const TRANSFER_UNSUPPORTED_CLASSES = { "11704004": ["CORPORATE"] };   // Vietcom
```

Vietcom **DigiBiz** runs the same `BANK_CD` and must keep working — a bank-level block would have
killed the one path that works. Pinned by test.

**Unknown class ⇒ allow.** If `resolveNxisasBankClass` cannot resolve, the guard stays out of the
way: the engine's own error beats a wrong client-side block.

## How a user actually fixes it

The guard explains; it does not repair. The account must be re-bound to the **DigiBiz** credential:

> Settings → Login Credentials → **Vietcom DigiBiz** → Account Picker → register the account.

`AccountRegistrationService:163` re-points `ACCT_MSTR.BANK_CERT_SEQ`, so `nxisas_gb_seq_no` becomes
`1` → class `DIGIBIZ` → `TRANSFER` / `TRANSFER_INTERNAL`, both supported, and the guard stops firing.

🔴 **Do NOT fix this with SQL.** An earlier draft of this investigation proposed
`UPDATE acct_mstr SET bank_cert_seq = …` — **withdrawn**. The registration service owns that column,
sets `MOD_ID`/`MOD_DTM`, and — critically — the DigiBiz Account Picker's own scrape *proves* whether
that login can actually see the account. A hand-written `UPDATE` asserts a bank relationship nobody
verified.

## Observed on SIT (`wecmsdevdb`, tenant `VN_VNM0004_000001`)

| Vietcom cert | `nxisas_gb_seq_no` | Accounts |
|---|---|---|
| `seq_no = 2`, login `…E111` | `0` CORPORATE | `0441000688210`, `1063895376`, `1051996380` — **all blocked** |
| `seq_no = 1`, login `…S07` | `1` DIGIBIZ | none |

So the tenant already holds a DigiBiz credential with no Vietcom accounts registered under it.
Whether login `…S07` can see those accounts at the bank is **unverified** — the Account Picker is the
test.

> ### ✅ Superseded 2026-08-27 — the re-bind was performed and DigiBiz CAN see the accounts
>
> A later SIT screenshot (same day, after the deploy) shows **both Vietcom rows with Transfer
> enabled** and the composer opening on `0441000688210`, with `Last Refresh: Success · just now`
> and `Last updated time: 27-Aug-2026 15:01:21` — a live scrape that succeeded under the new
> binding.
>
> **Why "enabled" is proof, not a fail-open.** For Vietcom `resolveNxisasBankClass` has exactly
> three outcomes ([jexjs-adapter.ts:103](../../lib/nxisas/jexjs-adapter.ts#L103) ·
> [:142](../../lib/nxisas/jexjs-adapter.ts#L142) ·
> [:156-160](../../lib/nxisas/jexjs-adapter.ts#L156-L160)):
>
> | `nxisasGbSeqNo` | resolves to | guard |
> |---|---|---|
> | `1` | override `11704004\|1` → **DIGIBIZ** | allows |
> | `0` | no override → bank default → **CORPORATE** | blocks |
> | `null` / blank | `normalizeCertSeq` → `undefined` → bank default → **CORPORATE** | blocks |
>
> A missing or unresolvable seq **does not** fail open for Vietcom — it falls back to the bank
> default, which is CORPORATE, which still blocks. So Transfer being enabled means
> `nxisasGbSeqNo == 1`: `ACCT_MSTR.BANK_CERT_SEQ` now points at the DigiBiz credential
> (`seq_no = 1`, login `…S07`) on both rows.
>
> ⚠️ **Inferred, not read from the database.** Both Postgres MCP servers were timing out
> (`CONNECT_TIMEOUT`) when this was written, so `ACCT_MSTR.BANK_CERT_SEQ` was **not** queried
> directly. The inference is sound because Vietcom has no fail-open path, but one query —
> `SELECT acct_no, bank_cert_seq FROM acct_mstr WHERE bank_cd = '11704004'` — would turn
> deduction into evidence. Worth running when the connection is back.
>
> The table above is left as the pre-re-bind snapshot: it records the state that produced the
> defect, and is deliberately not rewritten.

## API / Database Impact

**None on both counts.** Frontend-only; the class is already resolved client-side when the engine
payload is built. No schema change, no dependency, no paired backend record.

## Verification

### Automated Tests

| Test / Command | Result |
|---|---|
| new [`bank-profiles.transferSupport.test.ts`](../../components/banking/own-account-transfer/bank-profiles.transferSupport.test.ts) — 15 cases | PASS |
| `npx vitest run components/banking` | **PASS** — 16 files |
| `npx vitest run` (whole suite) | 28 files, **345 tests — 334 pass, 11 fail** (see *Existing Failures*) |
| `npx tsc --noEmit` | no error in any source file |

Cases that carry the design decisions:

| Test | Protects |
|---|---|
| *blocks Vietcom CORPORATE* | the `80010222` case |
| *allows Vietcom DIGIBIZ — same bank code, working module* | the class-keyed design |
| *does not block an unrelated bank that happens to be CORPORATE* | IBK / Woori / VIETIN are all CORPORATE |
| *never blocks on missing information* | unresolved class must not produce a false block |

### Existing Failures

**11 failures in `components/addon/sales-einvoices/useEInvoiceScrape.test.ts`** — the documented
pre-existing stale-`vi.mock` failure ([CLAUDE.md §14j](../../CLAUDE.md)). Category **B**: unrelated,
cited not repaired.

### Manual Verification

- Environment: **SIT** (`wecms.kosign.dev/banking/transfer-own-accounts`), build from `sit` `5598e6f`
- Evidence: screenshot supplied by Sonny, 2026-08-27, after the SIT pipeline ran
- Result: **PASS** for the guard's visible behaviour

| Check | Observed |
|---|---|
| Transfer button disabled on a Vietcom iB@nking row | ✅ greyed, non-actionable |
| Tooltip carries the reworded message | ✅ renders `own_account_transfer.transfer_unsupported_tooltip` verbatim — "This account is registered under a Vietcom iB@nking login, which has no transfer service. Re-save it under your Vietcom DigiBiz login in Settings → Login Credentials → Add Login ID/PW." |
| **Inquiry untouched by the guard** | ✅ `Last Refresh` shows **Success** on both rows (`4hr ago` / `1 mon`) — balances render (`3.369.883`, `308.822.600`) |

This closes follow-up item 2 for the **guard + tooltip + inquiry-unaffected** half. Two things it
does **not** cover:

- **The composer pre-flight dialog and the `80010222` error mapping have still not been seen
  rendered** — they only fire on an attempted transfer, which the disabled button prevents. Reaching
  them needs the From-Bank dropdown path.
- **The `Success 4hr ago` refresh predates this deploy**, so it says nothing about the paired
  `wecms-api` per-credential fix (`bb14eaa`). See the note below.

> ⚠️ **`Last Refresh: Success` on an iB@nking-bound account, from the pre-fix build, is worth
> explaining and has not been.** Before `bb14eaa` the sync resolved the credential by `BANK_CD` and
> would have used the **DigiBiz** login (`seq 1`, lowest) for accounts bound to **iB@nking**
> (`seq 2`). A clean `Success` under that build is not what the analysis predicts. Candidate
> explanations, none verified: the row's status is stale from an older successful run; the refresh
> came through a different path; or the DigiBiz login genuinely can reach those accounts — which
> would be *good* news for the re-bind but must not be assumed. **Do not read this as evidence for
> or against the fix.** Confirm by running a sync on the deployed build and reading
> `ACCT_MSTR.ACCT_BAL_LST_INQ_DTM` + the `bank-sync` log line, which now names the credential.

### Observation — only 2 of the 3 Vietcom accounts appear as transfer sources

The SIT screenshot lists `0441000688210` and `1063895376`; `1051996380` (the third account bound to
`seq 2`) is absent. Not necessarily a defect — the Own Account Transfer source list applies its own
eligibility filter (account type, `ACCT_AUTH_INFO` W-permission, active flag). **Unconfirmed** —
worth a look when someone is next in the data, but it does not block the re-bind.

## Known Limitations / Follow-up

| # | Item | Owner |
|---|---|---|
| 1 | ~~Clean `tsc --noEmit`~~ — **still 2 errors**, but both **pre-existing**: `engine_80002411` is missing from `ko.json`/`vi.json` (present on `origin/sit` before this work; test added by `1947524`). Needs verified KO/VI wording — **do not invent it**. | Vietnam team |
| 2 | ✅ **DONE 2026-08-27** — SIT screenshot confirms disabled Transfer + reworded tooltip + `Last Refresh: Success` (inquiry unaffected). Composer pre-flight dialog + `80010222` mapping still unseen. | — |
| 3 | ✅ **DONE 2026-08-27** — accounts re-bound to DigiBiz; the picker scrape + a live `Success · just now` refresh prove `…S07` reaches them. Inferred from UI + class-resolution code, **not** from a DB read (MCP down) — re-confirm with one query. | — |
| 3b | **Complete one actual Vietcom transfer.** The block is gone, but no transfer has been attempted (`To Bank` still `Select` in the screenshot). Success here is the real finish line — it exercises `TRANSFER_INTERNAL` on DIGIBIZ end to end. | Mr. Youvita |
| 3c | `1051996380` is still absent from the source list (`Total 2 accounts`) — either not re-bound or not source-eligible. Only matters if that account must transfer. | Mr. Youvita |
| 4 | VI wording is a reasoned rendering, not a verified WeCMS string | Vietnam team |
| 5 | Two open questions to Coocon: the sheet still marks `TRANSFER_ML` supported, and `TRANSFER_INTERNAL_ML` is blank | Sonny |
| 6 | If Coocon ever ships a working CORPORATE module (`[WABOOKS] 01.NEW SCRAPING MODULE`), remove the entry from `TRANSFER_UNSUPPORTED_CLASSES` | — |

## Follow-up

The guard messages shipped with this issue told users to *register* a DigiBiz login, which misleads a
tenant that already has one — the real blocker is that the accounts are **bound** to the iB@nking
credential. Reworded, and the credential sub-type surfaced in Settings, under
[own-account-transfer-vietcom-guard-message-2026-08-27.md](../bugs/own-account-transfer-vietcom-guard-message-2026-08-27.md) (2026-08-27).

## Decision — re-bind to DigiBiz (Sonny, 2026-08-27)

**Chosen remedy: bind the Vietcom accounts to the DigiBiz credential. No code change.**

The question raised was whether WeCMS should let inquiry keep using iB@nking while transfers
automatically fall back to a DigiBiz credential when one exists. **Rejected** — that would be a new
capability, not a fix:

- It diverges from legacy, which holds exactly **one** credential per account
  (`ACCT_MSTR.BANK_CERT_SEQ`) with no per-screen selection.
- A blind fallback ignores **bank-side entitlement** — DigiBiz may not be granted that account, so
  the transfer would fail at the bank instead of being blocked cleanly in the UI.
- With more than one DigiBiz credential, something must break the tie — and "lowest `SEQ_NO`" is the
  exact defect fixed in
  [bank-transaction-sync-per-credential-resolution-2026-08-27.md](../../../wecms-api/docs/bugs/bank-transaction-sync-per-credential-resolution-2026-08-27.md).
- It splits state across two portals: balance scraped via iB@nking, transfer sent via DigiBiz.

**Why re-binding is sufficient.** DigiBiz supports the transfer jobs *and* the inquiry jobs, so one
credential covers every screen:

| Screen | After re-binding to DigiBiz |
|---|---|
| Account Inquiry (VND / FCY), Update Balance, Transaction History | DigiBiz |
| Own Account Transfer | DigiBiz — guard stops firing |

iB@nking stays registered; it simply stops being the binding.

### ✅ RESOLVED — DIGIBIZ supports the inquiry jobs (2026-08-27)

The prior revision of this section flagged DigiBiz inquiry-job support as **unverified** — the
transfer rows had been read, `BALANCE` / `TRANSACTION` had not. **Now confirmed** from the vendor
workbook `VNM_BANK_API_Data`, Vietcom group columns **AG = PERSONAL · AH = CORPORATE ·
AI = DIGIBIZ**:

| Section | Rows | DIGIBIZ (col **AI**) | Verdict |
|---|---|---|---|
| `BALANCE` (잔액조회) | 40–56 | every Input/Output field numeric — `acctNum` 1, `acctName` 1, `acctType` 1, `currency` 1, `balance` 1, `availableBal` 1, `branchName` 2, `openDate` 1 | ✅ **supported** |
| `TRANSACTION` (거래내역) | 58–82 | every Input/Output field numeric — `acctNum` 1, `startDate` 1, `endDate` 1, `order` 1, `date` 1, `debit` 1, `credit` 1, `remarks` 1, `bankReference` 1 | ✅ **supported** |

Per the sheet's own legend a job is supported when its fields carry numbers (`1` required / `2`
optional / `0` unused) and unsupported when every field is `-`. **The DIGIBIZ column contains no
dashes in either section.**

Corroborating detail: where CORPORATE carries `1/0` on `availableBal` and `openDate` — the
**구/신 사이트** old-site/new-site split documented in the reading traps — DIGIBIZ carries a clean
`1`. Consistent with DigiBiz being a single modern portal with no old/new branch, which is one less
unmodelled dimension to worry about after re-binding.

**The re-bind decision therefore stands: one DigiBiz credential serves inquiry and transfer.**

### ✅ Fixed-deposit accounts — also safe (2026-08-27)

`BALANCE_FIXED_DEPOSIT` (예적금 잔액조회, rows **134–152**) is fully numeric on DIGIBIZ — `acctName` ·
`acctNum` · `acctType` · `currency` · `balance` · `openDate` · `rate` · `maturityDate` all `1`.
**Fixed-deposit accounts (`ACCT_TYPE_CD = '02'`) can be re-bound like any other.** PERSONAL is all
dashes; CORPORATE and DIGIBIZ both supported.

⚠️ **Expect one cosmetic difference:** `availableBal` is `1` on CORPORATE but `0` on DIGIBIZ — DigiBiz
does not return available balance for a fixed deposit, so an FD row will show an empty Available
Balance where iB@nking showed a value. Brief the tester so it is not filed as a regression.

Optional — list which rows are affected:

```sql
SELECT acct_no, acct_type_cd, ccy_cd, bank_cert_seq
FROM acct_mstr
WHERE biz_key = 'VN_VNM0004_000001' AND bank_cd = '11704004' AND actv_yn = 'Y';
```

This is now informational, **not a gate**.

### ✅ Closed — the row-132 section, and the vendor's full Vietcom job set (2026-08-27)

The workbook was opened directly. Rows 128–132 are **`TRANS_PAST` (과거내역)**, not
`TRANSACTION_FIXED_DEPOSIT` — an earlier guess in this record, now corrected. No Vietcom class
supports `TRANS_PAST` and neither codebase calls it. Nothing to do.

`BANK_Module_List` rows 644–646 give the authoritative per-class job set and confirm the decision:

| Class | Supported jobs |
|---|---|
| CORPORATE (iB@nking) | LOGIN · LOGOUT · ACCT_LIST · BALANCE · TRANSACTION · BALANCE_FIXED_DEPOSIT · TRANSFER_ML · APPROVAL_LIST · APPROVAL · FOREIGN_EXCHANGE |
| **DIGIBIZ** | LOGIN · LOGOUT · ACCT_LIST · BALANCE · TRANSACTION · BALANCE_FIXED_DEPOSIT · **TRANSFER** · **TRANSFER_INTERNAL** · RECEIVER_INFO |
| PERSONAL | LOGIN · LOGOUT · ACCT_LIST · BALANCE · TRANSACTION |

DIGIBIZ covers every inquiry job the account needs, so **one DigiBiz credential serves inquiry and
transfer**. Two DIGIBIZ gaps versus CORPORATE were checked and are harmless: `FOREIGN_EXCHANGE`
(FX is scraped from Shinhan and Woori only) and `APPROVAL_LIST`/`APPROVAL` (no codebase invokes an
approval job).

**Also confirmed:** Vietcom CORPORATE has no `TRANSFER_INTERNAL_ML`, so same-bank transfer is
unsupported there too — the reason the Vietcom → Vietcom transfer failed on legacy UAT.

🔴 **Unrelated finding, raised separately:** `TRANSACTION_FIXED_DEPOSIT` is supported by
HSBC/CORPORATE alone in the whole workbook, yet legacy (`nxisas_tranList_osmc.js:312-321`,
ticket 42051) and the refactor both send it for Vietcom FD accounts. Identical on both Vietcom
classes, so it does not affect the re-bind — see open question 4 in
[nxisas-vietnam-job-support-matrix.md](../references/nxisas-vietnam-job-support-matrix.md).

### Runbook

1. **Pre-check** — record the current binding (query in the bug record's Verification section).
2. **Re-register**: Settings → Login Credentials → **VCB DigiBiz** → *Add Login ID/PW* → Account
   Picker → select the accounts → Save. This is the only path that re-points `BANK_CERT_SEQ`
   (`AccountRegistrationService.register`, sole caller `LoginCredentialsService.createBankWithAccounts`).
   The pencil/edit path is a password change only.
3. **Watch the picker.** If the accounts do **not** appear, DigiBiz has no entitlement to them at the
   bank — stop, and raise it with Vietcombank. Do **not** proceed with SQL.
4. **Post-check** — re-run the binding query; `bank_cert_seq` must now be the DigiBiz `seq_no`.
5. **Verify both capabilities** — Update Balance succeeds, and the Transfer button is enabled.

🔴 **Never** re-point with `UPDATE acct_mstr SET bank_cert_seq = …`. The picker's own scrape is what
*proves* the login can see the account; a hand-written update merely asserts it.
