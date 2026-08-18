# Issues — dated implementation records (non-bug)

**Status:** CURRENT

## Purpose

Dated **implementation records for issue work that is not a bug** in `wecms-web`. Each record is
created **before** the code change (docs-first), carried at `Status: IN PROGRESS` while the work is in
flight, and completed in place afterwards. This folder is **change history** — it explains *why*
something changed. It does not describe how the system currently works, and it is not a place for
screen specifications.

## What belongs here

- the problem requires implementation work but is not clearly a product defect
- operational or configuration behaviour needs correcting
- an unresolved implementation concern is being addressed
- a tracked behaviour/problem that does not fit BUG cleanly

**When classification is unclear between BUG and ISSUE, prefer ISSUE.**

## What does NOT belong here

| Not this | Goes to |
|---|---|
| A defect — implemented behaviour is wrong, something broke, behaviour differs from an accepted requirement, parity behaviour is wrong and the task is to fix it | [../bugs/](../bugs/) |
| **Screen specifications** and current + permanent documentation (the 6-doc set) | [../features/](../features/)`<domain>/<feature>/` |
| Audits, parity reviews, verifications, investigations, legacy comparisons, migration verifications, architecture reviews, gap analyses, historical validation, cross-feature analysis | [../audits/README.md](../audits/README.md) |
| A knowingly-deferred issue you are **not** fixing | [../tech-debt.md](../tech-debt.md) |
| Permanent frontend architecture / testing strategy / contract reference | [../architecture/](../architecture/) · [../testing/](../testing/) · [../references/](../references/) |
| Pre-implementation source material | its existing source-material location (e.g. [../e-sign/](../e-sign/README.md)), marked **PLANNED / PRE-IMPLEMENTATION** |

Never create duplicate BUG + ISSUE records for the same implementation task. Never open an issue record
just because feature work is large — that stays on the 6-doc feature model.

## Filename format

```
descriptive-name-YYYY-MM-DD.md
```

Lowercase kebab-case, ISO date only, describing the actual subject — e.g.
`login-credentials-account-type-resolution-2026-08-17.md`,
`recipient-lookup-behavior-2026-08-17.md`.

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
templates are authoritative in
[../../CLAUDE.md](../../CLAUDE.md) §"Docs-First Implementation Workflow (MANDATORY)":

```
create record (Status: IN PROGRESS) → implement → complete the SAME record
  → update permanent feature / reference docs where necessary → node scripts/check-doc-links.mjs
  → Status: COMPLETE | CLOSED | PARTIAL | BLOCKED
```

Never create a second "final" file — finalize the original. If work stalls, do not delete the record;
set `Status: BLOCKED` or `Status: PARTIAL` and say what remains.

`Status:` here is the **work-item lifecycle**, independent of the five-word doc-classification
vocabulary in [../README.md](../README.md) §"Status vocabulary".

## Human approval before implementation

**Added 2026-08-18.** An issue record is opened by docs-first — but **opening it does not authorize the
change.** Full rule: [`../../CLAUDE.md`](../../CLAUDE.md) §16.

- **Classify the request first.** *Check · investigate · review · audit · analyze · design* → document
  the findings and **stop for human approval**; *"investigate and fix"* or *"please implement this"* →
  already authorized. **When it is ambiguous, treat it as investigation-only.**
- **An investigation with no approval yet is normally an AUDIT** in [`../audits/`](../audits/README.md);
  the issue record here is created for the approved work and **links to the audit as evidence** (§16i).
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

  `Approval Status: NOT REQUIRED` is the honest value for work the user explicitly asked you to do.
- **If the change is denied**, keep the record: no source change, no tests, no DB dependency work —
  write the decision down, preserve the evidence, stop. **Never delete a record because the work was
  denied**; a deliberate *"keep the current behaviour"* belongs here as history, and in
  [`../tech-debt.md`](../tech-debt.md) if the team means to revisit it.
- **Approving the change is not approving the backend SQL** (§16m) and not approving a push (§15) — and
  since pushing `sit` / `uat` deploys, that last one is a separate human decision every time.

## Verification — the work is not done when the code is written

**Added 2026-08-18.** Every issue record passes the **implementation quality gate** before its status
leaves `IN PROGRESS`. Authoritative rule: [`../../CLAUDE.md`](../../CLAUDE.md) §14.

```
create record → implement → self-audit the diff → tests → test scenarios
  → regression review → API / UI / DB-dependency / security / parity checks as applicable
  → update docs → record the evidence → COMPLETE
```

- **Self-audit the actual Git diff**, not the ticket text — scope creep, unrelated changes, debug
  logging, hard-coded labels or sizes, broken permission visibility, secrets (§14b, §14s).
