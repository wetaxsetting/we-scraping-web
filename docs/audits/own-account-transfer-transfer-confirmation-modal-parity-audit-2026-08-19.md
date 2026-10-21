# Own Account Transfer — "Transfer Confirmation" Modal UI + Displayed-Value Parity Audit

**Date:** 2026-08-19
**Type:** AUDIT / INVESTIGATION
**Current Work Classification:** AUDIT
**Finding Classification:** **BUG** (2 confirmed value/label defects) **+ NO DEFECT** (the chrome differences are the refactor's approved design system)
**Investigation Status:** COMPLETE
**Approval Status:** APPROVED — Sonny, 2026-08-19: "Please fix it to correct." Scope = the Recommended Implementation below (Findings 1 + 2). Findings 3 (chrome) and 4 (unverified remark labels) remain OUT of scope with their open questions unanswered.
**Implementation Status:** COMPLETE (Findings 1 + 2) — see [the BUG record](../bugs/own-account-transfer-confirmation-display-fields-2026-08-19.md)
**Repository:** wecms-web
**Issue:** —

> **Audit COMPLETE does not mean the defect is fixed** (CLAUDE.md §16n). No application code was
> modified by this audit.

## Observed Behavior

Reporter (Sonny) supplied two screenshots of the **Transfer Confirmation** modal for the same
transfer — VIETIN `112002954853` → Shinhan `700022499445`, 10.000 VND, remark
"Vietin 853 to Shinhan 445":

- **Refactor** — Own Account Transfer → Transfer → Transfer Confirmation
- **Legacy** — `test.wecms.vn/trns_0001_001.act`, same step

Two classes of difference reported: the modal UI does not match legacy, and some displayed values
differ — the cited example being `Transaction Fee: Sender pays` (legacy) vs
`Transfer Fee: Phí ngoài (Phí được thu ngoài số tiền chuyển)` (refactor).

## Expected Behavior

Same fields, same labels, same resolved display values as legacy. Chrome follows the refactor's
own token system (CLAUDE.md §3a) — see Finding 3 for why that part is not a defect.

## Key architectural fact — both systems render the SAME vendor popup

This is the fact the whole audit turns on, and it is not obvious from the screenshots.

The Transfer Confirmation popup is **not** built by JEX and **not** built by the refactor. It is
the NXiSAS vendor bundle's own `_confirm_transfer_template`, injected at
`WECMS DEV/WECMS_STATIC/web/nxisas/js/nxisas_v2.js:1610`, with `#{…}` placeholders substituted by
the bundle at `:1360-1447`.

- **Legacy** shows that vendor popup directly.
- **Refactor** hides it (`app/nxisas-modals.css`), scrapes its substituted values via
  [lib/nxisas/confirm-bridge.ts](../../lib/nxisas/confirm-bridge.ts), and re-renders them in
  [TransferConfirmationDialog.tsx](../../components/banking/own-account-transfer/TransferConfirmationDialog.tsx).

So the React dialog is a **faithful mirror of whatever the bundle substituted**. A wrong value on
screen means a wrong value went *into* the bundle — not that the dialog rendered it wrong.

## Root Cause (values) — two org-obj display fields the refactor never sets

`nxisas_v2.js:1360-1361` — the bundle prefers page-supplied display strings and **falls back to
bank-scraped raw text** when they are absent:

```js
var recpBankNm  = (common.app.null2void(_v2nxisas.orgObj[ind].recpBankNm)  == "")
                ? obj.req.transfer[0].remitBank      : _v2nxisas.orgObj[ind].recpBankNm;
var trnsFeeStts = (common.app.null2void(_v2nxisas.orgObj[ind].trnsFeeStts) == "")
                ? obj.req.transfer[0].feePaymentType : _v2nxisas.orgObj[ind].trnsFeeStts;
```

(The superseded always-use-bank-value lines survive commented out at `:1442` and `:1446`, which
is the history of this fallback.)

**Legacy sets both, explicitly labelled for this purpose** —
`trns_0001_007.ts:2021-2023`:

```js
/* For display in Confirmation page */
_nxisas_dataObj.recpBankNm  = recpBankNm;    // = data.REC2.RCPT_BANK_NM   (:1911)
_nxisas_dataObj.trnsFeeStts = trnsFeeStts;   // = data.REC3.TRNS_FEE_STTS  (:1912)
```

**The refactor sets neither.** `NxisasOrgObj` in
[bank-profiles.ts](../../components/banking/own-account-transfer/bank-profiles.ts) declares only
`bankCd · bankNm · certInfoCon · bankCertSeq · nxisasGbSeqNo · loginID · loginPWD · job ·
nonLogout · nonLogin` — a repo-wide search for `recpBankNm` / `trnsFeeStts` returns **zero hits**
outside the JEX tree. The bundle therefore takes its fallback branch on every refactor transfer.

**This explains the symptom exactly and completely:** legacy supplies exactly two display fields,
and exactly two values differ. Every other row in the screenshots matches byte-for-byte — Sender
Account, Transfer Amount, Recipient Account No., Recipient Name, Fee Amount, Remarks.

### Legacy value sources

| Field | Legacy source | Rendered legacy value |
|---|---|---|
| `RCPT_BANK_NM` | `rcpt_bank_inp` — the recipient-bank picker's displayed text (`trns_0001_007.ts:817`) | `SHINHAN BANK \| Shinhan Bank Vietnam Limited (970424)` |
| `TRNS_FEE_STTS` | `trns_fee` — the fee dropdown's visible **label** (`:785`), ML `trns_0001_007_js006/js007` = "Sender pays" / "Recipient pays" | `Sender pays` |

Note `TRNS_FEE_STTS` (label, for display) is a **different field** from `TRNS_FEE_VAL` (`"1"`/`"2"`,
sent as `feePaymentType`). The refactor carries the value but not the label.

## Findings

### Finding 1 — `recipientBank` shows the bank's raw name — **BUG**

Refactor renders `SHBVN_Ngan hang TNHH MTV ShinHan Viet Nam` (the bank's own internal string via
`obj.req.transfer[0].remitBank`) instead of the WeCMS recipient-bank label.

Compounding factor: the refactor **already has** the correct local builder —
`resolveRecipientBankLabel` (`OwnAccountTransferComposerDialog.tsx:2560-2572`) composes
`${target.bankNm} (${target.napasBankCd})`. But line 2564 gives the **scraped value priority**:

```ts
if (!isMeaninglessLabel(fromBridge)) return (fromBridge as string).trim();
```

The bank-raw string is not "meaningless", so the correct local label is never reached.

### Finding 2 — Fee row: wrong value AND wrong label — **BUG**

| | Legacy | Refactor |
|---|---|---|
| Label | `Transaction Fee` (bundle ML `nxisas_v2_j050`) | `Transfer Fee` (`own_account_transfer.engine.confirm_transfer.transfer_fee`) |
| Value | `Sender pays` | `Phí ngoài (Phí được thu ngoài số tiền chuyển)` |

The value is the bank's raw Vietnamese fee text (the `feePaymentType` fallback). The label is an
independent, smaller defect in the refactor's own locale files.

Good news for the fix: the correct fee labels **already exist** in all three locales and are
already used by the composer's own fee dropdown —
`own_account_transfer.composer.fee_sender` / `.fee_recipient`:

| Key | EN | KO | VI |
|---|---|---|---|
| `…fee_sender` | Sender pays | 송금인 부담 | Người gửi trả |
| `…fee_recipient` | Recipient pays | 수취인 부담 | Người nhận trả |

And `draft.feeBearer` (`"A"`/`"B"`) already carries the selection.

### Finding 3 — Modal chrome / layout / colours — **NO DEFECT (design decision, needs a call)**

The reporter is right that the chrome differs — narrower modal, grey card instead of the legacy
blue tint, smaller right-aligned button pair instead of legacy's full-width blue Confirm, larger
title. **But these are deliberate**, and the component says so in its own comments:

> `Common modal style — matches the New Firm Banking dialog (rounded-2xl, p-0 + own padding,
> text-wb-16 title, h-8 footer buttons)` … `only the typography/spacing is aligned to the common
> modal style` … `Figma 270:7354` / `Figma 270:7369`

That is exactly what CLAUDE.md §3a (feature-dialog rhythm — only `max-w-*` may vary) and §3b
(the `h-8` button standard) require. **Restyling this dialog to look like the legacy vendor popup
would violate the refactor's own design system**, so it is not a bug to be fixed — it is a
product/design question for the PO.

**This audit does not recommend changing the chrome.** If Sonny wants legacy visual parity here,
that needs an explicit PO decision plus a Figma update, because it contradicts §3a/§3b.

#### Finding 3a — Measured legacy dimensions (added 2026-08-19, on request)

Sonny asked for the legacy width/height specifically, reporting the height as acceptable and the
width as wrong. Measured from the legacy stylesheets — the popup wrapper is
`<div class="layerCont middle transfer_confirmation">` (`nxisas_v2.js:621`), so the size comes from
the shared `.layerCont.middle` size class, not from anything transfer-specific.

**Width — `860px`, fixed, no responsive override:**

| Selector | Value | Source |
|---|---|---|
| `.layerCont.middle .layerPopupWrap` | `width: 860px` | `assets_v2/css/_common.css:1874` |
| `.layerCont.middle #layerPopup-contsBox` | `width: 860px` | `assets_v2/css/_common.css:1864` |
| `.layerCont.middle.minimize .layerPopupWrap` | `calc(860px * 0.7)` = `602px` | `_common.css:1886` — minimize state, not used by this popup |

No `@media` rule narrows `.layerCont.middle` for `transfer_confirmation`, so **860px applies at
every breakpoint**.

**Refactor today: `max-w-[560px]`** (`TransferConfirmationDialog.tsx`) → **300px narrower than
legacy.** This is the reported difference.

**Height — content-driven with a responsive cap** (on `#layerPopup-contsBox`, the *scrollable
content box*, not the whole modal — total modal height = title + contsBox + button area):

| Breakpoint | Height | Source |
|---|---|---|
| base (no media query) | `height: 800px; overflow-y: auto` | `_common.css:4540` |
| `min-width: 940px` | `height: auto; max-height: 580px` | `add_wecms.css:2094` (opened `:2047`) |
| `min-width: 1240px` | `height: auto; max-height: 580px` | `add_wecms.css:2145` (opened `:2097`) |
| `min-width: 1540px` | `height: auto; max-height: 710px` | `add_wecms.css:2197` (opened `:2148`) — `https://flow.team/l/PSewo` |

`assets_v2/add.css:13157 / 13557 / 13968` carries the **same three values** under the same three
breakpoints, so the two stylesheets agree and load order does not change the result.

This matches Sonny's read that the height is already acceptable: the refactor's dialog is
content-driven with a `custom-scrollbar-y` scroll region and no explicit cap, which behaves like
legacy's `height: auto` + `max-height` pair. **No height change is indicated.**

**Width is the one dimension CLAUDE.md §3a explicitly allows to vary.** §3a locks the
header/body/footer padding, typography, and button heights across feature dialogs but states that
"**only `max-w-*` is allowed to vary** between feature dialogs — pick the smallest cap that fits the
Figma column template". So changing `max-w-[560px]` → `max-w-[860px]` is a **sanctioned** change
that does *not* contradict the design system — unlike the padding / colour / button-layout
differences in Finding 3, which do.

Caveat before changing it: the refactor's dialog is a single-column layout with a 120px label
column, so at 860px the value column simply gets wider. Legacy needs 860px partly because its
`.ip-list` rows are a two-column flex grid. Widening is safe and closer to legacy, but it is a
**visual-design change that should be checked against Figma 270:7354** — if that frame specifies
560px, Figma and legacy disagree and the PO decides (root CLAUDE.md: "If a Figma frame disagrees
with this section, the live WeCMS system wins — raise the discrepancy").

Also measured while in the stylesheet, for the record: legacy's light-blue card tint is
`.formList-wrap { background: rgba(0, 105, 185, 0.03); border-radius: 9px; padding: 20px }`
(`_common.css:4541`) — brand blue `#0069b9` at 3% opacity. The refactor uses `bg-wb-bg-sidebar`
(grey). Part of Finding 3, unchanged.

#### Finding 3b — Row indentation + row typography (added 2026-08-19, on request)

Sonny reported that legacy **indents** the label/value rows under the section heading while the
refactor renders them flush with it:

```
Legacy                                    Refactor
• Sender Account Information              • Sender Account Information
    Sender Account   VIETIN …             Sender Account   VIETIN …
    Transfer Amount  10.000 VND           Transfer Amount  10.000 VND
```

Measured from `assets_v2/css/_common.css:4564-4568` (legacy) against
`TransferConfirmationDialog.tsx` `ConfirmSection` / `ConfirmRow` (refactor):

| Property | Legacy | Refactor | Same? |
|---|---|---|---|
| **Row-block left indent** | **20px** — `.form-cont > .ip-cont { padding: 10px 20px }` | **0** — rows share the section's left edge | ❌ **the reported issue** |
| Label column width | `190px` — `.ip-cont .name` | `180px` — `w-[180px]` | ❌ (10px) |
| Row gap | `20px` — `.ip-cont > div + div { margin-top: 20px }` | `12px` — `gap-3` | ❌ |
| Label font | `13px` / `500` / `#000` | `14px` / `500` / `text-wb-ntrl-8` (muted) | ❌ size **and** colour |
| Value font | `13px` / `500` / `#000` — `.inputCont > p.val` | `14px` / `500` / `text-wb-ink` | ❌ size |
| Section-title font | `14px` / `500` / `#828282` | `13px` / `600` / `text-wb-muted` | ❌ size + weight |
| Section bullet | `4px` circle, `#0069b9`, `margin-right: 7px` | `6px` (`size-1.5`), `rounded-sm`, `gap-1.5` (6px) | ❌ |
| Title→rows gap | `13px` (title pad-bottom) + `10px` (ip-cont pad-top) = **23px** | `14px` — `gap-3.5` | ❌ |

**Note the inversion:** legacy uses `13px` rows under a `14px` section title; the refactor uses
`14px` rows under a `13px` section title. The two systems disagree on which line is visually dominant,
not merely on sizes.

**Only the indent is safely changeable.** The 20px indent is layout, and §3a/§3b do not govern
internal row indentation — so aligning it is the same category of sanctioned change as the width
(Finding 3a). Everything else in the table is **typography**, which §3b pins to the common modal
style (`text-wb-*` tokens, no arbitrary px) and §3a pins to the shared feature-dialog rhythm.
Changing the label/value/title sizes and the muted label colour to match legacy would:

- introduce `13px` label/value text where the common modal style uses `14px`, diverging this dialog
  from every other feature dialog in the app, and
- require the label colour to become `#000`, dropping the `text-wb-ntrl-8` muted-label convention.

That is a **design-system decision for the PO**, not a defect fix — the same conclusion as
Finding 3, now with measurements attached.

**Resolution (2026-08-19) — indent and row size both actioned; my caution above was partly
overcautious.**

| Item | Outcome |
|---|---|
| Row indent (20px) | **FIXED** — [modal layout record](../bugs/own-account-transfer-confirmation-modal-width-2026-08-19.md) Amendment 1 |
| Row label/value size → 13px | **FIXED** — [row typography record](../bugs/own-account-transfer-confirmation-row-typography-2026-08-19.md) |
| Label column width · row gap · section-title size · bullet geometry · title→rows gap | **still open** |

On the size specifically, the warning above that 13px would make this "the only feature dialog with
its own type scale" was wrong in emphasis: 13px is the **WeCMS body-text standard** (workspace
CLAUDE.md § Global Typography), is what §3b's own table prescribes for a form-row label
(`text-wb-13 font-medium text-wb-ntrl-8`) and a body cell, and is what legacy uses
(`.ip-cont .name` / `p.val` = 13px). The 14px came from the `ModalField` precedent, not from a rule.
Corrected here rather than left standing.

Note the requester chose to **keep** the 13px section heading rather than raise it to legacy's 14px,
so the modal now has equal-size heading and rows — a deliberate divergence from legacy rhythm,
recorded in the typography record's Known Limitations.

### Finding 4 — Three labels unverified — **UNRESOLVED, do not "fix" blind**

The bundle's hardcoded ML defaults differ from the refactor for three more rows:

| Bundle key | Hardcoded default | Refactor |
|---|---|---|
| `nxisas_v2_j052` | `Remark` | `Remarks` |
| `nxisas_v2_j053` | `Remark (Sender)` | `Remarks for Sender` |
| `nxisas_v2_j054` | `Remark (Recipient)` | `Remarks for Recipient` |

**These are fallbacks, not the rendered value** — `jexML.get(key, default)` returns the DB ML
override when one exists. Proof from the reporter's own screenshot: legacy renders **"Remarks"**
while `j052`'s hardcoded default is "Remark", so a DB override exists and the refactor's "Remarks"
is *correct* against the live system.

The sender/recipient remark rows were hidden for this transfer, so their live ML values are
**unknown**. Do not align them to the hardcoded defaults — read the live ML values first (the
`nxisas_v2_j05x` rows on UAT). `Transaction Fee` in Finding 2 is safe precisely because the
screenshot confirms it.

## Evidence

| Claim | Source |
|---|---|
| Popup is the vendor template, not JEX/refactor markup | `nxisas_v2.js:654-681` (template), `:1610` (injection) |
| Bundle falls back to bank values when org-obj fields absent | `nxisas_v2.js:1360-1361`; superseded lines `:1442`, `:1446` |
| Legacy sets both display fields | `trns_0001_007.ts:2021-2023`, sourced at `:1911-1912` |
| Refactor sets neither | `NxisasOrgObj` in `bank-profiles.ts`; repo-wide search = 0 hits |
| Refactor mirrors the scraped popup | `lib/nxisas/confirm-bridge.ts:127,153,156-159` |
| Legacy fee label is a dropdown label, not the wire value | `trns_0001_007.ts:785-787` |
| Legacy labels come from bundle ML | `nxisas_v2.js:1408-1424` |
| Chrome is intentional | `TransferConfirmationDialog.tsx:150-155,174-180` + Figma 270:7354 / 270:7369 |
| Fee labels already exist in all 3 locales | `locales/{en,ko,vi}.json` — `own_account_transfer.composer.fee_{sender,recipient}` |

## API Impact

None. `recpBankNm` / `trnsFeeStts` are display-only fields consumed by the local NXiSAS bundle;
they never reach `wecms-api`.

## UI Impact

Two rows in one dialog. No layout change proposed.

## Database Impact

NONE (frontend) — no database dependency. Finding 4 requires *reading* the live `nxisas_v2_j05x`
ML values, which is a lookup, not a change.

## Security / Permission Impact

None — no auth, permission, or sensitive-data surface.

## Recommended Implementation

**Recommended, NOT approved. No code has been changed.**

Preferred approach — **restore the two legacy org-obj fields** (legacy-faithful, smallest diff,
fixes both values at their source rather than patching the display):

1. Add `recpBankNm?: string` and `trnsFeeStts?: string` to `NxisasOrgObj` in
   [bank-profiles.ts](../../components/banking/own-account-transfer/bank-profiles.ts), and set both
   in `buildNxisasOrgObj` — mirroring `trns_0001_007.ts:2021-2023`.
2. `recpBankNm` ← the same string `resolveRecipientBankLabel` already composes from
   `target.bankNm` + `target.napasBankCd`.
3. `trnsFeeStts` ← `t(draft.feeBearer === "A" ? "…composer.fee_sender" : "…composer.fee_recipient")`
   — reuses the existing keys, no new locale entries.
4. Change `own_account_transfer.engine.confirm_transfer.transfer_fee` from "Transfer Fee" to
   **"Transaction Fee"** in `en.json`, with verified KO/VI (KO from the legacy
   `wabooks/enums`/ML values — **do not invent translations**; omit and let EN fall back if not
   verifiable).
5. Regression test alongside the existing
   [bank-profiles.transType.test.ts](../../components/banking/own-account-transfer/bank-profiles.transType.test.ts)
   asserting both fields are populated on the org-obj.

Once (1)–(3) land, `resolveRecipientBankLabel`'s scrape-first precedence becomes harmless (the
scraped value *is* our value). Changing that precedence is a viable alternative fix, but it treats
the symptom on one field only and leaves the fee value unaddressed.

