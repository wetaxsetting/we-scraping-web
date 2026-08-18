# Test Results — durable execution evidence

**Status:** CURRENT · **Added:** 2026-08-18

## Purpose

One record per **actually executed verification** of an implemented change in `wecms-web`. A record
here answers: **what was tested · how · what actually ran · what passed · what failed · what was not
run · in which environment · what evidence supports calling the work complete.**

Full rule: [`../../../CLAUDE.md`](../../../CLAUDE.md) §17 "Test-result records". If this README and
that section disagree, `CLAUDE.md` wins.

## When a record is required

Required for every meaningful implemented **BUG · ISSUE · FEATURE · PARITY FIX · behaviour-changing
refactor**, **once verification or tests are actually executed**.

**Not required for:**

- the documentation-exception list in `CLAUDE.md` §10 (comment-only, formatting, lint, purely cosmetic
  CSS with no behaviour impact, lockfile noise, …)
- **audit-only work where no implementation was approved** — the audit itself carries the investigation
  evidence, including any diagnostic tests it ran (§17j)

## Filename

```
descriptive-name-test-result-YYYY-MM-DD.md
```

Lowercase kebab-case, **subject first**, ISO date. For example:

```
internal-transfer-target-account-test-result-2026-08-18.md
approval-status-navigation-test-result-2026-08-18.md
tax-filing-export-test-result-2026-08-18.md
```

Never `test.md` · `result.md` · `final-test.md` · `p0-test.md` · `a1-01-test.md` · `dev-a-test.md`.
Internal identifiers (`A1-01`, `K9`, `P0`, …) go in the document metadata as `**Issue:**`, never in the
filename — same rule as `CLAUDE.md` §5 and §7.

## How this differs from the neighbouring documents

| Document | Answers | Lifecycle |
|---|---|---|
| **This folder** — `*-test-result-YYYY-MM-DD.md` | *What was actually executed, and what happened* | frozen once written; a later run gets a later file |
| [`../../features/`](../../features/)`<domain>/<screen>/test-scenarios.md` | *How this screen should be tested* — permanent, reusable **manual QA specification** | kept current with the screen |
| [`../testing-strategy.md`](../testing-strategy.md) | *What test infrastructure actually exists* — the Vitest setup, the include-glob trap, what is absent | kept current with the repo |
| [`../../bugs/`](../../bugs/) · [`../../issues/`](../../issues/) · [`../../features/`](../../features/) | *Why the change happened* and *how the screen works now* | the implementation record is finalized; feature docs stay current |
| [`../../audits/`](../../audits/README.md) | *What was true on a given date* — investigation findings | historical, preserved unchanged |

**A scenario in `test-scenarios.md` is never evidence that anything ran** — that separation already
exists in [`../README.md`](../README.md) § "Two layers, not one", and a record here is the second layer
made durable. This repository has no `testing/sit/` or `testing/uat/` folder; the backend owns those.

## Template

The canonical template is in [`../../../CLAUDE.md`](../../../CLAUDE.md) §17e. In outline:

```
metadata: Date · Type: TEST RESULT · Status · Repository · Related Record · Issue
## Scope                       ## Environment          ## Code / Build Under Test
## Automated Tests             ## Regression Tests     ## Test Scenarios
## API Verification            ## UI Verification      ## Database Verification
## Security / Permission Verification                  ## Performance / Concurrency Verification
## Existing Failures           ## New Failures         ## Not Tested
## Final Result                ## Recommendation
```

Use only the sections that apply — a page of "N/A" headings is noise, not thoroughness.

## Status vocabulary

Per-check results: **`PASS` · `FAIL` · `NOT RUN` · `BLOCKED` · `NOT APPLICABLE`**
Document-level `**Status:**` / `## Final Result`: **`PASS` · `FAIL` · `PARTIAL` · `BLOCKED`**
`## Recommendation`: `READY FOR MANUAL COMMIT` · `PARTIAL` · `BLOCKED` · `READY FOR DBA` ·
`READY FOR SIT` · `READY FOR DEPLOYMENT`

