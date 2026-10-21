# Own Account Transfer — Transfer Confirmation Showed Bank-Raw Recipient Bank and Fee Text

**Date:** 2026-08-19
**Type:** BUG FIX | PARITY FIX
**Current Work Classification:** BUG
**Finding Classification:** BUG — two legacy org-obj display fields were never set, so the NXiSAS bundle substituted bank-scraped raw strings
**Investigation Status:** COMPLETE (see the audit)
**Approval Status:** APPROVED — Sonny, 2026-08-19: "Please fix it to correct."
**Implementation Status:** COMPLETE
**Test Status:** PASS
**Status:** READY FOR MANUAL COMMIT
**Repository:** wecms-web
**Issue:** —
**Paired backend record:** none — display-only fields consumed by the local NXiSAS bundle; nothing reaches `wecms-api`.

**Evidence / investigation:**
[Transfer Confirmation Modal UI + Displayed-Value Parity Audit](../audits/own-account-transfer-transfer-confirmation-modal-parity-audit-2026-08-19.md)
— the audit is the investigation of record and is **not** duplicated here.

## Problem

In the Own Account Transfer → Transfer Confirmation modal, two rows showed the bank's own internal
strings instead of the WeCMS display values legacy shows:

| Row | Legacy (`test.wecms.vn/trns_0001_001.act`) | Refactor (before this fix) |
|---|---|---|
| Recipient Bank | `SHINHAN BANK \| Shinhan Bank Vietnam Limited (970424)` | `SHBVN_Ngan hang TNHH MTV ShinHan Viet Nam` |
| Transaction Fee | `Sender pays` | `Phí ngoài (Phí được thu ngoài số tiền chuyển)` |

The fee row's **label** was also wrong — "Transfer Fee" where legacy renders "Transaction Fee".

## Current Behavior (before the fix)

`buildNxisasOrgObj` omitted `recpBankNm` and `trnsFeeStts`, so the vendor bundle took its fallback
branch at `nxisas_v2.js:1360-1361` and substituted `obj.req.transfer[0].remitBank` /
`obj.req.transfer[0].feePaymentType` — bank-side raw text — into the popup the refactor then
scrapes and re-renders.

## Expected Behavior

Legacy parity per `trns_0001_007.ts:2021-2023`: the page supplies both display strings, so the
bundle substitutes WeCMS's own values and the React dialog mirrors them.

## Scope

- `NxisasOrgObj` + `buildNxisasOrgObj` — add and populate the two legacy display fields.
- The composer call site — supply the two resolved strings.
- `own_account_transfer.engine.confirm_transfer.transfer_fee` — EN/KO/VI label correction.
- Regression test.

## Out of Scope

- **Modal chrome / layout / colours** (audit Finding 3) — intentional per CLAUDE.md §3a/§3b and
  Figma 270:7354; changing it needs a PO decision. **Open question still unanswered.**
- **The three remark labels** (audit Finding 4) — live ML values unverified; "correcting" them to
  the bundle's hardcoded defaults could *introduce* a parity defect. **Open question still
  unanswered.**
- `resolveRecipientBankLabel`'s scrape-first precedence — becomes harmless once the bundle receives
  our value, so it is left alone per `feedback_preserve_existing_code`.

## Root Cause

Two display-only fields legacy sets on the engine org-obj (`recpBankNm`, `trnsFeeStts`) were never
carried into the refactor. Full derivation, evidence table, and file:line citations are in the
audit — not repeated here.

## Implementation

1. **`NxisasOrgObj`** gained `recpBankNm?` and `trnsFeeStts?`, each documented with its legacy
   source, the bundle's fallback line, and — for `trnsFeeStts` — an explicit warning that it is the
   display **label**, not the `"1"`/`"2"` wire value carried by `Input.feePaymentType`.
