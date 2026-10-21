# Own Account Transfer — tell the user when a transfer still needs bank-side approval (`_ML` jobs)

**Date:** 2026-08-27
**Type:** ISSUE — new behaviour, not a defect
**Current Work Classification:** ISSUE
**Status:** READY FOR MANUAL COMMIT
**Repository:** wecms-web (frontend only — no backend change)
**Evidence:** [wecms-api/docs/audits/legacy-parity/own-account-transfer-account-password-source-2026-08-25.md](../../../wecms-api/docs/audits/legacy-parity/own-account-transfer-account-password-source-2026-08-25.md) **G-7a**

```
Investigation Status:  COMPLETE
Approval Status:       APPROVED — Sonny, 2026-08-27, "Please fix in the refactor WeCMS"
Implementation Status: COMPLETE
Test Status:           PASS
```

## Why ISSUE and not BUG

**This is not a parity gap.** The audit originally logged it as G-7 — *"legacy warns, the refactor
doesn't"* — and that premise was **wrong**. WeCMS legacy does not warn either: the notice string
exists at `trns_0003_001.ts:96` and is written at `:140` into `.title_info`, but that element **does
not exist in the WeCMS view tree** (`grep -rln "title_info" "WECMS DEV/WECMS/web"` → no matches).
WeCMS rebuilt the Transfer History header (`trns_0003_001_view.jsp:114-115`) and dropped WABOOKS'
`exclamationWrap` block, so the call is a silent no-op. Confirmed on UAT
`test.wecms.vn/trns_0003_001.act` — no ⓘ, no notice. G-7 was withdrawn and replaced by **G-7a**.

So the refactor was **already at parity**. This change is a deliberate improvement over both legacy
systems, requested by the PO — hence ISSUE (needed work, not a defect), not BUG.

## Problem

An `_ML` (다단계 승인, multi-level approval) engine job does **not move money** — it only
**registers** the transfer at the bank. Someone must then approve it inside the bank's own internet
banking before it settles. The refactor showed a bare *"Transfer completed successfully."* for those,
which tells the user the opposite of what happened, and would generate *"it succeeded but no money
moved"* reports.

## Target behaviour

Two surfaces, both driven by the same rule:

1. **Composer success dialog** — on a successful `_ML` transfer, say the request was **registered**
   and still needs approval in internet banking. Non-`_ML` transfers keep the existing message.
2. **Transfer History → Results cell** — an `_ML` row surfaces the same explanation through the
   **existing shared `<Tooltip>`** already used for the bank's failure message
   (Sonny, 2026-08-27: *"use the common tooltip like Failed"*). No new chrome, no new column, no
   visible label added to the cell — hover only, exactly like a Failed row.

The two tooltip cases are mutually exclusive: `statusMessage` is only ever populated on a failure
(the engine returns `ErrorMessage: ""` on success), and `needsBankApproval` is gated on
`status === "success"` in the mapper. A bank failure message always wins.

## Implementation

| File | Change |
|---|---|
| [`bank-profiles.ts`](../../components/banking/own-account-transfer/bank-profiles.ts) | `isMultiLevelApprovalJob(job)` · `orgObjNeedsBankApproval(orgObj)` · `recordedTransferNeedsBankApproval(outBankCd, inBankCd)` — job semantics live with the profiles |
| [`OwnAccountTransferComposerDialog.tsx`](../../components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx) | Success branch picks the message from the resolved job |
| [`TransferHistoryTable.tsx`](../../components/banking/internal-transfer/TransferHistoryTable.tsx) | Results-cell `<Tooltip>` content falls back to the approval notice |
| [`internal-transfer/types.ts`](../../components/banking/internal-transfer/types.ts) | `TransferRow.needsBankApproval` |
| [`lib/api/mappers.ts`](../../lib/api/mappers.ts) | `mapTransferHistoryRow` derives it from `out_bank_code` / `in_bank_code`, gated on success |
| `locales/{en,ko,vi}.json` | `own_account_transfer.composer.success.message_needs_bank_approval` · `transfer_history.tooltip.needs_bank_approval` |

### Transfer History derives the job — and Vietcom is settled by vendor evidence

`NAPAS_REMIT_TRNS_HSTR` stores **no job kind** (legacy has no such column, and adding one would
breach the legacy-table rule), so the history path re-derives `_ML` from the two bank codes on the
row. One bank is ambiguous from those codes alone:

**Vietcom `11704004`** switches on the credential's NXiSAS module class — CORPORATE → `_ML`, DIGIBIZ
→ immediate. That class lives on `BANK_CERT_INFO.NXISAS_GB_SEQ_NO` and is not on the history row.

**Resolved 2026-08-27: assume DIGIBIZ ⇒ Vietcom never warns.** The tie is broken by the fact that a
CORPORATE Vietcom transfer **cannot succeed at all**:

