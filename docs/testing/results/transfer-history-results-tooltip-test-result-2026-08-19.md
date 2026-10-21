# Transfer History — Results Cell Tooltip — Test Result

**Date:** 2026-08-19
**Type:** TEST RESULT
**Status:** PASS
**Repository:** wecms-web
**Related Record:** [Transfer History — Results Cell Uses a Native `title` Tooltip Instead of the Shared Tooltip](../../bugs/transfer-history-results-tooltip-2026-08-19.md)
**Issue:** —

## Scope

Verification that the Transfer History **Results** cell no longer carries a native `title`
attribute and renders the bank's failure message through the shared
[`<Tooltip>`](../../../components/shared/Tooltip.tsx) instead, with legacy's gate preserved
(message non-empty, not status-based — `trns_0003_001.ts:288`, `:319`).

## Environment

LOCAL only. **SIT / UAT not exercised** — deployment is manual and has not happened.

## Code / Build Under Test

- Branch: `wecms-ui-fixes`
- Commit: **NOT COMMITTED** — working tree
- Build/artifact: Vitest 2.1.9 (jsdom) + `@testing-library/react`, TypeScript `tsc --noEmit`, ESLint 9
- API URL/environment: not used — the table renders from props; no HTTP

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/banking/internal-transfer` | **PASS** | 1 file, **7 executed, 7 passed, 0 failed** |
| `npx tsc --noEmit -p tsconfig.json` | **PASS for this change** | 0 errors in the changed files; 2 pre-existing errors elsewhere — see `## Existing Failures` |
| `npx eslint components/banking/internal-transfer/` | **PASS** | 0 problems |
| `git diff --stat` | **PASS** | 1 modified file (38 insertions(+), 19 deletions(-)) + 1 new test file; nothing else |

New test file: `components/banking/internal-transfer/TransferHistoryTable.resultsTooltip.test.tsx`
— under `components/**`, where `vitest.config.ts` collects (CLAUDE.md §14c include-glob trap).

### The 7 cases and what each pins

| # | Case | Pins |
|---|---|---|
| 1 | **renders NO native `title` attribute anywhere in the row** | **the regression** — the cell must never re-acquire the OS tooltip |
| 2 | shows the bank message through the shared Tooltip on hover | `role="tooltip"` is absent until hover, then carries the message (portal-mounted on demand) |
| 3 | hides the tooltip again on mouse leave | open/close symmetry |
| 4 | keyboard reachable — focus opens, blur closes | the accessibility gain a native `title` cannot provide |
| 5 | no tooltip trigger at all when the row carries no message | legacy `:319` omits the layer for an empty `TRNS_MSG`; `<Tooltip>` renders children bare |
| 6 | **gates on the MESSAGE, not the status** | legacy `:288`/`:319` have no `TRNS_STTS` branch — a success row carrying a message would still show it |
| 7 | Failed label + timestamp rendering unchanged | the fix is presentation-only; cell content is untouched |

## Regression Tests

**Did a regression test cover the original defect? YES.**

```
Test file:          components/banking/internal-transfer/TransferHistoryTable.resultsTooltip.test.tsx
Test case:          "renders NO native title attribute anywhere in the row"
Original failure protected: the Results cell shipped `title={row.statusMessage}`, so the bank
                    message rendered as the browser's own tooltip
Result:             PASS after the fix, FAIL before it (executed — see below)

Test case:          "gates on the MESSAGE, not on the status — legacy `:288` / `:319`"
Original failure protected: n/a (new guard) — prevents the gate drifting to `status === "failed"`,
                    which would swallow a message on any future non-failed status
Result:             PASS
```

### Fail-before / pass-after — actually executed

1. Copied the fixed `TransferHistoryTable.tsx` to the session scratchpad.
2. `git checkout --` restored it to `HEAD` (pre-fix), leaving the new test file in place.
3. `npx vitest run components/banking/internal-transfer` → **1 file failed, 5 of 7 cases failed**
   (`title` attribute present; no `role="tooltip"` on hover, mouse-leave, focus, or the
   message-gate case).
