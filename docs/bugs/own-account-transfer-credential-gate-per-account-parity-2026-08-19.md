# Own Account Transfer — Transfer-Button Credential Gate Is Bank-Level; Legacy Gates Per Account

**Date:** 2026-08-19
**Type:** BUG FIX | PARITY FIX
**Current Work Classification:** BUG
**Investigation Status:** COMPLETE
**Approval Status:** NOT REQUIRED — implementation requested in-session ("read old legacy flow … fix it to correct in WeCMS that we refactor in Spring and Next")
**Implementation Status:** COMPLETE
**Test Status:** PASS
**Status:** READY FOR MANUAL COMMIT
**Repository:** wecms-web
**Issue:** —
**Audit evidence:** [Own Account Transfer — Shinhan rows show "credentials were deleted"](../audits/own-account-transfer-shinhan-transfer-button-disabled-audit-2026-08-19.md)

## Problem

The Own Account Transfer source table decides whether a row's **Transfer** button is enabled from a
**bank-level** set: if *any* account of a bank resolves saved credentials, every account of that
bank gets an enabled button. Legacy JEX resolves the credential **per account**, from that row's own
`BANK_CERT_SEQ`.

Consequence on a partially-linked bank: rows whose own `BANK_CERT_SEQ` is null or stale show an
**enabled** Transfer button, and the user only hits the wall after opening the composer — where the
per-row pre-flight (`hasSavedBankCert(currentSource)`) blocks with a *different* message.

## Legacy JEX flow, process and logic (read for this fix)

| Step | Legacy source | Behaviour |
|---|---|---|
| Credential save + account link | `fnsh_0101_001_c001` (existing-account branch, lines 298-359) | Writes `ACCT_MSTR.BANK_CERT_SEQ` **only for the accounts passed in the picker** |
| Credential delete | [`comm_0218_001_d001_act.jsp`](../../../WECMS%20DEV/WECMS/web/WEB-INF/action/jex/wabooks/comm/comm_0218_001_d001_act.jsp) | `BankCertInfoDAO.deleteByPk(biz_key, seq_no)` — deletes the `BANK_CERT_INFO` row **only**. `ACCT_MSTR` is never touched, so `BANK_CERT_SEQ` is left dangling |
| Cert resolution for a transfer | `trns_0001_007.ts:1561-1584` and `:1896-1924` | `_v2nxisas.getCertInfo(BANK_CERT_SEQ)` — **per row**, keyed on that row's own seq |
| The cert read itself | `nxisas_acctList_r003_act.jsp` → IDO `BANK_CERT_INFO_R006` | Selects on `BIZ_KEY + SEQ_NO`. **No `BANK_CD` filter** |
| Missing / stale seq | `nxisas_v2.js:1626-1646` (`getCertInfo`) | No guard. The read returns nothing, `_certObj.CERT_INFO_CON` is `undefined`, and legacy sends `loginID`/`loginPWD` **undefined** to the engine — i.e. legacy **attempts a bank login with empty credentials** |

Three conclusions:

1. **Per-account resolution is the legacy contract.** The refactor's bank-level set is a
   refactor-only divergence — this is the defect to fix here.
2. **The refactor's disabled button + tooltip is correct and is safer than legacy.** Legacy would
   fire a LOGIN with empty credentials; each such attempt is a failed authentication at the bank and
   therefore feeds the 3-strike lockout the team is trying to avoid. The pre-flight guard stays.
3. **The dangling `BANK_CERT_SEQ` after a delete is legacy behaviour**, not a refactor bug. Changing
   it is a deliberate divergence and is **not** done here — see `## Known Limitations / Follow-up`.

## Current Behavior

[OwnAccountTransferPage.tsx:265-271](../../components/banking/own-account-transfer/OwnAccountTransferPage.tsx)

```tsx
const banksWithCredentials = useMemo(() => {
    const s = new Set<string>();
    for (const row of data.sources) {
        if (hasSavedBankCert(row)) s.add(row.bankCd);   // ← bank-level
    }
    return s;
}, [data.sources]);
```

…consumed at [SourceAccountsTable.tsx:163](../../components/banking/own-account-transfer/SourceAccountsTable.tsx)
as `hasCredentials: banksWithCredentials.has(row.bankCd)`.

## Expected Behavior

The row gate uses the row's own cert material — `hasSavedBankCert(row)` — matching legacy's per-row
`getCertInfo(BANK_CERT_SEQ)` and matching the composer's own pre-flight, so the button state and
the composer agree.