- Coocon scraping team, 2026-08-26 — *"Vietcom CORPORATE didn't have Napas Transfer, moreover
  TRANSFER_ML in Vietcom CORPORATE is old job that Wabooks never used before. Therefore, it got error
  **80010222**."*
- Legacy UAT `test.wecms.vn/trns_0003_001.act` — a Vietcom → Vietcom transfer on 2026-08-26 failed
  with *"Job명을 확인해주시기 바랍니다"* ("please check the Job name"), the same unsupported-job
  symptom, on the same-bank leg.

The predicate is only consulted on a **success** row, and CORPORATE cannot produce one, so any
successful Vietcom row ran on DIGIBIZ — immediate, not `_ML`. This also makes Transfer History agree
with the composer, closing what was follow-up #7.

> ⚠️ **Revisit if the vendor ships a working Vietcom CORPORATE module** (the scraping team's option 2
> — `[WABOOKS] 01.NEW SCRAPING MODULE`). CORPORATE would then start producing successful `_ML` rows
> that this predicate would silently under-warn.

**Corroborated by the vendor workbook** (`[개발] Smart_API_DATA.xlsx`, read 2026-08-27 — see
[nxisas-vietnam-job-support-matrix.md](../references/nxisas-vietnam-job-support-matrix.md)):

- **Vietcom DIGIBIZ** supports `TRANSFER` / `TRANSFER_INTERNAL` and **not** the `_ML` pair — so the
  working Vietcom path is genuinely non-`_ML`, exactly as this predicate now assumes.
- **Vietcom CORPORATE** has no `TRANSFER` / `TRANSFER_INTERNAL` at all, and its
  `TRANSFER_INTERNAL_ML` — the job our same-bank leg sends — is **blank** in the sheet, matching the
  observed *"Job명을 확인해주시기 바랍니다"* failure.
- **VietinBank** supports both `_ML` jobs, so the notice is correct for VIETIN.
- **Shinhan COMMON has no `TRANSFER_INTERNAL`**, which is precisely why its same-bank leg uses
  `TRANSFER_INTERNAL_ML` — independent confirmation that a same-bank Shinhan transfer really is
  multi-level approval, and that the notice belongs on that leg.
- The sheet's own section titles read `TRANSFER_ML (다단계이체)` and
  `TRANSFER_INTERNAL_ML (다단계이체 (당행 이체))` — vendor confirmation of the 다단계 승인 reading
  this whole feature rests on.

A **drift guard** in the test file cross-checks `recordedTransferNeedsBankApproval` against real
`buildNxisasOrgObj` output for every bank × direction, so a future change to a profile builder cannot
silently desync the two surfaces.

### 🔴 The rule is per-JOB, never per-bank

The obvious shorthand — *"Vietcom and VIETIN are the ML banks"* — is **wrong twice**, and my own
earlier notes used it. The real matrix:

| Bank | NAPAS leg | Same-bank leg | Notice? |
|---|---|---|---|
| IBK `11704003` | `TRANSFER` | `TRANSFER_INTERNAL` | never |
| Woori `11704020` | `TRANSFER` | `TRANSFER_INTERNAL` | never |
| **Shinhan `11704088`** | `TRANSFER` | **`TRANSFER_INTERNAL_ML`** | **same-bank leg only** |
| Vietcom `11704004` | `TRANSFER_ML` | `TRANSFER_INTERNAL_ML` | both legs |
| **Vietcom, DIGIBIZ class** | `TRANSFER` | `TRANSFER_INTERNAL` | **never** |
| VIETIN `11704001` | `TRANSFER_ML` | `TRANSFER_INTERNAL_ML` | both legs |

A bank list would **miss Shinhan's same-bank leg** and **over-warn on Vietcom DIGIBIZ**. The
predicate therefore reads the job the profile actually produced
(`bank-profiles.ts:200, 229, 285-287, 345, 349, 370, 406`), which mirrors legacy
`trns_0001_007.ts:1932-2012`.

> The Vietcom `TRANSFER_ML` rows above describe what the **composer** builds on a CORPORATE
> credential. Per the 80010222 finding that job cannot actually complete, so it never reaches a
> success dialog — and the **history** path assumes DIGIBIZ and never warns for Vietcom. The two are
> consistent; the table documents the job selection, not the observed outcome.

### Deliberate divergence from WABOOKS

WABOOKS renders this as an **unconditional page banner** on Transfer History — the call sits in
`default()` and never inspects the bank or the job kind, so it warns Shinhan and IBK users too, on a
different screen, for transfers that need no approval. This implementation is **conditional and at
the moment of transfer** instead. Recorded as a deliberate improvement, not a port.

## API Impact

**None.** Frontend-only; the job kind is already resolved client-side when the engine payload is
built.

## Database Impact

**NONE (frontend), and no dependency.** No backend record is paired with this change.