2. **`buildNxisasOrgObj`** gained an optional `confirmDisplay: { recpBankNm?, trnsFeeStts? }`
   argument and assigns each field **only when non-blank**. The bundle's own guard is
   `null2void(...) == ""`, so an empty string is equivalent to omission — writing one would be
   payload noise. Optional so existing callers and tests keep compiling.
3. **The composer** now passes both, mirroring where legacy resolves them
   (`trns_0001_007.ts:1911-1912` → `:2022-2023`):
   - `recpBankNm: resolveRecipientBankLabel(null, draft.target)` — passing `null` forces the local
     composition, reusing the existing helper rather than duplicating its logic.
   - `trnsFeeStts: t(draft.feeBearer === "A" ? "…composer.fee_sender" : "…composer.fee_recipient")`
     — the composer's own dropdown keys, so the popup and the form can never drift apart.
4. **Locale label** corrected in all three files. **No translation was invented** — the values were
   copied from the existing in-project key `own_account_transfer.composer.transaction_fee`, which
   already carried a reviewed translation for exactly this label:

   | | before | after | source |
   |---|---|---|---|
   | en | Transfer Fee | **Transaction Fee** | matches legacy `nxisas_v2_j050` + the reporter's screenshot |
   | ko | 이체 수수료 | **거래 수수료** | existing `composer.transaction_fee` |
   | vi | Phí chuyển khoản | **Phí giao dịch** | existing `composer.transaction_fee` |

## Files Changed

| File | Change |
|---|---|
| [components/banking/own-account-transfer/bank-profiles.ts](../../components/banking/own-account-transfer/bank-profiles.ts) | `NxisasOrgObj`: +`recpBankNm?`, +`trnsFeeStts?`; `buildNxisasOrgObj`: +`confirmDisplay` arg + conditional assignment |
| [components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx](../../components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx) | passes `confirmDisplay` at the `buildNxisasOrgObj` call site |
| [locales/en.json](../../locales/en.json) · [ko.json](../../locales/ko.json) · [vi.json](../../locales/vi.json) | `…confirm_transfer.transfer_fee` → "Transaction Fee" / 거래 수수료 / Phí giao dịch |
| [components/banking/own-account-transfer/bank-profiles.confirmDisplay.test.ts](../../components/banking/own-account-transfer/bank-profiles.confirmDisplay.test.ts) | **NEW** — 6-case regression test |

## API Impact

None.

## UI Impact

Two rows in the Transfer Confirmation dialog now show WeCMS values; the fee row's label reads
"Transaction Fee". No layout change.

## Database Impact

NONE (frontend) — no database dependency. No `.sql` in this repository (§12g).

## Integration Impact

NXiSAS bundle only. The bundle already prefers page-supplied values when present
(`nxisas_v2.js:1360-1361`), so supplying them changes *what* the bridge scrapes, not *how*.

## Verification

### Automated Tests

- Test: `components/banking/own-account-transfer/bank-profiles.confirmDisplay.test.ts` (6 cases)
- Command: `npx vitest run components/banking/own-account-transfer`
- Result: **PASS** — 9 files, **111 tests passed**, 0 failed (105 pre-existing + 6 new)

The new test sits under `components/`, inside Vitest's include globs — it is actually collected,
not silently skipped (CLAUDE.md §14c).

### Regression Test

```
Test file:          components/banking/own-account-transfer/bank-profiles.confirmDisplay.test.ts
Test cases:         "sets recpBankNm so the bundle does not fall back to the bank's raw name"
                    "sets trnsFeeStts so the bundle does not fall back to the bank's raw fee text"
Behavior protected: both confirmation-popup display fields must reach the org-obj
```

Fail-before/pass-after was **executed**: both assignment guards were neutralised
(`if (false && …)`), the test file failed, the guards were restored, and the folder suite returned
9/9 green. Sequence recorded in the test-result record.

**A wrong assumption in the first draft of this test was caught by the run**, not by review: it
asserted `feePaymentType === "1"` on a Vietin source, but the `vietin` profile *deletes*
`feePaymentType` on its `TRANSFER_ML` leg. The test was corrected to assert the label/wire-value
pairing on a Shinhan source and to pin Vietin's deletion in its own case — which turned the mistake
into extra coverage of a documented divergence.

