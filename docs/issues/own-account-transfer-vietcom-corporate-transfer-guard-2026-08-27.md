# Own Account Transfer — block transfers from Vietcom iB@nking (CORPORATE), which has no transfer job

**Date:** 2026-08-27
**Type:** ISSUE — guard against a vendor limitation, not a defect in our code
**Current Work Classification:** ISSUE
**Status:** READY FOR MANUAL COMMIT
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

- Environment: none
- Result: **NOT RUN** — UI not started, no NXiSAS engine. The disabled button, the tooltip and the
  pre-flight dialog have not been seen rendered.

⚠️ The SIT screenshot taken 2026-08-27 still shows both Vietcom Transfer buttons **enabled** —
expected, since this change is uncommitted and SIT runs the pre-guard build.

## Known Limitations / Follow-up

| # | Item | Owner |
|---|---|---|
| 1 | Clean `tsc --noEmit` with `next dev` stopped | before merge |
| 2 | SIT: confirm the two Vietcom rows are disabled with the DigiBiz tooltip, and that **Update Balance still works** on them (the guard must not touch inquiry) | Mr. Youvita |
| 3 | Test whether DigiBiz login `…S07` can see `0441000688210` via the Account Picker — the real remediation | Mr. Youvita |
| 4 | VI wording is a reasoned rendering, not a verified WeCMS string | Vietnam team |
| 5 | Two open questions to Coocon: the sheet still marks `TRANSFER_ML` supported, and `TRANSFER_INTERNAL_ML` is blank | Sonny |
| 6 | If Coocon ever ships a working CORPORATE module (`[WABOOKS] 01.NEW SCRAPING MODULE`), remove the entry from `TRANSFER_UNSUPPORTED_CLASSES` | — |