## Scope

- The per-row credential gate on the source-accounts table (and the deep-link preselect guard that
  shares it).

## Out of Scope

- The pre-flight guard itself (correct, and safer than legacy — keep).
- The tooltip wording (audit item B1, withdrawn: for the reported state the message is accurate).
- **Clearing `ACCT_MSTR.BANK_CERT_SEQ` on credential delete** and **adding a `bank_cd` guard to cert
  resolution** — out of scope for THIS record because both are backend changes. Raised here as PO
  decisions; both were approved and **implemented in `wecms-api` on 2026-08-19** under their own
  record. See follow-up items 1 and 2.

## Root Cause

The bank-level `Set<BANK_CD>` was chosen so the whole bank's rows disable together when its
credential is deleted. That is the right outcome for the *fully*-linked case, but the linkage is
per account (`ACCT_MSTR.BANK_CERT_SEQ`), so the aggregation loses per-row truth and contradicts both
legacy and the composer's own pre-flight.

## Implementation

`OwnAccountTransferPage.tsx` — replaced the bank-level `Set` with a per-row predicate
(`rowHasCredentials`) used by the table and by the deep-link preselect guard. `SourceAccountsTable`
takes `rowHasCredentials: (row) => boolean` in place of `banksWithCredentials: Set<string>`.

Behaviour when a bank is fully linked or fully unlinked is unchanged (which covers the reported
Shinhan case — all four accounts share the same stale seq). It changes only the
**partially-linked** bank: unlinked rows now disable up-front instead of failing inside the composer.

## Files Changed

| File | Change |
|---|---|
| [components/banking/own-account-transfer/OwnAccountTransferPage.tsx](../../components/banking/own-account-transfer/OwnAccountTransferPage.tsx) | `banksWithCredentials` Set → `rowHasCredentials` per-row predicate; preselect guard updated |
| [components/banking/own-account-transfer/SourceAccountsTable.tsx](../../components/banking/own-account-transfer/SourceAccountsTable.tsx) | prop `banksWithCredentials: Set<string>` → `rowHasCredentials: (row) => boolean` |
| [components/banking/own-account-transfer/SourceAccountsTable.credentialGate.test.tsx](../../components/banking/own-account-transfer/SourceAccountsTable.credentialGate.test.tsx) | **new** — regression cases |

## API Impact

**NONE.** `bank_cert_seq` / `cert_info_con` / `cert_info_detl_con` already ship on
`/source-accounts`; only which of them the row gate reads changed.

## UI Impact

Own Account Transfer source table only. No layout, token, or copy change. On a partially-linked
bank, previously-enabled Transfer buttons on **unlinked** accounts now render disabled with the
existing tooltip — the correct state, and the same state the composer already enforced one click
later.

## Database Impact

**NONE (frontend)** — no database dependency, no `.sql` in this repository (CLAUDE.md §12g).

## Integration Impact

Strictly fewer engine invocations: an unlinked account can no longer open the composer and reach the
pre-flight. No change to the scraping contract.

## Verification

### Automated Tests

- Test: `npx vitest run components/banking/own-account-transfer/SourceAccountsTable.credentialGate.test.tsx`
- Result: **PASS** — 1 file, **7 executed, 7 passed, 0 failed**
- Test: `npx vitest run components/banking/own-account-transfer components/banking/internal-transfer`
- Result: **PASS** — 8 files, **99 executed, 99 passed, 0 failed**
- Test: `npx tsc --noEmit -p tsconfig.json`
- Result: **PASS for this change** — no new errors (2 pre-existing `locales.test.ts` errors remain)
- Test: `npx eslint components/banking/own-account-transfer/`
- Result: **PASS** — 0 errors, 1 pre-existing warning untouched

### Regression Test

```
Test file:          components/banking/own-account-transfer/SourceAccountsTable.credentialGate.test.tsx
Test case:          "gates PER ACCOUNT, not per bank — same bank, mixed linkage"
Behavior protected: an account that resolves no credential must never render an enabled
                    Transfer button because a sibling account of the same bank is linked
```

**Fail-before / pass-after — executed.** With the three source files reverted to `HEAD` and the new
test in place: **7 of 7 failed** (the pre-fix component takes `banksWithCredentials: Set<string>`, so
the new prop is ignored). Restored → 7/7, and the two-screen run → 99/99.

### Regression Review

