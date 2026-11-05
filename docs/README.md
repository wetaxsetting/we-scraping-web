# Documentation — WeInvoice frontend

**Status: CURRENT (index)** — as of 2026-11-03.

This repository (historically `wecms-web`) now renders the **WeInvoice** application: e-invoice
collection and management (GDT, provider PDFs, email, upload), checks, taxpayer lookup, filed returns
and auto-journal. P1 is a **static UI on mock data** — no backend is called yet. The WeCMS screens
and their documentation were removed on 2026-11-03; they remain in git history.

## Start Here

| Need | Go to |
|---|---|
| What the app does, routes, architecture, business rules | [features/weinvoice/README.md](features/weinvoice/README.md) |
| How the WeCMS → WeInvoice change was made, and what is still open | [features/weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md](features/weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md) |
| Manual test scenarios | [features/weinvoice/test-scenarios.md](features/weinvoice/test-scenarios.md) |
| Automated tests that exist | [testing/testing-strategy.md](testing/testing-strategy.md) |
| Known deferred issues | [tech-debt.md](tech-debt.md) |
| Coding rules | [../CLAUDE.md](../CLAUDE.md) · [../AGENTS.md](../AGENTS.md) · [frontend-project-rules.md](frontend-project-rules.md) |

## Implementation records (docs-first)

**Adopted 2026-08-17.** Every meaningful behaviour-changing task — bug fix, issue, feature, audit /
parity review / investigation, functional behaviour / business-rule / API / UI / integration change,
legacy-JEX parity resolution, functional refactor, or SIT/UAT behaviour fix — gets a **dated Markdown
implementation record created BEFORE the detailed investigation begins — and therefore before any application code is modified**, with `**Status:** IN
PROGRESS`. The record is then completed in place after implementation and its status moved to
`COMPLETE` / `CLOSED` / `PARTIAL` / `BLOCKED`.

> **⛔ HARD PRECONDITION — `NO DOC FILE → NO DETAILED INVESTIGATION → NO IMPLEMENTATION`**
> *(strengthened 2026-08-18 after a governance test failed — a "can you check this error?" request
> produced a full UI → API → DB → legacy investigation and no record).*
> **Orientation** — reading enough to classify the task and place its record — is allowed before the
> file exists. **Investigation** — tracing the fault, following the component/hook chain, inspecting
> the request the UI sends, comparing against legacy, forming a root cause — is not. Create the record,
> **verify it exists**, report its path, and only then investigate; write findings into that same record
> as they are found. An unknown root cause is written `Pending investigation` — never a reason to
> postpone the record. If the record cannot be created, **stop** and report `DOCS-FIRST BLOCKED`. Full
> rule: [../CLAUDE.md](../CLAUDE.md) §2a.

> **This applies to the whole team, not just to AI sessions.** Every developer contributing a
> meaningful behaviour-changing change follows docs-first — **manually, with Claude Code, with Cursor,
> with any other AI assistant, with IDE tooling, via scripts, or pair programming.** No one is exempt
> because they did not use an AI tool, because the work is on their own branch, because the change is
> small but behaviour-changing, or because it is frontend-only. The requirement belongs to the
> **project**, not to a person or a tool. AI assistants **enforce** this rule; they do not own it.
>
> The **developer who starts the change** is responsible for ensuring the record exists before code
> implementation begins. **One task → one canonical record per affected repository** — if a second
> developer continues the work, they update the *same* record, never add a per-person copy. The rule
> holds on every branch and environment, **including `sit` / `uat` and PROD hotfixes**. Team detail
> (parallel work, review expectations, the emergency-hotfix exception):
> [../CLAUDE.md](../CLAUDE.md) §12 "Who must follow this".

The full rule — mandatory order, Definition of Done, filename + date standards, both initial
templates, planned-vs-current wording, the parity and cross-repo rules, and the exception list — is
**authoritative in [../CLAUDE.md](../CLAUDE.md) §"Docs-First Implementation Workflow (MANDATORY)"**.
This section is a pointer; if the two disagree, `CLAUDE.md` wins.

- **Filename:** `descriptive-name-YYYY-MM-DD.md`, lowercase kebab-case, ISO date only — e.g.
  `approval-box-detail-navigation-fix-2026-08-17.md`. Never a work-code or sequence filename
  (`a1-01-…`, `k9-fix.md`, `p1-update.md`, `task-03.md`, `final-fix.md`).