### Type Check

- Command: `npx tsc --noEmit`
- Result: **PASS for this change** — 0 errors in the changed files.
- 2 pre-existing errors remain in `OwnAccountTransferComposerDialog.locales.test.ts`
  (missing key `own_account_transfer.composer.error.engine_80002411`) — **category B**, unrelated,
  not repaired here.

### Locale Verification

- All three files parse; the changed key resolves in en/ko/vi.
- 29 keys missing in `ko.json` and 37 in `vi.json` are **pre-existing** gaps — this change edited
  one existing key per file and added none.

### Regression Review

- Areas checked: the `transType` fix (cross-bank still `TRANSFER_ML` + `"2"` — asserted in the new
  test's last case); session-reuse `nonLogin` behaviour; Woori's `nonLogin:false`; cert-field
  precedence; the blank/omitted `confirmDisplay` path.
- Result: PASS — 9/9 files green, including the 7 session-reuse and 46 engine-outcome cases.

### Manual Verification

- Environment: —
- Result: **NOT RUN** — rendering the popup needs the licensed NXiSAS engine and live bank
  credentials. The reporter must re-run a Vietin → Shinhan transfer and confirm the dialog reads
  `Transaction Fee: Sender pays` with the WeCMS recipient-bank label.

## Result

Both values now originate from WeCMS instead of the bank, and the fee label matches legacy.
**Visual confirmation in the running app is still outstanding** (see Manual Verification).

## Known Limitations / Follow-up

1. ~~**The recipient-bank string format is not byte-identical to legacy.**~~ **RESOLVED — see
   Amendment 1 below.** The original text claimed the `SHORT_NAME |` prefix "cannot be produced
   without a backend/DTO change". **That was wrong**, and is corrected in the amendment.
2. **Audit Finding 3 (chrome)** — unaddressed by design. Open question for the PO: keep the
   refactor design system, or pursue legacy visual parity (which contradicts §3a/§3b)?
3. **Audit Finding 4 (three remark labels)** — unaddressed. Open question: read the live
   `nxisas_v2_j052/j053/j054` values from UAT so they can be verified rather than guessed. Note the
   audit's finding that **none** of the confirmation-popup ML ids (j044–j056) exist in
   `ML_COM/nxisas_v2.json`, so the rendered labels are the *deployed bundle's* hardcoded defaults —
   which may differ from the repo copy.

## Test Evidence

Test result:
[Transfer Confirmation Display Fields Test Result](../testing/results/own-account-transfer-confirmation-display-fields-test-result-2026-08-19.md)

Final test result:    PASS
Regression coverage:  PASS

---

## Amendment 1 — exact legacy string parity for the recipient bank (2026-08-19)

**Approval:** Sonny, 2026-08-19, quoting the target format explicitly:
`SHINHAN BANK | Shinhan Bank Vietnam Limited (970424)` = `SHORT_NAME | LONG_NAME_EN (NAPAS_BANK_CD)`,
then *"Please fix it."*

Amended in place rather than opened as a third record: this is the **same field on the same modal**
as Finding 1, and it closes this record's own Known Limitation 1 (CLAUDE.md §12b — the record belongs
to the task). Nothing had been committed.

### Correction to this record

The original Known Limitation 1 stated the `SHORT_NAME |` prefix "cannot be produced without a
backend/DTO change." **That was wrong.** The data was already reachable end-to-end:

- `NapasBankInfo` maps `SHORT_NAME` / `LONG_NAME_EN` / `LONG_NAME_VN`.
- `GET /api/v1/banking/own-account-transfer/napas-bank-info/{napas_bank_cd}` returns all three —
  backend comment: *"B9 (2026-06-04): the dictionary's display-name columns are now mapped on
  NapasBankInfo, so the lookup returns the recipient bank names instead of nulls — matching legacy
  trns_0001_001_r003."*