- Areas checked: the deep-link preselect guard (shares the same predicate — updated in the same
  change), the composer's own per-row pre-flight (unchanged, now agrees with the button), the
  Transfer History screen touched earlier this session (99/99 covers both).
- Result: no behaviour change for fully-linked or fully-unlinked banks — which includes the reported
  Shinhan case. Only the partially-linked bank changes, and it changes to the correct state.

### Manual Verification

- Environment: LOCAL
- Steps: **not performed** — the app was not started for this change.
- Result: **NOT RUN.** SIT scenarios FE-P5 / FE-P6 cover it.

## Result

The Transfer gate now resolves credentials per account, matching legacy's per-row
`getCertInfo(BANK_CERT_SEQ)` and agreeing with the composer's own pre-flight. The reported Shinhan
rows stay disabled — correctly, because their `BANK_CERT_SEQ = 1` points at a credential that was
deleted; the cure for those rows is a data action (re-run Settings → Login Credentials → Shinhan →
Select Bank Accounts), not a code change.

## Test Evidence

Test result:
[Own Account Transfer — Per-Account Credential Gate — Test Result](../testing/results/own-account-transfer-credential-gate-per-account-test-result-2026-08-19.md)

```
Final test result:    PASS
Regression coverage:  PASS (fail-before/pass-after executed)
Manual / SIT:         NOT RUN
```

## Known Limitations / Follow-up

> **Items 1 and 2 are now CLOSED on the backend (2026-08-19).** Both were raised here as PO decisions;
> the PO approved them in-session and they are implemented in `wecms-api` — record:
> `wecms-api/docs/bugs/bank-credential-delete-leaves-dangling-acct-linkage-2026-08-19.md`
> (backend repository), test evidence
> `wecms-api/docs/testing/results/bank-credential-delete-dangling-linkage-test-result-2026-08-19.md`.
> No further frontend change is required for either — the gate already reads the fields whose
> projection changed. The original text is kept below as the reasoning that led to the decision.

1. **Dangling `ACCT_MSTR.BANK_CERT_SEQ` after a credential delete — ✅ CLOSED on the backend.**
   Legacy (`comm_0218_001_d001_act.jsp`) and the refactor both deleted only the `BANK_CERT_INFO`
   row, leaving accounts pointing at a seq that no longer exists — exactly the reported Shinhan
   state. Clearing it on delete makes `NULL` honestly mean "not linked", but it is a **write to
   `ACCT_MSTR` that legacy never performs**, and per `project_uat_prod_live_jex_db_target` the
   refactor runs against the **live JEX DB in every environment** — so the live JEX screens see the
   change too. That coexistence impact was raised with the PO and the decision was reaffirmed; both
   delete endpoints (`/api/v1/login-credentials/{type}/{seqNo}` — the one this UI calls — and
   `/api/v1/banking/bank-credentials/{seqNo}`) now clear the linkage in the same transaction.
   **The fix is forward-looking.** The reported rows were already dangling when it shipped, so the
   cure for them is unchanged and is still a data action: re-run Settings → Login Credentials → the
   bank → **Select Bank Accounts**, which rewrites `BANK_CERT_SEQ` (`AccountRegistrationService:164/195`,
   legacy `fnsh_0101_001_c001`).
2. **Cert resolved without `bank_cd` (audit B3) — ✅ CLOSED on the backend.** `SEQ_NO` is
   tenant-global (one sequence across all banks), and neither legacy's IDO `BANK_CERT_INFO_R006` nor
   the refactor's `loadBankCerts` filtered `bank_cd`. A dangling pointer landing on a number later
   occupied by another bank's credential would have projected that bank's login ID + password onto
   these accounts, and the engine would have attempted a login with the wrong bank's credentials — a
   guaranteed auth failure feeding the lockout risk. `OwnAccountTransferService` now applies a
   `BANK_CD` equality guard: a cross-bank cert is treated as no-cert, so the row projects null cert
   fields and this gate disables Transfer exactly as it does for an unlinked account. No wire change —
   `bank_cert_seq` / `cert_info_con` / `cert_info_detl_con` still ship; only *when* they are null moved.
3. Tooltip wording (B1) still says "credentials were deleted" for a never-linked account. Accurate
   for the reported case; low value to split further. **Still open, still low priority** — and now
   also covers the new cross-bank case, where the row is mis-linked rather than unlinked. The backend
   logs a `WARN` naming both bank codes if that ever happens in a real environment; revisit the copy
   only if that WARN is actually seen.
