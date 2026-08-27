# NXiSAS job-support matrix — Vietnam banks (vendor source of truth)

**Status:** CURRENT
**Source:** Coocon scraping team workbook `[개발] Smart_API_DATA.xlsx`, sheets
`BANK_Module_List` · `VNM_BANK_API_Data` · `GBL_BANK_API_Data` (file dated 2026-08-27)
**Read:** 2026-08-27 · **Purpose:** validate the job each bank profile sends in
[`bank-profiles.ts`](../../components/banking/own-account-transfer/bank-profiles.ts)

> This is **vendor data, not our design**. When it disagrees with our code, the vendor is right about
> what the engine will accept — and when it disagrees with the scraping team's live word, their word
> wins (see the Vietcom CORPORATE note).

## How to read the workbook

- `BANK_Module_List` maps country + bank → **Module** and **Class**.
- `VNM_BANK_API_Data` / `GBL_BANK_API_Data` are matrices: rows = job sections and their Input/Output
  fields, columns = one per bank + class.
- Cell legend (stated in the sheet at `BANK_Module_List` row 3):
  `○` = 개발완료 (developed) · `-` = **지원하지 않음 (not supported)** · `x` = 개발 불가능.
  In the API_Data matrices a job is **supported** when its fields carry numbers (`1` required /
  `2` optional / `0` unused) and **not supported** when every field is `-`.
### 🔴 Three traps — read these before quoting any cell

**1. Each bank+class header spans MANY sub-columns, one per country.** In `GBL_BANK_API_Data`,
`Shinhan COMMON` occupies **S…Y** (`VNM SGP IDN IND JPN DEU KAZ`) and `Woori CORPORATE` occupies
**AA…AH** (`BGD DEU HKG IND JPN SGP USA VNM`). The country tags sit in each section's `Input` row —
**they are per-section, and the layout differs between sections.** Reading a group's *first*
sub-column gives you Bangladesh for Woori, not Vietnam. Vietnam's Woori column is **AH**, eight to
the right.

**2. Both sheets start at `B1`, not `A1`** (`!ref = B1:AS612` / `B1:AZ559`). A zero-based array
parse therefore has index 0 = column **B**, so every array index is one less than the Excel letter.
**Always resolve cells by address** (`AH160`), never by array position.

**3. `x/y` means different things in the two sheets — check the cell comment.**
- **Vietcom CORPORATE and VietinBank CORPORATE** — comment on `AH6`/`AJ6`:
  *"사용자 계장에 따라 로그인 후 **구/신 사이트** 분기 됨. ※ 구/신 사이트의 모든 데이터는 `/`로 구분"*
  → `1/0` = **old site / new site**, branched after login by the user's account. **Not a condition.**
- **Woori (GBL)** — comment on `AH171`/`AH176`: *"transType: 1 required, transType: 2 not required"*
  → here it genuinely is conditional on `transType`.

Cell comments carry the load-bearing detail throughout. Extract them with
`XLSX.readFile(path, { cellComments: true })` and read `ws[addr].c` — several conclusions in this
document depend on them, and two earlier readings of this workbook were wrong for want of them.

## Module + class used by WeCMS Vietnam

| WeCMS bank | `BANK_CD` | Module | Class | Sheet |
|---|---|---|---|---|
| IBK VN | `11704003` | `GLOBAL/GBL/BANK_IBK` | CORPORATE | GBL |
| Shinhan VN | `11704088` | `GLOBAL/GBL/BANK_Shinhan` | **COMMON** | GBL |
| Woori VN | `11704020` | `GLOBAL/GBL/BANK_Woori` | CORPORATE | GBL |
| Vietcom | `11704004` | `GLOBAL/VNM/BANK_Vietcom` | **CORPORATE · DIGIBIZ · PERSONAL** | VNM |
| VietinBank | `11704001` | `GLOBAL/VNM/BANK_Vietin` | CORPORATE · PERSONAL | VNM |
| KEB Hana | `11704080` | `GLOBAL/GBL/BANK_KEBHana` | CORPORATE | GBL |

Note Shinhan Vietnam is class **COMMON**, not CORPORATE — and IBK / Shinhan / Woori / KEB Hana all
sit in the shared **GBL** modules, not the VNM ones.

