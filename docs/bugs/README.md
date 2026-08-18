# Bugs — dated implementation records

**Status:** CURRENT

## Purpose

Dated **implementation records for bug fixes** in `wecms-web`. Each record is created **before** the
code change (docs-first), carried at `Status: IN PROGRESS` while the work is in flight, and completed
in place afterwards. This folder is **change history** — it explains *why* something changed. It does
not describe how the system currently works.

## What belongs here

A dated record for work where **existing implemented behaviour is wrong**:

- implemented behaviour is incorrect
- something that previously worked is broken
- behaviour differs from an accepted requirement
- a defect causes wrong user or system behaviour
- parity behaviour is incorrect and the task is to fix it

## What does NOT belong here

| Not this | Goes to |
|---|---|
| Non-bug issue work — behavioural, operational, configuration, or tracked implementation concerns that are not clearly a product defect | [../issues/](../issues/) |
| Current + permanent screen documentation (the 6-doc set) | [../features/](../features/)`<domain>/<feature>/` |
| Audits, parity reviews, verifications, investigations, legacy comparisons, migration verifications, architecture reviews, gap analyses, historical validation, cross-feature analysis | [../audits/README.md](../audits/README.md) |
| A knowingly-deferred issue you are **not** fixing | [../tech-debt.md](../tech-debt.md) |
| Permanent frontend architecture / testing strategy / contract reference | [../architecture/](../architecture/) · [../testing/](../testing/) · [../references/](../references/) |
| Cross-system **bug reports** (intake tracker) | the shared workspace tracker — see [../bug-reports/](../bug-reports/); a *report*, not an implementation record |

**When classification is unclear between BUG and ISSUE, prefer ISSUE.** Never create duplicate BUG +
ISSUE records for the same implementation task. Never open a bug record just because feature work is
large — that stays on the 6-doc feature model.

## Filename format

```
descriptive-name-YYYY-MM-DD.md
```

Lowercase kebab-case, ISO date only, describing the actual subject — e.g.
`approval-status-detail-navigation-fix-2026-08-17.md`,
`account-filter-parity-fix-2026-08-17.md`.

Never a work-code or sequence filename (`a1-01-…`, `k9-fix.md`, `p1-update.md`, `task-03.md`,
`final-fix.md`). Internal identifiers (`A1-01`, `K9`, `TH-01`, `P0`, `Task-03`, …) go inside the
document metadata as `**Issue:**`.

## Docs-first requirement

**This applies to every developer on the team** — manual work, Claude Code, Cursor, another AI
assistant, IDE tooling, scripts, pair programming — on every branch and environment, **`sit` / `uat` and
PROD hotfixes included**. The developer who starts the change owns getting the record in place. **One
task → one canonical record per repository:** if a colleague already opened a record for this task,
update theirs rather than adding a per-person copy, and merge documentation conflicts like source code.

The record is created **before** application code is modified, and the task is not complete until the
record is finished. Order, Definition of Done, the team rule (§12 "Who must follow this"), and the
bug/issue template are authoritative in
[../../CLAUDE.md](../../CLAUDE.md) §"Docs-First Implementation Workflow (MANDATORY)":

```
create record (Status: IN PROGRESS) → implement → complete the SAME record
  → update permanent feature docs if behaviour changed → node scripts/check-doc-links.mjs
  → Status: COMPLETE | CLOSED | PARTIAL | BLOCKED
```

Never create a second "final" file — finalize the original. If work stalls, do not delete the record;
set `Status: BLOCKED` or `Status: PARTIAL` and say what remains.

`Status:` here is the **work-item lifecycle**, independent of the five-word doc-classification
vocabulary in [../README.md](../README.md) §"Status vocabulary" — a finished record is typically
`HISTORICAL` as a document *and* `Status: COMPLETE` as a work item.

## Human approval before implementation

**Added 2026-08-18.** A bug record is opened by docs-first — but **opening it does not authorize the
fix.** Full rule: [`../../CLAUDE.md`](../../CLAUDE.md) §16.