- **Decide the appropriate automated tests and add them where in scope** (§14c). Issue work that
  corrects an observable behaviour follows the same regression-test thinking as a bug fix (§14d); issue
  work that is purely operational or configuration may legitimately be `NOT APPLICABLE` — say so and
  say why, rather than leaving it blank.
- ⚠️ **Put any new test where Vitest actually collects it** — `components/**` or `lib/**`; a test under
  `hooks/` or `app/` is **silently skipped** ([../testing/testing-strategy.md](../testing/testing-strategy.md)).
- **Run the relevant scope, report exactly what was run** (§14i), and classify failures rather than
  hiding them (§14j). There is no CI test stage — `npm test` is a manual responsibility.
- **Update the affected screen's `../features/<domain>/<feature>/test-scenarios.md`** when permanent
  behaviour changed; this record keeps only the evidence for this change (§14f).

**Every record ends with a `## Verification` section** — Automated Tests · Test Scenarios · Regression
Review · Manual Verification, applicable subsections only, with honest states: `PASS` · `FAIL` ·
`NOT RUN` · `BLOCKED` · `NOT APPLICABLE`. **Never mark `PASS` without evidence, never convert a planned
test case into a test result, and never claim visual verification if the UI was not actually run.**
Configuration and environment work is especially prone to `BLOCKED` and `NOT RUN` — record those states
honestly instead of implying verification happened.

**Once verification actually runs, the durable evidence gets its own record** *(added 2026-08-18)* at
[`../testing/results/`](../testing/results/)`descriptive-name-test-result-YYYY-MM-DD.md`, and this issue
record gains:

```markdown
## Test Evidence

Test result:
[<Change Name> Test Result](../testing/results/<name>-test-result-YYYY-MM-DD.md)

Final test result:    PASS
Regression coverage:  PASS | NOT APPLICABLE — <reason>
```

**Both links must resolve** (`node scripts/check-doc-links.mjs`) — the result record's
`**Related Record:**` points back here. `## Verification` above stays the **summary**; the command,
counts, environment, build under test, and pre-existing-vs-new failures live in the result record.
Configuration and operational issue work is often verified manually or in one environment only — say
exactly that (`NOT RUN` / `BLOCKED` with a reason) rather than leaving it implied. **`Implementation
Status: COMPLETE` requires test evidence that supports it.** Full rule:
[`../../CLAUDE.md`](../../CLAUDE.md) §17 · folder rules:
[`../testing/results/README.md`](../testing/results/README.md).

This applies to **every team — Cambodia, Vietnam, Korea, and any future contributor** — and to every
tool used to do the work.

## Database impact — dependency only, no SQL here

Database change artifacts are **backend-owned**. **No `.sql` file belongs in `wecms-web`** — not a
migration file, not a manual DBA script, not a seed or backfill. Those live in `wecms-api`
(`src/main/resources/db/migration/` for a new table or DB function; `docs/sql/<YYYY>/` for
existing-table changes, indexes, constraints, and any data change).

An issue record here declares its `## Database Impact` at the frontend level only:

```markdown
## Database Impact

NONE (frontend) — database dependency only.

Database dependency: see the related backend record
wecms-api/docs/issues/login-credentials-account-type-resolution-2026-08-17.md
```

Document the dependency only to the depth needed to explain what the UI is waiting on. **Never embed
executable SQL** in a frontend record. Cross-link the paired backend record.

**An issue is not `COMPLETE` while the backend DB change it depends on is unapplied in the target
environment** — use `PARTIAL` / `BLOCKED` / `READY FOR DEPLOYMENT` and name the environment. Frontend
developers do not execute database changes, and an AI assistant never executes shared-environment SQL.

Full rule: [`../../CLAUDE.md`](../../CLAUDE.md) §12g · backend authority: `wecms-api/CLAUDE.md` §14
*(separate repository)*.

## Relationship to `features/`

`issues/` and [../features/](../features/) answer different questions and both stay:

| | This folder | [../features/](../features/) |
|---|---|---|
| Answers | *why* it changed — issue, current state, target state, implementation, testing, history | *how the screen works now* |
| Lifecycle | frozen once complete | kept current |

After the work lands, update the affected permanent screen / reference docs if current behaviour
changed.

## Relationship to `audits/`

An audit is **never** converted into an implementation record. If an audit in
[../audits/README.md](../audits/README.md) leads to a code change, the audit stays where it is and a
**separate** record is created here (or in [../bugs/](../bugs/)).

## Cross-repository

An issue affecting both sides gets a record in **both** repositories before either side's code
changes — this folder and `wecms-api/docs/issues/` *(backend, separate repository)* — using the same
descriptive subject and date where appropriate, cross-linked. This side covers UI behaviour, user
inputs, frontend validation, API consumption, loading / error / result behaviour, and frontend tests.

## Existing historical records

This folder was added 2026-08-17 for **future** work. Older issue documentation elsewhere in the tree
is **not** migrated automatically.