## Transfer-job support

✅ supported · ❌ all fields `-` · ⬜ blank / no data

| Bank + class | `TRANSFER` | `TRANSFER_INTERNAL` | `TRANSFER_ML` | `TRANSFER_INTERNAL_ML` |
|---|---|---|---|---|
| IBK CORPORATE *(col **I**)* | ✅ | ✅ | ✅ | ❌ |
| Shinhan COMMON *(VNM = col **S**)* | ✅ | ❌ | ✅ | ✅ |
| **Woori CORPORATE** *(VNM = col **AH**)* | ✅ | ✅ | ✅ | ⬜ |
| **Vietcom CORPORATE** | ❌ | ❌ | ✅ ⚠️ | ⬜ |
| **Vietcom DIGIBIZ** | ✅ | ✅ | ❌ | ❌ |
| VietinBank CORPORATE | ❌ | ❌ | ✅ | ✅ |
| KEB Hana CORPORATE | ❌ | ❌ | ✅ | ✅ |

## What our code sends, checked against the above

| Bank | NAPAS leg | Vendor | Same-bank leg | Vendor |
|---|---|---|---|---|
| IBK | `TRANSFER` | ✅ | `TRANSFER_INTERNAL` | ✅ |
| Shinhan | `TRANSFER` | ✅ | `TRANSFER_INTERNAL_ML` | ✅ |
| Woori | `TRANSFER` | ✅ | `TRANSFER_INTERNAL` | ✅ |
| Vietcom CORPORATE | `TRANSFER_ML` | ✅ but ⚠️ see below | `TRANSFER_INTERNAL_ML` | ⬜ **no data** |
| Vietcom DIGIBIZ | `TRANSFER` | ✅ | `TRANSFER_INTERNAL` | ✅ |
| VietinBank | `TRANSFER_ML` | ✅ | `TRANSFER_INTERNAL_ML` | ✅ |
| KEB Hana | `TRANSFER_ML` | ✅ | `TRANSFER_INTERNAL_ML` | ✅ |

**Shinhan's asymmetry is now explained.** Legacy uses `TRANSFER` on the NAPAS leg and
`TRANSFER_INTERNAL_ML` on the same-bank leg (`trns_0001_007.ts:1951-1952`) — not an oddity, but the
only combination the vendor supports: Shinhan COMMON has **no `TRANSFER_INTERNAL`**. This also
confirms a same-bank Shinhan transfer genuinely is multi-level approval.

## Open / contradicted items

### ⚠️ Vietcom CORPORATE — the sheet and the live engine disagree

The workbook marks `TRANSFER_ML` **supported** for Vietcom CORPORATE. The scraping team's 2026-08-26
report says otherwise:

> *"Vietcom CORPORATE didn't have Napas Transfer, moreover TRANSFER_ML in Vietcom CORPORATE is old
> job that Wabooks never used before. Therefore, it got error **80010222**."*

Corroborated in the field: a Vietcom → Vietcom transfer on legacy UAT the same day failed with
*"Job명을 확인해주시기 바랍니다"* ("please check the Job name"). And `TRANSFER_INTERNAL_ML` — the job
our same-bank leg sends — is **blank** in the sheet, consistent with that failure.

**Treat the sheet as stale here.** Vietcom CORPORATE cannot transfer; the working path is DIGIBIZ,
which the sheet and our profile agree on. This is what
[`recordedTransferNeedsBankApproval`](../../components/banking/own-account-transfer/bank-profiles.ts)
relies on when it assumes DIGIBIZ for Vietcom history rows.

### ✅ Woori VN — RESOLVED, fully supported (corrected 2026-08-27)

An earlier revision of this document said Woori might support no transfer job. **That was wrong**,
and the cause was trap #1 above: the reading took Woori's *first* sub-column, **AA = `BGD`
(Bangladesh)**, which is all dashes. Vietnam's Woori column is **AH**, and it is fully populated:

| Job | Column AH | |
|---|---|---|
| `TRANSFER` | ✅ | 20 required, 4 optional, 0 dashes |
| `TRANSFER_INTERNAL` | ✅ | 13 required, 2 optional, 0 dashes |
| `TRANSFER_ML` | ✅ | 78 required, 14 optional, 0 dashes |
| `TRANSFER_INTERNAL_ML` | ⬜ | section carries no Woori column |

