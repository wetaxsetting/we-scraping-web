# Own Account Transfer — collect the bank-account password in the composer (engine error 80002420)

**Date:** 2026-08-26
**Type:** BUG FIX
**Current Work Classification:** BUG
**Status:** READY FOR MANUAL COMMIT
**Repository:** wecms-web
**Paired backend record:** [wecms-api/docs/bugs/own-account-transfer-account-password-2026-08-26.md](../../../wecms-api/docs/bugs/own-account-transfer-account-password-2026-08-26.md)
**Evidence (audit — not converted, not copied):** [wecms-api/docs/audits/legacy-parity/own-account-transfer-account-password-source-2026-08-25.md](../../../wecms-api/docs/audits/legacy-parity/own-account-transfer-account-password-source-2026-08-25.md)

```
Investigation Status:  COMPLETE   (in the audit above)
Approval Status:       APPROVED   — Sonny, 2026-08-26, "fix it to correct with Model A"
Implementation Status: COMPLETE
Test Status:           PASS
```

## Problem

An IBK VN → IBK VN transfer on SIT (`wecms.kosign.dev`) fails with vendor code
**`80002420`** — *"An account password was not entered."* The Account Password field was
rendered but **disabled** for IBK, so `acctPassword` stayed `""` and `bank-profiles.ts`
shipped `acctNumPWD: ""` to the engine.

## Root Cause

`OAT_BANK_PASSWORD_REQUIRED` listed Shinhan, Woori and KEB Hana but **not IBK**, so
`isPasswordRequiredFor("11704003")` returned `false` and the input rendered
`disabled={!pwdRequired}` with no asterisk. The comment justifying it —
*"their engines don't read `acctNumPWD`"* — was factually wrong: legacy assigns it
unconditionally at `trns_0001_007.ts:1943` and sources the value from the stored
`ACCT_MSTR.ACCT_PWD` instead of a typed field.

## Chosen design — Model A (PO decision, 2026-08-26)

Inline fields in the Transfer modal — **not** a separate Account Management registration
screen, which the user explicitly dropped. The user types on every transfer; the value is
sent with the scraping result and the backend persists it on success. The frontend
**never reads it back**, so no decrypted bank password is ever rendered.

Also rejected: prefilling the field from the DB with an eye toggle — that would put the
plaintext password in the DOM on every open and make it readable at the screen.

## Implementation

| File | Change |
|---|---|
| [`hooks/use-own-account-transfer.ts`](../../components/banking/own-account-transfer/hooks/use-own-account-transfer.ts) | IBK added to `OAT_BANK_PASSWORD_REQUIRED`; new `OAT_BANK_TRANSFER_PASSWORD_REQUIRED` + `isTransferPasswordRequiredFor`; `validateDraft` gains the transfer-password branch; corrected the false comment |
| [`OwnAccountTransferComposerDialog.tsx`](../../components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx) | New local `PasswordField` (eye toggle + anti-autofill); two **bank-gated** rows replace the always-rendered disabled input; `trnsPassword` state threaded through draft + props; `acct_pwd` / `trns_pwd` added to the `/scraping-result` POST |
| [`types.ts`](../../components/banking/own-account-transfer/types.ts) | `OwnAccountTransferDraft.trnsPassword`; `"trnsPassword"` added to the validation field union |
| [`bank-profiles.ts`](../../components/banking/own-account-transfer/bank-profiles.ts) | IBK profile doc corrected — `acctNumPWD` must be non-empty; records the `80002420` history |
| [`lib/types/api.ts`](../../lib/types/api.ts) | `ApiOwnAccountTransferScrapingResultRequest` gains optional `acct_pwd` / `trns_pwd` |
| `locales/{en,ko,vi}.json` | 5 keys each — transfer-password label + placeholder, eye show/hide a11y labels, transfer-password-required message |

### Bank gating (which rows render)

| Bank | Account Password | Transfer Password |
|---|---|---|
| IBK `11704003` · Shinhan `11704088` · Woori `11704020` | shown, required | hidden |
| Vietcom `11704004` · Vietin `11704001` | hidden | hidden |
| KEB Hana `11704080` *(not allow-listed)* | shown | shown |