- **Internal issue / task IDs** (`A1-01`, `K9`, `TH-01`, `P0`, `Task-03`, …) go in the document
  metadata as `**Issue:**`, not in the filename.
- **Where it goes** *(placement policy revised 2026-08-17)* — four record categories, one home each:
  | Record type | Home |
  |---|---|
  | **BUG** — dated bug-fix implementation record | [bugs/](bugs/) |
  | **ISSUE** — dated non-bug issue / behavioural / operational / tracked implementation record | [issues/](issues/) |
  | **FEATURE** — current + permanent screen documentation (**structure unchanged** — the 6-doc set) | [features/](features/)`<domain>/<feature>/` |
  | **AUDIT** — audit · parity review · verification · investigation · legacy comparison · migration verification · architecture review · historical validation · cross-feature analysis | [audits/](audits/README.md) |

  Dated bug/issue records **no longer** live inside the feature folder; the earlier "no global `bugs/`
  or `issues/` folder" instruction is **withdrawn**. [testing/](testing/) keeps its existing purpose as
  **permanent reference** material — a bug/issue that touches one of them still gets its dated record in
  `bugs/` / `issues/` and the permanent doc updated afterwards. A knowingly-deferred issue you are *not*
  fixing still belongs in [tech-debt.md](tech-debt.md), not `issues/`.
- **BUG vs ISSUE:** BUG = implemented behaviour is incorrect / something broke / behaviour differs from
  an accepted requirement / a defect causes wrong behaviour / parity behaviour is wrong and the task is
  to fix it. ISSUE = needed implementation work that is not clearly a product defect / operational or
  configuration correction / an unresolved implementation concern / a tracked problem that does not fit
  BUG cleanly. **When unclear, prefer ISSUE.** Never file duplicate BUG + ISSUE records for one task.
- **A record for a screen is not an audit, and an audit is never converted into one.** An audit records
  what was true on a date (→ [audits/](audits/README.md)); an implementation record explains a change
  (→ [bugs/](bugs/) or [issues/](issues/)). If an audit leads to a fix, the audit stays put and a
  **separate** record is created for the fix.
- **A large feature is still a feature** — do not open a bug/issue record just because feature work is
  big.
- **Database work is backend-owned — no `.sql` in this repository** *(added 2026-08-17)*. Migration
  files and manual DBA scripts live in `wecms-api` (`src/main/resources/db/migration/` for a new table or
  DB function; `docs/sql/<YYYY>/` for existing-table changes, indexes, constraints, and any data change).
  A frontend record declares `## Database Impact` as **`NONE (frontend) — database dependency only`**
  plus a cross-link to the backend record that owns the SQL, documented only to the depth needed to
  explain the frontend dependency. Never embed executable SQL in a frontend doc. A frontend task is not
  `COMPLETE` while the backend DB change it depends on is unapplied in the target environment.
  Frontend developers do not execute database changes. Full rule: [../CLAUDE.md](../CLAUDE.md) §12g;
  backend authority: `wecms-api/CLAUDE.md` §14 *(separate repository)*.
