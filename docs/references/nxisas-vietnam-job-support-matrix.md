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

## Inquiry-job support — Vietcom (added 2026-08-27)

Read because the remedy for the CORPORATE transfer block is to **re-bind accounts to DIGIBIZ**, which
only works if DIGIBIZ also serves inquiry. Sheet `VNM_BANK_API_Data`, Vietcom group:
**AG = PERSONAL · AH = CORPORATE · AI = DIGIBIZ**.

| Section | Rows | CORPORATE (**AH**) | DIGIBIZ (**AI**) |
|---|---|---|---|
| `BALANCE` (잔액조회) | 40–56 | ✅ | ✅ |
| `TRANSACTION` (거래내역) | 58–82 | ✅ | ✅ |

Both fully numeric for DIGIBIZ — `acctNum` · `acctName` · `acctType` · `currency` · `balance` ·
`availableBal` · `openDate` on BALANCE; `acctNum` · `startDate` · `endDate` · `order` · `date` ·
`debit` · `credit` · `remarks` · `bankReference` on TRANSACTION. **No dashes anywhere in column AI**
for either section, which is the supported/unsupported test stated in §"How to read the workbook".

Two per-field differences worth knowing before moving accounts:

| Field | CORPORATE | DIGIBIZ | Note |
|---|---|---|---|
| `BALANCE.branchName` | `0` (unused) | `2` (optional) | DigiBiz can return a branch name |
| `BALANCE.availableBal` · `BALANCE.openDate` | `1/0` | `1` | The `1/0` is the **구/신 사이트** old/new-site split (trap #3), not a condition. DIGIBIZ carries a clean `1` — a single modern portal, no old/new branch. |

### Fixed-deposit + foreign sections (read 2026-08-27)

| Section | Rows | PERSONAL (**AG**) | CORPORATE (**AH**) | DIGIBIZ (**AI**) | Do we call it? |
|---|---|---|---|---|---|
| `BALANCE_FIXED_DEPOSIT` (예적금 잔액조회) | 134–152 | ❌ | ✅ | ✅ | **yes** |
| `ACCT_LIST_FOREIGN` (외화목록조회) | 154–166 | ❌ | ❌ | ❌ | **no** |
| `BALANCE_FOREIGN` (외화잔액조회) | 168–183 | ❌ | ❌ | ❌ | **no** |

`BALANCE_FIXED_DEPOSIT` is fully numeric on DIGIBIZ — `acctName` · `acctNum` · `acctType` ·
`currency` · `balance` · `openDate` · `rate` · `maturityDate` all `1`, `principal` `0`. **Fixed-deposit
accounts are therefore safe to re-bind to DIGIBIZ.**

⚠️ One field regression to expect: **`availableBal` is `1` on CORPORATE but `0` on DIGIBIZ.** DigiBiz
does not return available balance for a fixed deposit, so an FD row moved to DIGIBIZ shows an empty
Available Balance where iB@nking showed a value. Cosmetic for a term deposit — but brief the tester
so it is not filed as a regression.

**The `_FOREIGN` sections are irrelevant.** Neither codebase invokes them — a grep of every
`ACCT_LIST` / `BALANCE` / `TRANSACTION` job string yields: legacy `BALANCE` 22 · `TRANSACTION` 4 ·
`ACCT_LIST` 3 · `BALANCE_FIXED_DEPOSIT` 3 · `TRANSACTION_FIXED_DEPOSIT` 2; refactor 9 · 3 · 3 · 2 · 1.
No `_FOREIGN` job appears in either. FCY screens filter by currency over the same `ACCT_LIST` /
`BALANCE` data.

## 🔑 Read `BANK_Module_List` first — not the API_Data matrices

**Added 2026-08-27 after opening the workbook directly.** Every earlier revision of this document was
built by reading the wide `*_BANK_API_Data` matrices column by column — which is where all three
reading traps live, and where two earlier readings went wrong.

**`BANK_Module_List` answers "is job X supported for bank Y class Z" directly**, one row per
bank+class, `○` per supported job. Vietnam occupies **rows 614–652**; per-class sub-rows (DIGIBIZ,
PERSONAL, CORPORATE_FastE …) sit **beneath** their bank's row with **blank** name/module cells, so a
filter on the bank-name column silently drops them — read the whole block.

Column map (job headers in **row 7**): `I` LOGIN · `J` LOGOUT · `K` ACCT_LIST · `L` BALANCE ·
`M` NONINQUIRE · `N` TRANSACTION · `O` TRANS_TODAY · `P` TRANS_PAST · `Q` TRANS_YESTERDAY ·
`R` ACCT_LIST_FIXED_DEPOSIT · `S` BALANCE_FIXED_DEPOSIT · `T` TRANSACTION_FIXED_DEPOSIT ·
`U` ACCT_LIST_FOREIGN · `V` BALANCE_FOREIGN · `W` TRANS_FOREIGN · `X` TRANSFER · `Y` TRANSFER_ML ·
`Z` TRANSFER_INTERNAL · `AA` TRANSFER_INTERNAL_ML · `AB` APPROVAL_LIST · `AC` APPROVAL ·
`AD` RECEIVER_INFO · `AE` DEBIT_CARD_TRANS · `AF` FOREIGN_EXCHANGE · `AG` POINT_USING ·
`AH` STATEMENT · `AI` LOAN_INFO.

### Vietcom (`11704004`) — complete supported-job set

| Class | Sheet row | Supported jobs (`○`) |
|---|---|---|
| **CORPORATE** (VCB iB@nking) | 644 | LOGIN · LOGOUT · ACCT_LIST · BALANCE · TRANSACTION · **BALANCE_FIXED_DEPOSIT** · **TRANSFER_ML** · APPROVAL_LIST · APPROVAL · FOREIGN_EXCHANGE |
| **DIGIBIZ** | 645 | LOGIN · LOGOUT · ACCT_LIST · BALANCE · TRANSACTION · **BALANCE_FIXED_DEPOSIT** · **TRANSFER** · **TRANSFER_INTERNAL** · RECEIVER_INFO |
| **PERSONAL** | 646 | LOGIN · LOGOUT · ACCT_LIST · BALANCE · TRANSACTION |

This confirms every earlier reading of the VNM matrix and settles three things outright:

1. **DIGIBIZ serves inquiry.** `ACCT_LIST` · `BALANCE` · `TRANSACTION` · `BALANCE_FIXED_DEPOSIT` all
   `○`. The re-bind decision stands.
2. **Vietcom CORPORATE has no `TRANSFER_INTERNAL_ML`** — closing open question 2 below. Same-bank
   transfer is **not** supported on CORPORATE at all, which is exactly why the Vietcom → Vietcom
   transfer failed on legacy UAT. The blank cell in the matrix was a real "unsupported", not missing data.
3. **DIGIBIZ has no `APPROVAL_LIST` / `APPROVAL`** — vendor-confirmed, matching what
   `recordedTransferNeedsBankApproval` already assumes.

Two DIGIBIZ gaps versus CORPORATE, both checked and harmless:

- **`FOREIGN_EXCHANGE`** — CORPORATE `○`, DIGIBIZ blank. **No impact:** `ExchangeRateBatchService`
  scrapes FX from **Shinhan (`11704088`) and Woori (`11704020`) only** — Vietcom is never an FX
  source.
- **`APPROVAL_LIST` / `APPROVAL`** — **no impact:** neither codebase invokes an approval job (grep of
  the whole static tree + backend returns zero hits). Bank-side approval is a human action in the
  bank's portal.

### 🔴 `TRANSACTION_FIXED_DEPOSIT` — we send a job no Vietnam bank supports

**Finding, 2026-08-27.** `TRANSACTION_FIXED_DEPOSIT` (col **T**) is `○` for **exactly one institution
in the entire workbook — HSBC / CORPORATE.** No Vietnam bank supports it in any class, Vietcom
included, and the VNM sheet carries **no `TRANSACTION_FIXED_DEPOSIT` section at all** (sections jump
`TRANS_PAST` 108 → `BALANCE_FIXED_DEPOSIT` 134).

Both systems nevertheless send it for Vietcom fixed deposits:

- Legacy `nxisas_tranList_osmc.js:312-321` — for `ACCT_TYPE_CD = "02"` **and** `bankCd = 11704004`,
  pushes `BALANCE_FIXED_DEPOSIT` **and** `TRANSACTION_FIXED_DEPOSIT`. Tagged
  `redmine/issues/42051 : only for VCB`.
- The sibling branch (`:325-338`) for Shinhan / ACB / HD / Vietin / VP pushes `BALANCE_FIXED_DEPOSIT`
  only, with the explicit comment *"no TRANSACTION_FIXED_DEPOSIT support"* — so the distinction was
  made deliberately, for Vietcom alone.
- The refactor mirrors it — `BankTransactionSyncService:117-138`, `ScrapeMode.FD_BALANCE_AND_TX` for
  `BANK_VCB`, `FD_BALANCE_ONLY` for the rest.

Either the sheet is stale for Vietcom (as it demonstrably is for `TRANSFER_ML`), or the call has been
silently failing for Vietcom FD accounts since ticket 42051. **Ask the vendor — do not "fix" it by
deleting the job.** Add to the open-questions list below.

**It does not affect the re-bind:** CORPORATE and DIGIBIZ are identical here (both blank), so moving
an FD account between them changes nothing.

> ### ✅ Closed — the section ending at sheet row 132
>
> An earlier revision flagged rows 128–132 (`remarks3` · `dailyBal` · `debitSum` · `creditSum` ·
> `lastBalOfList`, all `-` for Vietcom) as *possibly* `TRANSACTION_FIXED_DEPOSIT`. **That guess was
> wrong.** The section headers read directly from col B are: `TRANS_TODAY` **84** · `TRANS_PAST`
> **108** · `BALANCE_FIXED_DEPOSIT` **134**. Rows 108–133 are **`TRANS_PAST` (과거내역)**, which no
> Vietcom class supports (only BOC Bank does, row 620) and which neither codebase calls — WeCMS uses
> `TRANSACTION` with `startDate`/`endDate`. Nothing to do.

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

4. **`TRANSACTION_FIXED_DEPOSIT` for Vietcom** — `BANK_Module_List` shows it supported by HSBC/CORPORATE only, by no Vietnam bank in any class, and the VNM sheet has no such section. Yet legacy (`nxisas_tranList_osmc.js:312-321`, ticket 42051) and the refactor both send it for Vietcom fixed deposits. Is the sheet stale, or has this call been failing silently?

*(A fifth question, about whether Woori VN supports transfer at all, was withdrawn — see the Woori
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
| 2026-08-27 | Added **Inquiry-job support — Vietcom**: `BALANCE` + `TRANSACTION` confirmed supported for DIGIBIZ (cols AG/AH/AI, rows 40–82), closing the open question behind the re-bind decision. |
| 2026-08-27 | Added the **fixed-deposit + foreign** rows: `BALANCE_FIXED_DEPOSIT` (134–152) supported on DIGIBIZ — FD accounts safe to re-bind, with `availableBal` the one field DIGIBIZ drops; `ACCT_LIST_FOREIGN` / `BALANCE_FOREIGN` unsupported but **never called** by either codebase. One section (ending row 132, header off-screen) left open. |
| 2026-08-27 | **Opened the workbook directly** (`[개발] Smart_API_DATA.xlsx`, 83 sheets). Added §"Read `BANK_Module_List` first" with the Vietcom complete job set from rows 644–646 — DIGIBIZ inquiry support and the CORPORATE `TRANSFER_INTERNAL_ML` gap both vendor-confirmed. **Corrected** the row-132 guess (it is `TRANS_PAST`, not `TRANSACTION_FIXED_DEPOSIT`). New finding: `TRANSACTION_FIXED_DEPOSIT` is supported by HSBC/CORPORATE only, yet both codebases send it for Vietcom — raised as open question 4. |