Rows render **only** for banks whose engine job actually carries the field
(`trns_0001_007.ts:1930-2012`), so a Vietcom or Vietin user is never shown a field whose
value would go nowhere. No offered bank needs the transfer password today — only KEB Hana
does, and it is a dead branch, so that row is built but inert.

### Anti-autofill is load-bearing, not cosmetic

`PasswordField` carries `autoComplete="new-password"` **plus** WABOOKS' own
`readOnly` + `onFocus` release (`trns_0001_001.ts:974`). Redmine **#47851** records
browsers autofilling the saved *login* password into this field. A wrong account password
walks the bank's lockout ladder — `80002421` (incorrect) → `80002422` (restricted) →
`80002423` (one more failure exceeds the limit) — so a silent autofill can get a
customer's bank account **locked**. Do not remove these attributes.

## Database Impact

**NONE (frontend) — database dependency only.** The write path (`ACCT_MSTR.ACCT_PWD` /
`TRNS_PWD`, legacy pgcrypto `encrypt()`) is owned by the backend record linked above. No
DDL: the columns already exist at `wecms-api/src/main/resources/db/migration/V2__acct_mstr.sql:49-50`.

## API Impact

`POST /api/v1/banking/own-account-transfer/scraping-result` gains two optional body
fields, `acct_pwd` / `trns_pwd`. Ships in the same change as the backend. Plaintext on the
wire — unavoidable and identical to legacy, since the NXiSAS engine is browser-resident
and the bank IB site needs cleartext. Same exposure envelope as the existing
`SourceAccountRow.certInfoDetlCon`.

## UI Impact

The Account Password row is now **enabled and required** for IBK / Shinhan / Woori, gains
an eye toggle, and disappears entirely for Vietcom / Vietin (previously it rendered
disabled for every bank). A Transfer Password row exists but renders for no
currently-offered bank.

## Verification

### Automated Tests

- Test: new [`bank-profiles.acctPassword.test.ts`](../../components/banking/own-account-transfer/bank-profiles.acctPassword.test.ts) — 17 cases pinning the per-bank matrix, the IBK regression specifically, and that a typed password reaches `Input.acctNumPWD`
- Command: `npx vitest run components/banking/own-account-transfer`
- Result: **PASS** — 11 files, 139 tests, 0 failures

### Regression Review

- Areas checked: `npx tsc --noEmit`; the 122 pre-existing OAT tests still pass; three `bank-profiles.*.test.ts` draft fixtures extended with `trnsPassword: ""`.
- Result: no behaviour change for Vietcom / Vietin (no password sent before or after) and none for Shinhan / Woori beyond the eye toggle + anti-autofill attributes.

### Manual Verification

- Environment: none
- Result: **NOT RUN** — the UI was not started and no NXiSAS engine was available. Visual and end-to-end checks are owed on SIT.

Full evidence: [Test Evidence](#test-evidence).

## Test Evidence

Test result: [own-account-transfer-account-password-web-test-result-2026-08-26.md](../testing/results/own-account-transfer-account-password-web-test-result-2026-08-26.md)

```
Final test result:    PASS
Regression coverage:  PASS
```

## Result

The composer collects the account password for the three banks that need it and sends it
on. The `80002420` cause is removed.

## Known Limitations / Follow-up

| # | Item | Owner |
|---|---|---|
| 1 | **SIT end-to-end not run** — IBK `076400794420001` → `…0002`, plus a Shinhan/Woori regression and a Vietcom/Vietin no-field check. | Mr. Youvita |
| 2 | **Visual check not run** — the two rows, the eye toggle, and the `h-8` rhythm against the sibling inputs were not seen in a browser. | Mr. Youvita |
| 3 | **Pre-existing, NOT fixed here:** `own_account_transfer.composer.error.engine_80002411` exists in `en.json` but is missing from `ko.json` and `vi.json`, so `tsc` reports 2 errors in `OwnAccountTransferComposerDialog.locales.test.ts`. Confirmed present at HEAD before this change (`git show HEAD:locales/ko.json`) — category B per CLAUDE.md §14j, left untouched per `feedback_preserve_existing_code`. | separate record |
| 4 | The transfer-password row renders for no currently-offered bank. Enabling KEB Hana needs no code change here. | — |