- **"Can you check this?" is an investigation, not a work order.** Classify the request first: *check ·
  investigate · review · audit · analyze · design* → document the findings and **stop for human
  approval**; *"investigate and fix"* or *"please fix this"* → implementation is already authorized.
  **When it is ambiguous, treat it as investigation-only.**
- **An investigation-only bug report is normally filed as an AUDIT** in
  [`../audits/`](../audits/README.md) until a human approves the fix; the bug record here is then
  created for the approved implementation and **links to the audit as evidence** (§16i).
- **Record the decision, not an assumption.** `APPROVE IMPLEMENTATION` · `DENY` ·
  `NEEDS MORE INVESTIGATION` come from a person. *"OK"* / *"thanks"* / *"looks good"* / *"done"* are
  **not** approval.
- **Three status dimensions** sit in the record metadata alongside the canonical `Status:` work-item
  field (and are unrelated to the five-word doc-classification vocabulary):

  ```
  Investigation Status:  IN PROGRESS | COMPLETE | BLOCKED
  Approval Status:       PENDING | APPROVED | DENIED | NEEDS MORE INVESTIGATION | NOT REQUIRED
  Implementation Status: NOT STARTED | IN PROGRESS | COMPLETE | BLOCKED | WON'T FIX
  ```

  `Approval Status: NOT REQUIRED` is the honest value for a bug the user explicitly asked you to fix.
- **If implementation is denied**, keep the record: no source change, no tests, no DB dependency work —
  write the decision down, preserve the evidence, stop. **Never delete a record because the fix was
  denied**; if the team means to revisit it, also list it in [`../tech-debt.md`](../tech-debt.md).
- **Approving the fix is not approving the backend SQL** (§16m) and not approving a push (§15) — and
  since pushing `sit` / `uat` deploys, that last one is a separate human decision every time.

## Verification — a fix is not done when the code is written

**Added 2026-08-18.** Every bug record passes the **implementation quality gate** before its status
leaves `IN PROGRESS`. Authoritative rule: [`../../CLAUDE.md`](../../CLAUDE.md) §14.

```
create record → implement → self-audit the diff → tests → test scenarios
  → regression review → API / UI / DB-dependency / security / parity checks as applicable
  → update docs → record the evidence → COMPLETE
```

**Regression-test rule for bug fixes.** A bug fix normally carries a regression test whenever the
behaviour can be tested automatically. Answer the four questions explicitly: can the bug be reproduced
in a test · does it fail before the fix · does it pass after · does it protect against recurrence?
Record it:

```markdown
## Regression Test

Test file:          components/<area>/<Name>.<behaviour>.test.tsx
Test case:          <describe / it name>
Behavior protected: <the exact behaviour that must never regress>
```

⚠️ **Put the test where Vitest actually collects it** — only `components/**` and `lib/**` are in the
include globs; a test added under `hooks/` or `app/` is **silently skipped** and "passes" by never
running. See [../testing/testing-strategy.md](../testing/testing-strategy.md).

If an automated regression test is genuinely impractical — it needs a real backend, a real browser, an
NXiSAS engine, a bank gateway, or an environment this repository cannot reach — **say why** and give
manual / test-scenario evidence instead. **"No test needed" with no justification is not acceptable.**

**Every record ends with a `## Verification` section** — Automated Tests · Test Scenarios · Regression
Review · Manual Verification, applicable subsections only, with honest states: `PASS` · `FAIL` ·
`NOT RUN` · `BLOCKED` · `NOT APPLICABLE`. **Never mark `PASS` without evidence, never convert a planned
test case into a test result, and never claim visual verification if the UI was not actually run and
inspected.** Failing tests are classified (caused by this change · pre-existing · environment ·
test data/mock · unresolved), never hidden — a failure caused by this change means the bug fix is
**NOT COMPLETE**. There is **no CI test stage** here, so running `npm test` is a manual developer
responsibility.

