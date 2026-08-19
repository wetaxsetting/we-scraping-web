# Transfer History — Results Cell Uses a Native `title` Tooltip Instead of the Shared Tooltip

**Date:** 2026-08-19
**Type:** BUG FIX
**Current Work Classification:** BUG
**Investigation Status:** COMPLETE
**Approval Status:** NOT REQUIRED — the request carries implementation intent ("remove this title attr then use the common tooltip")
**Implementation Status:** COMPLETE
**Test Status:** PASS
**Status:** READY FOR MANUAL COMMIT
**Repository:** wecms-web
**Issue:** —

## Problem

On Banking → Internal Transfer → **Transfer History** (`/banking/transfer-history`), hovering a
`Failed` value in the **Results** column shows the browser's **native** tooltip — an unstyled
full-width strip rendered by the OS, not the product's tooltip. Reported from SIT
(`wecms.kosign.dev`) with the message:

```
The transaction failed, since the financial institution`s webpage was modified.
please check and try again later.
```

Two things to settle:

1. The native `title` attribute must be replaced with the shared Tooltip component.
2. Whether the Results column carries a hover message **only** on `Failed` — to be confirmed
   against legacy JEX rather than assumed (the reporter's expectation is "only Failed").

## Current Behavior

[components/banking/internal-transfer/TransferHistoryTable.tsx:193](../../components/banking/internal-transfer/TransferHistoryTable.tsx#L193):

```tsx
title={row.statusMessage || undefined}
```

A raw HTML `title` attribute. Consequences:

- OS-rendered chrome — no product typography, no token colours, no positioning control, and a
  ~1–2 s hover delay the user cannot change.
- On a long bank message it renders as a viewport-wide strip that overlaps neighbouring rows
  (visible in the reporter's screenshot, where it covers the row below).
- It is invisible to keyboard and touch users.
- It bypasses the shared [`<Tooltip>`](../../components/shared/Tooltip.tsx) that the rest of the
  product already uses — the reuse-before-create rule in CLAUDE.md §"Shared / Common Code Rules".

## Expected Behavior

- The failure message renders through the shared `<Tooltip>` component, matching every other
  tooltip in the product.
- No `title` attribute is left on the cell (it would double up with the shared tooltip).
- Whichever result states legitimately carry a message do so per **legacy JEX behaviour**, not
  per assumption.

## Scope

- The Results cell of the Transfer History table (VND).
- Verification of which result states carry a hover message, against legacy JEX.

## Out of Scope

- Any backend change — `statusMessage` already arrives on the wire; this is a rendering change.
- Other screens' `title` attributes (a project-wide sweep is a separate task; anything found is
  recorded as a follow-up, not fixed here).
- The Results column's text / colour vocabulary itself.

## Initial Investigation

Confirmed before this record was created (orientation only):

- The `title` attribute exists at `TransferHistoryTable.tsx:193`.
- A shared `<Tooltip>` component exists at `components/shared/Tooltip.tsx` and is already
  consumed elsewhere (e.g. the Own Account Transfer composer).

Open questions when this record was created — all three are answered in the sections below:

- The shared Tooltip's prop contract and whether it fits a table cell.
- Which result states legacy renders a message for, and where legacy puts it (title attribute,
  custom layer, or a column) — read from `trns_0003_001` (Transfer History) in
  `WECMS DEV/WECMS_STATIC/ts-src/js/jex/wabooks/trns/` + its `_view.jsp`.
- Whether `statusMessage` is ever non-empty on a successful row in the refactor.

## Legacy JEX behaviour — answering "I think this case have only Failed"

Read from `WECMS DEV/WECMS_STATIC/ts-src/js/jex/wabooks/trns/trns_0003_001.ts`:

```js
// :288  — the message, blank-normalised
let error_message = common.app.null2void(TRNS_MSG) === "" ? "" : TRNS_MSG;

// :318-322 — the Results <td>
let dateDisplay = `<td class="show_message_error" style="position:relative;overflow:visible;">
    ${error_message === "" ? "" : `<div class="error_message" style="display:none;">
                                     <div class="conta">${error_message}</div>
                                   </div>`}
    ...status + timestamp...
</td>`;