## Honesty rule

**Record actual observations only.** Never write `PASS` for something that was not executed — write
`NOT RUN` / `BLOCKED` / `NOT APPLICABLE` **with the reason**:

```
UI visual verification:   NOT RUN — browser environment was unavailable
SIT manual verification:  NOT RUN — deployment is manual and has not happened yet
Database verification:    BLOCKED — backend DBA script has not been applied
Commit:                   NOT COMMITTED
```

`Commit: NOT COMMITTED` is a perfectly valid entry — the workflow ends at `READY FOR MANUAL COMMIT`
(`CLAUDE.md` §15), so most records are written before anything is committed. **Never claim visual
verification for a UI that was not actually run and inspected** (`CLAUDE.md` §14l).

**Pre-existing failures are listed separately and visibly** (`## Existing Failures`), with the evidence
that they predate the work — the 11 known failures in `useEInvoiceScrape.test.ts`
([`../testing-strategy.md`](../testing-strategy.md)) are the standing example. Never hide them, and
never quietly repair them inside an unrelated change.

**Never pre-write a `PASS` record before the tests run.**

## Two traps specific to this repository

1. **A test in the wrong folder never ran.** Vitest collects only `components/**` and `lib/**`. If the
   evidence cites a test under `hooks/` or `app/`, it was silently skipped — that is a `NOT RUN`, not a
   `PASS`.
2. **Nothing in CI runs the suite.** `.gitlab-ci.yml` is a trigger only, so the command recorded here is
   the *only* evidence that anything was executed. Record the command and the observed counts.

## Bug fixes — the regression question

A record for a BUG explicitly answers **"did a regression test cover the original defect? YES / NO"** —
with test file, test case, and result if YES, or the reason if NO. A bare *"no regression test"* is not
acceptable when the defect is automatable (`CLAUDE.md` §17f, §14d).

## Relationship to READY FOR MANUAL COMMIT

```
implement → quality gate (§14) → CREATE TEST-RESULT RECORD → LINK IT FROM THE
  BUG / ISSUE / FEATURE RECORD → update permanent docs → reviewer quality gate
  → READY FOR MANUAL COMMIT → HUMAN Git / deployment process
```

`Implementation Status: COMPLETE` requires test evidence that supports it. If tests fail, the honest
pair is `Test Status: FAIL` + `Implementation Status: BLOCKED` / `PARTIAL`. Passing tests are **not** a
deployment — and here a push to `sit` / `uat` *is* the deployment, so `SIT COMPLETE` / `UAT COMPLETE`
are only ever reported for a deployed build that was actually checked (`CLAUDE.md` §15d, §17h).

## Linking

The implementation record gains a `## Test Evidence` section linking here, and this record's
`**Related Record:**` links back. **Both directions must resolve** — run
`node scripts/check-doc-links.mjs` before closing the task.

## Cross-repository work

When both repositories change and both sides have meaningful verification, each carries its own record —
this folder for frontend tests / UI behaviour / API consumption, and `wecms-api/docs/testing/results/`
for backend tests / API contract / DB / integration / business logic. Cross-link for integration
behaviour; **do not duplicate all the evidence into both files**.

## Index

No hand-maintained table of every result is kept here — the filenames are subject-first and dated, and
each record links to its implementation record. `CLAUDE.md` §17 is the rule; this README is the folder's
contract.

## Scope note

This folder was added **2026-08-18** for **new and in-flight** work. Historical bugs and features are
**not** back-filled with test-result records — evidence nobody observed is not evidence.

## Related

- Testing index: [`../README.md`](../README.md)
- What the test setup actually is: [`../testing-strategy.md`](../testing-strategy.md)
- Docs root: [`../../README.md`](../../README.md)
