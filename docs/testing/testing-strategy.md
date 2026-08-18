# Testing Strategy — `wecms-web`

**Status: CURRENT.** Describes the test setup that exists in this repository, verified against
source and a full test run on 2026-08-17.

This document describes **what is actually here**. It does not describe an aspirational pyramid.
Where something does not exist, it says so — see [What does not exist](#what-does-not-exist).

## Running the tests

```bash
npm test          # → vitest run  (single pass, non-watch)
```

That is the only test script in [`package.json`](../../package.json). There is no `test:watch`,
`test:coverage`, `test:e2e`, or `test:ci` script. For a watch loop, invoke the binary directly
(`npx vitest`).

## Stack

| Concern | Choice | Source |
|---|---|---|
| Runner | **Vitest 2.1** | [`package.json`](../../package.json) devDependencies |
| Environment | **jsdom 24** | [`vitest.config.ts`](../../vitest.config.ts) `test.environment` |
| Component rendering | **@testing-library/react 16** | devDependencies |
| DOM matchers | **@testing-library/jest-dom 6** (`/vitest` entry) | [`vitest.setup.ts`](../../vitest.setup.ts) |
| JSX transform | **@vitejs/plugin-react** | [`vitest.config.ts`](../../vitest.config.ts) `plugins` |
| Globals | **enabled** (`globals: true`) — `describe` / `it` / `expect` / `vi` need no import | [`vitest.config.ts`](../../vitest.config.ts) |
| Path alias | `@/*` → project root, mirroring `tsconfig.json` | [`vitest.config.ts`](../../vitest.config.ts) `resolve.alias` |

### Setup file

[`vitest.setup.ts`](../../vitest.setup.ts) does exactly two things:

1. Imports `@testing-library/jest-dom/vitest` to register the DOM matchers.
2. Stubs `ResizeObserver` when absent. jsdom does not implement it, and several shared components
   (`EllipsisTooltip`, …) construct one in a mount effect — without the stub they throw on render.

If a new shared component depends on another browser API jsdom lacks, add the stub here rather than
per test file.

## Test location convention

Tests are **colocated** with the code they cover, named `*.test.ts` / `*.test.tsx`. There is no
top-level `__tests__/` or `tests/` directory, and adding one would fall outside the configured
include globs.

### Include globs

```ts
include: ["components/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}"]
```

Only **`components/`** and **`lib/`** are collected.

### Directories currently outside the include globs

| Directory | Contains tests today? | Consequence |
|---|---|---|
| `hooks/` | No | A test added here would be **silently skipped** |
| `app/` | No | Same — including `proxy.ts`-adjacent route behaviour |
| `locales/` | No | n/a (data only) |
| `proxy.ts` (root file) | No | Root-level files are outside both globs |

This is the most important trap in the current setup: **a test placed in `hooks/` or `app/` runs
green by never running at all.** Either colocate the test under `components/` or `lib/`, or extend
`include` in [`vitest.config.ts`](../../vitest.config.ts) in the same MR that adds the test.

`hooks/` is a real gap — it holds cross-feature hooks the project treats as shared infrastructure
(`useTableSort`, `useExcelExport`), none of which is covered.

## Current automated coverage

**14 test files, 152 tests.** Full inventory:

| File | Area |
|---|---|
| `components/addon/einvoices/ViewEInvoiceDetailsModal.test.tsx` | Add-on — e-invoice detail modal |
| `components/addon/sales-einvoices/EInvoiceDetailHistoryDialog.test.tsx` | Add-on — detail history dialog |
| `components/addon/sales-einvoices/EInvoiceTable.rowclick.test.tsx` | Add-on — row-click behaviour |
| `components/addon/sales-einvoices/EInvoicesClient.viewdetails.test.tsx` | Add-on — view-details wiring |
| `components/addon/sales-einvoices/EInvoicesClient.viewinvoice.test.tsx` | Add-on — view-invoice wiring |
| `components/addon/sales-einvoices/UpdateEInvoiceModal.test.tsx` | Add-on — update modal |
| `components/addon/sales-einvoices/useEInvoiceScrape.test.ts` | Add-on — GDT scrape lifecycle · **currently failing** |
| `components/addon/tax-filing/declarationPdf.test.ts` | Add-on — VAT declaration PDF |
| `components/banking/account-inquiry/TransactionSyncDialog.test.tsx` | Banking — bank transaction sync |
| `components/banking/transaction-history/confirmedCellReadOnly.test.tsx` | Banking — confirmed-row read-only rule |
| `lib/nxisas/einvoiceScrape.test.ts` | NXiSAS scrape helpers |
| `lib/payment/autoTransferAfterApproval.test.ts` | Payment — auto-transfer after approval |
| `lib/payment/cutoffConfig.test.ts` | Payment — cut-off config parsing |
| `lib/payment/validateBankingTime.test.ts` | Payment — cut-off time validation |

Coverage is **regression-driven, not systematic**: tests exist where a specific bug or a
business-critical rule justified pinning behaviour (payment cut-off windows, GDT scrape lifecycle,
confirmed-row immutability, PDF/scrape output shape). Banking, Payment list/detail pages, Settings
panels, and the shared component library are largely uncovered.

### The suite is not currently green ⚠️

A full `npm test` run on 2026-08-17 reported:

```
Test Files   1 failed | 13 passed (14)
     Tests  11 failed | 141 passed (152)
```

All 11 failures are in `components/addon/sales-einvoices/useEInvoiceScrape.test.ts`.

**Cause — a stale mock factory, not a source defect.** The test declares:

```ts
vi.mock("@/lib/api/addon", () => ({
    scrapeEInvoices: h.scrapeEInvoices,
    scrapeEInvoiceDetails: h.scrapeEInvoiceDetails,
}));
```

Because `vi.mock` with a factory **replaces** the module, any export not listed is undefined. The
hook under test also calls `decryptEInvoiceEngineData`, which was added to
[`lib/api/addon.ts`](../../lib/api/addon.ts) after the test was written, so every case fails with:

```
[vitest] No "decryptEInvoiceEngineData" export is defined on the "@/lib/api/addon" mock.
```

This is recorded here as an observed fact. It was **not fixed** during documentation remediation —
that requires a source change and belongs in its own MR. Track it in
[../tech-debt.md](../tech-debt.md) if it is not repaired promptly.

**Lesson worth generalizing:** a `vi.mock` factory is a whitelist. Prefer
`vi.mock(path, async (importOriginal) => ({ ...(await importOriginal()), someFn: spy }))` so
newly-added exports keep working, and only the deliberately-stubbed ones are replaced. Vitest
itself suggests this pattern in the failure output.

## What does not exist

Do not document, assume, or cite any of the following — none is present in this repository:

| Absent | Evidence |
|---|---|
| **Coverage thresholds or reporting** | No `coverage` block in [`vitest.config.ts`](../../vitest.config.ts); no `@vitest/coverage-*` dependency |
| **Mandatory coverage percentage** | Nothing enforces one |
| **Playwright / Cypress / any e2e runner** | Absent from `package.json` |
| **Visual-regression tooling** | Absent |
| **A CI test stage** | [`.gitlab-ci.yml`](../../.gitlab-ci.yml) is a *trigger only* — it runs on `sit` / `uat` and hands off to a downstream pipeline in another GitLab project. It runs no lint, type-check, or test job here. |
| **A pre-commit / pre-push hook** | No husky, lint-staged, or `.githooks` config |

Consequence: **nothing automatically blocks a red suite from being merged or deployed.** Running
`npm test` is a manual developer responsibility until a CI stage exists. That gap is the reason the
failure above could persist unnoticed.

Adding a CI `test` job is the highest-value improvement available, but changing CI behaviour is out
of scope for documentation work and needs an explicit decision.

## Relationship to `docs/features/**/test-scenarios.md`

Each feature folder carries a `test-scenarios.md` as part of its six-doc set. The two layers are
different things and must not be conflated:

| | `test-scenarios.md` | `*.test.ts(x)` |
|---|---|---|
| **Nature** | Human-executed **manual QA checklist** | Automated assertions |
| **Audience** | QA, PO, UAT sign-off (incl. Mr. Youvita's AI-assisted testing) | Developers, the runner |
| **Scope** | Full screen behaviour, cross-browser, permission variants, legacy-parity checks | Narrow units and regression pins |
| **Executed by** | A person following steps | `npm test` |
| **Count** | One per documented screen (~65 feature folders) | 14 files |

A scenario in `test-scenarios.md` is **not** evidence that an automated test exists. When a scenario
graduates to automation, colocate the test next to the component and link it from the scenario entry
so the two stay traceable.

Manual scenarios remain the primary verification mechanism for this frontend. The automated suite is
a thin regression net beneath them, not a replacement.

## When a test is required — the quality gate

**Added 2026-08-18.** This document describes *what exists*; the **Definition of Done** decides *when
you must add to it*. Every meaningful BUG / ISSUE / FEATURE / parity fix passes the **implementation
quality gate** before it may be reported complete — authoritative rule:
[`../../CLAUDE.md`](../../CLAUDE.md) §14 ("Implementation quality gate"), summarized in
[`../README.md`](../README.md) and [`README.md`](README.md).

| Situation | What the gate requires |
|---|---|
| **Bug fix, behaviour testable automatically** | A **regression test** that fails before the fix and passes after, pinning behaviour rather than implementation. Recorded in the dated record as `## Regression Test` (test file · test case · behaviour protected). |
| **Bug fix, automated test impractical** | An explicit **justification** (needs a real backend / browser / NXiSAS engine / bank gateway / environment this repo cannot reach) **plus** manual or `test-scenarios.md` evidence. *"No test needed"* alone is not acceptable. |
| **New feature** | Verify the dimensions the feature actually has — happy path · validation · empty · error · **loading** · permission visibility · boundary values · API failure · duplicate/retry · DB dependency · localization EN/KO/VI · concurrency. Not a copied checklist. |
| **Permanent behaviour changed** | Update the screen's `../features/<module>/<screen>/test-scenarios.md`; the dated record keeps only that change's evidence. |
| **Any of the above** | Run the relevant scope and **report exactly what was run**; record honest states — `PASS` · `FAIL` · `NOT RUN` · `BLOCKED` · `NOT APPLICABLE`. |
| **Verification actually ran** | Write a durable **test-result record** at [`results/`](results/)`descriptive-name-test-result-YYYY-MM-DD.md` and link it from the implementation record's `## Test Evidence`. `Implementation Status: COMPLETE` requires evidence that supports it (`CLAUDE.md` §17). |

**This document is not the evidence.** It describes the setup; a test-result record describes one run.
`test-scenarios.md` specifies how a screen should be tested; a result record says what actually
happened. Three documents, three jobs — see [`results/README.md`](results/README.md).

**This binds every team** — Cambodia, Vietnam, Korea, and any future WeCMS contributor — and every
tool: manual, Claude Code, Cursor, another AI assistant, IDE tooling, scripts, pair programming. **No
team may run a weaker Definition of Done.**

Two facts on this page make the gate load-bearing rather than ceremonial:

1. **The include-glob trap.** A required test written into `hooks/` or `app/` satisfies nobody — it is
   never collected, so it can never fail. Placement is part of "the test exists".
2. **No CI test stage.** Nothing blocks a red suite from merging, so *"the relevant tests were executed
   and here is what was run"* is the only real evidence that exists. Never report a suite as green
   without having run it.

**Pre-existing failures are declared, not inherited silently.** The 11 failures in
`useEInvoiceScrape.test.ts` documented above are **category B — pre-existing** for any unrelated
change: cite them, state that they predate the work, and do not claim a fully green suite. Do not
"fix" them inside an unrelated MR either (`feedback_preserve_existing_code`); repair belongs in its own
record.

## Conventions for new tests

1. **Colocate** — `Foo.test.tsx` beside `Foo.tsx`, under `components/` or `lib/` (see the include-glob
   trap above).
2. **Name the behaviour, not the function** — existing files use suffixes that state intent
   (`EInvoiceTable.rowclick.test.tsx`, `confirmedCellReadOnly.test.tsx`). Follow that.
3. **Prefer `importOriginal()` spreads over bare `vi.mock` factories** — see the lesson above.
4. **Use `@/` imports** — the alias resolves identically to the app build.
5. **Stub browser APIs in [`vitest.setup.ts`](../../vitest.setup.ts)**, not per file, when the gap is
   jsdom's rather than the test's.
6. **Pin the bug, not the implementation** — these tests exist to stop regressions. Assert observable
   behaviour (rendered output, calls made, values emitted), not internal structure.
7. **Run `npm test` before opening the MR.** No CI gate will do it for you.

## Related

- Testing index: [README.md](README.md)
- Per-screen manual scenarios: `../features/<module>/<screen>/test-scenarios.md`
- Frontend consumption contract (envelope / errors / auth — what tests mock):
  [../references/api-contract.md](../references/api-contract.md)
- Known-deferred issues: [../tech-debt.md](../tech-debt.md)
- Docs root: [../README.md](../README.md)
