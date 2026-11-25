# Sync Dialog Missing-XML Reason — Test Result

**Date:** 2026-11-25
**Type:** TEST RESULT
**Status:** PARTIAL
**Repository:** we-scraping-web
**Related Record:** [Sync Dialog Shows "Done 38/58" With No Reason for Missing XML](../../bugs/sync-dialog-missing-xml-reason-2026-11-25.md)

## Scope

`components/sync/syncMessage.ts` (new shared helper), `SyncDialog.tsx` (renders the engine reason under the
result cards), `SyncPages.tsx` (history page now uses the shared helper instead of its private `KNOWN_MSG`).

## Environment

LOCAL (Windows, Node from the repository's `node_modules`). No SIT/UAT run.

## Code / Build Under Test

Branch: `scraping-data` · Base commit: `2367585` · Commit: NOT COMMITTED · API: not called (pure helper tests).

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/sync` | PASS | 1 file, 6 tests passed |
| `npm test` equivalent `npx vitest run` (full suite) | PASS | 28 files, 227 tests passed |
| `npx eslint components/sync` | PASS | no findings |
| `npx tsc --noEmit -p .` | PASS for source | 0 errors outside `.next/`; 44 errors only in stale `.next/types/validator.ts` (old WeCMS routes from a previous build — pre-existing, unrelated) |
| `node scripts/check-doc-links.mjs` | PASS (in-repo) | in-repo broken 0, unsafe 0; out-of-repo broken 2 = `CLAUDE.md:1637/1712 → ../CLAUDE.md` (pre-existing) |

## Regression Tests

Did a regression test cover the original defect? **YES**

- Test file: `components/sync/syncMessage.test.ts`
- Test case: `shows the engine's reason on a successful run that still lacks XML` (+ partial / fallback / marker cases)
- Original failure protected: the dialog rendered nothing (success) or only the generic partial note, never the
  reason the engine sends in `message`.
- Result: PASS

## Test Scenarios

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| Run a real sync in the dialog against SIT/engine | Reason text under the result cards | — | NOT RUN — needs the engine change (`scan-captcha-project` commit `8aa9cd4`) deployed on .13 and the web build running |

## UI Verification

NOT RUN — the dialog was not rendered in a browser; the change is a text line using existing tokens
(`text-wb-12`, `text-wb-warn-text`, `text-wb-ntrl-7`).

## Database Verification

NOT APPLICABLE — no database dependency.

## Existing Failures

`.next/types/validator.ts` stale type references (44) and 2 out-of-repo doc links — present before this change.

## New Failures

None.

## Not Tested

End-to-end dialog with the real engine message (see Test Scenarios).

## Final Result

PARTIAL — automated checks PASS; end-to-end UI check pending deployment.

## Recommendation

READY FOR MANUAL COMMIT — verify on SIT after the engine update on .13.
