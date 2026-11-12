@AGENTS.md

# CLAUDE.md — WeInvoice Web

Living AI/developer guide for the **WeInvoice** Next.js frontend. Update this file whenever the real code moves.

**Read [AGENTS.md](AGENTS.md) first.** This is Next.js 16 — APIs, conventions, and file structure differ from earlier versions you may have seen in training data. Check `node_modules/next/dist/docs/` before writing anything non-trivial.

> **Rewritten 2026-11-03.** This repository previously held the WeCMS frontend (`wecms-web`). The
> WeCMS screens, code and documentation were removed in the WeInvoice P1 transformation —
> [docs/features/weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md](docs/features/weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md).
> The **team workflow rules** (docs-first, quality gate, manual Git, approval gate, test-result
> records — §1–§17 below) were carried over unchanged in substance; the WeCMS-specific UI / API
> sections were replaced by [WeInvoice Project Rules](#weinvoice-project-rules). Where §1–§17 still
> say `wecms-web` / `wecms-api`, read "this repository" / "the backend repository".

---

## Purpose

Frontend for **WeInvoice** — an e-invoice hub in the WeCMS family (Webcash Global): collect
purchase / sales e-invoices from the GDT portal, issuing providers, email and upload; de-duplicate
across channels; search, tag, download; pre-filing checks, supplier risk, taxpayer lookup, filed
returns, auto-journal. Product owner input arrives as the **WeInvoice UI Spec** handover package
(versioned: v1.0 = 2026-10-30), kept **outside** this repository:

| Spec file | Binding for |
|---|---|
| `01_Dac_ta_UI.html` | Layout, components, labels VI/EN/KO, screen states, flows, messages |
| `02_Yeu_cau_nghiep_vu.md` | Business rules (referenced in code and docs as **§3.x**) |
| `weinvoice-web/` (UI source) + prototype | Reference implementation of the UI; its data layer is stubbed on purpose |

The spec decides *what the screen looks like and which rules hold*; architecture, API, DB, engines
and libraries are the dev team's call. If the spec looks wrong or infeasible, raise it with the PO —
a new spec version is issued; do not silently diverge.

**Runtime shape (P1, 2026-11-03).** Client-rendered SPA inside the App Router. **No backend yet:**
every screen reads and writes through `lib/api/weinvoice/*`, which is a **mock** over an in-memory
store seeded by `lib/api/weinvoice/mockData.ts` (resets on reload). **Login is real** — `POST
/api/v1/auth/login` of the backend (`NEXT_PUBLIC_API_BASE_URL`, JWT + tenant `BIZ_KEY`). The
WeInvoice data endpoints (`/api/v1/weinvoice/*`) are wired only once their interface specification
is published. No SSR data fetching, no server actions, no route handlers. **This repository is not a
backend and must not become one** — real endpoints belong in the backend repository when it exists.

**Deployment.** [.gitlab-ci.yml](.gitlab-ci.yml) triggers a downstream pipeline on pushes to `sit`
and `uat` — **a push to those branches is a deployment**. The P1 build has no backend and a mock
login: it must not be deployed as a product. Git and deployment are manual (§15).

## Documentation Structure Rules

All frontend documentation lives under [`docs/`](docs/README.md).

| Doc type | Path |
|---|---|
| Module / screen documentation (current behaviour) | [docs/features/](docs/features/README.md) — today one module: [weinvoice/](docs/features/weinvoice/README.md) |
| Dated bug / issue records | [docs/bugs/](docs/bugs/README.md) · [docs/issues/](docs/issues/README.md) |
| Audits / investigations (HISTORICAL) | [docs/audits/](docs/audits/README.md) |
| Test strategy and test-result records | [docs/testing/](docs/testing/README.md) |
| Knowingly deferred issues | [docs/tech-debt.md](docs/tech-debt.md) |

Status vocabulary (`CURRENT` · `LEGACY` · `PLANNED` · `HISTORICAL` · `SUPERSEDED`):
[docs/README.md § Status vocabulary](docs/README.md#status-vocabulary).

## Docs-First Implementation Workflow (MANDATORY)

**Adopted 2026-08-17. This section is authoritative for `wecms-web`.** The same rule — with
backend-specific placement — is stated in `wecms-api/CLAUDE.md` §"Docs-First Implementation Workflow
(MANDATORY)" *(backend — maintained in the separate `wecms-api` repository; not included in this
clone)*. The two must always agree on the order, the Definition of Done, the filename standard, and
the templates. [docs/README.md](docs/README.md) §"Implementation records (docs-first)" and both
harness skill trees (`.claude/skills/wecms-web-docs/**` and `.agents/skills/wecms-web-docs/**`)
restate the same rule. **If any of those disagrees with this section, this section wins** — fix the
other file, do not fork the rule.

**Documentation is part of the implementation workflow, not something added only after the code is
finished.** For every meaningful behaviour-changing task, the dated Markdown record is created
**before the detailed investigation begins**, and therefore before any application code is modified
(§2a — the record is a hard precondition, not a recommendation).

**And the task does not end when the code is written.** After implementation, the
**implementation quality gate in §14** is mandatory — self-audit the diff, add/run the tests the
change warrants, update test scenarios, run the applicable API / UI / DB / security / parity checks,
and report the outcome honestly before any final status is set. §14 applies to the same people, tools,
branches, and environments as this section.

**And the workflow ends before Git does.** Commit, push, merge, tag, and environment promotion are
**manual** developer/team actions — §15. AI-assisted work stops at **`READY FOR MANUAL COMMIT`**, which
matters especially here: pushing `sit` or `uat` **triggers a deployment**.

```
QUALITY GATE COMPLETE  →  READY FOR MANUAL COMMIT  →  HUMAN Git / deployment process
```

**And it may have to stop earlier still.** When the request is only to **check · investigate · review ·
audit · analyze · design**, the work ends at the record — a **human approves implementation before any
application code is modified** (§16). Investigation never authorizes a fix:

```
INVESTIGATE  →  DOCUMENT FINDINGS  →  HUMAN APPROVAL  →  implement  →  quality gate
   →  TEST-RESULT RECORD (§17)  →  READY FOR MANUAL COMMIT
   →  HUMAN Git / deployment process
```

> ### This is a TEAM rule, not an AI rule
>
> **The docs-first workflow is mandatory for every developer contributing a meaningful
> behaviour-changing change to WeCMS** — the whole team, regardless of *how* the implementation is
> performed: **manually by a developer · Claude Code · Cursor · another AI coding assistant · IDE
> tooling · scripts · pair programming.**
>
> The requirement belongs to the **project**, not to a person or a tool. No one is exempt because they
> did not use an AI assistant, because the work is on their own branch, because the change is small but
> behaviour-changing, or because it is frontend-only or backend-only.
>
> Full detail — responsibility, one-record-per-task, parallel work, review expectations, branch /
> environment independence, and the emergency-hotfix exception — is in **§12 "Who must follow this"**
> below.

### 1 · When this applies — and to whom

**What:** any work to **fix a bug · fix an issue · implement a feature · run an audit / parity review /
investigation · update functional behaviour · change business rules · change API behaviour · change UI
behaviour · change integration behaviour · resolve legacy/JEX parity · perform a functional refactor ·
fix SIT/UAT/PROD behaviour.**

**Who:** **every developer on the WeCMS team**, and every tool used to do the work (see §12). Whether
the task arrives as a ticket, a verbal request, a code-review follow-up, or a developer's own
initiative makes no difference.

The only exemptions are the short list in §10.

### 2 · Mandatory order

> **Steps 2–4 are ORIENTATION ONLY.** They exist to let you *classify and place* the record — not to
> solve the problem. **The record is created before the detailed investigation, not merely before the
> code** (§2a). *Corrected 2026-08-18: this list previously read "inspect the source · inspect the docs ·
> inspect tests and Git history" **before** step 6, which licensed a full investigation with no record —
> and that is exactly what went wrong in the Internal Transfer test.*

1. Read the user's requirement.
2. **Orient only** in the source — enough to identify the route / screen / component and classify the
   task. **Do not** trace the fault, follow the request end to end, inspect the API contract in depth,
   or form a root cause yet (§2a).
3. Orient the same way in the existing documentation, and check whether a record for this task already
   exists (§12c).
4. Glance at tests and Git history only as far as classification needs.
5. Determine the correct documentation location (§4).
6. **CREATE the dated Markdown record FIRST — before the detailed investigation and before touching
   application code — then VERIFY the file exists on disk and report its path** (§2a).
7. Set `**Status:** IN PROGRESS`.
8. Document what is known **so far**: requirement / problem · current behaviour as observed · expected /
   target behaviour · scope · out of scope · initial evidence · investigation plan. **An unknown root
   cause is written as `Pending investigation`, not used as a reason to postpone the record** (§2a).
8b. **NOW perform the detailed investigation** — trace the fault, read the component and hook chain,
   inspect the request the UI sends, compare against legacy — and **write the findings into the same
   record as they are found** (§2a). The chat summarizes the record; it never replaces it.
9. **Only after the Markdown record exists — and only when implementation is authorized (§16)** —
   modify application code. A request to *check · investigate · review · audit · analyze · design*
   stops here: document the findings and **wait for a human approval decision**.
10. During implementation, update the **same** record whenever the real implementation diverges from
    the initial plan.
11. **Run the implementation quality gate (§14) — implementation is not the end of the task.**
    Self-audit the actual Git diff · decide and add/update the appropriate tests · run the relevant
    test scope · run the applicable API-consumption / UI / DB-dependency / security / performance /
    parity checks · perform the regression review · review the diff against the requested scope.
11b. **Write the test-result record (§17)** at `docs/testing/results/` once verification has actually
    run, and **link it from the implementation record** (`## Test Evidence`) and back again.
12. After implementation, complete the record with: verified root cause · actual implementation ·
    files changed · API impact · UI impact · **database impact — for this repo, the dependency only
    (§12g)** · integration impact · the **`## Verification` section with real evidence (§14g)** ·
    actual result · limitations / follow-up.
13. Update the permanent / current feature documentation when the implemented behaviour changes the
    system's authoritative behaviour (§8) — including the screen's `test-scenarios.md` when permanent
    behaviour changed (§14f).
14. Change `Status:` from `IN PROGRESS` to the appropriate final state — `COMPLETE` · `CLOSED` ·
    `PARTIAL` · `BLOCKED` — honestly, per §14u.
15. Validate documentation links (§11).
16. Only then may the implementation task be declared complete — and "complete" for AI-assisted work
    means **`READY FOR MANUAL COMMIT`** (§15). Committing, pushing, merging, and deploying are
    **manual** steps performed by the developer or the team afterwards.

### 2a · The record is a HARD PRECONDITION — not a recommendation

**Added 2026-08-18 after a governance test failed.** A request to *check a Transfer-button error* was
answered with a full technical investigation — UI → target-accounts API → `WBE_DB` → duplicate
`NAPAS_BANK_INFO.BANK_CD` → existing source fix → stale deployed WAR — **and no audit record was ever
created.** The rule existed; it was not enforceable, because every operative step list said the record
comes before *code*, and investigation is not code. It now says **before investigation.**

```
NO DOC FILE  →  NO DETAILED INVESTIGATION  →  NO IMPLEMENTATION
```

This applies to every meaningful **AUDIT · INVESTIGATION · BUG · ISSUE · FEATURE · PARITY REVIEW ·
BEHAVIOUR CHANGE**, for every developer and every tool (§12).

#### What you may do before the record exists

**Orientation only** — enough to *classify and place* the record:

| Allowed before the record | Not allowed before the record |
|---|---|
| Skim the repo to identify the module / screen / repository involved | Tracing the fault through the call chain |
| Read enough governance to pick the record category and folder | Reading controller → service → repository → SQL end to end |
| Check whether a record for this task already exists (§12c) | Querying the database for evidence |
| Glance at a filename, a route, an error string to name the subject | Comparing against legacy JEX to explain behaviour |
| | Forming, testing, or reporting a root cause |
| | Running tests to reproduce |

The line is: **enough to know what kind of task this is, and where its record goes.** Everything past
that is the investigation, and the investigation happens *inside* a record.

#### Required first-action sequence

```
1. classify the task            (AUDIT / BUG / ISSUE / FEATURE)
2. determine the governed location   (§4 — never invent one)
3. CREATE the Markdown record
4. VERIFY the file exists on disk
5. only then begin the detailed investigation
```

Step 4 is not ceremonial. *Intending* to create the file, describing the file, or naming a path you did
not write is not compliance — **the file must exist.**

#### Surface it before investigating

Before the detailed investigation begins, report:

```
Documentation record:  docs/audits/<category>/<subject>-audit-YYYY-MM-DD.md
Classification:        AUDIT / BUG / ISSUE / FEATURE
Investigation Status:  IN PROGRESS
Approval Status:       PENDING
Implementation Status: NOT STARTED
```

**A bare *"docs-first followed"* is not evidence — the actual path is** (§17b). If the path is not in
the response, the precondition was not met.

#### No silent deferral

> *"I'll investigate first and write the document once I understand the issue."*

**Specifically forbidden.** The record does **not** need the root cause to be created — that is the
entire purpose of `Investigation Status: IN PROGRESS`. An initial investigation record is legitimately
this thin:

```markdown
# <Subject> — Audit

**Date:** YYYY-MM-DD
**Type:** AUDIT / INVESTIGATION
**Investigation Status:** IN PROGRESS
**Approval Status:** PENDING
**Implementation Status:** NOT STARTED

## Observed Behavior
## Expected Behavior
## Scope
## Initial Evidence
## Investigation Plan

## Root Cause
Pending investigation.

## Recommended Implementation
Pending investigation.
```

Create that, then go and fill it in.

#### The investigation lives in the record, not in the chat

As findings appear, **write them into the same record** (§12b–12c) — the failing endpoint, the error
code, the root cause, DB evidence, legacy behaviour, the current source state, a stale deployment or
build state, missing regression coverage. **The chat response summarizes the governed file; it does not
replace it.** A finding that exists only in a conversation is lost the moment the session ends — which
is precisely what the failed test produced.

#### Failure modes — stop, do not proceed

| Situation | Required behaviour |
|---|---|
| **The location is unclear** | Re-read the governance (§4), pick the closest governed category. If it is still genuinely ambiguous, **stop and ask** — do not investigate "while deciding". |
| **The file cannot be created** (permissions, path, tooling) | **STOP.** Report **`DOCS-FIRST BLOCKED — documentation record could not be created`** and why. Do not continue the investigation. |
| **A record already exists for this task** | Update **that** record (§12b) — do not open a second one, and do not treat the existing file as permission to skip reporting its path. |

#### Where this rule stops

The exemption list in §10 (comment-only, formatting, lint, lockfile noise, a genuinely mechanical
rename) is unchanged — those need no record and therefore no precondition. And a **quick factual
answer** — *"which file defines this constant?"*, *"does this endpoint exist?"* — is a question, not an
investigation. The precondition attaches to **diagnosing behaviour, comparing against legacy, or
explaining why something is wrong**, whether or not the user used the word "audit".

### 3 · Definition of Done

For a meaningful behaviour-changing task, **do not report the work as complete** unless every box is
true:

```
[ ] the dated implementation record was created BEFORE the detailed
       investigation — and therefore before any code change (§2a)
[ ] the record reflects the final implemented behaviour
[ ] planned statements were updated to verified facts
[ ] authoritative feature documentation was updated if needed
[ ] Database Impact is declared — for this repo, the frontend dependency and a
       cross-link to the backend record that owns the SQL; never a .sql here (§12g)
[ ] the implementation quality gate (§14) was run:
       [ ] the actual Git diff was self-audited (§14b, §14s)
       [ ] the appropriate automated tests were decided, and added/updated
             where within scope — a bug fix carries a regression test or a
             justification for why one is impractical (§14c, §14d)
       [ ] every new test sits where Vitest actually collects it —
             components/ or lib/, never hooks/ or app/ (§14c)
       [ ] the relevant existing tests were executed, and what was run is
             stated exactly (§14i); failures are classified, not hidden (§14j)
       [ ] the applicable API-consumption / UI / DB-dependency / security /
             performance / parity checks were performed (§14k–§14p)
       [ ] docs/features/**/test-scenarios.md was updated where permanent
             behaviour changed (§14f)
[ ] testing / result evidence was recorded in the record's ## Verification
       section, with honest states — PASS / FAIL / NOT RUN / BLOCKED /
       NOT APPLICABLE, never a plan reported as a result (§14g, §14h)
       — and visual verification is claimed only if the UI was actually run
[ ] for a meaningful change whose verification actually ran: the durable
       test-result record exists at docs/testing/results/, and the
       implementation record's ## Test Evidence links to it — both
       directions resolve (§17)
[ ] known limitations / follow-up were recorded
[ ] documentation links validate
[ ] Status is no longer IN PROGRESS unless work genuinely remains
       — and NOT COMPLETE while a depended-on backend DB change is unapplied (§12g)
       or a required verification step has not actually been performed (§14u)
[ ] no commit / push / merge / tag / deploy was performed by tooling — the
       work is handed over at READY FOR MANUAL COMMIT, and pushing sit / uat
       is a deployment decision a human makes (§15)
```

### 4 · Where the record goes (`wecms-web`)

> **Placement policy revised 2026-08-17 (supersedes the original docs-first placement table).** Dated
> **bug** and **issue** implementation records no longer live inside the feature folder — they live in
> the dedicated top-level `docs/bugs/` and `docs/issues/` categories. **Feature documentation,
> `docs/audits/`, and the docs-first workflow itself are unchanged.** The earlier instruction "do not
> create a global `bugs/` or `issues/` folder" is **withdrawn** — those two folders are now part of the
> approved top-level set, added here together with [docs/README.md](docs/README.md) §"Where things
> live" and both harness skill trees in the same pass.

**Four record categories — one home each:**

| Record type | Goes in | Filename |
|---|---|---|
| **BUG** — dated implementation record for a bug fix | [docs/bugs/](docs/bugs/) | `descriptive-name-YYYY-MM-DD.md` |
| **ISSUE** — dated implementation record for non-bug issue / behavioural / operational / tracked implementation work | [docs/issues/](docs/issues/) | `descriptive-name-YYYY-MM-DD.md` |
| **FEATURE** — current + permanent screen documentation (**structure unchanged** — the 6-doc set) | [docs/features/](docs/features/)`<domain>/<feature>/` — e.g. `features/payment/approval-box/`, `features/settings/contacts/`, `features/addon-service/tax-filing/`, `features/banking/reports/daily-financial/` | the 6-doc set |
| **AUDIT** — audit · parity review · verification · investigation · legacy comparison · migration verification · architecture review · historical validation · cross-feature analysis | [docs/audits/](docs/audits/) | `descriptive-name-YYYY-MM-DD.md` |

Examples:

```
docs/bugs/approval-status-detail-navigation-fix-2026-08-17.md
docs/bugs/account-filter-parity-fix-2026-08-17.md
docs/issues/login-credentials-account-type-resolution-2026-08-17.md
docs/issues/recipient-lookup-behavior-2026-08-17.md
docs/audits/legacy-transfer-history-verification-2026-08-17.md
```

**BUG vs ISSUE.** Use **BUG** when implemented behaviour is incorrect · something that worked is
broken · behaviour differs from an accepted requirement · a defect causes wrong user/system behaviour ·
parity behaviour is incorrect and the task is to fix it. Use **ISSUE** when the work is needed but is
not clearly a product defect · operational / configuration behaviour needs correcting · an unresolved
implementation concern is being addressed · a tracked behaviour/problem does not fit BUG cleanly.
**If classification is unclear, prefer ISSUE.** Never create duplicate BUG + ISSUE records for the
same implementation task.

**A large feature is still a feature.** Do **not** open a bug or issue record just because feature
implementation work is big — feature work stays on the 6-doc feature model.

**An audit is never converted into an implementation record.** If an audit leads to a code fix, the
audit stays in `docs/audits/` and a **separate** record is created in `docs/bugs/` or `docs/issues/`
for the fix — **after a human approves implementation** (§16i). The bug/issue record **links to the
audit as evidence** rather than copying it. `Audit Status: COMPLETE` means the investigation finished,
**not** that the defect is fixed (§16n). This also removes the earlier tension with the "audits do not
live in `features/`" rule:
audits go to `audits/`, dated bug/issue records go to `bugs/` / `issues/`, and `features/` holds only
current-behaviour documentation.

**Other folders keep their existing purposes** and are **not** homes for dated bug/issue
records: [docs/testing/](docs/testing/) (testing strategy / infrastructure). A bug/issue that touches one of those areas still gets its dated
record in `docs/bugs/` / `docs/issues/`, with the permanent doc updated afterwards. A knowingly-deferred
issue you are *not* fixing still belongs in [docs/tech-debt.md](docs/tech-debt.md), not `docs/issues/`.

**Existing historical records are not migrated.** This is a rule for future work — see §14.

**`Status: IN PROGRESS / COMPLETE / CLOSED / PARTIAL / BLOCKED` is the record's own lifecycle field —
it is not a sixth value in the five-word doc-classification vocabulary** (`CURRENT` · `LEGACY` ·
`PLANNED` · `HISTORICAL` · `SUPERSEDED`, normatively defined in [docs/README.md](docs/README.md)
§"Status vocabulary"). The two axes are independent and both may appear: a finished implementation
record is typically `HISTORICAL` as a document *and* `Status: COMPLETE` as a work item.

### 5 · Filename standard

```
descriptive-name-YYYY-MM-DD.md
```

Lowercase kebab-case. The permanent filename must describe the actual subject.

**Correct:**

```
citad-recipient-name-resolution-fix-2026-08-17.md
approval-box-detail-navigation-fix-2026-08-17.md
payment-dispatch-timeout-fix-2026-08-17.md
transaction-history-memo-feature-2026-08-17.md
tax-filing-export-implementation-2026-08-17.md
account-filter-parity-fix-2026-08-17.md
```

**Forbidden** — internal work codes, sequence numbers, vague labels, **or a developer's name** as the
filename. Every developer uses the same standard; the record is named after the subject, never after
the person or session that wrote it:

```
a1-01-account-filter-fix.md   d1-d2-d3-check.md   k9-fix.md
p0-fix.md   p1-update.md   th-01-verification.md
task-03.md   issue-04.md   final-fix.md   new-feature.md
dev-a-fix.md   sokny-fix.md   mr-kang-update.md
```

### 6 · Date standard

ISO only — `YYYY-MM-DD` (e.g. `2026-08-17`). Never `20260817`, `17-08-2026`, or `08-17-2026`. The
date is the implementation / change record date. **Never use a fake date.**

### 7 · Internal issue / task IDs

Internal identifiers live in the document **metadata**, not normally in the filename:

```
Filename:  account-filter-parity-fix-2026-08-17.md

# Account Filter Parity Fix

**Date:** 2026-08-17
**Issue:** A1-01
**Type:** PARITY FIX
**Status:** IN PROGRESS
```

Same rule for `A1` · `A1-01` · `D1-D2-D3` · `K9` · `TH-01` · `P0` · `P1` · `P2` · `Q1` · `Task-03` ·
`Issue-04`. Keep an identifier in a filename **only** when the exact identifier is an externally
fixed contract, a vendor specification, or a machine-consumed name.

### 8 · Dated record vs permanent feature docs

They have different jobs — do not collapse them, and do not treat a dated record as the only source
of truth for permanent behaviour.

| | Dated implementation record | Permanent feature docs |
|---|---|---|
| **Lives in** | `docs/bugs/` or `docs/issues/` | `docs/features/<domain>/<feature>/` |
| **File** | `descriptive-name-YYYY-MM-DD.md` | the screen's 6-doc set — `README.md`, `screen-flow.md`, `ui-specification.md`, `component-index.md`, `api-consumption.md`, `test-scenarios.md` |
| **Answers** | *why* the change happened — original problem, investigation, implementation decision, files actually changed, verification, historical traceability | *how the system works NOW* |

**`docs/bugs/` and `docs/issues/` are change history; they do not replace `docs/features/`.** A bug
record at `docs/bugs/approval-status-detail-navigation-fix-2026-08-17.md` explains why it changed, what
was wrong, the root cause, the implementation, the testing; the screen's own
`docs/features/payment/approval-box/{README,screen-flow,ui-specification}.md` still explains how the
feature works now.

Order of operations: **create the dated record → implement → complete the dated record → update the
permanent feature docs if current behaviour changed.**

**An existing authoritative feature doc does not remove the docs-first requirement.** A meaningful
bug / issue / feature implementation still gets a dated change record first; the authoritative docs
are updated afterwards. The only exemptions are §10.

### 9 · Templates

#### 9a · Bug / issue record — initial

Create this **before** modifying code:

```markdown
# <Descriptive Human-Readable Title>

**Date:** YYYY-MM-DD
**Type:** BUG FIX | ISSUE | PARITY FIX
**Status:** IN PROGRESS
**Repository:** wecms-web
**Issue:** <ticket/work ID if available>

## Problem

Describe what the user/system is doing incorrectly. Do not assume the root cause yet.

## Current Behavior

Describe the CURRENT behavior verified from source/runtime evidence.

## Expected Behavior

Describe the requested target behavior.

## Scope

What this task will change.

## Out of Scope

What this task will not change.

## Initial Investigation

- source inspected
- relevant docs inspected
- tests inspected
- legacy/JEX evidence inspected where applicable
- known facts before implementation

Do not write an unverified root cause as fact.

## Proposed Implementation Plan

Describe the intended implementation. Use planned/proposed wording.

## Testing Plan

Describe how the fix will be verified.

## Root Cause

Pending verification.

## Implementation

Pending.

## Files Changed

Pending.

## API Impact

Pending / None.

## UI Impact

Pending / None.

## Database Impact

NONE (frontend) — or: database dependency only, see the related backend record <path>.

<!-- No .sql ever lives in wecms-web (§12g). Document only the frontend dependency and cross-link
     the wecms-api record that owns the migration / manual DBA script. -->

## Integration Impact

Pending / None.

## Verification

<!-- Completed AFTER implementation, from real evidence — see §14g. Keep only the applicable
     subsections. Honest states only: PASS | FAIL | NOT RUN | BLOCKED | NOT APPLICABLE.
     A bug fix also carries the ## Regression Test block (§14d), or a justification for why an
     automated regression test is impractical. Do not claim visual verification unless the UI
     was actually run and inspected. -->

### Automated Tests

- Test:
- Result:

### Test Scenarios

- Scenario:
- Expected:
- Actual:
- Result:

### Regression Review

- Areas checked:
- Result:

### Manual Verification

- Environment:
- Steps:
- Result:

## Result

Pending.

## Known Limitations / Follow-up

Pending / None.
```

#### 9b · Feature record — initial

Create this **before** implementing a meaningful new feature:

```markdown
# <Feature Name>

**Date:** YYYY-MM-DD
**Type:** FEATURE
**Status:** IN PROGRESS
**Repository:** wecms-web
**Issue:** <ticket/work ID if available>

## Purpose

Why this feature is needed.

## Requirement

What has been requested.

## Current System Behavior

What exists before implementation.

## Target Behavior

What should exist after implementation.

## Scope

Included behavior.

## Out of Scope

Excluded behavior.

## Proposed User / Business Flow

Planned flow.

## Proposed Implementation

Planned code/components/services/modules.

## API Impact

Planned / None.

## UI Impact

Planned / None.

## Database Impact

NONE (frontend) — or: database dependency only, see the related backend record <path>.

<!-- No .sql ever lives in wecms-web (§12g). Document only the frontend dependency and cross-link
     the wecms-api record that owns the migration / manual DBA script. -->

## Integration Impact

Planned / None.

## Validation / Business Rules

Planned rules.

## Testing Plan

How implementation will be verified.

## Implementation

Pending.

## Verification

<!-- Completed AFTER implementation, from real evidence — see §14g, and the feature-verification
     dimensions in §14e (happy path · validation · empty state · error state · loading state ·
     permission visibility · boundary values · API failure · duplicate/retry · DB dependency ·
     localization EN/KO/VI · concurrency). Include only what this feature actually has.
     Honest states only: PASS | FAIL | NOT RUN | BLOCKED | NOT APPLICABLE. -->

### Automated Tests

- Test:
- Result:

### Test Scenarios

- Scenario:
- Expected:
- Actual:
- Result:

### Regression Review

- Areas checked:
- Result:

### Manual Verification

- Environment:
- Steps:
- Result:

## Result

Pending.

## Known Limitations / Follow-up

Pending / None.
```

#### 9c · Finalization — the same file, never a second one

After the code changes, return to the **same** dated record. **Do not create a second "final"
Markdown file.** Update: `Status` · Root Cause · Implementation · Files Changed · API Impact · UI
Impact · **Database Impact (dependency only — §12g)** · Integration Impact · **Verification (§14g)** ·
Result · Known Limitations / Follow-up.

Finalizing the record is not the same as finishing the task: the **quality gate in §14 runs first**,
and the `## Verification` section is filled from what that pass actually produced.

Replace inaccurate planned statements where appropriate. Do **not** erase useful planning history
when it explains an important design decision — instead distinguish clearly between **Initial plan**
and **Actual implementation**.

#### 9d · Planned vs current accuracy

Because the record is created before the code, wording matters.

- Before implementation use **PLANNED · PROPOSED · EXPECTED · TO BE IMPLEMENTED · PENDING
  VERIFICATION**.
- Do **not** write "the system now does X" until the implementation is actually verified.
- After implementation, update the document to CURRENT facts.

Never present: planned behaviour as implemented · legacy JEX behaviour as current refactor behaviour ·
a test plan as a successful test result · an assumed root cause as a verified root cause. This is the
same discipline the five-word status vocabulary already enforces — **CURRENT is a promise.**

### 9e · Legacy / JEX parity work

A parity record must clearly distinguish four things:

1. Legacy JEX behaviour.
2. Current refactor behaviour **before** the fix.
3. Target parity behaviour.
4. Actual corrected behaviour **after** implementation.

Do not simply write "matched legacy" — record **what was actually compared** (the JEX screen/`_view.jsp`
citations, the observed live-system behaviour, the columns, the states exercised).

If the task is a **point-in-time parity audit** rather than implementation work, it belongs under
[docs/audits/](docs/audits/) using the same `descriptive-name-YYYY-MM-DD.md` filename, and is
`HISTORICAL` per the status vocabulary.

### 9f · Cross-repository change (API + WEB)

If the task affects **both** `wecms-api` and `wecms-web`, create the appropriate dated record in
**both** repositories **before** modifying either side's application code — this is the documentation
half of the full-stack ownership rule (see "Scope Rule" under [WeInvoice Project Rules](#weinvoice-project-rules)).

| Repository | Path | Record focus |
|---|---|---|
| `wecms-web` | `docs/bugs/` (BUG) · `docs/issues/` (ISSUE) | UI behaviour · user inputs · frontend validation · API consumption · loading / error / result behaviour · frontend tests |
| `wecms-api` | `docs/bugs/` (BUG) · `docs/issues/` (ISSUE) | backend rule · business rules · endpoint · request/response · validation · database / integration behaviour · backend tests |

Use the same descriptive subject and date on both sides where appropriate, and cross-link the two
records where the sibling repository is available — per the out-of-repo link rule, make the cross-link
recognizable as out-of-repo (carry the `wecms-api/…` prefix in the link text or say "backend" in the
prose). **Do not** copy frontend component details into the backend record, and **do not** copy backend
implementation internals into the frontend record.

**Cross-repo audits:** prefer the repository that owns the primary audit scope. If both sides need
their own audit evidence, create scoped audit records in both repositories' `docs/audits/` and
cross-link them.

**Authority rule:** frontend UI / interaction / API consumption → `wecms-web`; backend business / API /
database behaviour → `wecms-api`.

### 10 · Exceptions — no new dated record normally required

- spelling-only documentation fix
- formatting-only change
- comment-only change
- import ordering
- lint-only change
- generated-file refresh
- lockfile-only noise
- mechanical filename / path rename with no behaviour change
- **purely cosmetic CSS change with no interaction / behaviour impact**
- temporary local debugging that will not be committed

**However:** if any of these makes existing documentation inaccurate, update the affected
documentation. And if a supposedly mechanical or "purely cosmetic" change turns out to alter behaviour,
the docs-first rule applies.

The same list exempts these changes from the **quality gate (§14)** — a comment-only edit needs no
regression test, no DB verification, and no security review. The exemption travels with the change, not
with the developer: the moment a "purely cosmetic" change turns out to alter behaviour, **both** §1–§13
and §14 apply to it in full.

### 11 · Documentation validation before declaring complete

- Verify the dated record exists.
- Verify `Status:` is correct.
- Verify the permanent feature docs are still accurate.
- Verify internal links resolve, including moved / renamed doc references.
- Verify cross-repo doc links where relevant.

Run the existing link checker:

```bash
node scripts/check-doc-links.mjs
```

Green means in-repo broken = 0, out-of-repo broken = 0, unsafe = 0. Out-of-repo links into
`../wecms-api/` or the workspace root are a documented **dependency**, never a failure — do not
"fix" them by deletion. Expected result: **0 broken documentation links.**

### 12 · Who must follow this — team rule, and how tools enforce it

#### 12a · Team governance — all developers

**Every developer contributing a meaningful behaviour-changing change to WeCMS must follow
docs-first.** This covers **BUG · ISSUE · FEATURE · AUDIT / PARITY / INVESTIGATION · behaviour change ·
business-rule change · API behaviour change · UI behaviour change · integration behaviour change ·
functional refactor · SIT/UAT/PROD behaviour fix · legacy/JEX parity fix.**

It applies regardless of *how* the change is implemented — **manually by a developer, Claude Code,
Cursor, another AI coding assistant, IDE tooling, scripts, or pair programming.**

**No developer is exempt because:**

- they did not use Claude or any AI assistant,
- the change is on their own branch,
- the implementation is small but behaviour-changing,
- the code is frontend-only,
- the code is backend-only.

**Documentation is a project requirement, not an AI requirement.** A change that is technically correct
but undocumented is **incomplete under project governance**.

#### 12b · Responsibility — and one canonical record per task

**The developer who starts the change is responsible for making sure the dated record exists before
the detailed investigation begins — and therefore before code implementation.** The required sequence (identical to §2, restated here as the team
contract):

```
1. Orient ONLY — enough to classify the task and place its record (§2a).
   NOT the investigation: no fault tracing, no root cause yet.
2. Create the appropriate dated record BEFORE the detailed investigation, and
   verify the file exists  (docs/bugs/ · docs/issues/ · docs/audits/;
                                         features keep docs/features/<domain>/<feature>/)
3. Set Status: IN PROGRESS.
4. Record current behaviour, target behaviour, scope, plan and testing plan.
5. Implement the change.
6. Update the SAME record with the actual implementation and test results.
7. Update permanent feature docs when current behaviour changes.
8. Validate documentation links.
9. Change Status to COMPLETE / CLOSED / PARTIAL / BLOCKED.
```

**One task → one canonical record per affected repository.** The document belongs to the **task**, not
to the developer. If Developer A starts a task and Developer B continues it, **B updates the same
record**:

```
✅  docs/bugs/payment-timeout-fix-2026-08-17.md          ← one record, both developers update it

❌  docs/bugs/payment-timeout-fix-dev-a-2026-08-17.md
❌  docs/bugs/payment-timeout-fix-dev-b-2026-08-17.md
```

Never name a record after a person (`dev-a-fix.md`, `sokny-fix.md`, `mr-kang-update.md`) or after an
internal work code (`a1-01-fix.md`, `p0-fix.md`, `task-03.md`, `final-fix.md`) — see §5 and §7. The
ticket ID goes in the metadata (`**Issue:** PAY-123`).

#### 12c · Multiple developers / parallel work

- **Check whether a record already exists for the task before creating another one.**
- **Update the existing record** when the scope is the same.
- **Create a separate record only when the work is genuinely a separate task.**
- **Avoid duplicate bug/issue records describing the same fix.**
- If two branches modify the same record, **resolve it like source code** during merge/rebase. **Never
  silently drop another developer's documentation updates** — merge them.

#### 12d · AI governance — Claude Code, Agents, and other assistants

AI tooling **enforces the team rule automatically**; it does not own it. When asked to **fix ·
implement · change · update · resolve · add a feature · change business behaviour · change UI
behaviour · change API behaviour · fix parity**, Claude must **not** start editing application code
immediately. Claude must first:

1. orient in the implementation and the docs **only far enough to classify the task** — this is not
   the investigation (§2a),
2. determine the governed location (§4),
3. create the dated Markdown implementation record (or **update the existing one** for this task, per
   §12b–12c) — **then verify the file exists on disk and report its path**,
4. set `**Status:** IN PROGRESS`,
5. document what is known so far — an unknown root cause is `Pending investigation`, never a reason to
   postpone the record — **and only now begin the detailed investigation, writing findings into that
   same record** (§2a),
6. **then** begin application-code modification — **but only when the request actually carries
   implementation intent.** The verbs listed above (*fix · implement · change · resolve · add*) do; a
   request only to **check · investigate · review · audit · analyze · design** does **not**. For those,
   step 6 is replaced by *stop and present the findings for human approval* — **§16**.

Claude must **not** ask *"Do you want me to document this?"* for a clearly meaningful behaviour
change. **Documentation is mandatory by default** — for the human developer and for the assistant
alike. The same expectation applies to Agents-harness sessions, Cursor, and any other AI coding
assistant used on this repository.

**And Claude must not stop when the code is written.** The implementation quality gate (§14) is part of
the same obligation: review the diff, add/run the tests the change warrants, verify API-consumption /
UI / DB-dependency / security / parity impact, update the docs and test scenarios, report failures
honestly, and only then set a final status. The AI-specific form of that rule is **§14w**.

**Equally, Claude must not carry on past the handover point.** Commit, push, merge, rebase onto a
shared branch, tagging, and any deployment or environment promotion are **manual** team actions —
**§15**. That is sharper here than in most repositories: pushing `sit` or `uat` **triggers the
deployment pipeline**. The assistant stops at `READY FOR MANUAL COMMIT` unless the user explicitly
asks, in the current conversation, for one specific Git operation (§15c).

**And Claude must not treat an investigation as its own authorization.** When the request was to
*check · investigate · review · audit · analyze · design*, the work ends at the documented findings and
a **human decides** whether implementation proceeds — **§16**. Finding the root cause is not permission
to fix it, and *"OK"* / *"thanks"* / *"looks good"* is not an approval (§16e).

This sits alongside — and does not weaken — the rules that still apply first: the Scope Rule
(frontend tasks update **only** this repository; the backend is touched only on an explicit
backend request), the Figma-first rule (`get_design_context` + `get_screenshot` before the plan when a
Figma URL is given), and reuse-before-create. When a Figma read or an approval gate applies, the dated
record is the natural place to capture what was read and what was decided.

#### 12e · Code review / merge expectation

For a meaningful behaviour-changing change, **reviewers verify**:

```
[ ] the required dated record exists
[ ] it was created for the correct task / repository
[ ] the final implementation is documented
[ ] test results are recorded — as real outcomes, not as a restated test plan
[ ] permanent feature docs are updated if needed
[ ] no .sql file has been added to this repository, and any DB dependency is
       declared with a cross-link to the backend record (§12g)
[ ] links are valid
[ ] Status is not incorrectly left IN PROGRESS — and not COMPLETE while a
       depended-on backend DB change is unapplied in the target environment
```

**Plus the implementation quality gate.** The full reviewer checklist for a meaningful change — diff
scope, self-audit, regression risk, tests added (and placed where Vitest collects them) and executed,
test scenarios, API contract, frontend/backend alignment, DB dependency, security, parity,
documentation, honest final status — is **§14v**. Review both lists together; they are one Definition
of Done, not two.

A code change may be technically correct and still **incomplete under project governance** if the
required documentation is missing. This is a **review expectation**, deliberately *not* a CI gate —
[.gitlab-ci.yml](.gitlab-ci.yml) is a downstream trigger only and enforces nothing here.

#### 12f · Branch and environment independence

The rule applies on **local development · feature branches · the `sit` and `uat` branches · PROD
hotfixes** alike. **A SIT/UAT/PROD hotfix is NOT exempt** — and since this project really deploys from
`sit` / `uat` (see §Purpose → Deployment status), that is not a hypothetical.

**Emergency exception (narrow, and explicitly labelled).** If operational urgency genuinely forces the
implementation to land before the record:

- create the record **as soon as operationally possible**,
- state plainly that **emergency implementation preceded the record**,
- explain **why**,
- **complete the documentation before the change is considered closed.**

**Do not normalize emergency-first coding as the standard workflow** — it is an exception to be
justified in the record, not a second accepted path.

### 12g · Database dependency — no SQL in this repository

**Added 2026-08-17.** Database change artifacts are **backend-owned**. `wecms-web` never carries SQL.

- **Do not add `.sql` files to this repository** — no migration files, no manual DBA scripts, no
  seed/backfill scripts. They live in `wecms-api` (`src/main/resources/db/migration/` for a new table or
  new DB function; `docs/sql/<YYYY>/` for existing-table changes, indexes, constraints, and any data
  change). Authoritative rule: `wecms-api/CLAUDE.md` §14 *(backend — separate repository)*.
- **Do not embed executable SQL in a frontend record** to "document" the backend change.
- A frontend record documents DB impact **only to the depth needed to explain the frontend
  dependency** — which field/endpoint the UI needs, and that it is blocked until the backend change
  exists. State it explicitly:

  ```markdown
  ## Database Impact

  NONE (frontend) — database dependency only.

  Database dependency: see the related backend record
  wecms-api/docs/bugs/recipient-name-resolution-fix-2026-08-17.md
  (new column + backfill; prepared as a manual DBA script on that side).
  ```

- Cross-link the paired backend record per §9f, and keep the link recognizable as out-of-repo.
- **A frontend task is not `COMPLETE` while the backend DB change it depends on is unapplied in the
  target environment.** Use `PARTIAL` / `BLOCKED` / `READY FOR DEPLOYMENT` and say which environment is
  waiting — do not claim verified SIT/UAT behaviour before the backend execution has actually happened.
- Frontend developers do **not** execute database changes. Preparing or reviewing SQL is never
  execution, and an AI assistant never executes shared-environment SQL.

### 13 · Blocked / partial / abandoned work

If implementation does not complete, **do not delete the dated record.** Set `Status: BLOCKED` or
`Status: PARTIAL` and record: what was attempted · investigation findings · what was implemented ·
what was **not** implemented · why work stopped · which decision or dependency is required. This
preserves engineering history. A knowingly-deferred issue you are *not* fixing still also belongs in
[docs/tech-debt.md](docs/tech-debt.md).

### 14 · Implementation quality gate — verify before COMPLETE (MANDATORY)

**Added 2026-08-18. Applies to every BUG · ISSUE · FEATURE · PARITY FIX · behaviour change ·
business-rule change · API change · UI-behaviour change · integration change · functional refactor —
for every developer and every tool.** This section adds the **verification pass** that closes the
docs-first loop. It does not restate §1–§13: placement, filenames, templates, the team rule, and the
database-dependency rule (§12g) stay exactly where they are and are read first.

> **Code implementation is not the end of the task.** A meaningful task is not complete when the app
> compiles, when the page renders once, or when the diff "looks right". It is complete when the change
> has been **audited against its own diff, tested, verified, and honestly reported**.

**Required lifecycle:**

```
DOCS-FIRST RECORD → implementation → implementation self-audit → tests
  → test scenarios → regression review → DB verification (if applicable)
  → security / permission verification (if applicable) → documentation update
  → final evidence → COMPLETE
```

Every individual check below is **REQUIRED WHEN APPLICABLE** (§14x). The gate itself is never optional;
the depth of each check is chosen by risk.

#### 14a · Team scope — one Definition of Done for everyone

This quality gate applies equally to **Cambodia developers · Vietnam developers · Korea developers ·
any other current or future WeCMS contributor**, and regardless of how the implementation was
performed — **manually · Claude Code · Cursor · another AI assistant · IDE tooling · scripts · pair
programming.**

**No country, team, vendor, or individual may operate a weaker Definition of Done for these
repositories.** Teams may hold different *operational* responsibilities — who executes DB SQL in UAT or
PROD, who runs the SIT cycle, who signs off UAT — but the **implementation-quality expectation is
shared and identical**. This is a **project quality rule**, not an AI rule; §12a states the team
governance for documentation, and this section states it for verification.

#### 14b · Implementation self-audit — review the actual diff

After the code changes and **before** declaring anything done, audit the implementation **from the
current diff and the current source** — not from the original ticket description, and not from memory
of what was intended.

```bash
git status
git diff
git diff --stat
```

Check for:

```
[ ] requirement not fully implemented
[ ] behaviour outside the requested scope
[ ] accidental unrelated changes
[ ] duplicated logic (a shared component / hook already does this)
[ ] stale / dead code introduced
[ ] incorrect null / undefined handling
[ ] incorrect error handling
[ ] incorrect API mapping (path, method, request body, unwrap())
[ ] incorrect field casing (wire = lowercase snake_case; UI layer = camelCase —
       translated at the boundary exactly once, see §"API Naming & Serialization Standards")
[ ] incorrect validation
[ ] broken permission visibility (menu / action gating)
[ ] broken tenant / company scope assumptions
[ ] state / effect / race risks (stale closures, unguarded async setState, double-submit)
[ ] frontend ↔ backend mismatch
[ ] DB assumptions not backed by the backend contract
[ ] legacy / JEX parity mismatch where relevant
[ ] hard-coded values (labels that belong in locales, sizes that belong in tokens,
       URLs / ids that belong in configuration)
[ ] temporary debugging code
[ ] console / debug logging left behind
[ ] TODO / FIXME added without a documented follow-up
[ ] secrets or credentials in code, config, or docs
[ ] unsafe destructive behaviour
```

Findings that matter are recorded in the dated record — fixed, or explicitly deferred with a reason.
This audit is also where `feedback_preserve_existing_code` is enforced: **anything in the diff that the
task did not ask for is a finding**, not a bonus.

#### 14c · Test requirement — decide what is appropriate, then do it

For every BUG / ISSUE / FEATURE, **decide** which automated tests the change warrants, and say so in
the record. Candidates in `wecms-web`:

| Test kind | Typical shape in this repository |
|---|---|
| **Unit test** | a pure function in `lib/` (formatting, parsing, cut-off rules) |
| **Component test** | React Testing Library render + interaction assertions |
| **Hook test** | the hook exercised through a host component or a `lib/`-side helper — **see the include-glob trap below** |
| **Mapper / helper test** | the snake_case ↔ camelCase boundary, row builders, export shaping |
| **Validation test** | client-side rules and their messages |
| **API-client test** | request shape, `unwrap()` handling, error path |
| **Regression test** | a test that pins the exact behaviour a bug fix restored (§14d) |

> ⚠️ **The include-glob trap — a test in the wrong folder passes by never running.**
> [`vitest.config.ts`](vitest.config.ts) collects **only** `components/**/*.test.{ts,tsx}` and
> `lib/**/*.test.{ts,tsx}`. A test placed in `hooks/`, `app/`, or at the repository root is **silently
> skipped**. Either colocate the test under `components/` or `lib/`, or extend `include` in the same
> MR that adds the test. Full detail: [docs/testing/testing-strategy.md](docs/testing/testing-strategy.md).

**Do not create meaningless tests to raise a count.** A test must prove the behaviour that changed, and
must assert **observable behaviour** — rendered output, calls made, values emitted — not internal
structure. Prefer `vi.mock(path, async (importOriginal) => ({ ...(await importOriginal()), fn: spy }))`
over a bare factory: a bare `vi.mock` factory is a whitelist, and it is exactly what left 11 tests
failing in this repository.

#### 14d · Bug-fix regression rule

A bug fix **normally includes a regression test** whenever the behaviour can be tested automatically.
Work through these four questions explicitly:

1. Can the original bug be **reproduced** in a test?
2. Does that test **fail before** the fix?
3. Does it **pass after** the fix?
4. Does it **protect against recurrence** — pinning the behaviour, not the implementation detail?

The record carries the outcome:

```markdown
## Regression Test

Test file:          components/<area>/<Name>.<behaviour>.test.tsx
Test case:          <describe / it name>
Behavior protected: <the exact behaviour that must never regress>
```

If an automated regression test is genuinely **not practical** — the behaviour needs a real backend, a
real browser, an NXiSAS engine, a bank gateway, or an environment this repository cannot reach —
**explain why** and supply manual / test-scenario evidence instead.

**"No test needed" without justification is not acceptable.**

#### 14e · Feature verification

For a new feature, verify the scenarios that actually apply — choose from:

- happy path · validation · empty state · error state · **loading state**
- permission / authorization visibility · boundary values
- API failure handling · duplicate / retry behaviour (double-submit guards)
- database-dependent behaviour (via the backend contract) · **localization EN / KO / VI**
- concurrency / idempotency where relevant

**Do not paste the same checklist onto every feature.** A read-only export screen has no duplicate/retry
dimension; a static panel has no concurrency dimension. Pick what the feature actually has.

#### 14f · Test scenarios — permanent behaviour vs this change

Every documented screen carries a permanent `test-scenarios.md` in its 6-doc set
(`docs/features/<domain>/<feature>/test-scenarios.md`). These manual scenarios remain the **primary
verification mechanism for this frontend** — the automated suite is a thin regression net beneath them
([docs/testing/testing-strategy.md](docs/testing/testing-strategy.md)).

- When a change alters **permanent screen behaviour**, **update the relevant
  `docs/features/**/test-scenarios.md`** so the scenarios describe the *final* behaviour.
- The **dated bug / issue record** carries only the **implementation-specific verification evidence**
  for this change.
- **Do not duplicate a long scenario suite in both places.** Permanent scenarios live in
  `test-scenarios.md`; the dated record links to it.
- **A scenario listed in `test-scenarios.md` is not evidence that an automated test covers it** — the
  two layers are distinct, and the record must not blur them.

This is the same separation as §8 (dated record = *why it changed*; feature docs = *how it works now*),
applied to verification.

#### 14g · The record's `## Verification` section

Every BUG / ISSUE dated record ends with a verification section. Use only the applicable subsections:

```markdown
## Verification

### Automated Tests

- Test:    <file / test name, or the command run>
- Result:  PASS | FAIL | NOT RUN | BLOCKED | NOT APPLICABLE

### Test Scenarios

- Scenario: <what was exercised>
- Expected: <expected observable behaviour>
- Actual:   <observed behaviour>
- Result:   PASS | FAIL | NOT RUN | BLOCKED | NOT APPLICABLE

### Regression Review

- Areas checked: <sibling screens, shared components/hooks, View Setting, exports, permissions>
- Result:        <what was confirmed unaffected, and how>

### Manual Verification

- Environment: LOCAL | SIT | UAT | PROD
- Steps:       <what was actually done in the running app>
- Result:      PASS | FAIL | NOT RUN | BLOCKED | NOT APPLICABLE
```

*(This section supersedes the older single `## Test Results` heading in the §9a / §9b templates.
Existing records that already use `## Test Results` keep it — do not rewrite history; new records use
`## Verification`.)*

**Never mark `PASS` without evidence.**

**For a meaningful change whose verification actually ran, this section is the *summary*, not the whole
evidence story.** The durable detail — commands, counts, environment, build under test, per-scenario
outcomes, pre-existing vs new failures — goes into a **test-result record** at
`docs/testing/results/descriptive-name-test-result-YYYY-MM-DD.md`, and the implementation record adds a
**`## Test Evidence`** section linking to it (**§17**). Keep `## Verification` short and let the link
carry the detail; do not duplicate the whole result document here.

#### 14h · Test-result honesty

**Never report `PASS`, `SUCCESS`, or `COMPLETE` for a test that was not executed.** The permitted
states are:

`PASS` · `FAIL` · `NOT RUN` · `BLOCKED` · `NOT APPLICABLE`

```
Automated test:      NOT RUN — environment unavailable
SIT verification:    BLOCKED — DBA script not applied
Regression test:     PASS — 14/14 tests
```

**A planned test case is not a test result.** This is §9d's planned-vs-current rule — and the
*"CURRENT is a promise"* discipline of the status vocabulary — applied to verification.

#### 14i · Run the existing suite

Before completing the implementation, run the tests that actually cover the change:

```bash
npm test                                  # → vitest run (the only test script)
npx vitest run components/<area>          # targeted — start here
```

`npm test` is the only script in [`package.json`](package.json); there is no `test:watch`,
`test:coverage`, `test:e2e`, or `test:ci`. **There is no CI test stage** —
[`.gitlab-ci.yml`](.gitlab-ci.yml) is a downstream trigger and runs no lint, type-check, or test job —
so running the suite is a **manual developer responsibility** and nothing blocks a red suite from being
merged or deployed.

Run the **smallest scope that proves the change** first; then, before final completion, consider whether
a broader run is justified — it usually is for shared components, hooks, the API client layer, View
Setting, exports, and permission gating.

**Report exactly what was run** — the command and the observed counts, not "tests pass".

#### 14j · When tests fail

**Do not hide, skip, or quietly delete a failing test.** Classify it:

| | Classification | What it means for this task |
|---|---|---|
| **A** | **Caused by this change** | The task is **NOT COMPLETE**. Fix it. |
| **B** | **Pre-existing** | Record the failing test and the evidence that it predates this work, and whether the change is still safe to merge. |
| **C** | **Environment / infrastructure** | Record it as `BLOCKED` with the cause; do not claim `PASS`. |
| **D** | **Test-data / mock problem** | Record it; fix only if it is in scope (a stale `vi.mock` factory is the classic case here). |
| **E** | **Unresolved** | Say so plainly and record it as a follow-up. |

> **Suite status (2026-11-03):** green — 3 files, 18 tests
> ([docs/testing/testing-strategy.md](docs/testing/testing-strategy.md)). Any failure that predates a
> change is **category B** for that change: cite it, do not claim a green suite, and do not silently
> "fix" it inside an unrelated MR.

**Do not auto-fix unrelated failures.** Per `feedback_preserve_existing_code`, repair an unrelated
failure only when it genuinely blocks the requested work **and** the widened scope is approved —
otherwise record it.

#### 14k · API-consumption verification

For a change that touches how this app talks to `wecms-api`, verify what applies:

- endpoint path · HTTP method · request body / query params (**lowercase snake_case on the wire**)
- required-vs-optional fields and client-side validation
- response envelope handling through the shared `unwrap()`
- response field names, types, and nullability the UI actually reads
- error codes / messages and how they surface to the user
- authorization headers · 401 handling · tenant / company scope
- pagination (`page` + `size`, zero-based) · filtering / sorting params
- file download / upload behaviour

**Verify the API ↔ WEB contract against the backend**, not against an assumption — the field the UI
reads must be the field the endpoint emits (§14r). Until the WeInvoice API contract is published, the
contract is the function signatures in `lib/api/weinvoice/*`.

#### 14l · UI verification

For frontend changes, verify what applies:

- route · screen · component behaviour
- **loading state** · **empty state** · error handling · success behaviour
- validation · disabled / enabled state
- dialog / popup behaviour · navigation
- permission visibility (what a USER sees vs an ADMIN)
- responsive behaviour where relevant (**desktop-first** — `feedback_desktop_first_ui`)
- **localization EN / KO / VI** where the change touches text
- the **actual API request the UI generates** (method, URL, params, body)

> **Do not claim visual verification if the UI was not actually run and inspected.** "The code should
> render X" is a plan, not a result — record it as `NOT RUN` and say why, or run the app and record what
> was seen.

#### 14m · Database verification — dependency only

`wecms-web` owns no database artifacts (§12g). The DB half of this gate is therefore:

```
[ ] ## Database Impact declares the dependency accurately
      (NONE (frontend) — database dependency only, plus the cross-link)
[ ] the paired backend record exists and is linked, and its own DB gate is satisfied
      (wecms-api/CLAUDE.md §14 / §15m — separate repository)
[ ] the required backend DB execution has actually happened in the environment
      being claimed as verified
[ ] no .sql file has been added to this repository
```

**A frontend task is not `COMPLETE` while the backend DB change it depends on is unapplied in the
target environment** — use `PARTIAL` / `BLOCKED` / `READY FOR DEPLOYMENT` and name the environment.
Frontend developers do not execute database changes, and an AI assistant never executes
shared-environment SQL.

#### 14n · Audit / parity verification

When the task requires legacy / JEX parity, verify against **actual legacy evidence** and state the
four-way comparison §9e already requires:

```
Legacy JEX behaviour        →  what was read (JSP file:line, the rendered legacy screen, columns, rows)
Refactor behaviour BEFORE   →  what the refactor did
Target behaviour            →  what parity requires
Final implemented behaviour →  what it does now, and how that was confirmed
```

**"Parity confirmed" without naming what was compared is not verification.** If the task is a formal
point-in-time audit rather than implementation work, it belongs in
[docs/audits/](docs/audits/README.md) as `descriptive-name-YYYY-MM-DD.md` under the existing audit
governance (§4).

#### 14o · Security / permission verification

Perform an explicit security review when the change touches **authentication · authorization ·
permissions · user / role access · R/D/T permission · JWT · cookies · sensitive information · file
access.**

On this side that means, at minimum: what a lower-privileged role can see and click, whether a hidden
control is actually unreachable (hiding a button is not authorization — the backend gate is), whether a
token or sensitive value can reach `localStorage`, a URL, a log, or a screenshot, and whether an error
message leaks internals to the user.

Check the **relevant scope only** — do not turn a small bug into a full application security audit.
Record meaningful findings; a finding with no fix in this task becomes an explicit follow-up.

#### 14p · Performance / concurrency verification

Review performance and concurrency impact when the change touches **large lists · large Excel
files / exports · repeated or fan-out requests · retry · polling · parallel requests · effects that
refetch · anything rendering thousands of rows.**

Where relevant, verify: duplicate execution (double-submit, effect firing twice) · race conditions and
stale responses overwriting fresh state · retry behaviour · request count (an N+1 in the UI is a real
N+1) · large-memory behaviour in the browser.

**Do not demand performance testing for an unrelated simple fix.**

#### 14q · Error-handling verification

Verify the changed code does **not**:

- swallow errors
- expose sensitive detail in a message, a toast, or the console
- return or display a misleading success
- convert a partial failure into an all-success result
- silently ignore an API failure
- **leave a loading state stuck** — every async path resets its spinner / disabled state on failure
- produce an incorrect fallback (an empty state shown where an error occurred is a lie to the user)

Check both the expected error paths and the unexpected-failure path where relevant.

#### 14r · Cross-repository verification

When work changes **both** `wecms-web` and `wecms-api`, verification covers **both sides** — §9f is the
documentation half of this rule, and this is the verification half:

| Side | Verifies |
|---|---|
| Frontend developer / team | UI behaviour · API consumption · frontend tests · user-visible result |
| Backend developer / team | backend logic · API contract · database · backend tests |

Then verify the integration end-to-end:

```
wecms-web request → wecms-api handling → DB / integration → response → UI result
```

**The overall task is not `COMPLETE` because only one repository is green.** Each record states its own
side's status and cross-links the other.

#### 14s · Git-diff review before completion

Before final completion, run and read `git status`, `git diff`, and `git diff --stat`, and confirm the
changed files match the requested scope. Identify and deal with:

- accidental files · temporary files · generated files (`.next/`, build output)
- local configuration · secrets · debug files
- unrelated refactors

**Do not silently include unrelated work in the implementation record** — either take it out of the
change, or declare it in the record.

#### 14t · Documentation review

Documentation is part of the quality gate, not a postscript. Before completion verify:

```
[ ] the dated implementation record is updated and reflects the final behaviour
[ ] Status is correct and honest
[ ] the screen's permanent 6-doc set reflects current behaviour (§8)
[ ] docs/features/**/test-scenarios.md updated where permanent behaviour changed (§14f)
[ ] the API-consumption contract reference is still accurate
[ ] the backend cross-link resolves and is recognizable as out-of-repo (§12g, §9f)
[ ] node scripts/check-doc-links.mjs is green — 0 broken (§11)
```

#### 14u · Final status — honesty rule

Use **`COMPLETE` only when every REQUIRED part of the task is actually done.** Otherwise use
`READY FOR MANUAL COMMIT` · `PARTIAL` · `BLOCKED` · `READY FOR DEPLOYMENT` · `READY FOR SIT`, or
another already-approved state.

```
Code complete · Tests PASS · backend DB script prepared · UAT DB not applied
   →  PARTIAL / BLOCKED               — NOT "COMPLETE"

Code complete · unit tests PASS · required SIT verification not performed
   →  PARTIAL / READY FOR SIT         — NOT "COMPLETE"

Code complete · UI never actually run
   →  the UI checks are NOT RUN       — do not claim visual verification

Code complete · Tests PASS · docs updated · nothing else pending
   →  READY FOR MANUAL COMMIT         — NOT "COMMITTED" / "PUSHED" / "DEPLOYED"
```

**`Test Status` is part of the decision, not a footnote.** `Implementation Status: COMPLETE` requires
test evidence that supports it, recorded in a test-result record (§17h). If tests fail, the honest pair
is `Test Status: FAIL` + `Implementation Status: BLOCKED` / `PARTIAL` — never `COMPLETE`.

This extends §13 (blocked / partial work) and §12g (unapplied backend DB change) across the whole
verification pass. **`READY FOR MANUAL COMMIT` is the normal terminal state of AI-assisted work** — Git
and deployment actions are manual (§15), and `PUSHED` · `MERGED` · `DEPLOYED` · `SIT COMPLETE` ·
`UAT COMPLETE` · `PROD COMPLETE` are only ever reported for actions the responsible team actually
performed and verified.

#### 14v · Reviewer checklist — meaningful changes

For a meaningful behaviour-changing change, the reviewer verifies:

```
[ ] docs-first record exists
[ ] requirement matches implementation
[ ] Git diff matches scope
[ ] code self-audit completed
[ ] regression risk reviewed
[ ] automated tests added / updated where appropriate
      — and placed where Vitest actually collects them (components/ or lib/)
[ ] relevant tests executed — and what was run is stated
[ ] test scenarios updated where permanent behaviour changed
[ ] API contract verified where applicable
[ ] frontend / backend alignment verified where applicable
[ ] DB impact verified (dependency declared; backend execution actually done)
[ ] security / permissions reviewed where applicable
[ ] legacy parity verified where applicable
[ ] permanent documentation updated
[ ] remaining limitations explicitly documented
[ ] final status is honest
[ ] no commit / push / merge / tag / deployment was performed automatically —
      the change arrives at READY FOR MANUAL COMMIT for a human to take
      forward, and pushing sit / uat stays a human release decision (§15)
[ ] the required test-result Markdown exists (§17)
[ ] it links to the correct BUG / ISSUE / FEATURE record
[ ] the implementation record links back to it (## Test Evidence)
[ ] actual test commands and results are recorded — not a restated plan
[ ] PASS appears only for checks that were executed
[ ] regression coverage is documented for bug fixes (YES/NO + detail — §17f)
[ ] failed and not-run tests are visible, not omitted
[ ] the final implementation status agrees with the test evidence (§17h)
```

This is a **team review / governance expectation, deliberately NOT a CI gate** — the same stance as
§12e, and consistent with the fact that `.gitlab-ci.yml` runs no test job here.

#### 14w · AI enforcement

Claude Code and every other AI assistant **enforce this same team rule**; they do not own it, and they
do not get a lighter version of it. When an AI assistant implements a bug / issue / feature, it **must
not stop after editing files**. It must:

1. review the implementation diff (§14b, §14s),
2. identify the test coverage the change needs (§14c–§14e),
3. add / update tests when that is within the requested implementation scope,
4. run the relevant tests where the tools and environment permit (§14i),
5. update test scenarios (§14f),
6. verify API / UI / DB impact (§14k–§14m),
7. perform the relevant regression review,
7b. **capture the actual results in a test-result record** at `docs/testing/results/` and link it from
    the implementation record's `## Test Evidence` (§17) — *"all tests passed"* without recording what
    actually ran is not an acceptable report,
8. update documentation (§14t),
9. report failures honestly (§14h, §14j),
10. determine the final status (§14u),
11. and **stop at `READY FOR MANUAL COMMIT`** — never commit, push, merge, tag, or deploy on its own
    initiative, and never push `sit` / `uat` (which deploys) without an explicit request (§15).

**"Done" because the code compiles or because files were edited is not an acceptable report.** If a
required check could not be run — the app was never started, the backend was unavailable, the suite was
not executed — the assistant names which one and why (`NOT RUN` / `BLOCKED`) rather than implying it
passed. And a finished task is **handed over**, not shipped: the Git and deployment steps belong to the
developer or the team (§15).

#### 14x · Risk-based verification — do not over-test

The gate is mandatory; the individual checks are **REQUIRED WHEN APPLICABLE**. Match depth to risk:

| Change | Proportionate verification |
|---|---|
| A CSS / label / typo fix | No DB audit, no security audit, no load testing. Confirm the rendered result and move on. |
| A payment-approval or dispatch-triggering UI change | Component + API-client tests · double-submit / idempotency review · permission review · backend contract check · regression scenarios. |

**Do not generate boilerplate checks that say nothing.** A checklist filled with "N/A" on every line is
noise — state the two or three checks the change actually needed, and their real outcomes.

### 15 · Manual Git & deployment rule — the workflow ends at READY FOR MANUAL COMMIT (MANDATORY)

**Added 2026-08-18. Applies to every developer and every tool, in both `wecms-web` and `wecms-api`.**
This section governs *who performs Git and deployment actions*. It does not restate §1–§14 — docs-first,
the database-dependency rule, and the quality gate are read first and are unchanged.

> **Git commit, push, merge, and environment promotion are human-controlled steps.** The AI-assisted
> workflow **ends at `READY FOR MANUAL COMMIT`** — never at `COMMITTED`, `PUSHED`, or `DEPLOYED`.

> ⚠️ **In this repository a push IS a deployment.** [.gitlab-ci.yml](.gitlab-ci.yml) runs on the `sit`
> and `uat` branches and triggers the downstream build/deploy pipeline (see §Purpose → *Deployment
> status*). `git push origin sit` and `git push origin uat` are therefore **release actions against
> real environments**, not ordinary Git operations — they are manual, deliberate, human decisions.

#### 15a · What an AI assistant must NOT do automatically

Claude Code, Agents, Cursor, or any other AI assistant must **not** perform any of the following on its
own initiative — not to "finish the task", not to "tidy up", not because the quality gate passed:

```
[ ] git commit
[ ] git push
[ ] git merge
[ ] git rebase onto a shared branch
[ ] create or push tags
[ ] push to sit          ← triggers the SIT deployment pipeline
[ ] push to uat          ← triggers the UAT deployment pipeline
[ ] push to prod / any production branch
[ ] trigger a deployment
[ ] promote code between environments
[ ] execute any release / deployment command
```

Read-only inspection is expected and encouraged — `git status`, `git diff`, `git diff --stat`,
`git log`, `git branch` are part of the quality gate (§14b, §14s) and are **not** covered by this
prohibition. The line is between **observing** the repository and **changing its shared history or a
running environment**.

**This is not a Claude-only restriction.** It is a project rule about *who owns the action*: the
developer or the team owns it, whatever tool is in the room.

#### 15b · Standard flow — where the AI stops and the human starts

```
Requirement
  → BUG / ISSUE / FEATURE classification            (§4)
  → documentation FIRST                             (§2)
  → DB-impact check                                 (§12g — dependency only on this side)
  → implementation
  → self-audit                                      (§14b)
  → automated tests                                 (§14c–§14e, §14i)
  → test scenarios                                  (§14f)
  → regression verification                         (§14j)
  → API / UI / DB / security / performance checks    (§14k–§14p, when applicable)
  → permanent documentation update                  (§14t)
  → reviewer quality gate                           (§14v)
  → READY FOR MANUAL COMMIT     ← the AI-assisted workflow ends HERE
```

Everything after that line is performed **manually by the developer or the team**:

```
Developer / team manually:
  → reviews git status / git diff
  → stages the intended files
  → commits
  → pushes the intended branch
  → merges according to team process
  → promotes / deploys to SIT / UAT / PROD
```

At `READY FOR MANUAL COMMIT` the assistant's job is to **hand over cleanly**: say which files changed,
what the verification produced, and what remains — not to take the next step.

#### 15c · Explicit user request — the only exception

If the user **explicitly asks in the current conversation** for a specific Git operation — *"commit
this"*, *"push this branch"*, *"merge this branch"* — the assistant may assist with **exactly that one
operation**, subject to every safety rule already in force (branch protection, the workspace root
[CLAUDE.md](../CLAUDE.md) rules, and the harness permission prompts).

**The permission is narrow and does not travel:**

- It covers **the operation actually named**, not the ones that usually follow it. "Commit this" is not
  permission to push. "Push this branch" is not permission to merge or to promote.
- It covers **this conversation and this request**, not the rest of the session and not the next task.
- **SIT / UAT / PROD deployment and promotion stay manual regardless** — unless repository governance
  explicitly permits AI execution for that environment **and** the user explicitly requests it. No such
  permission exists in this repository today. Because pushing `sit` / `uat` *is* deploying here, a
  request to push one of those branches is a **deployment request** and deserves an explicit
  confirmation of the branch and the environment before anything runs.

**Never infer permission from a completion phrase.** None of the following means commit, push, merge,
or deploy:

```
"done"        "finish it"      "deploy-ready"
"complete"    "ready to merge"  "wrap it up"     "ship it"
```

When the intent is ambiguous, the assistant **stops at `READY FOR MANUAL COMMIT` and asks** — the cost
of asking is a sentence; the cost of an unwanted push to `sit` or `uat` is a deployment nobody planned.

#### 15d · Final status vocabulary

Extends §14u. Once the code, documentation, and verification work is finished and nothing else is
pending:

| State | Use when |
|---|---|
| **`READY FOR MANUAL COMMIT`** | Code + docs + tests are complete and verified; the change is waiting for a human to review, stage, commit, and push. **This is the normal terminal state of AI-assisted work.** |
| `READY FOR DBA` | A required backend DB execution is still pending (§12g). |
| `READY FOR SIT` / `READY FOR UAT` | Environment verification has not been performed yet. |
| `READY FOR DEPLOYMENT` | Everything is verified and the change is waiting on the team's release process. |
| `PARTIAL` / `BLOCKED` | Work genuinely remains, or a dependency blocks it (§13). |

**Never report** `PUSHED` · `MERGED` · `DEPLOYED` · `SIT COMPLETE` · `UAT COMPLETE` · `PROD COMPLETE`
**unless the action was actually performed and verified by the responsible team.** This is §14h's
test-result honesty rule applied to Git and to environments: an action nobody performed is not a status,
and a branch nobody pushed is not deployed. On this side that also means **`SIT COMPLETE` requires the
deployed SIT build to have been checked** — not merely that the branch was pushed and the pipeline
started.

#### 15e · Team scope

This rule binds **Cambodia developers · Vietnam developers · Korea developers · any future WeCMS
contributor**, and **Claude Code · Agents · Cursor · every other AI tool**. Teams may hold different
operational authority — who is allowed to push `sit` / `uat`, who runs the release, who executes DB
SQL — but **no team and no tool treats commit, push, merge, or environment promotion as an automatic
step**.

Recorded so the whole chain reads in one line:

```
QUALITY GATE COMPLETE  →  READY FOR MANUAL COMMIT  →  HUMAN Git / deployment process
```

### 16 · Human approval gate between investigation and implementation (MANDATORY)

**Added 2026-08-18. Canonical definition for `wecms-web`.** The backend counterpart is
`wecms-api/CLAUDE.md` §17 *(separate repository)* and must agree with this section.
[docs/README.md](docs/README.md), [docs/audits/README.md](docs/audits/README.md),
[docs/bugs/README.md](docs/bugs/README.md), [docs/issues/README.md](docs/issues/README.md) and both
harness skill trees (`.claude/skills/wecms-web-docs/**`, `.agents/skills/wecms-web-docs/**`) summarize
it and point here — **if any of those disagrees with this section, this section wins.**

This section adds the missing boundary between **finding out** and **changing things**. It does not
restate §1–§15: docs-first placement, the database-dependency rule, the quality gate, and the manual
Git / deployment rule are read first and are unchanged.

> **Investigation never authorizes implementation.** Understanding a defect is not permission to fix
> it. The decision to change application code belongs to a **human developer or reviewer**, made after
> reading the record.

This generalizes a gate the project already has: workspace [CLAUDE.md](../CLAUDE.md) §5 ("Required
analysis before modifying a copied legacy table") already says *analyse, present the impact, obtain
explicit approval, then change* — and §12d already treats an approval gate as something the dated
record exists to serve. §16 extends that from legacy-table work to **every investigation-only
request**.

#### 16a · Core principle — the record is the pre-implementation review contract

Before application code is modified, a human developer/reviewer must be able to read the relevant
Markdown record and understand:

- **what** is wrong or requested
- the **current verified behaviour**
- the **expected / target behaviour**
- the **root cause** or investigation findings, where known
- **what implementation is recommended**
- **which repositories** are affected
- **DB impact** (dependency only on this side — §12g) · **API impact** · **UI impact**
- **risks**
- the **required tests** and **required regression scenarios**

The human then decides whether implementation is approved. **An AI assistant must never assume that
completing an investigation authorizes a fix.**

#### 16b · The record exists first — and the assistant proves it

For every **BUG · ISSUE · FEATURE · AUDIT / INVESTIGATION**, the governed Markdown record exists
**before** detailed investigation or application-code implementation begins, at the placement §4
already defines — `docs/bugs/` · `docs/issues/` · `docs/features/<domain>/<feature>/` ·
`docs/audits/`, filename `descriptive-name-YYYY-MM-DD.md`. **Do not invent a different location.**

Saying *"docs-first followed"* is not proof. **The file must exist**, and the assistant reports it
explicitly:

```
Documentation record:
docs/audits/internal-transfer-database-error-audit-2026-08-18.md

Classification:        AUDIT / INVESTIGATION
Investigation Status:  IN PROGRESS
Approval Status:       PENDING
Implementation Status: NOT STARTED
```

#### 16c · Reading intent — three request classes

The request itself decides how far the work may go. Classify it before starting.

| | Request looks like | Authorizes | Ends at |
|---|---|---|---|
| **A · CHECK / INVESTIGATE ONLY** | *"Can you check this?"* · *"Please investigate."* · *"Why does this happen?"* · *"Find the cause."* · *"Review this issue."* · *"Audit this."* · *"Analyze this problem."* · *"Can you check the error?"* | documentation · read-only source inspection · Git/history inspection · inspecting and (where safe) running existing tests · read-only DB/schema inspection where permitted · root-cause analysis · parity comparison · a **recommended** implementation · risk and test recommendations | **STOP for human approval** |
| **B · INVESTIGATE AND FIX** | *"Please investigate and fix this error."* | everything in A, **plus implementation** — the request already carries approval | `READY FOR MANUAL COMMIT` (§15) |
| **C · IMPLEMENT** | *"Implement this feature."* · *"Please fix this bug."* · *"Proceed with this solution."* | implementation — explicitly authorized | `READY FOR MANUAL COMMIT` (§15) |

**Class A does NOT authorize:** modifying source · writing implementation tests · modifying SQL ·
modifying migrations · modifying configuration · implementing · committing · pushing · merging ·
deploying.

**Class B needs no second approval.** *"Investigate and fix"* contains the decision — do not stall the
work by asking again. Still docs-first: create the record, investigate, confirm the root cause, update
the record, **then** implement.

**Class C still requires the record first.** Explicit implementation intent removes the approval
question, never the documentation requirement (§2).

**When the class is genuinely ambiguous, treat it as A** — the cost of stopping to ask is one message;
the cost of an unwanted change to a deploying frontend is considerably more.

#### 16d · Investigation phase (class A)

```
REQUEST → CLASSIFY → CREATE DOC → INVESTIGATE → UPDATE DOC WITH FINDINGS → STOP
```

The record carries, **where applicable** (omit what does not apply — §14x's risk-based rule holds here
too; a boilerplate heading with nothing under it is noise):

```
## Observed Behavior          ## Expected Behavior         ## Reproduction
## Frontend Trace             ## Backend Trace             ## Database Trace
## Legacy / JEX Comparison    ## Root Cause                ## Evidence
## Existing Tests             ## Missing Regression Coverage
## DB Impact                  ## API Impact                ## UI Impact
## Security / Permission Impact                 ## Performance / Concurrency Impact
## Recommended Implementation ## Required Regression Tests ## Required Test Scenarios
## Risks                      ## Affected Repositories
```

and ends at:

```
Investigation Status:  COMPLETE
Approval Status:       PENDING
Implementation Status: NOT STARTED
```

**`Recommended Implementation` is a recommendation, not a licence.** Writing down the fix is part of
the investigation; applying it is not.

#### 16e · The approval gate

When a class-A task is complete, **the assistant stops.** A human developer/reviewer reads the record
and chooses one of:

```
APPROVE IMPLEMENTATION   ·   DENY / NO IMPLEMENTATION   ·   NEEDS MORE INVESTIGATION
```

**The assistant must not infer the decision.** These are **not** approval:

```
"OK"        "thanks"       "looks good"
"done"      "understood"   "check again"
```

Explicit implementation intent looks like:

```
"Approved, implement the fix."      "Please continue with implementation."
"Proceed with the fix."             "Implement this solution."
```

This is the same discipline as §15c (a completion phrase is never permission to push) applied one step
earlier in the workflow.

#### 16f · If approved

Update the record, then proceed:

```
Approval Status:       APPROVED
Implementation Status: IN PROGRESS
```

```
APPROVED → implement → self-audit the Git diff → automated tests → regression tests
  → test scenarios → API / UI / DB / security / performance checks when applicable
  → update permanent documentation → quality gate (§14) → READY FOR MANUAL COMMIT → STOP
```

**Approval to implement is not approval to ship.** §15 is unchanged: no automatic commit, push, merge,
tag, deploy, or promotion — and since pushing `sit` / `uat` deploys, that stays a separate human
decision even after the code change is approved.

#### 16g · If denied

If the human decision is `DENY` · `DO NOT FIX` · `NOT REQUIRED` · `WON'T FIX` · `KEEP CURRENT
BEHAVIOUR`, the assistant must:

1. **not** modify application source,
2. **not** add implementation tests,
3. **not** create DB changes,
4. **not** create migrations,
5. **record the human decision** in the document,
6. **preserve all investigation evidence**,
7. **stop.**

```
Investigation Status:  COMPLETE
Approval Status:       DENIED
Implementation Status: NOT APPROVED / WON'T FIX
```

**The record stays in the repository as engineering history — never delete it because implementation
was denied.** A denied investigation is one of the most useful documents in the tree: the next person
who hits the same symptom finds the analysis *and* the decision. This extends §13 (blocked / partial
work is documented, not deleted). If the deferral is something the team means to revisit, it also
belongs in [docs/tech-debt.md](docs/tech-debt.md).

#### 16h · If more investigation is requested

```
Approval Status: NEEDS MORE INVESTIGATION
```

Continue investigating only — **do not implement.** Update the **same** record unless the new work is
genuinely a different task (§12b–12c: one task → one canonical record per repository).

#### 16i · Audit → BUG / ISSUE → implementation

§4's rule is unchanged and now has its approval step made explicit:

```
AUDIT  ──identifies──▶  BUG / ISSUE  ──human approval──▶  IMPLEMENTATION
```

- The audit **stays** in [docs/audits/](docs/audits/README.md). Never converted, never deleted.
- When implementation is later approved, create the **BUG** or **ISSUE** record per §4.
- **Do not copy the full audit into the bug/issue record** — the implementation record **links to the
  audit as evidence**.

#### 16j · Feature review vs feature implementation

A feature request does **not** authorize implementation when the ask is only *"review this feature"* ·
*"check feasibility"* · *"design this"* · *"analyze how we could implement this"* · *"prepare a plan"*:

```
FEATURE DOC → ANALYZE / DESIGN → UPDATE DOC → STOP FOR APPROVAL
```

When the request says *"implement this feature"*, implementation is already approved (class C) — and
docs-first still comes first. A Figma-driven task is read the same way: *"design this screen"* is class
A (read the frames, produce the spec, stop); *"build this screen"* is class C. The Figma-first rule
(`get_design_context` + `get_screenshot` before the plan) applies to both.

#### 16k · Status model — three dimensions, one canonical `Status:`

A record tracks three independent dimensions in its metadata:

| Dimension | Values |
|---|---|
| **Investigation Status** | `IN PROGRESS` · `COMPLETE` · `BLOCKED` |
| **Approval Status** | `PENDING` · `APPROVED` · `DENIED` · `NEEDS MORE INVESTIGATION` · `NOT REQUIRED` |
| **Implementation Status** | `NOT STARTED` · `IN PROGRESS` · `COMPLETE` · `BLOCKED` · `WON'T FIX` |

**This is not a second status vocabulary**, and it is unrelated to the five-word doc-classification
vocabulary (`CURRENT` · `LEGACY` · `PLANNED` · `HISTORICAL` · `SUPERSEDED`). The record keeps its single
canonical `**Status:**` work-item field (§2, §14u, §15d); the three dimensions are extra metadata that
explain *why* it holds that value:

| Investigation | Approval | Implementation | Canonical `Status:` |
|---|---|---|---|
| IN PROGRESS | PENDING | NOT STARTED | `IN PROGRESS` |
| COMPLETE | PENDING | NOT STARTED | `COMPLETE` *(the investigation is what was asked for)* |
| COMPLETE | NEEDS MORE INVESTIGATION | NOT STARTED | `IN PROGRESS` |
| COMPLETE | DENIED | NOT APPROVED / WON'T FIX | `CLOSED` |
| COMPLETE | APPROVED | IN PROGRESS | `IN PROGRESS` |
| COMPLETE | APPROVED | COMPLETE (code + tests + docs done) | `READY FOR MANUAL COMMIT` (§15d) |
| COMPLETE | APPROVED | COMPLETE, backend DB execution pending | `PARTIAL` / `BLOCKED` (§12g) |
| any | any | BLOCKED | `BLOCKED` |
| n/a — routine implementation task (class B / C) | `NOT REQUIRED` | per the work | the existing §14u / §15d states |

`Approval Status: NOT REQUIRED` is the honest value for class-B and class-C work, where the request
itself carried the decision — use it rather than back-filling a fictitious approval.

#### 16l · Documentation review contract — what the reviewer must be able to answer

Before approving implementation, the record should let the reviewer answer:

```
 1. What exactly is the problem / requirement?
 2. What does the system do now?
 3. Why does it behave that way?
 4. What change is proposed?
 5. Which repository changes?
 6. Is DB work required?
 7. Does API behaviour change?
 8. Does UI behaviour change?
 9. Are security / permission concerns involved?
10. Are concurrency / performance risks involved?
11. What regression tests are required?
12. What test scenarios prove the change?
13. What risks or limitations remain?
```

**If the document cannot answer the questions that apply, implementation should not be approved yet** —
the right response is `NEEDS MORE INVESTIGATION`, not a hopeful start on the code.

#### 16m · Approval to implement ≠ approval to execute SQL

Keep the two decisions separate:

| Decision | Who makes it | Governed by |
|---|---|---|
| **Implementation Approval** | the developer / reviewer | this section |
| **DB Execution Approval** | the DBA / authorized executor per environment | §12g here · `wecms-api/CLAUDE.md` §14 *(separate repository)* |

Frontend implementation may be `APPROVED` while the backend DB execution it depends on is still
`READY FOR DBA` / `PENDING`. Approving the code change **never** authorizes running SQL against a
shared environment — and frontend developers do not execute database changes at all (§12g).

#### 16n · Audit COMPLETE ≠ defect fixed

Make this explicit in every record. `Audit Status: COMPLETE` means **the investigation is complete** —
it does **not** mean the defect is fixed. This is a valid, finished state for an investigation request:

```
Audit:          COMPLETE
Approval:       PENDING
Implementation: NOT STARTED
```

Reporting a closed audit as if the underlying defect were resolved is the same category of error as
reporting an unrun test as `PASS` (§14h) or claiming visual verification for a UI that was never run
(§14l).

#### 16o · The assistant's response before approval

For investigation-only work, the final response includes:

```
Documentation record:      <path>
Classification:            AUDIT / BUG / ISSUE / FEATURE
Investigation:             COMPLETE / BLOCKED
Root cause:                <short summary>
Recommended implementation: <short summary>
Affected repositories:     <wecms-web / wecms-api / both>
DB impact:                 <NONE (frontend) — dependency only / …>
Required tests:            <short summary>
Approval:                  PENDING HUMAN REVIEW
Implementation:            NOT STARTED
```

**Then STOP.** Do not ask *"shall I continue?"* as a way of nudging the work forward, and do not begin
implementing while waiting. **A recommendation is allowed; implementation is not.**

#### 16p · Team scope and multi-developer work

Binds **Cambodia · Vietnam · Korea · every future WeCMS contributor**, and **Claude Code · Agents ·
Cursor · every other AI assistant**. This is repository/project governance, not an individual
preference.

- **One canonical investigation/implementation record per affected repository** (§12b). If Developer A
  investigates and Developer B later receives approval to implement, **B reads and updates the same
  record** — never a developer-specific duplicate.
- **A recorded denial binds everyone** until a later authorized decision changes it. If a colleague's
  record says `Approval Status: DENIED`, that is the project's position — reopen it with a new
  decision, not with a quiet fix.

#### 16q · Worked example — Internal Transfer (2026-08-18)

Request: *"When I press the Transfer button, it gives an error. Can you help me check it?"*

That is **class A**. The correct behaviour is:

```
1. classify as AUDIT / INVESTIGATION
2. create the audit record FIRST
3. investigate: web → API → DB → legacy JEX → Git / deployment state
4. document the root cause
5. document that an existing source fix may already exist
6. document missing regression coverage if found
7. STOP
8. the human reads the audit
9. the human chooses: APPROVE IMPLEMENTATION / TEST WORK · DENY · MORE INVESTIGATION
```

Note steps 5 and 6: *"a fix already exists in the source"* and *"there is no regression test for this"*
are **findings to record**, not tasks to start. Writing the missing test is implementation work and
waits for approval like any other.

### 17 · Test-result records — durable execution evidence (MANDATORY)

**Added 2026-08-18. Canonical definition for `wecms-web`.** The backend counterpart is
`wecms-api/CLAUDE.md` §18 *(separate repository)*. [docs/README.md](docs/README.md),
[docs/testing/README.md](docs/testing/README.md),
[docs/testing/results/README.md](docs/testing/results/README.md),
[docs/bugs/README.md](docs/bugs/README.md), [docs/issues/README.md](docs/issues/README.md) and
both harness skill trees (`.claude/skills/wecms-web-docs/**`, `.agents/skills/wecms-web-docs/**`)
summarize it and point here — **if any of those disagrees with this
section, this section wins.**

This section adds one thing to the quality gate (§14): **when verification is actually executed, the
evidence gets its own durable Markdown record, linked from the implementation record, before the work
may be called COMPLETE.** It does not restate §1–§17.

> **A dated implementation record says what the change was. A test-result record says what was
> actually run, on what, and what happened.** For a meaningful change, the implementation record's
> `## Verification` section is a **summary plus a link** — not the whole evidence story.

#### 17a · When a test-result record is required

Required for every meaningful implemented **BUG · ISSUE · FEATURE · PARITY FIX · behaviour-changing
refactor**, **once verification or tests are actually executed**.

**Not required** for: the §10 exception list (comment-only, formatting, lint, lockfile noise, …), and
**audit-only work where no implementation was approved** (§17j).

The record documents **what** was tested · **how** · **what actually ran** · **what passed** · **what
failed** · **what was not run** · **which environment** · **what evidence supports completion**.

#### 17b · Location and filename

```
docs/testing/results/descriptive-name-test-result-YYYY-MM-DD.md
```

Folder rules and the index: [docs/testing/results/README.md](docs/testing/results/README.md).

- **Do not** put test-result records in `docs/bugs/`, `docs/issues/`, or `docs/audits/` — those keep
  their existing purposes (§4).
- **Do not create a second competing location.** [docs/testing/testing-strategy.md](docs/testing/testing-strategy.md)
  keeps its job — describing the Vitest setup that exists, the include-glob trap, and what is absent.
  A `results/` record is **per implemented change**, whichever environment it was verified in. (This
  repository has no `testing/sit/` or `testing/uat/` folder — the backend owns those.)
- **Filename:** lowercase kebab-case, subject first, ISO date. Examples:

```
internal-transfer-target-account-test-result-2026-08-18.md
citad-recipient-name-resolution-test-result-2026-08-18.md
tax-filing-export-test-result-2026-08-18.md
```

Forbidden, exactly as §5: `test.md` · `result.md` · `final-test.md` · `p0-test.md` · `a1-01-test.md` ·
`dev-a-test.md`. Internal issue IDs live in the metadata (`**Issue:**`), never the filename.

#### 17c · When it is created — after real execution

Docs-first (§2) governs the **implementation** record: it comes first. The **test-result** record is
different — it is created or updated **when verification is actually performed**:

```
IMPLEMENTATION RECORD FIRST → human approval where required (§16) → implementation
  → run tests / verification → CREATE TEST-RESULT RECORD → record actual evidence
  → update the BUG / ISSUE / FEATURE record with the test-result link
  → final quality gate (§14) → status decision → READY FOR MANUAL COMMIT (§15)
```

**Never pre-write a `PASS` test-result document before the tests run.** A test-result file that
predates its own execution is a fabrication, not a plan.

#### 17d · `test-scenarios.md` vs a test-result record — different documents

| | `docs/features/**/test-scenarios.md` | `docs/testing/results/*-test-result-YYYY-MM-DD.md` |
|---|---|---|
| **Is** | a **specification** — permanent, reusable scenarios describing how the feature *should* be tested | **evidence** from one actual verification run |
| **Lifecycle** | kept current with the feature | frozen once written; a later run gets a later file |
| **Example** | *Scenario: valid internal transfer · Expected: target accounts load successfully* | *Test: `TransferTargetAccount.test.tsx` · Command: `npx vitest run components/banking/internal-transfer` · Result: PASS — 12 executed, 12 passed, 0 failed* |

**Do not confuse planned scenarios with actual results** (§14h). A scenario listed in
`test-scenarios.md` is never evidence that anything was executed.

#### 17e · Template

```markdown
# <Change Name> — Test Result

**Date:** YYYY-MM-DD
**Type:** TEST RESULT
**Status:** PASS | FAIL | PARTIAL | BLOCKED
**Repository:** wecms-web
**Related Record:** <relative link to the bug / issue / feature record>
**Issue:** <ticket ID if available>

## Scope
What implementation/change is being verified.

## Environment
LOCAL | SIT | UAT — only the environments actually used (this repo has no DEV frontend).
Do not claim SIT/UAT testing that was not performed.

## Code / Build Under Test
Branch: · Commit: · Build/artifact: · API URL/environment:
Do not fabricate values. `Commit: NOT COMMITTED` is a valid, honest entry (§15).

## Automated Tests
| Test / Command | Result | Evidence |
|---|---|---|
Results: PASS | FAIL | NOT RUN | BLOCKED | NOT APPLICABLE

## Regression Tests
The tests specifically protecting the changed behaviour. For a bug fix, state whether
the test covers the original defect (§17f).

## Test Scenarios
| Scenario | Expected | Actual | Result |
|---|---|---|---|
Only scenarios actually executed — do not copy the whole permanent set.

## API Verification            ## UI Verification
## Database Verification       (dependency only on this side — §12g; name the backend record)
## Security / Permission Verification
## Performance / Concurrency Verification

## Existing Failures
Pre-existing failures, listed separately with the evidence that they predate this work (§14j-B).

## New Failures
Failures caused by this implementation (§14j-A). Any entry here means the task is NOT COMPLETE.

## Not Tested
Relevant checks not performed, and why.

## Final Result
PASS | FAIL | PARTIAL | BLOCKED

## Recommendation
READY FOR MANUAL COMMIT | PARTIAL | BLOCKED | READY FOR DBA | READY FOR SIT | …
```

Use only the applicable sections — §14x's risk-based rule holds here too.

#### 17f · Bug fixes — the regression question must be answered

A test-result record for a **BUG** answers, explicitly:

> **Did a regression test cover the original defect? YES / NO**

```
YES →  Test file: · Test case: · Original failure reproduced/protected: · Result:
NO  →  Reason:
```

A bare *"no regression test"* is **not acceptable** when the defect is automatable (§14d).

#### 17g · Link it back — `## Test Evidence` in the implementation record

Once the test-result record exists, the BUG / ISSUE / FEATURE record gains:

```markdown
## Test Evidence

Test result:
[Internal Transfer Target Account Test Result](../testing/results/internal-transfer-target-account-test-result-2026-08-18.md)

Final test result:    PASS
Regression coverage:  PASS
```

**The link must resolve in both directions** — the implementation record links to the result, the
result's `**Related Record:**` links back. The record's `## Verification` section (§14g) stays as the
**summary**; the durable detail lives in the test-result file. Do not duplicate the whole result
document into the record.

#### 17h · Status and completion

`Implementation Status: COMPLETE` requires that all required implementation work is done **and** the
test evidence supports it. Adds one dimension to §16k:

```
Investigation Status:  COMPLETE
Approval Status:       APPROVED
Implementation Status: COMPLETE
Test Status:           PASS
Overall Status:        READY FOR MANUAL COMMIT
```

If tests fail: `Test Status: FAIL` and `Implementation Status: BLOCKED` / `PARTIAL` — **do not mark
COMPLETE** (§14j-A).

**Passing tests are not a deployment.** This is correct and complete work:

```
Code implementation: COMPLETE · Automated tests: PASS · Regression: PASS
Test-result document: COMPLETE · Manual commit: PENDING · SIT deployment: NOT STARTED
  → Overall: READY FOR MANUAL COMMIT
```

`SIT COMPLETE` · `UAT COMPLETE` · `PROD COMPLETE` are reported only when those environments were
actually deployed and verified (§15d).

#### 17i · DB-dependent tests

When the change needs a DB script that has not been executed:

```
DB script prepared: YES · DB executed: NO
  → tests depending on it:  BLOCKED   (say so in the test-result record)
  → overall:                READY FOR DBA         — not COMPLETE (§12g)
```

After the DBA executes it, the **same** test-result record may be updated with the real post-DB
verification, or a new dated one written for that run — say which in the record.

#### 17j · Audit-only work — no test-result record required

For an AUDIT / investigation where **no implementation was approved** (§16), no implementation
test-result file is required:

```
Audit: COMPLETE · Approval: DENIED (or PENDING) · Implementation: NOT STARTED
```

If the audit ran diagnostic tests as **investigation evidence**, record those inside the audit itself.
The separate test-result requirement begins when implementation/verification work actually occurs.

#### 17k · Cross-repository changes

When both repositories change and both sides have meaningful verification, **each repository carries
its own test-result record**:

```
wecms-api/docs/testing/results/recipient-name-resolution-api-test-result-2026-08-18.md
wecms-web/docs/testing/results/recipient-name-resolution-web-test-result-2026-08-18.md
```

The API result covers backend tests · API contract · DB / integration · business logic. The WEB result
covers frontend tests · UI behaviour · API consumption. **Cross-link for integration behaviour; do not
duplicate all the evidence into both files** (§14r).

#### 17l · Honesty — the same rule as everywhere else

The test-result document records **actual observations only**. Never write `PASS` for something that
was not run; use `NOT RUN` · `BLOCKED` · `NOT APPLICABLE` with the reason:

```
SIT manual verification:  NOT RUN — deployment is manual and has not happened yet
Database verification:    BLOCKED — DBA script has not been applied
UI visual verification:   NOT RUN — browser environment was unavailable
```

Pre-existing failures are listed **separately and visibly** (§14j-B), never hidden or quietly repaired.

#### 17m · Team scope, AI enforcement, and existing work

Binds **Cambodia · Vietnam · Korea · every future WeCMS contributor**, and **Claude Code · Agents ·
Cursor · every other AI assistant.** Human developers preserve test evidence under the same governance —
this is not an AI-only requirement.

**AI enforcement.** After implementing an approved change, an assistant must: run the applicable tests →
capture the actual results → create/update the test-result record → link it to the implementation
record → update `test-scenarios.md` where required (§14f) → finish the rest of the quality gate → set an
honest status → **stop at `READY FOR MANUAL COMMIT`**. Saying *"all tests passed"* without recording
what actually ran is not an acceptable report.

**Not retroactive.** This applies to **new and in-flight work**. Do **not** mass-create test-result
files for historical bugs and features. If an in-flight implementation clearly needs one, report it as a
**TEST RESULT MIGRATION CANDIDATE** rather than back-filling evidence nobody observed.

---

## WeInvoice Project Rules

Everything below is specific to this codebase. Rules carried over from WeCMS (dialogs, buttons,
modal stacking, typography tokens, Excel ownership, print) keep their intent; their wording is now
WeInvoice's.

### Project Overview

- **25 routes + `/login`**, one `app/(dashboard)/**/page.tsx` per route. Map:
  [lib/weinvoice/nav.ts](lib/weinvoice/nav.ts) (top-nav module → sidebar group → item, with a
  `phase` badge). Route table: [docs/features/weinvoice/README.md](docs/features/weinvoice/README.md).
- Modules: **Invoices** (dashboard, purchase, sales, sources: GDT / email / mailbox / upload, sync
  history / bulk) · **Tax** (filed returns, auto-journal; VAT return + tax-reduction annex = roadmap)
  · **Reports** (roadmap) · **Checks** (invoice check, supplier risk) · **Tools** (XML viewer,
  provider catalogue, taxpayer lookup; PDF merge = roadmap) · **Settings** (general, tags,
  sub-accounts; plan = roadmap).
- Roadmap screens render [ComingSoon](components/soon/ComingSoon.tsx) only (spec §2).
- Home: `/` → `/dashboard`.

### Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2** (App Router), React 19, TypeScript 5 `strict`, alias `@/*` |
| Styling | **Tailwind CSS 4** — tokens in `app/globals.css` `@theme inline`; no `tailwind.config.js` |
| UI kit | shadcn/ui primitives copied into `components/ui/` (editable) |
| Icons | `lucide-react` (spec uses it throughout); named assets under `public/assets/` |
| ZIP | `jszip` (upload of ZIP files, ZIP download) |
| Tests | Vitest + jsdom + Testing Library — collects only `components/**` and `lib/**` |
| Fonts | Inter + Noto Sans KR via `next/font/google` in `app/layout.tsx` |

**Not used — do not introduce without a written reason:** NextAuth, next-intl, react-i18next,
Redux/Zustand, react-query/SWR, Bootstrap, MUI, Chakra, a second font family, any in-browser
workbook writer (`exceljs`, `xlsx` write paths).

### Directory Layout

```
app/
├── layout.tsx                 fonts, <LocaleProvider><DialogProvider>
├── page.tsx                   redirect('/dashboard')
├── globals.css                Tailwind 4 + WB365 tokens (text-wb-*, bg-brand, shadow-wb-*, …)
├── (auth)/login/page.tsx      login (mock)
└── (dashboard)/               layout.tsx → <AppShell>; one folder per module/screen
components/
├── layout/                    AppShell · Header · Sidebar · CommandPalette · NotificationBell
├── shared/                    cross-module UI (dialog, Modal, Popover, Select, Pagination, …)
├── ui/                        shadcn primitives (button, dialog, checkbox, input, …)
└── <module>/                  invoices · dashboard · connections · upload · sync · tax · checks · tools · settings · soon
lib/
├── weinvoice/                 domain: types, nav, format, providers (138 NCC), xml, vnwords, pdfText, exporter, auth
├── api/weinvoice/             data access (MOCK): store, mockData, invoices, sync, tags, checks, registry, journal, taxportal, mailbox, subaccounts, original, testdata, notifications
├── i18n/                      LocaleProvider, useTranslation, LOCALE_OPTIONS
└── utils.ts                   cn, storage, sleep, downloadBlob
locales/                       vi.json · en.json · ko.json (flat dotted keys)
proxy.ts                       edge auth gate (wecms_token presence cookie)
```

The folder map is closed: no root-level `utils/`, `services/`, `helpers/`, `common/`.

### Composition rules

- `app/**/page.tsx` stays thin — compose one module component.
- **Reuse before creating:** `components/ui/` → `components/layout/` → `components/shared/` → the
  module folder. The second consumer of a piece of logic is the trigger to extract it into a shared
  module; never copy between modules.
- Extend a shared component (new prop / variant) instead of forking it. Call out a genuinely new
  shared component in the MR.

### Data layer — mock today, API tomorrow

- **Screens only call `lib/api/weinvoice/*`** (and read state through `useStore`). They never touch
  `mockData.ts`, `getState()` internals for writing, or a transport directly.
- Mock modules keep the **function signatures as the contract**; replacing their bodies with HTTP
  calls must not require screen changes.
- **Data source switch:** `NEXT_PUBLIC_WEINVOICE_DATA_SOURCE=api` ([lib/api/weinvoice/source.ts](lib/api/weinvoice/source.ts))
  makes the data layer call `/api/v1/weinvoice/*`; default `mock`. Wired: **every P1 endpoint of
  the backend design note** (companies, sync, invoices + detail + files + exports, email, mailboxes,
  uploads, tags, providers, dashboard) against the **published** backend contract
  (`we-scraping-api` `docs/features/addon-service/weinvoice/interface-specification.md`, backend repo);
  sub-accounts are not in it and show "not available on the server yet"; mailboxes (`/mailboxes*`) follow the
  backend record `weinvoice-mailbox-connections-2026-11-12` ([feature record](docs/features/weinvoice/weinvoice-mailbox-connections-2026-11-12.md)); the header bell (`/notifications*`, `lib/api/weinvoice/notifications.ts`) follows `weinvoice-notifications-2026-11-12` ([feature record](docs/features/weinvoice/weinvoice-notifications-2026-11-12.md)). In API mode the store starts empty and is hydrated by `lib/api/weinvoice/remote.ts`;
  P3–P6 screens stay on the mock — see [weinvoice-api-integration-2026-11-03.md](docs/features/weinvoice/weinvoice-api-integration-2026-11-03.md).
  A module with an API path keeps both paths and maps wire → screen shape once (`to…` mapper). Keep mock data **deterministic and fictional** — never real
  customer data, tax-office passwords, mailbox passwords or tokens (handover security note).
- **Secrets never reach the UI or state** (§3.10): passwords for GDT, the tax portal and mailboxes
  live only in the input while the user types.
- Business rules from the spec are implemented once in the data layer, referenced by § in a comment
  (e.g. de-dup key §3.2 in `invoices.importParsed`). Do not re-implement a rule inside a screen.
- No third-party captcha / anti-bot bypass anywhere (§3.4). Where the spec shows a captcha, the
  user types it.

### API Naming & Serialization Standards

For when the backend arrives (same three-layer rule WeCMS used):

| Layer | Convention |
|---|---|
| Wire JSON (request + response) | lowercase `snake_case` |
| Frontend wire types | `snake_case`, in a dedicated wire-types module |
| Frontend in-memory types (`lib/weinvoice/types.ts`, props, state) | camelCase semantic names |

Translate at the boundary exactly once (in `lib/api/weinvoice/*`); screens never see snake_case.
Stable identifier **values** stay as the backend defines them (status codes, `"VND"`). One response
envelope; HTTP 200 is not success on its own. Pagination for new endpoints: `page` (zero-based) +
`size`. Field names in `lib/weinvoice/types.ts` already note the WeCMS `BUSA_DOC_MSTR` mapping for
the WeCMS integration (spec §1).

### Auth

- [proxy.ts](proxy.ts) is the single route gate: no `wecms_token` cookie → `/login?next=…`.
  `/login` and the Zalo verifier file are the only public paths.
- [lib/weinvoice/auth.ts](lib/weinvoice/auth.ts) calls `POST /api/v1/auth/login` (two-step when the
  user belongs to several companies: `companies_available` → re-post with `biz_key`), `GET /me`
  (rehydrate on app load in `AppShell`) and `POST /logout` (server revoke). The JWT goes through the
  shared `tokenStorage` (localStorage + presence cookie); the profile through `userStorage`.
- Transport: [lib/axios.ts](lib/axios.ts) — Bearer token, `Accept-Language` from the locale, and a
  401 on any non-auth endpoint clears the session and goes to `/login?next=…`. Wire types:
  [lib/types/api.ts](lib/types/api.ts).
- Logout clears only the token + session keys. **Never `localStorage.clear()`** — `wecms_locale`
  survives logout.

| Storage key | Owner | Cleared on logout |
|---|---|---|
| `wecms_token` | `tokenStorage` | Yes |
| `wecms_user` | `userStorage` (profile from login / `/me`) | Yes |
| `wecms_locale` | `LocaleProvider` | No |

### i18n

- In-house provider ([lib/i18n/LocaleProvider.tsx](lib/i18n/LocaleProvider.tsx)); locales
  `VI` (default + fallback) · `EN` · `KO`; pickers use `LOCALE_OPTIONS` (VI first).
- **Every user-visible string goes through `t(…)`** and exists in all three `locales/*.json` in the
  same MR. Labels come from the spec — do not invent wording for spec-defined screens.
- Formatters that branch on locale compare case-insensitively (`locale.toLowerCase() === "vi"`).
- Mock *data* (company names, item names, journal descriptions) stays Vietnamese — it stands in for
  real Vietnamese records, not UI text.

### UI Implementation Baseline

The **spec screens are the visual reference**; the shell and shared components below implement
them. A new screen mirrors the closest existing one:

| Pattern | Reference |
|---|---|
| List page with filters, KPIs, table, totals footer, pagination | [InvoiceListPage](components/invoices/InvoiceListPage.tsx) |
| Dashboard / card + chart page | [Dashboard](components/dashboard/Dashboard.tsx) |
| Run-a-check page with progress + findings | [SupplierRiskPage](components/checks/SupplierRiskPage.tsx) |
| Settings-style list + edit | [SubAccountsPage](components/settings/SubAccountsPage.tsx) |
| Detail modal with tabs | [InvoiceDetailModal](components/invoices/InvoiceDetailModal.tsx) |

#### Shared components — use, don't rebuild

| Need | Use |
|---|---|
| Page shell | `PageLayout`, `PageHeader` (`title`, `subtitle`, right slot) |
| Section card / empty state | `Card`, `EmptyState` |
| Buttons | `components/ui/button` — variants `primary` · `brand` · `neutral` · `danger` · `subtle`, sizes `wb-sm` (32 px) · `md` (36 px), `icon` prop; `IconButton` for 32 px icon-only actions |
| Filters | `Select`, `SearchInput`, `Popover` + `MenuItem`, `LabeledCheckbox` |
| Status / file chips | `StatusPill` (`size="sm"` in dense cells, `warning` variant), `FileBadge` |
| Pagination | `components/shared/Pagination` — sizes fixed to `PAGE_SIZE_OPTIONS` `[10, 20, 50, 100]` |
| Feature dialog | `components/shared/Modal` (on shadcn `Dialog`) |
| System message | `useDialog()` |

#### Dialogs

- **System messages** go through `useDialog()` ([components/shared/dialog](components/shared/dialog/index.ts)):
  `open({ type, … })`, or the Promise helpers `alert({ title, message, kind })`,
  `confirm({ title, message, confirmLabel, danger })` → `boolean`, and `toast(text, kind)`.
  Pick the variant by meaning: API / validation failure → `error`; informational / "not available
  yet" → `info` (Warning chrome) or a toast; destructive confirm → `confirm` (`danger` only for a red
  CTA); completed action → `success` / toast. Never build a bespoke message dialog.
- **Feature dialogs** use `Modal` with a spec `width`. A modal opened from inside another modal
  passes `stackLevel={2}` (deeper chains 3, 4 …). Never override z-indexes per call site;
  `SystemDialog` (`z-[100]`) and toasts (`z-[110]`) always sit above modals.
- Only the top-most layer is interactive; ESC closes only the top layer.

#### Typography & tokens

- Sizes: `text-wb-{10,11,12,13,14,14-tight,14-loose,15,16,18,22,24,28,34}`; colours `bg-brand`,
  `text-brand`, `text-wb-{ink,dark,muted,ntrl-5…10}`, `wb-status-*`, `wb-warn-*`; shadows
  `shadow-wb-{btn,brand-btn,outline,focus,card,popup}`.
- **Forbidden** in components: `text-[Npx]`, `leading-[Npx]`, `font-[N]`, `tracking-[…]`, inline
  `style={{ fontSize | fontWeight | fontFamily | lineHeight }}`. Need a new size → add a token to
  `@theme inline` first. (SVG chart text attributes are not Tailwind typography.)
- Inline `style` is allowed only for computed values (widths from data, chart geometry, tag colours).
- Scrollable areas use `custom-scrollbar` / `-x` / `-y`; no per-component scrollbar CSS.

#### Tables

Real `<table>` markup; header cells single-line; numbers right-aligned; totals row aligned under the
columns it sums; horizontal scroll inside the table container, never at page level. Row click opens
detail; in-row controls carry `data-ignore-row-click`.

#### Responsive

Desktop-first; must work at 375 / 768 / 1024 / 1440. Below `lg` the sidebar is a drawer and the
module switcher moves into it. No page-level horizontal scroll.

#### Export, print, files

- **Excel is generated by the backend, never in the browser.** Until the API exists, Excel buttons
  run their pre-checks (e.g. "missing XML" §3.6) and then show "not available in this build"
  (`common.export_unavailable`). Reading an uploaded file client-side is fine.
- ZIP download is built client-side with `jszip` from data the browser already holds; listings
  inside the ZIP are HTML, not XLSX.
- **Print** opens a popup with the rendered document and prints the popup
  (`printRenderedInvoice`, `lib/print.ts`). Never `window.print()` on the live page; no
  `@media print` CSS.

#### Column settings

The invoice list keeps the spec's local column toggles
([ColumnSetting](components/invoices/ColumnSetting.tsx)). A server-persisted View Setting returns
with the backend; do not add browser-persisted column state meanwhile.

### Scope Rule

- Frontend tasks change **only this repository**. Backend work happens in the backend repository
  when it exists, on an explicit backend request.
- When a Figma URL is given, read it (`get_design_context` + `get_screenshot`) before planning; the
  spec HTML is the default reference otherwise.
- Do not port prototype simulation logic mechanically — re-implement against the business rules.

### Do / Don't

**Do** — reuse shared components; keep pages thin; put rules in the data layer with a § reference;
add all three locale entries; verify 375 / 1440; run lint + tsc + tests before handing over.

**Don't** — hard-code UI text, colours or sizes; generate workbooks in the browser; store or echo a
secret; bypass a captcha; call `localStorage.clear()`; deploy the mock build; add a library from the
"Not used" list.

### Known Issues

Tracked in [docs/tech-debt.md](docs/tech-debt.md) and the transformation record's *Known
Limitations*. Highlights: no backend (all data mock, resets on reload); pre-existing
`react-hooks/set-state-in-effect` lint errors in a few untouched shared components; generic shared
components kept for future screens are currently unused; small spec-inherited gaps (untranslated
"MST" in the sidebar company block, a few inline hex colours).

### Run

```bash
npm ci
npm run dev       # http://localhost:3000 — needs the backend at NEXT_PUBLIC_API_BASE_URL for login
npm run build
npm run lint
npm test
```