4. The 2 that passed pre-fix assert behaviour the fix must **not** break — the no-message row and
   the Failed label + timestamp.
5. Restored the fixed file → **7/7 PASS** (`git diff --stat` confirms the restore: 38 insertions,
   19 deletions).

No git history was modified — working-tree contents only.

## Test Scenarios

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| Failed row, hover the Results cell | product-styled dark tooltip with the bank message, 320 px wrap | `role="tooltip"` node with the message text | **PASS** (jsdom) |
| Failed row, keyboard focus | tooltip opens on focus, closes on blur | as expected | **PASS** |
| Success row (empty message) | no tooltip, no `title`, no wrapper | children render bare | **PASS** |
| Rendered pixels — colour, notch, position, 320 px wrap | matches Figma 9198:8036 | **not inspected** | **NOT RUN** — see `## Not Tested` |

## API Verification

**NOT APPLICABLE** — presentation-only change. `trns_msg` already arrives on the wire and
`statusMessage` already existed on the row type; no request or response handling was touched.

## UI Verification

- Static review: **PASS** — the cell's box is unchanged (the tooltip is portal-mounted; the
  trigger `<span>` is `block h-full w-full` inside the same `<td>`), no token / typography /
  locale change, and the message text is identical.
- Rendered/visual verification: **NOT RUN** — the app was not started for this change. The
  tooltip's visual contract comes from the shared component (already in use elsewhere), not from
  new styling in this diff.

## Database Verification

**NOT APPLICABLE** — no database dependency; no `.sql` in this repository (CLAUDE.md §12g).

## Existing Failures

`npx tsc --noEmit` reports **2 pre-existing errors**, both in
`components/banking/own-account-transfer/OwnAccountTransferComposerDialog.locales.test.ts:92-93`:

```
error TS2551: Property 'own_account_transfer.composer.error.engine_80002411'
does not exist on type '{ … }'
```

- **Pre-existing** — that file is unmodified by this change (`git status` shows it untracked as
  modified), and the errors are on the `ko[key]` / `vi[key]` lines where the test *deliberately*
  asserts the KO/VI files do **not** carry the key (the EN fallback assertion). TypeScript rejects
  indexing a JSON object type with an absent key; the runtime assertion is correct and **the test
  passes** (7/7 in that file).
- **Why it only surfaced now:** earlier `tsc` runs in this repo were reaching a corrupt
  `.next/dev/types/routes.d.ts` (the documented concurrent-`next dev` artifact), and TypeScript
  stops before the semantic pass when the program has syntax errors — so "0 errors after filtering
  `.next/`" was masking every semantic error in the project. That artifact has since regenerated
  (`grep -c '^\.next/'` on the current run = 0), so the semantic pass now completes.
- **Not repaired here** — a one-line cast in an unrelated test file, out of scope
  (`feedback_preserve_existing_code`). Recorded as follow-up item 1 in the bug record.

The 11 known `useEInvoiceScrape.test.ts` failures (CLAUDE.md §14j-B) are not in this run's scope
(`components/banking/internal-transfer` only) and are unaffected by this change.

## New Failures

**None.**

## Not Tested

| Check | Why |
|---|---|
| Rendered tooltip appearance (colour, notch, clamp, 320 px wrap) | The app was not started; the shared component's Figma contract (9198:8036) is the reference. Confirm in SIT scenario T2. |
| SIT / UAT | Deployment is manual and has not happened (CLAUDE.md §15). |
| Localization | No text was added or changed — the tooltip body is bank-supplied. |

## Final Result

**PASS** (LOCAL scope, as defined above).

## Recommendation

**READY FOR MANUAL COMMIT**, then a quick visual confirmation on SIT (hover a `Failed` row on
`/banking/transfer-history`) since the rendered tooltip was not inspected locally.