- `fetchNapasBankInfo()` + `ApiNapasBankInfoRow` (`short_name`, `long_name_en`) already existed in
  the web client.
- **That lookup already runs on every cross-bank leg** —
  `use-own-account-transfer.ts` `validateNapas` (legacy `fnReadNapasBankCode` parity), invoked at
  `OwnAccountTransferComposerDialog.tsx:690`, well before `buildNxisasOrgObj` at `:768`. It returned
  only `bank_cd` and **discarded the two names**.

So the fix needed **no backend change and no additional request**.

### What was implemented

1. `NapasValidationResult` (`ok: true`) now carries `shortName` / `longNameEn`; `validateNapas`
   passes them through instead of dropping them.
2. The composer captures them into two locals scoped across the NAPAS guard (they stay `null` on a
   SAME_BANK leg, where no lookup runs) and threads them into `buildNxisasOrgObj`.
3. `resolveRecipientBankLabel` gained an optional third argument and two new fallback steps between
   the bridge value and the target row:
   - both names → `` `${shortNm} | ${longNm}${napas}` `` — the legacy composite
   - one name → that name + NAPAS suffix (**never a dangling `" | "`**)
   - neither → the previous `target.bankNm` behaviour, unchanged
   Exported so the pure helper can be unit-tested directly.
4. **Stale comment corrected** in `lib/api/banking.ts`, which still claimed `short_name` /
   `long_name_*` "ride as null until the composer MR widens the entity projection" — superseded by
   backend B9 and actively misleading.

### Files changed by this amendment

| File | Change |
|---|---|
| [components/banking/own-account-transfer/hooks/use-own-account-transfer.ts](../../components/banking/own-account-transfer/hooks/use-own-account-transfer.ts) | `NapasValidationResult` + `validateNapas` surface `shortName` / `longNameEn` |
| [components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx](../../components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx) | capture the names across the NAPAS guard; `resolveRecipientBankLabel` gains the composite steps + is exported |
| [lib/api/banking.ts](../../lib/api/banking.ts) | corrected the stale "ride as null" docstring |
| [components/banking/own-account-transfer/resolveRecipientBankLabel.test.ts](../../components/banking/own-account-transfer/resolveRecipientBankLabel.test.ts) | **NEW** — 11-case regression test |

### Verification (amendment)

- `npx vitest run components/banking/own-account-transfer` → **PASS**, 10 files, **122 tests**
  (111 previous + 11 new), 0 failed.
- `npx tsc --noEmit` → **PASS for this change**; still only the 2 pre-existing locale-key errors.
- **Regression test:** `resolveRecipientBankLabel.test.ts` — composite, whitespace trimming, all four
  degradation paths, no-NAPAS-code case, `"undefined"`/`"null"` guards, bridge precedence.
  Fail-before/pass-after **executed**: the composite branch was commented out, the test file failed,
  the line was restored, and the folder suite returned 10/10 green.
- **Manual/visual:** still **NOT RUN** — needs the engine. Unchanged from the parent record.

### Remaining limitation

The composite is built **from the NAPAS dictionary**, not copied from a legacy concatenation. Worth
recording precisely: in `trns_0001_007.ts`, `SHORT_NAME` is destructured but **never used**, and
`RCPT_BANK_NM` is assigned `LONG_NAME_EN` alone (`:604`); the `short | full` pattern appears only in
the Contacts module (`trco_*`: `BANK_NM + " | " + BANK_NM2`). The composite the reporter photographed
most likely originates in the select-bank dropdown's **option label** — `trns_0001_001.ts:527` reads
`$("#rcpt_bank_inp").val().trim()` verbatim, so the visible text becomes `RCPT_BANK_NM` — but that
markup was not located in the repo. **The reporter's screenshot is the authority for the target
format, and the separator/spacing (`" | "`, `" ("`) is inferred from it.** If byte-exactness matters,
inspect `#rcpt_bank_inp`'s live DOM value.