**Explicitly out of the recommendation:** the chrome (Finding 3) and the three unverified labels
(Finding 4).

## Required Tests

- Unit: `buildNxisasOrgObj` sets `recpBankNm` and `trnsFeeStts` for both fee-bearer values.
- Unit: the composed recipient-bank label matches `${bankNm} (${napasBankCd})`.
- Locale: the three locale files stay key-aligned for the fee row.
- Manual (needs the engine): re-run the transfer and confirm the dialog shows
  `Transaction Fee: Sender pays` and the WeCMS recipient-bank label. **Cannot be automated here** —
  it needs the licensed NXiSAS engine and live bank credentials.

## Risks

- Low. Display-only fields; the bundle already prefers them when present, and legacy has shipped
  this exact shape for years.
- Watch the engine's own popup remaining hidden — the bridge scrapes substituted values, so
  supplying them changes what is scraped, not how.
- Finding 4 carries the real risk if actioned blind: "correcting" a label to a hardcoded fallback
  that the live ML overrides would *introduce* a parity defect.

## Affected Repositories

`wecms-web` only. No paired backend record needed.

## Open Questions for the PO / Sonny

1. **Chrome (Finding 3)** — keep the refactor design system (recommended), or pursue legacy visual
   parity? The latter contradicts CLAUDE.md §3a/§3b and needs a PO decision + Figma update.
2. **Finding 4** — should the live `nxisas_v2_j052/j053/j054` ML values be read from UAT so the
   three remark labels can be verified rather than guessed?

---

**Investigation Status:** COMPLETE
**Approval Status:** APPROVED (Findings 1 + 2 only)
**Implementation Status:** COMPLETE (Findings 1 + 2) — see [the BUG record](../bugs/own-account-transfer-confirmation-display-fields-2026-08-19.md)