// :127-133 — the hover handlers
$(document).on("mouseenter", ".show_message_error", function () { $(this).find(".error_message").show(); });
$(document).on("mouseleave", ".show_message_error", function () { $(this).find(".error_message").hide(); });
```

**Answer, precisely:** legacy gates the hover message on **`TRNS_MSG` being non-empty**, *not*
on the status. The `show_message_error` class sits on **every** Results cell; only the inner
`.error_message` layer is conditional. There is no `TRNS_STTS` branch anywhere in that gate.

**But your expectation holds in practice.** The engine returns `ErrorMessage: ""` on a successful
job (visible in the 2026-08-18 SIT console dump: `"ErrorCode":"00000000","ErrorMessage":""`), so
`TRNS_MSG` is empty on success and the tooltip is only ever *seen* on `Failed`. The implemented
rule is therefore legacy's rule — message-gated — and the visible effect is the one you expected.
This is deliberate: hard-coding `status === "failed"` would silently swallow a message on any
future partial/other status the backend starts sending.

Legacy also uses a **custom hover layer**, never a native `title`, on this cell — so replacing the
`title` attribute with the shared `<Tooltip>` moves the refactor *closer* to legacy, not away
from it.

## Root Cause

The G8 parity item (2026-08-18) ported legacy's hover message the cheapest way — a native
`title` attribute — and its own code comment says so: *"Native `title` adds the tooltip with zero
layout change"*. That satisfied "a message appears on hover" but not the product's tooltip
contract: legacy renders a styled layer it controls, and this repo already ships the shared
[`<Tooltip>`](../../components/shared/Tooltip.tsx) (Figma 9198:8036) for exactly this.

## Implementation

One cell in
[TransferHistoryTable.tsx](../../components/banking/internal-transfer/TransferHistoryTable.tsx):

- Removed `title={row.statusMessage || undefined}` from the `<TableCell>`.
- Wrapped the cell's content in `<Tooltip content={row.statusMessage || undefined}
  className="block h-full w-full">`.
  - `content` passed straight through — `<Tooltip>` disables itself on an empty/undefined value
    (children render bare, no wrapper, no listeners, no `tabIndex`), which reproduces legacy's
    "render the layer only when the message is non-empty" gate exactly.
  - `className="block h-full w-full"` makes the whole cell the hover target, matching legacy's
    class on the `<td>` itself. This is the component's own documented pattern for table cells.
- Replaced the code comment with the legacy citations (`:318-322`, `:127-133`, `:288`/`:319`) and
  the reason the gate is the message rather than the status.

What the user gets instead of the OS tooltip: product typography and colours (`bg-wb-ink`,
`text-wb-14`), a 320 px wrap instead of a viewport-wide strip, a notch pointing at the cell,
viewport clamping, `z-[100]` so it is never covered, no hover delay, ESC to dismiss, and
keyboard/focus access.

## Files Changed

| File | Change |
|---|---|
| [components/banking/internal-transfer/TransferHistoryTable.tsx](../../components/banking/internal-transfer/TransferHistoryTable.tsx) | `title` attribute → shared `<Tooltip>`; import added; comment rewritten with legacy citations |
| [components/banking/internal-transfer/TransferHistoryTable.resultsTooltip.test.tsx](../../components/banking/internal-transfer/TransferHistoryTable.resultsTooltip.test.tsx) | **new** — 7 regression cases |

`git diff --stat`: 1 file changed, 38 insertions(+), 19 deletions(-), plus the new test file.
No other file is touched.

## API Impact

**NONE.** `trns_msg` already arrives on the wire and `statusMessage` already existed on the row
type — this is a rendering-only change. No paired `wecms-api` record needed.

## UI Impact

Transfer History → Results column only. The message content is unchanged; only its presentation
moves from the browser's tooltip to the product's. No layout shift: the tooltip is
portal-mounted, and the trigger `<span>` is `display:block` at full cell size, so the cell's own
box is unchanged. No new locale key (the message is bank-supplied text).

## Database Impact

**NONE (frontend)** — no database dependency, no `.sql` in this repository (CLAUDE.md §12g).

## Integration Impact

None.

## Verification

### Automated Tests

- Test: `npx vitest run components/banking/internal-transfer`
- Result: **PASS** — 1 file, **7 executed, 7 passed, 0 failed**
- Test: `npx tsc --noEmit -p tsconfig.json`
- Result: **PASS for this change** — 0 errors in the changed files. 2 **pre-existing** errors
  remain in an unrelated file; see `## Known Limitations / Follow-up` item 1.
