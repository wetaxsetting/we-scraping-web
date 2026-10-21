# Own Account Transfer — Vietcom Guard Message Misdirects Users Who Already Have DigiBiz

**Date:** 2026-08-27
**Type:** BUG FIX
**Current Work Classification:** BUG
**Status:** DEPLOYED TO SIT — verified 2026-08-27
**Repository:** wecms-web
**Related issue:** [own-account-transfer-vietcom-corporate-transfer-guard-2026-08-27.md](../issues/own-account-transfer-vietcom-corporate-transfer-guard-2026-08-27.md)

## Problem

The Vietcom CORPORATE transfer guard (shipped 2026-08-27) disables Transfer and explains why with:

> "This bank login does not support transfers. Please register a Vietcom DigiBiz login in
> Settings and transfer from that account."

A tenant that **already has** a Vietcom DigiBiz login reads this as "the system has not seen my
DigiBiz credential", goes to Settings, sees DigiBiz listed, and concludes the product is broken.
Reported from SIT (`wecms.kosign.dev`) 2026-08-27 with both a DigiBiz and an iB@nking credential
registered under Vietcombank.

The message is wrong about the actual condition. The blocker is not a *missing* credential — it is
that the **accounts are bound to the iB@nking credential**, and re-binding them is a different
action from registering a new login.

## Current Behavior