`acctNumPWD = 1` (**required**) on both `TRANSFER` and `TRANSFER_INTERNAL` — independent vendor
confirmation that Woori needs the account password, which the composer collects.

Our profile sends `TRANSFER` / `TRANSFER_INTERNAL`. **Both supported. Nothing to change**, and the
question to the scraping team about Woori is withdrawn.

### Conditional fields — resolved by cell comment, not guesswork

Two fields looked like gaps in an earlier pass. The comments refute both:

| Cell | Field | Comment | Consequence |
|---|---|---|---|
| `AJ328` | VietinBank `remitBranchCode` | **"Napas not require"** | our omission on the NAPAS leg is correct |
| `AJ332` | VietinBank `acceptName` | *"신사이트의 경우 remitAcctNum과 remitBranchCode로 검색 시 자동 생성 됨. — Napas not require"* | auto-generated on the new site; not required for NAPAS |
| `AJ336` | VietinBank `feePaymentType` | **"Napas not require"** | our `delete feePaymentType` on the NAPAS leg is correct |
| `AH171` / `AH176` | Woori `remitBranchCode` / `acceptName` | **"transType: 1 required, transType: 2 not required"** | our NAPAS leg is `transType=2` ⇒ not required. The `transType=1` case is unreachable (`bank-profiles.ts:466-475`) |

### ⚠️ Old site vs new site — a dimension neither WeCMS nor WABOOKS models

Comment on `AH6`/`AJ6`: Vietcom CORPORATE and VietinBank CORPORATE each branch to an **old or new
site after login, depending on the user's account**, and required fields differ between them —
`acceptName` (`AJ332`), `feePaymentType` (`AJ336`, forced to 본인부담 on the new site with the fee
selector removed), `transPWD` (`AH338`, required on the old site when `OTPType=2` eToken).

Neither system has any concept of this. It is a plausible explanation for a VietinBank transfer
failing with *"No Deposit Bank Branch Code entered"* while others succeed — **unconfirmed**, and one
of the open questions below.

## Also confirmed

- `_ML` = **다단계이체** — the sheet's own section titles are `TRANSFER_ML (다단계이체)` and
  `TRANSFER_INTERNAL_ML (다단계이체 (당행 이체))`. Independent vendor confirmation of the
  multi-level-approval reading behind the approval notice.
- Vietcom exposes a third class, **PERSONAL**, that WeCMS never selects
  (`resolveNxisasBankClass` maps `NXISAS_GB_SEQ_NO` 0 → CORPORATE, 1 → DIGIBIZ only).

## Open questions for the Coocon scraping team

1. **Vietcom CORPORATE `TRANSFER_ML`** is marked *supported* in the sheet, but you reported it errors
   `80010222` as an unused old job. Should the sheet be corrected?
2. **Vietcom CORPORATE `TRANSFER_INTERNAL_ML`** is **blank** — is same-bank transfer supported on
   CORPORATE at all? WeCMS sends that job today.
3. **VietinBank CORPORATE old vs new site** — we see *"No Deposit Bank Branch Code entered"* on some
   VietinBank transfers while others succeed. Does the old site require `remitBranchCode` even for
   NAPAS, and how should a client know which site an account will land on?

*(A fourth question, about whether Woori VN supports transfer at all, was withdrawn — see the Woori
section above.)*

## What changed in our code because of this

| Change | Driver |
|---|---|
| Vietcom CORPORATE transfer **guard** — row button disabled, composer pre-flight, `80010222` message | This document + the scraping team's report |
| `recordedTransferNeedsBankApproval` assumes **DIGIBIZ** for Vietcom | DIGIBIZ has no `APPROVAL_LIST`/`APPROVAL` job, so it needs no approval notice |

Nothing else. Every other bank's job and field set already matched the vendor spec.

## Change history

| Date | Change |
|---|---|
| 2026-08-27 | Created from the vendor workbook after the `80010222` report |
| 2026-08-27 | **Corrected** — Woori VN is fully supported (earlier "unresolved" reading took the `BGD` sub-column); added the three reading traps; documented the `구/신 사이트` meaning of `x/y`; added the cell-comment findings and the open questions |
