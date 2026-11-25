# Sync Dialog Shows "Done 38/58" With No Reason for Missing XML

**Date:** 2026-11-25
**Type:** BUG FIX
**Status:** READY FOR MANUAL COMMIT
**Repository:** we-scraping-web
**Investigation Status:** COMPLETE
**Approval Status:** APPROVED (user, 2026-11-25: "Duyệt cả hai")
**Implementation Status:** COMPLETE
**Test Status:** PASS (automated) · end-to-end NOT RUN

## Problem

User report (screenshots, MST 0319232069, period 11/2026): the sync dialog ("Đồng bộ hoá đơn từ Cục
Thuế") ends at **"Tải XML từng hoá đơn 38/58 · Hoàn tất"** with result cards *58 new · 0 updated · 38 XML*
(sales), and **195/415 · 189 XML** with the generic note *"Đồng bộ đã dừng giữa chừng — chạy lại để lấy
nốt"* (purchase). The user sees missing XML but no reason, so cannot tell what to do. The list's own KPI
card at the same time shows **"Thiếu XML: 0"** for the sales case.

## Current Behavior

- `components/sync/SyncDialog.tsx` shows `prog.xmlDone/prog.xmlTotal` from the engine progress, the three
  `Stat` cards from the result, and — only when `status === "partial"` — the fixed `sync.partial_note`.
- `SyncRun.message` is already mapped (`lib/api/weinvoice/sync.ts` → `toSyncRun`, `message: w.message ||
  marker`, from backend `SyncRunItem.message` = engine `err_msg`) and rendered on the sync-history page
  (`SyncPages.tsx`), but **not in the dialog**.

## Root Cause (verified)

Engine side (`scan-captcha-project/web/weinvoice_worker.py`, `do_sync` — outside this repository):

1. The sync claims XML tasks with `FOR UPDATE … SKIP LOCKED`. The always-running background XML worker
   already holds part of the same tasks, so the sync silently skips them and only counts what it downloads
   itself (DB, request #33: `xml_total 58`, `xml_done 38`, `xml_failed 0`, status `DONE`; afterwards all 58
   invoices had XML — the other 20 were downloaded by the background worker).
2. Invoices that are truly missing XML (#37 purchase: 8 `not_ready` = "GDT has no XML yet", 2
   `summary_only` = no-code invoices sent by summary table, 4 transient failures) produce no explanation;
   `err_msg` stays empty, so the UI can only show the generic partial note.

Frontend side: the dialog never renders `result.message`, so even when the engine supplies a reason it
would not reach the user.

## Expected Behavior

- Progress and the "XML" card count invoices that **have XML now**, whoever downloaded them (engine fix).
- When some invoices still lack XML, the dialog shows **why** — e.g. *"Còn 10 HĐ chưa có XML: 8 HĐ Cục Thuế
  chưa có XML (HĐ mới cấp mã), hệ thống tự tải lại sau; 2 HĐ không mã gửi theo bảng tổng hợp — Cục Thuế
  không có XML, chờ XML từ email người bán."* — instead of (or before) the generic partial note.

## Scope

- Engine (other repository, already changed 2026-11-25, not committed): wait for the background worker,
  count real XML, write a Vietnamese reason into `rslt_data.note` and `err_msg`.
- This repository (pending approval): `SyncDialog.tsx` renders `result.message` under the result cards when
  present and not one of the markers `queued` / `running` / `cancelled`; keep `sync.partial_note` as the
  fallback when there is no message.

## Out of Scope

- Backend API (`we-scraping-api`): no change — `SyncRunItem.message` already carries `err_msg`.
- Translating the engine reason into EN/KO (engine text is Vietnamese, like other engine messages shown in
  history today) — follow-up if required.

## Recommended Implementation

`components/sync/SyncDialog.tsx` line ~175: replace the partial-note line with
`result.message && !["queued","running","cancelled"].includes(result.message)` → `<p>{result.message}</p>`
(warning colour when `partial`, neutral otherwise), else the existing partial note.

## Required Tests

Component test `components/sync/SyncDialog.message.test.tsx`: result with `message` → text rendered;
`partial` without message → `sync.partial_note`; marker `cancelled` → not rendered as raw text.

## Database Impact

NONE (frontend) — no database dependency.

## Integration Impact

Depends on the engine change being deployed on the machine that runs `web/weinvoice_worker.py` (.13);
before that, `message` stays empty for successful/partial syncs and the dialog keeps today's behaviour.

## Implementation

- New shared helper `components/sync/syncMessage.ts`: `KNOWN_SYNC_MSG` (moved from `SyncPages.tsx`, the second
  consumer triggered the extraction), `syncMessageText(message, t)` (known code → `hist.msg.*`, other text as sent),
  `syncResultNote(run, t)` (engine/backend message first; generic `sync.partial_note` only for a partial run
  without a message; nothing for a clean success).
- `SyncDialog.tsx`: the partial-note line now renders `syncResultNote(result, t)` — warning colour unless the run
  is `success` (neutral `text-wb-ntrl-7`).
- `SyncPages.tsx`: history uses `syncMessageText` (same output as before).
- Engine side (other repository): `scan-captcha-project` commit `8aa9cd4` on `main` — counts real XML, writes the
  reason into `err_msg` → backend `SyncRunItem.message` → `SyncRun.message`. Backend unchanged.

## Files Changed

`components/sync/syncMessage.ts` (new) · `components/sync/syncMessage.test.ts` (new) ·
`components/sync/SyncDialog.tsx` · `components/sync/SyncPages.tsx` · `docs/features/weinvoice/test-scenarios.md`
(row 19) · this record · the test-result record.

## API Impact

None — reads the existing `SyncRunItem.message`.

## UI Impact

Sync dialog shows the engine's reason under the result cards; history page unchanged.

## Verification

### Automated Tests

- Test: `npx vitest run components/sync` (6/6) and full `npx vitest run` (28 files, 227 tests)
- Result: PASS

### Regression Test

Test file:          `components/sync/syncMessage.test.ts`
Test case:          `shows the engine's reason on a successful run that still lacks XML`
Behavior protected: the dialog shows the reason the engine sends in `message` instead of nothing / a generic note

### Regression Review

- Areas checked: sync-history page (same text via the shared helper), lint (`components/sync`), `tsc` (no source
  errors; stale `.next/types` errors pre-existing), doc links (in-repo 0 broken).
- Result: PASS

### Manual Verification

- Environment: LOCAL
- Steps: dialog not run in a browser
- Result: NOT RUN — needs the engine update on .13; verify on SIT

## Test Evidence

Test result:
[Sync Dialog Missing-XML Reason — Test Result](../testing/results/sync-dialog-missing-xml-reason-test-result-2026-11-25.md)

Final test result:    PARTIAL (automated PASS, end-to-end NOT RUN)
Regression coverage:  PASS

## Result

READY FOR MANUAL COMMIT. No commit / push performed (pushing `sit` / `uat` deploys).

## Known Limitations / Follow-up

- The engine reason is Vietnamese only (EN/KO users see Vietnamese text, as in the history page today).
- Old runs (before the engine update) keep an empty `message` — the dialog shows the old behaviour for them.
- End-to-end check on SIT after .13 pulls `scan-captcha-project` `8aa9cd4` and restarts "Invoice WeInvoice Worker".