1. `SourceAccountsTable` greys Transfer and shows
   `own_account_transfer.transfer_unsupported_tooltip`
   ([source-accounts-columns.tsx:104](../../components/banking/own-account-transfer/source-accounts-columns.tsx#L104)).
2. Two sibling messages repeat the same advice —
   `own_account_transfer.composer.error.transfer_unsupported` (pre-flight guard,
   [OwnAccountTransferComposerDialog.tsx:699](../../components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx#L699))
   and `own_account_transfer.composer.error.engine_80010222` (engine rejection).
3. Settings > Login Credentials > "Registered Login Credentials" lists both Vietcom credentials by
   **Login ID only**. `login_type` ("Corporate" / "DigiBiz") is on the wire
   ([api.ts:3812](../../lib/types/api.ts#L3812), mapped at
   [mappers.ts:2096-2104](../../lib/api/mappers.ts#L2096-L2104)) but
   `RegisteredCredentialEntry` drops it, so the two rows are visually indistinguishable.

Compounding both: the dialog's Bank Account column is bank-wide, not per-credential (backend
`LoginCredentialsService`, mirroring legacy `BANK_CERT_INFO_R005`), so every Vietcom credential
displays the same account list — making DigiBiz appear already linked. That display defect is
tracked separately; it is **not** fixed here (diverges from legacy, needs PO approval).

## Expected Behavior

- The three guard messages state the real condition — the accounts are registered under a Vietcom
  iB@nking login, which has no transfer service — and name the action that actually fixes it:
  re-save the accounts under the DigiBiz login via **Add Login ID/PW**.
- The Registered Login Credentials dialog shows each credential's type, so iB@nking and DigiBiz are
  distinguishable at a glance.

## Verified Root Cause

Confirmed against legacy and refactor source (2026-08-27):

| Step | Evidence |
|---|---|
| Job is chosen by credential **class**, not user level | `trns_0001_007.ts` Vietcom branch — `TRANSFER_ML` for iB@nking; `TRANSFER`/`TRANSFER_INTERNAL` when `bankClass == "DIGIBIZ"` |
| Class comes from the account's single bound credential | `_certObj = _v2nxisas.getCertInfo(bank_cert_seq)` → `getModuleInfo(bank_cd, _certObj.NXISAS_GB_SEQ_NO)` |
| Refactor resolves identically | `OwnAccountTransferService.resolveCertForAccount` (:1010) → `SourceAccountRow.nxisasGbSeqNo` → `sourceRowSupportsTransfer` |
| `BANK_CERT_SEQ` is stamped at **account save**, not credential edit | legacy `fnif_0002_003_c001_act.jsp:325`; refactor `AccountRegistrationService:164,195` |
| Only the Add-and-Save flow re-points it | `AccountRegistrationService.register` has exactly one caller in the credentials module — `LoginCredentialsService.createBankWithAccounts:402-412`. The pencil/edit path does **not** call it. |

So the guard fires correctly; only its explanation is wrong. Prepare-level vs approve-level is never
read by any code path — it is a bank-side property, and an earlier hypothesis that it drove `_ML`
selection was **refuted** by the branch above.

## Scope

- Reword 3 message keys × 3 locales (en / ko / vi).
- Surface `login_type` in the Registered Login Credentials dialog (thread field + render column +
  3 locale keys).

## Out of Scope

- Per-credential Bank Account list in the dialog (legacy divergence — PO decision pending).
- Any change to the guard predicate itself; it is correct.
- Any backend change. `login_type` already ships.
- Re-pointing SIT data — that is an operator action, not a code change.

## Database Impact

NONE. No schema, function, index, constraint or data change. `login_type` is an existing
`BANK_CERT_INFO.CERT_INFO_DETL_CON3` projection already on the wire.

## API Impact

None. Consumes an existing response field.

## UI Impact

- Three guard messages reworded (tooltip + 2 composer errors).
- Registered Login Credentials dialog gains a Type column.

## Test Plan

- Unit: guard predicate unchanged — existing `bank-profiles.transferSupport.test.ts` must stay green.
- Locale parity: all three files parse; every new/changed key present in en + ko + vi.
- Dialog: renders the type when present, degrades cleanly when null (GDT and pre-discriminator rows).

## Implementation

**1. Guard messages reworded — 3 keys x 3 locales (`locales/{en,ko,vi}.json`).**
They now name the real condition (the account is bound to a Vietcom iB@nking login, which has no
transfer service) and the action that fixes it (re-save the account under the DigiBiz login via
Settings > Login Credentials > **Add Login ID/PW**). The two longer messages also state that
**editing an existing credential does not re-link accounts** — the trap that cost the reporter the
debugging round, since `AccountRegistrationService.register` has exactly one caller
(`LoginCredentialsService.createBankWithAccounts`) and the pencil/edit path is not it.

**2. Credential Type column** on the Registered Login Credentials dialog:
`loginType?: string | null` added to both `RegisteredCredentialEntry` shapes, threaded through
`buildRegisteredCredentialEntries` from the existing `LoginCredentialRow.accounts[].loginType`,
rendered as a 110px column between Login ID and Password, with an em-dash fallback for GDT and
pre-discriminator rows. No backend change — `login_type` already shipped.

## Files Changed

| File | Change |
|---|---|
| `locales/en.json` · `ko.json` · `vi.json` | 3 messages reworded, 1 key added (`settings.login_credentials.registered.col.login_type`) |
| `components/shared/popups/RegisteredLoginCredentialsDialog.tsx` | `loginType` on the entry type; colgroup, header cell and body cell for the new column |
| `components/settings/login-credentials/registeredCredentials.ts` | `loginType` on the entry type; passed through in the builder |
| `components/shared/popups/RegisteredLoginCredentialsDialog.loginType.test.tsx` | **new** — 3 tests |

## API Impact

None. Consumes the existing `login_type` field.

## UI Impact

Three guard messages reworded; Registered Login Credentials dialog is now 4 columns.

## Database Impact

NONE.

## Test Evidence

Test result:
[Vietcom Guard Message + Credential Type Column — Test Result](../testing/results/own-account-transfer-vietcom-guard-message-web-test-result-2026-08-27.md)

Final test result:    PASS (17 files, 227 tests)
Regression coverage:  PASS for the Type column (fail-before-fix verified); NOT APPLICABLE for the
message rewording — rationale in the test-result record.

## Verification

### Automated Tests

- Test:   `npx vitest run components/banking components/shared/popups components/settings`
- Result: **PASS** — 17 files, 227 tests, 0 failed
- Test:   `npx tsc --noEmit`
- Result: **PASS for this change** — only the 2 pre-existing `engine_80002411` errors remain

### Regression Review

- Areas checked: the guard predicate (`bank-profiles.transferSupport.test.ts` 15/15), the OAT
  composer suites (182 tests), and every other consumer of the dialog entry type.
- Result: unaffected. The predicate was not touched; only its explanatory text changed.

### Manual Verification

- Environment: LOCAL
- Steps: rendered-assertion tests only; locale strings read directly from the files.
- Result: **NOT RUN** for browser/visual confirmation — no browser environment was used.

## Result

Both approved items are implemented and verified locally. **READY FOR MANUAL COMMIT** — not
committed, pushed, or deployed.

## Known Limitations / Follow-up

1. **The per-credential Bank Account list is still wrong** and is the deeper half of this
   confusion — every credential under a bank shows that bank’s whole account list. Diverges from
   legacy `BANK_CERT_INFO_R005`, so it needs a PO decision. **Open.**
2. **`engine_80002411` missing from `ko.json` / `vi.json`** — pre-existing, 2 `tsc` errors. Needs
   verified KO/VI wording; must not be invented.
3. **No code path re-points `BANK_CERT_SEQ` except Add-and-Save.** Making the pencil/edit path
   re-register, or adding an explicit "re-link accounts" action, would remove the trap entirely
   rather than documenting it in an error message. Not proposed here — it changes a legacy-parity
   write path and needs its own analysis.
4. The reworded strings have not been reviewed by a KO or VI native speaker.