- Test: `npx eslint components/banking/internal-transfer/`
- Result: **PASS** — 0 problems

### Regression Test

```
Test file:          components/banking/internal-transfer/TransferHistoryTable.resultsTooltip.test.tsx
Test case:          "renders NO native title attribute anywhere in the row"
Behavior protected: the Results cell must never re-acquire a native `title` tooltip

Test case:          "gates on the MESSAGE, not on the status — legacy `:288` / `:319`"
Behavior protected: the legacy gate (message non-empty) must not drift into a status check
```

**Fail-before / pass-after — executed.** With `TransferHistoryTable.tsx` reverted to `HEAD` and
the new test file in place: **5 of 7 failed** (`title` attribute present; no `role="tooltip"` on
hover/focus). The two that passed pre-fix assert behaviour the fix must not break (the
no-message row, and the Failed label + timestamp). Fix restored → **7/7 PASS**.

### Regression Review

- Areas checked: the other cells of the same table (the Remarks cell keeps its own truncation
  rendering, untouched); `TransferHistoryTableColumns` / `TransferHistoryTableFooter` (column
  widths and the totals row share a colgroup — unchanged, since the cell's box is unchanged);
  the shared `<Tooltip>` itself (consumed, not modified, so its other consumers are unaffected).
- Result: no change outside the Results cell.

### Manual Verification

- Environment: LOCAL
- Steps: **not performed** — the app was not started for this change.
- Result: **NOT RUN.** The tooltip's visual chrome is verified by the shared component's own
  Figma contract (9198:8036) plus the DOM assertions above; the rendered pixels on this screen
  have not been inspected. SIT scenario T1/T2 below closes that.

## Result

The Results cell now shows the bank's failure message through the product's tooltip — styled,
keyboard-reachable, 320 px wrapped, no longer overlapping the row below — and carries no `title`
attribute. The show/hide rule matches legacy exactly (message-gated), which in practice means the
tooltip appears only on `Failed`, as expected.

## Test Evidence

Test result:
[Transfer History Results Tooltip — Test Result](../testing/results/transfer-history-results-tooltip-test-result-2026-08-19.md)

```
Final test result:    PASS
Regression coverage:  PASS (fail-before/pass-after executed)
Manual / SIT:         NOT RUN
```

## Known Limitations / Follow-up

1. **Pre-existing `tsc` errors, now visible (not caused by this change).**
   `OwnAccountTransferComposerDialog.locales.test.ts:92-93` indexes `ko[key]` / `vi[key]` with a
   key those JSON files intentionally do not carry (the test asserts the KO/VI fallback), which
   TypeScript rejects without a cast. The test passes at runtime. **Why it only surfaced now:**
   earlier `tsc` runs in this repo were reaching a corrupt
   `.next/dev/types/routes.d.ts` (the documented concurrent-`next dev` artifact), and TypeScript
   stops before the semantic pass when the program has syntax errors — so "0 errors after
   filtering `.next/`" was masking them. The artifact has since regenerated and the semantic pass
   now completes. Fix is a one-line cast in that test; **out of scope here**
   (`feedback_preserve_existing_code`) — worth its own small MR.
2. **Other native `title` attributes remain elsewhere** — `ApprovalTable.tsx:85` (file-name
   truncation), `NotificationItem.tsx:78,86`, `CardTransactionsTable.tsx:907`,
   `TaxFilingPage.tsx:595`. Truncation cases have a dedicated shared component
   (`EllipsisTooltip`); button-label cases may legitimately keep `title`. A project-wide sweep is
   a separate task — recorded, not started.
3. **Legacy renders a green "Success" label** for successful rows
   (`trns_0003_001.ts:332`, ML key `trns_0003_001_js011`); the refactor renders the timestamp
   only, and its own
   [test-scenarios.md](../features/banking/internal-transfer-vnd/transfer-history/test-scenarios.md)
   T1 documents that as intended ("no green Success label"). The locale key
   `transfer_history.status.success` exists but is unused by the cell. **Not changed here** — if
   PO wants legacy parity on that label it is a separate decision, not a tooltip fix.