## UI Impact

Two surfaces, both text-only:

1. **Composer success dialog** — copy changes on `_ML` transfers. No new dialog type; the existing
   `useDialog()` `type: "success"` surface is reused per CLAUDE.md §"Dialog variant".
2. **Transfer History Results cell** — the existing shared `<Tooltip>` gains a second content source.
   No layout change, no new column, no visible label; the cell renders exactly as before and the
   notice appears on hover only.

Under the current Vietcom decision (DIGIBIZ assumed) the history tooltip fires for **VIETIN on both
legs** and **Shinhan on its same-bank leg** only.

## Verification

### Automated Tests

| Test / Command | Result |
|---|---|
| new [`bank-profiles.multiLevelApproval.test.ts`](../../components/banking/own-account-transfer/bank-profiles.multiLevelApproval.test.ts) — **28 cases** | PASS |
| 4 cases added to [`TransferHistoryTable.resultsTooltip.test.tsx`](../../components/banking/internal-transfer/TransferHistoryTable.resultsTooltip.test.tsx) | PASS |
| `npx vitest run components/banking/internal-transfer components/banking/own-account-transfer` | **PASS** — 13 files, **178 tests**, 0 failures |
| `npx vitest run` (whole suite) | 27 files, **331 tests — 320 pass, 11 fail** · see *Existing Failures* |

Cases that exist specifically to pin the traps:

| Test | Protects |
|---|---|
| *Shinhan is `_ML` on the SAME-BANK leg* | a bank list would miss it |
| *Shinhan's NAPAS leg is NOT `_ML`* | a bank list would over-warn |
| *Vietcom on DIGIBIZ is NOT `_ML`* | a bank list would over-warn |
| **drift guard** — derived answer matches `buildNxisasOrgObj` for every bank × direction (10 cases) | history and composer cannot desync |
| *Vietcom never warns — a CORPORATE transfer cannot succeed (80010222)* | pins the vendor-evidenced assumption in code |
| *a bank failure message still wins over the approval notice* | the two tooltip sources cannot mask each other |
| *does not add any visible label to the cell — tooltip only* | the Results cell renders exactly as before |

### Existing Failures

**11 failures in `components/addon/sales-einvoices/useEInvoiceScrape.test.ts`** — the
**documented pre-existing** stale-`vi.mock` failure recorded in
[CLAUDE.md §14j](../../CLAUDE.md) and
[testing-strategy.md](../testing/testing-strategy.md). Category **B**: unrelated to this change,
cited not repaired. Every other file passes.

### Regression Review

- Areas checked: all 175 pre-existing OAT + internal-transfer tests still pass; the non-`_ML` path keeps the original success message; the Failed tooltip is unchanged (its own 7 tests still pass); `mapTransferHistoryRow` has exactly one consumer (`TransferHistoryClient.tsx:152`), so no other fixture needed the new field.
- Result: **PASS**

### Type Check

- Command: `npx tsc --noEmit`
- Result: **INCONCLUSIVE** — 43 parse errors in `.next/dev/types/routes.d.ts` from a concurrently
  running `next dev` (known: memory `reference_next_dev_types_build_conflict.md`). No error in any
  source file, but while that `.d.ts` fails to parse the run is not fully trustworthy — the two
  pre-existing `engine_80002411` locale errors also disappeared, which suggests degraded type
  resolution. **Re-run with the dev server stopped before merge.**

### Manual Verification

- Environment: none
- Result: **NOT RUN** — UI not started, no NXiSAS engine. The dialog copy has not been seen rendered.

## Known Limitations / Follow-up

| # | Item | Owner |
|---|---|---|
| 1 | Clean `tsc --noEmit` with `next dev` stopped | before merge |
| 2 | SIT: confirm a VIETIN or Vietcom transfer shows the new message, and an IBK/Woori one does not | Mr. Youvita |
| 3 | SIT: confirm **Shinhan same-bank** shows it while **Shinhan NAPAS** does not — the case most likely to be got wrong | Mr. Youvita |
| 4 | Update the screen's `ui-specification.md` + `test-scenarios.md` once SIT confirms | after #2/#3 |
| 5 | ~~Transfer History shows nothing~~ — **DONE 2026-08-27**, this record now covers it via the shared Results-cell tooltip | — |
| 6 | VI translations (both strings) are reasoned renderings of the legacy KO text, not verified WeCMS strings — have the VN team confirm the wording | Vietnam team |
| 7 | ~~Vietcom DIGIBIZ inconsistency~~ — **CLOSED 2026-08-27** by the Coocon 80010222 report: Vietcom CORPORATE cannot succeed, so history now assumes DIGIBIZ and agrees with the composer | — |
| 8 | Consider whether the same tooltip belongs on the Payment module's transfer-result lists, which have the same `_ML` exposure | Mr. Jung |