**When the fix changes permanent behaviour**, update the affected screen's
`../features/<domain>/<feature>/test-scenarios.md` — permanent scenarios live there, and this record
keeps only the evidence for this change. Do not duplicate a long scenario suite in both places.

**Once verification actually runs, the durable evidence gets its own record** *(added 2026-08-18)* at
[`../testing/results/`](../testing/results/)`descriptive-name-test-result-YYYY-MM-DD.md`, and this bug
record gains:

```markdown
## Test Evidence

Test result:
[<Change Name> Test Result](../testing/results/<name>-test-result-YYYY-MM-DD.md)

Final test result:    PASS
Regression coverage:  PASS
```

**Both links must resolve** (`node scripts/check-doc-links.mjs`) — the result record's
`**Related Record:**` points back here. `## Verification` above stays the **summary**; the command,
counts, environment, build under test, and pre-existing-vs-new failures live in the result record. The
test-result record answers the regression question explicitly (**YES / NO** + detail) and never claims
visual verification for a UI that was not run. **`Implementation Status: COMPLETE` requires test
evidence that supports it** — if tests fail, the honest pair is `Test Status: FAIL` +
`BLOCKED` / `PARTIAL`. Full rule: [`../../CLAUDE.md`](../../CLAUDE.md) §17 · folder rules:
[`../testing/results/README.md`](../testing/results/README.md).

This applies to **every team — Cambodia, Vietnam, Korea, and any future contributor** — and to every
tool used to write the fix.

## Database impact — dependency only, no SQL here

Database change artifacts are **backend-owned**. **No `.sql` file belongs in `wecms-web`** — not a
migration file, not a manual DBA script, not a seed or backfill. Those live in `wecms-api`
(`src/main/resources/db/migration/` for a new table or DB function; `docs/sql/<YYYY>/` for
existing-table changes, indexes, constraints, and any data change).

A bug record here declares its `## Database Impact` at the frontend level only:

```markdown
## Database Impact

NONE (frontend) — database dependency only.

Database dependency: see the related backend record
wecms-api/docs/bugs/recipient-name-resolution-fix-2026-08-17.md
```

Document the dependency only to the depth needed to explain what the UI is waiting on. **Never embed
executable SQL** in a frontend record. Cross-link the paired backend record.

**A bug is not `COMPLETE` while the backend DB change it depends on is unapplied in the target
environment** — use `PARTIAL` / `BLOCKED` / `READY FOR DEPLOYMENT` and name the environment. Frontend
developers do not execute database changes, and an AI assistant never executes shared-environment SQL.

Full rule: [`../../CLAUDE.md`](../../CLAUDE.md) §12g · backend authority: `wecms-api/CLAUDE.md` §14
*(separate repository)*.

## Relationship to `features/`

`bugs/` and [../features/](../features/) answer different questions and both stay:

| | This folder | [../features/](../features/) |
|---|---|---|
| Answers | *why* it changed — problem, root cause, implementation, testing, history | *how the screen works now* |
| Lifecycle | frozen once complete | kept current |

After a fix, update the affected screen's permanent docs (`README.md`, `screen-flow.md`,
`ui-specification.md`, …) if current behaviour changed.

## Relationship to `audits/`

An audit is **never** converted into an implementation record. If an audit in
[../audits/README.md](../audits/README.md) leads to a code fix, the audit stays where it is and a
**separate** record is created here (or in [../issues/](../issues/)).

## Cross-repository

A bug affecting both sides gets a record in **both** repositories before either side's code changes —
this folder and `wecms-api/docs/bugs/` *(backend, separate repository)* — using the same descriptive
subject and date where appropriate, cross-linked. This side covers UI behaviour, user inputs, frontend
validation, API consumption, loading / error / result behaviour, and frontend tests.

## Existing historical records

This folder was added 2026-08-17 for **future** work. Older bug documentation elsewhere in the tree is
**not** migrated automatically.
