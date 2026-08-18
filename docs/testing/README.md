# Testing — `wecms-web`

Frontend-side testing documentation for the refactor.

| Doc | Purpose |
|---|---|
| **[testing-strategy.md](testing-strategy.md)** | **Start here.** The test setup that actually exists — `npm test`, Vitest + jsdom + React Testing Library, the include globs and which directories they miss, the current 14-file / 152-test inventory, and what is *not* here (no coverage thresholds, no e2e runner, no CI test stage). |
| **[results/](results/)** | **Added 2026-08-18.** Durable **test-result records** — one per actually executed verification of an implemented change, `descriptive-name-test-result-YYYY-MM-DD.md`. Rules: [results/README.md](results/README.md) |

## Testing is part of the Definition of Done

**Added 2026-08-18.** Tests are not an optional follow-up MR. Every meaningful BUG / ISSUE / FEATURE /
parity fix passes the **implementation quality gate** before it may be reported complete —
authoritative rule: [`../../CLAUDE.md`](../../CLAUDE.md) §14, summarized in
[`../README.md`](../README.md) §"Implementation quality gate".

- **A bug fix normally carries a regression test** that fails before the fix and passes after it. If
  that is impractical — it needs a real backend, a real browser, an NXiSAS engine, or a bank gateway —
  the dated record explains **why** and supplies manual / test-scenario evidence instead. *"No test
  needed"* with no justification is not acceptable (§14d).
- ⚠️ **Place the test where Vitest collects it** — `components/**` or `lib/**` only. A test in `hooks/`
  or `app/` is **silently skipped**; see
  [testing-strategy.md § Include globs](testing-strategy.md#include-globs). Extending `include` is a
  same-MR change, not a later cleanup.
- **A feature verifies the dimensions it actually has** — happy path, validation, empty state, error
  state, **loading state**, permission visibility, boundary values, API failure, duplicate/retry, DB
  dependency, localization EN/KO/VI, concurrency — not a boilerplate checklist copied between screens
  (§14e).
- **Run the relevant scope and report exactly what was run** — `npm test`, or
  `npx vitest run components/<area>` first (§14i). **Nothing in CI runs the suite**, so this is a manual
  developer responsibility.
- **Failures are classified, never hidden**: caused by this change (task is NOT COMPLETE) ·
  pre-existing (record the evidence it predates the work — the 11 known failures below are the standing
  example) · environment · test data / stale mock · unresolved (§14j).
- **Honest result states only** — `PASS` · `FAIL` · `NOT RUN` · `BLOCKED` · `NOT APPLICABLE`. A test
  plan is never reported as a test result, and **visual verification is never claimed for a UI that was
  not actually run and inspected** (§14h, §14l).
- **Permanent scenarios live with the screen.** When a change alters permanent behaviour, update
  [`../features/`](../features/)`<module>/<screen>/test-scenarios.md`; the dated bug/issue record keeps
  only the evidence for that change (§14f).
- **Executed evidence gets its own durable record** *(added 2026-08-18)*. Once verification actually
  runs, write a **test-result record** at [results/](results/)`descriptive-name-test-result-YYYY-MM-DD.md`
  and link it from the implementation record's `## Test Evidence` — both directions must resolve. The
  implementation record's `## Verification` section becomes the **summary**; the command, counts,
  environment, build under test, and pre-existing-vs-new failures live in the result record.
  `Implementation Status: COMPLETE` requires test evidence that supports it (§17).
- **Three documents, three jobs.** `test-scenarios.md` = the **specification** (how it should be
  tested) · a **test-result record** = the **evidence** (what actually ran) · the bug/issue/feature
  record = **why the change happened**. Never let one stand in for another — this is the same "two
  layers, not one" separation below, with the second layer made durable.

## Two layers, not one

| Layer | Where | Nature |
|---|---|---|
| **Automated tests** | Colocated `*.test.ts` / `*.test.tsx` under `components/` and `lib/` | A thin regression net — 14 files, regression-driven rather than systematic |
| **Manual QA scenarios** | `../features/<module>/<screen>/test-scenarios.md` (one per documented screen) | The primary verification mechanism for this frontend — human-executed checklists for QA, PO, and UAT sign-off |

A scenario listed in a `test-scenarios.md` is **not** evidence that an automated test covers it. See
[testing-strategy.md § Relationship to test-scenarios.md](testing-strategy.md#relationship-to-docsfeaturestest-scenariosmd).

> ⚠️ **The automated suite is not currently green** — 11 of 152 tests fail, all in one file, from a
> stale `vi.mock` factory. Cause and evidence:
> [testing-strategy.md § The suite is not currently green](testing-strategy.md#the-suite-is-not-currently-green).
> Nothing in CI blocks this, so `npm test` is a manual developer responsibility.

## Add a frontend test plan here

Frontend (component / page / integration) test plans belong in this folder. Add them as they are
written, and link them from the table above.

> The cross-system testing strategy + checklist template, and the refactor-wide (backend +
> frontend) test plans, are maintained in the shared workspace docs **outside this repository** and
> are not part of the `wecms-web` clone.

## Related

- Docs root: [../README.md](../README.md)
- Frontend consumption contract (what tests mock): [../references/api-contract.md](../references/api-contract.md)
- Known-deferred issues: [../tech-debt.md](../tech-debt.md)