- **`Status: IN PROGRESS / COMPLETE / CLOSED / PARTIAL / BLOCKED` is the record's own lifecycle
  field — not a sixth value** in the five-word [Status vocabulary](#status-vocabulary) below. The two
  axes are independent: a finished record is typically `HISTORICAL` as a document *and*
  `Status: COMPLETE` as a work item.
- **Dated record ≠ permanent docs.** [bugs/](bugs/) and [issues/](issues/) are **change history**; they
  do not replace [features/](features/). The dated record explains *why the change happened*; the
  screen's 6-doc set describes *how the system works now*. Update the permanent docs after
  implementation when the authoritative behaviour changed — and never treat a dated record as the only
  source of truth for current behaviour.
- **An existing authoritative feature doc does not remove the docs-first requirement.**
- **Cross-repo work** (WEB + API) creates the record in **both** repositories before either side's
  code is modified — `wecms-web/docs/bugs/` ↔ `wecms-api/docs/bugs/` for a BUG,
  `wecms-web/docs/issues/` ↔ `wecms-api/docs/issues/` for an ISSUE, same descriptive subject + date
  where appropriate, cross-linked. For a cross-repo **audit**, prefer the repository that owns the
  primary audit scope; if both sides need their own evidence, scope one record per repository and
  cross-link. The backend counterpart is `wecms-api/docs/README.md` § the same section *(separate
  repository)*.
- **Validate before declaring complete** — run `node scripts/check-doc-links.mjs` (see
  [Validating this tree](#validating-this-tree)). Expected: 0 broken links.

### Implementation quality gate — verify before COMPLETE

**Added 2026-08-18.** Docs-first opens the task; the **quality gate closes it**. After the code is
written, a meaningful BUG / ISSUE / FEATURE / parity fix / behaviour, business-rule, API, UI or
integration change is **not complete until it has been verified**:

```
DOCS-FIRST RECORD → implementation → implementation self-audit → tests
  → test scenarios → regression review → DB verification (if applicable)
  → security / permission verification (if applicable) → documentation update
  → final evidence → COMPLETE
```

**The full rule is authoritative in [../CLAUDE.md](../CLAUDE.md) §14 "Implementation quality gate".**
This is a pointer; if the two disagree, `CLAUDE.md` wins. In short:

- **Self-audit the actual Git diff** (`git status` · `git diff` · `git diff --stat`) — not the original
  ticket text. Unrequested changes in the diff are a finding, not a bonus (§14b, §14s).
- **Decide the appropriate tests and add them where in scope.** A bug fix normally carries a
  **regression test** that fails before the fix and passes after; if that is impractical, the record
  says **why** and supplies manual evidence. *"No test needed"* with no justification is not
  acceptable (§14c, §14d).
- ⚠️ **Put the test where Vitest actually collects it.** Only `components/**` and `lib/**` are in the
  include globs — a test in `hooks/` or `app/` is **silently skipped** and passes by never running.
  See [testing/testing-strategy.md](testing/testing-strategy.md).
- **Run the relevant scope** (`npm test`, or `npx vitest run components/<area>` first) and **report
  exactly what was run** (§14i). There is **no CI test stage** — running it is a manual responsibility.
  Failing tests are classified — caused-by-this-change / pre-existing / environment / test-data /
  unresolved — never hidden (§14j).
- **Update `features/**/test-scenarios.md`** when permanent screen behaviour changed; the dated record
  keeps only this change's evidence. A scenario listed there is **not** evidence that an automated test
  covers it (§14f).
- **Verify what applies**: API consumption contract · UI (route, loading, empty, error, validation,
  permission visibility, navigation, dialogs, localization EN/KO/VI, the actual request the UI sends) ·
  DB **dependency** (§12g — no SQL here) · legacy/JEX parity · security & permissions · performance &
  concurrency · error handling (§14k–§14q).
- **Do not claim visual verification if the UI was not actually run and inspected** (§14l).
- **Record the evidence** in the record's **`## Verification`** section, with honest states —
  `PASS` / `FAIL` / `NOT RUN` / `BLOCKED` / `NOT APPLICABLE`. A test plan is never reported as a test
  result (§14g, §14h).
- **Write the durable evidence to a test-result record** *(added 2026-08-18)*. Once verification
  actually runs, the command, counts, environment, build under test, and pre-existing-vs-new failures
  go into [testing/results/](testing/results/)`descriptive-name-test-result-YYYY-MM-DD.md`; the
  implementation record gains a **`## Test Evidence`** section linking to it, and the result links back.
  `## Verification` stays the summary. **`Implementation Status: COMPLETE` requires test evidence that
  supports it** — if tests fail, the honest pair is `Test Status: FAIL` + `BLOCKED` / `PARTIAL` (§17).
  Rules: [testing/results/README.md](testing/results/README.md).
- **`COMPLETE` only when every required part is done** — otherwise `PARTIAL` / `BLOCKED` /
  `READY FOR SIT` / `READY FOR DEPLOYMENT` (§14u).
- **Cross-repo work is not complete because one repository is green** — both sides verify, then the
  integration is verified end-to-end (§14r).
- **Risk-based, not boilerplate.** Every check is *required when applicable*; a CSS fix does not need a
  DB audit, and a payment-approval UI change needs a great deal more (§14x).

**Same team scope as docs-first:** Cambodia · Vietnam · Korea · any future WeCMS contributor, and every
tool — manual, Claude Code, Cursor, another AI assistant, IDE tooling, scripts, pair programming. **No
team runs a weaker Definition of Done** (§14a). Reviewer checklist: §14v. AI assistants enforce the
same rule and may not stop at "the code compiles" (§14w).

### Manual Git & deployment — the workflow ends at READY FOR MANUAL COMMIT

**Added 2026-08-18.** The quality gate finishes the *work*; it does not ship it.

```
QUALITY GATE COMPLETE  →  READY FOR MANUAL COMMIT  →  HUMAN Git / deployment process
```

> ⚠️ **In this repository a push IS a deployment** — CI runs on `sit` and `uat` and triggers the
> downstream build/deploy pipeline (see [Environments](#environments)). `git push origin sit` and
> `git push origin uat` are **release actions against real environments**.

**The full rule is authoritative in [../CLAUDE.md](../CLAUDE.md) §15 "Manual Git & deployment rule".**
This is a pointer; if the two disagree, `CLAUDE.md` wins. In short:

- **No AI assistant automatically performs** `git commit` · `git push` · `git merge` · `git rebase` onto
  a shared branch · tag creation/push · push to `sit` / `uat` / `prod` · a deployment trigger · a
  promotion between environments · any release command. These are **manual developer / team
  responsibilities** (§15a).
- **Read-only Git inspection is expected** — `git status`, `git diff`, `git log`, `git branch` are part
  of the quality gate (§14b, §14s). The boundary is between *observing* the repository and *changing
  shared history or a running environment*.
- **The AI-assisted workflow ends at `READY FOR MANUAL COMMIT`** — never at `COMMITTED`, `PUSHED`, or
  `DEPLOYED`. After that, the developer reviews `git status` / `git diff`, stages, commits, pushes the
  intended branch, merges per team process, and promotes to SIT / UAT / PROD (§15b).
- **Explicit-request exception only** (§15c): if the user asks in the current conversation for one
  specific operation ("commit this", "push this branch", "merge this branch"), the assistant may assist
  with **that operation only**. It does not extend to the operations that usually follow, nor to the
  rest of the session. **SIT / UAT / PROD deployment and promotion stay manual regardless** — and since
  pushing `sit` / `uat` *is* deploying, such a request is a deployment request and gets an explicit
  branch + environment confirmation first.
- **Never infer permission** from *"done"*, *"finish it"*, *"deploy-ready"*, *"complete"*, or *"ready to
  merge"* — none of those means commit, push, or deploy.
- **Never report** `PUSHED` · `MERGED` · `DEPLOYED` · `SIT COMPLETE` · `UAT COMPLETE` · `PROD COMPLETE`
  unless the responsible team actually performed and verified the action — and `SIT COMPLETE` means the
  deployed build was checked, not that a pipeline started (§15d).

**Team-wide** — Cambodia · Vietnam · Korea · future contributors · Claude Code · Agents · Cursor · any
other AI tool. Git and environment promotion remain human-controlled steps (§15e).

### Human approval gate — investigation does not authorize implementation

**Added 2026-08-18.** The full chain, from a request to a hand-over:

```
INVESTIGATE  →  DOCUMENT FINDINGS  →  HUMAN APPROVAL  →  implement  →  quality gate
   →  READY FOR MANUAL COMMIT  →  HUMAN Git / deployment process
```

**The full rule is authoritative in [../CLAUDE.md](../CLAUDE.md) §16 "Human approval gate between
investigation and implementation".** This is a pointer; if the two disagree, `CLAUDE.md` wins.

- **The record is the pre-implementation review contract** (§16a). Before code changes, a reviewer must
  be able to read it and know what is wrong, what the system does now, why, what is recommended, which
  repositories are affected, the DB/API/UI impact, the risks, and the tests required.
- **The record exists first — and the assistant proves it** (§16b) by naming the actual file path,
  classification, and the three statuses. *"Docs-first followed"* is not evidence; the file must exist.
- **Three request classes** (§16c): **A · check / investigate / review / audit / analyze / design**
  authorizes documentation and read-only inspection and then **stops for human approval** — never
  source, tests, SQL, migrations, or config. **B · "investigate and fix"** already carries approval; do
  not ask twice. **C · "implement / fix this"** is explicitly authorized. Docs-first applies to all
  three. **Ambiguous → treat as A.**
- **The human decides** — `APPROVE IMPLEMENTATION` · `DENY` · `NEEDS MORE INVESTIGATION` (§16e).
  *"OK"* · *"thanks"* · *"looks good"* · *"done"* · *"understood"* · *"check again"* are **not**
  approval.
- **If denied** (§16g): no source, no tests, no DB change, no migration — record the decision, preserve
  the evidence, stop. **The record stays as engineering history; it is never deleted because
  implementation was denied.**
- **AUDIT → BUG/ISSUE → implementation** (§16i): the audit stays in [audits/](audits/README.md); the
  approved fix gets its own record in [bugs/](bugs/) / [issues/](issues/) that **links to the audit as
  evidence** rather than copying it. **`Audit: COMPLETE` never means the defect is fixed** (§16n).
- **Three status dimensions** — Investigation / Approval / Implementation — recorded as metadata and
  mapped onto the existing canonical `Status:` work-item vocabulary; this is **not** a second
  vocabulary, and it is unrelated to the five-word doc-classification vocabulary below (§16k).
- **Implementation approval ≠ DB execution approval** (§16m). Frontend code may be `APPROVED` while the
  backend SQL it depends on is still `READY FOR DBA`.

**Team-wide** — Cambodia · Vietnam · Korea · future contributors · Claude Code · Agents · Cursor · any
other AI tool (§16p). One canonical record per repository; a recorded denial binds everyone until a
later authorized decision changes it.

## Where things live

| Kind of document | Folder |
|---|---|
| Current screen / module documentation | [features/](features/README.md) |
| Dated **bug** implementation records | [bugs/](bugs/README.md) |
| Dated **issue** implementation records | [issues/](issues/README.md) |
| Audits, parity reviews, investigations (HISTORICAL) | [audits/](audits/README.md) |
| Test strategy and test-result records | [testing/](testing/README.md) |
| Knowingly deferred issues | [tech-debt.md](tech-debt.md) |

## Validating this tree

After editing any doc, run the link checker:

```bash
node scripts/check-doc-links.mjs               # repo-aware; exits 1 on any broken link
node scripts/check-doc-links.mjs --detail       # list every finding
```

**Green means:** in-repo broken = 0, unsafe = 0. Out-of-repo links are reported as a dependency count.

## Status vocabulary

**This section is the normative definition.** Five values, and no others. A reader must be able to
tell, from a document's first lines, whether it describes shipped behaviour.

| Status | Means | Typical use |
|---|---|---|
| **CURRENT** | Describes behaviour that exists in this repository **now**. Safe to build from. Keep it updated as the code moves. | Feature READMEs; index READMEs; `testing/testing-strategy.md` |
| **LEGACY** | Describes a predecessor system (JEX / WeCMS), not this one. Functional reference only. | Legacy parity baselines |
| **PLANNED** | Scoped and agreed, **not yet built**. No route/component/API exists. | A design doc written ahead of implementation |
| **HISTORICAL** | A **point-in-time finding record**. True on its stated date; not maintained afterwards. Amend the header if the conclusion changes — never rewrite the findings. | Everything in [audits/](audits/README.md) |
| **SUPERSEDED** | Retained for traceability, but **another document is authoritative**. Must name its replacement in its first lines. | — |

### Rules

- **Put the status in the first ~10 lines**, as a bold `**Status: …**` line or a leading blockquote.
  Add a qualifier freely (`CURRENT — partially wired`, `HISTORICAL — closed 2026-06-27`); the
  keyword must be one of the five.
- **CURRENT is a promise.** If a doc describes something not in the code, it is not CURRENT — it is
  PLANNED, LEGACY, or SUPERSEDED. Mis-marking this is the single most damaging documentation error
  in this tree, and the reason the P0/P1 remediation passes were needed.
- **Pre-implementation source material is not PLANNED.** Material gathered before any scoping
  decision — research, handoffs, prototypes — is classified in its own folder README.
- **Audits are HISTORICAL by definition**, even when their finding still holds. Feature docs get
  updated; audits get superseded.
- **SUPERSEDED must point somewhere.** A superseded doc with no pointer to its replacement is worse
  than no doc.
- **Do not retro-stamp historical audits.** Their existing per-audit vocabularies (`MATCH` /
  `PARTIAL` / `MISSING`, `Confirmed` / `Likely` / `Not Confirmed`) are internal to those documents
  and are not affected by this section.

## Related

- Project rules: [../CLAUDE.md](../CLAUDE.md) + [../AGENTS.md](../AGENTS.md).
- The WeInvoice UI Spec handover package (UI specification, business requirements, prototype) is kept outside this repository.
